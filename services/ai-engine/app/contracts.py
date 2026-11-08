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

from pydantic import BaseModel, ConfigDict, Field


class PriorityEnum(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


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
        ErrorCodeEnum = _module.ErrorCodeEnum  # type: ignore[misc]
        HealthCheckResponseSchema = _module.HealthCheckResponseSchema  # type: ignore[misc]
        SuggestedSubtaskSchema = _module.SuggestedSubtaskSchema  # type: ignore[misc]
        AIDecomposeRequestSchema = _module.AIDecomposeRequestSchema  # type: ignore[misc]
        AIDecomposeResponseSchema = _module.AIDecomposeResponseSchema  # type: ignore[misc]
        ErrorBodySchema = _module.ErrorBodySchema  # type: ignore[misc]
        StandardErrorSchema = _module.StandardErrorSchema  # type: ignore[misc]

# Also provide aliases without the `Schema` suffix as referenced in prompt prose
AIDecomposeRequest = AIDecomposeRequestSchema
AIDecomposeResponse = AIDecomposeResponseSchema

__all__ = [
    "AIDecomposeRequest",
    "AIDecomposeRequestSchema",
    "AIDecomposeResponse",
    "AIDecomposeResponseSchema",
    "ErrorBodySchema",
    "ErrorCodeEnum",
    "HealthCheckResponseSchema",
    "PriorityEnum",
    "StandardErrorSchema",
    "SuggestedSubtaskSchema",
]
