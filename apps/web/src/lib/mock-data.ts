import {
  Activity,
  AIAnalyticsReport,
  AIAnalyticsReportSchema,
  AIParseAutomationResponse,
  AIPermissionAuditResponse,
  AISummaryNotificationResponse,
  AuthSessionResponse,
  AuthUser,
  AutomationAction,
  AutomationRule,
  AutomationTrigger,
  Board,
  BoardAnalytics,
  BoardAnalyticsSchema,
  BoardExportCsvResponse,
  BoardExportCsvResponseSchema,
  BoardInviteLink,
  BoardRole,
  BoardSchema,
  BoardSummary,
  BoardTemplate,
  BurndownDataPoint,
  Card,
  CardSchema,
  Checklist,
  Column,
  ColumnMetric,
  ColumnSchema,
  Comment,
  CommentSchema,
  CopyCardRequest,
  CopyColumnRequest,
  CopyColumnResponse,
  CreateAutomationRuleRequest,
  CreateBoardRequest,
  CreateCardRequest,
  CreateColumnRequest,
  CreateCommentRequest,
  CreateInviteLinkRequest,
  CreateWebhookRequest,
  CreateWorkspaceRequest,
  DEFAULT_BOARD_AUTOMATION_RULES,
  DEFAULT_BOARD_COLUMNS,
  DEFAULT_BOARD_LABELS,
  DEFAULT_BOARD_MEMBERS,
  DEFAULT_BOARD_TEMPLATES,
  DEFAULT_WORKSPACE,
  JoinViaInviteRequest,
  JoinViaInviteResponse,
  Label,
  LabelColor,
  LabelColorEnum,
  LabelMetric,
  LoginRequest,
  Member,
  MemberWorkload,
  MoveCardRequest,
  MoveColumnRequest,
  Priority,
  PriorityMetric,
  RegisterRequest,
  SprintHealthStatus,
  Subtask,
  TestWebhookResponse,
  TrelloImportRequest,
  TrelloImportResult,
  TrelloImportResultSchema,
  UpdateAutomationRuleRequest,
  UpdateBoardRequest,
  UpdateCardRequest,
  UpdateColumnRequest,
  UpdateWebhookRequest,
  UserPresence,
  WebhookConfig,
  Workspace,
  WorkspaceWithBoards,
  AICriticalPathResponse,
  AICriticalPathResponseSchema,
  AddCardDependencyRequest,
  AddCardDependencyResponse,
  BoardDependencyGraph,
  BoardDependencyGraphSchema,
  BoardThemeConfig,
  BoardThemeConfigSchema,
  CardCustomFieldValue,
  CreateCustomFieldDefinitionRequest,
  CustomFieldDefinition,
  CustomFieldDefinitionSchema,
  CustomFieldOption,
  CustomFieldType,
  DEFAULT_THEME_CONFIG,
  DependencyEdge,
  DependencyEdgeSchema,
  DependencyNode,
  DependencyNodeSchema,
  ThemePreset,
  ThemePresetEnum,
  THEME_PRESET_CONFIGS,
  UpdateBoardThemeRequest,
  UpdateCustomFieldDefinitionRequest,
} from "@kinetix/contracts";
import { comparePositions, generatePositionBetween } from "./fractional-index";

export const SEED_BOARD_ID = "11111111-1111-4111-8111-111111111111";
export const SEED_BOARD_SPRINT_ID = "11111111-1111-4111-8111-111111111112";
export const SEED_BOARD_MARKETING_ID = "11111111-1111-4111-8111-111111111113";
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

export const DEMO_USERS: AuthUser[] = [
  {
    id: "88888888-8888-4888-8888-888888888881",
    name: "Alex Rivera",
    email: "alex@kinetix.dev",
    avatar_url: null,
    initials: "AR",
    color: "#6366f1",
    default_role: "ADMIN",
  },
  {
    id: "88888888-8888-4888-8888-888888888882",
    name: "Sarah Connor",
    email: "sarah@kinetix.dev",
    avatar_url: null,
    initials: "SC",
    color: "#10b981",
    default_role: "EDITOR",
  },
  {
    id: "88888888-8888-4888-8888-888888888884",
    name: "Budi Santoso",
    email: "budi@kinetix.dev",
    avatar_url: null,
    initials: "BS",
    color: "#f59e0b",
    default_role: "VIEWER",
  },
];

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

export function cloneDefaultAutomationRules(
  boardId = SEED_BOARD_ID
): AutomationRule[] {
  return DEFAULT_BOARD_AUTOMATION_RULES.map((r) => ({
    id: r.id,
    board_id: boardId,
    name: r.name,
    description: r.description,
    is_enabled: r.is_enabled,
    trigger: {
      type: r.trigger.type,
      column_id: r.trigger.column_id,
      column_title_match: r.trigger.column_title_match,
      priority: r.trigger.priority,
      label_id: r.trigger.label_id,
    },
    actions: r.actions.map((a) => ({
      type: a.type,
      due_complete_value: a.due_complete_value,
      member_id: a.member_id,
      label_id: a.label_id,
      priority: a.priority,
      target_column_id: a.target_column_id,
      checklist_title: a.checklist_title,
      checklist_items: a.checklist_items ? [...a.checklist_items] : null,
      comment_text: a.comment_text,
    })),
    execution_count: r.execution_count,
    last_triggered_at: r.last_triggered_at,
    created_at: r.created_at,
  }));
}

export const DEFAULT_BOARD_WEBHOOKS: WebhookConfig[] = [
  {
    id: "99999999-9999-4999-8999-999999999991",
    board_id: SEED_BOARD_ID,
    name: "Engineering #sprint-updates",
    platform: "SLACK",
    url: "https://hooks.slack.example.com/services/sample-token",
    is_enabled: true,
    subscribed_events: [
      "CARD_CREATED",
      "CARD_MOVED",
      "COMMENT_ADDED",
      "AUTOMATION_TRIGGERED",
    ],
    created_at: "2026-11-08T08:30:00.000Z",
  },
  {
    id: "99999999-9999-4999-8999-999999999992",
    board_id: SEED_BOARD_ID,
    name: "Product & Dev Feed",
    platform: "DISCORD",
    url: "https://discord.example.com/api/webhooks/sample-token",
    is_enabled: true,
    subscribed_events: ["CARD_CREATED", "CARD_MOVED", "CARD_ARCHIVED"],
    created_at: "2026-11-08T09:00:00.000Z",
  },
];


export function createDefaultCustomFields(boardId: string): CustomFieldDefinition[] {
  return [
    {
      id: `cf-env-${boardId}`,
      board_id: boardId,
      name: "Environment",
      type: "DROPDOWN",
      options: [
        { id: `opt-env-prod-${boardId}`, label: "Production", color: "red" },
        { id: `opt-env-staging-${boardId}`, label: "Staging", color: "yellow" },
        { id: `opt-env-dev-${boardId}`, label: "Dev", color: "blue" },
      ],
      show_on_front: true,
      position: "a0",
      created_at: "2026-11-08T08:00:00.000Z",
    },
    {
      id: `cf-esthours-${boardId}`,
      board_id: boardId,
      name: "Est. Hours",
      type: "NUMBER",
      options: [],
      show_on_front: true,
      position: "a1",
      created_at: "2026-11-08T08:00:00.000Z",
    },
    {
      id: `cf-qa-${boardId}`,
      board_id: boardId,
      name: "QA Verified",
      type: "CHECKBOX",
      options: [],
      show_on_front: true,
      position: "a2",
      created_at: "2026-11-08T08:00:00.000Z",
    },
  ];
}

export function computeBoardDependencyGraph(board: Board): BoardDependencyGraph {
  const cards = board.cards.filter((c) => !c.is_archived);
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const colMap = new Map(board.columns.map((col) => [col.id, col]));

  const doneColIds = new Set(
    board.columns
      .filter((col) => {
        const lower = col.title.toLowerCase();
        return (
          lower.includes("done") ||
          lower.includes("shipped") ||
          lower.includes("complete") ||
          col.position === "a3"
        );
      })
      .map((col) => col.id)
  );

  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  cards.forEach((c) => {
    inDegree.set(c.id, 0);
    outDegree.set(c.id, 0);
  });

  const rawEdges: Array<{ from_card_id: string; to_card_id: string; is_resolved: boolean }> = [];

  for (const card of cards) {
    for (const blockerId of card.blocked_by_card_ids) {
      if (cardMap.has(blockerId)) {
        const blockerCard = cardMap.get(blockerId)!;
        const isResolved = Boolean(blockerCard.is_due_complete || doneColIds.has(blockerCard.column_id));
        rawEdges.push({
          from_card_id: blockerId,
          to_card_id: card.id,
          is_resolved: isResolved,
        });
        inDegree.set(card.id, (inDegree.get(card.id) ?? 0) + 1);
        outDegree.set(blockerId, (outDegree.get(blockerId) ?? 0) + 1);
      }
    }
  }

  const adj = new Map<string, string[]>();
  cards.forEach((c) => adj.set(c.id, []));
  rawEdges.forEach((e) => adj.get(e.from_card_id)?.push(e.to_card_id));

  let hasCycle = false;
  const visited = new Map<string, number>();
  cards.forEach((c) => visited.set(c.id, 0));

  function dfsCycle(nodeId: string): boolean {
    visited.set(nodeId, 1);
    const neighbors = adj.get(nodeId) ?? [];
    for (const n of neighbors) {
      if (visited.get(n) === 1) return true;
      if (visited.get(n) === 0 && dfsCycle(n)) return true;
    }
    visited.set(nodeId, 2);
    return false;
  }

  for (const c of cards) {
    if (visited.get(c.id) === 0) {
      if (dfsCycle(c.id)) {
        hasCycle = true;
        break;
      }
    }
  }

  let criticalPath: string[] = [];
  if (!hasCycle && rawEdges.length > 0) {
    const memo = new Map<string, { dist: number; path: string[] }>();

    function getLongestPath(nodeId: string): { dist: number; path: string[] } {
      if (memo.has(nodeId)) return memo.get(nodeId)!;
      const card = cardMap.get(nodeId);
      const weight = Math.max(card?.story_points ?? 1, 1);
      const neighbors = adj.get(nodeId) ?? [];
      if (neighbors.length === 0) {
        const res = { dist: weight, path: [nodeId] };
        memo.set(nodeId, res);
        return res;
      }
      let bestDist = 0;
      let bestPath: string[] = [];
      for (const n of neighbors) {
        const sub = getLongestPath(n);
        if (sub.dist > bestDist) {
          bestDist = sub.dist;
          bestPath = sub.path;
        }
      }
      const res = { dist: weight + bestDist, path: [nodeId, ...bestPath] };
      memo.set(nodeId, res);
      return res;
    }

    let overallBestDist = 0;
    for (const c of cards) {
      if ((outDegree.get(c.id) ?? 0) > 0) {
        const p = getLongestPath(c.id);
        if (p.path.length > 1 && p.dist > overallBestDist) {
          overallBestDist = p.dist;
          criticalPath = p.path;
        }
      }
    }
  }

  const criticalPathSet = new Set(criticalPath);
  const criticalEdgesSet = new Set<string>();
  for (let i = 0; i < criticalPath.length - 1; i++) {
    criticalEdgesSet.add(`${criticalPath[i]}->${criticalPath[i + 1]}`);
  }

  const nodes: DependencyNode[] = cards.map((c) => {
    const col = colMap.get(c.column_id);
    const isCompleted = Boolean(c.is_due_complete || doneColIds.has(c.column_id));
    const assignees = (c.member_ids ?? [])
      .map((mId) => board.members.find((m) => m.id === mId)?.initials)
      .filter((init): init is string => Boolean(init));

    return {
      card_id: c.id,
      title: c.title,
      column_id: c.column_id,
      column_title: col?.title ?? "Column",
      priority: c.priority,
      story_points: c.story_points,
      is_completed: isCompleted,
      assignee_initials: assignees,
      in_degree: inDegree.get(c.id) ?? 0,
      out_degree: outDegree.get(c.id) ?? 0,
      is_on_critical_path: criticalPathSet.has(c.id),
    };
  });

  const edges: DependencyEdge[] = rawEdges.map((e) => ({
    from_card_id: e.from_card_id,
    to_card_id: e.to_card_id,
    is_resolved: e.is_resolved,
    is_critical: criticalEdgesSet.has(`${e.from_card_id}->${e.to_card_id}`),
  }));

  const blockedCardIds = new Set(
    rawEdges.filter((e) => !e.is_resolved).map((e) => e.to_card_id)
  );

  return {
    board_id: board.id,
    nodes,
    edges,
    critical_path_card_ids: criticalPath,
    total_blocked_cards: blockedCardIds.size,
    has_circular_dependency: hasCycle,
  };
}

export function detectCycleIfAdded(
  board: Board,
  targetCardId: string,
  blockerCardId: string
): { hasCycle: boolean; cyclePath?: string[] } {
  if (targetCardId === blockerCardId) {
    return { hasCycle: true, cyclePath: [targetCardId, blockerCardId] };
  }
  const cards = board.cards.filter((c) => !c.is_archived);
  const adj = new Map<string, string[]>();
  cards.forEach((c) => adj.set(c.id, []));
  cards.forEach((c) => {
    c.blocked_by_card_ids.forEach((bId) => {
      adj.get(bId)?.push(c.id);
    });
  });

  const visited = new Set<string>();
  const parent = new Map<string, string>();

  function dfs(curr: string): boolean {
    visited.add(curr);
    if (curr === blockerCardId) return true;
    for (const next of adj.get(curr) ?? []) {
      if (!visited.has(next)) {
        parent.set(next, curr);
        if (dfs(next)) return true;
      }
    }
    return false;
  }

  if (dfs(targetCardId)) {
    const path = [blockerCardId];
    let curr = blockerCardId;
    while (curr !== targetCardId && parent.has(curr)) {
      curr = parent.get(curr)!;
      path.unshift(curr);
    }
    path.push(blockerCardId);
    return { hasCycle: true, cyclePath: path };
  }

  return { hasCycle: false };
}

export function generateAICriticalPathAnalysis(
  board: Board,
  graph: BoardDependencyGraph
): AICriticalPathResponse {
  const cardMap = new Map(board.cards.map((c) => [c.id, c]));
  const criticalTitles = graph.critical_path_card_ids
    .map((id) => cardMap.get(id)?.title)
    .filter((t): t is string => Boolean(t));

  const blockerNodes = graph.nodes
    .filter((n) => n.out_degree > 0)
    .sort((a, b) => b.out_degree - a.out_degree);

  const topBlockers = blockerNodes.slice(0, 3).map((b) => ({
    card_id: b.card_id,
    title: b.title,
    blocks_count: b.out_degree,
    reason: b.is_on_critical_path
      ? `Holds up ${b.out_degree} downstream deliverable(s) directly on the critical release path.`
      : `Holds up ${b.out_degree} dependent task(s) across columns.`,
  }));

  const riskSummary =
    criticalTitles.length > 0
      ? `Critical path contains ${criticalTitles.length} interconnected items spanning ${graph.total_blocked_cards} currently blocked card(s). The primary bottleneck is "${blockerNodes[0]?.title ?? 'Core Architecture'}" which directly impedes multiple team workflows.`
      : `Board dependency network is well-balanced with minimal downstream blocking. Total blocked cards: ${graph.total_blocked_cards}.`;

  const recommendations = [
    topBlockers[0]
      ? `Prioritize immediate completion of "${topBlockers[0].title}" to unblock ${topBlockers[0].blocks_count} downstream deliverable(s).`
      : "Maintain current task velocity; no critical bottlenecks detected.",
    "Pair senior engineers on the critical path sequence to mitigate single-point review delays.",
    "Fast-track code reviews for cards in 'Review & QA' that have unresolved dependencies.",
  ];

  return {
    risk_summary: riskSummary,
    critical_path_titles: criticalTitles,
    top_blocker_cards: topBlockers,
    unblocking_recommendations: recommendations,
  };
}

export const INITIAL_SEED_BOARD: Board = {
  id: SEED_BOARD_ID,
  workspace_id: SEED_WORKSPACE_ID,
  title: "Kanbanify Product Launch",
  description:
    "High-craftsmanship real-time workspace uniting Trello visual fluidity with Linear engineering precision and Butler automations.",
  is_starred: true,
  background: {
    type: "gradient",
    value: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
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
          url: "https://figma.com/file/kanbanify-fractional-index",
          type: "link",
          created_at: "2026-11-06T10:00:00.000Z",
        },
      ],
      custom_field_values: [
        { field_id: `cf-env-${SEED_BOARD_ID}`, value: `opt-env-prod-${SEED_BOARD_ID}` },
        { field_id: `cf-esthours-${SEED_BOARD_ID}`, value: 6 },
        { field_id: `cf-qa-${SEED_BOARD_ID}`, value: true },
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
      custom_field_values: [
        { field_id: `cf-env-${SEED_BOARD_ID}`, value: `opt-env-staging-${SEED_BOARD_ID}` },
        { field_id: `cf-esthours-${SEED_BOARD_ID}`, value: 12 },
        { field_id: `cf-qa-${SEED_BOARD_ID}`, value: true },
      ],
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
        {
          id: "55555555-5555-4555-8555-555555555530",
          title: "Benchmark Redis Pub/Sub p99 broadcast latency (<15ms)",
          is_completed: false,
          position: "a3",
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
            {
              id: "55555555-5555-4555-8555-555555555530",
              title: "Benchmark Redis Pub/Sub p99 broadcast latency (<15ms)",
              is_completed: false,
              position: "a3",
              due_date: null,
              assignee_id: MEMBER_SAMIR,
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
          url: "https://architecture.kanbanify.dev/redis-pubsub",
          type: "link",
          created_at: "2026-11-08T08:30:00.000Z",
        },
      ],
      custom_field_values: [
        { field_id: `cf-env-${SEED_BOARD_ID}`, value: `opt-env-dev-${SEED_BOARD_ID}` },
        { field_id: `cf-esthours-${SEED_BOARD_ID}`, value: 4 },
        { field_id: `cf-qa-${SEED_BOARD_ID}`, value: false },
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
      custom_field_values: [
        { field_id: `cf-env-${SEED_BOARD_ID}`, value: `opt-env-staging-${SEED_BOARD_ID}` },
        { field_id: `cf-esthours-${SEED_BOARD_ID}`, value: 8 },
        { field_id: `cf-qa-${SEED_BOARD_ID}`, value: false },
      ],
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
        {
          id: "55555555-5555-4555-8555-555555555524",
          title: "Add end-to-end CSRF & SameSite=Lax cookie regression tests",
          is_completed: false,
          position: "a3",
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
            {
              id: "55555555-5555-4555-8555-555555555524",
              title: "Add end-to-end CSRF & SameSite=Lax cookie regression tests",
              is_completed: false,
              position: "a3",
              due_date: null,
              assignee_id: MEMBER_ALEX,
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
      custom_field_values: [
        { field_id: `cf-env-${SEED_BOARD_ID}`, value: `opt-env-prod-${SEED_BOARD_ID}` },
        { field_id: `cf-esthours-${SEED_BOARD_ID}`, value: 16 },
        { field_id: `cf-qa-${SEED_BOARD_ID}`, value: false },
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
      custom_field_values: [
        { field_id: `cf-env-${SEED_BOARD_ID}`, value: `opt-env-dev-${SEED_BOARD_ID}` },
        { field_id: `cf-esthours-${SEED_BOARD_ID}`, value: 5 },
        { field_id: `cf-qa-${SEED_BOARD_ID}`, value: true },
      ],
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
      custom_field_values: [
        { field_id: `cf-env-${SEED_BOARD_ID}`, value: `opt-env-staging-${SEED_BOARD_ID}` },
        { field_id: `cf-esthours-${SEED_BOARD_ID}`, value: 10 },
        { field_id: `cf-qa-${SEED_BOARD_ID}`, value: false },
      ],
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
      custom_field_values: [
        { field_id: `cf-env-${SEED_BOARD_ID}`, value: `opt-env-dev-${SEED_BOARD_ID}` },
        { field_id: `cf-esthours-${SEED_BOARD_ID}`, value: 20 },
        { field_id: `cf-qa-${SEED_BOARD_ID}`, value: false },
      ],
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
      custom_field_values: [
        { field_id: `cf-env-${SEED_BOARD_ID}`, value: `opt-env-prod-${SEED_BOARD_ID}` },
        { field_id: `cf-esthours-${SEED_BOARD_ID}`, value: 3 },
        { field_id: `cf-qa-${SEED_BOARD_ID}`, value: true },
      ],
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
      is_automated: false,
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
      is_automated: false,
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
      is_automated: false,
    },
  ],
  automation_rules: cloneDefaultAutomationRules(SEED_BOARD_ID),
  webhooks: DEFAULT_BOARD_WEBHOOKS.map((w) => ({ ...w })),
  invite_links: [
    {
      id: "inv-001",
      board_id: SEED_BOARD_ID,
      token: "kb_inv_8f92a1bc3d4e",
      role: "EDITOR",
      created_by_id: MEMBER_ALEX,
      created_by_name: "Alex Rivera",
      max_uses: 10,
      uses_count: 3,
      expires_at: "2026-11-17T10:00:00.000Z",
      is_active: true,
      created_at: "2026-11-10T10:00:00.000Z",
    },
  ],
  visibility: "WORKSPACE",
  custom_fields: createDefaultCustomFields(SEED_BOARD_ID),
  theme_config: { ...DEFAULT_THEME_CONFIG },
};

export const INITIAL_SPRINT_BOARD: Board = {
  id: SEED_BOARD_SPRINT_ID,
  workspace_id: SEED_WORKSPACE_ID,
  title: "Q4 Engineering Sprint",
  description:
    "Agile 2-week engineering sprint board for high-velocity software delivery",
  is_starred: true,
  background: {
    type: "gradient",
    value: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)",
  },
  created_at: "2026-11-08T08:00:00.000Z",
  labels: DEFAULT_BOARD_LABELS.map((l) => ({
    ...l,
    board_id: SEED_BOARD_SPRINT_ID,
  })),
  members: DEFAULT_BOARD_MEMBERS.map((m) => ({ ...m })),
  columns: [
    {
      id: "33333333-3333-4333-8333-333333333341",
      board_id: SEED_BOARD_SPRINT_ID,
      title: "Backlog",
      position: "a0",
      wip_limit: null,
      color: "#64748b",
      is_archived: false,
    },
    {
      id: "33333333-3333-4333-8333-333333333342",
      board_id: SEED_BOARD_SPRINT_ID,
      title: "In Progress",
      position: "a1",
      wip_limit: 4,
      color: "#3b82f6",
      is_archived: false,
    },
    {
      id: "33333333-3333-4333-8333-333333333343",
      board_id: SEED_BOARD_SPRINT_ID,
      title: "Review",
      position: "a2",
      wip_limit: 3,
      color: "#8b5cf6",
      is_archived: false,
    },
    {
      id: "33333333-3333-4333-8333-333333333344",
      board_id: SEED_BOARD_SPRINT_ID,
      title: "Done",
      position: "a3",
      wip_limit: null,
      color: "#10b981",
      is_archived: false,
    },
  ],
  cards: [
    {
      id: "44444444-4444-4444-8444-444444444501",
      board_id: SEED_BOARD_SPRINT_ID,
      column_id: "33333333-3333-4333-8333-333333333341",
      title: "PostgreSQL Fractional Index Benchmarks",
      description:
        "Measure O(1) single row updates during bursty concurrent drags across 10,000 cards.",
      position: "a0",
      priority: "HIGH",
      story_points: 5,
      tags: ["perf", "db"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-20T12:00:00.000Z",
      cover: { type: "none", value: null, size: "normal" },
      label_ids: [LABEL_BLUE],
      member_ids: [MEMBER_SAMIR],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: true,
      custom_field_values: [],
      updated_at: "2026-11-08T09:00:00.000Z",
    },
    {
      id: "44444444-4444-4444-8444-444444444502",
      board_id: SEED_BOARD_SPRINT_ID,
      column_id: "33333333-3333-4333-8333-333333333341",
      title: "Fastify Route Handler Type Validation",
      description:
        "Enforce strict Zod and Pydantic v2 parity across all backend JSON envelopes.",
      position: "a1",
      priority: "MEDIUM",
      story_points: 3,
      tags: ["types", "security"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-22T18:00:00.000Z",
      cover: { type: "none", value: null, size: "normal" },
      label_ids: [LABEL_YELLOW],
      member_ids: [MEMBER_ELENA],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: false,
      custom_field_values: [],
      updated_at: "2026-11-08T09:10:00.000Z",
    },
    {
      id: "44444444-4444-4444-8444-444444444503",
      board_id: SEED_BOARD_SPRINT_ID,
      column_id: "33333333-3333-4333-8333-333333333342",
      title: "Redis Pub/Sub WebSocket Load Test",
      description:
        "Verify message delivery latency < 50ms under 500 simultaneous connected clients.",
      position: "a0",
      priority: "HIGH",
      story_points: 8,
      tags: ["realtime", "redis"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-18T10:00:00.000Z",
      cover: { type: "none", value: null, size: "normal" },
      label_ids: [LABEL_ORANGE],
      member_ids: [MEMBER_ALEX, MEMBER_MAYA],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: true,
      custom_field_values: [],
      updated_at: "2026-11-08T09:30:00.000Z",
    },
    {
      id: "44444444-4444-4444-8444-444444444504",
      board_id: SEED_BOARD_SPRINT_ID,
      column_id: "33333333-3333-4333-8333-333333333342",
      title: "Migrate Schema to Drizzle ORM v0.38",
      description:
        "Refactor database migrations to use clean relational queries and connection pooling.",
      position: "a1",
      priority: "MEDIUM",
      story_points: 5,
      tags: ["database"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-19T16:00:00.000Z",
      cover: { type: "none", value: null, size: "normal" },
      label_ids: [LABEL_BLUE],
      member_ids: [MEMBER_SAMIR],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: false,
      custom_field_values: [],
      updated_at: "2026-11-08T09:40:00.000Z",
    },
    {
      id: "44444444-4444-4444-8444-444444444505",
      board_id: SEED_BOARD_SPRINT_ID,
      column_id: "33333333-3333-4333-8333-333333333343",
      title: "End-to-End Playwright Parallel Tests",
      description:
        "Verify drag and drop optimistic UI updates and live WebSocket broadcast sync.",
      position: "a0",
      priority: "LOW",
      story_points: 3,
      tags: ["qa", "testing"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-15T15:00:00.000Z",
      cover: { type: "none", value: null, size: "normal" },
      label_ids: [LABEL_GREEN],
      member_ids: [MEMBER_ELENA],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: false,
      custom_field_values: [],
      updated_at: "2026-11-08T09:50:00.000Z",
    },
    {
      id: "44444444-4444-4444-8444-444444444506",
      board_id: SEED_BOARD_SPRINT_ID,
      column_id: "33333333-3333-4333-8333-333333333344",
      title: "Production Docker Container Hardening",
      description:
        "Multi-stage distroless node image builds with non-root user permissions.",
      position: "a0",
      priority: "HIGH",
      story_points: 5,
      tags: ["devops", "security"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-10T11:00:00.000Z",
      cover: { type: "none", value: null, size: "normal" },
      label_ids: [LABEL_GREEN],
      member_ids: [MEMBER_ALEX],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: true,
      is_archived: false,
      is_watching: false,
      custom_field_values: [],
      updated_at: "2026-11-08T10:00:00.000Z",
    },
  ],
  activities: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0010",
      board_id: SEED_BOARD_SPRINT_ID,
      card_id: "44444444-4444-4444-8444-444444444506",
      actor_name: "Alex Rivera",
      action_type: "CARD_MOVED",
      description: 'moved "Production Docker Container Hardening" to Done',
      created_at: "2026-11-08T10:00:00.000Z",
      is_automated: false,
    },
  ],
  automation_rules: cloneDefaultAutomationRules(SEED_BOARD_SPRINT_ID),
  webhooks: [],
  invite_links: [],
  visibility: "WORKSPACE",
  custom_fields: createDefaultCustomFields(SEED_BOARD_SPRINT_ID),
  theme_config: { ...DEFAULT_THEME_CONFIG },
};

export const INITIAL_MARKETING_BOARD: Board = {
  id: SEED_BOARD_MARKETING_ID,
  workspace_id: SEED_WORKSPACE_ID,
  title: "Growth & Marketing",
  description:
    "Campaign pipeline for content creation, asset review, approvals, and scheduled deployment",
  is_starred: false,
  background: {
    type: "gradient",
    value: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #831843 100%)",
  },
  created_at: "2026-11-08T08:00:00.000Z",
  labels: DEFAULT_BOARD_LABELS.map((l) => ({
    ...l,
    board_id: SEED_BOARD_MARKETING_ID,
  })),
  members: DEFAULT_BOARD_MEMBERS.map((m) => ({ ...m })),
  columns: [
    {
      id: "33333333-3333-4333-8333-333333333351",
      board_id: SEED_BOARD_MARKETING_ID,
      title: "Ideas",
      position: "a0",
      wip_limit: null,
      color: "#64748b",
      is_archived: false,
    },
    {
      id: "33333333-3333-4333-8333-333333333352",
      board_id: SEED_BOARD_MARKETING_ID,
      title: "Drafting",
      position: "a1",
      wip_limit: 3,
      color: "#3b82f6",
      is_archived: false,
    },
    {
      id: "33333333-3333-4333-8333-333333333353",
      board_id: SEED_BOARD_MARKETING_ID,
      title: "Creative Review",
      position: "a2",
      wip_limit: 2,
      color: "#8b5cf6",
      is_archived: false,
    },
    {
      id: "33333333-3333-4333-8333-333333333354",
      board_id: SEED_BOARD_MARKETING_ID,
      title: "Scheduled",
      position: "a3",
      wip_limit: null,
      color: "#f59e0b",
      is_archived: false,
    },
    {
      id: "33333333-3333-4333-8333-333333333355",
      board_id: SEED_BOARD_MARKETING_ID,
      title: "Published",
      position: "a4",
      wip_limit: null,
      color: "#10b981",
      is_archived: false,
    },
  ],
  cards: [
    {
      id: "44444444-4444-4444-8444-444444444601",
      board_id: SEED_BOARD_MARKETING_ID,
      column_id: "33333333-3333-4333-8333-333333333351",
      title: "Product Hunt Launch Day Campaign",
      description:
        "Prepare maker comment, high-res badge graphics, and launch team notification schedule.",
      position: "a0",
      priority: "URGENT",
      story_points: 5,
      tags: ["launch", "growth"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-25T08:00:00.000Z",
      cover: { type: "none", value: null, size: "normal" },
      label_ids: [LABEL_RED],
      member_ids: [MEMBER_MAYA],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: true,
      custom_field_values: [],
      updated_at: "2026-11-08T09:00:00.000Z",
    },
    {
      id: "44444444-4444-4444-8444-444444444602",
      board_id: SEED_BOARD_MARKETING_ID,
      column_id: "33333333-3333-4333-8333-333333333352",
      title: "Technical Blog Post: Scaling Real-time Kanban",
      description:
        "Deep dive on fractional indexing algorithms and zero lock Redis pub/sub architectures.",
      position: "a0",
      priority: "HIGH",
      story_points: 8,
      tags: ["content", "tech"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-28T14:00:00.000Z",
      cover: { type: "none", value: null, size: "normal" },
      label_ids: [LABEL_PURPLE],
      member_ids: [MEMBER_ALEX],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: false,
      custom_field_values: [],
      updated_at: "2026-11-08T09:15:00.000Z",
    },
    {
      id: "44444444-4444-4444-8444-444444444603",
      board_id: SEED_BOARD_MARKETING_ID,
      column_id: "33333333-3333-4333-8333-333333333353",
      title: "Customer Case Study: Series-A Dev Team",
      description:
        "Interview CTO on how replacing Jira with Kanbanify reduced cycle time by 42%.",
      position: "a0",
      priority: "MEDIUM",
      story_points: 3,
      tags: ["case-study"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-30T17:00:00.000Z",
      cover: { type: "none", value: null, size: "normal" },
      label_ids: [LABEL_BLUE],
      member_ids: [MEMBER_ELENA],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: false,
      custom_field_values: [],
      updated_at: "2026-11-08T09:30:00.000Z",
    },
    {
      id: "44444444-4444-4444-8444-444444444604",
      board_id: SEED_BOARD_MARKETING_ID,
      column_id: "33333333-3333-4333-8333-333333333354",
      title: "Interactive Demo Playground Asset Pack",
      description:
        "Interactive browser walkthrough with pre-loaded mock board for sandbox trial.",
      position: "a0",
      priority: "MEDIUM",
      story_points: 5,
      tags: ["assets", "design"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-22T12:00:00.000Z",
      cover: { type: "none", value: null, size: "normal" },
      label_ids: [LABEL_YELLOW],
      member_ids: [MEMBER_SAMIR],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: false,
      is_archived: false,
      is_watching: false,
      custom_field_values: [],
      updated_at: "2026-11-08T09:45:00.000Z",
    },
    {
      id: "44444444-4444-4444-8444-444444444605",
      board_id: SEED_BOARD_MARKETING_ID,
      column_id: "33333333-3333-4333-8333-333333333355",
      title: "X / Twitter Thread: Fractional Index Deep Dive",
      description:
        "Viral 8-tweet technical breakdown on base-62 lexicographical indexing.",
      position: "a0",
      priority: "LOW",
      story_points: 2,
      tags: ["social", "growth"],
      subtasks: [],
      blocked_by_card_ids: [],
      due_date: "2026-11-07T10:00:00.000Z",
      cover: { type: "none", value: null, size: "normal" },
      label_ids: [LABEL_GREEN],
      member_ids: [MEMBER_ALEX],
      checklists: [],
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: true,
      is_archived: false,
      is_watching: false,
      custom_field_values: [],
      updated_at: "2026-11-08T10:00:00.000Z",
    },
  ],
  activities: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0020",
      board_id: SEED_BOARD_MARKETING_ID,
      card_id: "44444444-4444-4444-8444-444444444605",
      actor_name: "Alex Rivera",
      action_type: "CARD_MOVED",
      description: 'published "X / Twitter Thread: Fractional Index Deep Dive"',
      created_at: "2026-11-08T10:00:00.000Z",
      is_automated: false,
    },
  ],
  automation_rules: cloneDefaultAutomationRules(SEED_BOARD_MARKETING_ID).slice(0, 1),
  webhooks: [],
  invite_links: [],
  visibility: "WORKSPACE",
  custom_fields: createDefaultCustomFields(SEED_BOARD_MARKETING_ID),
  theme_config: { ...DEFAULT_THEME_CONFIG },
};

export const INITIAL_SEED_BOARDS = [
  INITIAL_SEED_BOARD,
  INITIAL_SPRINT_BOARD,
  INITIAL_MARKETING_BOARD,
];

const STORAGE_KEY_BOARDS = "kanbanify_mock_boards_v7";
const STORAGE_KEY_WORKSPACES = "kanbanify_mock_workspaces_v6";
const STORAGE_KEY = "kanbanify_mock_board_v6";

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
    webhooks: board.webhooks ?? [],
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

export function parseNaturalLanguageAutomation(
  prompt: string,
  board: Board
): AIParseAutomationResponse {
  const lower = prompt.toLowerCase();

  // 1. Trigger resolution
  let trigger: AutomationTrigger = {
    type: "WHEN_CARD_MOVED_TO_COLUMN",
    column_id: null,
    column_title_match: "Done",
    priority: null,
    label_id: null,
  };

  let ruleName = "Custom Butler Rule";
  let ruleDesc = prompt;

  if (
    lower.includes("checklist selesai") ||
    lower.includes("checklist 100%") ||
    lower.includes("checklist completed") ||
    lower.includes("when checklist is completed") ||
    lower.includes("when checklist completed")
  ) {
    trigger = {
      type: "WHEN_CHECKLIST_COMPLETED",
      column_id: null,
      column_title_match: null,
      priority: null,
      label_id: null,
    };
    ruleName = "Auto-Advance on Checklist 100%";
    ruleDesc = "When checklist completed, trigger automated workflow";
  } else if (
    lower.includes("priority") ||
    lower.includes("prioritas") ||
    lower.includes("urgent")
  ) {
    let p: Priority = "URGENT";
    if (lower.includes("high") || lower.includes("tinggi")) p = "HIGH";
    else if (lower.includes("medium") || lower.includes("sedang")) p = "MEDIUM";
    else if (lower.includes("low") || lower.includes("rendah")) p = "LOW";

    trigger = {
      type: "WHEN_PRIORITY_CHANGED",
      column_id: null,
      column_title_match: null,
      priority: p,
      label_id: null,
    };
    ruleName = `${p} Priority Triage`;
    ruleDesc = `When card priority changes to ${p}, execute Butler actions`;
  } else if (
    lower.includes("kartu dibuat") ||
    lower.includes("card is created") ||
    lower.includes("card created") ||
    lower.includes("kartu baru")
  ) {
    trigger = {
      type: "WHEN_CARD_CREATED",
      column_id: null,
      column_title_match: null,
      priority: null,
      label_id: null,
    };
    ruleName = "New Card Intake Automations";
    ruleDesc = "When a card is created, auto-configure card properties";
  } else if (
    lower.includes("label added") ||
    lower.includes("label ditambahkan")
  ) {
    const matchedLabel = board.labels.find(
      (l) =>
        lower.includes(l.name.toLowerCase()) ||
        lower.includes(l.color.toLowerCase())
    );
    trigger = {
      type: "WHEN_LABEL_ADDED",
      column_id: null,
      column_title_match: null,
      priority: null,
      label_id: matchedLabel ? matchedLabel.id : null,
    };
    ruleName = `Tag Trigger: ${matchedLabel?.name ?? "Label"}`;
    ruleDesc = `When label ${matchedLabel?.name ?? ""} is attached to card`;
  } else {
    // Default or moved to column
    const matchedCol = board.columns.find((col) =>
      lower.includes(col.title.toLowerCase())
    );
    trigger = {
      type: "WHEN_CARD_MOVED_TO_COLUMN",
      column_id: matchedCol ? matchedCol.id : null,
      column_title_match: matchedCol ? matchedCol.title : "Done",
      priority: null,
      label_id: null,
    };
    ruleName = matchedCol
      ? `Auto-Route to ${matchedCol.title}`
      : "Auto-Complete & Tag Done Cards";
    ruleDesc = `When card moved to ${matchedCol?.title ?? "target column"}, run Butler automations`;
  }

  // 2. Actions resolution
  const actions: AutomationAction[] = [];

  // Check mark due date complete
  if (
    lower.includes("due date") ||
    lower.includes("tenggat waktu") ||
    lower.includes("mark due") ||
    lower.includes("due complete") ||
    lower.includes("selesai")
  ) {
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

  // Check assign member
  if (
    lower.includes("assign") ||
    lower.includes("tugaskan") ||
    board.members.some((m) =>
      lower.includes(m.name.toLowerCase().split(" ")[0])
    )
  ) {
    const matchedMember = board.members.find(
      (m) =>
        lower.includes(m.name.toLowerCase()) ||
        lower.includes(m.name.toLowerCase().split(" ")[0])
    );
    if (matchedMember) {
      actions.push({
        type: "ASSIGN_MEMBER",
        member_id: matchedMember.id,
        label_id: null,
        priority: null,
        target_column_id: null,
        checklist_title: null,
        checklist_items: null,
        comment_text: null,
        due_complete_value: null,
      });
    }
  }

  // Check add label
  if (
    lower.includes("label") ||
    lower.includes("tag") ||
    board.labels.some(
      (l) =>
        lower.includes(l.color.toLowerCase()) ||
        (l.name && lower.includes(l.name.toLowerCase()))
    )
  ) {
    const matchedLabel = board.labels.find(
      (l) =>
        lower.includes(l.color.toLowerCase()) ||
        (l.name && lower.includes(l.name.toLowerCase()))
    );
    if (matchedLabel) {
      actions.push({
        type: "ADD_LABEL",
        label_id: matchedLabel.id,
        member_id: null,
        priority: null,
        target_column_id: null,
        checklist_title: null,
        checklist_items: null,
        comment_text: null,
        due_complete_value: null,
      });
    }
  }

  // Check move card to column
  if (
    lower.includes("pindahkan kartu ke") ||
    lower.includes("pindahkan ke") ||
    lower.includes("move card to") ||
    lower.includes("move to")
  ) {
    const targetCol = board.columns.find((col) => {
      const colLower = col.title.toLowerCase();
      if (
        trigger.type === "WHEN_CARD_MOVED_TO_COLUMN" &&
        trigger.column_title_match &&
        colLower === trigger.column_title_match.toLowerCase()
      ) {
        return false;
      }
      return lower.includes(colLower);
    });

    if (targetCol) {
      actions.push({
        type: "MOVE_CARD_TO_COLUMN",
        target_column_id: targetCol.id,
        member_id: null,
        label_id: null,
        priority: null,
        checklist_title: null,
        checklist_items: null,
        comment_text: null,
        due_complete_value: null,
      });
    }
  }

  // Check set priority
  if (
    (lower.includes("set priority") ||
      lower.includes("atur prioritas") ||
      lower.includes("ubah prioritas")) &&
    trigger.type !== "WHEN_PRIORITY_CHANGED"
  ) {
    let p: Priority = "HIGH";
    if (lower.includes("urgent")) p = "URGENT";
    else if (lower.includes("medium")) p = "MEDIUM";
    else if (lower.includes("low")) p = "LOW";

    actions.push({
      type: "SET_PRIORITY",
      priority: p,
      member_id: null,
      label_id: null,
      target_column_id: null,
      checklist_title: null,
      checklist_items: null,
      comment_text: null,
      due_complete_value: null,
    });
  }

  // Check add checklist
  if (
    lower.includes("checklist") &&
    trigger.type !== "WHEN_CHECKLIST_COMPLETED"
  ) {
    actions.push({
      type: "ADD_CHECKLIST",
      checklist_title: "Quality Review Checklist",
      checklist_items: ["Verify implementation", "Run automated test suite"],
      member_id: null,
      label_id: null,
      priority: null,
      target_column_id: null,
      comment_text: null,
      due_complete_value: null,
    });
  }

  if (actions.length === 0) {
    actions.push({
      type: "POST_COMMENT",
      comment_text: `🤖 Butler automated: Executed rule for "${prompt.slice(0, 50)}"`,
      member_id: null,
      label_id: null,
      priority: null,
      target_column_id: null,
      checklist_title: null,
      checklist_items: null,
      due_complete_value: null,
    });
  }

  return {
    name: ruleName,
    description: ruleDesc,
    trigger,
    actions,
  };
}

export class MockApiService {
  private boards: Map<string, Board> = new Map();
  private workspaces: Workspace[] = [];

  constructor() {
    this.initDefaultSeed();
  }

  private initDefaultSeed(): void {
    this.boards.clear();
    for (const b of INITIAL_SEED_BOARDS) {
      this.boards.set(b.id, sortBoardEntities(BoardSchema.parse(b)));
    }
    this.workspaces = [{ ...DEFAULT_WORKSPACE }];
  }

  private loadState(): Map<string, Board> {
    if (typeof window === "undefined") {
      return this.boards;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_BOARDS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.boards.clear();
          for (const b of parsed) {
            const v = BoardSchema.safeParse(b);
            if (v.success) {
              this.boards.set(v.data.id, sortBoardEntities(v.data));
            }
          }
          if (this.boards.size > 0) return this.boards;
        }
      }
    } catch {
      // Ignore storage errors
    }

    this.initDefaultSeed();
    return this.boards;
  }

  private saveState(updatedBoard?: Board): void {
    if (updatedBoard) {
      const validated = sortBoardEntities(BoardSchema.parse(updatedBoard));
      this.boards.set(validated.id, validated);
    }
    if (typeof window !== "undefined") {
      try {
        const boardsArr = Array.from(this.boards.values());
        window.localStorage.setItem(
          STORAGE_KEY_BOARDS,
          JSON.stringify(boardsArr)
        );
        window.localStorage.setItem(
          STORAGE_KEY_WORKSPACES,
          JSON.stringify(this.workspaces)
        );
      } catch {
        // Ignore quota errors
      }
    }
  }

  private createActivity(
    board: Board,
    action_type: Activity["action_type"],
    description: string,
    card_id: string | null = null,
    actor_name = "Alex Rivera",
    is_automated = false
  ): Activity {
    return {
      id: createDeterministicUuid(),
      board_id: board.id,
      card_id,
      actor_name,
      action_type,
      description,
      created_at: new Date().toISOString(),
      is_automated,
    };
  }

  resetToSeed(): Board {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY_BOARDS);
      window.localStorage.removeItem(STORAGE_KEY_WORKSPACES);
    }
    this.initDefaultSeed();
    this.saveState();
    return this.boards.get(SEED_BOARD_ID) ?? INITIAL_SEED_BOARD;
  }

  // --- Workspaces Endpoints ---
  async listWorkspaces(): Promise<WorkspaceWithBoards[]> {
    this.loadState();
    const boards = Array.from(this.boards.values());
    const summaries: BoardSummary[] = boards.map((b) => ({
      id: b.id,
      workspace_id: b.workspace_id,
      title: b.title,
      is_starred: b.is_starred,
      background: b.background,
      card_count: b.cards.filter((c) => !c.is_archived).length,
      updated_at: b.created_at,
      created_at: b.created_at,
      description: b.description,
    }));

    return this.workspaces.map((ws) => ({
      ...ws,
      boards: summaries.filter((s) => s.workspace_id === ws.id),
    }));
  }

  async getWorkspace(id: string): Promise<WorkspaceWithBoards> {
    const list = await this.listWorkspaces();
    const found = list.find((w) => w.id === id);
    if (!found) {
      return {
        ...DEFAULT_WORKSPACE,
        boards: (await this.getBoardSummaries()).filter(
          (b) => b.workspace_id === DEFAULT_WORKSPACE.id
        ),
      };
    }
    return found;
  }

  async createWorkspace(payload: CreateWorkspaceRequest): Promise<Workspace> {
    const newWs: Workspace = {
      id: createDeterministicUuid(),
      name: payload.name,
      slug:
        payload.slug ||
        payload.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-"),
      description: payload.description ?? "",
      logo_color: payload.logo_color ?? "#6366f1",
      created_at: new Date().toISOString(),
    };
    this.workspaces.push(newWs);
    this.saveState();
    return newWs;
  }

  // --- Board Templates ---
  async getBoardTemplates(): Promise<BoardTemplate[]> {
    return DEFAULT_BOARD_TEMPLATES.map((t) => ({
      ...t,
      default_columns: [...t.default_columns],
    }));
  }

  // --- Boards Endpoints ---
  async listBoards(): Promise<Board[]> {
    this.loadState();
    return Array.from(this.boards.values());
  }

  async getBoardSummaries(): Promise<BoardSummary[]> {
    this.loadState();
    return Array.from(this.boards.values()).map((b) => ({
      id: b.id,
      workspace_id: b.workspace_id,
      title: b.title,
      is_starred: b.is_starred,
      background: b.background,
      card_count: b.cards.filter((c) => !c.is_archived).length,
      updated_at: b.created_at,
      created_at: b.created_at,
      description: b.description,
    }));
  }

  async getBoard(boardId: string): Promise<Board> {
    this.loadState();
    const found = this.boards.get(boardId);
    if (found) return found;
    return this.boards.get(SEED_BOARD_ID) ?? INITIAL_SEED_BOARD;
  }

  async createBoard(payload: CreateBoardRequest): Promise<Board> {
    this.loadState();
    const boardId = createDeterministicUuid();
    const template = payload.template_id
      ? DEFAULT_BOARD_TEMPLATES.find((t) => t.id === payload.template_id)
      : undefined;

    const columnTitles = template
      ? template.default_columns
      : ["Backlog", "In Progress", "Review", "Done"];

    const columns: Column[] = columnTitles.map((title, idx) => ({
      id: createDeterministicUuid(),
      board_id: boardId,
      title,
      position: `a${idx}`,
      wip_limit: idx === 1 ? 4 : null,
      color:
        idx === 0
          ? "#64748b"
          : idx === 1
            ? "#3b82f6"
            : idx === 2
              ? "#8b5cf6"
              : "#10b981",
      is_archived: false,
    }));

    const nextBoard: Board = {
      id: boardId,
      workspace_id: payload.workspace_id ?? DEFAULT_WORKSPACE.id,
      title: payload.title,
      description: payload.description ?? (template?.description ?? ""),
      is_starred: payload.is_starred ?? false,
      background:
        payload.background ??
        (template?.background ?? {
          type: "gradient",
          value:
            "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
        }),
      created_at: new Date().toISOString(),
      labels: DEFAULT_BOARD_LABELS.map((l) => ({
        ...l,
        board_id: boardId,
      })),
      members: DEFAULT_BOARD_MEMBERS.map((m) => ({ ...m })),
      activities: [],
      columns,
      cards: [],
      automation_rules: cloneDefaultAutomationRules(boardId),
      webhooks: [],
      invite_links: [],
      visibility: payload.visibility ?? "WORKSPACE",
      custom_fields: createDefaultCustomFields(boardId),
      theme_config: { ...DEFAULT_THEME_CONFIG },
    };

    this.saveState(nextBoard);
    return nextBoard;
  }

  async updateBoard(
    boardId: string,
    payload: UpdateBoardRequest
  ): Promise<Board> {
    const board = await this.getBoard(boardId);
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
    this.saveState(nextBoard);
    return nextBoard;
  }

  async deleteBoard(boardId: string): Promise<{ id: string; deleted: boolean }> {
    this.loadState();
    this.boards.delete(boardId);
    this.saveState();
    return { id: boardId, deleted: true };
  }

  // --- Automation Rules Endpoints ---
  async getAutomations(boardId: string): Promise<AutomationRule[]> {
    const board = await this.getBoard(boardId);
    return board.automation_rules ?? [];
  }

  async createAutomation(
    boardId: string,
    payload: CreateAutomationRuleRequest
  ): Promise<AutomationRule> {
    const board = await this.getBoard(boardId);
    const newRule: AutomationRule = {
      id: createDeterministicUuid(),
      board_id: boardId,
      name: payload.name,
      description: payload.description ?? "",
      is_enabled: payload.is_enabled ?? true,
      trigger: payload.trigger,
      actions: payload.actions,
      execution_count: 0,
      last_triggered_at: null,
      created_at: new Date().toISOString(),
    };

    const nextRules = [...(board.automation_rules ?? []), newRule];
    this.saveState({
      ...board,
      automation_rules: nextRules,
    });
    return newRule;
  }

  async updateAutomation(
    ruleId: string,
    payload: UpdateAutomationRuleRequest
  ): Promise<AutomationRule> {
    this.loadState();
    for (const board of this.boards.values()) {
      const idx = (board.automation_rules ?? []).findIndex(
        (r) => r.id === ruleId
      );
      if (idx !== -1) {
        const existing = board.automation_rules[idx];
        const updated: AutomationRule = {
          ...existing,
          ...payload,
          actions: payload.actions ?? existing.actions,
          trigger: payload.trigger ?? existing.trigger,
        };
        const nextRules = [...board.automation_rules];
        nextRules[idx] = updated;
        this.saveState({
          ...board,
          automation_rules: nextRules,
        });
        return updated;
      }
    }
    throw new Error(`Automation rule ${ruleId} not found`);
  }

  async deleteAutomation(
    ruleId: string
  ): Promise<{ id: string; deleted: boolean }> {
    this.loadState();
    for (const board of this.boards.values()) {
      const filtered = (board.automation_rules ?? []).filter(
        (r) => r.id !== ruleId
      );
      if (filtered.length !== (board.automation_rules ?? []).length) {
        this.saveState({
          ...board,
          automation_rules: filtered,
        });
        return { id: ruleId, deleted: true };
      }
    }
    return { id: ruleId, deleted: true };
  }

  async parseAutomationWithAi(
    boardId: string,
    prompt: string
  ): Promise<AIParseAutomationResponse> {
    const board = await this.getBoard(boardId);
    return parseNaturalLanguageAutomation(prompt, board);
  }

  // --- Column & Card Operations ---
  async createColumn(
    boardId: string,
    payload: CreateColumnRequest
  ): Promise<Column> {
    const board = await this.getBoard(boardId);
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
    this.loadState();
    for (const board of this.boards.values()) {
      const existing = board.columns.find((c) => c.id === columnId);
      if (existing) {
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
    }
    throw new Error(`Column ${columnId} not found`);
  }

  async moveColumn(
    columnId: string,
    payload: MoveColumnRequest
  ): Promise<Column> {
    this.loadState();
    for (const board of this.boards.values()) {
      const existing = board.columns.find((c) => c.id === columnId);
      if (existing) {
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
    }
    throw new Error(`Column ${columnId} not found`);
  }

  async copyColumn(
    columnId: string,
    payload?: CopyColumnRequest
  ): Promise<CopyColumnResponse> {
    this.loadState();
    for (const board of this.boards.values()) {
      const sourceCol = board.columns.find((c) => c.id === columnId);
      if (!sourceCol) continue;

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
    throw new Error(`Column ${columnId} not found`);
  }

  async createCard(
    boardId: string,
    payload: CreateCardRequest
  ): Promise<Card> {
    const board = await this.getBoard(boardId);
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
      custom_field_values: payload.custom_field_values ?? [],
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
    this.loadState();
    for (const board of this.boards.values()) {
      const existing = board.cards.find((c) => c.id === cardId);
      if (!existing) continue;

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
    throw new Error(`Card ${cardId} not found`);
  }

  async moveCard(cardId: string, payload: MoveCardRequest): Promise<Card> {
    this.loadState();
    for (const board of this.boards.values()) {
      const existing = board.cards.find((c) => c.id === cardId);
      if (!existing) continue;

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
    throw new Error(`Card ${cardId} not found`);
  }

  async copyCard(cardId: string, payload?: CopyCardRequest): Promise<Card> {
    this.loadState();
    for (const board of this.boards.values()) {
      const existing = board.cards.find((c) => c.id === cardId);
      if (!existing) continue;

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
      const keepCustomFields = payload?.keep_custom_fields ?? true;

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
        custom_field_values: keepCustomFields ? [...(existing.custom_field_values ?? [])] : [],
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
    throw new Error(`Card ${cardId} not found`);
  }

  async deleteCard(cardId: string): Promise<{ id: string; deleted: boolean }> {
    this.loadState();
    for (const board of this.boards.values()) {
      if (board.cards.some((c) => c.id === cardId)) {
        this.saveState({
          ...board,
          cards: board.cards.filter((c) => c.id !== cardId),
        });
        return { id: cardId, deleted: true };
      }
    }
    return { id: cardId, deleted: true };
  }

  async addComment(
    cardId: string,
    payload: CreateCommentRequest
  ): Promise<Comment> {
    this.loadState();
    for (const board of this.boards.values()) {
      const existing = board.cards.find((c) => c.id === cardId);
      if (!existing) continue;

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
    throw new Error(`Card ${cardId} not found`);
  }

  async deleteComment(
    cardId: string,
    commentId: string
  ): Promise<{ id: string; deleted: boolean }> {
    this.loadState();
    for (const board of this.boards.values()) {
      const existing = board.cards.find((c) => c.id === cardId);
      if (!existing) continue;

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
    return { id: commentId, deleted: true };
  }

  async aiDecomposeCard(cardId: string): Promise<Card> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.loadState();
    for (const board of this.boards.values()) {
      const existing = board.cards.find((c) => c.id === cardId);
      if (!existing) continue;

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
    throw new Error(`Card ${cardId} not found`);
  }

  // --- Phase 4: Team Productivity & Sprint Analytics ---
  async getBoardAnalytics(boardId: string): Promise<BoardAnalytics> {
    const board = await this.getBoard(boardId);
    return computeBoardAnalyticsFromBoard(board);
  }

  async generateAIAnalyticsReport(
    boardId: string
  ): Promise<AIAnalyticsReport> {
    await new Promise((resolve) => setTimeout(resolve, 650));
    const board = await this.getBoard(boardId);
    const analytics = computeBoardAnalyticsFromBoard(board);
    return synthesizeAIAnalyticsReport(board.title, analytics);
  }

  // --- Phase 4: Trello JSON Importer & Board CSV/JSON Exporter ---
  async importBoard(
    request: TrelloImportRequest
  ): Promise<TrelloImportResult> {
    this.loadState();
    const result = parseTrelloOrKinetixImport(request, DEFAULT_WORKSPACE.id);
    this.saveState(result.board);
    return result;
  }

  async exportBoardCsv(boardId: string): Promise<BoardExportCsvResponse> {
    const board = await this.getBoard(boardId);
    return generateBoardCsvExport(board);
  }

  async exportBoardJson(boardId: string): Promise<Board> {
    return this.getBoard(boardId);
  }

  // --- Phase 5: Outbound Webhooks CRUD & Test Ping ---
  async getWebhooks(boardId: string): Promise<WebhookConfig[]> {
    const board = await this.getBoard(boardId);
    return board.webhooks ?? [];
  }

  async createWebhook(
    boardId: string,
    payload: CreateWebhookRequest
  ): Promise<WebhookConfig> {
    this.loadState();
    const board = await this.getBoard(boardId);
    const newWebhook: WebhookConfig = {
      id: createDeterministicUuid(),
      board_id: boardId,
      name: payload.name,
      platform: payload.platform,
      url: payload.url,
      is_enabled: payload.is_enabled ?? true,
      subscribed_events: [...payload.subscribed_events],
      created_at: new Date().toISOString(),
    };
    const nextWebhooks = [...(board.webhooks ?? []), newWebhook];
    this.saveState({
      ...board,
      webhooks: nextWebhooks,
    });
    return newWebhook;
  }

  async updateWebhook(
    webhookId: string,
    payload: UpdateWebhookRequest
  ): Promise<WebhookConfig> {
    this.loadState();
    for (const board of this.boards.values()) {
      const idx = (board.webhooks ?? []).findIndex((w) => w.id === webhookId);
      if (idx !== -1) {
        const existing = board.webhooks[idx];
        const updated: WebhookConfig = {
          ...existing,
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.platform !== undefined ? { platform: payload.platform } : {}),
          ...(payload.url !== undefined ? { url: payload.url } : {}),
          ...(payload.is_enabled !== undefined ? { is_enabled: payload.is_enabled } : {}),
          ...(payload.subscribed_events !== undefined
            ? { subscribed_events: [...payload.subscribed_events] }
            : {}),
        };
        const nextWebhooks = [...board.webhooks];
        nextWebhooks[idx] = updated;
        this.saveState({
          ...board,
          webhooks: nextWebhooks,
        });
        return updated;
      }
    }
    throw new Error(`Webhook not found: ${webhookId}`);
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    this.loadState();
    for (const board of this.boards.values()) {
      const idx = (board.webhooks ?? []).findIndex((w) => w.id === webhookId);
      if (idx !== -1) {
        const nextWebhooks = board.webhooks.filter((w) => w.id !== webhookId);
        this.saveState({
          ...board,
          webhooks: nextWebhooks,
        });
        return;
      }
    }
  }

  async testWebhook(webhookId: string): Promise<TestWebhookResponse> {
    this.loadState();
    let foundWebhook: WebhookConfig | null = null;
    for (const board of this.boards.values()) {
      const found = (board.webhooks ?? []).find((w) => w.id === webhookId);
      if (found) {
        foundWebhook = found;
        break;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 350));

    if (!foundWebhook) {
      return {
        success: true,
        status_code: 200,
        message: "Test webhook notification dispatched successfully (mock endpoint).",
        delivered_at: new Date().toISOString(),
      };
    }

    return {
      success: true,
      status_code: 200,
      message: `Test payload delivered to ${foundWebhook.platform} webhook endpoint (${foundWebhook.name}) successfully.`,
      delivered_at: new Date().toISOString(),
    };
  }

  async generateAISummaryNotification(
    boardTitle: string,
    activities: Activity[] = []
  ): Promise<AISummaryNotificationResponse> {
    await new Promise((resolve) => setTimeout(resolve, 450));
    const nowIso = new Date().toISOString();
    return {
      slack_block_kit_payload: {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `📋 Kanbanify Standup Digest: ${boardTitle}`,
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Sprint Status*: 🟢 *On Track* — Team velocity at 84% completion.\n*Highlights*: Recent cards progressed smoothly through Review and Done columns.`,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `⚡ Dispatched via Kanbanify Webhook Dispatcher | ${nowIso}`,
              },
            ],
          },
        ],
      },
      discord_embed_payload: {
        username: "Kanbanify Bot",
        avatar_url: "https://kanbanify.internal/icons/bot-avatar.png",
        embeds: [
          {
            title: `📋 Daily Standup Digest: ${boardTitle}`,
            color: 5793266, // #5865F2 Discord blurple
            description: `Daily automated standup digest for **${boardTitle}** generated by Kanbanify AI Engine:`,
            fields: [
              {
                name: "🚀 Team Velocity",
                value: "All active sprint cards on track. 0 critical blockers.",
                inline: true,
              },
              {
                name: "⚡ Butler Automations",
                value: "Automated rules executed successfully across Backlog and Done.",
                inline: true,
              },
            ],
            footer: {
              text: "Kanbanify Webhook Dispatcher",
            },
            timestamp: nowIso,
          },
        ],
      },
      summary_text: `Kanbanify Standup Digest for ${boardTitle}: Sprint on track with high team velocity and 0 critical blockers.`,
    };
  }

  // ==========================================================================
  // PHASE 6 AUTH, RBAC, BOARD MEMBERS & SHAREABLE INVITES
  // ==========================================================================

  async login(payload: LoginRequest): Promise<AuthSessionResponse> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const user =
      DEMO_USERS.find(
        (u) => u.email.toLowerCase() === payload.email.toLowerCase()
      ) ?? {
        id: createDeterministicUuid(),
        name: payload.email.split("@")[0],
        email: payload.email,
        avatar_url: null,
        initials: payload.email.slice(0, 2).toUpperCase(),
        color: "#6366f1",
        default_role: "EDITOR" as const,
      };
    return {
      token: `kb_sess_${user.id}_token`,
      user,
      expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    };
  }

  async register(payload: RegisterRequest): Promise<AuthSessionResponse> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const user: AuthUser = {
      id: createDeterministicUuid(),
      name: payload.name,
      email: payload.email,
      avatar_url: null,
      initials:
        payload.name
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase() || "KB",
      color: "#10b981",
      default_role: "EDITOR",
    };
    return {
      token: `kb_sess_${user.id}_token`,
      user,
      expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    };
  }

  async getMe(): Promise<AuthUser> {
    return DEMO_USERS[0];
  }

  async getDemoUsers(): Promise<AuthUser[]> {
    return DEMO_USERS;
  }

  async addMember(
    boardId: string,
    payload: { name: string; email: string; role: BoardRole }
  ): Promise<Member> {
    this.loadState();
    const board = this.boards.get(boardId) ?? (await this.getBoard(boardId));
    const newMember: Member = {
      id: createDeterministicUuid(),
      name: payload.name,
      email: payload.email,
      avatar_url: null,
      initials:
        payload.name
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase() || "MB",
      color: payload.role === "ADMIN" ? "#6366f1" : payload.role === "EDITOR" ? "#10b981" : "#f59e0b",
      role: payload.role,
      joined_at: new Date().toISOString(),
    };
    const nextMembers = [
      ...board.members.filter((m) => m.email.toLowerCase() !== payload.email.toLowerCase()),
      newMember,
    ];
    const activity = this.createActivity(
      board,
      "MEMBER_ASSIGNED",
      `invited ${newMember.name} as ${newMember.role}`
    );
    const updatedBoard: Board = {
      ...board,
      members: nextMembers,
      activities: [activity, ...board.activities],
    };
    this.saveState(updatedBoard);
    return newMember;
  }

  async updateMemberRole(
    boardId: string,
    memberId: string,
    role: BoardRole
  ): Promise<Member> {
    this.loadState();
    const board = this.boards.get(boardId) ?? (await this.getBoard(boardId));
    const member = board.members.find((m) => m.id === memberId);
    if (!member) {
      throw new Error("Member not found on this board");
    }
    const updatedMember: Member = { ...member, role };
    const nextMembers = board.members.map((m) =>
      m.id === memberId ? updatedMember : m
    );
    const activity = this.createActivity(
      board,
      "MEMBER_ASSIGNED",
      `changed role of ${member.name} to ${role}`
    );
    const updatedBoard: Board = {
      ...board,
      members: nextMembers,
      activities: [activity, ...board.activities],
    };
    this.saveState(updatedBoard);
    return updatedMember;
  }

  async removeMember(
    boardId: string,
    memberId: string
  ): Promise<{ id: string; removed: boolean }> {
    this.loadState();
    const board = this.boards.get(boardId) ?? (await this.getBoard(boardId));
    const nextMembers = board.members.filter((m) => m.id !== memberId);
    const updatedBoard: Board = {
      ...board,
      members: nextMembers,
    };
    this.saveState(updatedBoard);
    return { id: memberId, removed: true };
  }

  async getInviteLinks(boardId: string): Promise<BoardInviteLink[]> {
    this.loadState();
    const board = this.boards.get(boardId) ?? (await this.getBoard(boardId));
    return board.invite_links ?? [];
  }

  async createInviteLink(
    boardId: string,
    payload: CreateInviteLinkRequest
  ): Promise<BoardInviteLink> {
    this.loadState();
    const board = this.boards.get(boardId) ?? (await this.getBoard(boardId));
    const expiresAt =
      payload.expires_in_hours && payload.expires_in_hours > 0
        ? new Date(Date.now() + payload.expires_in_hours * 3600 * 1000).toISOString()
        : null;
    const token = `kb_inv_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    const newLink: BoardInviteLink = {
      id: `inv-${createDeterministicUuid().slice(0, 8)}`,
      board_id: boardId,
      token,
      role: payload.role,
      created_by_id: MEMBER_ALEX,
      created_by_name: "Alex Rivera",
      max_uses: payload.max_uses ?? null,
      uses_count: 0,
      expires_at: expiresAt,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    const updatedBoard: Board = {
      ...board,
      invite_links: [newLink, ...(board.invite_links ?? [])],
    };
    this.saveState(updatedBoard);
    return newLink;
  }

  async revokeInviteLink(inviteId: string): Promise<{ id: string; revoked: boolean }> {
    this.loadState();
    for (const board of this.boards.values()) {
      const existing = board.invite_links ?? [];
      if (existing.some((l) => l.id === inviteId)) {
        const updatedBoard: Board = {
          ...board,
          invite_links: existing.filter((l) => l.id !== inviteId),
        };
        this.saveState(updatedBoard);
        return { id: inviteId, revoked: true };
      }
    }
    return { id: inviteId, revoked: true };
  }

  async previewInvite(token: string): Promise<{
    board_id: string;
    board_title: string;
    inviter_name: string;
    granted_role: BoardRole;
    is_valid: boolean;
  }> {
    this.loadState();
    for (const board of this.boards.values()) {
      const link = (board.invite_links ?? []).find((l) => l.token === token);
      if (link) {
        return {
          board_id: board.id,
          board_title: board.title,
          inviter_name: link.created_by_name,
          granted_role: link.role,
          is_valid: link.is_active,
        };
      }
    }
    const fallbackBoard = this.boards.get(SEED_BOARD_ID) ?? INITIAL_SEED_BOARD;
    return {
      board_id: fallbackBoard.id,
      board_title: fallbackBoard.title,
      inviter_name: "Alex Rivera",
      granted_role: "EDITOR",
      is_valid: true,
    };
  }

  async joinViaInvite(
    token: string,
    payload?: JoinViaInviteRequest
  ): Promise<JoinViaInviteResponse> {
    this.loadState();
    let targetBoard: Board | undefined;
    let targetLink: BoardInviteLink | undefined;

    for (const board of this.boards.values()) {
      const link = (board.invite_links ?? []).find((l) => l.token === token);
      if (link) {
        targetBoard = board;
        targetLink = link;
        break;
      }
    }

    if (!targetBoard) {
      targetBoard = this.boards.get(SEED_BOARD_ID) ?? INITIAL_SEED_BOARD;
      targetLink = targetBoard.invite_links?.[0] ?? {
        id: "inv-001",
        board_id: targetBoard.id,
        token,
        role: "EDITOR",
        created_by_id: MEMBER_ALEX,
        created_by_name: "Alex Rivera",
        max_uses: 10,
        uses_count: 0,
        expires_at: null,
        is_active: true,
        created_at: new Date().toISOString(),
      };
    }

    const grantedRole = targetLink?.role ?? "EDITOR";
    const guestName = payload?.name || "Sarah Connor";
    const guestEmail = payload?.email || `guest_${Date.now()}@kinetix.dev`;

    const newMember: Member = {
      id: createDeterministicUuid(),
      name: guestName,
      email: guestEmail,
      avatar_url: null,
      initials: guestName.slice(0, 2).toUpperCase(),
      color: "#ec4899",
      role: grantedRole,
      joined_at: new Date().toISOString(),
    };

    const updatedLinks = (targetBoard.invite_links ?? []).map((l) =>
      l.token === token ? { ...l, uses_count: l.uses_count + 1 } : l
    );

    const activity = this.createActivity(
      targetBoard,
      "MEMBER_ASSIGNED",
      `${guestName} joined board via invite link (${grantedRole})`
    );

    const updatedBoard: Board = {
      ...targetBoard,
      members: [
        ...targetBoard.members.filter((m) => m.email.toLowerCase() !== guestEmail.toLowerCase()),
        newMember,
      ],
      invite_links: updatedLinks,
      activities: [activity, ...targetBoard.activities],
    };
    this.saveState(updatedBoard);

    return {
      board_id: targetBoard.id,
      board_title: targetBoard.title,
      granted_role: grantedRole,
      member: newMember,
    };
  }

  async auditPermissions(boardId: string): Promise<AIPermissionAuditResponse> {
    this.loadState();
    const board = this.boards.get(boardId) ?? (await this.getBoard(boardId));
    const members = board.members ?? [];
    const invites = board.invite_links ?? [];

    const adminCount = members.filter((m) => m.role === "ADMIN").length;
    const editorCount = members.filter((m) => m.role === "EDITOR").length;
    const viewerCount = members.filter((m) => m.role === "VIEWER").length;
    const nonExpiringInvites = invites.filter((l) => !l.expires_at).length;

    let score = 92;
    if (nonExpiringInvites > 0) score -= 14;
    if (editorCount > 3) score -= 5;
    if (adminCount > 2) score -= 8;
    score = Math.max(45, Math.min(100, score));

    const risk_level = score >= 80 ? "LOW" : score >= 60 ? "MEDIUM" : "HIGH";

    const findings: string[] = [
      `Board has ${adminCount} Admin, ${editorCount} Editors, and ${viewerCount} Viewers.`,
      nonExpiringInvites > 0
        ? `Detected ${nonExpiringInvites} active invite link(s) without expiration timestamps.`
        : "All active invite links have strict expiration boundaries configured.",
      "Least-privilege permission matrix verified for Viewer read-only observer boundaries.",
      "Butler automation configuration and outbound webhook dispatch locked to Admin role.",
    ];

    const recommendations: string[] = [
      "Configure TTL / expiration timestamps on any newly issued shareable invite links.",
      "Review Editor permissions periodically and downgrade inactive contributors to Viewer.",
      "Restrict Board Settings and Butler Automation rules to trusted Board Admins.",
    ];

    return {
      security_score: score,
      risk_level,
      summary: `Automated least-privilege security audit completed with score ${score}/100 (${risk_level} risk).`,
      findings,
      recommendations,
    };
  }

  // --- Phase 7 Custom Fields Endpoints ---
  async getCustomFields(boardId: string): Promise<CustomFieldDefinition[]> {
    this.loadState();
    const board = this.boards.get(boardId) ?? (await this.getBoard(boardId));
    return (board.custom_fields ?? []).slice().sort((a, b) => comparePositions(a.position, b.position));
  }

  async createCustomField(
    boardId: string,
    payload: CreateCustomFieldDefinitionRequest
  ): Promise<CustomFieldDefinition> {
    this.loadState();
    const board = this.boards.get(boardId) ?? (await this.getBoard(boardId));
    const existing = board.custom_fields ?? [];
    const lastPos = existing.length > 0 ? existing[existing.length - 1].position : undefined;
    const position = payload.position ?? generatePositionBetween(lastPos, undefined);

    const newField: CustomFieldDefinition = CustomFieldDefinitionSchema.parse({
      id: createDeterministicUuid(),
      board_id: boardId,
      name: payload.name.trim(),
      type: payload.type,
      options: payload.options ?? [],
      show_on_front: payload.show_on_front ?? true,
      position,
      created_at: new Date().toISOString(),
    });

    const updatedBoard: Board = {
      ...board,
      custom_fields: [...existing, newField],
    };
    this.saveState(updatedBoard);
    return newField;
  }

  async updateCustomField(
    fieldId: string,
    payload: UpdateCustomFieldDefinitionRequest
  ): Promise<CustomFieldDefinition> {
    this.loadState();
    for (const board of this.boards.values()) {
      const existing = (board.custom_fields ?? []).find((f) => f.id === fieldId);
      if (!existing) continue;

      const updatedField: CustomFieldDefinition = CustomFieldDefinitionSchema.parse({
        ...existing,
        name: payload.name !== undefined ? payload.name.trim() : existing.name,
        options: payload.options !== undefined ? payload.options : existing.options,
        show_on_front: payload.show_on_front !== undefined ? payload.show_on_front : existing.show_on_front,
        position: payload.position !== undefined ? payload.position : existing.position,
      });

      const updatedBoard: Board = {
        ...board,
        custom_fields: board.custom_fields.map((f) => (f.id === fieldId ? updatedField : f)),
      };
      this.saveState(updatedBoard);
      return updatedField;
    }
    throw new Error(`Custom field ${fieldId} not found`);
  }

  async deleteCustomField(fieldId: string): Promise<{ id: string; deleted: boolean }> {
    this.loadState();
    for (const board of this.boards.values()) {
      const existing = (board.custom_fields ?? []).find((f) => f.id === fieldId);
      if (!existing) continue;

      const updatedCards = board.cards.map((c) => ({
        ...c,
        custom_field_values: (c.custom_field_values ?? []).filter((v) => v.field_id !== fieldId),
      }));

      const updatedBoard: Board = {
        ...board,
        custom_fields: board.custom_fields.filter((f) => f.id !== fieldId),
        cards: updatedCards,
      };
      this.saveState(updatedBoard);
      return { id: fieldId, deleted: true };
    }
    throw new Error(`Custom field ${fieldId} not found`);
  }

  async setCardCustomFieldValue(
    cardId: string,
    fieldId: string,
    value: string | number | boolean | null
  ): Promise<Card> {
    this.loadState();
    for (const board of this.boards.values()) {
      const existing = board.cards.find((c) => c.id === cardId);
      if (!existing) continue;

      const currentValues = (existing.custom_field_values ?? []).filter((v) => v.field_id !== fieldId);
      if (value !== null && value !== undefined && value !== "") {
        currentValues.push({ field_id: fieldId, value });
      }

      const updatedCard: Card = CardSchema.parse({
        ...existing,
        custom_field_values: currentValues,
        updated_at: new Date().toISOString(),
      });

      const updatedBoard: Board = {
        ...board,
        cards: board.cards.map((c) => (c.id === cardId ? updatedCard : c)),
      };
      this.saveState(updatedBoard);
      return updatedCard;
    }
    throw new Error(`Card ${cardId} not found`);
  }

  // --- Phase 7 Visual Dependency Graph & AI Critical Path Endpoints ---
  async getDependencyGraph(boardId: string): Promise<BoardDependencyGraph> {
    this.loadState();
    const board = this.boards.get(boardId) ?? (await this.getBoard(boardId));
    return computeBoardDependencyGraph(board);
  }

  async addCardDependency(
    cardId: string,
    blockerCardId: string
  ): Promise<AddCardDependencyResponse> {
    this.loadState();
    for (const board of this.boards.values()) {
      const targetCard = board.cards.find((c) => c.id === cardId);
      if (!targetCard) continue;

      const blockerCard = board.cards.find((c) => c.id === blockerCardId);
      if (!blockerCard) {
        throw new Error(`Blocker card ${blockerCardId} not found`);
      }

      const cycleCheck = detectCycleIfAdded(board, cardId, blockerCardId);
      if (cycleCheck.hasCycle) {
        const err = new Error(
          `Circular dependency detected: adding blocker ${blockerCardId} creates a cycle.`
        );
        (err as any).statusCode = 400;
        (err as any).details = {
          card_id: cardId,
          blocker_card_id: blockerCardId,
          cycle_path: cycleCheck.cyclePath,
        };
        throw err;
      }

      if (!targetCard.blocked_by_card_ids.includes(blockerCardId)) {
        const updatedCard: Card = CardSchema.parse({
          ...targetCard,
          blocked_by_card_ids: [...targetCard.blocked_by_card_ids, blockerCardId],
          updated_at: new Date().toISOString(),
        });

        const updatedBoard: Board = {
          ...board,
          cards: board.cards.map((c) => (c.id === cardId ? updatedCard : c)),
        };
        this.saveState(updatedBoard);
        const graph = computeBoardDependencyGraph(updatedBoard);
        return { card: updatedCard, graph };
      }

      const graph = computeBoardDependencyGraph(board);
      return { card: targetCard, graph };
    }
    throw new Error(`Card ${cardId} not found`);
  }

  async removeCardDependency(
    cardId: string,
    blockerCardId: string
  ): Promise<AddCardDependencyResponse> {
    this.loadState();
    for (const board of this.boards.values()) {
      const targetCard = board.cards.find((c) => c.id === cardId);
      if (!targetCard) continue;

      const updatedCard: Card = CardSchema.parse({
        ...targetCard,
        blocked_by_card_ids: targetCard.blocked_by_card_ids.filter((id) => id !== blockerCardId),
        updated_at: new Date().toISOString(),
      });

      const updatedBoard: Board = {
        ...board,
        cards: board.cards.map((c) => (c.id === cardId ? updatedCard : c)),
      };
      this.saveState(updatedBoard);
      const graph = computeBoardDependencyGraph(updatedBoard);
      return { card: updatedCard, graph };
    }
    throw new Error(`Card ${cardId} not found`);
  }

  async aiAnalyzeCriticalPath(boardId: string): Promise<AICriticalPathResponse> {
    this.loadState();
    const board = this.boards.get(boardId) ?? (await this.getBoard(boardId));
    const graph = computeBoardDependencyGraph(board);
    return generateAICriticalPathAnalysis(board, graph);
  }

  // --- Phase 7 Theme Studio Endpoint ---
  async updateBoardTheme(
    boardId: string,
    payload: UpdateBoardThemeRequest
  ): Promise<BoardThemeConfig> {
    this.loadState();
    const board = this.boards.get(boardId) ?? (await this.getBoard(boardId));
    const currentTheme = board.theme_config ?? { ...DEFAULT_THEME_CONFIG };

    let baseTheme = currentTheme;
    if (payload.preset && payload.preset !== currentTheme.preset) {
      baseTheme = { ...THEME_PRESET_CONFIGS[payload.preset] };
    }

    const mergedTheme: BoardThemeConfig = BoardThemeConfigSchema.parse({
      ...baseTheme,
      ...(payload.preset ? { preset: payload.preset } : {}),
      ...(payload.glass_blur !== undefined ? { glass_blur: payload.glass_blur } : {}),
      ...(payload.card_density !== undefined ? { card_density: payload.card_density } : {}),
      ...(payload.card_radius !== undefined ? { card_radius: payload.card_radius } : {}),
      ...(payload.accent_color !== undefined ? { accent_color: payload.accent_color } : {}),
      ...(payload.show_custom_fields_on_front !== undefined
        ? { show_custom_fields_on_front: payload.show_custom_fields_on_front }
        : {}),
      ...(payload.show_dependency_badges_on_front !== undefined
        ? { show_dependency_badges_on_front: payload.show_dependency_badges_on_front }
        : {}),
    });

    const updatedBoard: Board = {
      ...board,
      theme_config: mergedTheme,
    };
    this.saveState(updatedBoard);
    return mergedTheme;
  }

}

export function computeBoardAnalyticsFromBoard(board: Board): BoardAnalytics {
  const activeColumns = board.columns
    .filter((col) => !col.is_archived)
    .sort((a, b) => comparePositions(a.position, b.position));
  const archivedColIds = new Set(
    board.columns.filter((col) => col.is_archived).map((col) => col.id)
  );

  const archivedCardsCount = board.cards.filter(
    (c) => c.is_archived || archivedColIds.has(c.column_id)
  ).length;
  const activeCards = board.cards.filter(
    (c) => !c.is_archived && !archivedColIds.has(c.column_id)
  );

  const doneColIds = new Set(
    activeColumns
      .filter((col) => {
        const lower = col.title.toLowerCase();
        return (
          lower.includes("done") ||
          lower.includes("shipped") ||
          lower.includes("published") ||
          lower.includes("complete")
        );
      })
      .map((col) => col.id)
  );

  const isCardDone = (c: Card): boolean =>
    doneColIds.has(c.column_id) || c.is_due_complete;

  const totalCards = activeCards.length;
  const completedCardsList = activeCards.filter(isCardDone);
  const completedCards = completedCardsList.length;

  const completionRate =
    totalCards > 0
      ? Number(((completedCards / totalCards) * 100).toFixed(1))
      : 0;

  const totalStoryPoints = activeCards.reduce(
    (sum, c) => sum + (c.story_points ?? 0),
    0
  );
  const completedStoryPoints = completedCardsList.reduce(
    (sum, c) => sum + (c.story_points ?? 0),
    0
  );

  const now = Date.now();
  const isCardOverdue = (c: Card): boolean => {
    if (!c.due_date || c.is_due_complete || doneColIds.has(c.column_id)) {
      return false;
    }
    return new Date(c.due_date).getTime() < now;
  };

  const overdueCardsCount = activeCards.filter(isCardOverdue).length;
  const blockedCardsCount = activeCards.filter(
    (c) => c.blocked_by_card_ids.length > 0 && !doneColIds.has(c.column_id)
  ).length;

  let totalChecklistItems = 0;
  let completedChecklistItems = 0;
  for (const c of activeCards) {
    if (c.checklists && c.checklists.length > 0) {
      for (const cl of c.checklists) {
        totalChecklistItems += cl.items.length;
        completedChecklistItems += cl.items.filter((i) => i.is_completed).length;
      }
    } else if (c.subtasks && c.subtasks.length > 0) {
      totalChecklistItems += c.subtasks.length;
      completedChecklistItems += c.subtasks.filter((s) => s.is_completed).length;
    }
  }
  const checklistCompletionRate =
    totalChecklistItems > 0
      ? Number(
          ((completedChecklistItems / totalChecklistItems) * 100).toFixed(1)
        )
      : 0;

  const rulesExecutions = (board.automation_rules ?? []).reduce(
    (sum, r) => sum + (r.execution_count ?? 0),
    0
  );
  const automatedActivities = (board.activities ?? []).filter(
    (a) => a.is_automated
  ).length;
  const automationExecutionsTotal =
    rulesExecutions > 0
      ? rulesExecutions
      : automatedActivities > 0
        ? automatedActivities
        : (board.automation_rules ?? []).filter((r) => r.is_enabled).length * 4;

  const cardsByColumn: ColumnMetric[] = activeColumns.map((col) => {
    const colCards = activeCards.filter((c) => c.column_id === col.id);
    const pts = colCards.reduce((sum, c) => sum + (c.story_points ?? 0), 0);
    const isDoneCol = doneColIds.has(col.id);
    const isBacklogCol =
      col.title.toLowerCase().includes("backlog") ||
      col.title.toLowerCase().includes("to do") ||
      col.title.toLowerCase().includes("ideas");
    const exceedsWip =
      col.wip_limit !== null && colCards.length >= col.wip_limit;
    const highActiveConcentration =
      !isDoneCol &&
      !isBacklogCol &&
      col.wip_limit === null &&
      colCards.length >= 4;

    return {
      column_id: col.id,
      column_title: col.title,
      card_count: colCards.length,
      total_story_points: pts,
      wip_limit: col.wip_limit,
      is_bottleneck: !isDoneCol && (exceedsWip || highActiveConcentration),
    };
  });

  const workloadByMember: MemberWorkload[] = board.members.map((m) => {
    const memberCards = activeCards.filter((c) => c.member_ids.includes(m.id));
    const memberCompleted = memberCards.filter(isCardDone);
    const memberActive = memberCards.filter((c) => !isCardDone(c));
    const activePts = memberActive.reduce(
      (sum, c) => sum + (c.story_points ?? 0),
      0
    );
    const memberOverdue = memberCards.filter(isCardOverdue).length;

    return {
      member_id: m.id,
      member_name: m.name,
      member_initials: m.initials,
      member_color: m.color,
      assigned_cards_count: memberCards.length,
      completed_cards_count: memberCompleted.length,
      active_story_points: activePts,
      overdue_cards_count: memberOverdue,
    };
  });

  const priorityOrder: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];
  const cardsByPriority: PriorityMetric[] = priorityOrder.map((p) => {
    const matching = activeCards.filter((c) => c.priority === p);
    return {
      priority: p,
      count: matching.length,
      story_points: matching.reduce(
        (sum, c) => sum + (c.story_points ?? 0),
        0
      ),
    };
  });

  const cardsByLabel: LabelMetric[] = board.labels.map((lbl) => {
    const count = activeCards.filter((c) => c.label_ids.includes(lbl.id)).length;
    return {
      label_id: lbl.id,
      label_name: lbl.name || lbl.color,
      label_color: lbl.color,
      count,
    };
  });

  // 7-Day Sprint Burndown Series
  const totalPts = Math.max(totalStoryPoints, 10);
  const remainingNow = Math.max(totalStoryPoints - completedStoryPoints, 0);
  const deliveredSoFar = Math.max(totalPts - remainingNow, 0);
  const dailyBurn = deliveredSoFar / 6;

  const burndownSeries: BurndownDataPoint[] = Array.from(
    { length: 7 },
    (_, idx) => {
      const dayNum = idx + 1;
      const ideal = Math.max(
        0,
        Number((totalPts - (totalPts / 6) * idx).toFixed(1))
      );
      let actual: number;
      let dailyCompletedCards: number;
      if (idx === 0) {
        actual = totalPts;
        dailyCompletedCards = 0;
      } else if (idx === 6) {
        actual = remainingNow;
        dailyCompletedCards = completedCards;
      } else {
        // Realistic sprint curve with slight mid-sprint plateau before acceleration
        const progressFactor =
          idx === 1
            ? 0.12
            : idx === 2
              ? 0.25
              : idx === 3
                ? 0.42
                : idx === 4
                  ? 0.68
                  : 0.85;
        actual = Math.max(
          0,
          Number((totalPts - deliveredSoFar * progressFactor).toFixed(1))
        );
        dailyCompletedCards = Math.min(
          completedCards,
          Math.round(completedCards * progressFactor)
        );
      }

      // Ensure we also reflect daily burn
      void dailyBurn;

      return {
        date: `Day ${dayNum}`,
        ideal_remaining_points: ideal,
        actual_remaining_points: actual,
        completed_cards_count: dailyCompletedCards,
      };
    }
  );

  return BoardAnalyticsSchema.parse({
    board_id: board.id,
    total_cards: totalCards,
    completed_cards: completedCards,
    archived_cards: archivedCardsCount,
    completion_rate: completionRate,
    total_story_points: totalStoryPoints,
    completed_story_points: completedStoryPoints,
    overdue_cards_count: overdueCardsCount,
    blocked_cards_count: blockedCardsCount,
    checklist_completion_rate: checklistCompletionRate,
    automation_executions_total: automationExecutionsTotal,
    cards_by_column: cardsByColumn,
    workload_by_member: workloadByMember,
    cards_by_priority: cardsByPriority,
    cards_by_label: cardsByLabel,
    burndown_series: burndownSeries,
  });
}

export function synthesizeAIAnalyticsReport(
  boardTitle: string,
  analytics: BoardAnalytics
): AIAnalyticsReport {
  const bottleneckCols = analytics.cards_by_column.filter(
    (c) => c.is_bottleneck
  );

  // Compute health score (0-100)
  let score = 62 + Math.round(analytics.completion_rate * 0.35);
  score += Math.round(analytics.checklist_completion_rate * 0.08);
  score -= analytics.overdue_cards_count * 7;
  score -= analytics.blocked_cards_count * 8;
  score -= bottleneckCols.length * 6;
  score = Math.max(18, Math.min(98, score));

  let status: SprintHealthStatus = "ON_TRACK";
  if (score >= 82) status = "EXCELLENT";
  else if (score >= 65) status = "ON_TRACK";
  else if (score >= 45) status = "AT_RISK";
  else status = "CRITICAL";

  const remainingPts = Math.max(
    0,
    analytics.total_story_points - analytics.completed_story_points
  );

  const summary = `**${boardTitle}** is operating at **${analytics.completion_rate}% card completion** (${analytics.completed_cards}/${analytics.total_cards} cards) with **${analytics.completed_story_points}/${analytics.total_story_points} story points** delivered (${remainingPts} pts remaining) and **${analytics.checklist_completion_rate}%** checklist completion.${
    bottleneckCols.length > 0 || analytics.overdue_cards_count > 0
      ? ` Attention is required on **${bottleneckCols.length} workflow bottleneck(s)**, **${analytics.overdue_cards_count} overdue card(s)**, and **${analytics.blocked_cards_count} active blocker(s)**.`
      : " Workflow throughput is smooth with zero critical WIP breaches."
  }`;

  const bottlenecks: string[] = [];
  for (const col of bottleneckCols) {
    if (col.wip_limit !== null) {
      bottlenecks.push(
        `Column '${col.column_title}' is at or above its WIP limit (${col.card_count} active cards vs WIP limit of ${col.wip_limit}, carrying ${col.total_story_points} story points).`
      );
    } else {
      bottlenecks.push(
        `Column '${col.column_title}' has a high concentration of ${col.card_count} active cards (${col.total_story_points} story points) without a WIP cap.`
      );
    }
  }

  if (analytics.overdue_cards_count > 0 || analytics.blocked_cards_count > 0) {
    bottlenecks.push(
      `${analytics.overdue_cards_count} card(s) are currently past their due date and ${analytics.blocked_cards_count} card(s) are flagged as blocked by upstream dependencies.`
    );
  }

  const sortedMembers = [...analytics.workload_by_member].sort(
    (a, b) => b.active_story_points - a.active_story_points
  );
  if (sortedMembers.length > 0 && sortedMembers[0].active_story_points > 0) {
    const top = sortedMembers[0];
    bottlenecks.push(
      `${top.member_name} is carrying the highest active load (${top.active_story_points} active story points across ${Math.max(0, top.assigned_cards_count - top.completed_cards_count)} open cards${top.overdue_cards_count > 0 ? `, with ${top.overdue_cards_count} overdue` : ""}).`
    );
  }

  if (bottlenecks.length === 0) {
    bottlenecks.push(
      "No severe WIP limit breaches or overdue blockers detected across active sprint lists."
    );
  }

  const recommendations: string[] = [];
  if (analytics.blocked_cards_count > 0) {
    recommendations.push(
      `Swarm on the ${analytics.blocked_cards_count} blocked card(s) first to unblock downstream engineering dependencies before starting new backlog items.`
    );
  }
  if (bottleneckCols.length > 0) {
    recommendations.push(
      `Pause new pull-ins into '${bottleneckCols[0].column_title}' until at least 1–2 in-flight cards transition to Review or Done.`
    );
  }
  if (sortedMembers.length >= 2) {
    const heaviest = sortedMembers[0];
    const lightest = sortedMembers[sortedMembers.length - 1];
    if (heaviest.active_story_points > lightest.active_story_points + 3) {
      recommendations.push(
        `Rebalance 1 High/Urgent card (~3–5 pts) from ${heaviest.member_name} (${heaviest.active_story_points} active pts) to ${lightest.member_name} (${lightest.active_story_points} active pts).`
      );
    }
  }
  if (analytics.overdue_cards_count > 0) {
    recommendations.push(
      `Audit and re-baseline due dates for the ${analytics.overdue_cards_count} overdue card(s) during the next daily standup.`
    );
  }
  recommendations.push(
    `Leverage Butler Automation rules (${analytics.automation_executions_total} automated actions executed so far) to auto-triage incoming Urgent cards and auto-complete Done checklists.`
  );

  return AIAnalyticsReportSchema.parse({
    health_score: score,
    health_status: status,
    executive_summary: summary,
    bottlenecks,
    actionable_recommendations: recommendations.slice(0, 5),
    generated_at: new Date().toISOString(),
  });
}

export function generateBoardCsvExport(board: Board): BoardExportCsvResponse {
  const slug =
    board.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "board";
  const filename = `${slug}-export.csv`;

  const colMap = new Map(board.columns.map((c) => [c.id, c.title]));
  const labelMap = new Map(
    board.labels.map((l) => [l.id, l.name || l.color])
  );
  const memberMap = new Map(board.members.map((m) => [m.id, m.name]));

  const escapeCsv = (val: string | number | boolean | null | undefined) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    "Card ID",
    "Title",
    "Column",
    "Priority",
    "Story Points",
    "Labels",
    "Members",
    "Due Date",
    "Due Complete",
    "Checklist Progress",
    "Blocked By",
    "Updated At",
  ];

  const rows = board.cards
    .filter((c) => !c.is_archived)
    .map((card) => {
      const colTitle = colMap.get(card.column_id) ?? "Unknown";
      const labels = card.label_ids
        .map((id) => labelMap.get(id))
        .filter(Boolean)
        .join("; ");
      const members = card.member_ids
        .map((id) => memberMap.get(id))
        .filter(Boolean)
        .join("; ");

      let totalChk = 0;
      let doneChk = 0;
      for (const cl of card.checklists ?? []) {
        totalChk += cl.items.length;
        doneChk += cl.items.filter((i) => i.is_completed).length;
      }
      const chkProgress = totalChk > 0 ? `${doneChk}/${totalChk}` : "0/0";
      const blockedBy = card.blocked_by_card_ids.join("; ");

      return [
        escapeCsv(card.id),
        escapeCsv(card.title),
        escapeCsv(colTitle),
        escapeCsv(card.priority),
        card.story_points ?? "",
        escapeCsv(labels),
        escapeCsv(members),
        escapeCsv(card.due_date ?? ""),
        card.is_due_complete,
        escapeCsv(chkProgress),
        escapeCsv(blockedBy),
        escapeCsv(card.updated_at),
      ].join(",");
    });

  const csvData = [headers.join(","), ...rows].join("\n");

  return BoardExportCsvResponseSchema.parse({
    filename,
    content_type: "text/csv",
    csv_data: csvData,
  });
}

export function parseTrelloOrKinetixImport(
  request: TrelloImportRequest,
  fallbackWorkspaceId: string
): TrelloImportResult {
  const rawPayload = request.payload as Record<string, any>;
  const workspaceId = request.workspace_id || fallbackWorkspaceId;
  const newBoardId = createDeterministicUuid();
  const nowIso = new Date().toISOString();

  // Check if it is already a Kinetix Board backup format (has columns & cards arrays)
  const isKinetixFormat =
    request.format === "kinetix_json" ||
    (Array.isArray(rawPayload?.columns) && !Array.isArray(rawPayload?.lists));

  if (isKinetixFormat && Array.isArray(rawPayload?.columns)) {
    const colIdMap = new Map<string, string>();
    const labelIdMap = new Map<string, string>();

    const columns: Column[] = (rawPayload.columns as any[]).map((col, idx) => {
      const nextColId = createDeterministicUuid();
      if (col.id) colIdMap.set(String(col.id), nextColId);
      return ColumnSchema.parse({
        id: nextColId,
        board_id: newBoardId,
        title: String(col.title || `List ${idx + 1}`).slice(0, 100),
        position: typeof col.position === "string" ? col.position : `a${idx}`,
        wip_limit: typeof col.wip_limit === "number" ? col.wip_limit : null,
        color: typeof col.color === "string" ? col.color : null,
        is_archived: Boolean(col.is_archived),
      });
    });

    const labels: Label[] = Array.isArray(rawPayload.labels)
      ? (rawPayload.labels as any[]).map((l) => {
          const nextLblId = createDeterministicUuid();
          if (l.id) labelIdMap.set(String(l.id), nextLblId);
          const parsedColor = LabelColorEnum.safeParse(l.color);
          return {
            id: nextLblId,
            board_id: newBoardId,
            name: String(l.name ?? "").slice(0, 100),
            color: parsedColor.success ? parsedColor.data : "blue",
          };
        })
      : DEFAULT_BOARD_LABELS.map((l) => ({ ...l, board_id: newBoardId }));

    let totalChecklistsCount = 0;
    const fallbackColId = columns[0]?.id ?? createDeterministicUuid();

    const cards: Card[] = Array.isArray(rawPayload.cards)
      ? (rawPayload.cards as any[]).map((c, idx) => {
          const mappedColId =
            colIdMap.get(String(c.column_id)) ?? fallbackColId;
          const mappedLabels = Array.isArray(c.label_ids)
            ? c.label_ids
                .map((id: string) => labelIdMap.get(String(id)) ?? id)
                .filter(Boolean)
            : [];
          const checklists: Checklist[] = Array.isArray(c.checklists)
            ? c.checklists.map((cl: any, clIdx: number) => {
                totalChecklistsCount += 1;
                return {
                  id: createDeterministicUuid(),
                  title: String(cl.title || "Checklist").slice(0, 150),
                  position: `a${clIdx}`,
                  items: Array.isArray(cl.items)
                    ? cl.items.map((item: any, itemIdx: number) => ({
                        id: createDeterministicUuid(),
                        title: String(item.title || "Item").slice(0, 280),
                        is_completed: Boolean(item.is_completed),
                        position: `a${itemIdx}`,
                        due_date: null,
                        assignee_id: null,
                      }))
                    : [],
                };
              })
            : [];
          const synced = syncSubtasksAndChecklists(undefined, checklists);

          return CardSchema.parse({
            id: createDeterministicUuid(),
            board_id: newBoardId,
            column_id: mappedColId,
            title: String(c.title || `Imported Card ${idx + 1}`).slice(0, 255),
            description: String(c.description || ""),
            position: typeof c.position === "string" ? c.position : `a${idx}`,
            priority: PriorityEnumSafe(c.priority),
            story_points:
              typeof c.story_points === "number" ? c.story_points : 3,
            tags: Array.isArray(c.tags) ? c.tags.map(String) : ["imported"],
            subtasks: synced.subtasks,
            blocked_by_card_ids: [],
            due_date:
              typeof c.due_date === "string" && !isNaN(Date.parse(c.due_date))
                ? new Date(c.due_date).toISOString()
                : null,
            updated_at: nowIso,
            cover: c.cover ?? { type: "none", value: null, size: "normal" },
            label_ids: mappedLabels,
            member_ids: Array.isArray(c.member_ids)
              ? c.member_ids
              : [MEMBER_ALEX],
            checklists: synced.checklists,
            comments: [],
            attachments: [],
            start_date: null,
            is_due_complete: Boolean(c.is_due_complete),
            is_archived: Boolean(c.is_archived),
            is_watching: false,
          });
        })
      : [];

    const boardTitle = (
      request.board_title_override?.trim() ||
      String(rawPayload.title || rawPayload.name || "Imported Kanbanify Board")
    ).slice(0, 150);

    const newBoard: Board = sortBoardEntities(
      BoardSchema.parse({
        id: newBoardId,
        workspace_id: workspaceId,
        title: boardTitle,
        description: String(
          rawPayload.description ||
            rawPayload.desc ||
            "Imported from Kanbanify JSON backup"
        ),
        is_starred: Boolean(rawPayload.is_starred),
        background: rawPayload.background ?? {
          type: "gradient",
          value:
            "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
        },
        columns,
        cards,
        labels,
        members: DEFAULT_BOARD_MEMBERS.map((m) => ({ ...m })),
        activities: [
          {
            id: createDeterministicUuid(),
            board_id: newBoardId,
            card_id: null,
            actor_name: "Alex Rivera",
            action_type: "CARD_CREATED",
            description: `imported board "${boardTitle}" (${columns.length} lists, ${cards.length} cards)`,
            created_at: nowIso,
            is_automated: false,
          },
        ],
        automation_rules: cloneDefaultAutomationRules(newBoardId),
        webhooks: [],
        created_at: nowIso,
      })
    );

    return TrelloImportResultSchema.parse({
      board: newBoard,
      imported_lists_count: columns.length,
      imported_cards_count: cards.length,
      imported_checklists_count: totalChecklistsCount,
    });
  }

  // Native Trello JSON Import Format (`lists`, `cards`, `checklists`, `labels`)
  const rawLists = Array.isArray(rawPayload?.lists)
    ? (rawPayload.lists as any[]).filter((l) => !l.closed)
    : [];
  const rawCards = Array.isArray(rawPayload?.cards)
    ? (rawPayload.cards as any[]).filter((c) => !c.closed)
    : [];
  const rawChecklists = Array.isArray(rawPayload?.checklists)
    ? (rawPayload.checklists as any[])
    : [];

  const listIdToColId = new Map<string, string>();
  const colColors = ["#64748b", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];

  let prevColPos: string | undefined = undefined;
  const columns: Column[] = (
    rawLists.length > 0
      ? rawLists
      : [
          { id: "tl-1", name: "To Do" },
          { id: "tl-2", name: "In Progress" },
          { id: "tl-3", name: "Review" },
          { id: "tl-4", name: "Done" },
        ]
  ).map((tList, idx) => {
    const colId = createDeterministicUuid();
    if (tList.id) listIdToColId.set(String(tList.id), colId);
    const pos = generatePositionBetween(prevColPos, undefined);
    prevColPos = pos;

    return ColumnSchema.parse({
      id: colId,
      board_id: newBoardId,
      title: String(tList.name || tList.title || `List ${idx + 1}`).slice(
        0,
        100
      ),
      position: pos,
      wip_limit: idx === 1 ? 4 : null,
      color: colColors[idx % colColors.length],
      is_archived: false,
    });
  });

  const boardLabels: Label[] = DEFAULT_BOARD_LABELS.map((l) => ({
    ...l,
    board_id: newBoardId,
  }));

  const resolveTrelloLabelIds = (trelloLabels: any[]): string[] => {
    if (!Array.isArray(trelloLabels)) return [];
    const matchedIds: string[] = [];
    for (const tl of trelloLabels) {
      const nameStr = String(tl?.name || "").toLowerCase();
      const colorStr = String(tl?.color || "blue").toLowerCase();
      let found = boardLabels.find(
        (bl) =>
          (nameStr && bl.name.toLowerCase() === nameStr) ||
          bl.color.toLowerCase() === colorStr
      );
      if (!found) {
        const validColor = LabelColorEnum.safeParse(colorStr);
        found = {
          id: createDeterministicUuid(),
          board_id: newBoardId,
          name: String(tl?.name || colorStr).slice(0, 100),
          color: validColor.success ? validColor.data : "blue",
        };
        boardLabels.push(found);
      }
      if (!matchedIds.includes(found.id)) {
        matchedIds.push(found.id);
      }
    }
    return matchedIds;
  };

  // Track last card position per column for clean fractional indexing
  const lastCardPosByCol = new Map<string, string>();
  let importedChecklistsCount = 0;

  const cards: Card[] = rawCards.map((tc, idx) => {
    const targetColId =
      listIdToColId.get(String(tc.idList || tc.column_id)) ?? columns[0].id;
    const prevPos = lastCardPosByCol.get(targetColId);
    const cardPos = generatePositionBetween(prevPos, undefined);
    lastCardPosByCol.set(targetColId, cardPos);

    // Match checklists from top-level `checklists` by `idCard` OR inline `tc.checklists`
    const matchingRawChecklists = [
      ...rawChecklists.filter((chk) => String(chk.idCard) === String(tc.id)),
      ...(Array.isArray(tc.checklists) ? tc.checklists : []),
    ];

    let prevChkPos: string | undefined = undefined;
    const cardChecklists: Checklist[] = matchingRawChecklists.map(
      (chk: any, chkIdx: number) => {
        importedChecklistsCount += 1;
        const chkPos = generatePositionBetween(prevChkPos, undefined);
        prevChkPos = chkPos;
        const rawItems = Array.isArray(chk.checkItems)
          ? chk.checkItems
          : Array.isArray(chk.items)
            ? chk.items
            : [];
        let prevItemPos: string | undefined = undefined;
        return {
          id: createDeterministicUuid(),
          title: String(chk.name || chk.title || `Checklist ${chkIdx + 1}`).slice(
            0,
            150
          ),
          position: chkPos,
          items: rawItems.map((item: any, itemIdx: number) => {
            const itemPos = generatePositionBetween(prevItemPos, undefined);
            prevItemPos = itemPos;
            const isComplete =
              item.state === "complete" || Boolean(item.is_completed);
            return {
              id: createDeterministicUuid(),
              title: String(item.name || item.title || `Step ${itemIdx + 1}`).slice(
                0,
                280
              ),
              is_completed: isComplete,
              position: itemPos,
              due_date: null,
              assignee_id: DEFAULT_BOARD_MEMBERS[idx % DEFAULT_BOARD_MEMBERS.length].id,
            };
          }),
        };
      }
    );

    const synced = syncSubtasksAndChecklists(undefined, cardChecklists);
    const labelIds = resolveTrelloLabelIds(tc.labels);

    const dueIso =
      typeof tc.due === "string" && !isNaN(Date.parse(tc.due))
        ? new Date(tc.due).toISOString()
        : typeof tc.due_date === "string" && !isNaN(Date.parse(tc.due_date))
          ? new Date(tc.due_date).toISOString()
          : null;

    // Infer priority & story points from labels or title
    const hasRedLabel = tc.labels?.some((l: any) => l.color === "red");
    const hasOrangeLabel = tc.labels?.some((l: any) => l.color === "orange");
    const priority: Priority = tc.priority
      ? PriorityEnumSafe(tc.priority)
      : hasRedLabel
        ? "URGENT"
        : hasOrangeLabel
          ? "HIGH"
          : idx % 3 === 0
            ? "HIGH"
            : "MEDIUM";

    const storyPoints =
      typeof tc.story_points === "number"
        ? tc.story_points
        : Math.max(2, Math.min(8, (synced.subtasks.length || 1) * 2 + 1));

    const assignedMember =
      DEFAULT_BOARD_MEMBERS[idx % DEFAULT_BOARD_MEMBERS.length].id;

    return CardSchema.parse({
      id: createDeterministicUuid(),
      board_id: newBoardId,
      column_id: targetColId,
      title: String(tc.name || tc.title || `Trello Card ${idx + 1}`).slice(
        0,
        255
      ),
      description: String(tc.desc || tc.description || ""),
      position: cardPos,
      priority,
      story_points: storyPoints,
      tags: ["trello-import"],
      subtasks: synced.subtasks,
      blocked_by_card_ids: [],
      due_date: dueIso,
      updated_at: nowIso,
      cover: { type: "none", value: null, size: "normal" },
      label_ids: labelIds,
      member_ids: [assignedMember],
      checklists: synced.checklists,
      comments: [],
      attachments: [],
      start_date: null,
      is_due_complete: Boolean(tc.dueComplete || tc.is_due_complete),
      is_archived: false,
      is_watching: false,
    });
  });

  const boardTitle = (
    request.board_title_override?.trim() ||
    String(rawPayload?.name || rawPayload?.title || "Imported Trello Board")
  ).slice(0, 150);

  const newBoard: Board = sortBoardEntities(
    BoardSchema.parse({
      id: newBoardId,
      workspace_id: workspaceId,
      title: boardTitle,
      description: String(
        rawPayload?.desc ||
          rawPayload?.description ||
          "Imported directly from Trello JSON export with fractional indexing."
      ),
      is_starred: true,
      background: {
        type: "gradient",
        value:
          "linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0d9488 100%)",
      },
      columns,
      cards,
      labels: boardLabels,
      members: DEFAULT_BOARD_MEMBERS.map((m) => ({ ...m })),
      activities: [
        {
          id: createDeterministicUuid(),
          board_id: newBoardId,
          card_id: null,
          actor_name: "Alex Rivera",
          action_type: "CARD_CREATED",
          description: `imported Trello board "${boardTitle}" (${columns.length} lists, ${cards.length} cards, ${importedChecklistsCount} checklists)`,
          created_at: nowIso,
          is_automated: false,
        },
      ],
      automation_rules: cloneDefaultAutomationRules(newBoardId),
      webhooks: [],
      invite_links: [],
      visibility: "WORKSPACE",
      created_at: nowIso,
    })
  );

  return TrelloImportResultSchema.parse({
    board: newBoard,
    imported_lists_count: columns.length,
    imported_cards_count: cards.length,
    imported_checklists_count: importedChecklistsCount,
  });
}

function PriorityEnumSafe(val: unknown): Priority {
  if (
    val === "LOW" ||
    val === "MEDIUM" ||
    val === "HIGH" ||
    val === "URGENT"
  ) {
    return val;
  }
  return "MEDIUM";
}

export const SAMPLE_TRELLO_EXPORT_JSON = {
  name: "Trello Cloud Migration & Q4 Release",
  desc: "Full Trello board export with Lists, Cards, Labels, Due Dates, and Checklists ready for 1-click Kanbanify import.",
  lists: [
    { id: "trello-list-1", name: "Backlog & Discovery", closed: false },
    { id: "trello-list-2", name: "In Progress (Sprint 14)", closed: false },
    { id: "trello-list-3", name: "Code Review & QA", closed: false },
    { id: "trello-list-4", name: "Done & Shipped", closed: false },
  ],
  cards: [
    {
      id: "trello-card-1",
      name: "Migrate legacy Trello boards to Kanbanify O(1) engine",
      desc: "Support full JSON lists, cards, color labels, due dates, and multi-item checklists with lexicographical fractional positions.",
      idList: "trello-list-2",
      due: "2026-11-18T00:00:00.000Z",
      dueComplete: false,
      closed: false,
      labels: [
        { id: "tl-1", name: "Ship Ready", color: "green" },
        { id: "tl-2", name: "Architecture", color: "blue" },
      ],
    },
    {
      id: "trello-card-2",
      name: "Zero-dependency Interactive SVG Sprint Burndown Chart",
      desc: "Render crisp dual-line Ideal vs Actual remaining story points with daily completed cards bars and hover tooltips.",
      idList: "trello-list-2",
      due: "2026-11-16T00:00:00.000Z",
      dueComplete: false,
      closed: false,
      labels: [{ id: "tl-3", name: "AI Assisted", color: "purple" }],
    },
    {
      id: "trello-card-3",
      name: "Executive AI Sprint Health & Bottleneck Analyzer",
      desc: "Compute real-time board velocity, WIP limit breaches, and overloaded member workloads for executive AI briefings.",
      idList: "trello-list-3",
      due: "2026-11-14T00:00:00.000Z",
      dueComplete: false,
      closed: false,
      labels: [
        { id: "tl-4", name: "AI Assisted", color: "purple" },
        { id: "tl-5", name: "Needs Spec", color: "yellow" },
      ],
    },
    {
      id: "trello-card-4",
      name: "Audit SSO & SAML 2.0 Enterprise Role Mapping",
      desc: "Ensure workspace roles map cleanly from Okta and Azure AD groups.",
      idList: "trello-list-1",
      due: "2026-11-22T00:00:00.000Z",
      dueComplete: false,
      closed: false,
      labels: [{ id: "tl-6", name: "Tech Debt", color: "orange" }],
    },
    {
      id: "trello-card-5",
      name: "Establish Polyglot Zod + Pydantic Contract Gate",
      desc: "Completed foundational schema lock across Next.js, Fastify, and FastAPI services.",
      idList: "trello-list-4",
      due: "2026-11-08T00:00:00.000Z",
      dueComplete: true,
      closed: false,
      labels: [{ id: "tl-1", name: "Ship Ready", color: "green" }],
    },
  ],
  checklists: [
    {
      id: "trello-chk-1",
      idCard: "trello-card-1",
      name: "Trello Importer Verification",
      checkItems: [
        {
          name: "Parse Trello lists and generate fractional positions (a0, a1, a2)",
          state: "complete",
        },
        {
          name: "Map cards, labels, and checklists to Kanbanify Zod schema",
          state: "complete",
        },
        {
          name: "Auto-switch active workspace board upon import completion",
          state: "incomplete",
        },
      ],
    },
    {
      id: "trello-chk-2",
      idCard: "trello-card-2",
      name: "SVG Chart Craftsmanship",
      checkItems: [
        {
          name: "Build responsive viewBox with dashed Ideal vs solid Actual curves",
          state: "complete",
        },
        {
          name: "Verify interactive hover tooltip in Light and Dark mode",
          state: "incomplete",
        },
      ],
    },
    {
      id: "trello-chk-3",
      idCard: "trello-card-3",
      name: "AI Report Deliverables",
      checkItems: [
        {
          name: "Circular health score gauge (0-100) with status badge",
          state: "complete",
        },
        {
          name: "Detected bottlenecks and actionable recommendations checklist",
          state: "complete",
        },
      ],
    },
  ],
};

export const mockApi = new MockApiService();
