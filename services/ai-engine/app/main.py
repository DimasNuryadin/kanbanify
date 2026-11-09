"""
Kinetix Internal AI Engine Service (`services/ai-engine` — FastAPI Port `8001`).
Stateless AI task decomposition, Trello Power-Up smart card enrichment & risk analysis microservice.
"""

from __future__ import annotations

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.auth import ServiceAPIError, verify_internal_token
from app.board_analyzer import analyze_board
from app.config import get_settings
from app.contracts import (
    AIAnalyticsReportSchema,
    AIAnalyticsRequestSchema,
    AIDecomposeRequestSchema,
    AIDecomposeResponseSchema,
    AIParseAutomationRequestSchema,
    AIParseAutomationResponseSchema,
    AISuggestCardEnrichmentRequestSchema,
    AISuggestCardEnrichmentResponseSchema,
    ErrorBodySchema,
    ErrorCodeEnum,
    HealthCheckResponseSchema,
    StandardErrorSchema,
)
from app.decomposer import decompose_task, enrich_card
from app.rule_parser import parse_automation


def create_app() -> FastAPI:
    """Create and configure the Kinetix AI Engine FastAPI application."""
    application = FastAPI(
        title="Kinetix Internal AI Engine",
        description="Stateless AI Task Decomposer, Smart Card Enrichment & Technical Risk Analyzer (Port 8001)",
        version="1.0.0",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.exception_handler(ServiceAPIError)
    async def handle_service_api_error(
        _request: Request, exc: ServiceAPIError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_schema().model_dump(mode="json"),
        )

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        envelope = StandardErrorSchema(
            error=ErrorBodySchema(
                code=ErrorCodeEnum.VALIDATION_ERROR,
                message="Request payload validation failed.",
                details={"validation_errors": exc.errors()},
            )
        )
        return JSONResponse(
            status_code=400,
            content=envelope.model_dump(mode="json"),
        )

    @application.exception_handler(StarletteHTTPException)
    async def handle_http_exception(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        if exc.status_code == 401:
            code = ErrorCodeEnum.UNAUTHORIZED
        elif exc.status_code == 404:
            code = ErrorCodeEnum.RESOURCE_NOT_FOUND
        elif exc.status_code in (400, 422):
            code = ErrorCodeEnum.VALIDATION_ERROR
        else:
            code = ErrorCodeEnum.INTERNAL_ERROR

        envelope = StandardErrorSchema(
            error=ErrorBodySchema(
                code=code,
                message=str(exc.detail),
                details={},
            )
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=envelope.model_dump(mode="json"),
        )

    @application.exception_handler(Exception)
    async def handle_unexpected_exception(
        _request: Request, _exc: Exception
    ) -> JSONResponse:
        envelope = StandardErrorSchema(
            error=ErrorBodySchema(
                code=ErrorCodeEnum.INTERNAL_ERROR,
                message="An unexpected internal error occurred in the AI Engine.",
                details={},
            )
        )
        return JSONResponse(
            status_code=500,
            content=envelope.model_dump(mode="json"),
        )

    @application.get(
        "/health",
        response_model=HealthCheckResponseSchema,
        summary="Mandatory health check for AI Engine (Port 8001)",
    )
    async def get_health() -> HealthCheckResponseSchema:
        settings = get_settings()
        return HealthCheckResponseSchema(
            status="ok",
            service=settings.service_name,
            version=settings.service_version,
        )

    @application.post(
        "/internal/v1/decompose-task",
        response_model=AIDecomposeResponseSchema,
        responses={
            400: {"model": StandardErrorSchema},
            401: {"model": StandardErrorSchema},
        },
        summary="Smart Task Decomposer & Technical Risk Analyzer",
    )
    async def post_decompose_task(
        payload: AIDecomposeRequestSchema,
        _token: str = Depends(verify_internal_token),
    ) -> AIDecomposeResponseSchema:
        return await decompose_task(payload)

    @application.post(
        "/internal/v1/enrich-card",
        response_model=AISuggestCardEnrichmentResponseSchema,
        responses={
            400: {"model": StandardErrorSchema},
            401: {"model": StandardErrorSchema},
        },
        summary="Trello Power-Up Smart Card Enrichment (Description, Checklists, Labels, Priority & Story Points)",
    )
    async def post_enrich_card(
        payload: AISuggestCardEnrichmentRequestSchema,
        _token: str = Depends(verify_internal_token),
    ) -> AISuggestCardEnrichmentResponseSchema:
        return await enrich_card(payload)

    @application.post(
        "/internal/v1/parse-automation",
        response_model=AIParseAutomationResponseSchema,
        responses={
            400: {"model": StandardErrorSchema},
            401: {"model": StandardErrorSchema},
        },
        summary="Natural Language Butler Rule Parser & Compiler (Bilingual ID/EN)",
    )
    async def post_parse_automation(
        payload: AIParseAutomationRequestSchema,
        _token: str = Depends(verify_internal_token),
    ) -> AIParseAutomationResponseSchema:
        return await parse_automation(payload)

    @application.post(
        "/internal/v1/analyze-board",
        response_model=AIAnalyticsReportSchema,
        responses={
            400: {"model": StandardErrorSchema},
            401: {"model": StandardErrorSchema},
        },
        summary="AI Executive Sprint Health & Bottleneck Analyzer",
    )
    async def post_analyze_board(
        payload: AIAnalyticsRequestSchema,
        _token: str = Depends(verify_internal_token),
    ) -> AIAnalyticsReportSchema:
        return await analyze_board(payload)

    return application


app = create_app()


def run() -> None:
    """Start the Uvicorn server bound to the locked port `AI_ENGINE_PORT=8001`."""
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.ai_engine_port,
        reload=False,
    )


if __name__ == "__main__":
    run()
