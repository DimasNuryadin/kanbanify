"""
Contract bridge to `packages/contracts/schemas.py`.
Ensures 100% compatibility with the locked Pydantic v2 models in the monorepo
while remaining self-contained if deployed in an isolated container image.
"""

from __future__ import annotations

import importlib.util
import sys
from enum import Enum
from pathlib import Path
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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


class ErrorCodeEnum(str, Enum):
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class HealthCheckResponseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: Literal["ok"] = "ok"
    service: str
    version: str = "1.0.0"


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


class _BaseAISuggestCardEnrichmentRequestSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    card_title: str = Field(..., min_length=1, max_length=255)
    card_description: str = ""
    board_context: list[str] = Field(default_factory=list)
    available_labels: list[LabelSchema] = Field(default_factory=list)


class _BaseAISuggestCardEnrichmentResponseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    structured_description: str
    suggested_checklists: list[SuggestedChecklistSchema]
    suggested_labels: list[SuggestedLabelSchema]
    estimated_story_points: int = Field(..., ge=0, le=100)
    suggested_priority: PriorityEnum
    potential_risks: list[str] = Field(default_factory=list)


class ErrorBodySchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    code: ErrorCodeEnum
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class StandardErrorSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    error: ErrorBodySchema


# Bind directly to `packages/contracts/schemas.py` when present in the monorepo
_SHARED_SCHEMAS_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "packages"
    / "contracts"
    / "schemas.py"
)

if _SHARED_SCHEMAS_PATH.is_file():
    _spec = importlib.util.spec_from_file_location(
        "kinetix_shared_contracts_schemas", _SHARED_SCHEMAS_PATH
    )
    if _spec is not None and _spec.loader is not None:
        _module = importlib.util.module_from_spec(_spec)
        sys.modules[_spec.name] = _module
        _spec.loader.exec_module(_module)

        PriorityEnum = _module.PriorityEnum  # type: ignore[misc]
        LabelColorEnum = _module.LabelColorEnum  # type: ignore[misc]
        ErrorCodeEnum = _module.ErrorCodeEnum  # type: ignore[misc]
        HealthCheckResponseSchema = _module.HealthCheckResponseSchema  # type: ignore[misc]
        LabelSchema = _module.LabelSchema  # type: ignore[misc]
        SubtaskSchema = _module.SubtaskSchema  # type: ignore[misc]
        ChecklistItemSchema = _module.ChecklistItemSchema  # type: ignore[misc]
        ChecklistSchema = _module.ChecklistSchema  # type: ignore[misc]
        SuggestedSubtaskSchema = _module.SuggestedSubtaskSchema  # type: ignore[misc]
        SuggestedChecklistSchema = _module.SuggestedChecklistSchema  # type: ignore[misc]
        SuggestedLabelSchema = _module.SuggestedLabelSchema  # type: ignore[misc]
        AIDecomposeRequestSchema = _module.AIDecomposeRequestSchema  # type: ignore[misc]
        AIDecomposeResponseSchema = _module.AIDecomposeResponseSchema  # type: ignore[misc]
        _BaseAISuggestCardEnrichmentRequestSchema = (
            _module.AISuggestCardEnrichmentRequestSchema  # type: ignore[misc]
        )
        _BaseAISuggestCardEnrichmentResponseSchema = (
            _module.AISuggestCardEnrichmentResponseSchema  # type: ignore[misc]
        )
        ErrorBodySchema = _module.ErrorBodySchema  # type: ignore[misc]
        StandardErrorSchema = _module.StandardErrorSchema  # type: ignore[misc]


_DEFAULT_COLOR_NAMES: dict[str, str] = {
    "green": "Ship Ready",
    "yellow": "Needs Spec",
    "orange": "Tech Debt",
    "red": "Blocker",
    "purple": "AI Assisted",
    "blue": "Architecture",
    "sky": "Frontend UX",
    "lime": "Verified",
    "pink": "Design",
    "black": "Infrastructure",
}

_VALID_COLOR_VALUES: frozenset[str] = frozenset(_DEFAULT_COLOR_NAMES.keys())


def _infer_color_from_label_name(name: str) -> str:
    lowered = name.lower().strip()
    if lowered in _VALID_COLOR_VALUES:
        return lowered
    if any(k in lowered for k in ("bug", "blocker", "urgent", "critical", "security", "hotfix")):
        return "red"
    if any(k in lowered for k in ("debt", "warn", "risk", "ops", "migration", "perf")):
        return "orange"
    if any(k in lowered for k in ("spec", "doc", "review", "qa", "test")):
        return "yellow"
    if any(k in lowered for k in ("ai", "llm", "copilot", "smart", "ml")):
        return "purple"
    if any(k in lowered for k in ("ui", "ux", "frontend", "css", "design")):
        return "sky"
    if any(k in lowered for k in ("ship", "ready", "done", "feature", "release")):
        return "green"
    return "blue"


class AISuggestCardEnrichmentRequestSchema(_BaseAISuggestCardEnrichmentRequestSchema):
    """
    Contract-compliant request model for `POST /internal/v1/enrich-card`.
    Subclasses `packages/contracts/schemas.py::AISuggestCardEnrichmentRequestSchema`
    while also supporting flexible `available_labels` inputs (full `LabelSchema`,
    partial label dicts `{"name": ..., "color": ...}`, or color/name strings).
    """

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("card_description", mode="before")
    @classmethod
    def _coerce_description(cls, value: Any) -> str:
        if value is None:
            return ""
        return str(value)

    @field_validator("board_context", mode="before")
    @classmethod
    def _coerce_board_context(cls, value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return [str(item) for item in value if item is not None]
        return []

    @field_validator("available_labels", mode="before")
    @classmethod
    def _coerce_available_labels(cls, value: Any) -> list[Any]:
        if not value or not isinstance(value, list):
            return []
        normalized: list[Any] = []
        for idx, item in enumerate(value):
            if isinstance(item, LabelSchema):
                normalized.append(item)
            elif isinstance(item, dict):
                raw_color = str(item.get("color", "")).lower().strip()
                raw_name = str(item.get("name", "")).strip()
                if raw_color not in _VALID_COLOR_VALUES:
                    raw_color = _infer_color_from_label_name(raw_name or raw_color)
                if not raw_name:
                    raw_name = _DEFAULT_COLOR_NAMES.get(raw_color, raw_color.capitalize())
                normalized.append(
                    {
                        "id": str(
                            item.get("id")
                            or f"77777777-7777-4777-8777-7777777777{idx + 1:02d}"
                        ),
                        "board_id": str(
                            item.get("board_id")
                            or "11111111-1111-4111-8111-111111111111"
                        ),
                        "name": raw_name[:100],
                        "color": raw_color,
                    }
                )
            elif isinstance(item, str):
                cleaned = item.strip()
                if not cleaned:
                    continue
                lowered = cleaned.lower()
                if lowered in _VALID_COLOR_VALUES:
                    color_val = lowered
                    name_val = _DEFAULT_COLOR_NAMES.get(color_val, cleaned.capitalize())
                else:
                    color_val = _infer_color_from_label_name(cleaned)
                    name_val = cleaned[:100]
                normalized.append(
                    {
                        "id": f"77777777-7777-4777-8777-7777777777{idx + 1:02d}",
                        "board_id": "11111111-1111-4111-8111-111111111111",
                        "name": name_val,
                        "color": color_val,
                    }
                )
        return normalized


class AISuggestCardEnrichmentResponseSchema(_BaseAISuggestCardEnrichmentResponseSchema):
    """
    Contract-compliant response model for `POST /internal/v1/enrich-card`.
    Preserves 100% compatibility with `packages/contracts/schemas.py`
    (`structured_description`, `suggested_checklists`, `suggested_labels`,
    `estimated_story_points`, `suggested_priority`, `potential_risks`)
    while also exposing `suggested_description` and `suggested_label_colors`.
    """

    model_config = ConfigDict(populate_by_name=True)

    suggested_description: str = ""
    suggested_label_colors: list[LabelColorEnum] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _sync_before_validation(cls, data: Any) -> Any:
        if isinstance(data, dict):
            patched = dict(data)
            if not patched.get("structured_description") and patched.get(
                "suggested_description"
            ):
                patched["structured_description"] = patched["suggested_description"]
            if not patched.get("suggested_description") and patched.get(
                "structured_description"
            ):
                patched["suggested_description"] = patched["structured_description"]
            return patched
        return data

    @model_validator(mode="after")
    def _sync_after_validation(self) -> AISuggestCardEnrichmentResponseSchema:
        if not self.suggested_description:
            self.suggested_description = self.structured_description
        if not self.suggested_label_colors and self.suggested_labels:
            seen_colors: list[LabelColorEnum] = []
            for label in self.suggested_labels:
                if label.color not in seen_colors:
                    seen_colors.append(label.color)
            self.suggested_label_colors = seen_colors
        return self


# Also provide aliases without the `Schema` suffix as referenced in prompt & contracts
AISuggestCardEnrichmentRequestSchema.model_rebuild()
AISuggestCardEnrichmentResponseSchema.model_rebuild()
AIDecomposeRequest = AIDecomposeRequestSchema
AIDecomposeResponse = AIDecomposeResponseSchema
AISuggestCardEnrichmentRequest = AISuggestCardEnrichmentRequestSchema
AISuggestCardEnrichmentResponse = AISuggestCardEnrichmentResponseSchema

__all__ = [
    "AIDecomposeRequest",
    "AIDecomposeRequestSchema",
    "AIDecomposeResponse",
    "AIDecomposeResponseSchema",
    "AISuggestCardEnrichmentRequest",
    "AISuggestCardEnrichmentRequestSchema",
    "AISuggestCardEnrichmentResponse",
    "AISuggestCardEnrichmentResponseSchema",
    "ChecklistItemSchema",
    "ChecklistSchema",
    "ErrorBodySchema",
    "ErrorCodeEnum",
    "HealthCheckResponseSchema",
    "LabelColorEnum",
    "LabelSchema",
    "PriorityEnum",
    "StandardErrorSchema",
    "SubtaskSchema",
    "SuggestedChecklistSchema",
    "SuggestedLabelSchema",
    "SuggestedSubtaskSchema",
]
