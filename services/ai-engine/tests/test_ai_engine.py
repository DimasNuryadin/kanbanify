"""
Comprehensive isolated self-test suite for `services/ai-engine` (Port 8001).
Verifies contract compliance against `packages/contracts/schemas.py`, internal token auth,
standard error envelopes, deterministic heuristic fallback, and live LLM orchestration
for both `POST /internal/v1/decompose-task` and `POST /internal/v1/enrich-card`.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.contracts import (
    AIDecomposeResponseSchema,
    AISuggestCardEnrichmentResponseSchema,
    HealthCheckResponseSchema,
    LabelColorEnum,
    PriorityEnum,
    StandardErrorSchema,
)
from app.decomposer import FIBONACCI_POINTS
from app.main import app

client = TestClient(app)
DEFAULT_TOKEN = "orca_internal_sync_token_2026"

# Load canonical shared contract module directly to verify 1:1 physical contract compliance
_SHARED_SCHEMAS_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "packages"
    / "contracts"
    / "schemas.py"
)
_shared_spec = importlib.util.spec_from_file_location(
    "test_canonical_contracts", _SHARED_SCHEMAS_PATH
)
assert _shared_spec is not None and _shared_spec.loader is not None
_canonical_contracts = importlib.util.module_from_spec(_shared_spec)
sys.modules[_shared_spec.name] = _canonical_contracts
_shared_spec.loader.exec_module(_canonical_contracts)


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


# ============================================================================
# 1. TASK DECOMPOSER TESTS (`POST /internal/v1/decompose-task`)
# ============================================================================


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
    canonical = _canonical_contracts.AIDecomposeResponseSchema.model_validate(data)
    assert canonical.estimated_story_points == parsed.estimated_story_points

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


# ============================================================================
# 2. TRELLO CARD ENRICHMENT TESTS (`POST /internal/v1/enrich-card`)
# ============================================================================


def test_enrich_card_missing_and_invalid_token_returns_401() -> None:
    """Verify POST /internal/v1/enrich-card enforces X-Internal-Token with 401 StandardErrorSchema."""
    missing_res = client.post(
        "/internal/v1/enrich-card",
        json={
            "card_title": "Implement OAuth2 PKCE flow",
            "card_description": "Support GitHub and Google providers",
        },
    )
    assert missing_res.status_code == 401
    missing_err = StandardErrorSchema.model_validate(missing_res.json())
    assert missing_err.error.code.value == "UNAUTHORIZED"

    invalid_res = client.post(
        "/internal/v1/enrich-card",
        headers={"X-Internal-Token": "invalid_token"},
        json={
            "card_title": "Implement OAuth2 PKCE flow",
        },
    )
    assert invalid_res.status_code == 401
    invalid_err = StandardErrorSchema.model_validate(invalid_res.json())
    assert invalid_err.error.code.value == "UNAUTHORIZED"


def test_enrich_card_validation_error_returns_400_standard_error() -> None:
    """Verify POST /internal/v1/enrich-card with empty card_title returns 400 StandardErrorSchema."""
    res = client.post(
        "/internal/v1/enrich-card",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json={"card_title": ""},
    )
    assert res.status_code == 400
    validated_err = StandardErrorSchema.model_validate(res.json())
    assert validated_err.error.code.value == "VALIDATION_ERROR"


@pytest.mark.parametrize(
    ("title", "description", "available_labels", "expected_priority", "expected_color"),
    [
        (
            "Implement OAuth2 PKCE flow",
            "Support GitHub and Google providers",
            [
                {
                    "id": "77777777-7777-4777-8777-777777777771",
                    "board_id": "11111111-1111-4111-8111-111111111111",
                    "name": "Ship Ready",
                    "color": "green",
                },
                {
                    "id": "77777777-7777-4777-8777-777777777776",
                    "board_id": "11111111-1111-4111-8111-111111111111",
                    "name": "Architecture",
                    "color": "blue",
                },
            ],
            PriorityEnum.HIGH,
            LabelColorEnum.BLUE,
        ),
        (
            "Urgent blocker hotfix for payment webhook race condition",
            "Prevent duplicate Stripe invoice charges on retry",
            [{"name": "Blocker", "color": "red"}, {"name": "Tech Debt", "color": "orange"}],
            PriorityEnum.URGENT,
            LabelColorEnum.RED,
        ),
        (
            "Build responsive Trello card modal UI with checklists",
            "Support Markdown description preview and label picker",
            ["sky", "green"],
            PriorityEnum.MEDIUM,
            LabelColorEnum.SKY,
        ),
    ],
)
def test_enrich_card_deterministic_heuristics_and_flexible_labels(
    title: str,
    description: str,
    available_labels: list[object],
    expected_priority: PriorityEnum,
    expected_color: LabelColorEnum,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Verify POST /internal/v1/enrich-card generates a complete Trello Power-Up enrichment
    package validating against both canonical `packages/contracts/schemas.py` and `app.contracts`.
    """
    monkeypatch.setenv("LLM_API_KEY", "your_llm_api_key_here")

    response = client.post(
        "/internal/v1/enrich-card",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json={
            "card_title": title,
            "card_description": description,
            "board_context": ["Setup PostgreSQL users table", "Configure JWT middleware"],
            "available_labels": available_labels,
        },
    )
    assert response.status_code == 200
    data = response.json()

    # Validate against canonical packages/contracts/schemas.py model
    canonical_parsed = _canonical_contracts.AISuggestCardEnrichmentResponseSchema.model_validate(
        data
    )
    # Validate against service contract model
    parsed = AISuggestCardEnrichmentResponseSchema.model_validate(data)

    # 1. Structured Markdown description with Objective, Acceptance Criteria, Technical Notes
    assert "## Objective" in parsed.structured_description
    assert "## Acceptance Criteria" in parsed.structured_description
    assert "## Technical Notes" in parsed.structured_description
    assert parsed.suggested_description == parsed.structured_description
    assert canonical_parsed.structured_description == parsed.structured_description

    # 2. Multiple grouped checklists with fractional-indexed items
    assert len(parsed.suggested_checklists) >= 2
    checklist_positions = [cl.position for cl in parsed.suggested_checklists]
    assert checklist_positions == [f"a{i}" for i in range(len(parsed.suggested_checklists))]
    checklist_titles = [cl.title for cl in parsed.suggested_checklists]
    assert "Implementation Steps" in checklist_titles[0]
    assert "QA" in checklist_titles[1] and "Verification" in checklist_titles[1]

    for cl in parsed.suggested_checklists:
        assert len(cl.items) >= 2
        item_positions = [item.position for item in cl.items]
        assert item_positions == [f"a{i}" for i in range(len(cl.items))]

    # 3. Recommended Trello labels and label colors
    assert len(parsed.suggested_labels) >= 2
    assert len(parsed.suggested_label_colors) >= 2
    assert expected_color in parsed.suggested_label_colors
    assert parsed.suggested_label_colors == [lbl.color for lbl in parsed.suggested_labels]

    # 4. Story points, priority, and risks
    assert parsed.estimated_story_points in FIBONACCI_POINTS
    assert parsed.suggested_priority == expected_priority
    assert len(parsed.potential_risks) >= 2


def test_enrich_card_live_llm_mode_and_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify live LLM enrichment mode and automatic fallback on upstream failure."""
    monkeypatch.setenv("LLM_API_KEY", "sk-live-valid-test-key-67890")
    monkeypatch.setenv("LLM_MODEL", "gpt-4o-mini")

    mock_enrichment_json = {
        "structured_description": (
            "## Objective\n"
            "Implement OAuth2 PKCE authentication flow for GitHub and Google.\n\n"
            "## Acceptance Criteria\n"
            "- S256 code challenge verification\n"
            "- Secure HTTP-only session rotation\n\n"
            "## Technical Notes\n"
            "- Use constant-time state token comparison."
        ),
        "suggested_checklists": [
            {
                "title": "Implementation Steps",
                "position": "a0",
                "items": [
                    {"title": "Register OAuth2 client credentials and redirect URIs", "position": "a0"},
                    {"title": "Implement PKCE code_verifier and code_challenge generator", "position": "a1"},
                ],
            },
            {
                "title": "QA & Verification",
                "position": "a1",
                "items": [
                    {"title": "Verify state parameter CSRF protection", "position": "a0"},
                ],
            },
        ],
        "suggested_labels": [
            {"name": "Architecture", "color": "blue"},
            {"name": "AI Assisted", "color": "purple"},
        ],
        "estimated_story_points": 5,
        "suggested_priority": "HIGH",
        "potential_risks": [
            "Callback URL mismatch across local and staging environments",
        ],
    }

    mock_response = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": json.dumps(mock_enrichment_json),
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
            "/internal/v1/enrich-card",
            headers={"X-Internal-Token": DEFAULT_TOKEN},
            json={
                "card_title": "Implement OAuth2 PKCE flow",
                "card_description": "Support GitHub and Google providers",
            },
        )
        assert res.status_code == 200
        body = res.json()
        _canonical_contracts.AISuggestCardEnrichmentResponseSchema.model_validate(body)
        parsed = AISuggestCardEnrichmentResponseSchema.model_validate(body)
        assert "## Objective" in parsed.structured_description
        assert "## Acceptance Criteria" in parsed.structured_description
        assert "## Technical Notes" in parsed.structured_description
        assert parsed.suggested_description == parsed.structured_description
        assert [cl.position for cl in parsed.suggested_checklists] == ["a0", "a1"]
        assert [c.value for c in parsed.suggested_label_colors] == ["blue", "purple"]
        assert parsed.estimated_story_points == 5
        assert parsed.suggested_priority == PriorityEnum.HIGH

    # Simulate upstream LLM timeout/error and verify fallback to deterministic heuristics
    with patch.object(
        httpx.AsyncClient,
        "post",
        new=AsyncMock(side_effect=httpx.ReadTimeout("LLM request timed out")),
    ):
        fallback_res = client.post(
            "/internal/v1/enrich-card",
            headers={"X-Internal-Token": DEFAULT_TOKEN},
            json={
                "card_title": "Implement OAuth2 PKCE flow",
                "card_description": "Support GitHub and Google providers",
            },
        )
        assert fallback_res.status_code == 200
        fallback_parsed = AISuggestCardEnrichmentResponseSchema.model_validate(
            fallback_res.json()
        )
        assert "## Objective" in fallback_parsed.structured_description
        assert len(fallback_parsed.suggested_checklists) >= 2
        assert fallback_parsed.estimated_story_points in FIBONACCI_POINTS
