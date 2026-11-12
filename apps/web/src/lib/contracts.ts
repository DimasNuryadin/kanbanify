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

// Phase 5 Webhooks & Presence Enums
export const WebhookPlatformEnum = z.enum(["SLACK", "DISCORD", "CUSTOM"]);
export type WebhookPlatform = z.infer<typeof WebhookPlatformEnum>;

export const WebhookEventTypeEnum = z.enum([
  "CARD_CREATED",
  "CARD_MOVED",
  "CARD_ARCHIVED",
  "COMMENT_ADDED",
  "AUTOMATION_TRIGGERED",
]);
export type WebhookEventType = z.infer<typeof WebhookEventTypeEnum>;

export const UserPresenceStatusEnum = z.enum(["ACTIVE", "IDLE", "EDITING"]);
export type UserPresenceStatus = z.infer<typeof UserPresenceStatusEnum>;

export const PresenceEventTypeEnum = z.enum([
  "PRESENCE_SYNC",
  "USER_JOINED",
  "USER_LEFT",
  "USER_TYPING",
]);
export type PresenceEventType = z.infer<typeof PresenceEventTypeEnum>;

export const ClientPresenceEventEnum = z.enum([
  "HEARTBEAT",
  "START_TYPING",
  "STOP_TYPING",
]);
export type ClientPresenceEvent = z.infer<typeof ClientPresenceEventEnum>;

// Phase 6 RBAC & Board Visibility Enums
export const BoardRoleEnum = z.enum(["ADMIN", "EDITOR", "VIEWER"]);
export type BoardRole = z.infer<typeof BoardRoleEnum>;

export const BoardVisibilityEnum = z.enum(["PRIVATE", "WORKSPACE", "PUBLIC_READ"]);
export type BoardVisibility = z.infer<typeof BoardVisibilityEnum>;

export const AIPermissionRiskLevelEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type AIPermissionRiskLevel = z.infer<typeof AIPermissionRiskLevelEnum>;

// Phase 7 Custom Fields & Theme Studio Enums
export const CustomFieldTypeEnum = z.enum([
  "TEXT",
  "NUMBER",
  "DATE",
  "CHECKBOX",
  "DROPDOWN",
]);
export type CustomFieldType = z.infer<typeof CustomFieldTypeEnum>;

export const ThemePresetEnum = z.enum([
  "DEFAULT_CLEAN",
  "FROSTED_GLASS",
  "CYBERPUNK_NEON",
  "MINIMAL_NORD",
  "WARM_ESPRESSO",
]);
export type ThemePreset = z.infer<typeof ThemePresetEnum>;

// Phase 8 Time Tracking, Pomodoro & Sprint Retrospective Enums
export const TimeEntrySourceEnum = z.enum(["STOPWATCH", "POMODORO", "MANUAL"]);
export type TimeEntrySource = z.infer<typeof TimeEntrySourceEnum>;

export const PomodoroModeEnum = z.enum(["FOCUS", "SHORT_BREAK", "LONG_BREAK"]);
export type PomodoroMode = z.infer<typeof PomodoroModeEnum>;

export const RetroCategoryEnum = z.enum([
  "WENT_WELL",
  "TO_IMPROVE",
  "KUDOS",
  "ACTION_ITEMS",
]);
export type RetroCategory = z.infer<typeof RetroCategoryEnum>;

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
    role: "ADMIN" as const,
    joined_at: "2026-11-08T00:00:00.000Z",
  },
  {
    id: "88888888-8888-4888-8888-888888888882",
    name: "Maya Lin",
    email: "maya@kinetix.dev",
    avatar_url: null,
    initials: "ML",
    color: "#8b5cf6",
    role: "EDITOR" as const,
    joined_at: "2026-11-08T00:00:00.000Z",
  },
  {
    id: "88888888-8888-4888-8888-888888888883",
    name: "Samir Patel",
    email: "samir@kinetix.dev",
    avatar_url: null,
    initials: "SP",
    color: "#10b981",
    role: "EDITOR" as const,
    joined_at: "2026-11-08T00:00:00.000Z",
  },
  {
    id: "88888888-8888-4888-8888-888888888884",
    name: "Elena Rostova",
    email: "elena@kinetix.dev",
    avatar_url: null,
    initials: "ER",
    color: "#f59e0b",
    role: "VIEWER" as const,
    joined_at: "2026-11-08T00:00:00.000Z",
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
    id: "template-agile-sprint",
    name: "🚀 Agile Sprint & Engineering Roadmap",
    description: "Agile 2-week sprint board with Backlog, Sprint Ready, In Progress, Code Review, and Done columns with story points and custom fields.",
    category: "ENGINEERING" as const,
    background: {
      type: "gradient" as const,
      value: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
    },
    default_columns: ["Backlog", "Sprint Ready", "In Progress", "Code Review", "Done"],
    sample_cards_count: 5,
  },
  {
    id: "template-marketing-campaign",
    name: "📣 Marketing Campaign & Content Calendar",
    description: "Campaign pipeline for content ideas, drafting, design & asset review, scheduling, and publication.",
    category: "MARKETING" as const,
    background: {
      type: "gradient" as const,
      value: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #831843 100%)",
    },
    default_columns: ["Ideas", "Drafting", "Design & Assets", "Scheduled", "Published"],
    sample_cards_count: 4,
  },
  {
    id: "template-bug-tracker",
    name: "🐛 Bug Triage & QA Tracker",
    description: "Systematic defect triage and QA verification workflow from report to reproduction, fix, and resolution.",
    category: "ENGINEERING" as const,
    background: {
      type: "gradient" as const,
      value: "linear-gradient(135deg, #7c2d12 0%, #b91c1c 50%, #701a75 100%)",
    },
    default_columns: ["Reported", "Reproducing", "Fixing", "QA Verification", "Resolved"],
    sample_cards_count: 4,
  },
  {
    id: "template-product-discovery",
    name: "🎯 Product Discovery & OKR Tracker",
    description: "Quarterly OKR and product discovery pipeline aligning strategic objectives, key results, validation, and shipped releases.",
    category: "PRODUCT" as const,
    background: {
      type: "gradient" as const,
      value: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)",
    },
    default_columns: ["Objectives", "Key Results", "Validating", "Shipped"],
    sample_cards_count: 4,
  },
  {
    id: "template-engineering-sprint",
    name: "Engineering Sprint (Classic)",
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
    name: "Marketing Launch (Classic)",
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
    name: "Product Roadmap (Classic)",
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
  role: BoardRoleEnum.default("EDITOR"),
  joined_at: z.string().optional(),
});
export type Member = z.infer<typeof MemberSchema>;

// Phase 6 Auth Schemas
export const AuthUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  avatar_url: z.string().nullable().default(null),
  initials: z.string().min(1).max(4),
  color: z.string().min(1).default("#3b82f6"),
  default_role: BoardRoleEnum.default("EDITOR"),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const RegisterRequestSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthSessionResponseSchema = z.object({
  token: z.string().min(1),
  user: AuthUserSchema,
  expires_at: z.string().datetime(),
});
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;

// Phase 6 Shareable Board Invite Link Schemas
export const BoardInviteLinkSchema = z.object({
  id: z.string().min(1),
  board_id: z.string().min(1),
  token: z.string().min(1),
  role: BoardRoleEnum,
  created_by_id: z.string().min(1),
  created_by_name: z.string().min(1),
  max_uses: z.number().int().min(1).nullable().default(null),
  uses_count: z.number().int().min(0).default(0),
  expires_at: z.string().datetime().nullable().default(null),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
});
export type BoardInviteLink = z.infer<typeof BoardInviteLinkSchema>;

export const CreateInviteLinkRequestSchema = z.object({
  role: BoardRoleEnum.default("EDITOR"),
  max_uses: z.number().int().min(1).nullable().optional(),
  expires_in_hours: z.number().min(0.1).nullable().optional(),
});
export type CreateInviteLinkRequest = z.infer<typeof CreateInviteLinkRequestSchema>;

export const JoinViaInviteRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
});
export type JoinViaInviteRequest = z.infer<typeof JoinViaInviteRequestSchema>;

export const JoinViaInviteResponseSchema = z.object({
  board_id: z.string().min(1),
  board_title: z.string().min(1),
  granted_role: BoardRoleEnum,
  member: MemberSchema,
});
export type JoinViaInviteResponse = z.infer<typeof JoinViaInviteResponseSchema>;

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

// Phase 7 Custom Field Schemas
export const CustomFieldOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(100),
  color: z.string().min(1).default("blue"),
});
export type CustomFieldOption = z.infer<typeof CustomFieldOptionSchema>;

export const CustomFieldDefinitionSchema = z.object({
  id: z.string().min(1),
  board_id: z.string().min(1),
  name: z.string().min(1).max(100),
  type: CustomFieldTypeEnum,
  options: z.array(CustomFieldOptionSchema).default([]),
  show_on_front: z.boolean().default(true),
  position: FractionalIndexSchema.default("a0"),
  created_at: z.string().datetime(),
});
export type CustomFieldDefinition = z.infer<typeof CustomFieldDefinitionSchema>;

export const CardCustomFieldValueSchema = z.object({
  field_id: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
});
export type CardCustomFieldValue = z.infer<typeof CardCustomFieldValueSchema>;

// Phase 7 Advanced Board Theme & Glassmorphism Studio Schemas
export const BoardThemeConfigSchema = z.object({
  preset: ThemePresetEnum.default("DEFAULT_CLEAN"),
  glass_blur: z.enum(["none", "sm", "md", "lg"]).default("md"),
  card_density: z.enum(["comfortable", "compact"]).default("comfortable"),
  card_radius: z.enum(["sm", "md", "xl"]).default("md"),
  accent_color: z.string().default("#6366f1"),
  show_custom_fields_on_front: z.boolean().default(true),
  show_dependency_badges_on_front: z.boolean().default(true),
});
export type BoardThemeConfig = z.infer<typeof BoardThemeConfigSchema>;

export const DEFAULT_THEME_CONFIG: BoardThemeConfig = {
  preset: "DEFAULT_CLEAN",
  glass_blur: "md",
  card_density: "comfortable",
  card_radius: "md",
  accent_color: "#6366f1",
  show_custom_fields_on_front: true,
  show_dependency_badges_on_front: true,
};

export const THEME_PRESET_CONFIGS: Record<ThemePreset, BoardThemeConfig> = {
  DEFAULT_CLEAN: {
    preset: "DEFAULT_CLEAN",
    glass_blur: "none",
    card_density: "comfortable",
    card_radius: "md",
    accent_color: "#6366f1",
    show_custom_fields_on_front: true,
    show_dependency_badges_on_front: true,
  },
  FROSTED_GLASS: {
    preset: "FROSTED_GLASS",
    glass_blur: "lg",
    card_density: "comfortable",
    card_radius: "xl",
    accent_color: "#38bdf8",
    show_custom_fields_on_front: true,
    show_dependency_badges_on_front: true,
  },
  CYBERPUNK_NEON: {
    preset: "CYBERPUNK_NEON",
    glass_blur: "md",
    card_density: "compact",
    card_radius: "sm",
    accent_color: "#ec4899",
    show_custom_fields_on_front: true,
    show_dependency_badges_on_front: true,
  },
  MINIMAL_NORD: {
    preset: "MINIMAL_NORD",
    glass_blur: "sm",
    card_density: "compact",
    card_radius: "md",
    accent_color: "#88c0d0",
    show_custom_fields_on_front: true,
    show_dependency_badges_on_front: true,
  },
  WARM_ESPRESSO: {
    preset: "WARM_ESPRESSO",
    glass_blur: "md",
    card_density: "comfortable",
    card_radius: "xl",
    accent_color: "#f59e0b",
    show_custom_fields_on_front: true,
    show_dependency_badges_on_front: true,
  },
};

// Phase 8 Card Time Tracking, Stopwatch & Worklog Schemas
export const TimeEntrySchema = z.object({
  id: z.string().min(1),
  card_id: z.string().min(1),
  user_id: z.string().min(1),
  user_name: z.string().min(1).max(120),
  user_initials: z.string().min(1).max(4),
  duration_seconds: z.number().int().positive(),
  note: z.string().default(""),
  source: TimeEntrySourceEnum.default("MANUAL"),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  created_at: z.string().datetime(),
});
export type TimeEntry = z.infer<typeof TimeEntrySchema>;

export const ActiveCardTimerSchema = z.object({
  card_id: z.string().min(1),
  user_id: z.string().min(1),
  user_name: z.string().min(1),
  started_at: z.string().datetime(),
});
export type ActiveCardTimer = z.infer<typeof ActiveCardTimerSchema>;

export const CardTimeTrackingSummarySchema = z.object({
  estimated_seconds: z.number().int().min(0).default(0),
  total_logged_seconds: z.number().int().min(0).default(0),
  active_timer: ActiveCardTimerSchema.nullable().default(null),
  entries: z.array(TimeEntrySchema).default([]),
  pomodoro_completed_count: z.number().int().min(0).default(0),
});
export type CardTimeTrackingSummary = z.infer<typeof CardTimeTrackingSummarySchema>;

export const DEFAULT_CARD_TIME_TRACKING: CardTimeTrackingSummary = {
  estimated_seconds: 0,
  total_logged_seconds: 0,
  active_timer: null,
  entries: [],
  pomodoro_completed_count: 0,
};

// Phase 8 Pomodoro Session Schema
export const PomodoroSessionSchema = z.object({
  id: z.string().min(1),
  card_id: z.string().min(1),
  user_id: z.string().min(1),
  mode: PomodoroModeEnum.default("FOCUS"),
  duration_seconds: z.number().int().positive().default(1500),
  note: z.string().default(""),
  completed_at: z.string().datetime(),
});
export type PomodoroSession = z.infer<typeof PomodoroSessionSchema>;

// Phase 8 Sprint Retrospective Board Item Schema
export const RetroItemSchema = z.object({
  id: z.string().min(1),
  board_id: z.string().min(1),
  category: RetroCategoryEnum,
  content: z.string().min(1),
  author_id: z.string().min(1),
  author_name: z.string().min(1).max(120),
  author_initials: z.string().min(1).max(4),
  votes: z.number().int().min(0).default(0),
  voted_by_user_ids: z.array(z.string()).default([]),
  linked_card_id: z.string().nullable().default(null),
  is_resolved: z.boolean().default(false),
  created_at: z.string().datetime(),
});
export type RetroItem = z.infer<typeof RetroItemSchema>;

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
  blocked_by_card_ids: z.array(z.string()).default([]),
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
  // Phase 7 Custom Fields Values
  custom_field_values: z.array(CardCustomFieldValueSchema).default([]),
  // Phase 8 Card Time Tracking & Pomodoro Focus Timer
  time_tracking: CardTimeTrackingSummarySchema.default({
    estimated_seconds: 0,
    total_logged_seconds: 0,
    active_timer: null,
    entries: [],
    pomodoro_completed_count: 0,
  }),
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

// Phase 5 Outbound Webhook Integration Schema
export const WebhookConfigSchema = z.object({
  id: z.string().min(1),
  board_id: z.string().min(1),
  name: z.string().min(1).max(120),
  platform: WebhookPlatformEnum,
  url: z.string().url(),
  is_enabled: z.boolean().default(true),
  subscribed_events: z.array(WebhookEventTypeEnum).default([]),
  created_at: z.string().datetime(),
});
export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

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
  // Phase 5 Outbound Webhooks
  webhooks: z.array(WebhookConfigSchema).default([]),
  // Phase 6 RBAC & Shareable Invites
  invite_links: z.array(BoardInviteLinkSchema).default([]),
  visibility: BoardVisibilityEnum.default("WORKSPACE"),
  // Phase 7 Custom Fields & Theme Studio
  custom_fields: z.array(CustomFieldDefinitionSchema).default([]),
  theme_config: BoardThemeConfigSchema.default(DEFAULT_THEME_CONFIG),
  // Phase 8 Interactive Sprint Retrospective Board
  retro_items: z.array(RetroItemSchema).default([]),
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
  theme_config: BoardThemeConfigSchema.optional(),
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
  visibility: BoardVisibilityEnum.optional().default("WORKSPACE"),
  theme_config: BoardThemeConfigSchema.optional(),
  custom_fields: z.array(CustomFieldDefinitionSchema).optional(),
});
export type CreateBoardRequest = z.infer<typeof CreateBoardRequestSchema>;

export const UpdateBoardRequestSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  description: z.string().optional(),
  is_starred: z.boolean().optional(),
  background: BoardBackgroundSchema.optional(),
  labels: z.array(LabelSchema).optional(),
  members: z.array(MemberSchema).optional(),
  visibility: BoardVisibilityEnum.optional(),
  theme_config: BoardThemeConfigSchema.optional(),
  custom_fields: z.array(CustomFieldDefinitionSchema).optional(),
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
  blocked_by_card_ids: z.array(z.string()).optional().default([]),
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
  custom_field_values: z.array(CardCustomFieldValueSchema).optional().default([]),
  time_tracking: CardTimeTrackingSummarySchema.optional().default({
    estimated_seconds: 0,
    total_logged_seconds: 0,
    active_timer: null,
    entries: [],
    pomodoro_completed_count: 0,
  }),
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
  blocked_by_card_ids: z.array(z.string()).optional(),
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
  custom_field_values: z.array(CardCustomFieldValueSchema).optional(),
  time_tracking: CardTimeTrackingSummarySchema.optional(),
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
  keep_custom_fields: z.boolean().optional().default(true),
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

// Phase 5 Outbound Webhook Requests & Responses
export const CreateWebhookRequestSchema = z.object({
  name: z.string().min(1).max(120),
  platform: WebhookPlatformEnum.default("CUSTOM"),
  url: z.string().url(),
  is_enabled: z.boolean().optional().default(true),
  subscribed_events: z.array(WebhookEventTypeEnum).min(1),
});
export type CreateWebhookRequest = z.infer<typeof CreateWebhookRequestSchema>;

export const UpdateWebhookRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  platform: WebhookPlatformEnum.optional(),
  url: z.string().url().optional(),
  is_enabled: z.boolean().optional(),
  subscribed_events: z.array(WebhookEventTypeEnum).optional(),
});
export type UpdateWebhookRequest = z.infer<typeof UpdateWebhookRequestSchema>;

export const TestWebhookResponseSchema = z.object({
  success: z.boolean(),
  status_code: z.number().int().optional(),
  delivered: z.boolean().optional(),
  platform: WebhookPlatformEnum.optional(),
  message: z.string(),
  delivered_at: z.string().datetime().optional(),
  preview_payload: z.record(z.string(), z.unknown()).optional(),
});
export type TestWebhookResponse = z.infer<typeof TestWebhookResponseSchema>;

// Phase 7 Custom Field Request Payloads
export const CreateCustomFieldDefinitionRequestSchema = z.object({
  name: z.string().min(1).max(100),
  type: CustomFieldTypeEnum,
  options: z.array(CustomFieldOptionSchema).optional().default([]),
  show_on_front: z.boolean().optional().default(true),
  position: FractionalIndexSchema.optional(),
});
export type CreateCustomFieldDefinitionRequest = z.infer<
  typeof CreateCustomFieldDefinitionRequestSchema
>;

export const UpdateCustomFieldDefinitionRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  options: z.array(CustomFieldOptionSchema).optional(),
  show_on_front: z.boolean().optional(),
  position: FractionalIndexSchema.optional(),
});
export type UpdateCustomFieldDefinitionRequest = z.infer<
  typeof UpdateCustomFieldDefinitionRequestSchema
>;

export const SetCardCustomFieldValueRequestSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
});
export type SetCardCustomFieldValueRequest = z.infer<
  typeof SetCardCustomFieldValueRequestSchema
>;

// Phase 7 Theme Studio Request Payload
export const UpdateBoardThemeRequestSchema = z.object({
  preset: ThemePresetEnum.optional(),
  glass_blur: z.enum(["none", "sm", "md", "lg"]).optional(),
  card_density: z.enum(["comfortable", "compact"]).optional(),
  card_radius: z.enum(["sm", "md", "xl"]).optional(),
  accent_color: z.string().optional(),
  show_custom_fields_on_front: z.boolean().optional(),
  show_dependency_badges_on_front: z.boolean().optional(),
});
export type UpdateBoardThemeRequest = z.infer<
  typeof UpdateBoardThemeRequestSchema
>;

// Phase 7 Dependency Linker Request Payload
export const AddCardDependencyRequestSchema = z.object({
  blocker_card_id: z.string().min(1),
});
export type AddCardDependencyRequest = z.infer<
  typeof AddCardDependencyRequestSchema
>;

// Phase 8 Card Time Tracking & Stopwatch Requests
export const StartCardTimerRequestSchema = z.object({
  user_id: z.string().optional(),
  user_name: z.string().optional(),
});
export type StartCardTimerRequest = z.infer<typeof StartCardTimerRequestSchema>;

export const StopCardTimerRequestSchema = z.object({
  note: z.string().optional().default(""),
});
export type StopCardTimerRequest = z.infer<typeof StopCardTimerRequestSchema>;

export const LogTimeEntryRequestSchema = z.object({
  duration_seconds: z.number().int().positive().optional(),
  note: z.string().optional().default(""),
  source: TimeEntrySourceEnum.optional().default("MANUAL"),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().optional(),
  estimated_seconds: z.number().int().min(0).optional(),
});
export type LogTimeEntryRequest = z.infer<typeof LogTimeEntryRequestSchema>;

// Phase 8 Pomodoro Complete Request
export const PomodoroCompleteRequestSchema = z.object({
  card_id: z.string().min(1),
  mode: PomodoroModeEnum.default("FOCUS"),
  duration_seconds: z.number().int().positive().default(1500),
  note: z.string().optional().default("Completed 25m Pomodoro focus session"),
});
export type PomodoroCompleteRequest = z.infer<typeof PomodoroCompleteRequestSchema>;

// Phase 8 Retrospective Request & Response Schemas
export const CreateRetroItemRequestSchema = z.object({
  category: RetroCategoryEnum,
  content: z.string().min(1),
  author_id: z.string().min(1).optional(),
  author_name: z.string().min(1).max(120).optional(),
  author_initials: z.string().min(1).max(4).optional(),
});
export type CreateRetroItemRequest = z.infer<typeof CreateRetroItemRequestSchema>;

export const UpdateRetroItemRequestSchema = z.object({
  content: z.string().min(1).optional(),
  category: RetroCategoryEnum.optional(),
  is_resolved: z.boolean().optional(),
});
export type UpdateRetroItemRequest = z.infer<typeof UpdateRetroItemRequestSchema>;

export const VoteRetroItemResponseSchema = z.object({
  retro_item: RetroItemSchema,
  has_voted: z.boolean(),
});
export type VoteRetroItemResponse = z.infer<typeof VoteRetroItemResponseSchema>;

export const ConvertRetroItemToCardRequestSchema = z.object({
  target_column_id: z.string().optional(),
  priority: PriorityEnum.optional().default("MEDIUM"),
  story_points: z.number().int().min(0).max(100).nullable().optional().default(null),
});
export type ConvertRetroItemToCardRequest = z.infer<typeof ConvertRetroItemToCardRequestSchema>;

export const ConvertRetroItemToCardResponseSchema = z.object({
  retro_item: RetroItemSchema,
  card: CardSchema,
});
export type ConvertRetroItemToCardResponse = z.infer<typeof ConvertRetroItemToCardResponseSchema>;

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
  // Phase 5 Real-Time Presence & Typing
  "PRESENCE_SYNC",
  "USER_JOINED",
  "USER_LEFT",
  "USER_TYPING",
  // Phase 7 Custom Fields & Dependency Graph Events
  "CUSTOM_FIELD_CREATED",
  "CUSTOM_FIELD_UPDATED",
  "CUSTOM_FIELD_DELETED",
  "DEPENDENCY_ADDED",
  "DEPENDENCY_REMOVED",
  // Phase 8 Time Tracking & Retrospective Events
  "TIMER_UPDATED",
  "RETRO_ITEM_CREATED",
  "RETRO_ITEM_UPDATED",
  "RETRO_ITEM_DELETED",
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

// Phase 5 Real-Time Presence & Live Typing Indicators
export const UserPresenceSchema = z.object({
  user_id: z.string().min(1),
  user_name: z.string().min(1),
  avatar_url: z.string().nullable().default(null),
  initials: z.string().min(1),
  color: z.string().min(1),
  status: UserPresenceStatusEnum.default("ACTIVE"),
  active_card_id: z.string().nullable().default(null),
  last_seen: z.string().datetime(),
});
export type UserPresence = z.infer<typeof UserPresenceSchema>;

export const PresenceMessageSchema = z.object({
  event: PresenceEventTypeEnum,
  board_id: z.string().min(1),
  presences: z.array(UserPresenceSchema).default([]),
  actor: UserPresenceSchema,
});
export type PresenceMessage = z.infer<typeof PresenceMessageSchema>;

export const ClientPresenceMessageSchema = z.object({
  event: ClientPresenceEventEnum,
  card_id: z.string().nullable().default(null),
});
export type ClientPresenceMessage = z.infer<typeof ClientPresenceMessageSchema>;

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
  // Phase 8 Time Tracking Additive Fields
  total_estimated_hours: z.number().min(0).default(0),
  total_logged_hours: z.number().min(0).default(0),
  total_pomodoros_completed: z.number().int().min(0).default(0),
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
// 5.5 PHASE 5 OUTBOUND WEBHOOKS & AI SUMMARY NOTIFICATION SCHEMAS
// ============================================================================

export const AISummaryNotificationRequestSchema = z.object({
  board_title: z.string().min(1).max(150),
  recent_activities: z.array(ActivitySchema).default([]),
});
export type AISummaryNotificationRequest = z.infer<
  typeof AISummaryNotificationRequestSchema
>;

export const AISummaryNotificationResponseSchema = z.object({
  slack_block_kit_payload: z.record(z.string(), z.unknown()),
  discord_embed_payload: z.record(z.string(), z.unknown()),
  summary_text: z.string().min(1),
});
export type AISummaryNotificationResponse = z.infer<
  typeof AISummaryNotificationResponseSchema
>;

export const OutboundWebhookPayloadSchema = z.object({
  event: WebhookEventTypeEnum,
  board_id: z.string().min(1),
  timestamp: z.string().datetime(),
  actor: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  data: z.record(z.string(), z.unknown()),
});
export type OutboundWebhookPayload = z.infer<
  typeof OutboundWebhookPayloadSchema
>;

// ============================================================================
// 5.6 PHASE 6 AI WORKSPACE ACCESS & PERMISSION AUDITOR SCHEMAS
// ============================================================================

export const AIPermissionAuditRequestSchema = z.object({
  board_title: z.string().min(1),
  visibility: z.string().min(1),
  members: z.array(MemberSchema),
  invite_links: z.array(BoardInviteLinkSchema),
});
export type AIPermissionAuditRequest = z.infer<
  typeof AIPermissionAuditRequestSchema
>;

export const AIPermissionAuditResponseSchema = z.object({
  security_score: z.number().min(0).max(100),
  risk_level: AIPermissionRiskLevelEnum,
  summary: z.string().min(1),
  findings: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
});
export type AIPermissionAuditResponse = z.infer<
  typeof AIPermissionAuditResponseSchema
>;

// ============================================================================
// 5.7 PHASE 7 VISUAL DEPENDENCY GRAPH & AI CRITICAL PATH SCHEMAS
// ============================================================================

export const DependencyNodeSchema = z.object({
  card_id: z.string().min(1),
  title: z.string().min(1).max(255),
  column_id: z.string().min(1),
  column_title: z.string().min(1),
  priority: PriorityEnum,
  story_points: z.number().int().min(0).max(100).nullable().default(null),
  is_completed: z.boolean().default(false),
  assignee_initials: z.array(z.string()).default([]),
  in_degree: z.number().int().min(0).default(0),
  out_degree: z.number().int().min(0).default(0),
  is_on_critical_path: z.boolean().default(false),
});
export type DependencyNode = z.infer<typeof DependencyNodeSchema>;

export const DependencyEdgeSchema = z.object({
  from_card_id: z.string().min(1),
  to_card_id: z.string().min(1),
  is_resolved: z.boolean().default(false),
  is_critical: z.boolean().default(false),
});
export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>;

export const BoardDependencyGraphSchema = z.object({
  board_id: z.string().min(1),
  nodes: z.array(DependencyNodeSchema).default([]),
  edges: z.array(DependencyEdgeSchema).default([]),
  critical_path_card_ids: z.array(z.string()).default([]),
  total_blocked_cards: z.number().int().min(0).default(0),
  has_circular_dependency: z.boolean().default(false),
});
export type BoardDependencyGraph = z.infer<typeof BoardDependencyGraphSchema>;

export const AddCardDependencyResponseSchema = z.object({
  card: CardSchema,
  graph: BoardDependencyGraphSchema,
});
export type AddCardDependencyResponse = z.infer<
  typeof AddCardDependencyResponseSchema
>;

export const CriticalPathBlockerCardSchema = z.object({
  card_id: z.string().min(1),
  title: z.string().min(1),
  blocks_count: z.number().int().min(0),
  reason: z.string().min(1),
});
export type CriticalPathBlockerCard = z.infer<
  typeof CriticalPathBlockerCardSchema
>;

export const AICriticalPathRequestSchema = z.object({
  board_title: z.string().min(1).max(150),
  graph: BoardDependencyGraphSchema,
});
export type AICriticalPathRequest = z.infer<typeof AICriticalPathRequestSchema>;

export const AICriticalPathResponseSchema = z.object({
  risk_summary: z.string().min(1),
  critical_path_titles: z.array(z.string()).default([]),
  top_blocker_cards: z.array(CriticalPathBlockerCardSchema).default([]),
  unblocking_recommendations: z.array(z.string()).default([]),
});
export type AICriticalPathResponse = z.infer<
  typeof AICriticalPathResponseSchema
>;

// ============================================================================
// 5.8 PHASE 8 AI SPRINT RETROSPECTIVE FACILITATOR SCHEMAS
// ============================================================================

export const AIRetroSuggestedItemSchema = z.object({
  category: RetroCategoryEnum,
  content: z.string().min(1),
});
export type AIRetroSuggestedItem = z.infer<typeof AIRetroSuggestedItemSchema>;

export const AIRetroActionItemSchema = z.object({
  title: z.string().min(1),
  priority: PriorityEnum,
  story_points: z.number().int().min(0).max(100),
});
export type AIRetroActionItem = z.infer<typeof AIRetroActionItemSchema>;

export const AIRetroAnalysisRequestSchema = z.object({
  board_title: z.string().min(1),
  retro_items: z.array(RetroItemSchema).default([]),
  completed_cards_count: z.number().int().min(0).default(0),
  overdue_cards_count: z.number().int().min(0).default(0),
  total_estimated_hours: z.number().min(0).default(0),
  total_logged_hours: z.number().min(0).default(0),
});
export type AIRetroAnalysisRequest = z.infer<typeof AIRetroAnalysisRequestSchema>;

export const AIRetroAnalysisResponseSchema = z.object({
  sprint_morale_score: z.number().min(0).max(100),
  estimation_accuracy_summary: z.string().min(1),
  key_themes: z.array(z.string()).default([]),
  suggested_retro_items: z.array(AIRetroSuggestedItemSchema).default([]),
  recommended_action_items: z.array(AIRetroActionItemSchema).default([]),
});
export type AIRetroAnalysisResponse = z.infer<
  typeof AIRetroAnalysisResponseSchema
>;

// ============================================================================
// 6. STANDARD ERROR ENVELOPE
// ============================================================================

export const ErrorCodeEnum = z.enum([
  "RESOURCE_NOT_FOUND",
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
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
