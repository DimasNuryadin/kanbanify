import { z } from "zod";

// ============================================================================
// 1. ENUMS & FRACTIONAL INDEXING PRIMITIVES
// ============================================================================

export const PriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export type Priority = z.infer<typeof PriorityEnum>;

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

// ============================================================================
// 2. CORE ENTITIES
// ============================================================================

export const SubtaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(280),
  is_completed: z.boolean().default(false),
  position: FractionalIndexSchema,
});
export type Subtask = z.infer<typeof SubtaskSchema>;

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
});
export type Card = z.infer<typeof CardSchema>;

export const ColumnSchema = z.object({
  id: z.string().uuid(),
  board_id: z.string().uuid(),
  title: z.string().min(1).max(100),
  position: FractionalIndexSchema,
  wip_limit: z.number().int().positive().nullable().default(null),
});
export type Column = z.infer<typeof ColumnSchema>;

export const BoardSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  title: z.string().min(1).max(150),
  columns: z.array(ColumnSchema).default([]),
  cards: z.array(CardSchema).default([]),
  created_at: z.string().datetime(),
});
export type Board = z.infer<typeof BoardSchema>;

export const BoardSummarySchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  title: z.string().min(1).max(150),
  created_at: z.string().datetime(),
});
export type BoardSummary = z.infer<typeof BoardSummarySchema>;

// ============================================================================
// 3. REQUEST & RESPONSE PAYLOAD SCHEMAS
// ============================================================================

export const HealthCheckResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  version: z.string().default("1.0.0"),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

export const CreateBoardRequestSchema = z.object({
  workspace_id: z.string().uuid().optional(),
  title: z.string().min(1).max(150),
});
export type CreateBoardRequest = z.infer<typeof CreateBoardRequestSchema>;

export const CreateColumnRequestSchema = z.object({
  title: z.string().min(1).max(100),
  position: FractionalIndexSchema,
  wip_limit: z.number().int().positive().nullable().optional().default(null),
});
export type CreateColumnRequest = z.infer<typeof CreateColumnRequestSchema>;

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
});
export type UpdateCardRequest = z.infer<typeof UpdateCardRequestSchema>;

export const MoveCardRequestSchema = z.object({
  target_column_id: z.string().uuid(),
  new_position: FractionalIndexSchema,
});
export type MoveCardRequest = z.infer<typeof MoveCardRequestSchema>;

// ============================================================================
// 4. WEBSOCKET MESSAGE SCHEMAS (/ws/boards/:boardId)
// ============================================================================

export const WSEventTypeEnum = z.enum([
  "CARD_MOVED",
  "CARD_UPDATED",
  "CARD_CREATED",
  "COLUMN_CREATED",
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
