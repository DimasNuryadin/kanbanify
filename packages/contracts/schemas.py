"""
Kinetix Shared Physical Data Contracts (Pydantic v2).
Mirrors `packages/contracts/index.ts` 1:1 across REST, WebSocket, and AI Engine boundaries.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# 1. ENUMS & FRACTIONAL INDEXING
# ============================================================================


class PriorityEnum(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class LabelColorEnum(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    ORANGE = "orange"
    RED = "red"
    PURPLE = "purple"
    BLUE = "blue"
    SKY = "sky"
    LIME = "lime"
    PINK = "pink"
    BLACK = "black"


class ActivityActionTypeEnum(str, Enum):
    CARD_CREATED = "CARD_CREATED"
    CARD_MOVED = "CARD_MOVED"
    CARD_ARCHIVED = "CARD_ARCHIVED"
    COMMENT_ADDED = "COMMENT_ADDED"
    CHECKLIST_COMPLETED = "CHECKLIST_COMPLETED"
    MEMBER_ASSIGNED = "MEMBER_ASSIGNED"
    AUTOMATION_TRIGGERED = "AUTOMATION_TRIGGERED"


class AttachmentTypeEnum(str, Enum):
    LINK = "link"
    IMAGE = "image"
    FILE = "file"


class CardCoverTypeEnum(str, Enum):
    NONE = "none"
    COLOR = "color"
    IMAGE = "image"


class CardCoverSizeEnum(str, Enum):
    NORMAL = "normal"
    FULL = "full"


class BoardBackgroundTypeEnum(str, Enum):
    GRADIENT = "gradient"
    SOLID = "solid"
    IMAGE = "image"


class BoardTemplateCategoryEnum(str, Enum):
    ENGINEERING = "ENGINEERING"
    MARKETING = "MARKETING"
    PRODUCT = "PRODUCT"
    PERSONAL = "PERSONAL"


class AutomationTriggerTypeEnum(str, Enum):
    WHEN_CARD_MOVED_TO_COLUMN = "WHEN_CARD_MOVED_TO_COLUMN"
    WHEN_CARD_CREATED = "WHEN_CARD_CREATED"
    WHEN_CHECKLIST_COMPLETED = "WHEN_CHECKLIST_COMPLETED"
    WHEN_PRIORITY_CHANGED = "WHEN_PRIORITY_CHANGED"
    WHEN_LABEL_ADDED = "WHEN_LABEL_ADDED"


class AutomationActionTypeEnum(str, Enum):
    MARK_DUE_DATE_COMPLETE = "MARK_DUE_DATE_COMPLETE"
    ASSIGN_MEMBER = "ASSIGN_MEMBER"
    ADD_LABEL = "ADD_LABEL"
    SET_PRIORITY = "SET_PRIORITY"
    MOVE_CARD_TO_COLUMN = "MOVE_CARD_TO_COLUMN"
    ADD_CHECKLIST = "ADD_CHECKLIST"
    POST_COMMENT = "POST_COMMENT"


# Phase 5 Webhooks & Presence Enums
class WebhookPlatformEnum(str, Enum):
    SLACK = "SLACK"
    DISCORD = "DISCORD"
    CUSTOM = "CUSTOM"


class WebhookEventTypeEnum(str, Enum):
    CARD_CREATED = "CARD_CREATED"
    CARD_MOVED = "CARD_MOVED"
    CARD_ARCHIVED = "CARD_ARCHIVED"
    COMMENT_ADDED = "COMMENT_ADDED"
    AUTOMATION_TRIGGERED = "AUTOMATION_TRIGGERED"


class UserPresenceStatusEnum(str, Enum):
    ACTIVE = "ACTIVE"
    IDLE = "IDLE"
    EDITING = "EDITING"


class PresenceEventTypeEnum(str, Enum):
    PRESENCE_SYNC = "PRESENCE_SYNC"
    USER_JOINED = "USER_JOINED"
    USER_LEFT = "USER_LEFT"
    USER_TYPING = "USER_TYPING"


class ClientPresenceEventEnum(str, Enum):
    HEARTBEAT = "HEARTBEAT"
    START_TYPING = "START_TYPING"
    STOP_TYPING = "STOP_TYPING"


class WSEventTypeEnum(str, Enum):
    CARD_MOVED = "CARD_MOVED"
    CARD_UPDATED = "CARD_UPDATED"
    CARD_CREATED = "CARD_CREATED"
    CARD_ARCHIVED = "CARD_ARCHIVED"
    COLUMN_CREATED = "COLUMN_CREATED"
    COLUMN_MOVED = "COLUMN_MOVED"
    COLUMN_UPDATED = "COLUMN_UPDATED"
    COMMENT_ADDED = "COMMENT_ADDED"
    BOARD_UPDATED = "BOARD_UPDATED"
    AUTOMATION_TRIGGERED = "AUTOMATION_TRIGGERED"
    AUTOMATION_RULE_CREATED = "AUTOMATION_RULE_CREATED"
    AUTOMATION_RULE_UPDATED = "AUTOMATION_RULE_UPDATED"
    AUTOMATION_RULE_DELETED = "AUTOMATION_RULE_DELETED"
    BOARD_DELETED = "BOARD_DELETED"
    BOARD_IMPORTED = "BOARD_IMPORTED"
    PRESENCE_SYNC = "PRESENCE_SYNC"
    USER_JOINED = "USER_JOINED"
    USER_LEFT = "USER_LEFT"
    USER_TYPING = "USER_TYPING"


class SprintHealthStatusEnum(str, Enum):
    EXCELLENT = "EXCELLENT"
    ON_TRACK = "ON_TRACK"
    AT_RISK = "AT_RISK"
    CRITICAL = "CRITICAL"


class BoardImportFormatEnum(str, Enum):
    TRELLO_JSON = "trello_json"
    KINETIX_JSON = "kinetix_json"


class ErrorCodeEnum(str, Enum):
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    INTERNAL_ERROR = "INTERNAL_ERROR"


# Phase 6 RBAC & Board Visibility Enums
class BoardRoleEnum(str, Enum):
    ADMIN = "ADMIN"
    EDITOR = "EDITOR"
    VIEWER = "VIEWER"


class BoardVisibilityEnum(str, Enum):
    PRIVATE = "PRIVATE"
    WORKSPACE = "WORKSPACE"
    PUBLIC_READ = "PUBLIC_READ"


class AIPermissionRiskLevelEnum(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


# ============================================================================
# 2. CORE ENTITIES & TRELLO RICH WORKSPACE SCHEMAS
# ============================================================================


class MemberSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3)
    avatar_url: str | None = None
    initials: str = Field(..., min_length=1, max_length=4)
    color: str = "#3b82f6"
    role: BoardRoleEnum = BoardRoleEnum.EDITOR
    joined_at: str | None = None


# Phase 6 Auth Schemas
class AuthUserSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3)
    avatar_url: str | None = None
    initials: str = Field(..., min_length=1, max_length=4)
    color: str = "#3b82f6"
    default_role: BoardRoleEnum = BoardRoleEnum.EDITOR


class RegisterRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6, max_length=100)


class LoginRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class AuthSessionResponseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    token: str = Field(..., min_length=1)
    user: AuthUserSchema
    expires_at: datetime | str


# Phase 6 Shareable Board Invite Link Schemas
class BoardInviteLinkSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    board_id: str = Field(..., min_length=1)
    token: str = Field(..., min_length=1)
    role: BoardRoleEnum
    created_by_id: str = Field(..., min_length=1)
    created_by_name: str = Field(..., min_length=1)
    max_uses: int | None = Field(default=None, ge=1)
    uses_count: int = Field(default=0, ge=0)
    expires_at: datetime | str | None = None
    is_active: bool = True
    created_at: datetime | str


class CreateInviteLinkRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    role: BoardRoleEnum = BoardRoleEnum.EDITOR
    max_uses: int | None = Field(default=None, ge=1)
    expires_in_hours: float | None = Field(default=None, gt=0)


class JoinViaInviteRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = Field(default=None, min_length=3)


class JoinViaInviteResponseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    board_id: str = Field(..., min_length=1)
    board_title: str = Field(..., min_length=1)
    granted_role: BoardRoleEnum
    member: MemberSchema


class LabelSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    board_id: str = Field(..., min_length=1)
    name: str = Field(default="", max_length=100)
    color: LabelColorEnum


class SubtaskSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID | str
    title: str = Field(..., min_length=1, max_length=280)
    is_completed: bool = False
    position: str = Field(..., min_length=1, max_length=64)


class ChecklistItemSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1, max_length=280)
    is_completed: bool = False
    position: str = Field(..., min_length=1, max_length=64)
    due_date: str | None = None
    assignee_id: str | None = None


class ChecklistSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    title: str = Field(default="Checklist", min_length=1, max_length=150)
    position: str = Field(..., min_length=1, max_length=64)
    items: list[ChecklistItemSchema] = Field(default_factory=list)


class CommentSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    card_id: str = Field(..., min_length=1)
    author_id: str = Field(..., min_length=1)
    author_name: str = Field(..., min_length=1, max_length=120)
    author_initials: str = Field(..., min_length=1, max_length=4)
    content: str = Field(..., min_length=1)
    created_at: datetime
    updated_at: datetime


class ActivitySchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    board_id: str = Field(..., min_length=1)
    card_id: str | None = None
    actor_name: str = Field(..., min_length=1, max_length=120)
    action_type: ActivityActionTypeEnum
    description: str = Field(..., min_length=1)
    created_at: datetime
    is_automated: bool = False


class AttachmentSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., min_length=1)
    type: AttachmentTypeEnum
    created_at: datetime


class CardCoverSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: CardCoverTypeEnum = CardCoverTypeEnum.NONE
    value: str | None = None
    size: CardCoverSizeEnum = CardCoverSizeEnum.NORMAL


class BoardBackgroundSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: BoardBackgroundTypeEnum = BoardBackgroundTypeEnum.GRADIENT
    value: str = "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)"


# Phase 3 Trello Butler Automation Models
class AutomationTriggerSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: AutomationTriggerTypeEnum
    column_id: str | None = None
    column_title_match: str | None = None
    priority: PriorityEnum | None = None
    label_id: str | None = None


class AutomationActionSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: AutomationActionTypeEnum
    member_id: str | None = None
    label_id: str | None = None
    priority: PriorityEnum | None = None
    target_column_id: str | None = None
    checklist_title: str | None = None
    checklist_items: list[str] | None = None
    comment_text: str | None = None
    due_complete_value: bool | None = True


class AutomationRuleSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    board_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=150)
    description: str = ""
    is_enabled: bool = True
    trigger: AutomationTriggerSchema
    actions: list[AutomationActionSchema] = Field(..., min_length=1)
    execution_count: int = Field(default=0, ge=0)
    last_triggered_at: datetime | None = None
    created_at: datetime


class CardSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    board_id: UUID
    column_id: UUID
    title: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    position: str = Field(..., min_length=1, max_length=64)
    priority: PriorityEnum = PriorityEnum.MEDIUM
    story_points: int | None = Field(default=None, ge=0, le=100)
    tags: list[str] = Field(default_factory=list)
    subtasks: list[SubtaskSchema] = Field(default_factory=list)
    blocked_by_card_ids: list[UUID] = Field(default_factory=list)
    due_date: datetime | None = None
    updated_at: datetime
    # Phase 2 Trello Parity Fields
    cover: CardCoverSchema = Field(default_factory=CardCoverSchema)
    label_ids: list[str] = Field(default_factory=list)
    member_ids: list[str] = Field(default_factory=list)
    checklists: list[ChecklistSchema] = Field(default_factory=list)
    comments: list[CommentSchema] = Field(default_factory=list)
    attachments: list[AttachmentSchema] = Field(default_factory=list)
    start_date: datetime | None = None
    is_due_complete: bool = False
    is_archived: bool = False
    is_watching: bool = False


class ColumnSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    board_id: UUID
    title: str = Field(..., min_length=1, max_length=100)
    position: str = Field(..., min_length=1, max_length=64)
    wip_limit: int | None = Field(default=None, gt=0)
    # Phase 2 Trello Parity Fields
    color: str | None = None
    is_archived: bool = False


# Phase 5 Outbound Webhook Integration Schema
class WebhookConfigSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID | str = Field(...)
    board_id: UUID | str = Field(...)
    name: str = Field(..., min_length=1, max_length=120)
    platform: WebhookPlatformEnum
    url: str = Field(...)
    is_enabled: bool = True
    subscribed_events: list[WebhookEventTypeEnum] = Field(default_factory=list)
    created_at: datetime | str


class BoardSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    workspace_id: UUID
    title: str = Field(..., min_length=1, max_length=150)
    columns: list[ColumnSchema] = Field(default_factory=list)
    cards: list[CardSchema] = Field(default_factory=list)
    created_at: datetime
    # Phase 2 Trello Parity Fields
    description: str = ""
    is_starred: bool = False
    background: BoardBackgroundSchema = Field(default_factory=BoardBackgroundSchema)
    labels: list[LabelSchema] = Field(default_factory=list)
    members: list[MemberSchema] = Field(default_factory=list)
    activities: list[ActivitySchema] = Field(default_factory=list)
    # Phase 3 Trello Butler Automation
    automation_rules: list[AutomationRuleSchema] = Field(default_factory=list)
    # Phase 5 Outbound Webhooks
    webhooks: list[WebhookConfigSchema] = Field(default_factory=list)
    # Phase 6 RBAC & Shareable Invites
    invite_links: list[BoardInviteLinkSchema] = Field(default_factory=list)
    visibility: BoardVisibilityEnum = BoardVisibilityEnum.WORKSPACE


# Phase 3 Workspace & Board Summary Schemas
class BoardSummarySchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID | str
    workspace_id: UUID | str
    title: str = Field(..., min_length=1, max_length=150)
    description: str = ""
    is_starred: bool = False
    background: BoardBackgroundSchema = Field(default_factory=BoardBackgroundSchema)
    card_count: int = Field(default=0, ge=0)
    updated_at: datetime | None = None
    created_at: datetime | None = None


class WorkspaceSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=120)
    slug: str = Field(..., min_length=1, max_length=120)
    description: str = ""
    logo_color: str = "#6366f1"
    created_at: datetime


class WorkspaceWithBoardsSchema(WorkspaceSchema):
    boards: list[BoardSummarySchema] = Field(default_factory=list)


class BoardTemplateSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=120)
    description: str = ""
    category: BoardTemplateCategoryEnum
    background: BoardBackgroundSchema
    default_columns: list[str] = Field(default_factory=list)
    sample_cards_count: int = Field(default=0, ge=0)


# ============================================================================
# 3. REQUEST & RESPONSE PAYLOAD SCHEMAS
# ============================================================================


class HealthCheckResponseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: Literal["ok"] = "ok"
    service: str
    version: str = "1.0.0"


class CreateWorkspaceRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=120)
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    description: str = ""
    logo_color: str = "#6366f1"


class CreateBoardRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    workspace_id: UUID | str | None = None
    title: str = Field(..., min_length=1, max_length=150)
    description: str = ""
    is_starred: bool = False
    background: BoardBackgroundSchema | None = None
    template_id: str | None = None
    visibility: BoardVisibilityEnum = BoardVisibilityEnum.WORKSPACE


class UpdateBoardRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    is_starred: bool | None = None
    background: BoardBackgroundSchema | None = None
    labels: list[LabelSchema] | None = None
    members: list[MemberSchema] | None = None
    visibility: BoardVisibilityEnum | None = None


class CreateColumnRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(..., min_length=1, max_length=100)
    position: str = Field(..., min_length=1, max_length=64)
    wip_limit: int | None = Field(default=None, gt=0)
    color: str | None = None


class UpdateColumnRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str | None = Field(default=None, min_length=1, max_length=100)
    position: str | None = Field(default=None, min_length=1, max_length=64)
    wip_limit: int | None = Field(default=None, gt=0)
    color: str | None = None
    is_archived: bool | None = None


class MoveColumnRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    new_position: str = Field(..., min_length=1, max_length=64)


class CopyColumnRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str | None = Field(default=None, min_length=1, max_length=100)
    position: str | None = Field(default=None, min_length=1, max_length=64)


class CopyColumnResponseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    column: ColumnSchema
    cards: list[CardSchema] = Field(default_factory=list)


class CreateCardRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    column_id: UUID
    title: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    position: str = Field(..., min_length=1, max_length=64)
    priority: PriorityEnum = PriorityEnum.MEDIUM
    story_points: int | None = Field(default=None, ge=0, le=100)
    tags: list[str] = Field(default_factory=list)
    subtasks: list[SubtaskSchema] = Field(default_factory=list)
    blocked_by_card_ids: list[UUID] = Field(default_factory=list)
    due_date: datetime | None = None
    cover: CardCoverSchema = Field(default_factory=CardCoverSchema)
    label_ids: list[str] = Field(default_factory=list)
    member_ids: list[str] = Field(default_factory=list)
    checklists: list[ChecklistSchema] = Field(default_factory=list)
    comments: list[CommentSchema] = Field(default_factory=list)
    attachments: list[AttachmentSchema] = Field(default_factory=list)
    start_date: datetime | None = None
    is_due_complete: bool = False
    is_archived: bool = False
    is_watching: bool = False


class UpdateCardRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    column_id: UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    position: str | None = Field(default=None, min_length=1, max_length=64)
    priority: PriorityEnum | None = None
    story_points: int | None = Field(default=None, ge=0, le=100)
    tags: list[str] | None = None
    subtasks: list[SubtaskSchema] | None = None
    blocked_by_card_ids: list[UUID] | None = None
    due_date: datetime | None = None
    cover: CardCoverSchema | None = None
    label_ids: list[str] | None = None
    member_ids: list[str] | None = None
    checklists: list[ChecklistSchema] | None = None
    comments: list[CommentSchema] | None = None
    attachments: list[AttachmentSchema] | None = None
    start_date: datetime | None = None
    is_due_complete: bool | None = None
    is_archived: bool | None = None
    is_watching: bool | None = None


class MoveCardRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    target_column_id: UUID
    new_position: str = Field(..., min_length=1, max_length=64)


class CopyCardRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    target_column_id: UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    position: str | None = Field(default=None, min_length=1, max_length=64)
    keep_checklists: bool = True
    keep_labels: bool = True
    keep_members: bool = True
    keep_attachments: bool = True


class CreateCommentRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    author_id: str = "88888888-8888-4888-8888-888888888881"
    author_name: str = "Alex Rivera"
    author_initials: str = "AR"
    content: str = Field(..., min_length=1)


class CreateAutomationRuleRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=150)
    description: str = ""
    is_enabled: bool = True
    trigger: AutomationTriggerSchema
    actions: list[AutomationActionSchema] = Field(..., min_length=1)


class UpdateAutomationRuleRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    is_enabled: bool | None = None
    trigger: AutomationTriggerSchema | None = None
    actions: list[AutomationActionSchema] | None = None


# Phase 5 Outbound Webhook Requests & Responses
class CreateWebhookRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=120)
    platform: WebhookPlatformEnum = WebhookPlatformEnum.CUSTOM
    url: str = Field(...)
    is_enabled: bool = True
    subscribed_events: list[WebhookEventTypeEnum] = Field(..., min_length=1)


class UpdateWebhookRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=120)
    platform: WebhookPlatformEnum | None = None
    url: str | None = None
    is_enabled: bool | None = None
    subscribed_events: list[WebhookEventTypeEnum] | None = None


class TestWebhookResponseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    success: bool
    status_code: int | None = None
    message: str
    delivered_at: datetime | str | None = None


# ============================================================================
# 4. WEBSOCKET MESSAGE SCHEMAS
# ============================================================================


class AutomationTriggeredEventDataSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    rule_id: str = Field(..., min_length=1)
    rule_name: str = Field(..., min_length=1)
    card_id: UUID | str | None = None
    trigger_type: AutomationTriggerTypeEnum
    action_types: list[AutomationActionTypeEnum]
    execution_count: int = Field(default=0, ge=0)
    triggered_at: datetime


# Phase 5 Real-Time Presence & Live Typing Indicators
class UserPresenceSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(..., min_length=1)
    user_name: str = Field(..., min_length=1)
    avatar_url: str | None = None
    initials: str = Field(..., min_length=1)
    color: str = Field(..., min_length=1)
    status: UserPresenceStatusEnum = UserPresenceStatusEnum.ACTIVE
    active_card_id: str | None = None
    last_seen: datetime | str


class PresenceMessageSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    event: PresenceEventTypeEnum
    board_id: str = Field(..., min_length=1)
    presences: list[UserPresenceSchema] = Field(default_factory=list)
    actor: UserPresenceSchema


class ClientPresenceMessageSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    event: ClientPresenceEventEnum
    card_id: str | None = None


class WSMessageSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    event: WSEventTypeEnum
    board_id: UUID
    data: Any
    actor_id: str = Field(..., min_length=1)
    timestamp: datetime


# ============================================================================
# 5. AI ENGINE SERVICE SCHEMAS (1:1 WITH index.ts)
# ============================================================================


class SuggestedSubtaskSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(..., min_length=1, max_length=280)
    position: str = Field(..., min_length=1, max_length=64)


class AIDecomposeRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    card_title: str = Field(..., min_length=1, max_length=255)
    card_description: str = ""
    board_context: list[str] = Field(default_factory=list)


class AIDecomposeResponseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    suggested_subtasks: list[SuggestedSubtaskSchema]
    estimated_story_points: int = Field(..., ge=0, le=100)
    suggested_priority: PriorityEnum
    potential_risks: list[str] = Field(default_factory=list)


class SuggestedChecklistSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(default="Checklist", min_length=1, max_length=150)
    position: str = Field(..., min_length=1, max_length=64)
    items: list[SuggestedSubtaskSchema] = Field(default_factory=list)


class SuggestedLabelSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=100)
    color: LabelColorEnum


class AISuggestCardEnrichmentRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    card_title: str = Field(..., min_length=1, max_length=255)
    card_description: str = ""
    board_context: list[str] = Field(default_factory=list)
    available_labels: list[LabelSchema] = Field(default_factory=list)


class AISuggestCardEnrichmentResponseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    structured_description: str
    suggested_checklists: list[SuggestedChecklistSchema]
    suggested_labels: list[SuggestedLabelSchema]
    estimated_story_points: int = Field(..., ge=0, le=100)
    suggested_priority: PriorityEnum
    potential_risks: list[str] = Field(default_factory=list)


# Phase 3 Natural Language Butler Automation Builder Schemas
class AIParseAutomationColumnContextSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)


class AIParseAutomationMemberContextSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)


class AIParseAutomationLabelContextSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    color: str = Field(..., min_length=1)


class AIParseAutomationRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    prompt: str = Field(..., min_length=1, max_length=1000)
    board_columns: list[AIParseAutomationColumnContextSchema] = Field(default_factory=list)
    board_members: list[AIParseAutomationMemberContextSchema] = Field(default_factory=list)
    board_labels: list[AIParseAutomationLabelContextSchema] = Field(default_factory=list)


class AIParseAutomationResponseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=150)
    description: str = ""
    trigger: AutomationTriggerSchema
    actions: list[AutomationActionSchema] = Field(..., min_length=1)


# ============================================================================
# 5.4 PHASE 4 TEAM ANALYTICS, AI SPRINT INSIGHTS & TRELLO IMPORT/EXPORT SCHEMAS
# ============================================================================


class BurndownDataPointSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    date: str = Field(..., min_length=1)
    ideal_remaining_points: float = Field(..., ge=0)
    actual_remaining_points: float = Field(..., ge=0)
    completed_cards_count: int = Field(..., ge=0)


class ColumnMetricSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    column_id: str = Field(..., min_length=1)
    column_title: str = Field(..., min_length=1)
    card_count: int = Field(..., ge=0)
    total_story_points: float = Field(..., ge=0)
    wip_limit: int | None = None
    is_bottleneck: bool = False


class MemberWorkloadSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    member_id: str = Field(..., min_length=1)
    member_name: str = Field(..., min_length=1)
    member_initials: str = Field(..., min_length=1, max_length=4)
    member_color: str = Field(..., min_length=1)
    assigned_cards_count: int = Field(..., ge=0)
    completed_cards_count: int = Field(..., ge=0)
    active_story_points: float = Field(..., ge=0)
    overdue_cards_count: int = Field(..., ge=0)


class PriorityMetricSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    priority: PriorityEnum
    count: int = Field(..., ge=0)
    story_points: float = Field(..., ge=0)


class LabelMetricSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    label_id: str = Field(..., min_length=1)
    label_name: str = ""
    label_color: str = Field(..., min_length=1)
    count: int = Field(..., ge=0)


class BoardAnalyticsSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    board_id: str = Field(..., min_length=1)
    total_cards: int = Field(..., ge=0)
    completed_cards: int = Field(..., ge=0)
    archived_cards: int = Field(..., ge=0)
    completion_rate: float = Field(..., ge=0, le=100)
    total_story_points: float = Field(..., ge=0)
    completed_story_points: float = Field(..., ge=0)
    overdue_cards_count: int = Field(..., ge=0)
    blocked_cards_count: int = Field(..., ge=0)
    checklist_completion_rate: float = Field(..., ge=0, le=100)
    automation_executions_total: int = Field(..., ge=0)
    cards_by_column: list[ColumnMetricSchema] = Field(default_factory=list)
    workload_by_member: list[MemberWorkloadSchema] = Field(default_factory=list)
    cards_by_priority: list[PriorityMetricSchema] = Field(default_factory=list)
    cards_by_label: list[LabelMetricSchema] = Field(default_factory=list)
    burndown_series: list[BurndownDataPointSchema] = Field(default_factory=list)


class AIAnalyticsRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    board_title: str = Field(..., min_length=1, max_length=150)
    analytics: BoardAnalyticsSchema


class AIAnalyticsReportSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    health_score: float = Field(..., ge=0, le=100)
    health_status: SprintHealthStatusEnum
    executive_summary: str = Field(..., min_length=1)
    bottlenecks: list[str] = Field(default_factory=list)
    actionable_recommendations: list[str] = Field(default_factory=list)
    generated_at: datetime | str


class TrelloImportRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    workspace_id: str | None = None
    board_title_override: str | None = Field(default=None, min_length=1, max_length=150)
    format: BoardImportFormatEnum = BoardImportFormatEnum.TRELLO_JSON
    payload: dict[str, Any] = Field(default_factory=dict)


class TrelloImportResultSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    board: BoardSchema
    imported_lists_count: int = Field(..., ge=0)
    imported_cards_count: int = Field(..., ge=0)
    imported_checklists_count: int = Field(..., ge=0)


class BoardExportCsvResponseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    filename: str = Field(..., min_length=1)
    content_type: Literal["text/csv"] = "text/csv"
    csv_data: str


# ============================================================================
# 5.5 PHASE 5 OUTBOUND WEBHOOKS & AI SUMMARY NOTIFICATION SCHEMAS
# ============================================================================


class AISummaryNotificationRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    board_title: str = Field(..., min_length=1, max_length=150)
    recent_activities: list[ActivitySchema] = Field(default_factory=list)


class AISummaryNotificationResponseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    slack_block_kit_payload: dict[str, Any] = Field(default_factory=dict)
    discord_embed_payload: dict[str, Any] = Field(default_factory=dict)
    summary_text: str = Field(..., min_length=1)


class OutboundWebhookPayloadSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    event: WebhookEventTypeEnum
    board_id: str = Field(..., min_length=1)
    timestamp: datetime | str
    actor: dict[str, str] | None = None
    data: dict[str, Any] = Field(default_factory=dict)


# ============================================================================
# 5.6 PHASE 6 AI WORKSPACE ACCESS & PERMISSION AUDITOR SCHEMAS
# ============================================================================


class AIPermissionAuditRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    board_title: str = Field(..., min_length=1)
    visibility: str = Field(..., min_length=1)
    members: list[MemberSchema] = Field(default_factory=list)
    invite_links: list[BoardInviteLinkSchema] = Field(default_factory=list)


class AIPermissionAuditResponseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    security_score: float = Field(..., ge=0, le=100)
    risk_level: AIPermissionRiskLevelEnum
    summary: str = Field(..., min_length=1)
    findings: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


# Aliases for direct import without Schema suffix
AISuggestCardEnrichmentRequest = AISuggestCardEnrichmentRequestSchema
AISuggestCardEnrichmentResponse = AISuggestCardEnrichmentResponseSchema
AIDecomposeRequest = AIDecomposeRequestSchema
AIDecomposeResponse = AIDecomposeResponseSchema

AutomationTrigger = AutomationTriggerSchema
AutomationAction = AutomationActionSchema
AutomationRule = AutomationRuleSchema
CreateAutomationRuleRequest = CreateAutomationRuleRequestSchema
UpdateAutomationRuleRequest = UpdateAutomationRuleRequestSchema

AIParseAutomationColumnContext = AIParseAutomationColumnContextSchema
AIParseAutomationMemberContext = AIParseAutomationMemberContextSchema
AIParseAutomationLabelContext = AIParseAutomationLabelContextSchema
AIParseAutomationRequest = AIParseAutomationRequestSchema
AIParseAutomationResponse = AIParseAutomationResponseSchema

Workspace = WorkspaceSchema
WorkspaceWithBoards = WorkspaceWithBoardsSchema
CreateWorkspaceRequest = CreateWorkspaceRequestSchema
BoardSummary = BoardSummarySchema
BoardTemplate = BoardTemplateSchema
AutomationTriggeredEventData = AutomationTriggeredEventDataSchema

BurndownDataPoint = BurndownDataPointSchema
ColumnMetric = ColumnMetricSchema
MemberWorkload = MemberWorkloadSchema
PriorityMetric = PriorityMetricSchema
LabelMetric = LabelMetricSchema
BoardAnalytics = BoardAnalyticsSchema
SprintHealthStatus = SprintHealthStatusEnum
AIAnalyticsRequest = AIAnalyticsRequestSchema
AIAnalyticsReport = AIAnalyticsReportSchema
BoardImportFormat = BoardImportFormatEnum
TrelloImportRequest = TrelloImportRequestSchema
TrelloImportResult = TrelloImportResultSchema
BoardExportCsvResponse = BoardExportCsvResponseSchema

WebhookPlatform = WebhookPlatformEnum
WebhookEventType = WebhookEventTypeEnum
WebhookConfig = WebhookConfigSchema
CreateWebhookRequest = CreateWebhookRequestSchema
UpdateWebhookRequest = UpdateWebhookRequestSchema
TestWebhookResponse = TestWebhookResponseSchema
UserPresenceStatus = UserPresenceStatusEnum
UserPresence = UserPresenceSchema
PresenceEventType = PresenceEventTypeEnum
PresenceMessage = PresenceMessageSchema
ClientPresenceEvent = ClientPresenceEventEnum
ClientPresenceMessage = ClientPresenceMessageSchema
AISummaryNotificationRequest = AISummaryNotificationRequestSchema
AISummaryNotificationResponse = AISummaryNotificationResponseSchema
OutboundWebhookPayload = OutboundWebhookPayloadSchema

BoardRole = BoardRoleEnum
BoardVisibility = BoardVisibilityEnum
AIPermissionRiskLevel = AIPermissionRiskLevelEnum
Member = MemberSchema
AuthUser = AuthUserSchema
RegisterRequest = RegisterRequestSchema
LoginRequest = LoginRequestSchema
AuthSessionResponse = AuthSessionResponseSchema
BoardInviteLink = BoardInviteLinkSchema
CreateInviteLinkRequest = CreateInviteLinkRequestSchema
JoinViaInviteRequest = JoinViaInviteRequestSchema
JoinViaInviteResponse = JoinViaInviteResponseSchema
AIPermissionAuditRequest = AIPermissionAuditRequestSchema
AIPermissionAuditResponse = AIPermissionAuditResponseSchema


# ============================================================================
# 6. STANDARD ERROR ENVELOPE
# ============================================================================


class ErrorBodySchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    code: ErrorCodeEnum
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class StandardErrorSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    error: ErrorBodySchema
