import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { asc, eq } from "drizzle-orm";
import {
  DEFAULT_BOARD_COLUMNS,
  DEFAULT_BOARD_LABELS,
  DEFAULT_BOARD_MEMBERS,
  DEFAULT_BOARD_TEMPLATES,
  DEFAULT_WORKSPACE,
  type Activity,
  type ActivityActionType,
  type Attachment,
  type AutomationRule,
  type Board,
  type BoardBackground,
  type BoardTemplate,
  type Card,
  type CardCover,
  type Checklist,
  type ChecklistItem,
  type Column,
  type Comment,
  type CopyCardRequest,
  type CopyColumnRequest,
  type CopyColumnResponse,
  type CreateAutomationRuleRequest,
  type CreateBoardRequest,
  type CreateCardRequest,
  type CreateColumnRequest,
  type CreateCommentRequest,
  type CreateWorkspaceRequest,
  type Label,
  type Member,
  type MoveCardRequest,
  type MoveColumnRequest,
  type Subtask,
  type UpdateAutomationRuleRequest,
  type UpdateBoardRequest,
  type UpdateCardRequest,
  type UpdateColumnRequest,
  type Workspace,
  type WorkspaceWithBoards,
} from "@kinetix/contracts";
import * as schema from "./schema.js";
import { AppError } from "../errors.js";

const { Pool } = pg;

export const DEFAULT_WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
export const SEED_BOARD_ID = "11111111-1111-4111-8111-111111111111";

export const DEFAULT_BOARD_BACKGROUND: BoardBackground = {
  type: "gradient",
  value: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
};

export const DEFAULT_CARD_COVER: CardCover = {
  type: "none",
  value: null,
  size: "normal",
};

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

function sortChecklistItems(items: ChecklistItem[]): ChecklistItem[] {
  return [...items]
    .map((item) => ({
      ...item,
      due_date: normalizeNullableIsoTimestamp(item.due_date),
      assignee_id: item.assignee_id ?? null,
    }))
    .sort((a, b) => compareFractionalIndex(a.position, b.position));
}

function sortChecklists(checklists: Checklist[]): Checklist[] {
  return [...checklists]
    .map((cl) => ({
      ...cl,
      title: cl.title || "Checklist",
      items: sortChecklistItems(cl.items ?? []),
    }))
    .sort((a, b) => compareFractionalIndex(a.position, b.position));
}

/**
 * Bidirectional sync between Phase 2 `checklists` and Phase 1 `subtasks`
 * (keeping `subtasks` synced with the first checklist for backward compatibility).
 */
export function syncChecklistsAndSubtasks(params: {
  inputChecklists?: Checklist[];
  inputSubtasks?: Subtask[];
  existingChecklists?: Checklist[];
  existingSubtasks?: Subtask[];
}): { checklists: Checklist[]; subtasks: Subtask[] } {
  const {
    inputChecklists,
    inputSubtasks,
    existingChecklists = [],
    existingSubtasks = [],
  } = params;

  // Case 1: Caller explicitly provided checklists
  if (inputChecklists !== undefined) {
    const sortedChecklists = sortChecklists(inputChecklists);
    if (
      inputSubtasks !== undefined &&
      inputSubtasks.length > 0 &&
      sortedChecklists.length === 0
    ) {
      // Caller passed non-empty subtasks alongside empty default checklists
      const sortedSt = sortSubtasks(inputSubtasks);
      const derivedChecklist: Checklist = {
        id: randomUUID(),
        title: "Checklist",
        position: "a0",
        items: sortedSt.map((st) => ({
          id: st.id,
          title: st.title,
          is_completed: st.is_completed,
          position: st.position,
          due_date: null,
          assignee_id: null,
        })),
      };
      return {
        checklists: [derivedChecklist],
        subtasks: sortedSt,
      };
    }

    const firstChecklist = sortedChecklists[0];
    const derivedSubtasks: Subtask[] = firstChecklist
      ? firstChecklist.items.map((item) => ({
          id: item.id,
          title: item.title,
          is_completed: item.is_completed,
          position: item.position,
        }))
      : inputSubtasks !== undefined
      ? sortSubtasks(inputSubtasks)
      : [];

    return {
      checklists: sortedChecklists,
      subtasks: sortSubtasks(derivedSubtasks),
    };
  }

  // Case 2: Caller only provided subtasks
  if (inputSubtasks !== undefined) {
    const sortedSt = sortSubtasks(inputSubtasks);
    const currentChecklists = sortChecklists(existingChecklists);

    if (sortedSt.length === 0) {
      if (currentChecklists.length <= 1) {
        return { checklists: [], subtasks: [] };
      }
      const [first, ...rest] = currentChecklists;
      return {
        checklists: [{ ...first!, items: [] }, ...rest],
        subtasks: [],
      };
    }

    const existingFirst = currentChecklists[0];
    const existingItemMap = new Map<string, ChecklistItem>(
      (existingFirst?.items ?? []).map((it) => [it.id, it])
    );

    const syncedItems: ChecklistItem[] = sortedSt.map((st) => {
      const prev = existingItemMap.get(st.id);
      return {
        id: st.id,
        title: st.title,
        is_completed: st.is_completed,
        position: st.position,
        due_date: prev?.due_date ?? null,
        assignee_id: prev?.assignee_id ?? null,
      };
    });

    const updatedFirst: Checklist = existingFirst
      ? { ...existingFirst, items: syncedItems }
      : {
          id: randomUUID(),
          title: "Checklist",
          position: "a0",
          items: syncedItems,
        };

    return {
      checklists: [updatedFirst, ...currentChecklists.slice(1)],
      subtasks: sortedSt,
    };
  }

  // Case 3: Neither updated; ensure existing values are consistent
  const sortedExistingCl = sortChecklists(existingChecklists);
  const sortedExistingSt = sortSubtasks(existingSubtasks);
  if (sortedExistingCl.length === 0 && sortedExistingSt.length > 0) {
    return {
      checklists: [
        {
          id: randomUUID(),
          title: "Checklist",
          position: "a0",
          items: sortedExistingSt.map((st) => ({
            id: st.id,
            title: st.title,
            is_completed: st.is_completed,
            position: st.position,
            due_date: null,
            assignee_id: null,
          })),
        },
      ],
      subtasks: sortedExistingSt,
    };
  }
  if (sortedExistingCl.length > 0 && sortedExistingSt.length === 0) {
    const first = sortedExistingCl[0]!;
    return {
      checklists: sortedExistingCl,
      subtasks: first.items.map((it) => ({
        id: it.id,
        title: it.title,
        is_completed: it.is_completed,
        position: it.position,
      })),
    };
  }

  return {
    checklists: sortedExistingCl,
    subtasks: sortedExistingSt,
  };
}

export function buildDefaultBoardLabels(boardId: string): Label[] {
  return DEFAULT_BOARD_LABELS.map((lbl) => ({
    id: lbl.id,
    board_id: boardId,
    name: lbl.name,
    color: lbl.color,
  }));
}

export function buildDefaultBoardMembers(): Member[] {
  return DEFAULT_BOARD_MEMBERS.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    avatar_url: m.avatar_url,
    initials: m.initials,
    color: m.color,
  }));
}

interface InMemoryStore {
  workspaces: Map<string, Workspace>;
  boards: Map<string, Omit<Board, "columns" | "cards">>;
  columns: Map<string, Column>;
  cards: Map<string, Card>;
}

function createPreseededMemoryStore(): InMemoryStore {
  const workspaces = new Map<string, Workspace>();
  const boards = new Map<string, Omit<Board, "columns" | "cards">>();
  const columns = new Map<string, Column>();
  const cards = new Map<string, Card>();

  const createdAt = "2026-11-08T10:00:00.000Z";

  workspaces.set(DEFAULT_WORKSPACE.id, {
    id: DEFAULT_WORKSPACE.id,
    name: DEFAULT_WORKSPACE.name,
    slug: DEFAULT_WORKSPACE.slug,
    description: DEFAULT_WORKSPACE.description,
    logo_color: DEFAULT_WORKSPACE.logo_color,
    created_at: DEFAULT_WORKSPACE.created_at,
  });

  const seedActivities: Activity[] = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      board_id: SEED_BOARD_ID,
      card_id: "44444444-4444-4444-8444-444444444444",
      actor_name: "Alex Rivera",
      action_type: "CARD_CREATED",
      description: "added Implement OAuth2 PKCE flow to Backlog",
      created_at: "2026-11-08T10:05:00.000Z",
      is_automated: false,
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      board_id: SEED_BOARD_ID,
      card_id: "44444444-4444-4444-8444-444444444403",
      actor_name: "Maya Lin",
      action_type: "CARD_MOVED",
      description:
        "moved Real-Time WebSocket Broadcast & Redis Pub/Sub Bridge to In Progress",
      created_at: "2026-11-08T10:10:00.000Z",
      is_automated: false,
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
      board_id: SEED_BOARD_ID,
      card_id: "44444444-4444-4444-8444-444444444403",
      actor_name: "Elena Rostova",
      action_type: "COMMENT_ADDED",
      description:
        'commented on Real-Time WebSocket Broadcast & Redis Pub/Sub Bridge: "WebSocket heartbeat ping/pong interval is tuned to 15s."',
      created_at: "2026-11-08T10:12:00.000Z",
      is_automated: false,
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
      board_id: SEED_BOARD_ID,
      card_id: "44444444-4444-4444-8444-444444444401",
      actor_name: "Alex Rivera",
      action_type: "CHECKLIST_COMPLETED",
      description:
        "completed Algorithm Verification on Lexicographical O(1) Fractional Indexing Engine",
      created_at: "2026-11-08T10:15:00.000Z",
      is_automated: false,
    },
  ];

  const primaryButlerRules: AutomationRule[] = [
    {
      id: "66666666-6666-4666-8666-666666666661",
      board_id: SEED_BOARD_ID,
      name: "Auto-Complete on Done",
      description:
        "When card is moved to Done, mark due date as complete, add Ship Ready label, and assign Alex Rivera",
      is_enabled: true,
      trigger: {
        type: "WHEN_CARD_MOVED_TO_COLUMN",
        column_id: null,
        column_title_match: "Done",
        priority: null,
        label_id: null,
      },
      actions: [
        {
          type: "MARK_DUE_DATE_COMPLETE",
          due_complete_value: true,
          member_id: null,
          label_id: null,
          priority: null,
          target_column_id: null,
          checklist_title: null,
          checklist_items: null,
          comment_text: null,
        },
        {
          type: "ADD_LABEL",
          label_id: "77777777-7777-4777-8777-777777777771", // Ship Ready (green)
          member_id: null,
          priority: null,
          target_column_id: null,
          checklist_title: null,
          checklist_items: null,
          comment_text: null,
          due_complete_value: null,
        },
        {
          type: "ASSIGN_MEMBER",
          member_id: "88888888-8888-4888-8888-888888888881", // Alex Rivera
          label_id: null,
          priority: null,
          target_column_id: null,
          checklist_title: null,
          checklist_items: null,
          comment_text: null,
          due_complete_value: null,
        },
      ],
      execution_count: 0,
      last_triggered_at: null,
      created_at: "2026-11-08T00:00:00.000Z",
    },
    {
      id: "66666666-6666-4666-8666-666666666662",
      board_id: SEED_BOARD_ID,
      name: "Checklist 100% Auto-Review",
      description:
        "When all checklist items are completed, automatically move card to Review column",
      is_enabled: true,
      trigger: {
        type: "WHEN_CHECKLIST_COMPLETED",
        column_id: null,
        column_title_match: null,
        priority: null,
        label_id: null,
      },
      actions: [
        {
          type: "MOVE_CARD_TO_COLUMN",
          target_column_id: "33333333-3333-4333-8333-333333333333", // Review column
          member_id: null,
          label_id: null,
          priority: null,
          checklist_title: null,
          checklist_items: null,
          comment_text: null,
          due_complete_value: null,
        },
      ],
      execution_count: 0,
      last_triggered_at: null,
      created_at: "2026-11-08T00:00:00.000Z",
    },
  ];

  // Board 1: Primary Platform Launch Board
  boards.set(SEED_BOARD_ID, {
    id: SEED_BOARD_ID,
    workspace_id: DEFAULT_WORKSPACE_ID,
    title: "Kinetix Platform Launch",
    description:
      "High-craftsmanship real-time workspace uniting Trello visual fluidity with Linear engineering precision.",
    is_starred: true,
    background: { ...DEFAULT_BOARD_BACKGROUND },
    labels: buildDefaultBoardLabels(SEED_BOARD_ID),
    members: buildDefaultBoardMembers(),
    activities: seedActivities,
    automation_rules: primaryButlerRules,
    created_at: createdAt,
  });

  const seedCols: Column[] = [
    {
      id: "33333333-3333-4333-8333-333333333331",
      board_id: SEED_BOARD_ID,
      title: "Backlog",
      position: "a0",
      wip_limit: null,
      color: "#64748b",
      is_archived: false,
    },
    {
      id: "33333333-3333-4333-8333-333333333332",
      board_id: SEED_BOARD_ID,
      title: "In Progress",
      position: "a1",
      wip_limit: 5,
      color: "#3b82f6",
      is_archived: false,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      board_id: SEED_BOARD_ID,
      title: "Review",
      position: "a2",
      wip_limit: 3,
      color: "#8b5cf6",
      is_archived: false,
    },
    {
      id: "33333333-3333-4333-8333-333333333334",
      board_id: SEED_BOARD_ID,
      title: "Done",
      position: "a3",
      wip_limit: null,
      color: "#10b981",
      is_archived: false,
    },
  ];
  for (const col of seedCols) {
    columns.set(col.id, col);
  }

  const seedCards: Card[] = [
    {
      id: "44444444-4444-4444-8444-444444444444",
      board_id: SEED_BOARD_ID,
      column_id: "33333333-3333-4333-8333-333333333331",
      title: "Implement OAuth2 PKCE & Session Rotation Flow",
      description:
        "## Objective\nSupport GitHub and Google OAuth2 providers with short-lived access JWTs and rotating HttpOnly refresh tokens.\n\n## Acceptance Criteria\n- Verify S256 PKCE code challenge\n- Enforce constant-time token comparison",
      position: "a0",
      priority: "HIGH",
      story_points: 5,
      tags: ["auth", "security"],
      subtasks: [
        {
          id: "55555555-5555-4555-8555-555555555551",
          title: "Register OAuth2 client credentials and redirect URIs",
          is_completed: true,
          position: "a0",
        },
        {
          id: "55555555-5555-4555-8555-555555555552",
          title: "Implement PKCE code_verifier & S256 code_challenge",
          is_completed: true,
          position: "a1",
        },
        {
          id: "55555555-5555-4555-8555-555555555555",
          title: "Configure callback routes & token rotation",
          is_completed: false,
          position: "a2",
        },
        {
          id: "55555555-5555-4555-8555-555555555556",
          title: "Audit token revocation on suspicious IP shift",
          is_completed: false,
          position: "a3",
        },
      ],
      blocked_by_card_ids: [],
      due_date: "2026-11-15T00:00:00.000Z",
      updated_at: "2026-11-08T10:05:00.000Z",
      cover: {
        type: "color",
        value: "#0ea5e9",
        size: "normal",
      },
      label_ids: [
        "77777777-7777-4777-8777-777777777771",
        "77777777-7777-4777-8777-777777777772",
      ],
      member_ids: [
        "88888888-8888-4888-8888-888888888881",
        "88888888-8888-4888-8888-888888888883",
      ],
      checklists: [
        {
          id: "99999999-9999-4999-8999-999999999991",
          title: "Security Implementation Steps",
          position: "a0",
          items: [
            {
              id: "55555555-5555-4555-8555-555555555551",
              title: "Register OAuth2 client credentials and redirect URIs",
              is_completed: true,
              position: "a0",
              due_date: null,
              assignee_id: "88888888-8888-4888-8888-888888888883",
            },
            {
              id: "55555555-5555-4555-8555-555555555552",
              title: "Implement PKCE code_verifier & S256 code_challenge",
              is_completed: true,
              position: "a1",
              due_date: null,
              assignee_id: "88888888-8888-4888-8888-888888888881",
            },
            {
              id: "55555555-5555-4555-8555-555555555555",
              title: "Configure callback routes & token rotation",
              is_completed: false,
              position: "a2",
              due_date: null,
              assignee_id: "88888888-8888-4888-8888-888888888881",
            },
            {
              id: "55555555-5555-4555-8555-555555555556",
              title: "Audit token revocation on suspicious IP shift",
              is_completed: false,
              position: "a3",
              due_date: null,
              assignee_id: "88888888-8888-4888-8888-888888888883",
            },
          ],
        },
      ],
      comments: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccc0010",
          card_id: "44444444-4444-4444-8444-444444444444",
          author_id: "88888888-8888-4888-8888-888888888883",
          author_name: "Samir Patel",
          author_initials: "SP",
          content:
            "PKCE S256 challenge generator is verified against RFC 7636 test vectors (2/4 steps complete).",
          created_at: "2026-11-08T10:06:00.000Z",
          updated_at: "2026-11-08T10:06:00.000Z",
        },
      ],
      attachments: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddd0003",
          name: "RFC 7636 — OAuth PKCE Spec",
          url: "https://datatracker.ietf.org/doc/html/rfc7636",
          type: "link",
          created_at: "2026-11-06T12:00:00.000Z",
        },
      ],
      start_date: "2026-11-08T00:00:00.000Z",
      is_due_complete: false,
      is_archived: false,
      is_watching: true,
    },
    {
      id: "44444444-4444-4444-8444-444444444403",
      board_id: SEED_BOARD_ID,
      column_id: "33333333-3333-4333-8333-333333333332",
      title: "Real-Time WebSocket Broadcast & Redis Pub/Sub Bridge",
      description:
        "## Objective\nSynchronize `CARD_MOVED`, `CARD_UPDATED`, `COLUMN_MOVED`, and `COMMENT_ADDED` events across active board peers in <25ms.\n\n## Architecture Notes\n- Deduplicate optimistic local mutations by `actor_id`\n- Automatic exponential backoff reconnect",
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
        {
          id: "55555555-5555-4555-8555-555555555509",
          title: "Verify zero dropped frames during Redis failover",
          is_completed: false,
          position: "a3",
        },
      ],
      blocked_by_card_ids: [],
      due_date: "2026-11-12T00:00:00.000Z",
      updated_at: "2026-11-08T10:10:00.000Z",
      cover: {
        type: "color",
        value: "#3b82f6",
        size: "normal",
      },
      label_ids: [
        "77777777-7777-4777-8777-777777777776",
        "77777777-7777-4777-8777-777777777773",
      ],
      member_ids: [
        "88888888-8888-4888-8888-888888888881",
        "88888888-8888-4888-8888-888888888884",
      ],
      checklists: [
        {
          id: "99999999-9999-4999-8999-999999999992",
          title: "Realtime Protocol Checklist",
          position: "a0",
          items: [
            {
              id: "55555555-5555-4555-8555-555555555506",
              title:
                "Subscribe client to /ws/boards/:boardId with auto-reconnect",
              is_completed: true,
              position: "a0",
              due_date: null,
              assignee_id: "88888888-8888-4888-8888-888888888881",
            },
            {
              id: "55555555-5555-4555-8555-555555555507",
              title: "Deduplicate optimistic local mutations by actor_id",
              is_completed: true,
              position: "a1",
              due_date: null,
              assignee_id: "88888888-8888-4888-8888-888888888884",
            },
            {
              id: "55555555-5555-4555-8555-555555555508",
              title: "Handle multi-tab state convergence under bursty moves",
              is_completed: false,
              position: "a2",
              due_date: null,
              assignee_id: "88888888-8888-4888-8888-888888888881",
            },
            {
              id: "55555555-5555-4555-8555-555555555509",
              title: "Verify zero dropped frames during Redis failover",
              is_completed: false,
              position: "a3",
              due_date: null,
              assignee_id: "88888888-8888-4888-8888-888888888884",
            },
          ],
        },
      ],
      comments: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccc0002",
          card_id: "44444444-4444-4444-8444-444444444403",
          author_id: "88888888-8888-4888-8888-888888888884",
          author_name: "Elena Rostova",
          author_initials: "ER",
          content:
            "WebSocket heartbeat ping/pong interval is tuned to 15s. Ready for multi-tab testing.",
          created_at: "2026-11-08T09:30:00.000Z",
          updated_at: "2026-11-08T09:30:00.000Z",
        },
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccc0003",
          card_id: "44444444-4444-4444-8444-444444444403",
          author_id: "88888888-8888-4888-8888-888888888881",
          author_name: "Alex Rivera",
          author_initials: "AR",
          content:
            "Added `COLUMN_MOVED` and `BOARD_UPDATED` handlers to the client listener.",
          created_at: "2026-11-08T09:42:00.000Z",
          updated_at: "2026-11-08T09:42:00.000Z",
        },
      ],
      attachments: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddd0002",
          name: "Redis PubSub Sequence Diagram",
          url: "https://architecture.kinetix.dev/redis-pubsub",
          type: "link",
          created_at: "2026-11-08T08:30:00.000Z",
        },
      ],
      start_date: "2026-11-06T00:00:00.000Z",
      is_due_complete: false,
      is_archived: false,
      is_watching: true,
    },
    {
      id: "44444444-4444-4444-8444-444444444404",
      board_id: SEED_BOARD_ID,
      column_id: "33333333-3333-4333-8333-333333333332",
      title: "AI Smart Card Enrichment & Multi-Checklist Synthesis",
      description:
        "Connect `POST /api/v1/cards/:cardId/ai-decompose` to the internal FastAPI AI Engine (`:8001`) to generate structured Markdown descriptions, suggested Trello color labels, and multiple checklists.",
      position: "a1",
      priority: "HIGH",
      story_points: 5,
      tags: ["ai-engine", "llm", "ux", "ai-decomposed"],
      subtasks: [
        {
          id: "55555555-5555-4555-8555-555555555510",
          title: "Build shimmer loading state in 2-Column Trello Card Modal",
          is_completed: true,
          position: "a0",
        },
        {
          id: "55555555-5555-4555-8555-555555555511",
          title: "Merge AI-suggested checklists & labels with card state",
          is_completed: false,
          position: "a1",
        },
      ],
      blocked_by_card_ids: [],
      due_date: "2026-11-14T00:00:00.000Z",
      updated_at: "2026-11-08T10:15:00.000Z",
      cover: {
        type: "color",
        value: "#8b5cf6",
        size: "normal",
      },
      label_ids: [
        "77777777-7777-4777-8777-777777777775",
        "77777777-7777-4777-8777-777777777771",
      ],
      member_ids: [
        "88888888-8888-4888-8888-888888888882",
        "88888888-8888-4888-8888-888888888883",
      ],
      checklists: [
        {
          id: "99999999-9999-4999-8999-999999999904",
          title: "AI Enrichment Pipeline",
          position: "a0",
          items: [
            {
              id: "55555555-5555-4555-8555-555555555510",
              title: "Build shimmer loading state in 2-Column Trello Card Modal",
              is_completed: true,
              position: "a0",
              due_date: null,
              assignee_id: "88888888-8888-4888-8888-888888888882",
            },
            {
              id: "55555555-5555-4555-8555-555555555511",
              title: "Merge AI-suggested checklists & labels with card state",
              is_completed: false,
              position: "a1",
              due_date: null,
              assignee_id: "88888888-8888-4888-8888-888888888883",
            },
          ],
        },
      ],
      comments: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccc0004",
          card_id: "44444444-4444-4444-8444-444444444404",
          author_id: "88888888-8888-4888-8888-888888888882",
          author_name: "Maya Lin",
          author_initials: "ML",
          content:
            "AI Smart Enrich now auto-populates structured Markdown acceptance criteria and two categorized checklists!",
          created_at: "2026-11-08T10:02:00.000Z",
          updated_at: "2026-11-08T10:02:00.000Z",
        },
      ],
      attachments: [],
      start_date: "2026-11-07T00:00:00.000Z",
      is_due_complete: false,
      is_archived: false,
      is_watching: true,
    },
    {
      id: "44444444-4444-4444-8444-444444444406",
      board_id: SEED_BOARD_ID,
      column_id: "33333333-3333-4333-8333-333333333333",
      title: "Trello Card Back Modal, Cover Picker & Expandable Labels",
      description:
        "Full 2-column Trello modal with customizable card covers (normal strip vs full card tint), expandable color label pills across all cards, and inline card composer.",
      position: "a0",
      priority: "MEDIUM",
      story_points: 3,
      tags: ["design-system", "trello-ux", "keyboard"],
      subtasks: [
        {
          id: "55555555-5555-4555-8555-555555555514",
          title: "Bind global Cmd+K / Ctrl+K & single-key Trello shortcuts",
          is_completed: true,
          position: "a0",
        },
        {
          id: "55555555-5555-4555-8555-555555555515",
          title: "Build Calendar/Due Date view & Archived Items drawer",
          is_completed: true,
          position: "a1",
        },
      ],
      blocked_by_card_ids: [],
      due_date: "2026-11-13T00:00:00.000Z",
      updated_at: "2026-11-08T10:18:00.000Z",
      cover: {
        type: "color",
        value: "#ec4899",
        size: "full",
      },
      label_ids: [
        "77777777-7777-4777-8777-777777777771",
        "77777777-7777-4777-8777-777777777775",
      ],
      member_ids: [
        "88888888-8888-4888-8888-888888888882",
        "88888888-8888-4888-8888-888888888884",
      ],
      checklists: [
        {
          id: "99999999-9999-4999-8999-999999999993",
          title: "UX Checklist",
          position: "a0",
          items: [
            {
              id: "55555555-5555-4555-8555-555555555514",
              title: "Bind global Cmd+K / Ctrl+K & single-key Trello shortcuts",
              is_completed: true,
              position: "a0",
              due_date: null,
              assignee_id: "88888888-8888-4888-8888-888888888882",
            },
            {
              id: "55555555-5555-4555-8555-555555555515",
              title: "Build Calendar/Due Date view & Archived Items drawer",
              is_completed: true,
              position: "a1",
              due_date: null,
              assignee_id: "88888888-8888-4888-8888-888888888884",
            },
          ],
        },
      ],
      comments: [],
      attachments: [],
      start_date: "2026-11-06T00:00:00.000Z",
      is_due_complete: true,
      is_archived: false,
      is_watching: false,
    },
    {
      id: "44444444-4444-4444-8444-444444444408",
      board_id: SEED_BOARD_ID,
      column_id: "33333333-3333-4333-8333-333333333331",
      title: "Automated Dependency Blocker Radar & Critical Path Graph",
      description:
        "Highlight cards blocked by upstream unresolved issues (`blocked_by_card_ids`) and alert teams when sprint velocity is at risk.",
      position: "a1",
      priority: "HIGH",
      story_points: 5,
      tags: ["analytics", "blocker-radar"],
      subtasks: [],
      blocked_by_card_ids: ["44444444-4444-4444-8444-444444444403"],
      due_date: "2026-11-06T00:00:00.000Z",
      updated_at: "2026-11-08T10:20:00.000Z",
      cover: {
        type: "color",
        value: "#ef4444",
        size: "normal",
      },
      label_ids: [
        "77777777-7777-4777-8777-777777777774",
        "77777777-7777-4777-8777-777777777772",
      ],
      member_ids: ["88888888-8888-4888-8888-888888888881"],
      checklists: [],
      comments: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccc0005",
          card_id: "44444444-4444-4444-8444-444444444408",
          author_id: "88888888-8888-4888-8888-888888888883",
          author_name: "Samir Patel",
          author_initials: "SP",
          content:
            "Blocked until the Redis Pub/Sub bridge finishes multi-tab convergence tests.",
          created_at: "2026-11-08T10:14:00.000Z",
          updated_at: "2026-11-08T10:14:00.000Z",
        },
      ],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: true,
    },
    {
      id: "44444444-4444-4444-8444-444444444401",
      board_id: SEED_BOARD_ID,
      column_id: "33333333-3333-4333-8333-333333333334",
      title: "Lexicographical O(1) Fractional Indexing Engine",
      description:
        "## Overview\nImplement base-62 midpoint string computation (`a0` + `a1` -> `a0V`) for O(1) single-row card and list moves.",
      position: "a0",
      priority: "HIGH",
      story_points: 5,
      tags: ["core", "algorithms", "perf"],
      subtasks: [
        {
          id: "55555555-5555-4555-8555-555555555501",
          title: "Verify adjacent key midpoint (a0 and a1 -> a0V)",
          is_completed: true,
          position: "a0",
        },
        {
          id: "55555555-5555-4555-8555-555555555502",
          title: "Add unit & property-based boundary ordering checks",
          is_completed: true,
          position: "a1",
        },
      ],
      blocked_by_card_ids: [],
      due_date: "2026-11-07T00:00:00.000Z",
      updated_at: "2026-11-08T09:10:00.000Z",
      cover: {
        type: "color",
        value: "#10b981",
        size: "normal",
      },
      label_ids: [
        "77777777-7777-4777-8777-777777777771",
        "77777777-7777-4777-8777-777777777776",
      ],
      member_ids: [
        "88888888-8888-4888-8888-888888888881",
        "88888888-8888-4888-8888-888888888883",
      ],
      checklists: [
        {
          id: "99999999-9999-4999-8999-999999999994",
          title: "Algorithm Verification",
          position: "a0",
          items: [
            {
              id: "55555555-5555-4555-8555-555555555501",
              title: "Verify adjacent key midpoint (a0 and a1 -> a0V)",
              is_completed: true,
              position: "a0",
              due_date: null,
              assignee_id: "88888888-8888-4888-8888-888888888881",
            },
            {
              id: "55555555-5555-4555-8555-555555555502",
              title: "Add unit & property-based boundary ordering checks",
              is_completed: true,
              position: "a1",
              due_date: null,
              assignee_id: "88888888-8888-4888-8888-888888888883",
            },
          ],
        },
      ],
      comments: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccc0001",
          card_id: "44444444-4444-4444-8444-444444444401",
          author_id: "88888888-8888-4888-8888-888888888881",
          author_name: "Alex Rivera",
          author_initials: "AR",
          content:
            "Benchmarked 10,000 sequential insertions at index 0 — key length stays compact and deterministic.",
          created_at: "2026-11-07T14:20:00.000Z",
          updated_at: "2026-11-07T14:20:00.000Z",
        },
      ],
      attachments: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddd0001",
          name: "Fractional Indexing Technical Spec.md",
          url: "https://figma.com/file/kinetix-fractional-index",
          type: "link",
          created_at: "2026-11-06T10:00:00.000Z",
        },
      ],
      start_date: "2026-11-02T00:00:00.000Z",
      is_due_complete: true,
      is_archived: false,
      is_watching: true,
    },
  ];
  for (const card of seedCards) {
    cards.set(card.id, card);
  }

  // Pre-seed Board 2 (Mobile App Redesign & Growth)
  const BOARD_2_ID = "11111111-1111-4111-8111-111111111112";
  boards.set(BOARD_2_ID, {
    id: BOARD_2_ID,
    workspace_id: DEFAULT_WORKSPACE_ID,
    title: "Mobile App Redesign & Growth",
    description: "Cross-platform mobile redesign, performance overhaul, and onboarding flow.",
    is_starred: false,
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #831843 100%)",
    },
    labels: buildDefaultBoardLabels(BOARD_2_ID),
    members: buildDefaultBoardMembers(),
    activities: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21",
        board_id: BOARD_2_ID,
        card_id: null,
        actor_name: "Maya Lin",
        action_type: "CARD_CREATED",
        description: "created mobile redesign board",
        created_at: "2026-11-08T10:00:00.000Z",
        is_automated: false,
      },
    ],
    automation_rules: [],
    created_at: createdAt,
  });

  const b2Cols: Column[] = [
    { id: "33333333-3333-4333-8333-333333333341", board_id: BOARD_2_ID, title: "Ideas & Research", position: "a0", wip_limit: null, color: "#ec4899", is_archived: false },
    { id: "33333333-3333-4333-8333-333333333342", board_id: BOARD_2_ID, title: "In Design", position: "a1", wip_limit: 4, color: "#8b5cf6", is_archived: false },
    { id: "33333333-3333-4333-8333-333333333343", board_id: BOARD_2_ID, title: "User Testing", position: "a2", wip_limit: 3, color: "#3b82f6", is_archived: false },
    { id: "33333333-3333-4333-8333-333333333344", board_id: BOARD_2_ID, title: "Production Ready", position: "a3", wip_limit: null, color: "#10b981", is_archived: false },
  ];
  for (const c of b2Cols) columns.set(c.id, c);

  const b2Cards: Card[] = [
    {
      id: "44444444-4444-4444-8444-444444444421",
      board_id: BOARD_2_ID,
      column_id: "33333333-3333-4333-8333-333333333341",
      title: "Fluid Gestures & Physics Animation Engine",
      description: "Natural 60fps spring animations for card dragging and modal sheets.",
      position: "a0",
      priority: "HIGH",
      story_points: 5,
      tags: ["mobile", "ui"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-20T00:00:00.000Z",
      updated_at: createdAt,
      cover: { type: "none", value: null, size: "normal" },
      label_ids: ["77777777-7777-4777-8777-777777777775"],
      member_ids: ["88888888-8888-4888-8888-888888888882"],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: false,
    },
    {
      id: "44444444-4444-4444-8444-444444444422",
      board_id: BOARD_2_ID,
      column_id: "33333333-3333-4333-8333-333333333342",
      title: "Biometric FaceID / TouchID Authentication",
      description: "Secure local keychain storage and biometric fallback unlock.",
      position: "a0",
      priority: "MEDIUM",
      story_points: 3,
      tags: ["mobile", "security"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-22T00:00:00.000Z",
      updated_at: createdAt,
      cover: { type: "none", value: null, size: "normal" },
      label_ids: ["77777777-7777-4777-8777-777777777771"],
      member_ids: ["88888888-8888-4888-8888-888888888883"],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: false,
    },
    {
      id: "44444444-4444-4444-8444-444444444423",
      board_id: BOARD_2_ID,
      column_id: "33333333-3333-4333-8333-333333333343",
      title: "Offline-First Sync Engine with SQLite",
      description: "Local caching of cards with background WebSocket delta synchronization.",
      position: "a0",
      priority: "URGENT",
      story_points: 8,
      tags: ["mobile", "offline"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-18T00:00:00.000Z",
      updated_at: createdAt,
      cover: { type: "none", value: null, size: "normal" },
      label_ids: ["77777777-7777-4777-8777-777777777774"],
      member_ids: ["88888888-8888-4888-8888-888888888881"],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: true,
    },
  ];
  for (const c of b2Cards) cards.set(c.id, c);

  // Pre-seed Board 3 (Core Infrastructure & Reliability)
  const BOARD_3_ID = "11111111-1111-4111-8111-111111111113";
  boards.set(BOARD_3_ID, {
    id: BOARD_3_ID,
    workspace_id: DEFAULT_WORKSPACE_ID,
    title: "Core Infrastructure & Reliability",
    description: "PostgreSQL replication, Redis pub/sub cluster, zero-downtime deployment pipelines.",
    is_starred: true,
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)",
    },
    labels: buildDefaultBoardLabels(BOARD_3_ID),
    members: buildDefaultBoardMembers(),
    activities: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa31",
        board_id: BOARD_3_ID,
        card_id: null,
        actor_name: "Samir Patel",
        action_type: "CARD_CREATED",
        description: "created infrastructure reliability board",
        created_at: "2026-11-08T10:00:00.000Z",
        is_automated: false,
      },
    ],
    automation_rules: [],
    created_at: createdAt,
  });

  const b3Cols: Column[] = [
    { id: "33333333-3333-4333-8333-333333333351", board_id: BOARD_3_ID, title: "Backlog", position: "a0", wip_limit: null, color: "#64748b", is_archived: false },
    { id: "33333333-3333-4333-8333-333333333352", board_id: BOARD_3_ID, title: "Active Sprint", position: "a1", wip_limit: 4, color: "#3b82f6", is_archived: false },
    { id: "33333333-3333-4333-8333-333333333353", board_id: BOARD_3_ID, title: "Staging Verification", position: "a2", wip_limit: 3, color: "#f59e0b", is_archived: false },
    { id: "33333333-3333-4333-8333-333333333354", board_id: BOARD_3_ID, title: "Deployed", position: "a3", wip_limit: null, color: "#10b981", is_archived: false },
  ];
  for (const c of b3Cols) columns.set(c.id, c);

  const b3Cards: Card[] = [
    {
      id: "44444444-4444-4444-8444-444444444431",
      board_id: BOARD_3_ID,
      column_id: "33333333-3333-4333-8333-333333333351",
      title: "Zero-Downtime Blue/Green Deployments",
      description: "Automated canary testing and rolling updates via Envoy ingress.",
      position: "a0",
      priority: "HIGH",
      story_points: 8,
      tags: ["infra", "devops"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-25T00:00:00.000Z",
      updated_at: createdAt,
      cover: { type: "none", value: null, size: "normal" },
      label_ids: ["77777777-7777-4777-8777-777777777776"],
      member_ids: ["88888888-8888-4888-8888-888888888884"],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: false,
    },
    {
      id: "44444444-4444-4444-8444-444444444432",
      board_id: BOARD_3_ID,
      column_id: "33333333-3333-4333-8333-333333333352",
      title: "Multi-Region Redis Sentinel Cluster",
      description: "High availability pub/sub bridge with sub-second failover detection.",
      position: "a0",
      priority: "HIGH",
      story_points: 5,
      tags: ["infra", "redis"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-21T00:00:00.000Z",
      updated_at: createdAt,
      cover: { type: "none", value: null, size: "normal" },
      label_ids: ["77777777-7777-4777-8777-777777777773"],
      member_ids: ["88888888-8888-4888-8888-888888888883"],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: false,
    },
    {
      id: "44444444-4444-4444-8444-444444444433",
      board_id: BOARD_3_ID,
      column_id: "33333333-3333-4333-8333-333333333353",
      title: "Automated PostgreSQL WAL Streaming & Point-In-Time Recovery",
      description: "Continuous archival to object storage with automated restore testing.",
      position: "a0",
      priority: "URGENT",
      story_points: 13,
      tags: ["infra", "postgres"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-19T00:00:00.000Z",
      updated_at: createdAt,
      cover: { type: "none", value: null, size: "normal" },
      label_ids: ["77777777-7777-4777-8777-777777777774"],
      member_ids: ["88888888-8888-4888-8888-888888888881"],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: true,
    },
  ];
  for (const c of b3Cards) cards.set(c.id, c);

  return { workspaces, boards, columns, cards };
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
        description TEXT NOT NULL DEFAULT '',
        is_starred BOOLEAN NOT NULL DEFAULT FALSE,
        background JSONB NOT NULL DEFAULT '{"type":"gradient","value":"linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)"}'::jsonb,
        labels JSONB NOT NULL DEFAULT '[]'::jsonb,
        members JSONB NOT NULL DEFAULT '[]'::jsonb,
        activities JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS slug VARCHAR(150) NOT NULL DEFAULT '';
      ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
      ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS logo_color VARCHAR(32) NOT NULL DEFAULT '#6366f1';

      ALTER TABLE boards ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
      ALTER TABLE boards ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE boards ADD COLUMN IF NOT EXISTS background JSONB NOT NULL DEFAULT '{"type":"gradient","value":"linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)"}'::jsonb;
      ALTER TABLE boards ADD COLUMN IF NOT EXISTS labels JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE boards ADD COLUMN IF NOT EXISTS members JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE boards ADD COLUMN IF NOT EXISTS activities JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE boards ADD COLUMN IF NOT EXISTS automation_rules JSONB NOT NULL DEFAULT '[]'::jsonb;

      CREATE TABLE IF NOT EXISTS columns (
        id UUID PRIMARY KEY,
        board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        title VARCHAR(100) NOT NULL,
        position VARCHAR(64) NOT NULL,
        wip_limit INTEGER,
        color VARCHAR(64),
        is_archived BOOLEAN NOT NULL DEFAULT FALSE
      );

      ALTER TABLE columns ADD COLUMN IF NOT EXISTS color VARCHAR(64);
      ALTER TABLE columns ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

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
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        cover JSONB NOT NULL DEFAULT '{"type":"none","value":null,"size":"normal"}'::jsonb,
        label_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        member_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        checklists JSONB NOT NULL DEFAULT '[]'::jsonb,
        comments JSONB NOT NULL DEFAULT '[]'::jsonb,
        attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        start_date TIMESTAMPTZ,
        is_due_complete BOOLEAN NOT NULL DEFAULT FALSE,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        is_watching BOOLEAN NOT NULL DEFAULT FALSE
      );

      ALTER TABLE cards ADD COLUMN IF NOT EXISTS cover JSONB NOT NULL DEFAULT '{"type":"none","value":null,"size":"normal"}'::jsonb;
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS label_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS member_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS checklists JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS comments JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_due_complete BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_watching BOOLEAN NOT NULL DEFAULT FALSE;

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
    const existingBoardRows = await this.db
      .select({ id: schema.boards.id })
      .from(schema.boards);
    const existingBoardIds = new Set(existingBoardRows.map((b) => b.id));

    const seedMem = createPreseededMemoryStore();
    for (const ws of seedMem.workspaces.values()) {
      await this.db
        .insert(schema.workspaces)
        .values({
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          description: ws.description,
          logo_color: ws.logo_color,
          created_at: ws.created_at,
        })
        .onConflictDoNothing();
    }

    const missingSeedBoards = Array.from(seedMem.boards.values()).filter(
      (b) => !existingBoardIds.has(b.id)
    );
    if (missingSeedBoards.length === 0) return;
    const missingBoardIds = new Set(missingSeedBoards.map((b) => b.id));

    for (const b of missingSeedBoards) {
      await this.db
        .insert(schema.boards)
        .values({
          id: b.id,
          workspace_id: b.workspace_id,
          title: b.title,
          description: b.description,
          is_starred: b.is_starred,
          background: b.background,
          labels: b.labels,
          members: b.members,
          activities: b.activities,
          automation_rules: b.automation_rules,
          created_at: b.created_at,
        })
        .onConflictDoNothing();
    }

    for (const col of seedMem.columns.values()) {
      if (!missingBoardIds.has(col.board_id)) continue;
      await this.db
        .insert(schema.columns)
        .values({
          id: col.id,
          board_id: col.board_id,
          title: col.title,
          position: col.position,
          wip_limit: col.wip_limit,
          color: col.color,
          is_archived: col.is_archived,
        })
        .onConflictDoNothing();
    }

    for (const card of seedMem.cards.values()) {
      if (!missingBoardIds.has(card.board_id)) continue;
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
          cover: card.cover,
          label_ids: card.label_ids,
          member_ids: card.member_ids,
          checklists: card.checklists,
          comments: card.comments,
          attachments: card.attachments,
          start_date: card.start_date,
          is_due_complete: card.is_due_complete,
          is_archived: card.is_archived,
          is_watching: card.is_watching,
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
    const rawSubtasks = Array.isArray(row.subtasks) ? row.subtasks : [];
    const rawChecklists = Array.isArray(row.checklists) ? row.checklists : [];
    const { checklists, subtasks } = syncChecklistsAndSubtasks({
      existingChecklists: rawChecklists,
      existingSubtasks: rawSubtasks,
    });

    const rawComments: Comment[] = Array.isArray(row.comments)
      ? row.comments.map((c) => ({
          ...c,
          created_at: normalizeIsoTimestamp(c.created_at),
          updated_at: normalizeIsoTimestamp(c.updated_at),
        }))
      : [];

    const rawAttachments: Attachment[] = Array.isArray(row.attachments)
      ? row.attachments.map((a) => ({
          ...a,
          created_at: normalizeIsoTimestamp(a.created_at),
        }))
      : [];

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
      subtasks,
      blocked_by_card_ids: Array.isArray(row.blocked_by_card_ids)
        ? row.blocked_by_card_ids
        : [],
      due_date: normalizeNullableIsoTimestamp(row.due_date),
      updated_at: normalizeIsoTimestamp(row.updated_at),
      cover: row.cover ?? { ...DEFAULT_CARD_COVER },
      label_ids: Array.isArray(row.label_ids) ? row.label_ids : [],
      member_ids: Array.isArray(row.member_ids) ? row.member_ids : [],
      checklists,
      comments: rawComments,
      attachments: rawAttachments,
      start_date: normalizeNullableIsoTimestamp(row.start_date),
      is_due_complete: Boolean(row.is_due_complete),
      is_archived: Boolean(row.is_archived),
      is_watching: Boolean(row.is_watching),
    };
  }

  private mapRowToColumn(row: typeof schema.columns.$inferSelect): Column {
    return {
      id: row.id,
      board_id: row.board_id,
      title: row.title,
      position: row.position,
      wip_limit: row.wip_limit ?? null,
      color: row.color ?? null,
      is_archived: Boolean(row.is_archived),
    };
  }

  private mapRowToBoard(
    row: typeof schema.boards.$inferSelect,
    cols: Column[],
    boardCards: Card[]
  ): Board {
    const labels =
      Array.isArray(row.labels) && row.labels.length > 0
        ? row.labels
        : buildDefaultBoardLabels(row.id);
    const members =
      Array.isArray(row.members) && row.members.length > 0
        ? row.members
        : buildDefaultBoardMembers();
    const activities: Activity[] = Array.isArray(row.activities)
      ? row.activities.map((a) => ({
          ...a,
          card_id: a.card_id ?? null,
          is_automated: Boolean(a.is_automated),
          created_at: normalizeIsoTimestamp(a.created_at),
        }))
      : [];
    const automationRules: AutomationRule[] = Array.isArray(row.automation_rules)
      ? row.automation_rules
      : [];

    return {
      id: row.id,
      workspace_id: row.workspace_id,
      title: row.title,
      description: row.description ?? "",
      is_starred: Boolean(row.is_starred),
      background: row.background ?? { ...DEFAULT_BOARD_BACKGROUND },
      labels,
      members,
      activities,
      automation_rules: automationRules,
      columns: cols,
      cards: boardCards,
      created_at: normalizeIsoTimestamp(row.created_at),
    };
  }

  // ==========================================================================
  // ACTIVITY LOGGING HELPER
  // ==========================================================================

  public async appendBoardActivity(
    boardId: string,
    params: {
      card_id?: string | null;
      actor_name?: string;
      action_type: ActivityActionType;
      description: string;
      is_automated?: boolean;
    }
  ): Promise<Activity> {
    const activity: Activity = {
      id: randomUUID(),
      board_id: boardId,
      card_id: params.card_id ?? null,
      actor_name: params.actor_name || "Alex Rivera",
      action_type: params.action_type,
      description: params.description,
      is_automated: params.is_automated ?? false,
      created_at: new Date().toISOString(),
    };

    const memBoard = this.memory.boards.get(boardId);
    if (memBoard) {
      memBoard.activities = [activity, ...(memBoard.activities ?? [])];
    }

    if (this.isUsingPostgres() && this.db) {
      try {
        const [boardRow] = await this.db
          .select()
          .from(schema.boards)
          .where(eq(schema.boards.id, boardId))
          .limit(1);

        if (boardRow) {
          const currentActivities = Array.isArray(boardRow.activities)
            ? boardRow.activities
            : [];
          const updatedActivities = [activity, ...currentActivities];
          await this.db
            .update(schema.boards)
            .set({ activities: updatedActivities })
            .where(eq(schema.boards.id, boardId));
        }
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL update failed in appendBoardActivity, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return activity;
  }

  // ==========================================================================
  // WORKSPACE & TEMPLATE OPERATIONS
  // ==========================================================================

  public async listWorkspaces(): Promise<WorkspaceWithBoards[]> {
    let wsList: Workspace[] = [];
    if (this.isUsingPostgres() && this.db) {
      try {
        const rows = await this.db
          .select()
          .from(schema.workspaces)
          .orderBy(asc(schema.workspaces.created_at));
        wsList = rows.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          description: r.description,
          logo_color: r.logo_color,
          created_at: normalizeIsoTimestamp(r.created_at),
        }));
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL failed in listWorkspaces, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    if (!this.isUsingPostgres() || wsList.length === 0) {
      wsList = Array.from(this.memory.workspaces.values());
    }

    const allBoards = await this.listBoards();

    return wsList.map((ws) => {
      const wsBoards = allBoards
        .filter((b) => b.workspace_id === ws.id)
        .map((b) => ({
          id: b.id,
          workspace_id: b.workspace_id,
          title: b.title,
          is_starred: b.is_starred,
          background: b.background,
          card_count: b.cards.filter((c) => !c.is_archived).length,
          updated_at: b.cards[0]?.updated_at ?? b.created_at,
          created_at: b.created_at,
          description: b.description,
        }));

      return {
        ...ws,
        boards: wsBoards,
      };
    });
  }

  public async getWorkspaceById(
    workspaceId: string
  ): Promise<WorkspaceWithBoards | null> {
    const all = await this.listWorkspaces();
    return all.find((w) => w.id === workspaceId) ?? null;
  }

  public async createWorkspace(
    input: CreateWorkspaceRequest
  ): Promise<Workspace> {
    const id = randomUUID();
    const slug =
      input.slug ||
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    const ws: Workspace = {
      id,
      name: input.name,
      slug,
      description: input.description ?? "",
      logo_color: input.logo_color ?? "#6366f1",
      created_at: new Date().toISOString(),
    };

    this.memory.workspaces.set(id, ws);

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db.insert(schema.workspaces).values({
          id: ws.id,
          name: ws.name,
          slug: ws.slug,
          description: ws.description,
          logo_color: ws.logo_color,
          created_at: ws.created_at,
        });
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL failed in createWorkspace, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return ws;
  }

  public async getBoardTemplates(): Promise<BoardTemplate[]> {
    return DEFAULT_BOARD_TEMPLATES.map((t) => ({
      ...t,
      default_columns: [...t.default_columns],
    }));
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

          return this.mapRowToBoard(b, cols, boardCards);
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
    const description = input.description ?? "";
    const isStarred = input.is_starred ?? false;

    const template = input.template_id
      ? DEFAULT_BOARD_TEMPLATES.find((t) => t.id === input.template_id)
      : undefined;

    const background: BoardBackground =
      input.background ?? (template ? template.background : { ...DEFAULT_BOARD_BACKGROUND });

    const labels = buildDefaultBoardLabels(boardId);
    const members = buildDefaultBoardMembers();
    const activities: Activity[] = [];

    const columnTitles = template
      ? template.default_columns
      : DEFAULT_BOARD_COLUMNS.map((col) => col.title);

    const defaultColumns: Column[] = columnTitles.map((title, idx) => ({
      id: randomUUID(),
      board_id: boardId,
      title,
      position: `a${idx}`,
      wip_limit: null,
      color: null,
      is_archived: false,
    }));

    const sampleCards: Card[] = [];
    if (template && template.sample_cards_count > 0 && defaultColumns.length > 0) {
      const col0 = defaultColumns[0]!;
      for (let i = 0; i < template.sample_cards_count; i++) {
        const cardId = randomUUID();
        sampleCards.push({
          id: cardId,
          board_id: boardId,
          column_id: col0.id,
          title: `${template.name} Task #${i + 1}`,
          description: `Task pre-configured from ${template.name} template`,
          position: `a${i}`,
          priority: i === 0 ? "HIGH" : "MEDIUM",
          story_points: 3,
          tags: [template.category.toLowerCase()],
          subtasks: [],
          blocked_by_card_ids: [],
          due_date: null,
          updated_at: createdAt,
          cover: { type: "none", value: null, size: "normal" },
          label_ids: labels[i % labels.length] ? [labels[i % labels.length]!.id] : [],
          member_ids: members[0] ? [members[0]!.id] : [],
          checklists: [],
          comments: [],
          attachments: [],
          start_date: null,
          is_due_complete: false,
          is_archived: false,
          is_watching: false,
        });
      }
    }

    const automationRules: AutomationRule[] = [];
    if (template?.id === "template-engineering-sprint") {
      automationRules.push({
        id: randomUUID(),
        board_id: boardId,
        name: "Auto-Complete on Done",
        description:
          "When card is moved to Done, mark due date as complete and assign member",
        is_enabled: true,
        trigger: {
          type: "WHEN_CARD_MOVED_TO_COLUMN",
          column_id: null,
          column_title_match: "Done",
          priority: null,
          label_id: null,
        },
        actions: [
          {
            type: "MARK_DUE_DATE_COMPLETE",
            due_complete_value: true,
            member_id: null,
            label_id: null,
            priority: null,
            target_column_id: null,
            checklist_title: null,
            checklist_items: null,
            comment_text: null,
          },
          {
            type: "ASSIGN_MEMBER",
            member_id: members[0]?.id ?? null,
            label_id: null,
            priority: null,
            target_column_id: null,
            checklist_title: null,
            checklist_items: null,
            comment_text: null,
            due_complete_value: null,
          },
        ],
        execution_count: 0,
        last_triggered_at: null,
        created_at: createdAt,
      });
    }

    // Keep memory synced
    this.memory.boards.set(boardId, {
      id: boardId,
      workspace_id: workspaceId,
      title: input.title,
      description,
      is_starred: isStarred,
      background,
      labels,
      members,
      activities,
      automation_rules: automationRules,
      created_at: createdAt,
    });
    for (const col of defaultColumns) {
      this.memory.columns.set(col.id, col);
    }
    for (const card of sampleCards) {
      this.memory.cards.set(card.id, card);
    }

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db.insert(schema.boards).values({
          id: boardId,
          workspace_id: workspaceId,
          title: input.title,
          description,
          is_starred: isStarred,
          background,
          labels,
          members,
          activities,
          automation_rules: automationRules,
          created_at: createdAt,
        });
        await this.db.insert(schema.columns).values(
          defaultColumns.map((col) => ({
            id: col.id,
            board_id: col.board_id,
            title: col.title,
            position: col.position,
            wip_limit: col.wip_limit,
            color: col.color,
            is_archived: col.is_archived,
          }))
        );
        if (sampleCards.length > 0) {
          await this.db.insert(schema.cards).values(
            sampleCards.map((sc) => ({
              id: sc.id,
              board_id: sc.board_id,
              column_id: sc.column_id,
              title: sc.title,
              description: sc.description,
              position: sc.position,
              priority: sc.priority,
              story_points: sc.story_points,
              tags: sc.tags,
              subtasks: sc.subtasks,
              blocked_by_card_ids: sc.blocked_by_card_ids,
              due_date: sc.due_date,
              updated_at: sc.updated_at,
              cover: sc.cover,
              label_ids: sc.label_ids,
              member_ids: sc.member_ids,
              checklists: sc.checklists,
              comments: sc.comments,
              attachments: sc.attachments,
              start_date: sc.start_date,
              is_due_complete: sc.is_due_complete,
              is_archived: sc.is_archived,
              is_watching: sc.is_watching,
            }))
          );
        }
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
      description,
      is_starred: isStarred,
      background,
      labels,
      members,
      activities,
      automation_rules: automationRules,
      columns: defaultColumns,
      cards: sampleCards,
      created_at: createdAt,
    };
  }

  public async saveBoardDirect(board: Board): Promise<Board> {
    this.memory.boards.set(board.id, {
      id: board.id,
      workspace_id: board.workspace_id,
      title: board.title,
      description: board.description,
      is_starred: board.is_starred,
      background: board.background,
      labels: board.labels,
      members: board.members,
      activities: board.activities,
      automation_rules: board.automation_rules,
      created_at: board.created_at,
    });

    for (const col of board.columns) {
      this.memory.columns.set(col.id, col);
    }

    for (const card of board.cards) {
      this.memory.cards.set(card.id, card);
    }

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db.insert(schema.boards).values({
          id: board.id,
          workspace_id: board.workspace_id,
          title: board.title,
          description: board.description,
          is_starred: board.is_starred,
          background: board.background,
          labels: board.labels,
          members: board.members,
          activities: board.activities,
          automation_rules: board.automation_rules,
          created_at: board.created_at,
        });

        if (board.columns.length > 0) {
          await this.db.insert(schema.columns).values(
            board.columns.map((col) => ({
              id: col.id,
              board_id: col.board_id,
              title: col.title,
              position: col.position,
              wip_limit: col.wip_limit,
              color: col.color,
              is_archived: col.is_archived,
            }))
          );
        }

        if (board.cards.length > 0) {
          await this.db.insert(schema.cards).values(
            board.cards.map((c) => ({
              id: c.id,
              board_id: c.board_id,
              column_id: c.column_id,
              title: c.title,
              description: c.description,
              position: c.position,
              priority: c.priority,
              story_points: c.story_points,
              tags: c.tags,
              subtasks: c.subtasks,
              blocked_by_card_ids: c.blocked_by_card_ids,
              due_date: c.due_date,
              updated_at: c.updated_at,
              cover: c.cover,
              label_ids: c.label_ids,
              member_ids: c.member_ids,
              checklists: c.checklists,
              comments: c.comments,
              attachments: c.attachments,
              start_date: c.start_date,
              is_due_complete: c.is_due_complete,
              is_archived: c.is_archived,
              is_watching: c.is_watching,
            }))
          );
        }
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL insert failed in saveBoardDirect, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return board;
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

        return this.mapRowToBoard(boardRow, cols, boardCards);
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

  public async updateBoard(
    boardId: string,
    input: UpdateBoardRequest
  ): Promise<Board> {
    const existing = await this.getBoardById(boardId);
    if (!existing) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Board '${boardId}' not found`,
        { board_id: boardId }
      );
    }

    const updatedTitle = input.title ?? existing.title;
    const updatedDescription = input.description ?? existing.description;
    const updatedStarred = input.is_starred ?? existing.is_starred;
    const updatedBackground = input.background ?? existing.background;
    const updatedLabels = input.labels ?? existing.labels;
    const updatedMembers = input.members ?? existing.members;

    this.memory.boards.set(boardId, {
      id: existing.id,
      workspace_id: existing.workspace_id,
      title: updatedTitle,
      description: updatedDescription,
      is_starred: updatedStarred,
      background: updatedBackground,
      labels: updatedLabels,
      members: updatedMembers,
      activities: existing.activities,
      automation_rules: existing.automation_rules,
      created_at: existing.created_at,
    });

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db
          .update(schema.boards)
          .set({
            title: updatedTitle,
            description: updatedDescription,
            is_starred: updatedStarred,
            background: updatedBackground,
            labels: updatedLabels,
            members: updatedMembers,
          })
          .where(eq(schema.boards.id, boardId));
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL update failed in updateBoard, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return {
      ...existing,
      title: updatedTitle,
      description: updatedDescription,
      is_starred: updatedStarred,
      background: updatedBackground,
      labels: updatedLabels,
      members: updatedMembers,
    };
  }

  public async deleteBoard(
    boardId: string
  ): Promise<{ id: string; deleted: boolean }> {
    const existing = await this.getBoardById(boardId);
    if (!existing) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Board '${boardId}' not found`,
        { board_id: boardId }
      );
    }

    this.memory.boards.delete(boardId);
    for (const [colId, col] of this.memory.columns.entries()) {
      if (col.board_id === boardId) {
        this.memory.columns.delete(colId);
      }
    }
    for (const [cardId, card] of this.memory.cards.entries()) {
      if (card.board_id === boardId) {
        this.memory.cards.delete(cardId);
      }
    }

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db
          .delete(schema.boards)
          .where(eq(schema.boards.id, boardId));
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL failed in deleteBoard, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return { id: boardId, deleted: true };
  }

  // ==========================================================================
  // BUTLER AUTOMATION RULES OPERATIONS
  // ==========================================================================

  public async getAutomationRules(boardId: string): Promise<AutomationRule[]> {
    const board = await this.getBoardById(boardId);
    if (!board) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Board '${boardId}' not found`,
        { board_id: boardId }
      );
    }
    return board.automation_rules ?? [];
  }

  public async createAutomationRule(
    boardId: string,
    input: CreateAutomationRuleRequest
  ): Promise<AutomationRule> {
    const board = await this.getBoardById(boardId);
    if (!board) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Board '${boardId}' not found`,
        { board_id: boardId }
      );
    }

    const rule: AutomationRule = {
      id: randomUUID(),
      board_id: boardId,
      name: input.name,
      description: input.description ?? "",
      is_enabled: input.is_enabled ?? true,
      trigger: input.trigger,
      actions: input.actions,
      execution_count: 0,
      last_triggered_at: null,
      created_at: new Date().toISOString(),
    };

    const updatedRules = [...(board.automation_rules ?? []), rule];

    const memBoard = this.memory.boards.get(boardId);
    if (memBoard) {
      memBoard.automation_rules = updatedRules;
    }

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db
          .update(schema.boards)
          .set({ automation_rules: updatedRules })
          .where(eq(schema.boards.id, boardId));
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL failed in createAutomationRule, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return rule;
  }

  public async updateAutomationRule(
    ruleId: string,
    input: UpdateAutomationRuleRequest
  ): Promise<{ rule: AutomationRule; boardId: string }> {
    const allBoards = await this.listBoards();
    let foundBoard: Board | null = null;
    let foundRule: AutomationRule | null = null;

    for (const b of allBoards) {
      const r = (b.automation_rules ?? []).find((x) => x.id === ruleId);
      if (r) {
        foundBoard = b;
        foundRule = r;
        break;
      }
    }

    if (!foundBoard || !foundRule) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Automation rule '${ruleId}' not found`,
        { rule_id: ruleId }
      );
    }

    const updatedRule: AutomationRule = {
      ...foundRule,
      name: input.name ?? foundRule.name,
      description: input.description ?? foundRule.description,
      is_enabled: input.is_enabled ?? foundRule.is_enabled,
      trigger: input.trigger ?? foundRule.trigger,
      actions: input.actions ?? foundRule.actions,
    };

    const nextRules = (foundBoard.automation_rules ?? []).map((r) =>
      r.id === ruleId ? updatedRule : r
    );

    const memBoard = this.memory.boards.get(foundBoard.id);
    if (memBoard) {
      memBoard.automation_rules = nextRules;
    }

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db
          .update(schema.boards)
          .set({ automation_rules: nextRules })
          .where(eq(schema.boards.id, foundBoard.id));
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL failed in updateAutomationRule, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return { rule: updatedRule, boardId: foundBoard.id };
  }

  public async deleteAutomationRule(
    ruleId: string
  ): Promise<{ id: string; boardId: string; deleted: boolean }> {
    const allBoards = await this.listBoards();
    let foundBoard: Board | null = null;

    for (const b of allBoards) {
      const r = (b.automation_rules ?? []).find((x) => x.id === ruleId);
      if (r) {
        foundBoard = b;
        break;
      }
    }

    if (!foundBoard) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Automation rule '${ruleId}' not found`,
        { rule_id: ruleId }
      );
    }

    const nextRules = (foundBoard.automation_rules ?? []).filter(
      (r) => r.id !== ruleId
    );

    const memBoard = this.memory.boards.get(foundBoard.id);
    if (memBoard) {
      memBoard.automation_rules = nextRules;
    }

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db
          .update(schema.boards)
          .set({ automation_rules: nextRules })
          .where(eq(schema.boards.id, foundBoard.id));
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL failed in deleteAutomationRule, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return { id: ruleId, boardId: foundBoard.id, deleted: true };
  }

  public async updateRuleExecution(
    boardId: string,
    ruleId: string
  ): Promise<AutomationRule> {
    const board = await this.getBoardById(boardId);
    if (!board) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Board '${boardId}' not found`,
        { board_id: boardId }
      );
    }

    const rule = (board.automation_rules ?? []).find((r) => r.id === ruleId);
    if (!rule) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Automation rule '${ruleId}' not found on board '${boardId}'`,
        { board_id: boardId, rule_id: ruleId }
      );
    }

    rule.execution_count = (rule.execution_count ?? 0) + 1;
    rule.last_triggered_at = new Date().toISOString();

    const memBoard = this.memory.boards.get(boardId);
    if (memBoard) {
      memBoard.automation_rules = board.automation_rules;
    }

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db
          .update(schema.boards)
          .set({ automation_rules: board.automation_rules })
          .where(eq(schema.boards.id, boardId));
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL failed in updateRuleExecution, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return rule;
  }

  public async saveCardDirect(card: Card): Promise<Card> {
    this.memory.cards.set(card.id, card);

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db
          .update(schema.cards)
          .set({
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
            cover: card.cover,
            label_ids: card.label_ids,
            member_ids: card.member_ids,
            checklists: card.checklists,
            comments: card.comments,
            attachments: card.attachments,
            start_date: card.start_date,
            is_due_complete: card.is_due_complete,
            is_archived: card.is_archived,
            is_watching: card.is_watching,
          })
          .where(eq(schema.cards.id, card.id));
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL failed in saveCardDirect, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return card;
  }

  // ==========================================================================
  // COLUMN OPERATIONS
  // ==========================================================================

  public async getColumnById(columnId: string): Promise<Column | null> {
    if (this.isUsingPostgres() && this.db) {
      try {
        const [row] = await this.db
          .select()
          .from(schema.columns)
          .where(eq(schema.columns.id, columnId))
          .limit(1);
        if (!row) return null;
        return this.mapRowToColumn(row);
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL query failed in getColumnById, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return this.memory.columns.get(columnId) ?? null;
  }

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
      color: input.color ?? null,
      is_archived: false,
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
          color: newCol.color,
          is_archived: newCol.is_archived,
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

  public async updateColumn(
    columnId: string,
    input: UpdateColumnRequest
  ): Promise<Column> {
    const existing = await this.getColumnById(columnId);
    if (!existing) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Column '${columnId}' not found`,
        { column_id: columnId }
      );
    }

    const updatedCol: Column = {
      ...existing,
      title: input.title ?? existing.title,
      position: input.position ?? existing.position,
      wip_limit:
        input.wip_limit !== undefined ? input.wip_limit : existing.wip_limit,
      color: input.color !== undefined ? input.color : existing.color,
      is_archived:
        input.is_archived !== undefined
          ? input.is_archived
          : existing.is_archived,
    };

    this.memory.columns.set(columnId, updatedCol);

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db
          .update(schema.columns)
          .set({
            title: updatedCol.title,
            position: updatedCol.position,
            wip_limit: updatedCol.wip_limit,
            color: updatedCol.color,
            is_archived: updatedCol.is_archived,
          })
          .where(eq(schema.columns.id, columnId));
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL update failed in updateColumn, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return updatedCol;
  }

  public async moveColumn(
    columnId: string,
    input: MoveColumnRequest
  ): Promise<Column> {
    return this.updateColumn(columnId, { position: input.new_position });
  }

  public async copyColumn(
    columnId: string,
    input: CopyColumnRequest = {}
  ): Promise<CopyColumnResponse> {
    const sourceCol = await this.getColumnById(columnId);
    if (!sourceCol) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Column '${columnId}' not found`,
        { column_id: columnId }
      );
    }

    const board = await this.getBoardById(sourceCol.board_id);
    if (!board) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Board '${sourceCol.board_id}' not found`,
        { board_id: sourceCol.board_id }
      );
    }

    const newCol: Column = {
      id: randomUUID(),
      board_id: sourceCol.board_id,
      title: input.title ?? `${sourceCol.title} (Copy)`,
      position: input.position ?? `${sourceCol.position}V`,
      wip_limit: sourceCol.wip_limit,
      color: sourceCol.color,
      is_archived: false,
    };

    this.memory.columns.set(newCol.id, newCol);

    const sourceCards = board.cards
      .filter((c) => c.column_id === columnId && !c.is_archived)
      .sort((a, b) => compareFractionalIndex(a.position, b.position));

    const now = new Date().toISOString();
    const copiedCards: Card[] = sourceCards.map((card) => {
      const clonedChecklists: Checklist[] = card.checklists.map((cl) => ({
        id: randomUUID(),
        title: cl.title,
        position: cl.position,
        items: cl.items.map((it) => ({
          ...it,
          id: randomUUID(),
        })),
      }));
      const { checklists, subtasks } = syncChecklistsAndSubtasks({
        inputChecklists:
          clonedChecklists.length > 0 ? clonedChecklists : undefined,
        inputSubtasks:
          clonedChecklists.length === 0
            ? card.subtasks.map((st) => ({ ...st, id: randomUUID() }))
            : undefined,
      });

      const clonedCard: Card = {
        ...card,
        id: randomUUID(),
        column_id: newCol.id,
        checklists,
        subtasks,
        comments: [],
        attachments: card.attachments.map((att) => ({
          ...att,
          id: randomUUID(),
        })),
        label_ids: [...card.label_ids],
        member_ids: [...card.member_ids],
        tags: [...card.tags],
        blocked_by_card_ids: [...card.blocked_by_card_ids],
        cover: { ...card.cover },
        updated_at: now,
      };
      this.memory.cards.set(clonedCard.id, clonedCard);
      return clonedCard;
    });

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db.insert(schema.columns).values({
          id: newCol.id,
          board_id: newCol.board_id,
          title: newCol.title,
          position: newCol.position,
          wip_limit: newCol.wip_limit,
          color: newCol.color,
          is_archived: newCol.is_archived,
        });

        for (const c of copiedCards) {
          await this.db.insert(schema.cards).values({
            id: c.id,
            board_id: c.board_id,
            column_id: c.column_id,
            title: c.title,
            description: c.description,
            position: c.position,
            priority: c.priority,
            story_points: c.story_points,
            tags: c.tags,
            subtasks: c.subtasks,
            blocked_by_card_ids: c.blocked_by_card_ids,
            due_date: c.due_date,
            updated_at: c.updated_at,
            cover: c.cover,
            label_ids: c.label_ids,
            member_ids: c.member_ids,
            checklists: c.checklists,
            comments: c.comments,
            attachments: c.attachments,
            start_date: c.start_date,
            is_due_complete: c.is_due_complete,
            is_archived: c.is_archived,
            is_watching: c.is_watching,
          });
        }
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL insert failed in copyColumn, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return {
      column: newCol,
      cards: copiedCards,
    };
  }

  // ==========================================================================
  // CARD OPERATIONS
  // ==========================================================================

  public async createCard(
    boardId: string,
    input: CreateCardRequest,
    actorName = "Alex Rivera"
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

    const targetColumn = board.columns.find((c) => c.id === input.column_id);
    if (!targetColumn) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Column '${input.column_id}' not found in board '${boardId}'`,
        { board_id: boardId, column_id: input.column_id }
      );
    }

    const now = new Date().toISOString();
    const { checklists, subtasks } = syncChecklistsAndSubtasks({
      inputChecklists: input.checklists,
      inputSubtasks: input.subtasks,
    });

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
      subtasks,
      blocked_by_card_ids: input.blocked_by_card_ids ?? [],
      due_date: input.due_date ?? null,
      updated_at: now,
      cover: input.cover ?? { ...DEFAULT_CARD_COVER },
      label_ids: input.label_ids ?? [],
      member_ids: input.member_ids ?? [],
      checklists,
      comments: input.comments ?? [],
      attachments: input.attachments ?? [],
      start_date: input.start_date ?? null,
      is_due_complete: input.is_due_complete ?? false,
      is_archived: input.is_archived ?? false,
      is_watching: input.is_watching ?? false,
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
          cover: newCard.cover,
          label_ids: newCard.label_ids,
          member_ids: newCard.member_ids,
          checklists: newCard.checklists,
          comments: newCard.comments,
          attachments: newCard.attachments,
          start_date: newCard.start_date,
          is_due_complete: newCard.is_due_complete,
          is_archived: newCard.is_archived,
          is_watching: newCard.is_watching,
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

    await this.appendBoardActivity(boardId, {
      card_id: newCard.id,
      actor_name: actorName,
      action_type: "CARD_CREATED",
      description: `added ${newCard.title} to ${targetColumn.title}`,
    });

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
    input: UpdateCardRequest,
    options?: {
      actorName?: string;
      activityActionType?: ActivityActionType;
      activityDescription?: string;
    }
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
    const { checklists, subtasks } = syncChecklistsAndSubtasks({
      inputChecklists: input.checklists,
      inputSubtasks: input.subtasks,
      existingChecklists: existing.checklists,
      existingSubtasks: existing.subtasks,
    });

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
      subtasks,
      blocked_by_card_ids:
        input.blocked_by_card_ids ?? existing.blocked_by_card_ids,
      due_date:
        input.due_date !== undefined ? input.due_date : existing.due_date,
      updated_at: now,
      cover: input.cover ?? existing.cover,
      label_ids: input.label_ids ?? existing.label_ids,
      member_ids: input.member_ids ?? existing.member_ids,
      checklists,
      comments: input.comments ?? existing.comments,
      attachments: input.attachments ?? existing.attachments,
      start_date:
        input.start_date !== undefined ? input.start_date : existing.start_date,
      is_due_complete:
        input.is_due_complete !== undefined
          ? input.is_due_complete
          : existing.is_due_complete,
      is_archived:
        input.is_archived !== undefined
          ? input.is_archived
          : existing.is_archived,
      is_watching:
        input.is_watching !== undefined
          ? input.is_watching
          : existing.is_watching,
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
            cover: updatedCard.cover,
            label_ids: updatedCard.label_ids,
            member_ids: updatedCard.member_ids,
            checklists: updatedCard.checklists,
            comments: updatedCard.comments,
            attachments: updatedCard.attachments,
            start_date: updatedCard.start_date,
            is_due_complete: updatedCard.is_due_complete,
            is_archived: updatedCard.is_archived,
            is_watching: updatedCard.is_watching,
          })
          .where(eq(schema.cards.id, cardId));

        if (input.subtasks !== undefined || input.checklists !== undefined) {
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

    let actionType: ActivityActionType =
      options?.activityActionType ?? "CHECKLIST_COMPLETED";
    let description =
      options?.activityDescription ?? `updated card ${updatedCard.title}`;

    if (!options?.activityActionType) {
      if (
        input.is_archived !== undefined &&
        input.is_archived !== existing.is_archived
      ) {
        actionType = "CARD_ARCHIVED";
        description = input.is_archived
          ? `archived ${updatedCard.title}`
          : `restored ${updatedCard.title} to board`;
      } else if (input.member_ids !== undefined) {
        actionType = "MEMBER_ASSIGNED";
        description = `updated members on ${updatedCard.title}`;
      } else if (
        input.checklists !== undefined ||
        input.subtasks !== undefined
      ) {
        actionType = "CHECKLIST_COMPLETED";
        description = `updated checklist items on ${updatedCard.title}`;
      }
    }

    await this.appendBoardActivity(existing.board_id, {
      card_id: cardId,
      actor_name: options?.actorName ?? "Alex Rivera",
      action_type: actionType,
      description,
    });

    return updatedCard;
  }

  /**
   * O(1) single-row fractional index move update.
   */
  public async moveCard(
    cardId: string,
    input: MoveCardRequest,
    actorName = "Alex Rivera"
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

    let finalCard = movedCard;

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
          finalCard = this.mapRowToCard(updatedRow);
        }
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL O(1) moveCard failed, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    const targetCol = await this.getColumnById(input.target_column_id);
    await this.appendBoardActivity(existing.board_id, {
      card_id: cardId,
      actor_name: actorName,
      action_type: "CARD_MOVED",
      description: `moved ${existing.title} to ${
        targetCol?.title ?? input.target_column_id
      }`,
    });

    return {
      card: finalCard,
      sourceColumnId,
    };
  }

  public async copyCard(
    cardId: string,
    input: Partial<CopyCardRequest> = {},
    actorName = "Alex Rivera"
  ): Promise<Card> {
    const sourceCard = await this.getCardById(cardId);
    if (!sourceCard) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Card '${cardId}' not found`,
        { card_id: cardId }
      );
    }

    const keepChecklists = input.keep_checklists ?? true;
    const keepLabels = input.keep_labels ?? true;
    const keepMembers = input.keep_members ?? true;
    const keepAttachments = input.keep_attachments ?? true;

    const clonedChecklists: Checklist[] = keepChecklists
      ? sourceCard.checklists.map((cl) => ({
          id: randomUUID(),
          title: cl.title,
          position: cl.position,
          items: cl.items.map((it) => ({
            ...it,
            id: randomUUID(),
          })),
        }))
      : [];

    const clonedSubtasks: Subtask[] = keepChecklists
      ? sourceCard.subtasks.map((st) => ({
          ...st,
          id: randomUUID(),
        }))
      : [];

    return this.createCard(
      sourceCard.board_id,
      {
        column_id: input.target_column_id ?? sourceCard.column_id,
        title: input.title ?? `${sourceCard.title} (Copy)`,
        description: sourceCard.description,
        position: input.position ?? `${sourceCard.position}V`,
        priority: sourceCard.priority,
        story_points: sourceCard.story_points,
        tags: [...sourceCard.tags],
        subtasks: clonedSubtasks,
        blocked_by_card_ids: [...sourceCard.blocked_by_card_ids],
        due_date: sourceCard.due_date,
        cover: { ...sourceCard.cover },
        label_ids: keepLabels ? [...sourceCard.label_ids] : [],
        member_ids: keepMembers ? [...sourceCard.member_ids] : [],
        checklists: clonedChecklists,
        comments: [],
        attachments: keepAttachments
          ? sourceCard.attachments.map((att) => ({
              ...att,
              id: randomUUID(),
            }))
          : [],
        start_date: sourceCard.start_date,
        is_due_complete: sourceCard.is_due_complete,
        is_archived: false,
        is_watching: sourceCard.is_watching,
      },
      actorName
    );
  }

  public async deleteCard(
    cardId: string,
    actorName = "Alex Rivera"
  ): Promise<{ id: string; board_id: string; deleted: true }> {
    const existing = await this.getCardById(cardId);
    if (!existing) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Card '${cardId}' not found`,
        { card_id: cardId }
      );
    }

    this.memory.cards.delete(cardId);

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db.delete(schema.cards).where(eq(schema.cards.id, cardId));
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL deleteCard failed, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    await this.appendBoardActivity(existing.board_id, {
      card_id: cardId,
      actor_name: actorName,
      action_type: "CARD_ARCHIVED",
      description: `deleted card ${existing.title}`,
    });

    return {
      id: cardId,
      board_id: existing.board_id,
      deleted: true,
    };
  }

  // ==========================================================================
  // COMMENT OPERATIONS
  // ==========================================================================

  public async addComment(
    cardId: string,
    input: CreateCommentRequest
  ): Promise<{ comment: Comment; card: Card }> {
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
    const authorName = input.author_name || "Alex Rivera";
    const derivedInitials =
      input.author_initials ||
      authorName
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 4) ||
      "AR";

    const comment: Comment = {
      id: randomUUID(),
      card_id: cardId,
      author_id: input.author_id || "88888888-8888-4888-8888-888888888881",
      author_name: authorName,
      author_initials: derivedInitials,
      content: input.content,
      created_at: now,
      updated_at: now,
    };

    const updatedComments = [...existing.comments, comment];
    const updatedCard: Card = {
      ...existing,
      comments: updatedComments,
      updated_at: now,
    };

    this.memory.cards.set(cardId, updatedCard);

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db
          .update(schema.cards)
          .set({
            comments: updatedComments,
            updated_at: now,
          })
          .where(eq(schema.cards.id, cardId));
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL addComment failed, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    await this.appendBoardActivity(existing.board_id, {
      card_id: cardId,
      actor_name: authorName,
      action_type: "COMMENT_ADDED",
      description: `commented on ${existing.title}: "${input.content.slice(
        0,
        80
      )}"`,
    });

    return { comment, card: updatedCard };
  }

  public async deleteComment(
    cardId: string,
    commentId: string
  ): Promise<{ id: string; card: Card; deleted: true }> {
    const existing = await this.getCardById(cardId);
    if (!existing) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Card '${cardId}' not found`,
        { card_id: cardId }
      );
    }

    const commentExists = existing.comments.some((c) => c.id === commentId);
    if (!commentExists) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        `Comment '${commentId}' not found on card '${cardId}'`,
        { card_id: cardId, comment_id: commentId }
      );
    }

    const now = new Date().toISOString();
    const updatedComments = existing.comments.filter((c) => c.id !== commentId);
    const updatedCard: Card = {
      ...existing,
      comments: updatedComments,
      updated_at: now,
    };

    this.memory.cards.set(cardId, updatedCard);

    if (this.isUsingPostgres() && this.db) {
      try {
        await this.db
          .update(schema.cards)
          .set({
            comments: updatedComments,
            updated_at: now,
          })
          .where(eq(schema.cards.id, cardId));
      } catch (err) {
        console.warn(
          "[StorageRepository] PostgreSQL deleteComment failed, falling back to memory:",
          err
        );
        this.useMemoryFallback = true;
      }
    }

    return {
      id: commentId,
      card: updatedCard,
      deleted: true,
    };
  }
}
