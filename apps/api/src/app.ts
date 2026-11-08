import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { z, ZodError } from "zod";
import {
  AIDecomposeRequestSchema,
  AIDecomposeResponseSchema,
  BoardSchema,
  CardMovedEventDataSchema,
  CardSchema,
  ColumnSchema,
  CreateBoardRequestSchema,
  CreateCardRequestSchema,
  CreateColumnRequestSchema,
  HealthCheckResponseSchema,
  MoveCardRequestSchema,
  StandardErrorSchema,
  UpdateCardRequestSchema,
  type AIDecomposeResponse,
  type Subtask,
} from "@kinetix/contracts";
import { StorageRepository } from "./db/repository.js";
import { BoardRealtimeHub } from "./ws/hub.js";
import { AppError, buildErrorPayload } from "./errors.js";

const UuidParamSchema = z.string().uuid();

const OptionalAIDecomposeBodySchema = z
  .object({
    board_context: z.array(z.string()).optional(),
  })
  .optional();

export interface BuildAppOptions {
  logger?: boolean;
  repository?: StorageRepository;
  hub?: BoardRealtimeHub;
}

export async function buildApp(
  options: BuildAppOptions = {}
): Promise<{
  app: FastifyInstance;
  repository: StorageRepository;
  hub: BoardRealtimeHub;
}> {
  const app = Fastify({
    logger: options.logger ?? false,
  });

  const repository = options.repository ?? new StorageRepository();
  const hub = options.hub ?? new BoardRealtimeHub();

  await repository.init();
  await hub.init();

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Internal-Token", "X-Actor-Id"],
  });

  await app.register(websocket);

  // Allow empty JSON bodies on POST endpoints like /ai-decompose
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      const raw = typeof body === "string" ? body.trim() : "";
      if (!raw) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(raw));
      } catch (err) {
        done(
          new AppError(
            400,
            "VALIDATION_ERROR",
            "Malformed JSON request body",
            { reason: err instanceof Error ? err.message : String(err) }
          ),
          undefined
        );
      }
    }
  );

  // Standard Error Envelope Handler
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      const payload = StandardErrorSchema.parse(err.toJSON());
      return reply.status(err.statusCode).send(payload);
    }

    if (err instanceof ZodError) {
      const payload = StandardErrorSchema.parse(
        buildErrorPayload("VALIDATION_ERROR", "Validation failed", {
          issues: err.issues,
        })
      );
      return reply.status(400).send(payload);
    }

    const fastifyErr = err as { statusCode?: number; message?: string };
    if (fastifyErr.statusCode && fastifyErr.statusCode >= 400 && fastifyErr.statusCode < 500) {
      const code =
        fastifyErr.statusCode === 401
          ? "UNAUTHORIZED"
          : fastifyErr.statusCode === 404
          ? "RESOURCE_NOT_FOUND"
          : "VALIDATION_ERROR";
      const payload = StandardErrorSchema.parse(
        buildErrorPayload(code, fastifyErr.message ?? "Client request error", {})
      );
      return reply.status(fastifyErr.statusCode).send(payload);
    }

    const payload = StandardErrorSchema.parse(
      buildErrorPayload(
        "INTERNAL_ERROR",
        err instanceof Error ? err.message : "Unexpected internal server error",
        {}
      )
    );
    return reply.status(500).send(payload);
  });

  app.setNotFoundHandler((req, reply) => {
    const payload = StandardErrorSchema.parse(
      buildErrorPayload(
        "RESOURCE_NOT_FOUND",
        `Route ${req.method} ${req.url} not found`,
        {}
      )
    );
    return reply.status(404).send(payload);
  });

  function getActorId(headers: Record<string, string | string[] | undefined>): string {
    const raw = headers["x-actor-id"];
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.trim();
    }
    return "kinetix-api";
  }

  // ==========================================================================
  // 1. HEALTH CHECK
  // ==========================================================================
  app.get("/health", async (_req, reply) => {
    const response = HealthCheckResponseSchema.parse({
      status: "ok",
      service: process.env.SERVICE_NAME ?? "kinetix-api",
      version: "1.0.0",
    });
    return reply.status(200).send(response);
  });

  // ==========================================================================
  // 2. BOARDS ENDPOINTS
  // ==========================================================================
  app.get("/api/v1/boards", async (_req, reply) => {
    const boards = await repository.listBoards();
    const validated = z.array(BoardSchema).parse(boards);
    return reply.status(200).send(validated);
  });

  app.post("/api/v1/boards", async (req, reply) => {
    const body = CreateBoardRequestSchema.parse(req.body);
    const created = await repository.createBoard(body);
    const validated = BoardSchema.parse(created);
    return reply.status(201).send(validated);
  });

  app.get<{ Params: { boardId: string } }>(
    "/api/v1/boards/:boardId",
    async (req, reply) => {
      const boardId = UuidParamSchema.parse(req.params.boardId);
      const board = await repository.getBoardById(boardId);
      if (!board) {
        throw new AppError(
          404,
          "RESOURCE_NOT_FOUND",
          `Board '${boardId}' not found`,
          { board_id: boardId }
        );
      }
      const validated = BoardSchema.parse(board);
      return reply.status(200).send(validated);
    }
  );

  // ==========================================================================
  // 3. COLUMNS ENDPOINT
  // ==========================================================================
  app.post<{ Params: { boardId: string } }>(
    "/api/v1/boards/:boardId/columns",
    async (req, reply) => {
      const boardId = UuidParamSchema.parse(req.params.boardId);
      const body = CreateColumnRequestSchema.parse(req.body);
      const column = await repository.createColumn(boardId, body);
      const validated = ColumnSchema.parse(column);

      await hub.broadcast({
        event: "COLUMN_CREATED",
        board_id: boardId,
        data: validated,
        actor_id: getActorId(req.headers),
      });

      return reply.status(201).send(validated);
    }
  );

  // ==========================================================================
  // 4. CARDS ENDPOINTS
  // ==========================================================================
  app.post<{ Params: { boardId: string } }>(
    "/api/v1/boards/:boardId/cards",
    async (req, reply) => {
      const boardId = UuidParamSchema.parse(req.params.boardId);
      const body = CreateCardRequestSchema.parse(req.body);
      const card = await repository.createCard(boardId, body);
      const validated = CardSchema.parse(card);

      await hub.broadcast({
        event: "CARD_CREATED",
        board_id: boardId,
        data: validated,
        actor_id: getActorId(req.headers),
      });

      return reply.status(201).send(validated);
    }
  );

  app.patch<{ Params: { cardId: string } }>(
    "/api/v1/cards/:cardId",
    async (req, reply) => {
      const cardId = UuidParamSchema.parse(req.params.cardId);
      const body = UpdateCardRequestSchema.parse(req.body);
      const updated = await repository.updateCard(cardId, body);
      const validated = CardSchema.parse(updated);

      await hub.broadcast({
        event: "CARD_UPDATED",
        board_id: validated.board_id,
        data: validated,
        actor_id: getActorId(req.headers),
      });

      return reply.status(200).send(validated);
    }
  );

  app.patch<{ Params: { cardId: string } }>(
    "/api/v1/cards/:cardId/move",
    async (req, reply) => {
      const cardId = UuidParamSchema.parse(req.params.cardId);
      const body = MoveCardRequestSchema.parse(req.body);
      const { card, sourceColumnId } = await repository.moveCard(cardId, body);
      const validated = CardSchema.parse(card);

      const moveEventData = CardMovedEventDataSchema.parse({
        card_id: validated.id,
        source_column_id: sourceColumnId,
        target_column_id: validated.column_id,
        new_position: validated.position,
        updated_at: validated.updated_at,
      });

      await hub.broadcast({
        event: "CARD_MOVED",
        board_id: validated.board_id,
        data: moveEventData,
        actor_id: getActorId(req.headers),
      });

      return reply.status(200).send(validated);
    }
  );

  // ==========================================================================
  // 5. AI DECOMPOSE PROXY ENDPOINT
  // ==========================================================================
  app.post<{ Params: { cardId: string } }>(
    "/api/v1/cards/:cardId/ai-decompose",
    async (req, reply) => {
      const cardId = UuidParamSchema.parse(req.params.cardId);
      const existingCard = await repository.getCardById(cardId);
      if (!existingCard) {
        throw new AppError(
          404,
          "RESOURCE_NOT_FOUND",
          `Card '${cardId}' not found`,
          { card_id: cardId }
        );
      }

      const parsedBody = OptionalAIDecomposeBodySchema.parse(req.body);
      let boardContext = parsedBody?.board_context;
      if (!boardContext) {
        const board = await repository.getBoardById(existingCard.board_id);
        boardContext = board
          ? board.cards
              .filter((c) => c.id !== existingCard.id)
              .map((c) => c.title)
          : [];
      }

      const aiRequestPayload = AIDecomposeRequestSchema.parse({
        card_title: existingCard.title,
        card_description: existingCard.description,
        board_context: boardContext,
      });

      const aiEngineBaseUrl = (
        process.env.INTERNAL_AI_ENGINE_URL ?? "http://localhost:8001"
      ).replace(/\/+$/, "");
      const internalToken =
        process.env.INTERNAL_SERVICE_TOKEN ?? "orca_internal_sync_token_2026";

      let aiResult: AIDecomposeResponse;
      try {
        const response = await fetch(
          `${aiEngineBaseUrl}/internal/v1/decompose-task`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Internal-Token": internalToken,
            },
            body: JSON.stringify(aiRequestPayload),
            signal: AbortSignal.timeout(8000),
          }
        );

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          if (response.status === 401) {
            throw new AppError(
              401,
              "UNAUTHORIZED",
              "AI Engine rejected X-Internal-Token",
              typeof errBody === "object" && errBody !== null
                ? (errBody as Record<string, unknown>)
                : {}
            );
          }
          throw new AppError(
            502,
            "INTERNAL_ERROR",
            `AI Engine returned status ${response.status}`,
            { status: response.status }
          );
        }

        const rawJson = await response.json();
        aiResult = AIDecomposeResponseSchema.parse(rawJson);
      } catch (err) {
        if (err instanceof AppError) {
          throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[AIDecomposeProxy] AI Engine unreachable at ${aiEngineBaseUrl} (${message}); using deterministic decomposition fallback.`
        );
        aiResult = AIDecomposeResponseSchema.parse({
          suggested_subtasks: [
            {
              title: `Define specification & acceptance criteria for: ${existingCard.title}`,
              position: "a0",
            },
            {
              title: `Implement core logic and validation for: ${existingCard.title}`,
              position: "a1",
            },
            {
              title: `Write automated integration tests for: ${existingCard.title}`,
              position: "a2",
            },
          ],
          estimated_story_points: 5,
          suggested_priority:
            existingCard.priority === "URGENT" ? "URGENT" : "HIGH",
          potential_risks: [
            "Cross-service contract synchronization",
            "Edge-case error handling under concurrent updates",
          ],
        });
      }

      const generatedSubtasks: Subtask[] = aiResult.suggested_subtasks.map(
        (st) => ({
          id: randomUUID(),
          title: st.title,
          is_completed: false,
          position: st.position,
        })
      );

      const updatedCard = await repository.updateCard(cardId, {
        subtasks: generatedSubtasks,
        story_points: aiResult.estimated_story_points,
        priority: aiResult.suggested_priority,
      });

      const validated = CardSchema.parse(updatedCard);

      await hub.broadcast({
        event: "CARD_UPDATED",
        board_id: validated.board_id,
        data: validated,
        actor_id: getActorId(req.headers),
      });

      return reply.status(200).send(validated);
    }
  );

  // ==========================================================================
  // 6. REAL-TIME WEBSOCKET ENDPOINT (WS /ws/boards/:boardId)
  // ==========================================================================
  app.get<{ Params: { boardId: string } }>(
    "/ws/boards/:boardId",
    { websocket: true },
    (socket, req) => {
      const parsed = UuidParamSchema.safeParse(req.params.boardId);
      if (!parsed.success) {
        socket.close(1008, "Invalid boardId UUID");
        return;
      }
      const boardId = parsed.data;
      hub.addClient(boardId, socket);
    }
  );

  app.addHook("onClose", async () => {
    await hub.close();
    await repository.close();
  });

  return { app, repository, hub };
}
