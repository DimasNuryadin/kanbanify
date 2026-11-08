"""Internal service authentication dependency enforcing `X-Internal-Token`."""

from __future__ import annotations

import hmac
from typing import Any

from fastapi import Header

from app.config import get_settings
from app.contracts import ErrorBodySchema, ErrorCodeEnum, StandardErrorSchema


class ServiceAPIError(Exception):
    """Structured exception that renders as a `StandardErrorSchema` JSON response."""

    def __init__(
        self,
        status_code: int,
        code: ErrorCodeEnum,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details: dict[str, Any] = details if details is not None else {}

    def to_schema(self) -> StandardErrorSchema:
        return StandardErrorSchema(
            error=ErrorBodySchema(
                code=self.code,
                message=self.message,
                details=self.details,
            )
        )


async def verify_internal_token(
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
) -> str:
    """Validate `X-Internal-Token` header against `INTERNAL_SERVICE_TOKEN`."""
    expected_token = get_settings().internal_service_token
    if not x_internal_token or not hmac.compare_digest(
        x_internal_token.encode("utf-8"),
        expected_token.encode("utf-8"),
    ):
        raise ServiceAPIError(
            status_code=401,
            code=ErrorCodeEnum.UNAUTHORIZED,
            message="Missing or invalid X-Internal-Token header.",
            details={},
        )
    return x_internal_token
