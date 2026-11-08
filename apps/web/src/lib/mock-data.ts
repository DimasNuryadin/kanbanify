import {
  Board,
  BoardSchema,
  Card,
  CardSchema,
  Column,
  ColumnSchema,
  CreateBoardRequest,
  CreateCardRequest,
  CreateColumnRequest,
  MoveCardRequest,
  Priority,
  Subtask,
  UpdateCardRequest,
} from "@kinetix/contracts";
import { comparePositions, generatePositionBetween } from "./fractional-index";

export const SEED_BOARD_ID = "11111111-1111-4111-8111-111111111111";
export const SEED_WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";

export const COL_BACKLOG_ID = "33333333-3333-4333-8333-333333333331";
export const COL_IN_PROGRESS_ID = "33333333-3333-4333-8333-333333333332";
export const COL_REVIEW_ID = "33333333-3333-4333-8333-333333333333";
export const COL_DONE_ID = "33333333-3333-4333-8333-333333333334";

const CARD_1_ID = "44444444-4444-4444-8444-444444444401";
const CARD_2_ID = "44444444-4444-4444-8444-444444444402";
const CARD_3_ID = "44444444-4444-4444-8444-444444444403";
const CARD_4_ID = "44444444-4444-4444-8444-444444444404";
const CARD_5_ID = "44444444-4444-4444-8444-444444444405";
const CARD_6_ID = "44444444-4444-4444-8444-444444444406";
const CARD_7_ID = "44444444-4444-4444-8444-444444444407";
const CARD_8_ID = "44444444-4444-4444-8444-444444444408";
const CARD_9_ID = "44444444-4444-4444-8444-444444444409";

export function createDeterministicUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const INITIAL_SEED_BOARD: Board = {
  id: SEED_BOARD_ID,
  workspace_id: SEED_WORKSPACE_ID,
  title: "Kinetix Core Launch",
  created_at: "2026-11-08T08:00:00.000Z",
  columns: [
    {
      id: COL_BACKLOG_ID,
      board_id: SEED_BOARD_ID,
      title: "Backlog",
      position: "a0",
      wip_limit: null,
    },
    {
      id: COL_IN_PROGRESS_ID,
      board_id: SEED_BOARD_ID,
      title: "In Progress",
      position: "a1",
      wip_limit: 4,
    },
    {
      id: COL_REVIEW_ID,
      board_id: SEED_BOARD_ID,
      title: "Review",
      position: "a2",
      wip_limit: 3,
    },
    {
      id: COL_DONE_ID,
      board_id: SEED_BOARD_ID,
      title: "Done",
      position: "a3",
      wip_limit: null,
    },
  ],
  cards: [
    {
      id: CARD_1_ID,
      board_id: SEED_BOARD_ID,
      column_id: COL_DONE_ID,
      title: "Lexicographical O(1) Fractional Indexing Engine",
      description:
        "Implement base-62 midpoint string computation (`a0` + `a1` -> `a0V`) so drag-and-drop card reordering updates a single row without full-column re-indexing.",
      position: "a0",
      priority: "HIGH",
      story_points: 5,
      tags: ["core", "algorithms", "perf"],
      subtasks: [
        {
          id: "55555555-5555-4555-8555-555555555501",
          title: "Implement base-62 character table & prefix stripper",
          is_completed: true,
          position: "a0",
        },
        {
          id: "55555555-5555-4555-8555-555555555502",
          title: "Verify adjacent key midpoint (`a0` and `a1` -> `a0V`)",
          is_completed: true,
          position: "a1",
        },
        {
          id: "55555555-5555-4555-8555-555555555503",
          title: "Add unit & property-based boundary ordering checks",
          is_completed: true,
          position: "a2",
        },
      ],
      blocked_by_card_ids: [],
      due_date: "2026-11-10T00:00:00.000Z",
      updated_at: "2026-11-08T09:10:00.000Z",
    },
    {
      id: CARD_2_ID,
      board_id: SEED_BOARD_ID,
      column_id: COL_DONE_ID,
      title: "Polyglot Contract Lock (Zod + Pydantic v2 + OpenAPI 3.1)",
      description:
        "Establish shared schema definitions across Next.js, Fastify, and FastAPI AI Engine with strict UUID and ISO timestamp validation.",
      position: "a1",
      priority: "MEDIUM",
      story_points: 3,
      tags: ["contracts", "architecture"],
      subtasks: [
        {
          id: "55555555-5555-4555-8555-555555555504",
          title: "Author shared Zod schemas in packages/contracts/index.ts",
          is_completed: true,
          position: "a0",
        },
        {
          id: "55555555-5555-4555-8555-555555555505",
          title: "Sync Pydantic v2 models in packages/contracts/schemas.py",
          is_completed: true,
          position: "a1",
        },
      ],
      blocked_by_card_ids: [],
      due_date: "2026-11-09T00:00:00.000Z",
      updated_at: "2026-11-08T09:20:00.000Z",
    },
    {
      id: CARD_3_ID,
      board_id: SEED_BOARD_ID,
      column_id: COL_IN_PROGRESS_ID,
      title: "Real-Time WebSocket Broadcast & Redis Pub/Sub Bridge",
      description:
        "Synchronize `CARD_MOVED`, `CARD_UPDATED`, and `CARD_CREATED` events across active board peers in <25ms using Fastify WebSocket rooms.",
      position: "a0",
      priority: "URGENT",
      story_points: 8,
      tags: ["realtime", "websocket", "redis"],
      subtasks: [
        {
          id: "55555555-5555-4555-8555-555555555506",
          title: "Subscribe client to /ws/boards/:boardId with auto-reconnect",
          is_completed: true,
          position: "a0",
        },
        {
          id: "55555555-5555-4555-8555-555555555507",
          title: "Deduplicate optimistic local mutations by actor_id",
          is_completed: true,
          position: "a1",
        },
        {
          id: "55555555-5555-4555-8555-555555555508",
          title: "Handle multi-tab state convergence under bursty moves",
          is_completed: false,
          position: "a2",
        },
      ],
      blocked_by_card_ids: [],
      due_date: "2026-11-12T00:00:00.000Z",
      updated_at: "2026-11-08T09:45:00.000Z",
    },
    {
      id: CARD_4_ID,
      board_id: SEED_BOARD_ID,
      column_id: COL_IN_PROGRESS_ID,
      title: "AI Task Decomposer Service & Subtask Synthesis",
      description:
        "Connect `POST /api/v1/cards/:cardId/ai-decompose` to the internal FastAPI AI Engine (`:8001`) to generate structured subtasks, story points, and risk radar.",
      position: "a1",
      priority: "HIGH",
      story_points: 5,
      tags: ["ai-engine", "llm", "ux"],
      subtasks: [
        {
          id: "55555555-5555-4555-8555-555555555509",
          title: "Build shimmer loading indicator in Card Detail Drawer",
          is_completed: true,
          position: "a0",
        },
        {
          id: "55555555-5555-4555-8555-555555555510",
          title: "Merge AI-suggested subtasks with existing checklist items",
          is_completed: false,
          position: "a1",
        },
      ],
      blocked_by_card_ids: [],
      due_date: "2026-11-14T00:00:00.000Z",
      updated_at: "2026-11-08T10:00:00.000Z",
    },
    {
      id: CARD_5_ID,
      board_id: SEED_BOARD_ID,
      column_id: COL_REVIEW_ID,
      title: "Implement OAuth2 PKCE & Session Rotation Flow",
      description:
        "Support GitHub and Google OAuth2 providers with short-lived access JWTs and rotating HttpOnly refresh tokens.",
      position: "a0",
      priority: "HIGH",
      story_points: 5,
      tags: ["auth", "security"],
      subtasks: [
        {
          id: "55555555-5555-4555-8555-555555555511",
          title: "Register OAuth2 client credentials and redirect URIs",
          is_completed: true,
          position: "a0",
        },
        {
          id: "55555555-5555-4555-8555-555555555512",
          title: "Implement PKCE code_verifier & code_challenge generator",
          is_completed: true,
          position: "a1",
        },
        {
          id: "55555555-5555-4555-8555-555555555513",
          title: "Audit token revocation on suspicious IP shift",
          is_completed: false,
          position: "a2",
        },
      ],
      blocked_by_card_ids: [],
      due_date: "2026-11-15T00:00:00.000Z",
      updated_at: "2026-11-08T10:05:00.000Z",
    },
    {
      id: CARD_6_ID,
      board_id: SEED_BOARD_ID,
      column_id: COL_REVIEW_ID,
      title: "Command Palette (Cmd+K) & Keyboard-First Navigation",
      description:
        "Instant Raycast-inspired modal for creating cards, switching Kanban/Table views, filtering by priority, and toggling Light/Dark themes.",
      position: "a1",
      priority: "MEDIUM",
      story_points: 3,
      tags: ["design-system", "keyboard", "a11y"],
      subtasks: [
        {
          id: "55555555-5555-4555-8555-555555555514",
          title: "Bind global Cmd+K / Ctrl+K shortcut listener",
          is_completed: true,
          position: "a0",
        },
        {
          id: "55555555-5555-4555-8555-555555555515",
          title: "Add fuzzy search across commands and board cards",
          is_completed: true,
          position: "a1",
        },
      ],
      blocked_by_card_ids: [],
      due_date: "2026-11-13T00:00:00.000Z",
      updated_at: "2026-11-08T10:12:00.000Z",
    },
    {
      id: CARD_7_ID,
      board_id: SEED_BOARD_ID,
      column_id: COL_BACKLOG_ID,
      title: "Multi-Region Read Replicas & Edge Caching Layer",
      description:
        "Route read-heavy `GET /api/v1/boards/:boardId` queries to regional PostgreSQL replicas with Redis invalidation hooks.",
      position: "a0",
      priority: "URGENT",
      story_points: 8,
      tags: ["infra", "postgres", "scale"],
      subtasks: [
        {
          id: "55555555-5555-4555-8555-555555555516",
          title: "Provision read replica pool in Drizzle connection manager",
          is_completed: false,
          position: "a0",
        },
      ],
      blocked_by_card_ids: [CARD_3_ID],
      due_date: "2026-11-18T00:00:00.000Z",
      updated_at: "2026-11-08T10:15:00.000Z",
    },
    {
      id: CARD_8_ID,
      board_id: SEED_BOARD_ID,
      column_id: COL_BACKLOG_ID,
      title: "Automated Dependency Blocker Radar & Critical Path Graph",
      description:
        "Highlight cards blocked by upstream unresolved issues (`blocked_by_card_ids`) and alert teams when sprint velocity is at risk.",
      position: "a1",
      priority: "HIGH",
      story_points: 5,
      tags: ["analytics", "blocker-radar"],
      subtasks: [],
      blocked_by_card_ids: [CARD_3_ID, CARD_5_ID],
      due_date: "2026-11-20T00:00:00.000Z",
      updated_at: "2026-11-08T10:20:00.000Z",
    },
    {
      id: CARD_9_ID,
      board_id: SEED_BOARD_ID,
      column_id: COL_BACKLOG_ID,
      title: "Export Sprint Telemetry to CSV & Linear Webhook Sync",
      description:
        "Allow workspace admins to export cycle lead times, WIP breaches, and story point burn-up metrics.",
      position: "a2",
      priority: "LOW",
      story_points: 2,
      tags: ["export", "integrations"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-25T00:00:00.000Z",
      updated_at: "2026-11-08T10:25:00.000Z",
    },
  ],
};

const STORAGE_KEY = "kinetix_mock_board_v1";

function sortBoardEntities(board: Board): Board {
  return {
    ...board,
    columns: [...board.columns].sort((a, b) =>
      comparePositions(a.position, b.position)
    ),
    cards: [...board.cards]
      .map((card) => ({
        ...card,
        subtasks: [...card.subtasks].sort((a, b) =>
          comparePositions(a.position, b.position)
        ),
      }))
      .sort((a, b) => comparePositions(a.position, b.position)),
  };
}

/**
 * Contextual AI subtask synthesizer for Mock Mode so "✨ AI Decompose Task"
 * generates realistic, domain-tailored subtasks, story points, and priorities.
 */
function synthesizeAISubtasks(card: Card): {
  subtasks: Subtask[];
  story_points: number;
  priority: Priority;
} {
  const text = `${card.title} ${card.description}`.toLowerCase();

  let titles: string[] = [];
  let points = card.story_points ?? 5;
  let priority: Priority = card.priority;

  if (text.includes("oauth") || text.includes("auth") || text.includes("pkce")) {
    titles = [
      "Register OAuth2 client credentials and callback redirect URIs",
      "Implement cryptographic PKCE code_verifier & S256 code_challenge",
      "Build token exchange endpoint with refresh token rotation",
      "Add integration tests for expired/revoked session recovery",
    ];
    points = 5;
    priority = "HIGH";
  } else if (
    text.includes("replica") ||
    text.includes("postgres") ||
    text.includes("cache") ||
    text.includes("redis")
  ) {
    titles = [
      "Configure Drizzle read/write connection pool routing",
      "Implement Redis Pub/Sub cache invalidation on card mutations",
      "Add replica lag health probe and automatic primary failover",
      "Benchmark p99 board load latency under 500 concurrent connections",
    ];
    points = 8;
    priority = "URGENT";
  } else if (
    text.includes("blocker") ||
    text.includes("dependency") ||
    text.includes("radar")
  ) {
    titles = [
      "Build cycle-detection graph validator for blocked_by_card_ids",
      "Render red Blocker Radar badge on Kanban cards and Table rows",
      "Add one-click dependency linker inside Card Detail Drawer",
      "Emit warning notification when a blocking card misses due date",
    ];
    points = 5;
    priority = "HIGH";
  } else if (text.includes("export") || text.includes("csv") || text.includes("telemetry")) {
    titles = [
      "Define CSV column serializer for cards, story points, and cycle timestamps",
      "Stream downloadable export blob directly in browser without memory spikes",
      "Add HMAC-SHA256 signature verification for outbound webhook payloads",
    ];
    points = 3;
  } else {
    titles = [
      `Define technical specification and acceptance criteria for "${card.title.slice(0, 42)}"`,
      "Implement core domain logic with strict @kinetix/contracts validation",
      "Wire optimistic UI mutation and real-time WebSocket event broadcast",
      "Verify edge cases, keyboard accessibility, and automated build gate",
    ];
    points = card.story_points ?? 5;
  }

  // Merge without duplicating existing subtask titles
  const existingTitles = new Set(
    card.subtasks.map((s) => s.title.toLowerCase().trim())
  );
  const currentSubtasks = [...card.subtasks].sort((a, b) =>
    comparePositions(a.position, b.position)
  );
  let lastPos =
    currentSubtasks.length > 0
      ? currentSubtasks[currentSubtasks.length - 1].position
      : undefined;

  const newSubtasks: Subtask[] = [...currentSubtasks];
  for (const title of titles) {
    if (!existingTitles.has(title.toLowerCase().trim())) {
      const nextPos = generatePositionBetween(lastPos, undefined);
      lastPos = nextPos;
      newSubtasks.push({
        id: createDeterministicUuid(),
        title,
        is_completed: false,
        position: nextPos,
      });
    }
  }

  return {
    subtasks: newSubtasks,
    story_points: points,
    priority,
  };
}

export class MockApiService {
  private board: Board;

  constructor() {
    this.board = sortBoardEntities(BoardSchema.parse(INITIAL_SEED_BOARD));
  }

  private loadState(): Board {
    if (typeof window === "undefined") {
      return this.board;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = BoardSchema.safeParse(JSON.parse(raw));
        if (parsed.success) {
          this.board = sortBoardEntities(parsed.data);
          return this.board;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return this.board;
  }

  private saveState(next: Board): Board {
    const validated = sortBoardEntities(BoardSchema.parse(next));
    this.board = validated;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
      } catch {
        // Ignore quota errors
      }
    }
    return validated;
  }

  resetToSeed(): Board {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    this.board = sortBoardEntities(BoardSchema.parse(INITIAL_SEED_BOARD));
    return this.saveState(this.board);
  }

  async listBoards(): Promise<Board[]> {
    const board = this.loadState();
    return [board];
  }

  async getBoard(boardId: string): Promise<Board> {
    const board = this.loadState();
    if (boardId && boardId !== board.id) {
      return board;
    }
    return board;
  }

  async createBoard(payload: CreateBoardRequest): Promise<Board> {
    const boardId = createDeterministicUuid();
    const nextBoard: Board = {
      id: boardId,
      workspace_id: payload.workspace_id ?? SEED_WORKSPACE_ID,
      title: payload.title,
      created_at: new Date().toISOString(),
      columns: [
        {
          id: createDeterministicUuid(),
          board_id: boardId,
          title: "Backlog",
          position: "a0",
          wip_limit: null,
        },
        {
          id: createDeterministicUuid(),
          board_id: boardId,
          title: "In Progress",
          position: "a1",
          wip_limit: 5,
        },
        {
          id: createDeterministicUuid(),
          board_id: boardId,
          title: "Review",
          position: "a2",
          wip_limit: null,
        },
        {
          id: createDeterministicUuid(),
          board_id: boardId,
          title: "Done",
          position: "a3",
          wip_limit: null,
        },
      ],
      cards: [],
    };
    return this.saveState(nextBoard);
  }

  async createColumn(
    boardId: string,
    payload: CreateColumnRequest
  ): Promise<Column> {
    const board = this.loadState();
    const newCol: Column = ColumnSchema.parse({
      id: createDeterministicUuid(),
      board_id: board.id,
      title: payload.title,
      position: payload.position,
      wip_limit: payload.wip_limit ?? null,
    });
    this.saveState({
      ...board,
      columns: [...board.columns, newCol],
    });
    return newCol;
  }

  async createCard(boardId: string, payload: CreateCardRequest): Promise<Card> {
    const board = this.loadState();
    const newCard: Card = CardSchema.parse({
      id: createDeterministicUuid(),
      board_id: board.id,
      column_id: payload.column_id,
      title: payload.title,
      description: payload.description ?? "",
      position: payload.position,
      priority: payload.priority ?? "MEDIUM",
      story_points: payload.story_points ?? null,
      tags: payload.tags ?? [],
      subtasks: payload.subtasks ?? [],
      blocked_by_card_ids: payload.blocked_by_card_ids ?? [],
      due_date: payload.due_date ?? null,
      updated_at: new Date().toISOString(),
    });
    this.saveState({
      ...board,
      cards: [...board.cards, newCard],
    });
    return newCard;
  }

  async updateCard(cardId: string, payload: UpdateCardRequest): Promise<Card> {
    const board = this.loadState();
    const existing = board.cards.find((c) => c.id === cardId);
    if (!existing) {
      throw new Error(`Card ${cardId} not found`);
    }
    const updated: Card = CardSchema.parse({
      ...existing,
      ...payload,
      updated_at: new Date().toISOString(),
    });
    this.saveState({
      ...board,
      cards: board.cards.map((c) => (c.id === cardId ? updated : c)),
    });
    return updated;
  }

  async moveCard(cardId: string, payload: MoveCardRequest): Promise<Card> {
    const board = this.loadState();
    const existing = board.cards.find((c) => c.id === cardId);
    if (!existing) {
      throw new Error(`Card ${cardId} not found`);
    }
    const updated: Card = CardSchema.parse({
      ...existing,
      column_id: payload.target_column_id,
      position: payload.new_position,
      updated_at: new Date().toISOString(),
    });
    this.saveState({
      ...board,
      cards: board.cards.map((c) => (c.id === cardId ? updated : c)),
    });
    return updated;
  }

  async aiDecomposeCard(cardId: string): Promise<Card> {
    // Simulate realistic AI thinking latency (650ms) for shimmer UX
    await new Promise((resolve) => setTimeout(resolve, 650));
    const board = this.loadState();
    const existing = board.cards.find((c) => c.id === cardId);
    if (!existing) {
      throw new Error(`Card ${cardId} not found`);
    }

    const aiResult = synthesizeAISubtasks(existing);
    const updated: Card = CardSchema.parse({
      ...existing,
      subtasks: aiResult.subtasks,
      story_points: aiResult.story_points,
      priority: aiResult.priority,
      tags: Array.from(new Set([...existing.tags, "ai-decomposed"])),
      updated_at: new Date().toISOString(),
    });
    this.saveState({
      ...board,
      cards: board.cards.map((c) => (c.id === cardId ? updated : c)),
    });
    return updated;
  }
}

export const mockApi = new MockApiService();
