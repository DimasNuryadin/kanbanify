import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { z, ZodError } from "zod";
import {
  AIDecomposeRequestSchema,
  AIDecomposeResponseSchema,
  AIParseAutomationRequestSchema,
  AIParseAutomationResponseSchema,
  AISuggestCardEnrichmentRequestSchema,
  AISuggestCardEnrichmentResponseSchema,
  AutomationRuleSchema,
  BoardSchema,
  BoardSummarySchema,
  BoardTemplateSchema,
  CardMovedEventDataSchema,
  CardSchema,
  ColumnMovedEventDataSchema,
  ColumnSchema,
  CommentSchema,
  CopyCardRequestSchema,
  CopyColumnRequestSchema,
  CopyColumnResponseSchema,
  CreateAutomationRuleRequestSchema,
  CreateBoardRequestSchema,
  CreateCardRequestSchema,
  CreateColumnRequestSchema,
  CreateCommentRequestSchema,
  CreateWorkspaceRequestSchema,
  HealthCheckResponseSchema,
  MoveCardRequestSchema,
  MoveColumnRequestSchema,
  StandardErrorSchema,
  UpdateAutomationRuleRequestSchema,
  UpdateBoardRequestSchema,
  UpdateCardRequestSchema,
  UpdateColumnRequestSchema,
  WorkspaceSchema,
  WorkspaceWithBoardsSchema,
  type Checklist,
  type Priority,
  type Subtask,
} from "@kinetix/contracts";
import { StorageRepository } from "./db/repository.js";
import { BoardRealtimeHub } from "./ws/hub.js";
import { AutomationEngine } from "./services/automation-engine.js";
import { AppError, buildErrorPayload } from "./errors.js";

const UuidParamSchema = z.string().uuid();
const NonEmptyIdParamSchema = z.string().min(1);

const OptionalAIDecomposeBodySchema = z
  .object({
    board_context: z.array(z.string()).optional(),
  })
  .optional();

const AIGenerateAutomationBodySchema = z.object({
  prompt: z.string().min(1).max(1000),
});

export interface BuildAppOptions {
  logger?: boolean;
  repository?: StorageRepository;
  hub?: BoardRealtimeHub;
  automationEngine?: AutomationEngine;
}

export async function buildApp(
  options: BuildAppOptions = {}
): Promise<{
  app: FastifyInstance;
  repository: StorageRepository;
  hub: BoardRealtimeHub;
  automationEngine: AutomationEngine;
}> {
  const app = Fastify({
    logger: options.logger ?? false,
  });

  const repository = options.repository ?? new StorageRepository();
  const hub = options.hub ?? new BoardRealtimeHub();
  const automationEngine =
    options.automationEngine ?? new AutomationEngine(repository, hub);

  await repository.init();
  await hub.init();

  const configuredOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : null;

  await app.register(cors, {
    origin:
      configuredOrigins && configuredOrigins.length > 0
        ? configuredOrigins
        : true,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Internal-Token",
      "X-Actor-Id",
    ],
  });

  await app.register(websocket);

  // Allow empty JSON bodies on POST endpoints like /ai-decompose, /copy
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
    if (
      fastifyErr.statusCode &&
      fastifyErr.statusCode >= 400 &&
      fastifyErr.statusCode < 500
    ) {
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

  function getActorId(
    headers: Record<string, string | string[] | undefined>
  ): string {
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
  // 2. WORKSPACES & TEMPLATES ENDPOINTS
  // ==========================================================================
  app.get("/api/v1/workspaces", async (_req, reply) => {
    const workspaces = await repository.listWorkspaces();
    const validated = z.array(WorkspaceWithBoardsSchema).parse(workspaces);
    return reply.status(200).send(validated);
  });

  app.post("/api/v1/workspaces", async (req, reply) => {
    const body = CreateWorkspaceRequestSchema.parse(req.body);
    const created = await repository.createWorkspace(body);
    const validated = WorkspaceSchema.parse(created);
    return reply.status(201).send(validated);
  });

  app.get<{ Params: { workspaceId: string } }>(
    "/api/v1/workspaces/:workspaceId",
    async (req, reply) => {
      const ws = await repository.getWorkspaceById(req.params.workspaceId);
      if (!ws) {
        throw new AppError(
          404,
          "RESOURCE_NOT_FOUND",
          `Workspace '${req.params.workspaceId}' not found`,
          { workspace_id: req.params.workspaceId }
        );
      }
      const validated = WorkspaceWithBoardsSchema.parse(ws);
      return reply.status(200).send(validated);
    }
  );

  app.get("/api/v1/board-templates", async (_req, reply) => {
    const templates = await repository.getBoardTemplates();
    const validated = z.array(BoardTemplateSchema).parse(templates);
    return reply.status(200).send(validated);
  });

  // ==========================================================================
  // 3. BOARDS ENDPOINTS
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

  app.patch<{ Params: { boardId: string } }>(
    "/api/v1/boards/:boardId",
    async (req, reply) => {
      const boardId = UuidParamSchema.parse(req.params.boardId);
      const body = UpdateBoardRequestSchema.parse(req.body);
      const updated = await repository.updateBoard(boardId, body);
      const validated = BoardSchema.parse(updated);

      await hub.broadcast({
        event: "BOARD_UPDATED",
        board_id: boardId,
        data: validated,
        actor_id: getActorId(req.headers),
      });

      return reply.status(200).send(validated);
    }
  );

  app.delete<{ Params: { boardId: string } }>(
    "/api/v1/boards/:boardId",
    async (req, reply) => {
      const boardId = UuidParamSchema.parse(req.params.boardId);
      const result = await repository.deleteBoard(boardId);

      await hub.broadcast({
        event: "BOARD_DELETED",
        board_id: boardId,
        data: { id: boardId, deleted: true },
        actor_id: getActorId(req.headers),
      });

      return reply.status(200).send(result);
    }
  );

  // ==========================================================================
  // 4. BUTLER AUTOMATION RULES ENDPOINTS
  // ==========================================================================
  app.get<{ Params: { boardId: string } }>(
    "/api/v1/boards/:boardId/automations",
    async (req, reply) => {
      const boardId = UuidParamSchema.parse(req.params.boardId);
      const rules = await repository.getAutomationRules(boardId);
      const validated = z.array(AutomationRuleSchema).parse(rules);
      return reply.status(200).send(validated);
    }
  );

  app.post<{ Params: { boardId: string } }>(
    "/api/v1/boards/:boardId/automations",
    async (req, reply) => {
      const boardId = UuidParamSchema.parse(req.params.boardId);
      const body = CreateAutomationRuleRequestSchema.parse(req.body);
      const rule = await repository.createAutomationRule(boardId, body);
      const validated = AutomationRuleSchema.parse(rule);

      await hub.broadcast({
        event: "AUTOMATION_RULE_CREATED",
        board_id: boardId,
        data: validated,
        actor_id: getActorId(req.headers),
      });

      return reply.status(201).send(validated);
    }
  );

  app.patch<{ Params: { ruleId: string } }>(
    "/api/v1/automations/:ruleId",
    async (req, reply) => {
      const ruleId = NonEmptyIdParamSchema.parse(req.params.ruleId);
      const body = UpdateAutomationRuleRequestSchema.parse(req.body);
      const { rule, boardId } = await repository.updateAutomationRule(
        ruleId,
        body
      );
      const validated = AutomationRuleSchema.parse(rule);

      await hub.broadcast({
        event: "AUTOMATION_RULE_UPDATED",
        board_id: boardId,
        data: validated,
        actor_id: getActorId(req.headers),
      });

      return reply.status(200).send(validated);
    }
  );

  app.delete<{ Params: { ruleId: string } }>(
    "/api/v1/automations/:ruleId",
    async (req, reply) => {
      const ruleId = NonEmptyIdParamSchema.parse(req.params.ruleId);
      const { id, boardId, deleted } = await repository.deleteAutomationRule(
        ruleId
      );

      await hub.broadcast({
        event: "AUTOMATION_RULE_DELETED",
        board_id: boardId,
        data: { id, deleted },
        actor_id: getActorId(req.headers),
      });

      return reply.status(200).send({ id, deleted });
    }
  );

  app.post<{ Params: { boardId: string } }>(
    "/api/v1/boards/:boardId/automations/ai-generate",
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

      const body = AIGenerateAutomationBodySchema.parse(req.body);
      const aiEngineBaseUrl = (
        process.env.INTERNAL_AI_ENGINE_URL ?? "http://localhost:8001"
      ).replace(/\/+$/, "");
      const internalToken =
        process.env.INTERNAL_SERVICE_TOKEN ?? "orca_internal_sync_token_2026";

      let generatedRule: {
        name: string;
        description: string;
        trigger: any;
        actions: any[];
      };

      try {
        const aiReqPayload = AIParseAutomationRequestSchema.parse({
          prompt: body.prompt,
          board_columns: board.columns.map((c) => ({
            id: c.id,
            title: c.title,
          })),
          board_members: board.members.map((m) => ({
            id: m.id,
            name: m.name,
          })),
          board_labels: board.labels.map((l) => ({
            id: l.id,
            name: l.name,
            color: l.color,
          })),
        });

        const response = await fetch(
          `${aiEngineBaseUrl}/internal/v1/parse-automation`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Internal-Token": internalToken,
            },
            body: JSON.stringify(aiReqPayload),
            signal: AbortSignal.timeout(8000),
          }
        );

        if (response.ok) {
          const raw = await response.json();
          generatedRule = AIParseAutomationResponseSchema.parse(raw);
        } else {
          throw new Error(`AI Engine error: status ${response.status}`);
        }
      } catch (err) {
        console.warn(
          `[AIAutomationBuilder] AI Engine unreachable or error (${
            err instanceof Error ? err.message : String(err)
          }); using deterministic fallback builder.`
        );

        const promptLower = body.prompt.toLowerCase();
        let triggerType: any = "WHEN_CARD_CREATED";
        let columnTitleMatch: string | null = null;
        let triggerColId: string | null = null;
        let triggerPriority: any = null;

        if (promptLower.includes("done") || promptLower.includes("move")) {
          triggerType = "WHEN_CARD_MOVED_TO_COLUMN";
          for (const col of board.columns) {
            if (promptLower.includes(col.title.toLowerCase())) {
              columnTitleMatch = col.title;
              triggerColId = col.id;
              break;
            }
          }
          if (!columnTitleMatch) {
            columnTitleMatch = "Done";
          }
        } else if (promptLower.includes("checklist")) {
          triggerType = "WHEN_CHECKLIST_COMPLETED";
        } else if (promptLower.includes("urgent")) {
          triggerType = "WHEN_PRIORITY_CHANGED";
          triggerPriority = "URGENT";
        } else if (promptLower.includes("high")) {
          triggerType = "WHEN_PRIORITY_CHANGED";
          triggerPriority = "HIGH";
        }

        const actions: any[] = [];
        if (promptLower.includes("due") || promptLower.includes("complete")) {
          actions.push({
            type: "MARK_DUE_DATE_COMPLETE",
            due_complete_value: true,
            member_id: null,
            label_id: null,
            priority: null,
            target_column_id: null,
            checklist_title: null,
            checklist_items: null,
            comment_text: null,
          });
        }
        if (promptLower.includes("priority")) {
          actions.push({
            type: "SET_PRIORITY",
            priority: promptLower.includes("urgent") ? "URGENT" : "HIGH",
            member_id: null,
            label_id: null,
            target_column_id: null,
            checklist_title: null,
            checklist_items: null,
            comment_text: null,
            due_complete_value: null,
          });
        }
        for (const m of board.members) {
          if (promptLower.includes(m.name.toLowerCase().split(" ")[0]!)) {
            actions.push({
              type: "ASSIGN_MEMBER",
              member_id: m.id,
              label_id: null,
              priority: null,
              target_column_id: null,
              checklist_title: null,
              checklist_items: null,
              comment_text: null,
              due_complete_value: null,
            });
            break;
          }
        }
        for (const l of board.labels) {
          if (
            (l.name && promptLower.includes(l.name.toLowerCase())) ||
            promptLower.includes(l.color)
          ) {
            actions.push({
              type: "ADD_LABEL",
              label_id: l.id,
              member_id: null,
              priority: null,
              target_column_id: null,
              checklist_title: null,
              checklist_items: null,
              comment_text: null,
              due_complete_value: null,
            });
            break;
          }
        }

        if (actions.length === 0) {
          actions.push({
            type: "POST_COMMENT",
            comment_text: `🤖 Butler automated action: ${body.prompt.slice(
              0,
              80
            )}`,
            member_id: null,
            label_id: null,
            priority: null,
            target_column_id: null,
            checklist_title: null,
            checklist_items: null,
            due_complete_value: null,
          });
        }

        generatedRule = {
          name:
            body.prompt.length <= 40
              ? body.prompt
              : `${body.prompt.slice(0, 37)}...`,
          description: body.prompt,
          trigger: {
            type: triggerType,
            column_id: triggerColId,
            column_title_match: columnTitleMatch,
            priority: triggerPriority,
            label_id: null,
          },
          actions,
        };
      }

      // Persist the generated rule to the board
      const persisted = await repository.createAutomationRule(boardId, {
        name: generatedRule.name,
        description: generatedRule.description,
        is_enabled: true,
        trigger: generatedRule.trigger,
        actions: generatedRule.actions,
      });

      await hub.broadcast({
        event: "AUTOMATION_RULE_CREATED",
        board_id: boardId,
        data: persisted,
        actor_id: getActorId(req.headers),
      });

      return reply.status(201).send(persisted);
    }
  );

  // ==========================================================================
  // 3. COLUMNS (TRELLO LISTS) ENDPOINTS
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

  app.patch<{ Params: { columnId: string } }>(
    "/api/v1/columns/:columnId",
    async (req, reply) => {
      const columnId = UuidParamSchema.parse(req.params.columnId);
      const body = UpdateColumnRequestSchema.parse(req.body);
      const updated = await repository.updateColumn(columnId, body);
      const validated = ColumnSchema.parse(updated);

      await hub.broadcast({
        event: "COLUMN_UPDATED",
        board_id: validated.board_id,
        data: validated,
        actor_id: getActorId(req.headers),
      });

      return reply.status(200).send(validated);
    }
  );

  app.patch<{ Params: { columnId: string } }>(
    "/api/v1/columns/:columnId/move",
    async (req, reply) => {
      const columnId = UuidParamSchema.parse(req.params.columnId);
      const body = MoveColumnRequestSchema.parse(req.body);
      const moved = await repository.moveColumn(columnId, body);
      const validated = ColumnSchema.parse(moved);

      const moveEventData = ColumnMovedEventDataSchema.parse({
        column_id: validated.id,
        new_position: validated.position,
        updated_at: new Date().toISOString(),
      });

      await hub.broadcast({
        event: "COLUMN_MOVED",
        board_id: validated.board_id,
        data: moveEventData,
        actor_id: getActorId(req.headers),
      });

      return reply.status(200).send(validated);
    }
  );

  app.post<{ Params: { columnId: string } }>(
    "/api/v1/columns/:columnId/copy",
    async (req, reply) => {
      const columnId = UuidParamSchema.parse(req.params.columnId);
      const body = CopyColumnRequestSchema.parse(req.body ?? {});
      const copied = await repository.copyColumn(columnId, body);
      const validated = CopyColumnResponseSchema.parse(copied);

      await hub.broadcast({
        event: "COLUMN_CREATED",
        board_id: validated.column.board_id,
        data: validated,
        actor_id: getActorId(req.headers),
      });

      return reply.status(201).send(validated);
    }
  );

  // ==========================================================================
  // 5. RICH CARDS & TRELLO MODAL ENDPOINTS
  // ==========================================================================
  app.post<{ Params: { boardId: string } }>(
    "/api/v1/boards/:boardId/cards",
    async (req, reply) => {
      const boardId = UuidParamSchema.parse(req.params.boardId);
      const body = CreateCardRequestSchema.parse(req.body);
      const card = await repository.createCard(boardId, body);
      const initialValidated = CardSchema.parse(card);

      await hub.broadcast({
        event: "CARD_CREATED",
        board_id: boardId,
        data: initialValidated,
        actor_id: getActorId(req.headers),
      });

      // Trigger Butler automations for card creation
      const autoResult = await automationEngine.evaluateAndExecute(boardId, {
        type: "CARD_CREATED",
        card,
      });

      const validated = CardSchema.parse(autoResult.card);
      return reply.status(201).send(validated);
    }
  );

  app.patch<{ Params: { cardId: string } }>(
    "/api/v1/cards/:cardId",
    async (req, reply) => {
      const cardId = UuidParamSchema.parse(req.params.cardId);
      const body = UpdateCardRequestSchema.parse(req.body);
      const existing = await repository.getCardById(cardId);
      if (!existing) {
        throw new AppError(
          404,
          "RESOURCE_NOT_FOUND",
          `Card '${cardId}' not found`,
          { card_id: cardId }
        );
      }

      const updated = await repository.updateCard(cardId, body);
      const validatedUpdated = CardSchema.parse(updated);

      const archiveChanged =
        body.is_archived !== undefined &&
        body.is_archived !== existing.is_archived;

      await hub.broadcast({
        event: archiveChanged ? "CARD_ARCHIVED" : "CARD_UPDATED",
        board_id: validatedUpdated.board_id,
        data: validatedUpdated,
        actor_id: getActorId(req.headers),
      });

      // Trigger Butler automations for card update
      const autoResult = await automationEngine.evaluateAndExecute(
        existing.board_id,
        {
          type: "CARD_UPDATED",
          card: updated,
          previousCard: existing,
        }
      );

      const validated = CardSchema.parse(autoResult.card);
      return reply.status(200).send(validated);
    }
  );

  app.patch<{ Params: { cardId: string } }>(
    "/api/v1/cards/:cardId/move",
    async (req, reply) => {
      const cardId = UuidParamSchema.parse(req.params.cardId);
      const body = MoveCardRequestSchema.parse(req.body);
      const { card, sourceColumnId } = await repository.moveCard(cardId, body);
      const validatedCard = CardSchema.parse(card);

      const moveEventData = CardMovedEventDataSchema.parse({
        card_id: validatedCard.id,
        source_column_id: sourceColumnId,
        target_column_id: validatedCard.column_id,
        new_position: validatedCard.position,
        updated_at: validatedCard.updated_at,
      });

      await hub.broadcast({
        event: "CARD_MOVED",
        board_id: validatedCard.board_id,
        data: moveEventData,
        actor_id: getActorId(req.headers),
      });

      // Trigger Butler automations for card move
      const autoResult = await automationEngine.evaluateAndExecute(
        card.board_id,
        {
          type: "CARD_MOVED",
          card,
          sourceColumnId,
          targetColumnId: card.column_id,
        }
      );

      const validated = CardSchema.parse(autoResult.card);
      return reply.status(200).send(validated);
    }
  );

  app.post<{ Params: { cardId: string } }>(
    "/api/v1/cards/:cardId/copy",
    async (req, reply) => {
      const cardId = UuidParamSchema.parse(req.params.cardId);
      const body = CopyCardRequestSchema.parse(req.body ?? {});
      const copied = await repository.copyCard(cardId, body);
      const validated = CardSchema.parse(copied);

      await hub.broadcast({
        event: "CARD_CREATED",
        board_id: validated.board_id,
        data: validated,
        actor_id: getActorId(req.headers),
      });

      return reply.status(201).send(validated);
    }
  );

  app.delete<{ Params: { cardId: string } }>(
    "/api/v1/cards/:cardId",
    async (req, reply) => {
      const cardId = UuidParamSchema.parse(req.params.cardId);
      const result = await repository.deleteCard(cardId);

      await hub.broadcast({
        event: "CARD_ARCHIVED",
        board_id: result.board_id,
        data: { id: result.id, deleted: true },
        actor_id: getActorId(req.headers),
      });

      return reply.status(200).send({
        id: result.id,
        deleted: true,
      });
    }
  );

  // ==========================================================================
  // 5. CARD COMMENTS ENDPOINTS
  // ==========================================================================
  app.post<{ Params: { cardId: string } }>(
    "/api/v1/cards/:cardId/comments",
    async (req, reply) => {
      const cardId = UuidParamSchema.parse(req.params.cardId);
      const rawBody =
        typeof req.body === "object" && req.body !== null
          ? (req.body as Record<string, unknown>)
          : {};

      // Derive initials from author_name if author_initials was omitted
      if (
        typeof rawBody.author_name === "string" &&
        rawBody.author_name.trim().length > 0 &&
        rawBody.author_initials === undefined
      ) {
        const derived = rawBody.author_name
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join("")
          .slice(0, 4);
        if (derived.length > 0) {
          rawBody.author_initials = derived;
        }
      }

      const body = CreateCommentRequestSchema.parse(rawBody);
      const { comment, card } = await repository.addComment(cardId, body);
      const validatedComment = CommentSchema.parse(comment);
      const validatedCard = CardSchema.parse(card);

      await hub.broadcast({
        event: "COMMENT_ADDED",
        board_id: validatedCard.board_id,
        data: validatedComment,
        actor_id: getActorId(req.headers),
      });

      return reply.status(201).send(validatedComment);
    }
  );

  app.delete<{ Params: { cardId: string; commentId: string } }>(
    "/api/v1/cards/:cardId/comments/:commentId",
    async (req, reply) => {
      const cardId = UuidParamSchema.parse(req.params.cardId);
      const commentId = NonEmptyIdParamSchema.parse(req.params.commentId);
      const { id, card } = await repository.deleteComment(cardId, commentId);
      const validatedCard = CardSchema.parse(card);

      await hub.broadcast({
        event: "CARD_UPDATED",
        board_id: validatedCard.board_id,
        data: validatedCard,
        actor_id: getActorId(req.headers),
      });

      return reply.status(200).send({
        id,
        deleted: true,
      });
    }
  );

  // ==========================================================================
  // 6. AI DECOMPOSE / ENRICH PROXY ENDPOINT
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

      const board = await repository.getBoardById(existingCard.board_id);
      const parsedBody = OptionalAIDecomposeBodySchema.parse(req.body);
      const boardContext =
        parsedBody?.board_context ??
        (board
          ? board.cards
              .filter((c) => c.id !== existingCard.id)
              .map((c) => c.title)
          : []);

      const aiEngineBaseUrl = (
        process.env.INTERNAL_AI_ENGINE_URL ?? "http://localhost:8001"
      ).replace(/\/+$/, "");
      const internalToken =
        process.env.INTERNAL_SERVICE_TOKEN ?? "orca_internal_sync_token_2026";

      let generatedChecklists: Checklist[] = [];
      let generatedSubtasks: Subtask[] = [];
      let estimatedStoryPoints = 5;
      let suggestedPriority: Priority =
        existingCard.priority === "URGENT" ? "URGENT" : "HIGH";
      let structuredDescription: string | undefined;
      let matchedLabelIds: string[] | undefined;

      try {
        // Attempt Phase 2 rich card enrichment first (/internal/v1/enrich-card)
        const enrichReqPayload = AISuggestCardEnrichmentRequestSchema.parse({
          card_title: existingCard.title,
          card_description: existingCard.description,
          board_context: boardContext,
          available_labels: board?.labels ?? [],
        });

        const enrichRes = await fetch(
          `${aiEngineBaseUrl}/internal/v1/enrich-card`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Internal-Token": internalToken,
            },
            body: JSON.stringify(enrichReqPayload),
            signal: AbortSignal.timeout(8000),
          }
        );

        if (enrichRes.status === 401) {
          const errBody = await enrichRes.json().catch(() => ({}));
          throw new AppError(
            401,
            "UNAUTHORIZED",
            "AI Engine rejected X-Internal-Token",
            typeof errBody === "object" && errBody !== null
              ? (errBody as Record<string, unknown>)
              : {}
          );
        }

        if (enrichRes.ok) {
          const rawEnrich = await enrichRes.json();
          const enrichResult =
            AISuggestCardEnrichmentResponseSchema.parse(rawEnrich);

          generatedChecklists = enrichResult.suggested_checklists.map((cl) => ({
            id: randomUUID(),
            title: cl.title,
            position: cl.position,
            items: cl.items.map((it) => ({
              id: randomUUID(),
              title: it.title,
              is_completed: false,
              position: it.position,
              due_date: null,
              assignee_id: null,
            })),
          }));

          const firstCl = generatedChecklists[0];
          generatedSubtasks = firstCl
            ? firstCl.items.map((it) => ({
                id: it.id,
                title: it.title,
                is_completed: it.is_completed,
                position: it.position,
              }))
            : [];

          estimatedStoryPoints = enrichResult.estimated_story_points;
          suggestedPriority = enrichResult.suggested_priority;
          if (enrichResult.structured_description) {
            structuredDescription = enrichResult.structured_description;
          }

          if (board && enrichResult.suggested_labels.length > 0) {
            const matched = new Set<string>(existingCard.label_ids);
            for (const sl of enrichResult.suggested_labels) {
              const found = board.labels.find(
                (bl) =>
                  bl.color === sl.color ||
                  bl.name.toLowerCase() === sl.name.toLowerCase()
              );
              if (found) {
                matched.add(found.id);
              }
            }
            matchedLabelIds = Array.from(matched);
          }
        } else {
          // Fallback to /internal/v1/decompose-task
          const aiRequestPayload = AIDecomposeRequestSchema.parse({
            card_title: existingCard.title,
            card_description: existingCard.description,
            board_context: boardContext,
          });

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
          const aiResult = AIDecomposeResponseSchema.parse(rawJson);

          generatedSubtasks = aiResult.suggested_subtasks.map((st) => ({
            id: randomUUID(),
            title: st.title,
            is_completed: false,
            position: st.position,
          }));

          generatedChecklists = [
            {
              id: randomUUID(),
              title: "AI Implementation Checklist",
              position: "a0",
              items: generatedSubtasks.map((st) => ({
                id: st.id,
                title: st.title,
                is_completed: st.is_completed,
                position: st.position,
                due_date: null,
                assignee_id: null,
              })),
            },
          ];
          estimatedStoryPoints = aiResult.estimated_story_points;
          suggestedPriority = aiResult.suggested_priority;
        }
      } catch (err) {
        if (err instanceof AppError) {
          throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[AIDecomposeProxy] AI Engine unreachable at ${aiEngineBaseUrl} (${message}); using deterministic decomposition fallback.`
        );

        const item1Id = randomUUID();
        const item2Id = randomUUID();
        const item3Id = randomUUID();

        generatedChecklists = [
          {
            id: randomUUID(),
            title: "Implementation Steps",
            position: "a0",
            items: [
              {
                id: item1Id,
                title: `Define specification & acceptance criteria for: ${existingCard.title}`,
                is_completed: false,
                position: "a0",
                due_date: null,
                assignee_id: null,
              },
              {
                id: item2Id,
                title: `Implement core logic and validation for: ${existingCard.title}`,
                is_completed: false,
                position: "a1",
                due_date: null,
                assignee_id: null,
              },
              {
                id: item3Id,
                title: `Write automated integration tests for: ${existingCard.title}`,
                is_completed: false,
                position: "a2",
                due_date: null,
                assignee_id: null,
              },
            ],
          },
          {
            id: randomUUID(),
            title: "QA & Verification",
            position: "a1",
            items: [
              {
                id: randomUUID(),
                title: `Verify contract compliance and edge cases for: ${existingCard.title}`,
                is_completed: false,
                position: "a0",
                due_date: null,
                assignee_id: null,
              },
            ],
          },
        ];

        generatedSubtasks = generatedChecklists[0]!.items.map((it) => ({
          id: it.id,
          title: it.title,
          is_completed: it.is_completed,
          position: it.position,
        }));

        if (!existingCard.description.includes("## Acceptance Criteria")) {
          structuredDescription = `## Objective\nDeliver **${existingCard.title}**${
            existingCard.description.trim()
              ? ` — ${existingCard.description.trim()}`
              : ""
          }.\n\n## Acceptance Criteria\n- Implementation satisfies shared @kinetix/contracts schemas\n- Automated regression and integration checks pass\n\n## Technical Notes\n- Preserve lexicographical fractional indexing (a0, a1, a0V).`;
        }

        if (board) {
          const aiLabel = board.labels.find(
            (bl) => bl.color === "purple" || bl.color === "blue"
          );
          if (aiLabel) {
            matchedLabelIds = Array.from(
              new Set([...existingCard.label_ids, aiLabel.id])
            );
          }
        }
      }

      const nextTags = Array.from(
        new Set([...existingCard.tags, "ai-decomposed"])
      );

      const updatedCard = await repository.updateCard(
        cardId,
        {
          checklists: generatedChecklists,
          subtasks: generatedSubtasks,
          story_points: estimatedStoryPoints,
          priority: suggestedPriority,
          tags: nextTags,
          ...(structuredDescription !== undefined
            ? { description: structuredDescription }
            : {}),
          ...(matchedLabelIds !== undefined
            ? { label_ids: matchedLabelIds }
            : {}),
        },
        {
          actorName: "Kinetix AI",
          activityActionType: "CHECKLIST_COMPLETED",
          activityDescription: `decomposed ${existingCard.title} into ${generatedChecklists.length} checklist(s)`,
        }
      );

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
  // 7. REAL-TIME WEBSOCKET ENDPOINT (WS /ws/boards/:boardId)
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

  return { app, repository, hub, automationEngine };
}
