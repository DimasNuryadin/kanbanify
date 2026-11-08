import {
  Activity,
  Board,
  BoardSchema,
  Card,
  CardSchema,
  Checklist,
  Column,
  ColumnSchema,
  Comment,
  CommentSchema,
  CopyCardRequest,
  CopyColumnRequest,
  CopyColumnResponse,
  CreateBoardRequest,
  CreateCardRequest,
  CreateColumnRequest,
  CreateCommentRequest,
  DEFAULT_BOARD_LABELS,
  DEFAULT_BOARD_MEMBERS,
  MoveCardRequest,
  MoveColumnRequest,
  Priority,
  Subtask,
  UpdateBoardRequest,
  UpdateCardRequest,
  UpdateColumnRequest,
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

const LABEL_GREEN = DEFAULT_BOARD_LABELS[0].id;
const LABEL_YELLOW = DEFAULT_BOARD_LABELS[1].id;
const LABEL_ORANGE = DEFAULT_BOARD_LABELS[2].id;
const LABEL_RED = DEFAULT_BOARD_LABELS[3].id;
const LABEL_PURPLE = DEFAULT_BOARD_LABELS[4].id;
const LABEL_BLUE = DEFAULT_BOARD_LABELS[5].id;

const MEMBER_ALEX = DEFAULT_BOARD_MEMBERS[0].id;
const MEMBER_MAYA = DEFAULT_BOARD_MEMBERS[1].id;
const MEMBER_SAMIR = DEFAULT_BOARD_MEMBERS[2].id;
const MEMBER_ELENA = DEFAULT_BOARD_MEMBERS[3].id;

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
  title: "Kinetix v2 — Full Trello Parity Launch",
  description:
    "High-craftsmanship real-time workspace uniting Trello visual fluidity with Linear engineering precision.",
  is_starred: true,
  background: {
    type: "solid",
    value: "adaptive-default",
  },
  created_at: "2026-11-08T08:00:00.000Z",
  labels: DEFAULT_BOARD_LABELS.map((l) => ({
    ...l,
    board_id: SEED_BOARD_ID,
  })),
  members: DEFAULT_BOARD_MEMBERS.map((m) => ({ ...m })),
  columns: [
    {
      id: COL_BACKLOG_ID,
      board_id: SEED_BOARD_ID,
      title: "Backlog",
      position: "a0",
      wip_limit: null,
      color: "#64748b",
      is_archived: false,
    },
    {
      id: COL_IN_PROGRESS_ID,
      board_id: SEED_BOARD_ID,
      title: "In Progress",
      position: "a1",
      wip_limit: 4,
      color: "#3b82f6",
      is_archived: false,
    },
    {
      id: COL_REVIEW_ID,
      board_id: SEED_BOARD_ID,
      title: "Review & QA",
      position: "a2",
      wip_limit: 3,
      color: "#8b5cf6",
      is_archived: false,
    },
    {
      id: COL_DONE_ID,
      board_id: SEED_BOARD_ID,
      title: "Done",
      position: "a3",
      wip_limit: null,
      color: "#10b981",
      is_archived: false,
    },
  ],
  cards: [
    {
      id: CARD_1_ID,
      board_id: SEED_BOARD_ID,
      column_id: COL_DONE_ID,
      title: "Lexicographical O(1) Fractional Indexing Engine",
      description:
        "## Overview\nImplement base-62 midpoint string computation (`a0` + `a1` -> `a0V`) so drag-and-drop card and list reordering updates a single row without full-column re-indexing.\n\n## Key Guarantees\n- Deterministic lexicographical sorting\n- Zero collision under bursty multi-peer drags",
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
      start_date: "2026-11-02T00:00:00.000Z",
      due_date: "2026-11-07T00:00:00.000Z",
      is_due_complete: true,
      is_archived: false,
      is_watching: true,
      cover: {
        type: "color",
        value: "#10b981",
        size: "normal",
      },
      label_ids: [LABEL_GREEN, LABEL_BLUE],
      member_ids: [MEMBER_ALEX, MEMBER_SAMIR],
      checklists: [
        {
          id: "99999999-9999-4999-8999-999999999901",
          title: "Algorithm Implementation",
          position: "a0",
          items: [
            {
              id: "55555555-5555-4555-8555-555555555501",
              title: "Implement base-62 character table & prefix stripper",
              is_completed: true,
              position: "a0",
              due_date: null,
              assignee_id: MEMBER_ALEX,
            },
            {
              id: "55555555-5555-4555-8555-555555555502",
              title: "Verify adjacent key midpoint (`a0` and `a1` -> `a0V`)",
              is_completed: true,
              position: "a1",
              due_date: null,
              assignee_id: MEMBER_SAMIR,
            },
            {
              id: "55555555-5555-4555-8555-555555555503",
              title: "Add unit & property-based boundary ordering checks",
              is_completed: true,
              position: "a2",
              due_date: null,
              assignee_id: MEMBER_ALEX,
            },
          ],
        },
      ],
      comments: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccc0001",
          card_id: CARD_1_ID,
          author_id: MEMBER_ALEX,
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
      start_date: "2026-11-04T00:00:00.000Z",
      due_date: "2026-11-08T00:00:00.000Z",
      is_due_complete: true,
      is_archived: false,
      is_watching: false,
      cover: {
        type: "none",
        value: null,
        size: "normal",
      },
      label_ids: [LABEL_GREEN, LABEL_BLUE],
      member_ids: [MEMBER_MAYA],
      checklists: [
        {
          id: "99999999-9999-4999-8999-999999999902",
          title: "Contract Verification",
          position: "a0",
          items: [
            {
              id: "55555555-5555-4555-8555-555555555504",
              title: "Author shared Zod schemas in packages/contracts/index.ts",
              is_completed: true,
              position: "a0",
              due_date: null,
              assignee_id: MEMBER_MAYA,
            },
            {
              id: "55555555-5555-4555-8555-555555555505",
              title: "Sync Pydantic v2 models in packages/contracts/schemas.py",
              is_completed: true,
              position: "a1",
              due_date: null,
              assignee_id: MEMBER_MAYA,
            },
          ],
        },
      ],
      comments: [],
      attachments: [],
      updated_at: "2026-11-08T09:20:00.000Z",
    },
    {
      id: CARD_3_ID,
      board_id: SEED_BOARD_ID,
      column_id: COL_IN_PROGRESS_ID,
      title: "Real-Time WebSocket Broadcast & Redis Pub/Sub Bridge",
      description:
        "## Objective\nSynchronize `CARD_MOVED`, `CARD_UPDATED`, `COLUMN_MOVED`, and `COMMENT_ADDED` events across active board peers in <25ms using Fastify WebSocket rooms.\n\n## Architecture Notes\n- Deduplicate optimistic local mutations by `actor_id`\n- Automatic exponential backoff reconnect",
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
      start_date: "2026-11-06T00:00:00.000Z",
      due_date: "2026-11-09T12:00:00.000Z",
      is_due_complete: false,
      is_archived: false,
      is_watching: true,
      cover: {
        type: "color",
        value: "#3b82f6",
        size: "normal",
      },
      label_ids: [LABEL_BLUE, LABEL_ORANGE],
      member_ids: [MEMBER_ALEX, MEMBER_ELENA],
      checklists: [
        {
          id: "99999999-9999-4999-8999-999999999903",
          title: "WebSocket Protocol Tasks",
          position: "a0",
          items: [
            {
              id: "55555555-5555-4555-8555-555555555506",
              title: "Subscribe client to /ws/boards/:boardId with auto-reconnect",
              is_completed: true,
              position: "a0",
              due_date: null,
              assignee_id: MEMBER_ALEX,
            },
            {
              id: "55555555-5555-4555-8555-555555555507",
              title: "Deduplicate optimistic local mutations by actor_id",
              is_completed: true,
              position: "a1",
              due_date: null,
              assignee_id: MEMBER_ELENA,
            },
            {
              id: "55555555-5555-4555-8555-555555555508",
              title: "Handle multi-tab state convergence under bursty moves",
              is_completed: false,
              position: "a2",
              due_date: null,
              assignee_id: MEMBER_ALEX,
            },
          ],
        },
        {
          id: "99999999-9999-4999-8999-999999999933",
          title: "Load & Chaos Testing",
          position: "a1",
          items: [
            {
              id: "55555555-5555-4555-8555-555555555531",
              title: "Simulate 250 concurrent board room connections",
              is_completed: true,
              position: "a0",
              due_date: null,
              assignee_id: MEMBER_ELENA,
            },
            {
              id: "55555555-5555-4555-8555-555555555532",
              title: "Verify zero dropped frames during Redis failover",
              is_completed: false,
              position: "a1",
              due_date: null,
              assignee_id: MEMBER_SAMIR,
            },
          ],
        },
      ],
      comments: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccc0002",
          card_id: CARD_3_ID,
          author_id: MEMBER_ELENA,
          author_name: "Elena Rostova",
          author_initials: "ER",
          content:
            "WebSocket heartbeat ping/pong interval is tuned to 15s. Ready for multi-tab testing.",
          created_at: "2026-11-08T09:30:00.000Z",
          updated_at: "2026-11-08T09:30:00.000Z",
        },
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccc0003",
          card_id: CARD_3_ID,
          author_id: MEMBER_ALEX,
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
      updated_at: "2026-11-08T09:45:00.000Z",
    },
    {
      id: CARD_4_ID,
      board_id: SEED_BOARD_ID,
      column_id: COL_IN_PROGRESS_ID,
      title: "AI Smart Card Enrichment & Multi-Checklist Synthesis",
      description:
        "Connect `POST /api/v1/cards/:cardId/ai-decompose` to the internal FastAPI AI Engine (`:8001`) to generate structured Markdown descriptions, suggested Trello color labels, and multiple checklists.",
      position: "a1",
      priority: "HIGH",
      story_points: 5,
      tags: ["ai-engine", "llm", "ux", "ai-decomposed"],
      subtasks: [
        {
          id: "55555555-5555-4555-8555-555555555509",
          title: "Build shimmer loading state in 2-Column Trello Card Modal",
          is_completed: true,
          position: "a0",
        },
        {
          id: "55555555-5555-4555-8555-555555555510",
          title: "Merge AI-suggested checklists & labels with card state",
          is_completed: false,
          position: "a1",
        },
      ],
      blocked_by_card_ids: [],
      start_date: "2026-11-07T00:00:00.000Z",
      due_date: "2026-11-14T00:00:00.000Z",
      is_due_complete: false,
      is_archived: false,
      is_watching: true,
      cover: {
        type: "color",
        value: "#8b5cf6",
        size: "normal",
      },
      label_ids: [LABEL_PURPLE, LABEL_GREEN],
      member_ids: [MEMBER_MAYA, MEMBER_SAMIR],
      checklists: [
        {
          id: "99999999-9999-4999-8999-999999999904",
          title: "AI Enrichment Pipeline",
          position: "a0",
          items: [
            {
              id: "55555555-5555-4555-8555-555555555509",
              title: "Build shimmer loading state in 2-Column Trello Card Modal",
              is_completed: true,
              position: "a0",
              due_date: null,
              assignee_id: MEMBER_MAYA,
            },
            {
              id: "55555555-5555-4555-8555-555555555510",
              title: "Merge AI-suggested checklists & labels with card state",
              is_completed: false,
              position: "a1",
              due_date: null,
              assignee_id: MEMBER_SAMIR,
            },
          ],
        },
      ],
      comments: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccc0004",
          card_id: CARD_4_ID,
          author_id: MEMBER_MAYA,
          author_name: "Maya Lin",
          author_initials: "ML",
          content:
            "AI Smart Enrich now auto-populates structured Markdown acceptance criteria and two categorized checklists!",
          created_at: "2026-11-08T10:02:00.000Z",
          updated_at: "2026-11-08T10:02:00.000Z",
        },
      ],
      attachments: [],
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
      start_date: "2026-11-05T00:00:00.000Z",
      due_date: "2026-11-15T00:00:00.000Z",
      is_due_complete: false,
      is_archived: false,
      is_watching: true,
      cover: {
        type: "color",
        value: "#0ea5e9",
        size: "normal",
      },
      label_ids: [LABEL_GREEN, LABEL_YELLOW],
      member_ids: [MEMBER_SAMIR, MEMBER_ALEX],
      checklists: [
        {
          id: "99999999-9999-4999-8999-999999999905",
          title: "Security Audit Checklist",
          position: "a0",
          items: [
            {
              id: "55555555-5555-4555-8555-555555555511",
              title: "Register OAuth2 client credentials and redirect URIs",
              is_completed: true,
              position: "a0",
              due_date: null,
              assignee_id: MEMBER_SAMIR,
            },
            {
              id: "55555555-5555-4555-8555-555555555512",
              title: "Implement PKCE code_verifier & code_challenge generator",
              is_completed: true,
              position: "a1",
              due_date: null,
              assignee_id: MEMBER_ALEX,
            },
            {
              id: "55555555-5555-4555-8555-555555555513",
              title: "Audit token revocation on suspicious IP shift",
              is_completed: false,
              position: "a2",
              due_date: null,
              assignee_id: MEMBER_SAMIR,
            },
          ],
        },
      ],
      comments: [],
      attachments: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddd0003",
          name: "RFC 7636 — OAuth PKCE Spec",
          url: "https://datatracker.ietf.org/doc/html/rfc7636",
          type: "link",
          created_at: "2026-11-06T12:00:00.000Z",
        },
      ],
      updated_at: "2026-11-08T10:05:00.000Z",
    },
    {
      id: CARD_6_ID,
      board_id: SEED_BOARD_ID,
      column_id: COL_REVIEW_ID,
      title: "Trello Card Back Modal, Cover Picker & Expandable Labels",
      description:
        "Full 2-column Trello modal with customizable card covers (normal strip vs full card tint), expandable color label pills across all cards, and inline card composer.",
      position: "a1",
      priority: "MEDIUM",
      story_points: 3,
      tags: ["design-system", "trello-ux", "a11y"],
      subtasks: [
        {
          id: "55555555-5555-4555-8555-555555555514",
          title: "Animate label pill text toggle across all board cards",
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
      start_date: "2026-11-06T00:00:00.000Z",
      due_date: "2026-11-13T00:00:00.000Z",
      is_due_complete: true,
      is_archived: false,
      is_watching: false,
      cover: {
        type: "color",
        value: "#ec4899",
        size: "full",
      },
      label_ids: [LABEL_GREEN, LABEL_PURPLE],
      member_ids: [MEMBER_MAYA, MEMBER_ELENA],
      checklists: [
        {
          id: "99999999-9999-4999-8999-999999999906",
          title: "UX Polish & Craftsmanship",
          position: "a0",
          items: [
            {
              id: "55555555-5555-4555-8555-555555555514",
              title: "Animate label pill text toggle across all board cards",
              is_completed: true,
              position: "a0",
              due_date: null,
              assignee_id: MEMBER_MAYA,
            },
            {
              id: "55555555-5555-4555-8555-555555555515",
              title: "Build Calendar/Due Date view & Archived Items drawer",
              is_completed: true,
              position: "a1",
              due_date: null,
              assignee_id: MEMBER_ELENA,
            },
          ],
        },
      ],
      comments: [],
      attachments: [],
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
      start_date: "2026-11-01T00:00:00.000Z",
      due_date: "2026-11-06T00:00:00.000Z", // Overdue so Red badge displays!
      is_due_complete: false,
      is_archived: false,
      is_watching: true,
      cover: {
        type: "color",
        value: "#ef4444",
        size: "normal",
      },
      label_ids: [LABEL_RED, LABEL_BLUE],
      member_ids: [MEMBER_ELENA, MEMBER_SAMIR],
      checklists: [
        {
          id: "99999999-9999-4999-8999-999999999907",
          title: "Infrastructure Provisioning",
          position: "a0",
          items: [
            {
              id: "55555555-5555-4555-8555-555555555516",
              title: "Provision read replica pool in Drizzle connection manager",
              is_completed: false,
              position: "a0",
              due_date: null,
              assignee_id: MEMBER_ELENA,
            },
          ],
        },
      ],
      comments: [
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccc0005",
          card_id: CARD_7_ID,
          author_id: MEMBER_SAMIR,
          author_name: "Samir Patel",
          author_initials: "SP",
          content:
            "Blocked until the Redis Pub/Sub bridge in `CARD_3` finishes multi-tab convergence tests.",
          created_at: "2026-11-08T10:14:00.000Z",
          updated_at: "2026-11-08T10:14:00.000Z",
        },
      ],
      attachments: [],
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
      start_date: null,
      due_date: "2026-11-20T00:00:00.000Z",
      is_due_complete: false,
      is_archived: false,
      is_watching: false,
      cover: {
        type: "color",
        value: "#f59e0b",
        size: "normal",
      },
      label_ids: [LABEL_YELLOW, LABEL_RED],
      member_ids: [MEMBER_ALEX],
      checklists: [],
      comments: [],
      attachments: [],
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
      start_date: null,
      due_date: "2026-11-25T00:00:00.000Z",
      is_due_complete: false,
      is_archived: false,
      is_watching: false,
      cover: {
        type: "none",
        value: null,
        size: "normal",
      },
      label_ids: [LABEL_ORANGE],
      member_ids: [MEMBER_MAYA, MEMBER_SAMIR],
      checklists: [],
      comments: [],
      attachments: [],
      updated_at: "2026-11-08T10:25:00.000Z",
    },
  ],
  activities: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001",
      board_id: SEED_BOARD_ID,
      card_id: CARD_1_ID,
      actor_name: "Alex Rivera",
      action_type: "CHECKLIST_COMPLETED",
      description:
        "completed Algorithm Implementation on Lexicographical O(1) Fractional Indexing Engine",
      created_at: "2026-11-07T14:25:00.000Z",
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0002",
      board_id: SEED_BOARD_ID,
      card_id: CARD_3_ID,
      actor_name: "Elena Rostova",
      action_type: "COMMENT_ADDED",
      description:
        "commented on Real-Time WebSocket Broadcast & Redis Pub/Sub Bridge",
      created_at: "2026-11-08T09:30:00.000Z",
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0003",
      board_id: SEED_BOARD_ID,
      card_id: CARD_4_ID,
      actor_name: "Maya Lin",
      action_type: "CARD_MOVED",
      description:
        "moved AI Smart Card Enrichment & Multi-Checklist Synthesis to In Progress",
      created_at: "2026-11-08T10:00:00.000Z",
    },
  ],
};

const STORAGE_KEY = "kinetix_mock_board_v2";

export function syncSubtasksAndChecklists(
  subtasks?: Subtask[],
  checklists?: Checklist[]
): { subtasks: Subtask[]; checklists: Checklist[] } {
  const safeChecklists = checklists ? [...checklists] : [];
  const safeSubtasks = subtasks ? [...subtasks] : [];

  if (safeChecklists.length > 0) {
    // Flatten all checklist items into subtasks so legacy/contract subtasks stay 100% synced
    const flattened: Subtask[] = [];
    let lastPos: string | undefined;
    for (const cl of safeChecklists) {
      const sortedItems = [...cl.items].sort((a, b) =>
        comparePositions(a.position, b.position)
      );
      for (const item of sortedItems) {
        const pos = generatePositionBetween(lastPos, undefined);
        lastPos = pos;
        flattened.push({
          id: item.id,
          title: item.title,
          is_completed: item.is_completed,
          position: pos,
        });
      }
    }
    return {
      subtasks: flattened,
      checklists: safeChecklists.map((cl) => ({
        ...cl,
        items: [...cl.items].sort((a, b) =>
          comparePositions(a.position, b.position)
        ),
      })),
    };
  }

  if (safeSubtasks.length > 0 && safeChecklists.length === 0) {
    return {
      subtasks: safeSubtasks,
      checklists: [
        {
          id: createDeterministicUuid(),
          title: "Checklist",
          position: "a0",
          items: safeSubtasks.map((s) => ({
            id: s.id,
            title: s.title,
            is_completed: s.is_completed,
            position: s.position,
            due_date: null,
            assignee_id: null,
          })),
        },
      ],
    };
  }

  return { subtasks: [], checklists: [] };
}

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
        checklists: [...(card.checklists ?? [])]
          .map((cl) => ({
            ...cl,
            items: [...cl.items].sort((a, b) =>
              comparePositions(a.position, b.position)
            ),
          }))
          .sort((a, b) => comparePositions(a.position, b.position)),
      }))
      .sort((a, b) => comparePositions(a.position, b.position)),
    activities: [...(board.activities ?? [])].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
  };
}

/**
 * Contextual AI Card Enrichment & Task Decomposer for Mock Mode.
 * Generates structured description, suggested labels, multiple named checklists, story points, and priority.
 */
function synthesizeAICardEnrichment(
  card: Card,
  board: Board
): {
  description: string;
  checklists: Checklist[];
  subtasks: Subtask[];
  label_ids: string[];
  story_points: number;
  priority: Priority;
} {
  const text = `${card.title} ${card.description}`.toLowerCase();

  let implItems: string[] = [];
  let qaItems: string[] = [];
  let points = card.story_points ?? 5;
  let priority: Priority = card.priority;
  let objective = `Deliver production-ready implementation for **${card.title}** with full contract validation and zero-latency UX.`;

  if (text.includes("oauth") || text.includes("auth") || text.includes("pkce")) {
    objective =
      "Implement RFC 7636 OAuth2 PKCE authentication flow with S256 challenge verification and automatic HttpOnly session rotation.";
    implItems = [
      "Register OAuth2 client credentials and callback redirect URIs",
      "Implement cryptographic PKCE code_verifier & S256 code_challenge",
      "Build token exchange endpoint with refresh token rotation",
    ];
    qaItems = [
      "Verify state parameter CSRF protection",
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
    objective =
      "Scale board read throughput via regional PostgreSQL read replicas and sub-25ms Redis Pub/Sub cache invalidation.";
    implItems = [
      "Configure Drizzle read/write connection pool routing",
      "Implement Redis Pub/Sub cache invalidation on card mutations",
      "Add replica lag health probe and automatic primary failover",
    ];
    qaItems = [
      "Benchmark p99 board load latency under 500 concurrent connections",
      "Verify consistency fallback when replica lag exceeds 150ms",
    ];
    points = 8;
    priority = "URGENT";
  } else if (
    text.includes("blocker") ||
    text.includes("dependency") ||
    text.includes("radar")
  ) {
    objective =
      "Provide real-time dependency graph awareness so upstream blockers are surfaced immediately on card fronts and modals.";
    implItems = [
      "Build cycle-detection graph validator for blocked_by_card_ids",
      "Render red Blocker Radar badge on Kanban cards and Table rows",
      "Add one-click dependency linker inside Card Modal",
    ];
    qaItems = [
      "Emit warning indicator when a blocking card is overdue",
      "Verify instant filter toggle in Board Header Bar",
    ];
    points = 5;
    priority = "HIGH";
  } else if (
    text.includes("export") ||
    text.includes("csv") ||
    text.includes("telemetry")
  ) {
    objective =
      "Enable one-click sprint telemetry exports and signed webhook delivery to external analytics pipelines.";
    implItems = [
      "Define CSV column serializer for cards, story points, and cycle timestamps",
      "Stream downloadable export blob directly in browser without memory spikes",
    ];
    qaItems = [
      "Add HMAC-SHA256 signature verification for outbound webhook payloads",
    ];
    points = 3;
    priority = "MEDIUM";
  } else {
    implItems = [
      `Define technical specification and acceptance criteria for "${card.title.slice(0, 42)}"`,
      "Implement core domain logic with strict @kinetix/contracts validation",
      "Wire optimistic UI mutation and real-time WebSocket event broadcast",
    ];
    qaItems = [
      "Verify keyboard accessibility, Light/Dark mode contrast, and build gate",
      "Run end-to-end regression checks across Board, Table, and Calendar views",
    ];
    points = card.story_points ?? 5;
  }

  const structuredDesc = card.description.includes("## Acceptance Criteria")
    ? card.description
    : `${
        card.description ? `${card.description.trim()}\n\n` : ""
      }## AI Technical Summary\n${objective}\n\n## Acceptance Criteria\n- Validated against \`@kinetix/contracts\` Zod schemas\n- Optimistic UI updates with sub-25ms perceived latency\n- Full Light & Dark mode visual parity`;

  const existingChecklists = [...(card.checklists ?? [])];
  const lastChecklistPos =
    existingChecklists.length > 0
      ? existingChecklists[existingChecklists.length - 1].position
      : undefined;

  const pos1 = generatePositionBetween(lastChecklistPos, undefined);
  const pos2 = generatePositionBetween(pos1, undefined);

  const aiImplChecklist: Checklist = {
    id: createDeterministicUuid(),
    title: "AI Implementation Steps",
    position: pos1,
    items: implItems.map((title, idx) => ({
      id: createDeterministicUuid(),
      title,
      is_completed: false,
      position: `a${idx}`,
      due_date: null,
      assignee_id: card.member_ids[0] ?? null,
    })),
  };

  const aiQaChecklist: Checklist = {
    id: createDeterministicUuid(),
    title: "QA & Verification Checklist",
    position: pos2,
    items: qaItems.map((title, idx) => ({
      id: createDeterministicUuid(),
      title,
      is_completed: false,
      position: `a${idx}`,
      due_date: null,
      assignee_id: null,
    })),
  };

  const mergedChecklists = [
    ...existingChecklists,
    aiImplChecklist,
    aiQaChecklist,
  ];
  const synced = syncSubtasksAndChecklists(undefined, mergedChecklists);

  // Add AI Assisted (purple) label if present on board
  const aiLabel = board.labels.find(
    (l) => l.color === "purple" || l.name.toLowerCase().includes("ai")
  );
  const nextLabelIds = aiLabel
    ? Array.from(new Set([...card.label_ids, aiLabel.id]))
    : card.label_ids;

  return {
    description: structuredDesc,
    checklists: synced.checklists,
    subtasks: synced.subtasks,
    label_ids: nextLabelIds,
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

  private createActivity(
    board: Board,
    action_type: Activity["action_type"],
    description: string,
    card_id: string | null = null,
    actor_name = "Alex Rivera"
  ): Activity {
    return {
      id: createDeterministicUuid(),
      board_id: board.id,
      card_id,
      actor_name,
      action_type,
      description,
      created_at: new Date().toISOString(),
    };
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
      description: payload.description ?? "",
      is_starred: payload.is_starred ?? false,
      background: payload.background ?? {
        type: "solid",
        value: "adaptive-default",
      },
      created_at: new Date().toISOString(),
      labels: DEFAULT_BOARD_LABELS.map((l) => ({
        ...l,
        board_id: boardId,
      })),
      members: DEFAULT_BOARD_MEMBERS.map((m) => ({ ...m })),
      activities: [],
      columns: [
        {
          id: createDeterministicUuid(),
          board_id: boardId,
          title: "Backlog",
          position: "a0",
          wip_limit: null,
          color: "#64748b",
          is_archived: false,
        },
        {
          id: createDeterministicUuid(),
          board_id: boardId,
          title: "In Progress",
          position: "a1",
          wip_limit: 5,
          color: "#3b82f6",
          is_archived: false,
        },
        {
          id: createDeterministicUuid(),
          board_id: boardId,
          title: "Review",
          position: "a2",
          wip_limit: null,
          color: "#8b5cf6",
          is_archived: false,
        },
        {
          id: createDeterministicUuid(),
          board_id: boardId,
          title: "Done",
          position: "a3",
          wip_limit: null,
          color: "#10b981",
          is_archived: false,
        },
      ],
      cards: [],
    };
    return this.saveState(nextBoard);
  }

  async updateBoard(
    _boardId: string,
    payload: UpdateBoardRequest
  ): Promise<Board> {
    const board = this.loadState();
    const nextBoard: Board = {
      ...board,
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.is_starred !== undefined
        ? { is_starred: payload.is_starred }
        : {}),
      ...(payload.background !== undefined
        ? { background: payload.background }
        : {}),
      ...(payload.labels !== undefined ? { labels: payload.labels } : {}),
      ...(payload.members !== undefined ? { members: payload.members } : {}),
    };
    return this.saveState(nextBoard);
  }

  async createColumn(
    _boardId: string,
    payload: CreateColumnRequest
  ): Promise<Column> {
    const board = this.loadState();
    const newCol: Column = ColumnSchema.parse({
      id: createDeterministicUuid(),
      board_id: board.id,
      title: payload.title,
      position: payload.position,
      wip_limit: payload.wip_limit ?? null,
      color: payload.color ?? null,
      is_archived: false,
    });
    this.saveState({
      ...board,
      columns: [...board.columns, newCol],
    });
    return newCol;
  }

  async updateColumn(
    columnId: string,
    payload: UpdateColumnRequest
  ): Promise<Column> {
    const board = this.loadState();
    const existing = board.columns.find((c) => c.id === columnId);
    if (!existing) {
      throw new Error(`Column ${columnId} not found`);
    }
    const updated: Column = ColumnSchema.parse({
      ...existing,
      ...payload,
    });
    this.saveState({
      ...board,
      columns: board.columns.map((c) => (c.id === columnId ? updated : c)),
    });
    return updated;
  }

  async moveColumn(
    columnId: string,
    payload: MoveColumnRequest
  ): Promise<Column> {
    const board = this.loadState();
    const existing = board.columns.find((c) => c.id === columnId);
    if (!existing) {
      throw new Error(`Column ${columnId} not found`);
    }
    const updated: Column = ColumnSchema.parse({
      ...existing,
      position: payload.new_position,
    });
    this.saveState({
      ...board,
      columns: board.columns.map((c) => (c.id === columnId ? updated : c)),
    });
    return updated;
  }

  async copyColumn(
    columnId: string,
    payload?: CopyColumnRequest
  ): Promise<CopyColumnResponse> {
    const board = this.loadState();
    const sourceCol = board.columns.find((c) => c.id === columnId);
    if (!sourceCol) {
      throw new Error(`Column ${columnId} not found`);
    }

    const sortedCols = [...board.columns].sort((a, b) =>
      comparePositions(a.position, b.position)
    );
    const sourceIdx = sortedCols.findIndex((c) => c.id === columnId);
    const nextColPos = sortedCols[sourceIdx + 1]?.position;
    const computedPos =
      payload?.position ??
      generatePositionBetween(sourceCol.position, nextColPos);

    const newCol: Column = ColumnSchema.parse({
      id: createDeterministicUuid(),
      board_id: board.id,
      title: payload?.title?.trim() || `${sourceCol.title} (Copy)`,
      position: computedPos,
      wip_limit: sourceCol.wip_limit,
      color: sourceCol.color,
      is_archived: false,
    });

    const sourceCards = board.cards
      .filter((c) => c.column_id === columnId && !c.is_archived)
      .sort((a, b) => comparePositions(a.position, b.position));

    const copiedCards: Card[] = sourceCards.map((c) =>
      CardSchema.parse({
        ...c,
        id: createDeterministicUuid(),
        column_id: newCol.id,
        checklists: c.checklists.map((cl) => ({
          ...cl,
          id: createDeterministicUuid(),
          items: cl.items.map((item) => ({
            ...item,
            id: createDeterministicUuid(),
          })),
        })),
        subtasks: c.subtasks.map((s) => ({
          ...s,
          id: createDeterministicUuid(),
        })),
        comments: [],
        updated_at: new Date().toISOString(),
      })
    );

    this.saveState({
      ...board,
      columns: [...board.columns, newCol],
      cards: [...board.cards, ...copiedCards],
    });

    return {
      column: newCol,
      cards: copiedCards,
    };
  }

  async createCard(_boardId: string, payload: CreateCardRequest): Promise<Card> {
    const board = this.loadState();
    const synced = syncSubtasksAndChecklists(
      payload.subtasks,
      payload.checklists
    );
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
      subtasks: synced.subtasks,
      blocked_by_card_ids: payload.blocked_by_card_ids ?? [],
      due_date: payload.due_date ?? null,
      cover: payload.cover ?? { type: "none", value: null, size: "normal" },
      label_ids: payload.label_ids ?? [],
      member_ids: payload.member_ids ?? [],
      checklists: synced.checklists,
      comments: payload.comments ?? [],
      attachments: payload.attachments ?? [],
      start_date: payload.start_date ?? null,
      is_due_complete: payload.is_due_complete ?? false,
      is_archived: payload.is_archived ?? false,
      is_watching: payload.is_watching ?? false,
      updated_at: new Date().toISOString(),
    });

    const col = board.columns.find((c) => c.id === payload.column_id);
    const activity = this.createActivity(
      board,
      "CARD_CREATED",
      `added "${newCard.title}" to ${col?.title ?? "board"}`,
      newCard.id
    );

    this.saveState({
      ...board,
      cards: [...board.cards, newCard],
      activities: [activity, ...board.activities],
    });
    return newCard;
  }

  async updateCard(cardId: string, payload: UpdateCardRequest): Promise<Card> {
    const board = this.loadState();
    const existing = board.cards.find((c) => c.id === cardId);
    if (!existing) {
      throw new Error(`Card ${cardId} not found`);
    }

    let nextSubtasks = payload.subtasks ?? existing.subtasks;
    let nextChecklists = payload.checklists ?? existing.checklists;

    if (payload.checklists !== undefined) {
      const synced = syncSubtasksAndChecklists(undefined, payload.checklists);
      nextSubtasks = synced.subtasks;
      nextChecklists = synced.checklists;
    } else if (payload.subtasks !== undefined) {
      const synced = syncSubtasksAndChecklists(payload.subtasks, undefined);
      nextSubtasks = synced.subtasks;
      nextChecklists = synced.checklists;
    }

    const updated: Card = CardSchema.parse({
      ...existing,
      ...payload,
      subtasks: nextSubtasks,
      checklists: nextChecklists,
      updated_at: new Date().toISOString(),
    });

    const nextActivities = [...board.activities];
    if (payload.is_archived === true && !existing.is_archived) {
      nextActivities.unshift(
        this.createActivity(
          board,
          "CARD_ARCHIVED",
          `archived "${updated.title}"`,
          updated.id
        )
      );
    }

    this.saveState({
      ...board,
      cards: board.cards.map((c) => (c.id === cardId ? updated : c)),
      activities: nextActivities,
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

    const nextActivities = [...board.activities];
    if (existing.column_id !== payload.target_column_id) {
      const sourceCol = board.columns.find((c) => c.id === existing.column_id);
      const targetCol = board.columns.find(
        (c) => c.id === payload.target_column_id
      );
      nextActivities.unshift(
        this.createActivity(
          board,
          "CARD_MOVED",
          `moved "${updated.title}" from ${sourceCol?.title ?? "list"} to ${targetCol?.title ?? "list"}`,
          updated.id
        )
      );
    }

    this.saveState({
      ...board,
      cards: board.cards.map((c) => (c.id === cardId ? updated : c)),
      activities: nextActivities,
    });
    return updated;
  }

  async copyCard(cardId: string, payload?: CopyCardRequest): Promise<Card> {
    const board = this.loadState();
    const existing = board.cards.find((c) => c.id === cardId);
    if (!existing) {
      throw new Error(`Card ${cardId} not found`);
    }

    const targetColId = payload?.target_column_id ?? existing.column_id;
    const colCards = board.cards
      .filter((c) => c.column_id === targetColId && !c.is_archived)
      .sort((a, b) => comparePositions(a.position, b.position));
    const lastPos =
      colCards.length > 0 ? colCards[colCards.length - 1].position : undefined;
    const computedPos =
      payload?.position ?? generatePositionBetween(lastPos, undefined);

    const keepChecklists = payload?.keep_checklists ?? true;
    const keepLabels = payload?.keep_labels ?? true;
    const keepMembers = payload?.keep_members ?? true;
    const keepAttachments = payload?.keep_attachments ?? true;

    const checklists = keepChecklists
      ? existing.checklists.map((cl) => ({
          ...cl,
          id: createDeterministicUuid(),
          items: cl.items.map((item) => ({
            ...item,
            id: createDeterministicUuid(),
          })),
        }))
      : [];
    const synced = syncSubtasksAndChecklists(undefined, checklists);

    const copied: Card = CardSchema.parse({
      ...existing,
      id: createDeterministicUuid(),
      column_id: targetColId,
      title: payload?.title?.trim() || `${existing.title} (Copy)`,
      position: computedPos,
      checklists: synced.checklists,
      subtasks: synced.subtasks,
      label_ids: keepLabels ? [...existing.label_ids] : [],
      member_ids: keepMembers ? [...existing.member_ids] : [],
      attachments: keepAttachments
        ? existing.attachments.map((a) => ({
            ...a,
            id: createDeterministicUuid(),
          }))
        : [],
      comments: [],
      is_archived: false,
      updated_at: new Date().toISOString(),
    });

    const targetCol = board.columns.find((c) => c.id === targetColId);
    const activity = this.createActivity(
      board,
      "CARD_CREATED",
      `copied "${existing.title}" to "${copied.title}" in ${targetCol?.title ?? "list"}`,
      copied.id
    );

    this.saveState({
      ...board,
      cards: [...board.cards, copied],
      activities: [activity, ...board.activities],
    });
    return copied;
  }

  async deleteCard(cardId: string): Promise<{ id: string; deleted: boolean }> {
    const board = this.loadState();
    this.saveState({
      ...board,
      cards: board.cards.filter((c) => c.id !== cardId),
    });
    return { id: cardId, deleted: true };
  }

  async addComment(
    cardId: string,
    payload: CreateCommentRequest
  ): Promise<Comment> {
    const board = this.loadState();
    const existing = board.cards.find((c) => c.id === cardId);
    if (!existing) {
      throw new Error(`Card ${cardId} not found`);
    }

    const now = new Date().toISOString();
    const comment: Comment = CommentSchema.parse({
      id: createDeterministicUuid(),
      card_id: cardId,
      author_id: payload.author_id ?? MEMBER_ALEX,
      author_name: payload.author_name ?? "Alex Rivera",
      author_initials: payload.author_initials ?? "AR",
      content: payload.content,
      created_at: now,
      updated_at: now,
    });

    const updatedCard: Card = CardSchema.parse({
      ...existing,
      comments: [...existing.comments, comment],
      updated_at: now,
    });

    const activity = this.createActivity(
      board,
      "COMMENT_ADDED",
      `commented on "${existing.title}": ${comment.content.slice(0, 60)}`,
      cardId,
      comment.author_name
    );

    this.saveState({
      ...board,
      cards: board.cards.map((c) => (c.id === cardId ? updatedCard : c)),
      activities: [activity, ...board.activities],
    });

    return comment;
  }

  async deleteComment(
    cardId: string,
    commentId: string
  ): Promise<{ id: string; deleted: boolean }> {
    const board = this.loadState();
    const existing = board.cards.find((c) => c.id === cardId);
    if (!existing) {
      throw new Error(`Card ${cardId} not found`);
    }

    const updatedCard: Card = CardSchema.parse({
      ...existing,
      comments: existing.comments.filter((cm) => cm.id !== commentId),
      updated_at: new Date().toISOString(),
    });

    this.saveState({
      ...board,
      cards: board.cards.map((c) => (c.id === cardId ? updatedCard : c)),
    });

    return { id: commentId, deleted: true };
  }

  async aiDecomposeCard(cardId: string): Promise<Card> {
    // Simulate realistic AI thinking latency (600ms) for shimmer UX
    await new Promise((resolve) => setTimeout(resolve, 600));
    const board = this.loadState();
    const existing = board.cards.find((c) => c.id === cardId);
    if (!existing) {
      throw new Error(`Card ${cardId} not found`);
    }

    const aiResult = synthesizeAICardEnrichment(existing, board);
    const updated: Card = CardSchema.parse({
      ...existing,
      description: aiResult.description,
      checklists: aiResult.checklists,
      subtasks: aiResult.subtasks,
      label_ids: aiResult.label_ids,
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
