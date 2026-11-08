"""
Comprehensive isolated self-test suite for `services/ai-engine` (Port 8001).
Verifies contract compliance against `packages/contracts/schemas.py`, internal token auth,
standard error envelopes, deterministic heuristic fallback, and live LLM orchestration.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.contracts import (
    AIDecomposeResponseSchema,
    HealthCheckResponseSchema,
    PriorityEnum,
    StandardErrorSchema,
)
from app.decomposer import FIBONACCI_POINTS
from app.main import app

client = TestClient(app)
DEFAULT_TOKEN = "orca_internal_sync_token_2026"


def test_locked_port_configuration() -> None:
    """Verify default locked port is 8001 per architecture registry."""
    settings = get_settings()
    assert settings.ai_engine_port == 8001


def test_health_check_returns_200_ok() -> None:
    """Verify GET /health returns 200 OK matching HealthCheckResponseSchema."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data == {
        "status": "ok",
        "service": "kinetix-ai-engine",
        "version": "1.0.0",
    }
    validated = HealthCheckResponseSchema.model_validate(data)
    assert validated.status == "ok"


def test_decompose_task_missing_token_returns_401_standard_error() -> None:
    """Verify POST /internal/v1/decompose-task without X-Internal-Token returns 401 StandardErrorSchema."""
    response = client.post(
        "/internal/v1/decompose-task",
        json={
            "card_title": "Implement OAuth2 PKCE flow",
            "card_description": "Support GitHub and Google providers",
            "board_context": ["Setup PostgreSQL users table"],
        },
    )
    assert response.status_code == 401
    body = response.json()
    validated_err = StandardErrorSchema.model_validate(body)
    assert validated_err.error.code.value == "UNAUTHORIZED"
    assert isinstance(validated_err.error.message, str) and len(validated_err.error.message) > 0
    assert validated_err.error.details == {}


def test_decompose_task_invalid_token_returns_401_standard_error() -> None:
    """Verify POST /internal/v1/decompose-task with wrong token returns 401 StandardErrorSchema."""
    response = client.post(
        "/internal/v1/decompose-task",
        headers={"X-Internal-Token": "wrong_token_value"},
        json={
            "card_title": "Implement OAuth2 PKCE flow",
            "card_description": "Support GitHub and Google providers",
        },
    )
    assert response.status_code == 401
    body = response.json()
    validated_err = StandardErrorSchema.model_validate(body)
    assert validated_err.error.code.value == "UNAUTHORIZED"


@pytest.mark.parametrize(
    ("title", "description", "context", "expected_priority"),
    [
        (
            "Implement OAuth2 PKCE flow",
            "Support GitHub and Google providers with JWT session rotation",
            ["Setup PostgreSQL users table", "Configure JWT middleware"],
            PriorityEnum.HIGH,
        ),
        (
            "Integrate Stripe billing checkout webhook",
            "Handle checkout.session.completed and subscription renewals idempotently",
            ["Create invoices table"],
            PriorityEnum.HIGH,
        ),
        (
            "Add Drizzle PostgreSQL migration for board columns",
            "Create composite index on (board_id, position)",
            [],
            PriorityEnum.HIGH,
        ),
        (
            "Build Kanban drag-and-drop card column UI",
            "Use @dnd-kit and optimistic Zustand state updates",
            [],
            PriorityEnum.MEDIUM,
        ),
        (
            "Urgent production crash hotfix in WebSocket broadcast",
            "Fix race condition causing connection drop on card move",
            ["Setup Redis pubsub"],
            PriorityEnum.URGENT,
        ),
        (
            "Configure Docker Compose healthcheck and deployment pipeline",
            "Lock ports 3000, 8000, 8001, 5432, 6379",
            [],
            PriorityEnum.MEDIUM,
        ),
    ],
)
def test_decompose_task_deterministic_heuristic_domains(
    title: str,
    description: str,
    context: list[str],
    expected_priority: PriorityEnum,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verify deterministic heuristic engine across engineering domains with valid token."""
    monkeypatch.setenv("LLM_API_KEY", "your_llm_api_key_here")

    response = client.post(
        "/internal/v1/decompose-task",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json={
            "card_title": title,
            "card_description": description,
            "board_context": context,
        },
    )
    assert response.status_code == 200
    data = response.json()

    # Validate 100% against packages/contracts/schemas.py AIDecomposeResponseSchema
    parsed = AIDecomposeResponseSchema.model_validate(data)

    assert len(parsed.suggested_subtasks) >= 3
    expected_positions = [f"a{i}" for i in range(len(parsed.suggested_subtasks))]
    actual_positions = [sub.position for sub in parsed.suggested_subtasks]
    assert actual_positions == expected_positions
    assert actual_positions == sorted(actual_positions)

    assert parsed.estimated_story_points in FIBONACCI_POINTS
    assert parsed.suggested_priority == expected_priority
    assert len(parsed.potential_risks) >= 2


def test_decompose_task_live_llm_mode_and_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify live LLM mode when LLM_API_KEY is set and automatic fallback when LLM fails."""
    monkeypatch.setenv("LLM_API_KEY", "sk-live-valid-test-key-12345")
    monkeypatch.setenv("LLM_MODEL", "gpt-4o-mini")

    mock_llm_json = {
        "suggested_subtasks": [
            {"title": "Design Redis pub/sub channel topology", "position": "a0"},
            {"title": "Implement Fastify WebSocket room fanout", "position": "a1"},
            {"title": "Add reconnection backoff in Next.js client", "position": "a2"},
        ],
        "estimated_story_points": 5,
        "suggested_priority": "HIGH",
        "potential_risks": [
            "Redis connection drop during active board session",
            "Duplicate event broadcast across multiple API workers",
        ],
    }

    mock_response = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": json.dumps(mock_llm_json),
                    }
                }
            ]
        },
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )

    with patch.object(
        httpx.AsyncClient,
        "post",
        new=AsyncMock(return_value=mock_response),
    ):
        res = client.post(
            "/internal/v1/decompose-task",
            headers={"X-Internal-Token": DEFAULT_TOKEN},
            json={
                "card_title": "Real-time WebSocket synchronization",
                "card_description": "Broadcast CARD_MOVED across peers",
            },
        )
        assert res.status_code == 200
        parsed = AIDecomposeResponseSchema.model_validate(res.json())
        assert [s.position for s in parsed.suggested_subtasks] == ["a0", "a1", "a2"]
        assert parsed.estimated_story_points == 5
        assert parsed.suggested_priority == PriorityEnum.HIGH
        assert "Redis connection drop" in parsed.potential_risks[0]

    # Now simulate upstream LLM failure and verify seamless fallback to heuristic engine
    with patch.object(
        httpx.AsyncClient,
        "post",
        new=AsyncMock(side_effect=httpx.ConnectError("Upstream LLM unreachable")),
    ):
        fallback_res = client.post(
            "/internal/v1/decompose-task",
            headers={"X-Internal-Token": DEFAULT_TOKEN},
            json={
                "card_title": "Real-time WebSocket synchronization",
                "card_description": "Broadcast CARD_MOVED across peers",
            },
        )
        assert fallback_res.status_code == 200
        fallback_parsed = AIDecomposeResponseSchema.model_validate(fallback_res.json())
        assert len(fallback_parsed.suggested_subtasks) >= 3
        assert fallback_parsed.estimated_story_points in FIBONACCI_POINTS


def test_validation_error_uses_standard_error_envelope() -> None:
    """Verify invalid payload (empty card_title) returns 400 with StandardErrorSchema."""
    response = client.post(
        "/internal/v1/decompose-task",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json={"card_title": ""},
    )
    assert response.status_code == 400
    validated_err = StandardErrorSchema.model_validate(response.json())
    assert validated_err.error.code.value == "VALIDATION_ERROR"
