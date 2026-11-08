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


class WSEventTypeEnum(str, Enum):
    CARD_MOVED = "CARD_MOVED"
    CARD_UPDATED = "CARD_UPDATED"
    CARD_CREATED = "CARD_CREATED"
    COLUMN_CREATED = "COLUMN_CREATED"


class ErrorCodeEnum(str, Enum):
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


# ============================================================================
# 2. CORE ENTITIES
# ============================================================================


class SubtaskSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    title: str = Field(..., min_length=1, max_length=280)
    is_completed: bool = False
    position: str = Field(..., min_length=1, max_length=64)


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


class ColumnSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    board_id: UUID
    title: str = Field(..., min_length=1, max_length=100)
    position: str = Field(..., min_length=1, max_length=64)
    wip_limit: int | None = Field(default=None, gt=0)


class BoardSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    workspace_id: UUID
    title: str = Field(..., min_length=1, max_length=150)
    columns: list[ColumnSchema] = Field(default_factory=list)
    cards: list[CardSchema] = Field(default_factory=list)
    created_at: datetime


# ============================================================================
# 3. REQUEST & RESPONSE PAYLOAD SCHEMAS
# ============================================================================


class HealthCheckResponseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: Literal["ok"] = "ok"
    service: str
    version: str = "1.0.0"


class CreateBoardRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    workspace_id: UUID | None = None
    title: str = Field(..., min_length=1, max_length=150)


class CreateColumnRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(..., min_length=1, max_length=100)
    position: str = Field(..., min_length=1, max_length=64)
    wip_limit: int | None = Field(default=None, gt=0)


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


class MoveCardRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    target_column_id: UUID
    new_position: str = Field(..., min_length=1, max_length=64)


# ============================================================================
# 4. WEBSOCKET MESSAGE SCHEMAS
# ============================================================================


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
