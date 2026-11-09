import { z } from "zod";

// ============================================================================
// 1. ENUMS & FRACTIONAL INDEXING PRIMITIVES
// ============================================================================

export const PriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export type Priority = z.infer<typeof PriorityEnum>;

export const LabelColorEnum = z.enum([
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
  "blue",
  "sky",
  "lime",
  "pink",
  "black",
]);
export type LabelColor = z.infer<typeof LabelColorEnum>;

export const ActivityActionTypeEnum = z.enum([
  "CARD_CREATED",
  "CARD_MOVED",
  "CARD_ARCHIVED",
  "COMMENT_ADDED",
  "CHECKLIST_COMPLETED",
  "MEMBER_ASSIGNED",
  "AUTOMATION_TRIGGERED",
]);
export type ActivityActionType = z.infer<typeof ActivityActionTypeEnum>;

export const AttachmentTypeEnum = z.enum(["link", "image", "file"]);
export type AttachmentType = z.infer<typeof AttachmentTypeEnum>;

export const CardCoverTypeEnum = z.enum(["none", "color", "image"]);
export type CardCoverType = z.infer<typeof CardCoverTypeEnum>;

export const CardCoverSizeEnum = z.enum(["normal", "full"]);
export type CardCoverSize = z.infer<typeof CardCoverSizeEnum>;

export const BoardBackgroundTypeEnum = z.enum(["gradient", "solid", "image"]);
export type BoardBackgroundType = z.infer<typeof BoardBackgroundTypeEnum>;

export const BoardTemplateCategoryEnum = z.enum([
  "ENGINEERING",
  "MARKETING",
  "PRODUCT",
  "PERSONAL",
]);
export type BoardTemplateCategory = z.infer<typeof BoardTemplateCategoryEnum>;

export const AutomationTriggerTypeEnum = z.enum([
  "WHEN_CARD_MOVED_TO_COLUMN",
  "WHEN_CARD_CREATED",
  "WHEN_CHECKLIST_COMPLETED",
  "WHEN_PRIORITY_CHANGED",
  "WHEN_LABEL_ADDED",
]);
export type AutomationTriggerType = z.infer<typeof AutomationTriggerTypeEnum>;

export const AutomationActionTypeEnum = z.enum([
  "MARK_DUE_DATE_COMPLETE",
  "ASSIGN_MEMBER",
  "ADD_LABEL",
  "SET_PRIORITY",
  "MOVE_CARD_TO_COLUMN",
  "ADD_CHECKLIST",
  "POST_COMMENT",
]);
export type AutomationActionType = z.infer<typeof AutomationActionTypeEnum>;

/**
 * Lexicographical fractional index string (e.g., "a0", "a1", "a0V")
 * enabling O(1) single-row updates during drag-and-drop reordering.
 */
export const FractionalIndexSchema = z.string().min(1).max(64);
export type FractionalIndex = z.infer<typeof FractionalIndexSchema>;

export const DEFAULT_BOARD_COLUMNS = [
  { title: "Backlog", position: "a0" },
  { title: "In Progress", position: "a1" },
  { title: "Review", position: "a2" },
  { title: "Done", position: "a3" },
] as const;

export const DEFAULT_BOARD_LABELS = [
  { id: "77777777-7777-4777-8777-777777777771", name: "Ship Ready", color: "green" },
  { id: "77777777-7777-4777-8777-777777777772", name: "Needs Spec", color: "yellow" },
  { id: "77777777-7777-4777-8777-777777777773", name: "Tech Debt", color: "orange" },
  { id: "77777777-7777-4777-8777-777777777774", name: "Blocker", color: "red" },
  { id: "77777777-7777-4777-8777-777777777775", name: "AI Assisted", color: "purple" },
  { id: "77777777-7777-4777-8777-777777777776", name: "Architecture", color: "blue" },
] as const;

export const DEFAULT_BOARD_MEMBERS = [
  {
    id: "88888888-8888-4888-8888-888888888881",
    name: "Alex Rivera",
    email: "alex@kinetix.dev",
    avatar_url: null,
    initials: "AR",
    color: "#3b82f6",
  },
  {
    id: "88888888-8888-4888-8888-888888888882",
    name: "Maya Lin",
    email: "maya@kinetix.dev",
    avatar_url: null,
    initials: "ML",
    color: "#8b5cf6",
  },
  {
    id: "88888888-8888-4888-8888-888888888883",
    name: "Samir Patel",
    email: "samir@kinetix.dev",
    avatar_url: null,
    initials: "SP",
    color: "#10b981",
  },
  {
    id: "88888888-8888-4888-8888-888888888884",
    name: "Elena Rostova",
    email: "elena@kinetix.dev",
    avatar_url: null,
    initials: "ER",
    color: "#f59e0b",
  },
] as const;

export const DEFAULT_WORKSPACE = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Kinetix Engineering",
  slug: "kinetix-engineering",
  description: "Core workspace for high-velocity software engineering and releases",
  logo_color: "#6366f1",
  created_at: "2026-11-08T00:00:00.000Z",
} as const;

export const DEFAULT_BOARD_TEMPLATES = [
  {
    id: "template-engineering-sprint",
    name: "Engineering Sprint",
    description: "Agile 2-week sprint board with Backlog, In Progress, Review, and Done columns with Butler automation.",
    category: "ENGINEERING" as const,
    background: {
      type: "gradient" as const,
      value: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
    },
    default_columns: ["Backlog", "In Progress", "Review", "Done"],
    sample_cards_count: 5,
  },
  {
    id: "template-marketing-launch",
    name: "Marketing Launch",
    description: "Campaign pipeline for content creation, asset review, approvals, and scheduled deployment.",
    category: "MARKETING" as const,
    background: {
      type: "gradient" as const,
      value: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #831843 100%)",
    },
    default_columns: ["Ideas", "Drafting", "Creative Review", "Scheduled", "Published"],
    sample_cards_count: 4,
  },
  {
    id: "template-product-roadmap",
    name: "Product Roadmap",
    description: "Quarterly strategic roadmap tracking feature discovery, validation, active builds, and releases.",
    category: "PRODUCT" as const,
    background: {
      type: "gradient" as const,
      value: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)",
    },
    default_columns: ["Discovery", "Planned Q1", "Planned Q2", "In Development", "Shipped"],
    sample_cards_count: 6,
  },
  {
    id: "template-personal-kanban",
    name: "Personal Kanban",
    description: "Simple WIP-limited personal productivity board for daily focus, todos, and weekly review.",
    category: "PERSONAL" as const,
    background: {
      type: "gradient" as const,
      value: "linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%)",
    },
    default_columns: ["To Do", "Doing (Today)", "Waiting / On Hold", "Done"],
    sample_cards_count: 3,
  },
] as const;

export const DEFAULT_BOARD_AUTOMATION_RULES = [
  {
    id: "66666666-6666-4666-8666-666666666661",
    board_id: "11111111-1111-4111-8111-111111111111",
    name: "Auto-Complete & Tag Done Cards",
    description: "When card is moved to Done, mark due date as complete and add Ship Ready label",
    is_enabled: true,
    trigger: {
      type: "WHEN_CARD_MOVED_TO_COLUMN" as const,
      column_id: null,
      column_title_match: "Done",
      priority: null,
      label_id: null,
    },
    actions: [
      {
        type: "MARK_DUE_DATE_COMPLETE" as const,
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
        type: "ADD_LABEL" as const,
        label_id: "77777777-7777-4777-8777-777777777771", // Ship Ready
        member_id: null,
        priority: null,
        target_column_id: null,
        checklist_title: null,
        checklist_items: null,
        comment_text: null,
        due_complete_value: null,
      },
      {
        type: "POST_COMMENT" as const,
        comment_text: "🤖 Butler automated: Card marked complete & tagged Ship Ready.",
        member_id: null,
        label_id: null,
        priority: null,
        target_column_id: null,
        checklist_title: null,
        checklist_items: null,
        due_complete_value: null,
      },
    ],
    execution_count: 0,
    last_triggered_at: null,
    created_at: "2026-11-08T00:00:00.000Z",
  },
  {
    id: "66666666-6666-4666-8666-666666666662",
    board_id: "11111111-1111-4111-8111-111111111111",
    name: "Urgent Card Escalation",
    description: "When card priority is set to URGENT, auto-assign lead member and add Blocker label",
    is_enabled: true,
    trigger: {
      type: "WHEN_PRIORITY_CHANGED" as const,
      column_id: null,
      column_title_match: null,
      priority: "URGENT" as const,
      label_id: null,
    },
    actions: [
      {
        type: "ADD_LABEL" as const,
        label_id: "77777777-7777-4777-8777-777777777774", // Blocker
        member_id: null,
        priority: null,
        target_column_id: null,
        checklist_title: null,
        checklist_items: null,
        comment_text: null,
        due_complete_value: null,
      },
      {
        type: "ASSIGN_MEMBER" as const,
        member_id: "88888888-8888-4888-8888-888888888881", // Alex Rivera
        label_id: null,
        priority: null,
        target_column_id: null,
        checklist_title: null,
        checklist_items: null,
        comment_text: null,
        due_complete_value: null,
      },
      {
        type: "POST_COMMENT" as const,
        comment_text: "🤖 Butler automated: Urgent card escalated to Alex Rivera with Blocker label.",
        member_id: null,
        label_id: null,
        priority: null,
        target_column_id: null,
        checklist_title: null,
        checklist_items: null,
        due_complete_value: null,
      },
    ],
    execution_count: 0,
    last_triggered_at: null,
    created_at: "2026-11-08T00:00:00.000Z",
  },
] as const;

// ============================================================================
// 2. CORE ENTITIES & TRELLO RICH WORKSPACE SCHEMAS
// ============================================================================

export const MemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  avatar_url: z.string().nullable().default(null),
  initials: z.string().min(1).max(4),
  color: z.string().min(1).default("#3b82f6"),
});
export type Member = z.infer<typeof MemberSchema>;

export const LabelSchema = z.object({
  id: z.string().min(1),
  board_id: z.string().min(1),
  name: z.string().max(100).default(""),
  color: LabelColorEnum,
});
export type Label = z.infer<typeof LabelSchema>;

export const SubtaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(280),
  is_completed: z.boolean().default(false),
  position: FractionalIndexSchema,
});
export type Subtask = z.infer<typeof SubtaskSchema>;

export const ChecklistItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(280),
  is_completed: z.boolean().default(false),
  position: FractionalIndexSchema,
  due_date: z.string().nullable().default(null),
  assignee_id: z.string().nullable().default(null),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const ChecklistSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(150).default("Checklist"),
  position: FractionalIndexSchema,
  items: z.array(ChecklistItemSchema).default([]),
});
export type Checklist = z.infer<typeof ChecklistSchema>;

export const CommentSchema = z.object({
  id: z.string().min(1),
  card_id: z.string().min(1),
  author_id: z.string().min(1),
  author_name: z.string().min(1).max(120),
  author_initials: z.string().min(1).max(4),
  content: z.string().min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const ActivitySchema = z.object({
  id: z.string().min(1),
  board_id: z.string().min(1),
  card_id: z.string().nullable().default(null),
  actor_name: z.string().min(1).max(120),
  action_type: ActivityActionTypeEnum,
  description: z.string().min(1),
  created_at: z.string().datetime(),
  is_automated: z.boolean().default(false),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const AttachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  url: z.string().min(1),
  type: AttachmentTypeEnum,
  created_at: z.string().datetime(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const CardCoverSchema = z.object({
  type: CardCoverTypeEnum.default("none"),
  value: z.string().nullable().default(null),
  size: CardCoverSizeEnum.default("normal"),
});
export type CardCover = z.infer<typeof CardCoverSchema>;

export const BoardBackgroundSchema = z.object({
  type: BoardBackgroundTypeEnum.default("gradient"),
  value: z.string().min(1).default("linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)"),
});
export type BoardBackground = z.infer<typeof BoardBackgroundSchema>;

// Phase 3 Trello Butler Automation Schemas
export const AutomationTriggerSchema = z.object({
  type: AutomationTriggerTypeEnum,
  column_id: z.string().nullable().optional().default(null),
  column_title_match: z.string().nullable().optional().default(null),
  priority: PriorityEnum.nullable().optional().default(null),
  label_id: z.string().nullable().optional().default(null),
});
export type AutomationTrigger = z.infer<typeof AutomationTriggerSchema>;

export const AutomationActionSchema = z.object({
  type: AutomationActionTypeEnum,
  member_id: z.string().nullable().optional().default(null),
  label_id: z.string().nullable().optional().default(null),
  priority: PriorityEnum.nullable().optional().default(null),
  target_column_id: z.string().nullable().optional().default(null),
  checklist_title: z.string().nullable().optional().default(null),
  checklist_items: z.array(z.string()).nullable().optional().default(null),
  comment_text: z.string().nullable().optional().default(null),
  due_complete_value: z.boolean().nullable().optional().default(true),
});
export type AutomationAction = z.infer<typeof AutomationActionSchema>;

export const AutomationRuleSchema = z.object({
  id: z.string().min(1),
  board_id: z.string().min(1),
  name: z.string().min(1).max(150),
  description: z.string().default(""),
  is_enabled: z.boolean().default(true),
  trigger: AutomationTriggerSchema,
  actions: z.array(AutomationActionSchema).min(1),
  execution_count: z.number().int().min(0).default(0),
  last_triggered_at: z.string().datetime().nullable().default(null),
  created_at: z.string().datetime(),
});
export type AutomationRule = z.infer<typeof AutomationRuleSchema>;

export const CardSchema = z.object({
  id: z.string().uuid(),
  board_id: z.string().uuid(),
  column_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().default(""),
  position: FractionalIndexSchema,
  priority: PriorityEnum.default("MEDIUM"),
  story_points: z.number().int().min(0).max(100).nullable().default(null),
  tags: z.array(z.string()).default([]),
  subtasks: z.array(SubtaskSchema).default([]),
  blocked_by_card_ids: z.array(z.string().uuid()).default([]),
  due_date: z.string().datetime().nullable().default(null),
  updated_at: z.string().datetime(),
  // Phase 2 Trello Parity Fields
  cover: CardCoverSchema.default({ type: "none", value: null, size: "normal" }),
  label_ids: z.array(z.string()).default([]),
  member_ids: z.array(z.string()).default([]),
  checklists: z.array(ChecklistSchema).default([]),
  comments: z.array(CommentSchema).default([]),
  attachments: z.array(AttachmentSchema).default([]),
  start_date: z.string().datetime().nullable().default(null),
  is_due_complete: z.boolean().default(false),
  is_archived: z.boolean().default(false),
  is_watching: z.boolean().default(false),
});
export type Card = z.infer<typeof CardSchema>;

export const ColumnSchema = z.object({
  id: z.string().uuid(),
  board_id: z.string().uuid(),
  title: z.string().min(1).max(100),
  position: FractionalIndexSchema,
  wip_limit: z.number().int().positive().nullable().default(null),
  // Phase 2 Trello Parity Fields
  color: z.string().nullable().default(null),
  is_archived: z.boolean().default(false),
});
export type Column = z.infer<typeof ColumnSchema>;

export const BoardSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  title: z.string().min(1).max(150),
  columns: z.array(ColumnSchema).default([]),
  cards: z.array(CardSchema).default([]),
  created_at: z.string().datetime(),
  // Phase 2 Trello Parity Fields
  description: z.string().default(""),
  is_starred: z.boolean().default(false),
  background: BoardBackgroundSchema.default({
    type: "gradient",
    value: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
  }),
  labels: z.array(LabelSchema).default([]),
  members: z.array(MemberSchema).default([]),
  activities: z.array(ActivitySchema).default([]),
  // Phase 3 Trello Butler Automation
  automation_rules: z.array(AutomationRuleSchema).default([]),
});
export type Board = z.infer<typeof BoardSchema>;

// Phase 3 Workspace & Board Summary Schemas
export const BoardSummarySchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  title: z.string().min(1).max(150),
  is_starred: z.boolean().default(false),
  background: BoardBackgroundSchema.default({
    type: "gradient",
    value: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
  }),
  card_count: z.number().int().min(0).default(0),
  updated_at: z.string().datetime().optional().default(() => new Date().toISOString()),
  created_at: z.string().datetime().optional().default(() => new Date().toISOString()),
  description: z.string().optional().default(""),
});
export type BoardSummary = z.infer<typeof BoardSummarySchema>;

export const WorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120),
  description: z.string().optional().default(""),
  logo_color: z.string().min(1).default("#6366f1"),
  created_at: z.string().datetime(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const WorkspaceWithBoardsSchema = WorkspaceSchema.extend({
  boards: z.array(BoardSummarySchema).default([]),
});
export type WorkspaceWithBoards = z.infer<typeof WorkspaceWithBoardsSchema>;

export const BoardTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().default(""),
  category: BoardTemplateCategoryEnum,
  background: BoardBackgroundSchema,
  default_columns: z.array(z.string().min(1)),
  sample_cards_count: z.number().int().min(0).default(0),
});
export type BoardTemplate = z.infer<typeof BoardTemplateSchema>;

// ============================================================================
// 3. REQUEST & RESPONSE PAYLOAD SCHEMAS
// ============================================================================

export const HealthCheckResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  version: z.string().default("1.0.0"),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

export const CreateWorkspaceRequestSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120).optional(),
  description: z.string().optional().default(""),
  logo_color: z.string().min(1).optional().default("#6366f1"),
});
export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceRequestSchema>;

export const CreateBoardRequestSchema = z.object({
  workspace_id: z.string().optional(),
  title: z.string().min(1).max(150),
  description: z.string().optional().default(""),
  is_starred: z.boolean().optional().default(false),
  background: BoardBackgroundSchema.optional(),
  template_id: z.string().optional(),
});
export type CreateBoardRequest = z.infer<typeof CreateBoardRequestSchema>;

export const UpdateBoardRequestSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  description: z.string().optional(),
  is_starred: z.boolean().optional(),
  background: BoardBackgroundSchema.optional(),
  labels: z.array(LabelSchema).optional(),
  members: z.array(MemberSchema).optional(),
});
export type UpdateBoardRequest = z.infer<typeof UpdateBoardRequestSchema>;

export const CreateColumnRequestSchema = z.object({
  title: z.string().min(1).max(100),
  position: FractionalIndexSchema,
  wip_limit: z.number().int().positive().nullable().optional().default(null),
  color: z.string().nullable().optional().default(null),
});
export type CreateColumnRequest = z.infer<typeof CreateColumnRequestSchema>;

export const UpdateColumnRequestSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  position: FractionalIndexSchema.optional(),
  wip_limit: z.number().int().positive().nullable().optional(),
  color: z.string().nullable().optional(),
  is_archived: z.boolean().optional(),
});
export type UpdateColumnRequest = z.infer<typeof UpdateColumnRequestSchema>;

export const MoveColumnRequestSchema = z.object({
  new_position: FractionalIndexSchema,
});
export type MoveColumnRequest = z.infer<typeof MoveColumnRequestSchema>;

export const CopyColumnRequestSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  position: FractionalIndexSchema.optional(),
});
export type CopyColumnRequest = z.infer<typeof CopyColumnRequestSchema>;

export const CopyColumnResponseSchema = z.object({
  column: ColumnSchema,
  cards: z.array(CardSchema).default([]),
});
export type CopyColumnResponse = z.infer<typeof CopyColumnResponseSchema>;

export const CreateCardRequestSchema = z.object({
  column_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional().default(""),
  position: FractionalIndexSchema,
  priority: PriorityEnum.optional().default("MEDIUM"),
  story_points: z.number().int().min(0).max(100).nullable().optional().default(null),
  tags: z.array(z.string()).optional().default([]),
  subtasks: z.array(SubtaskSchema).optional().default([]),
  blocked_by_card_ids: z.array(z.string().uuid()).optional().default([]),
  due_date: z.string().datetime().nullable().optional().default(null),
  cover: CardCoverSchema.optional().default({ type: "none", value: null, size: "normal" }),
  label_ids: z.array(z.string()).optional().default([]),
  member_ids: z.array(z.string()).optional().default([]),
  checklists: z.array(ChecklistSchema).optional().default([]),
  comments: z.array(CommentSchema).optional().default([]),
  attachments: z.array(AttachmentSchema).optional().default([]),
  start_date: z.string().datetime().nullable().optional().default(null),
  is_due_complete: z.boolean().optional().default(false),
  is_archived: z.boolean().optional().default(false),
  is_watching: z.boolean().optional().default(false),
});
export type CreateCardRequest = z.infer<typeof CreateCardRequestSchema>;

export const UpdateCardRequestSchema = z.object({
  column_id: z.string().uuid().optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  position: FractionalIndexSchema.optional(),
  priority: PriorityEnum.optional(),
  story_points: z.number().int().min(0).max(100).nullable().optional(),
  tags: z.array(z.string()).optional(),
  subtasks: z.array(SubtaskSchema).optional(),
  blocked_by_card_ids: z.array(z.string().uuid()).optional(),
  due_date: z.string().datetime().nullable().optional(),
  cover: CardCoverSchema.optional(),
  label_ids: z.array(z.string()).optional(),
  member_ids: z.array(z.string()).optional(),
  checklists: z.array(ChecklistSchema).optional(),
  comments: z.array(CommentSchema).optional(),
  attachments: z.array(AttachmentSchema).optional(),
  start_date: z.string().datetime().nullable().optional(),
  is_due_complete: z.boolean().optional(),
  is_archived: z.boolean().optional(),
  is_watching: z.boolean().optional(),
});
export type UpdateCardRequest = z.infer<typeof UpdateCardRequestSchema>;

export const MoveCardRequestSchema = z.object({
  target_column_id: z.string().uuid(),
  new_position: FractionalIndexSchema,
});
export type MoveCardRequest = z.infer<typeof MoveCardRequestSchema>;

export const CopyCardRequestSchema = z.object({
  target_column_id: z.string().uuid().optional(),
  title: z.string().min(1).max(255).optional(),
  position: FractionalIndexSchema.optional(),
  keep_checklists: z.boolean().optional().default(true),
  keep_labels: z.boolean().optional().default(true),
  keep_members: z.boolean().optional().default(true),
  keep_attachments: z.boolean().optional().default(true),
});
export type CopyCardRequest = z.infer<typeof CopyCardRequestSchema>;

export const CreateCommentRequestSchema = z.object({
  author_id: z.string().min(1).optional().default("88888888-8888-4888-8888-888888888881"),
  author_name: z.string().min(1).max(120).optional().default("Alex Rivera"),
  author_initials: z.string().min(1).max(4).optional().default("AR"),
  content: z.string().min(1),
});
export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>;

export const CreateAutomationRuleRequestSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().optional().default(""),
  is_enabled: z.boolean().optional().default(true),
  trigger: AutomationTriggerSchema,
  actions: z.array(AutomationActionSchema).min(1),
});
export type CreateAutomationRuleRequest = z.infer<typeof CreateAutomationRuleRequestSchema>;

export const UpdateAutomationRuleRequestSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().optional(),
  is_enabled: z.boolean().optional(),
  trigger: AutomationTriggerSchema.optional(),
  actions: z.array(AutomationActionSchema).min(1).optional(),
});
export type UpdateAutomationRuleRequest = z.infer<typeof UpdateAutomationRuleRequestSchema>;

// ============================================================================
// 4. WEBSOCKET MESSAGE SCHEMAS (/ws/boards/:boardId)
// ============================================================================

export const WSEventTypeEnum = z.enum([
  "CARD_MOVED",
  "CARD_UPDATED",
  "CARD_CREATED",
  "CARD_ARCHIVED",
  "COLUMN_CREATED",
  "COLUMN_MOVED",
  "COLUMN_UPDATED",
  "COMMENT_ADDED",
  "BOARD_UPDATED",
  "AUTOMATION_TRIGGERED",
  "AUTOMATION_RULE_CREATED",
  "AUTOMATION_RULE_UPDATED",
  "AUTOMATION_RULE_DELETED",
  "BOARD_DELETED",
  "BOARD_IMPORTED",
]);
export type WSEventType = z.infer<typeof WSEventTypeEnum>;

export const CardMovedEventDataSchema = z.object({
  card_id: z.string().uuid(),
  source_column_id: z.string().uuid().optional(),
  target_column_id: z.string().uuid(),
  new_position: FractionalIndexSchema,
  updated_at: z.string().datetime(),
});
export type CardMovedEventData = z.infer<typeof CardMovedEventDataSchema>;

export const ColumnMovedEventDataSchema = z.object({
  column_id: z.string().uuid(),
  new_position: FractionalIndexSchema,
  updated_at: z.string().datetime(),
});
export type ColumnMovedEventData = z.infer<typeof ColumnMovedEventDataSchema>;

export const AutomationTriggeredEventDataSchema = z.object({
  rule_id: z.string().min(1),
  rule_name: z.string().min(1),
  card_id: z.string().uuid().nullable().default(null),
  trigger_type: AutomationTriggerTypeEnum,
  action_types: z.array(AutomationActionTypeEnum),
  execution_count: z.number().int().min(0),
  triggered_at: z.string().datetime(),
});
export type AutomationTriggeredEventData = z.infer<typeof AutomationTriggeredEventDataSchema>;

export const WSMessageSchema = z.object({
  event: WSEventTypeEnum,
  board_id: z.string().uuid(),
  data: z.unknown(),
  actor_id: z.string().min(1),
  timestamp: z.string().datetime(),
});
export type WSMessage<TData = unknown> = Omit<
  z.infer<typeof WSMessageSchema>,
  "data"
> & {
  data: TData;
};

// ============================================================================
// 5. AI ENGINE SERVICE SCHEMAS (1:1 WITH packages/contracts/schemas.py)
// ============================================================================

export const SuggestedSubtaskSchema = z.object({
  title: z.string().min(1).max(280),
  position: FractionalIndexSchema,
});
export type SuggestedSubtask = z.infer<typeof SuggestedSubtaskSchema>;

export const AIDecomposeRequestSchema = z.object({
  card_title: z.string().min(1).max(255),
  card_description: z.string().default(""),
  board_context: z.array(z.string()).default([]),
});
export type AIDecomposeRequest = z.infer<typeof AIDecomposeRequestSchema>;

export const AIDecomposeResponseSchema = z.object({
  suggested_subtasks: z.array(SuggestedSubtaskSchema),
  estimated_story_points: z.number().int().min(0).max(100),
  suggested_priority: PriorityEnum,
  potential_risks: z.array(z.string()),
});
export type AIDecomposeResponse = z.infer<typeof AIDecomposeResponseSchema>;

export const SuggestedChecklistSchema = z.object({
  title: z.string().min(1).max(150).default("Checklist"),
  position: FractionalIndexSchema,
  items: z.array(SuggestedSubtaskSchema).default([]),
});
export type SuggestedChecklist = z.infer<typeof SuggestedChecklistSchema>;

export const SuggestedLabelSchema = z.object({
  name: z.string().min(1).max(100),
  color: LabelColorEnum,
});
export type SuggestedLabel = z.infer<typeof SuggestedLabelSchema>;

export const AISuggestCardEnrichmentRequestSchema = z.object({
  card_title: z.string().min(1).max(255),
  card_description: z.string().default(""),
  board_context: z.array(z.string()).default([]),
  available_labels: z.array(LabelSchema).default([]),
});
export type AISuggestCardEnrichmentRequest = z.infer<
  typeof AISuggestCardEnrichmentRequestSchema
>;

export const AISuggestCardEnrichmentResponseSchema = z.object({
  structured_description: z.string(),
  suggested_checklists: z.array(SuggestedChecklistSchema),
  suggested_labels: z.array(SuggestedLabelSchema),
  estimated_story_points: z.number().int().min(0).max(100),
  suggested_priority: PriorityEnum,
  potential_risks: z.array(z.string()).default([]),
});
export type AISuggestCardEnrichmentResponse = z.infer<
  typeof AISuggestCardEnrichmentResponseSchema
>;

// Phase 3 Natural Language Butler Automation Builder Schemas
export const AIParseAutomationColumnContextSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});
export type AIParseAutomationColumnContext = z.infer<
  typeof AIParseAutomationColumnContextSchema
>;

export const AIParseAutomationMemberContextSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type AIParseAutomationMemberContext = z.infer<
  typeof AIParseAutomationMemberContextSchema
>;

export const AIParseAutomationLabelContextSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
});
export type AIParseAutomationLabelContext = z.infer<
  typeof AIParseAutomationLabelContextSchema
>;

export const AIParseAutomationRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  board_columns: z.array(AIParseAutomationColumnContextSchema).default([]),
  board_members: z.array(AIParseAutomationMemberContextSchema).default([]),
  board_labels: z.array(AIParseAutomationLabelContextSchema).default([]),
});
export type AIParseAutomationRequest = z.infer<
  typeof AIParseAutomationRequestSchema
>;

export const AIParseAutomationResponseSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().default(""),
  trigger: AutomationTriggerSchema,
  actions: z.array(AutomationActionSchema),
});
export type AIParseAutomationResponse = z.infer<
  typeof AIParseAutomationResponseSchema
>;

// ============================================================================
// 5.4 PHASE 4 TEAM ANALYTICS, AI SPRINT INSIGHTS & TRELLO IMPORT/EXPORT SCHEMAS
// ============================================================================

export const BurndownDataPointSchema = z.object({
  date: z.string().min(1),
  ideal_remaining_points: z.number().min(0),
  actual_remaining_points: z.number().min(0),
  completed_cards_count: z.number().int().min(0),
});
export type BurndownDataPoint = z.infer<typeof BurndownDataPointSchema>;

export const ColumnMetricSchema = z.object({
  column_id: z.string().min(1),
  column_title: z.string().min(1),
  card_count: z.number().int().min(0),
  total_story_points: z.number().min(0),
  wip_limit: z.number().int().positive().nullable().default(null),
  is_bottleneck: z.boolean().default(false),
});
export type ColumnMetric = z.infer<typeof ColumnMetricSchema>;

export const MemberWorkloadSchema = z.object({
  member_id: z.string().min(1),
  member_name: z.string().min(1),
  member_initials: z.string().min(1).max(4),
  member_color: z.string().min(1),
  assigned_cards_count: z.number().int().min(0),
  completed_cards_count: z.number().int().min(0),
  active_story_points: z.number().min(0),
  overdue_cards_count: z.number().int().min(0),
});
export type MemberWorkload = z.infer<typeof MemberWorkloadSchema>;

export const PriorityMetricSchema = z.object({
  priority: PriorityEnum,
  count: z.number().int().min(0),
  story_points: z.number().min(0),
});
export type PriorityMetric = z.infer<typeof PriorityMetricSchema>;

export const LabelMetricSchema = z.object({
  label_id: z.string().min(1),
  label_name: z.string(),
  label_color: z.string().min(1),
  count: z.number().int().min(0),
});
export type LabelMetric = z.infer<typeof LabelMetricSchema>;

export const BoardAnalyticsSchema = z.object({
  board_id: z.string().min(1),
  total_cards: z.number().int().min(0),
  completed_cards: z.number().int().min(0),
  archived_cards: z.number().int().min(0),
  completion_rate: z.number().min(0).max(100),
  total_story_points: z.number().min(0),
  completed_story_points: z.number().min(0),
  overdue_cards_count: z.number().int().min(0),
  blocked_cards_count: z.number().int().min(0),
  checklist_completion_rate: z.number().min(0).max(100),
  automation_executions_total: z.number().int().min(0),
  cards_by_column: z.array(ColumnMetricSchema).default([]),
  workload_by_member: z.array(MemberWorkloadSchema).default([]),
  cards_by_priority: z.array(PriorityMetricSchema).default([]),
  cards_by_label: z.array(LabelMetricSchema).default([]),
  burndown_series: z.array(BurndownDataPointSchema).default([]),
});
export type BoardAnalytics = z.infer<typeof BoardAnalyticsSchema>;

export const SprintHealthStatusEnum = z.enum([
  "EXCELLENT",
  "ON_TRACK",
  "AT_RISK",
  "CRITICAL",
]);
export type SprintHealthStatus = z.infer<typeof SprintHealthStatusEnum>;

export const AIAnalyticsRequestSchema = z.object({
  board_title: z.string().min(1).max(150),
  analytics: BoardAnalyticsSchema,
});
export type AIAnalyticsRequest = z.infer<typeof AIAnalyticsRequestSchema>;

export const AIAnalyticsReportSchema = z.object({
  health_score: z.number().min(0).max(100),
  health_status: SprintHealthStatusEnum,
  executive_summary: z.string().min(1),
  bottlenecks: z.array(z.string()).default([]),
  actionable_recommendations: z.array(z.string()).default([]),
  generated_at: z.string().datetime(),
});
export type AIAnalyticsReport = z.infer<typeof AIAnalyticsReportSchema>;

export const BoardImportFormatEnum = z.enum(["trello_json", "kinetix_json"]);
export type BoardImportFormat = z.infer<typeof BoardImportFormatEnum>;

export const TrelloImportRequestSchema = z.object({
  workspace_id: z.string().optional(),
  board_title_override: z.string().min(1).max(150).optional(),
  format: BoardImportFormatEnum.optional().default("trello_json"),
  payload: z.record(z.string(), z.unknown()),
});
export type TrelloImportRequest = z.infer<typeof TrelloImportRequestSchema>;

export const TrelloImportResultSchema = z.object({
  board: BoardSchema,
  imported_lists_count: z.number().int().min(0),
  imported_cards_count: z.number().int().min(0),
  imported_checklists_count: z.number().int().min(0),
});
export type TrelloImportResult = z.infer<typeof TrelloImportResultSchema>;

export const BoardExportCsvResponseSchema = z.object({
  filename: z.string().min(1),
  content_type: z.literal("text/csv"),
  csv_data: z.string(),
});
export type BoardExportCsvResponse = z.infer<
  typeof BoardExportCsvResponseSchema
>;

// ============================================================================
// 6. STANDARD ERROR ENVELOPE
// ============================================================================

export const ErrorCodeEnum = z.enum([
  "RESOURCE_NOT_FOUND",
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof ErrorCodeEnum>;

export const StandardErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeEnum,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).default({}),
  }),
});
export type StandardError = z.infer<typeof StandardErrorSchema>;
