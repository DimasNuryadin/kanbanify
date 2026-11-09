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
    AIAnalyticsReportSchema,
    AIDecomposeResponseSchema,
    AIParseAutomationResponseSchema,
    AISuggestCardEnrichmentResponseSchema,
    AutomationActionTypeEnum,
    AutomationTriggerTypeEnum,
    HealthCheckResponseSchema,
    LabelColorEnum,
    PriorityEnum,
    SprintHealthStatusEnum,
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


# ============================================================================
# 3. BUTLER NATURAL LANGUAGE AUTOMATION PARSER TESTS (`POST /internal/v1/parse-automation`)
# ============================================================================


def test_parse_automation_missing_token_returns_401_standard_error() -> None:
    """Verify POST /internal/v1/parse-automation without X-Internal-Token returns 401 StandardErrorSchema."""
    res = client.post(
        "/internal/v1/parse-automation",
        json={
            "prompt": "Saat kartu pindah ke Done, otomatis centang due date dan assign member",
            "board_columns": [{"id": "col-done", "title": "Done"}],
            "board_members": [{"id": "mem-1", "name": "Budi Santoso"}],
            "board_labels": [{"id": "lbl-1", "name": "Ship Ready", "color": "green"}],
        },
    )
    assert res.status_code == 401
    body = res.json()
    validated_err = StandardErrorSchema.model_validate(body)
    assert validated_err.error.code.value == "UNAUTHORIZED"
    assert "X-Internal-Token" in validated_err.error.message


def test_parse_automation_invalid_token_returns_401_standard_error() -> None:
    """Verify POST /internal/v1/parse-automation with invalid token returns 401 StandardErrorSchema."""
    res = client.post(
        "/internal/v1/parse-automation",
        headers={"X-Internal-Token": "invalid_sync_token"},
        json={
            "prompt": "When card moved to Done, mark due date complete",
            "board_columns": [{"id": "col-done", "title": "Done"}],
        },
    )
    assert res.status_code == 401
    body = res.json()
    validated_err = StandardErrorSchema.model_validate(body)
    assert validated_err.error.code.value == "UNAUTHORIZED"


def test_parse_automation_empty_prompt_returns_400_validation_error() -> None:
    """Verify POST /internal/v1/parse-automation with invalid/empty prompt returns 400 StandardErrorSchema."""
    res = client.post(
        "/internal/v1/parse-automation",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json={
            "prompt": "",
        },
    )
    assert res.status_code == 400
    body = res.json()
    validated_err = StandardErrorSchema.model_validate(body)
    assert validated_err.error.code.value == "VALIDATION_ERROR"


def test_parse_automation_indonesian_prompt_when_card_moved_to_done() -> None:
    """
    MANDATORY GATE 2 TEST:
    Verify POST /internal/v1/parse-automation with an Indonesian prompt:
    'Saat kartu pindah ke Done, otomatis centang due date dan assign member'
    returns a valid WHEN_CARD_MOVED_TO_COLUMN trigger and MARK_DUE_DATE_COMPLETE + ASSIGN_MEMBER
    actions mapped to the passed board_columns and board_members.
    """
    payload = {
        "prompt": "Saat kartu pindah ke Done, otomatis centang due date dan assign member",
        "board_columns": [
            {"id": "col-todo", "title": "To Do"},
            {"id": "col-inprogress", "title": "In Progress"},
            {"id": "col-done", "title": "Done"},
        ],
        "board_members": [
            {"id": "mem-budi", "name": "Budi Santoso"},
            {"id": "mem-siti", "name": "Siti Rahma"},
        ],
        "board_labels": [
            {"id": "lbl-ship", "name": "Ship Ready", "color": "green"},
        ],
    }

    res = client.post(
        "/internal/v1/parse-automation",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert res.status_code == 200
    data = res.json()

    # Validate 1:1 against canonical shared contract schema
    canonical_validated = (
        _canonical_contracts.AIParseAutomationResponseSchema.model_validate(data)
    )
    assert canonical_validated.name
    assert canonical_validated.description

    # Validate internal model
    response = AIParseAutomationResponseSchema.model_validate(data)
    assert response.name
    assert response.description

    # Verify Trigger mapping
    assert response.trigger.type == AutomationTriggerTypeEnum.WHEN_CARD_MOVED_TO_COLUMN
    assert response.trigger.column_id == "col-done"
    assert response.trigger.column_title_match == "Done"

    # Verify Action mapping
    assert len(response.actions) == 2
    action_types = [a.type for a in response.actions]
    assert AutomationActionTypeEnum.MARK_DUE_DATE_COMPLETE in action_types
    assert AutomationActionTypeEnum.ASSIGN_MEMBER in action_types

    due_action = next(
        a
        for a in response.actions
        if a.type == AutomationActionTypeEnum.MARK_DUE_DATE_COMPLETE
    )
    assert due_action.due_complete_value is True

    assign_action = next(
        a for a in response.actions if a.type == AutomationActionTypeEnum.ASSIGN_MEMBER
    )
    # Generic assign fallback maps to the first member in board_members
    assert assign_action.member_id == "mem-budi"


def test_parse_automation_english_prompt_card_moved_with_label() -> None:
    """Verify English prompt matching api-contract.md example."""
    payload = {
        "prompt": "When any card moves to Done, mark due date complete and add green label Ship Ready",
        "board_columns": [
            {"id": "33333333-3333-4333-8333-333333333331", "title": "Backlog"},
            {"id": "33333333-3333-4333-8333-333333333334", "title": "Done"},
        ],
        "board_members": [
            {"id": "88888888-8888-4888-8888-888888888881", "name": "Alex Rivera"}
        ],
        "board_labels": [
            {
                "id": "77777777-7777-4777-8777-777777777771",
                "name": "Ship Ready",
                "color": "green",
            }
        ],
    }

    res = client.post(
        "/internal/v1/parse-automation",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert res.status_code == 200
    data = res.json()

    _canonical_contracts.AIParseAutomationResponseSchema.model_validate(data)
    response = AIParseAutomationResponseSchema.model_validate(data)

    assert response.trigger.type == AutomationTriggerTypeEnum.WHEN_CARD_MOVED_TO_COLUMN
    assert response.trigger.column_id == "33333333-3333-4333-8333-333333333334"
    assert response.trigger.column_title_match == "Done"

    action_types = [a.type for a in response.actions]
    assert AutomationActionTypeEnum.MARK_DUE_DATE_COMPLETE in action_types
    assert AutomationActionTypeEnum.ADD_LABEL in action_types

    label_action = next(
        a for a in response.actions if a.type == AutomationActionTypeEnum.ADD_LABEL
    )
    assert label_action.label_id == "77777777-7777-4777-8777-777777777771"


def test_parse_automation_specific_member_and_priority() -> None:
    """Verify matching specific member name and setting priority."""
    payload = {
        "prompt": "Ketika kartu pindah ke In Progress, assign ke Alex Rivera dan set prioritas urgent",
        "board_columns": [
            {"id": "c-prog", "title": "In Progress"},
            {"id": "c-done", "title": "Done"},
        ],
        "board_members": [
            {"id": "m-budi", "name": "Budi Santoso"},
            {"id": "m-alex", "name": "Alex Rivera"},
        ],
        "board_labels": [],
    }

    res = client.post(
        "/internal/v1/parse-automation",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert res.status_code == 200
    response = AIParseAutomationResponseSchema.model_validate(res.json())

    assert response.trigger.column_id == "c-prog"
    assert response.trigger.column_title_match == "In Progress"

    assign_action = next(
        a for a in response.actions if a.type == AutomationActionTypeEnum.ASSIGN_MEMBER
    )
    assert assign_action.member_id == "m-alex"

    prio_action = next(
        a for a in response.actions if a.type == AutomationActionTypeEnum.SET_PRIORITY
    )
    assert prio_action.priority == PriorityEnum.URGENT


def test_parse_automation_checklist_completed_and_move_card() -> None:
    """Verify checklist completed trigger and move card to column action."""
    payload = {
        "prompt": "Saat checklist selesai, pindahkan kartu ke Review dan beri label Verified",
        "board_columns": [
            {"id": "c-rev", "title": "Review"},
            {"id": "c-done", "title": "Done"},
        ],
        "board_members": [],
        "board_labels": [
            {"id": "l-ver", "name": "Verified", "color": "lime"},
        ],
    }

    res = client.post(
        "/internal/v1/parse-automation",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert res.status_code == 200
    response = AIParseAutomationResponseSchema.model_validate(res.json())

    assert (
        response.trigger.type == AutomationTriggerTypeEnum.WHEN_CHECKLIST_COMPLETED
    )
    move_action = next(
        a
        for a in response.actions
        if a.type == AutomationActionTypeEnum.MOVE_CARD_TO_COLUMN
    )
    assert move_action.target_column_id == "c-rev"

    label_action = next(
        a for a in response.actions if a.type == AutomationActionTypeEnum.ADD_LABEL
    )
    assert label_action.label_id == "l-ver"


def test_parse_automation_card_created_with_add_checklist() -> None:
    """Verify card created trigger with add checklist action."""
    payload = {
        "prompt": "When a card is created in Backlog, add checklist Verification Steps",
        "board_columns": [
            {"id": "c-backlog", "title": "Backlog"},
        ],
        "board_members": [],
        "board_labels": [],
    }

    res = client.post(
        "/internal/v1/parse-automation",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert res.status_code == 200
    response = AIParseAutomationResponseSchema.model_validate(res.json())

    assert response.trigger.type == AutomationTriggerTypeEnum.WHEN_CARD_CREATED
    assert response.trigger.column_id == "c-backlog"

    cl_action = next(
        a
        for a in response.actions
        if a.type == AutomationActionTypeEnum.ADD_CHECKLIST
    )
    assert cl_action.checklist_title
    assert "Verification" in cl_action.checklist_title


def test_parse_automation_priority_changed_trigger() -> None:
    """Verify priority changed trigger with comment and label action."""
    payload = {
        "prompt": "Saat prioritas kartu berubah menjadi urgent, beri label Blocker dan tulis komentar Mohon segera ditindaklanjuti",
        "board_columns": [],
        "board_members": [],
        "board_labels": [
            {"id": "l-blocker", "name": "Blocker", "color": "red"},
        ],
    }

    res = client.post(
        "/internal/v1/parse-automation",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert res.status_code == 200
    response = AIParseAutomationResponseSchema.model_validate(res.json())

    assert response.trigger.type == AutomationTriggerTypeEnum.WHEN_PRIORITY_CHANGED
    assert response.trigger.priority == PriorityEnum.URGENT

    label_action = next(
        a for a in response.actions if a.type == AutomationActionTypeEnum.ADD_LABEL
    )
    assert label_action.label_id == "l-blocker"

    comment_action = next(
        a for a in response.actions if a.type == AutomationActionTypeEnum.POST_COMMENT
    )
    assert "ditindaklanjuti" in (comment_action.comment_text or "")


def test_parse_automation_label_added_trigger() -> None:
    """Verify label added trigger with priority update."""
    payload = {
        "prompt": "when label Bug is added, set priority to urgent",
        "board_columns": [],
        "board_members": [],
        "board_labels": [
            {"id": "l-bug", "name": "Bug", "color": "red"},
        ],
    }

    res = client.post(
        "/internal/v1/parse-automation",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert res.status_code == 200
    response = AIParseAutomationResponseSchema.model_validate(res.json())

    assert response.trigger.type == AutomationTriggerTypeEnum.WHEN_LABEL_ADDED
    assert response.trigger.label_id == "l-bug"

    prio_action = next(
        a for a in response.actions if a.type == AutomationActionTypeEnum.SET_PRIORITY
    )
    assert prio_action.priority == PriorityEnum.URGENT


def test_parse_automation_color_synonym_mapping() -> None:
    """Verify Indonesian color synonym (hijau -> green) maps to label."""
    payload = {
        "prompt": "Saat kartu masuk ke Done, tempel label hijau",
        "board_columns": [{"id": "c-done", "title": "Done"}],
        "board_members": [],
        "board_labels": [
            {"id": "l-red", "name": "Bug", "color": "red"},
            {"id": "l-green", "name": "Ready", "color": "green"},
        ],
    }

    res = client.post(
        "/internal/v1/parse-automation",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert res.status_code == 200
    response = AIParseAutomationResponseSchema.model_validate(res.json())

    assert response.trigger.column_id == "c-done"
    label_action = next(
        a for a in response.actions if a.type == AutomationActionTypeEnum.ADD_LABEL
    )
    assert label_action.label_id == "l-green"


def test_parse_automation_live_llm_orchestration_and_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verify live LLM response handling and graceful fallback on LLM failure."""
    monkeypatch.setenv("LLM_API_KEY", "sk-proj-test-live-key-12345")

    mock_rule_json = {
        "name": "Auto-Complete & Tag Done Cards",
        "description": "When card moves to Done, mark due date complete and attach Ship Ready label",
        "trigger": {
            "type": "WHEN_CARD_MOVED_TO_COLUMN",
            "column_id": "col-done",
            "column_title_match": "Done",
            "priority": None,
            "label_id": None,
        },
        "actions": [
            {
                "type": "MARK_DUE_DATE_COMPLETE",
                "due_complete_value": True,
            },
            {
                "type": "ADD_LABEL",
                "label_id": "lbl-ship",
                "due_complete_value": None,
            },
        ],
    }

    mock_response = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": json.dumps(mock_rule_json),
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
            "/internal/v1/parse-automation",
            headers={"X-Internal-Token": DEFAULT_TOKEN},
            json={
                "prompt": "When card moved to Done, mark complete and tag Ship Ready",
                "board_columns": [{"id": "col-done", "title": "Done"}],
                "board_labels": [{"id": "lbl-ship", "name": "Ship Ready", "color": "green"}],
            },
        )
        assert res.status_code == 200
        parsed = AIParseAutomationResponseSchema.model_validate(res.json())
        assert parsed.name == "Auto-Complete & Tag Done Cards"
        assert parsed.trigger.column_id == "col-done"
        assert len(parsed.actions) == 2

    # Simulate upstream timeout and verify fallback to deterministic compiler
    with patch.object(
        httpx.AsyncClient,
        "post",
        new=AsyncMock(side_effect=httpx.ReadTimeout("LLM timeout")),
    ):
        fallback_res = client.post(
            "/internal/v1/parse-automation",
            headers={"X-Internal-Token": DEFAULT_TOKEN},
            json={
                "prompt": "Saat kartu pindah ke Done, otomatis centang due date dan assign member",
                "board_columns": [{"id": "col-done", "title": "Done"}],
                "board_members": [{"id": "mem-1", "name": "Budi Santoso"}],
            },
        )
        assert fallback_res.status_code == 200
        fallback_parsed = AIParseAutomationResponseSchema.model_validate(
            fallback_res.json()
        )
        assert (
            fallback_parsed.trigger.type
            == AutomationTriggerTypeEnum.WHEN_CARD_MOVED_TO_COLUMN
        )
        assert fallback_parsed.trigger.column_id == "col-done"
        assert len(fallback_parsed.actions) == 2


# ============================================================================
# 4. PHASE 4 AI EXECUTIVE SPRINT HEALTH & BOTTLENECK ANALYZER TESTS
#    (`POST /internal/v1/analyze-board`)
# ============================================================================


def _sample_board_analytics_payload() -> dict[str, object]:
    """Return canonical sample AIAnalyticsRequestSchema payload from docs/api-contract.md."""
    return {
        "board_title": "Kinetix Platform Launch",
        "analytics": {
            "board_id": "11111111-1111-4111-8111-111111111111",
            "total_cards": 12,
            "completed_cards": 5,
            "archived_cards": 1,
            "completion_rate": 41.7,
            "total_story_points": 42,
            "completed_story_points": 18,
            "overdue_cards_count": 2,
            "blocked_cards_count": 1,
            "checklist_completion_rate": 68.5,
            "automation_executions_total": 9,
            "cards_by_column": [
                {
                    "column_id": "33333333-3333-4333-8333-333333333331",
                    "column_title": "Backlog",
                    "card_count": 3,
                    "total_story_points": 11,
                    "wip_limit": None,
                    "is_bottleneck": False,
                },
                {
                    "column_id": "33333333-3333-4333-8333-333333333332",
                    "column_title": "In Progress",
                    "card_count": 4,
                    "total_story_points": 13,
                    "wip_limit": 3,
                    "is_bottleneck": True,
                },
                {
                    "column_id": "33333333-3333-4333-8333-333333333334",
                    "column_title": "Done",
                    "card_count": 5,
                    "total_story_points": 18,
                    "wip_limit": None,
                    "is_bottleneck": False,
                },
            ],
            "workload_by_member": [
                {
                    "member_id": "88888888-8888-4888-8888-888888888881",
                    "member_name": "Alex Rivera",
                    "member_initials": "AR",
                    "member_color": "#3b82f6",
                    "assigned_cards_count": 5,
                    "completed_cards_count": 2,
                    "active_story_points": 13,
                    "overdue_cards_count": 1,
                },
                {
                    "member_id": "88888888-8888-4888-8888-888888888882",
                    "member_name": "Samir Patel",
                    "member_initials": "SP",
                    "member_color": "#10b981",
                    "assigned_cards_count": 3,
                    "completed_cards_count": 2,
                    "active_story_points": 3,
                    "overdue_cards_count": 0,
                },
            ],
            "cards_by_priority": [
                {"priority": "URGENT", "count": 2, "story_points": 13},
                {"priority": "HIGH", "count": 4, "story_points": 16},
                {"priority": "MEDIUM", "count": 4, "story_points": 10},
                {"priority": "LOW", "count": 2, "story_points": 3},
            ],
            "cards_by_label": [
                {
                    "label_id": "77777777-7777-4777-8777-777777777771",
                    "label_name": "Ship Ready",
                    "label_color": "green",
                    "count": 5,
                },
                {
                    "label_id": "77777777-7777-4777-8777-777777777774",
                    "label_name": "Blocker",
                    "label_color": "red",
                    "count": 1,
                },
            ],
            "burndown_series": [
                {
                    "date": "Day 1",
                    "ideal_remaining_points": 42,
                    "actual_remaining_points": 42,
                    "completed_cards_count": 0,
                },
                {
                    "date": "Day 7",
                    "ideal_remaining_points": 0,
                    "actual_remaining_points": 24,
                    "completed_cards_count": 5,
                },
            ],
        },
    }


def test_analyze_board_missing_and_invalid_token_returns_401() -> None:
    """
    MANDATORY GATE 2 TEST:
    Verify POST /internal/v1/analyze-board without X-Internal-Token (or with invalid token)
    returns 401 UNAUTHORIZED matching StandardErrorSchema.
    """
    payload = _sample_board_analytics_payload()

    missing_res = client.post("/internal/v1/analyze-board", json=payload)
    assert missing_res.status_code == 401
    missing_err = StandardErrorSchema.model_validate(missing_res.json())
    assert missing_err.error.code.value == "UNAUTHORIZED"
    assert "X-Internal-Token" in missing_err.error.message

    invalid_res = client.post(
        "/internal/v1/analyze-board",
        headers={"X-Internal-Token": "wrong_internal_token"},
        json=payload,
    )
    assert invalid_res.status_code == 401
    invalid_err = StandardErrorSchema.model_validate(invalid_res.json())
    assert invalid_err.error.code.value == "UNAUTHORIZED"


def test_analyze_board_validation_error_returns_400_standard_error() -> None:
    """Verify POST /internal/v1/analyze-board with invalid payload returns 400 StandardErrorSchema."""
    res = client.post(
        "/internal/v1/analyze-board",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json={"board_title": ""},
    )
    assert res.status_code == 400
    validated_err = StandardErrorSchema.model_validate(res.json())
    assert validated_err.error.code.value == "VALIDATION_ERROR"


def test_analyze_board_deterministic_quantitative_analyzer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    MANDATORY GATE 2 TEST:
    Verify POST /internal/v1/analyze-board with sample BoardAnalytics returns 200 OK
    matching AIAnalyticsReportSchema with accurate health_score, health_status,
    specific bottlenecks naming the bottlenecked column and overloaded member,
    and actionable_recommendations.
    """
    monkeypatch.setenv("LLM_API_KEY", "your_llm_api_key_here")
    payload = _sample_board_analytics_payload()

    res = client.post(
        "/internal/v1/analyze-board",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert res.status_code == 200
    data = res.json()

    # Validate 1:1 against canonical packages/contracts/schemas.py AIAnalyticsReportSchema
    canonical_report = _canonical_contracts.AIAnalyticsReportSchema.model_validate(data)
    report = AIAnalyticsReportSchema.model_validate(data)

    assert canonical_report.health_score == report.health_score
    assert canonical_report.health_status.value == report.health_status.value

    # Verify ON_TRACK score band (60-79) for the sample sprint
    assert 60 <= report.health_score <= 79
    assert report.health_status == SprintHealthStatusEnum.ON_TRACK

    # Verify executive summary references completion rate and bottleneck
    assert "41.7%" in report.executive_summary
    assert "In Progress" in report.executive_summary

    # Verify data-backed bottlenecks name the exact bottlenecked column ('In Progress')
    # and overloaded team member ('Alex Rivera')
    assert len(report.bottlenecks) >= 3
    joined_bottlenecks = " ".join(report.bottlenecks)
    assert "In Progress" in joined_bottlenecks
    assert "Alex Rivera" in joined_bottlenecks
    assert "overdue" in joined_bottlenecks.lower() or "past due" in joined_bottlenecks.lower()

    # Verify actionable recommendations reference specific column and member rebalancing
    assert len(report.actionable_recommendations) >= 3
    joined_recs = " ".join(report.actionable_recommendations)
    assert "In Progress" in joined_recs
    assert "Alex Rivera" in joined_recs
    assert "Samir Patel" in joined_recs
    assert report.generated_at


@pytest.mark.parametrize(
    (
        "completion_rate",
        "completed_sp",
        "total_sp",
        "checklist_rate",
        "overdue_count",
        "blocked_count",
        "is_bottleneck",
        "expected_status",
        "min_score",
        "max_score",
    ),
    [
        # EXCELLENT (>= 80): high completion, zero overdue/blocked/bottlenecks
        (90.0, 38.0, 40.0, 92.0, 0, 0, False, SprintHealthStatusEnum.EXCELLENT, 80.0, 100.0),
        # ON_TRACK (60-79): moderate completion, minor risk
        (45.0, 20.0, 40.0, 70.0, 1, 0, True, SprintHealthStatusEnum.ON_TRACK, 60.0, 79.9),
        # AT_RISK (40-59): low-moderate completion with multiple overdue/blocked items & bottleneck
        (25.0, 10.0, 40.0, 30.0, 4, 2, True, SprintHealthStatusEnum.AT_RISK, 40.0, 59.9),
        # CRITICAL (< 40): stalled sprint with heavy overdue, blocked cards, and bottlenecks
        (5.0, 2.0, 50.0, 10.0, 7, 4, True, SprintHealthStatusEnum.CRITICAL, 0.0, 39.9),
    ],
)
def test_analyze_board_health_score_and_status_bands(
    completion_rate: float,
    completed_sp: float,
    total_sp: float,
    checklist_rate: float,
    overdue_count: int,
    blocked_count: int,
    is_bottleneck: bool,
    expected_status: SprintHealthStatusEnum,
    min_score: float,
    max_score: float,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verify deterministic health_score math and exact status threshold mappings across all 4 bands."""
    monkeypatch.setenv("LLM_API_KEY", "your_llm_api_key_here")

    payload = _sample_board_analytics_payload()
    analytics_dict = dict(payload["analytics"])  # type: ignore[arg-type]
    analytics_dict["completion_rate"] = completion_rate
    analytics_dict["completed_story_points"] = completed_sp
    analytics_dict["total_story_points"] = total_sp
    analytics_dict["checklist_completion_rate"] = checklist_rate
    analytics_dict["overdue_cards_count"] = overdue_count
    analytics_dict["blocked_cards_count"] = blocked_count
    analytics_dict["automation_executions_total"] = 0
    analytics_dict["cards_by_column"] = [
        {
            "column_id": "col-inprog",
            "column_title": "In Progress",
            "card_count": 5 if is_bottleneck else 2,
            "total_story_points": 15.0,
            "wip_limit": 3,
            "is_bottleneck": is_bottleneck,
        }
    ]
    payload["analytics"] = analytics_dict

    res = client.post(
        "/internal/v1/analyze-board",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert res.status_code == 200
    report = AIAnalyticsReportSchema.model_validate(res.json())
    assert min_score <= report.health_score <= max_score
    assert report.health_status == expected_status


def test_analyze_board_live_llm_orchestration_and_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verify live LLM mode for POST /internal/v1/analyze-board and graceful fallback on LLM error."""
    monkeypatch.setenv("LLM_API_KEY", "sk-live-valid-test-key-sprint-999")
    monkeypatch.setenv("LLM_MODEL", "gpt-4o-mini")

    mock_llm_report = {
        "health_score": 74,
        "health_status": "ON_TRACK",
        "executive_summary": (
            "Sprint velocity is steady at **41.7% completion** (18/42 story points delivered), "
            "though a WIP limit breach in **In Progress** (4/3 cards) and 2 overdue cards require attention."
        ),
        "bottlenecks": [
            "Column 'In Progress' exceeds its WIP limit (4 active cards vs limit of 3).",
            "2 cards are currently past their due date and 1 card is flagged as blocked.",
            "Alex Rivera is carrying 13 active story points across 3 open cards.",
        ],
        "actionable_recommendations": [
            "Swarm on the 1 blocked card in 'In Progress' to bring the column back within its WIP limit of 3.",
            "Rebalance 1 High-priority card from Alex Rivera to Samir Patel.",
            "Review and update due dates for the 2 overdue cards during tomorrow's standup.",
        ],
        "generated_at": "2026-11-09T09:00:00.000Z",
    }

    mock_response = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": json.dumps(mock_llm_report),
                    }
                }
            ]
        },
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )

    payload = _sample_board_analytics_payload()

    with patch.object(
        httpx.AsyncClient,
        "post",
        new=AsyncMock(return_value=mock_response),
    ):
        res = client.post(
            "/internal/v1/analyze-board",
            headers={"X-Internal-Token": DEFAULT_TOKEN},
            json=payload,
        )
        assert res.status_code == 200
        body = res.json()
        _canonical_contracts.AIAnalyticsReportSchema.model_validate(body)
        parsed = AIAnalyticsReportSchema.model_validate(body)
        assert parsed.health_score == 74
        assert parsed.health_status == SprintHealthStatusEnum.ON_TRACK
        assert "41.7% completion" in parsed.executive_summary
        assert len(parsed.bottlenecks) == 3
        assert len(parsed.actionable_recommendations) == 3

    # Simulate upstream LLM failure and verify automatic fallback to deterministic analyzer
    with patch.object(
        httpx.AsyncClient,
        "post",
        new=AsyncMock(side_effect=httpx.ConnectError("LLM service unreachable")),
    ):
        fallback_res = client.post(
            "/internal/v1/analyze-board",
            headers={"X-Internal-Token": DEFAULT_TOKEN},
            json=payload,
        )
        assert fallback_res.status_code == 200
        fallback_parsed = AIAnalyticsReportSchema.model_validate(fallback_res.json())
        assert 60 <= fallback_parsed.health_score <= 79
        assert fallback_parsed.health_status == SprintHealthStatusEnum.ON_TRACK
        assert "In Progress" in " ".join(fallback_parsed.bottlenecks)
        assert "Alex Rivera" in " ".join(fallback_parsed.bottlenecks)


