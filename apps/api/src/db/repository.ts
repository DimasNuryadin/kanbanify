import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { asc, eq } from "drizzle-orm";
import {
  DEFAULT_BOARD_COLUMNS,
  type Board,
  type Card,
  type Column,
  type CreateBoardRequest,
  type CreateCardRequest,
  type CreateColumnRequest,
  type MoveCardRequest,
  type Subtask,
  type UpdateCardRequest,
} from "@kinetix/contracts";
import * as schema from "./schema.js";
import { AppError } from "../errors.js";

const { Pool } = pg;

export const DEFAULT_WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
export const SEED_BOARD_ID = "11111111-1111-4111-8111-111111111111";

export function compareFractionalIndex(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function normalizeIsoTimestamp(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function normalizeNullableIsoTimestamp(
  value: string | Date | null | undefined
): string | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function sortSubtasks(subtasks: Subtask[]): Subtask[] {
  return [...subtasks].sort((a, b) =>
    compareFractionalIndex(a.position, b.position)
  );
}

interface InMemoryStore {
  boards: Map<string, Omit<Board, "columns" | "cards">>;
  columns: Map<string, Column>;
  cards: Map<string, Card>;
}

function createPreseededMemoryStore(): InMemoryStore {
  const boards = new Map<string, Omit<Board, "columns" | "cards">>();
  const columns = new Map<string, Column>();
  const cards = new Map<string, Card>();

  const createdAt = "2026-11-08T10:00:00.000Z";
  boards.set(SEED_BOARD_ID, {
    id: SEED_BOARD_ID,
    workspace_id: DEFAULT_WORKSPACE_ID,
    title: "Kinetix Platform Launch",
    created_at: createdAt,
  });

  const seedCols: Column[] = [
    {
      id: "33333333-3333-4333-8333-333333333331",
      board_id: SEED_BOARD_ID,
      title: "Backlog",
      position: "a0",
      wip_limit: null,
    },
    {
      id: "33333333-3333-4333-8333-333333333332",
      board_id: SEED_BOARD_ID,
      title: "In Progress",
      position: "a1",
      wip_limit: 5,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      board_id: SEED_BOARD_ID,
      title: "Review",
      position: "a2",
      wip_limit: null,
    },
    {
      id: "33333333-3333-4333-8333-333333333334",
      board_id: SEED_BOARD_ID,
      title: "Done",
      position: "a3",
      wip_limit: null,
    },
  ];
  for (const col of seedCols) {
    columns.set(col.id, col);
  }

  const seedCard: Card = {
    id: "44444444-4444-4444-8444-444444444444",
    board_id: SEED_BOARD_ID,
    column_id: "33333333-3333-4333-8333-333333333331",
    title: "Implement OAuth2 PKCE flow",
    description: "Support GitHub and Google providers",
    position: "a0",
    priority: "HIGH",
    story_points: 5,
    tags: ["auth", "security"],
    subtasks: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        title: "Configure callback routes",
        is_completed: false,
        position: "a0",
      },
    ],
    blocked_by_card_ids: [],
    due_date: "2026-11-15T00:00:00.000Z",
    updated_at: "2026-11-08T10:05:00.000Z",
  };
  cards.set(seedCard.id, seedCard);

  return { boards, columns, cards };
}

export class StorageRepository {
  private pool: pg.Pool | null = null;
  private db: NodePgDatabase<typeof schema> | null = null;
  private useMemoryFallback = true;
  private memory: InMemoryStore = createPreseededMemoryStore();

  public isUsingPostgres(): boolean {
    return !this.useMemoryFallback && this.db !== null;
  }

  public async init(databaseUrl?: string): Promise<void> {
    const url =
      databaseUrl ??
      process.env.DATABASE_URL ??
      "postgresql://kinetix:kinetix_secret@localhost:5432/kinetix_db";

    if (process.env.FORCE_IN_MEMORY_DB === "true") {
      console.warn(
        "[StorageRepository] FORCE_IN_MEMORY_DB=true; using pre-seeded In-Memory store."
      );
      this.useMemoryFallback = true;
      return;
    }

    const candidatePool = new Pool({
      connectionString: url,
      connectionTimeoutMillis: 1500,
      max: 10,
    });

    candidatePool.on("error", (err) => {
      console.warn(
        `[StorageRepository] PostgreSQL pool background error: ${err.message}. Fallback remains active.`
      );
      this.useMemoryFallback = true;
    });

    try {
      const client = await candidatePool.connect();
      try {
        await this.ensureSchema(client);
      } finally {
        client.release();
      }
      this.pool = candidatePool;
      this.db = drizzle(candidatePool, { schema });
      this.useMemoryFallback = false;
      await this.seedPostgresIfEmpty();
      console.info(
        "[StorageRepository] Connected to PostgreSQL via Drizzle ORM."
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[StorageRepository] PostgreSQL unreachable (${message}). Gracefully falling back to pre-seeded In-Memory store.`
      );
      this.useMemoryFallback = true;
      await candidatePool.end().catch(() => undefined);
      this.pool = null;
      this.db = null;
    }
  }

  private async ensureSchema(client: pg.PoolClient): Promise<void> {
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS boards (
        id UUID PRIMARY KEY,
        workspace_id UUID NOT NULL,
        title VARCHAR(150) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS columns (
        id UUID PRIMARY KEY,
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        title VARCHAR(100) NOT NULL,
        position VARCHAR(64) NOT NULL,
        wip_limit INTEGER
      );

      CREATE TABLE IF NOT EXISTS cards (
        id UUID PRIMARY KEY,
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        column_id UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        position VARCHAR(64) NOT NULL,
        priority priority NOT NULL DEFAULT 'MEDIUM',
        story_points INTEGER,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        subtasks JSONB NOT NULL DEFAULT '[]'::jsonb,
        blocked_by_card_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        due_date TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subtasks (
        id UUID PRIMARY KEY,
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        title VARCHAR(280) NOT NULL,
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        position VARCHAR(64) NOT NULL
      );
    `);
  }

  public async seedPostgresIfEmpty(): Promise<void> {
    if (!this.db) return;
    const existingBoards = await this.db.select().from(schema.boards).limit(1);
    if (existingBoards.length > 0) return;

    await this.db
      .insert(schema.workspaces)
      .values({
        id: DEFAULT_WORKSPACE_ID,
        name: "Kinetix Default Workspace",
        created_at: "2026-11-08T10:00:00.000Z",
      })
      .onConflictDoNothing();

    const seedMem = createPreseededMemoryStore();
    for (const b of seedMem.boards.values()) {
      await this.db
        .insert(schema.boards)
        .values({
          id: b.id,
          workspace_id: b.workspace_id,
          title: b.title,
          created_at: b.created_at,
        })
        .onConflictDoNothing();
    }

    for (const col of seedMem.columns.values()) {
      await this.db
        .insert(schema.columns)
        .values({
          id: col.id,
          board_id: col.board_id,
          title: col.title,
          position: col.position,
          wip_limit: col.wip_limit,
        })
        .onConflictDoNothing();
    }

    for (const card of seedMem.cards.values()) {
      await this.db
        .insert(schema.cards)
        .values({
          id: card.id,
          board_id: card.board_id,
          column_id: card.column_id,
          title: card.title,
          description: card.description,
          position: card.position,
          priority: card.priority,
          story_points: card.story_points,
          tags: card.tags,
          subtasks: card.subtasks,
          blocked_by_card_ids: card.blocked_by_card_ids,
          due_date: card.due_date,
          updated_at: card.updated_at,
        })
        .onConflictDoNothing();

      for (const st of card.subtasks) {
        await this.db
          .insert(schema.subtasks)
          .values({
            id: st.id,
            card_id: card.id,
            title: st.title,
            is_completed: st.is_completed,
            position: st.position,
          })
          .onConflictDoNothing();
      }
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end().catch(() => undefined);
      this.pool = null;
      this.db = null;
    }
  }

  private mapRowToCard(row: typeof schema.cards.$inferSelect): Card {
    return {
      id: row.id,
      board_id: row.board_id,
      column_id: row.column_id,
      title: row.title,
      description: row.description ?? "",
      position: row.position,
      priority: row.priority,
      story_points: row.story_points ?? null,
      tags: Array.isArray(row.tags) ? row.tags : [],
      subtasks: sortSubtasks(Array.isArray(row.subtasks) ? row.subtasks : []),
      blocked_by_card_ids: Array.isArray(row.blocked_by_card_ids)
        ? row.blocked_by_card_ids
        : [],
      due_date: normalizeNullableIsoTimestamp(row.due_date),
      updated_at: normalizeIsoTimestamp(row.updated_at),
    };
  }

  private mapRowToColumn(row: typeof schema.columns.$inferSelect): Column {
    return {
      id: row.id,
      board_id: row.board_id,
      title: row.title,
      position: row.position,
      wip_limit: row.wip_limit ?? null,
    };
  }

  // ==========================================================================
  // BOARD OPERATIONS
  // ==========================================================================

  public async listBoards(): Promise<Board[]> {
    if (this.isUsingPostgres() && this.db) {
      try {
        const boardRows = await this.db
          .select()
          .from(schema.boards)
          .orderBy(asc(schema.boards.created_at));
        const colRows = await this.db
          .select()
          .from(schema.columns)
          .orderBy(asc(schema.columns.position));
        const cardRows = await this.db
          .select()
          .from(schema.cards)
          .orderBy(asc(schema.cards.position));

        return boardRows.map((b) => {
          const cols = colRows
            .filter((c) => c.board_id === b.id)
            .map((c) => this.mapRowToColumn(c))
            .sort((a, z) => compareFractionalIndex(a.position, z.position));
          const boardCards = cardRows
            .filter((c) => c.board_id === b.id)
            .map((c) => this.mapRowToCard(c))
            .sort((a, z) => compareFractionalIndex(a.position, z.position));

          return {
            id: b.id,
            workspace_id: b.workspace_id,
            title: b.title,
            columns: cols,
            cards: boardCards,
            created_at: normalizeIsoTimestamp(b.created_at),
          };
        });
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL query failed in listBoards, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    const result: Board[] = [];
    for (const b of this.memory.boards.values()) {
      const cols = Array.from(this.memory.columns.values())
        .filter((c) => c.board_id === b.id)
        .sort((a, z) => compareFractionalIndex(a.position, z.position));
      const boardCards = Array.from(this.memory.cards.values())
        .filter((c) => c.board_id === b.id)
        .sort((a, z) => compareFractionalIndex(a.position, z.position));
      result.push({
        ...b,
        columns: cols,
        cards: boardCards,
      });
    }
    return result;
  }

  public async createBoard(input: CreateBoardRequest): Promise<Board> {
    const boardId = randomUUID();
    const workspaceId = input.workspace_id ?? DEFAULT_WORKSPACE_ID;
    const createdAt = new Date().toISOString();

    const defaultColumns: Column[] = DEFAULT_BOARD_COLUMNS.map((col) => ({
      id: randomUUID(),
      board_id: boardId,
      title: col.title,
      position: col.position,
      wip_limit: null,
    })).sort((a, b) => compareFractionalIndex(a.position, b.position));

    // Keep memory synced as well
    this.memory.boards.set(boardId, {
      id: boardId,
      workspace_id: workspaceId,
      title: input.title,
      created_at: createdAt,
    });
    for (const col of defaultColumns) {
      this.memory.columns.set(col.id, col);
    }

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db.insert(schema.boards).values({
          id: boardId,
          workspace_id: workspaceId,
          title: input.title,
          created_at: createdAt,
        });
        await this.db.insert(schema.columns).values(
          defaultColumns.map((col) => ({
            id: col.id,
            board_id: col.board_id,
            title: col.title,
            position: col.position,
            wip_limit: col.wip_limit,
          }))
        );
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL insert failed in createBoard, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return {
      id: boardId,
      workspace_id: workspaceId,
      title: input.title,
      columns: defaultColumns,
      cards: [],
      created_at: createdAt,
    };
  }

  public async getBoardById(boardId: string): Promise<Board | null> {
    if (this.isUsingPostgres() && this.db) {
      try {
        const [boardRow] = await this.db
          .select()
          .from(schema.boards)
          .where(eq(schema.boards.id, boardId))
          .limit(1);

        if (!boardRow) {
          return null;
        }

        const colRows = await this.db
          .select()
          .from(schema.columns)
          .where(eq(schema.columns.board_id, boardId))
          .orderBy(asc(schema.columns.position));

        const cardRows = await this.db
          .select()
          .from(schema.cards)
          .where(eq(schema.cards.board_id, boardId))
          .orderBy(asc(schema.cards.position));

        const cols = colRows
          .map((c) => this.mapRowToColumn(c))
          .sort((a, b) => compareFractionalIndex(a.position, b.position));

        const boardCards = cardRows
          .map((c) => this.mapRowToCard(c))
          .sort((a, b) => compareFractionalIndex(a.position, b.position));

        return {
          id: boardRow.id,
          workspace_id: boardRow.workspace_id,
          title: boardRow.title,
          columns: cols,
          cards: boardCards,
          created_at: normalizeIsoTimestamp(boardRow.created_at),
        };
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL query failed in getBoardById, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    const memBoard = this.memory.boards.get(boardId);
    if (!memBoard) return null;

    const cols = Array.from(this.memory.columns.values())
      .filter((c) => c.board_id === boardId)
      .sort((a, b) => compareFractionalIndex(a.position, b.position));

    const boardCards = Array.from(this.memory.cards.values())
      .filter((c) => c.board_id === boardId)
      .sort((a, b) => compareFractionalIndex(a.position, b.position));

    return {
      ...memBoard,
      columns: cols,
      cards: boardCards,
    };
  }

  // ==========================================================================
  // COLUMN OPERATIONS
  // ==========================================================================

  public async createColumn(
    boardId: string,
    input: CreateColumnRequest
  ): Promise<Column> {
    const board = await this.getBoardById(boardId);
    if (!board) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Board '${boardId}' not found`,
        { board_id: boardId }
      );
    }

    const newCol: Column = {
      id: randomUUID(),
      board_id: boardId,
      title: input.title,
      position: input.position,
      wip_limit: input.wip_limit ?? null,
    };

    this.memory.columns.set(newCol.id, newCol);

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db.insert(schema.columns).values({
          id: newCol.id,
          board_id: newCol.board_id,
          title: newCol.title,
          position: newCol.position,
          wip_limit: newCol.wip_limit,
        });
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL insert failed in createColumn, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return newCol;
  }

  // ==========================================================================
  // CARD OPERATIONS
  // ==========================================================================

  public async createCard(
    boardId: string,
    input: CreateCardRequest
  ): Promise<Card> {
    const board = await this.getBoardById(boardId);
    if (!board) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Board '${boardId}' not found`,
        { board_id: boardId }
      );
    }

    const columnExists = board.columns.some((c) => c.id === input.column_id);
    if (!columnExists) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Column '${input.column_id}' not found in board '${boardId}'`,
        { board_id: boardId, column_id: input.column_id }
      );
    }

    const now = new Date().toISOString();
    const sortedSubtasks = sortSubtasks(input.subtasks ?? []);
    const newCard: Card = {
      id: randomUUID(),
      board_id: boardId,
      column_id: input.column_id,
      title: input.title,
      description: input.description ?? "",
      position: input.position,
      priority: input.priority ?? "MEDIUM",
      story_points: input.story_points ?? null,
      tags: input.tags ?? [],
      subtasks: sortedSubtasks,
      blocked_by_card_ids: input.blocked_by_card_ids ?? [],
      due_date: input.due_date ?? null,
      updated_at: now,
    };

    this.memory.cards.set(newCard.id, newCard);

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db.insert(schema.cards).values({
          id: newCard.id,
          board_id: newCard.board_id,
          column_id: newCard.column_id,
          title: newCard.title,
          description: newCard.description,
          position: newCard.position,
          priority: newCard.priority,
          story_points: newCard.story_points,
          tags: newCard.tags,
          subtasks: newCard.subtasks,
          blocked_by_card_ids: newCard.blocked_by_card_ids,
          due_date: newCard.due_date,
          updated_at: newCard.updated_at,
        });

        if (newCard.subtasks.length > 0) {
          await this.db.insert(schema.subtasks).values(
            newCard.subtasks.map((st) => ({
              id: st.id,
              card_id: newCard.id,
              title: st.title,
              is_completed: st.is_completed,
              position: st.position,
            }))
          );
        }
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL insert failed in createCard, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return newCard;
  }

  public async getCardById(cardId: string): Promise<Card | null> {
    if (this.isUsingPostgres() && this.db) {
      try {
        const [row] = await this.db
          .select()
          .from(schema.cards)
          .where(eq(schema.cards.id, cardId))
          .limit(1);
        if (!row) return null;
        return this.mapRowToCard(row);
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL query failed in getCardById, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return this.memory.cards.get(cardId) ?? null;
  }

  public async updateCard(
    cardId: string,
    input: UpdateCardRequest
  ): Promise<Card> {
    const existing = await this.getCardById(cardId);
    if (!existing) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Card '${cardId}' not found`,
        { card_id: cardId }
      );
    }

    const now = new Date().toISOString();
    const updatedCard: Card = {
      ...existing,
      column_id: input.column_id ?? existing.column_id,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      position: input.position ?? existing.position,
      priority: input.priority ?? existing.priority,
      story_points:
        input.story_points !== undefined
          ? input.story_points
          : existing.story_points,
      tags: input.tags ?? existing.tags,
      subtasks:
        input.subtasks !== undefined
          ? sortSubtasks(input.subtasks)
          : existing.subtasks,
      blocked_by_card_ids:
        input.blocked_by_card_ids ?? existing.blocked_by_card_ids,
      due_date:
        input.due_date !== undefined ? input.due_date : existing.due_date,
      updated_at: now,
    };

    this.memory.cards.set(cardId, updatedCard);

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db
          .update(schema.cards)
          .set({
            column_id: updatedCard.column_id,
            title: updatedCard.title,
            description: updatedCard.description,
            position: updatedCard.position,
            priority: updatedCard.priority,
            story_points: updatedCard.story_points,
            tags: updatedCard.tags,
            subtasks: updatedCard.subtasks,
            blocked_by_card_ids: updatedCard.blocked_by_card_ids,
            due_date: updatedCard.due_date,
            updated_at: updatedCard.updated_at,
          })
          .where(eq(schema.cards.id, cardId));

        if (input.subtasks !== undefined) {
          await this.db
            .delete(schema.subtasks)
            .where(eq(schema.subtasks.card_id, cardId));
          if (updatedCard.subtasks.length > 0) {
            await this.db.insert(schema.subtasks).values(
              updatedCard.subtasks.map((st) => ({
                id: st.id,
                card_id: cardId,
                title: st.title,
                is_completed: st.is_completed,
                position: st.position,
              }))
            );
          }
        }
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL update failed in updateCard, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return updatedCard;
  }

  /**
   * O(1) single-row fractional index move update.
   */
  public async moveCard(
    cardId: string,
    input: MoveCardRequest
  ): Promise<{ card: Card; sourceColumnId: string }> {
    const existing = await this.getCardById(cardId);
    if (!existing) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Card '${cardId}' not found`,
        { card_id: cardId }
      );
    }

    const sourceColumnId = existing.column_id;
    const now = new Date().toISOString();

    const movedCard: Card = {
      ...existing,
      column_id: input.target_column_id,
      position: input.new_position,
      updated_at: now,
    };

    this.memory.cards.set(cardId, movedCard);

    if (this.isUsingPostgres() && this.db) {
      try {
        const [updatedRow] = await this.db
          .update(schema.cards)
          .set({
            column_id: input.target_column_id,
            position: input.new_position,
            updated_at: now,
          })
          .where(eq(schema.cards.id, cardId))
          .returning();

        if (updatedRow) {
          return {
            card: this.mapRowToCard(updatedRow),
            sourceColumnId,
          };
        }
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL O(1) moveCard failed, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return {
      card: movedCard,
      sourceColumnId,
    };
  }
}
