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
    ActivityActionTypeEnum,
    AIAnalyticsReportSchema,
    AICriticalPathResponseSchema,
    AIDecomposeResponseSchema,
    AIParseAutomationResponseSchema,
    AIPermissionAuditResponseSchema,
    AIPermissionRiskLevelEnum,
    AISuggestCardEnrichmentResponseSchema,
    AISummaryNotificationRequestSchema,
    AISummaryNotificationResponseSchema,
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


# ============================================================================
# 5. SMART NOTIFICATION FORMATTER TESTS (POST /internal/v1/format-notification)
# ============================================================================


def test_format_notification_missing_token_returns_401_standard_error() -> None:
    """Verify POST /internal/v1/format-notification without X-Internal-Token returns 401 StandardErrorSchema."""
    res = client.post(
        "/internal/v1/format-notification",
        json={
            "board_title": "Kinetix Platform Launch",
            "recent_activities": [],
        },
    )
    assert res.status_code == 401
    validated = StandardErrorSchema.model_validate(res.json())
    assert validated.error.code.value == "UNAUTHORIZED"


def test_format_notification_invalid_token_returns_401_standard_error() -> None:
    """Verify POST /internal/v1/format-notification with invalid token returns 401 StandardErrorSchema."""
    res = client.post(
        "/internal/v1/format-notification",
        headers={"X-Internal-Token": "invalid_token_123"},
        json={
            "board_title": "Kinetix Platform Launch",
            "recent_activities": [],
        },
    )
    assert res.status_code == 401
    validated = StandardErrorSchema.model_validate(res.json())
    assert validated.error.code.value == "UNAUTHORIZED"


def test_format_notification_empty_activities_returns_200_ok() -> None:
    """Verify POST /internal/v1/format-notification with empty activities returns valid 200 OK."""
    res = client.post(
        "/internal/v1/format-notification",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json={
            "board_title": "Kinetix Platform Launch",
            "recent_activities": [],
        },
    )
    assert res.status_code == 200
    body = res.json()

    # Validate against canonical shared contract schema
    _canonical_contracts.AISummaryNotificationResponseSchema.model_validate(body)
    parsed = AISummaryNotificationResponseSchema.model_validate(body)

    assert "Kinetix Platform Launch" in parsed.summary_text
    assert "No recent activities" in parsed.summary_text

    # Slack Block Kit assertions
    assert "blocks" in parsed.slack_block_kit_payload
    blocks = parsed.slack_block_kit_payload["blocks"]
    assert len(blocks) >= 3
    assert blocks[0]["type"] == "header"
    assert "Kinetix Platform Launch" in blocks[0]["text"]["text"]
    assert blocks[1]["type"] == "section"
    assert blocks[-1]["type"] == "context"
    assert "Dispatched via" in blocks[-1]["elements"][0]["text"]

    # Discord Embed assertions
    assert "embeds" in parsed.discord_embed_payload
    embeds = parsed.discord_embed_payload["embeds"]
    assert len(embeds) == 1
    assert "Kinetix Platform Launch" in embeds[0]["title"]
    assert "footer" in embeds[0]
    assert embeds[0]["footer"]["text"] == "Kanbanify Webhook Dispatcher"


def test_format_notification_sample_activities_returns_200_ok() -> None:
    """
    Verify POST /internal/v1/format-notification with realistic Kanban activities:
    - cards created, moved, completed (moved to Done)
    - comments added
    - automations triggered
    Returns 200 OK matching AISummaryNotificationResponseSchema with rich Slack Block Kit
    and Discord Embed payloads.
    """
    activities_payload = [
        {
            "id": "act-01",
            "board_id": "11111111-1111-4111-8111-111111111111",
            "card_id": "44444444-4444-4444-8444-444444444441",
            "actor_name": "Alex Rivera",
            "action_type": ActivityActionTypeEnum.CARD_MOVED.value,
            "description": "Alex Rivera moved 'Implement OAuth2 PKCE flow' to 'In Progress'",
            "created_at": "2026-11-09T10:10:00.000Z",
            "details": {
                "card_title": "Implement OAuth2 PKCE flow",
                "target_column": "In Progress",
            },
        },
        {
            "id": "act-02",
            "board_id": "11111111-1111-4111-8111-111111111111",
            "card_id": "44444444-4444-4444-8444-444444444442",
            "actor_name": "Elena Rostova",
            "action_type": "CARD_CREATED",
            "description": "Elena Rostova created 'Setup Redis presence cache'",
            "created_at": "2026-11-09T10:11:00.000Z",
            "details": {
                "card_title": "Setup Redis presence cache",
            },
        },
        {
            "id": "act-03",
            "board_id": "11111111-1111-4111-8111-111111111111",
            "card_id": "44444444-4444-4444-8444-444444444443",
            "actor_name": "Elena Rostova",
            "action_type": "CARD_MOVED",
            "description": "Elena Rostova moved 'Fix WebSocket broadcast race condition' to 'Done'",
            "created_at": "2026-11-09T10:12:00.000Z",
            "details": {
                "card_title": "Fix WebSocket broadcast race condition",
                "target_column": "Done",
            },
        },
        {
            "id": "act-04",
            "board_id": "11111111-1111-4111-8111-111111111111",
            "card_id": "44444444-4444-4444-8444-444444444441",
            "actor_name": "Samir Patel",
            "action_type": "COMMENT_ADDED",
            "description": "Samir Patel commented on 'Implement OAuth2 PKCE flow'",
            "created_at": "2026-11-09T10:13:00.000Z",
            "details": {
                "card_title": "Implement OAuth2 PKCE flow",
            },
        },
        {
            "id": "act-05",
            "board_id": "11111111-1111-4111-8111-111111111111",
            "card_id": "44444444-4444-4444-8444-444444444443",
            "actor_name": "Kinetix Butler",
            "action_type": "AUTOMATION_TRIGGERED",
            "description": "🤖 Butler executed rule 'Auto-Complete & Tag Done Cards' on 'Fix WebSocket broadcast race condition'",
            "created_at": "2026-11-09T10:14:00.000Z",
            "is_automated": True,
            "details": {
                "rule_name": "Auto-Complete & Tag Done Cards",
                "card_title": "Fix WebSocket broadcast race condition",
            },
        },
    ]

    request_payload = {
        "board_title": "Platform Release Sprint",
        "recent_activities": activities_payload,
    }
    AISummaryNotificationRequestSchema.model_validate(request_payload)

    res = client.post(
        "/internal/v1/format-notification",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=request_payload,
    )
    assert res.status_code == 200
    body = res.json()

    # Validate against canonical shared contract schemas
    _canonical_contracts.AISummaryNotificationResponseSchema.model_validate(body)
    parsed = AISummaryNotificationResponseSchema.model_validate(body)

    # Summary Text assertions
    assert "Platform Release Sprint" in parsed.summary_text
    assert "2 cards moved" in parsed.summary_text
    assert "1 card created" in parsed.summary_text
    assert "1 card completed" in parsed.summary_text
    assert "1 automation executed" in parsed.summary_text
    assert "1 comment added" in parsed.summary_text

    # Slack Block Kit assertions
    assert "blocks" in parsed.slack_block_kit_payload
    slack_blocks = parsed.slack_block_kit_payload["blocks"]
    assert len(slack_blocks) >= 4

    # Header block
    assert slack_blocks[0]["type"] == "header"
    assert "Platform Release Sprint" in slack_blocks[0]["text"]["text"]

    # Markdown summary section
    assert slack_blocks[1]["type"] == "section"
    assert "Daily Digest" in slack_blocks[1]["text"]["text"]

    # Activity breakdown fields section
    fields_section = next(b for b in slack_blocks if "fields" in b)
    field_texts = [f["text"] for f in fields_section["fields"]]
    assert any("Cards Moved" in t for t in field_texts)
    assert any("Cards Created" in t for t in field_texts)
    assert any("Completed" in t for t in field_texts)
    assert any("Automations" in t for t in field_texts)

    # Context footer
    assert slack_blocks[-1]["type"] == "context"
    assert "Dispatched via Kanbanify Webhook Dispatcher" in slack_blocks[-1]["elements"][0]["text"]

    # Discord Embed assertions
    assert "embeds" in parsed.discord_embed_payload
    embeds = parsed.discord_embed_payload["embeds"]
    assert len(embeds) == 1
    embed = embeds[0]
    assert "Platform Release Sprint" in embed["title"]
    assert embed["color"] == 65280  # Completed cards triggers green accent
    assert embed["footer"]["text"] == "Kanbanify Webhook Dispatcher"
    assert "timestamp" in embed

    field_names = [f["name"] for f in embed["fields"]]
    assert "Activity Breakdown" in field_names
    assert "Card Moved" in field_names
    assert "Card Created" in field_names
    assert "Automation Triggered" in field_names


def test_format_notification_with_api_contract_sample() -> None:
    """Verify endpoint handles the exact sample format from docs/api-contract.md (with details and omitted description)."""
    contract_sample_payload = {
        "board_title": "Kinetix Platform Launch",
        "recent_activities": [
            {
                "id": "act-01",
                "board_id": "11111111-1111-4111-8111-111111111111",
                "card_id": "44444444-4444-4444-8444-444444444441",
                "actor_id": "88888888-8888-4888-8888-888888888881",
                "actor_name": "Alex Rivera",
                "action_type": "CARD_MOVED",
                "details": {
                    "card_title": "Implement OAuth2 PKCE flow",
                    "target_column": "Review",
                },
                "created_at": "2026-11-09T10:14:00.000Z",
            },
            {
                "id": "act-02",
                "board_id": "11111111-1111-4111-8111-111111111111",
                "card_id": "44444444-4444-4444-8444-444444444442",
                "actor_id": "88888888-8888-4888-8888-888888888882",
                "actor_name": "Samir Patel",
                "action_type": "AUTOMATION_TRIGGERED",
                "details": {
                    "rule_name": "Auto-Assign Reviewer on Done",
                    "card_title": "Implement Webhook Dispatcher",
                },
                "created_at": "2026-11-09T10:15:00.000Z",
            },
        ],
    }

    res = client.post(
        "/internal/v1/format-notification",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=contract_sample_payload,
    )
    assert res.status_code == 200
    body = res.json()
    _canonical_contracts.AISummaryNotificationResponseSchema.model_validate(body)
    parsed = AISummaryNotificationResponseSchema.model_validate(body)

    assert "Kinetix Platform Launch" in parsed.summary_text
    assert "1 card moved" in parsed.summary_text
    assert "1 automation executed" in parsed.summary_text
    assert "blocks" in parsed.slack_block_kit_payload
    assert "embeds" in parsed.discord_embed_payload


def test_format_notification_live_llm_orchestration_and_fallback() -> None:
    """Verify live LLM orchestration in JSON mode and graceful fallback when upstream LLM fails."""
    mock_llm_output = {
        "summary_text": "🚀 Kanbanify Daily Digest for Kinetix Platform Launch: 1 card moved to Review, 1 Butler rule executed.",
        "slack_block_kit_payload": {
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "📋 Custom LLM Header",
                        "emoji": True,
                    },
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "Custom LLM Summary",
                    },
                },
            ]
        },
        "discord_embed_payload": {
            "username": "Kinetix Bot",
            "embeds": [
                {
                    "title": "Custom LLM Discord Embed",
                    "description": "LLM Generated Activity",
                    "color": 65280,
                    "fields": [],
                }
            ],
        },
    }

    mock_response = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": json.dumps(mock_llm_output),
                    }
                }
            ]
        },
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )

    request_payload = {
        "board_title": "Kinetix Platform Launch",
        "recent_activities": [
            {
                "id": "act-01",
                "board_id": "11111111-1111-4111-8111-111111111111",
                "actor_name": "Alex Rivera",
                "action_type": "CARD_MOVED",
                "description": "Alex Rivera moved 'Implement OAuth2 PKCE flow' to 'Review'",
                "created_at": "2026-11-09T10:14:00.000Z",
            }
        ],
    }

    # Test live LLM orchestration path
    with patch("app.notification_formatter.get_settings") as mock_settings:
        from app.config import Settings
        mock_settings.return_value = Settings(
            llm_api_key="sk-real-valid-api-key-for-testing",
        )
        with patch.object(
            httpx.AsyncClient,
            "post",
            new=AsyncMock(return_value=mock_response),
        ):
            res = client.post(
                "/internal/v1/format-notification",
                headers={"X-Internal-Token": DEFAULT_TOKEN},
                json=request_payload,
            )
            assert res.status_code == 200
            body = res.json()
            assert body["summary_text"] == mock_llm_output["summary_text"]
            assert body["slack_block_kit_payload"]["blocks"][0]["text"]["text"] == "📋 Custom LLM Header"

        # Test fallback on network / upstream LLM error
        with patch.object(
            httpx.AsyncClient,
            "post",
            new=AsyncMock(side_effect=httpx.ConnectError("OpenAI API unreachable")),
        ):
            fallback_res = client.post(
                "/internal/v1/format-notification",
                headers={"X-Internal-Token": DEFAULT_TOKEN},
                json=request_payload,
            )
            assert fallback_res.status_code == 200
            fallback_body = fallback_res.json()
            assert "🚀 Kanbanify Daily Digest for Kinetix Platform Launch" in fallback_body["summary_text"]
            assert "1 card moved" in fallback_body["summary_text"]


# ============================================================================
# 6. PERMISSION & ACCESS AUDITOR TESTS (`POST /internal/v1/audit-permissions`)
# ============================================================================


def test_audit_permissions_missing_token_returns_401_standard_error() -> None:
    """Verify POST /internal/v1/audit-permissions without X-Internal-Token returns 401 StandardErrorSchema."""
    response = client.post(
        "/internal/v1/audit-permissions",
        json={
            "board_title": "Platform Security Review",
            "visibility": "WORKSPACE",
            "members": [],
            "invite_links": [],
        },
    )
    assert response.status_code == 401
    body = response.json()
    validated_err = StandardErrorSchema.model_validate(body)
    assert validated_err.error.code.value == "UNAUTHORIZED"
    assert "token" in validated_err.error.message.lower()


def test_audit_permissions_invalid_token_returns_401_standard_error() -> None:
    """Verify POST /internal/v1/audit-permissions with invalid X-Internal-Token returns 401."""
    response = client.post(
        "/internal/v1/audit-permissions",
        headers={"X-Internal-Token": "invalid_wrong_token_123"},
        json={
            "board_title": "Platform Security Review",
            "visibility": "WORKSPACE",
            "members": [],
            "invite_links": [],
        },
    )
    assert response.status_code == 401
    body = response.json()
    validated_err = StandardErrorSchema.model_validate(body)
    assert validated_err.error.code.value == "UNAUTHORIZED"


def test_audit_permissions_empty_board_title_returns_400_validation_error() -> None:
    """Verify POST /internal/v1/audit-permissions with empty board_title returns 400 validation error."""
    response = client.post(
        "/internal/v1/audit-permissions",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json={
            "board_title": "",
            "visibility": "WORKSPACE",
            "members": [],
            "invite_links": [],
        },
    )
    assert response.status_code == 400
    body = response.json()
    validated_err = StandardErrorSchema.model_validate(body)
    assert validated_err.error.code.value == "VALIDATION_ERROR"


def test_audit_permissions_healthy_least_privilege_returns_200_low_risk() -> None:
    """Verify healthy role distribution and bounded invite links return 200 OK with LOW risk (>= 80)."""
    payload = {
        "board_title": "Core Engine Infrastructure",
        "visibility": "WORKSPACE",
        "members": [
            {
                "id": "mem-01",
                "name": "Alex Rivera",
                "email": "alex@kinetix.dev",
                "avatar_url": None,
                "initials": "AR",
                "color": "#3b82f6",
                "role": "ADMIN",
                "joined_at": "2026-11-01T00:00:00.000Z",
            },
            {
                "id": "mem-02",
                "name": "Sarah Chen",
                "email": "sarah@kinetix.dev",
                "avatar_url": None,
                "initials": "SC",
                "color": "#10b981",
                "role": "EDITOR",
                "joined_at": "2026-11-02T00:00:00.000Z",
            },
            {
                "id": "mem-03",
                "name": "Marcus Vance",
                "email": "marcus@kinetix.dev",
                "avatar_url": None,
                "initials": "MV",
                "color": "#f59e0b",
                "role": "EDITOR",
                "joined_at": "2026-11-03T00:00:00.000Z",
            },
            {
                "id": "mem-04",
                "name": "Elena Rostova",
                "email": "elena@kinetix.dev",
                "avatar_url": None,
                "initials": "ER",
                "color": "#8b5cf6",
                "role": "VIEWER",
                "joined_at": "2026-11-04T00:00:00.000Z",
            },
        ],
        "invite_links": [
            {
                "id": "inv-01",
                "board_id": "board-uuid-1",
                "token": "tok_ed_bounded",
                "role": "EDITOR",
                "created_by_id": "mem-01",
                "created_by_name": "Alex Rivera",
                "max_uses": 5,
                "uses_count": 1,
                "expires_at": "2026-12-01T00:00:00.000Z",
                "is_active": True,
                "created_at": "2026-11-10T00:00:00.000Z",
            }
        ],
    }

    response = client.post(
        "/internal/v1/audit-permissions",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()

    # Validate against local and canonical contracts
    validated = AIPermissionAuditResponseSchema.model_validate(data)
    canonical = _canonical_contracts.AIPermissionAuditResponseSchema.model_validate(data)
    assert validated.security_score >= 80.0
    assert validated.risk_level == AIPermissionRiskLevelEnum.LOW
    assert canonical.risk_level.value == "LOW"
    assert len(validated.summary) > 0
    assert len(validated.recommendations) >= 1


def test_audit_permissions_excessive_admin_sprawl_violation() -> None:
    """Verify > 50% ADMIN role distribution triggers deduction and least-privilege finding."""
    payload = {
        "board_title": "Admin Heavy Workspace",
        "visibility": "WORKSPACE",
        "members": [
            {
                "id": "mem-01",
                "name": "Alice Admin",
                "email": "alice@kinetix.dev",
                "avatar_url": None,
                "initials": "AA",
                "color": "#3b82f6",
                "role": "ADMIN",
            },
            {
                "id": "mem-02",
                "name": "Bob Admin",
                "email": "bob@kinetix.dev",
                "avatar_url": None,
                "initials": "BA",
                "color": "#ef4444",
                "role": "ADMIN",
            },
            {
                "id": "mem-03",
                "name": "Charlie Editor",
                "email": "charlie@kinetix.dev",
                "avatar_url": None,
                "initials": "CE",
                "color": "#10b981",
                "role": "EDITOR",
            },
        ],
        "invite_links": [],
    }

    response = client.post(
        "/internal/v1/audit-permissions",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    validated = AIPermissionAuditResponseSchema.model_validate(data)

    # 2 out of 3 = 67% admins > 50%
    assert validated.security_score < 100.0
    assert any("ADMIN" in f and "least-privilege" in f.lower() for f in validated.findings)
    assert any("downgrade" in r.lower() for r in validated.recommendations)


def test_audit_permissions_unbounded_invite_link_violation() -> None:
    """Verify active invite link with expires_at == null AND max_uses == null flags unbounded risk."""
    payload = {
        "board_title": "Unbounded Link Board",
        "visibility": "WORKSPACE",
        "members": [
            {
                "id": "mem-01",
                "name": "Solo Owner",
                "email": "owner@kinetix.dev",
                "avatar_url": None,
                "initials": "SO",
                "color": "#3b82f6",
                "role": "ADMIN",
            }
        ],
        "invite_links": [
            {
                "id": "inv-unbounded-editor",
                "board_id": "board-uuid-1",
                "token": "kb_inv_unbounded_editor",
                "role": "EDITOR",
                "created_by_id": "mem-01",
                "created_by_name": "Solo Owner",
                "max_uses": None,
                "uses_count": 0,
                "expires_at": None,
                "is_active": True,
                "created_at": "2026-11-10T00:00:00.000Z",
            }
        ],
    }

    response = client.post(
        "/internal/v1/audit-permissions",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    validated = AIPermissionAuditResponseSchema.model_validate(data)

    # Unbounded invite link deduction
    assert validated.security_score < 100.0
    assert any("unbounded" in f.lower() or "unlimited expiration" in f.lower() for f in validated.findings)
    assert any("expiration" in r.lower() or "max_uses" in r.lower() for r in validated.recommendations)


def test_audit_permissions_public_read_with_sensitive_invite_links() -> None:
    """Verify visibility === 'PUBLIC_READ' with active sensitive invite links triggers deduction."""
    payload = {
        "board_title": "Open Source Public Board",
        "visibility": "PUBLIC_READ",
        "members": [
            {
                "id": "mem-01",
                "name": "Alex Rivera",
                "email": "alex@kinetix.dev",
                "avatar_url": None,
                "initials": "AR",
                "color": "#3b82f6",
                "role": "ADMIN",
            }
        ],
        "invite_links": [
            {
                "id": "inv-editor-pub",
                "board_id": "board-uuid-1",
                "token": "kb_inv_pub_editor",
                "role": "EDITOR",
                "created_by_id": "mem-01",
                "created_by_name": "Alex Rivera",
                "max_uses": 20,
                "uses_count": 2,
                "expires_at": "2026-11-20T00:00:00.000Z",
                "is_active": True,
                "created_at": "2026-11-10T00:00:00.000Z",
            }
        ],
    }

    response = client.post(
        "/internal/v1/audit-permissions",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    validated = AIPermissionAuditResponseSchema.model_validate(data)

    # Deducts 20 points for PUBLIC_READ with active sensitive link
    assert validated.security_score <= 80.0
    assert any("PUBLIC_READ" in f and "privileged" in f for f in validated.findings)
    assert any("PUBLIC_READ" in r or "revoke" in r.lower() for r in validated.recommendations)


def test_audit_permissions_compound_high_risk_scenario() -> None:
    """Verify compound violations result in HIGH risk (< 50) and critical recommendations."""
    payload = {
        "board_title": "Severely Vulnerable Project",
        "visibility": "PUBLIC_READ",
        "members": [
            {
                "id": "mem-01",
                "name": "Admin 1",
                "email": "a1@kinetix.dev",
                "avatar_url": None,
                "initials": "A1",
                "color": "#3b82f6",
                "role": "ADMIN",
            },
            {
                "id": "mem-02",
                "name": "Admin 2",
                "email": "a2@kinetix.dev",
                "avatar_url": None,
                "initials": "A2",
                "color": "#ef4444",
                "role": "ADMIN",
            },
        ],
        "invite_links": [
            {
                "id": "inv-admin-unbounded",
                "board_id": "board-uuid-1",
                "token": "kb_inv_root_admin",
                "role": "ADMIN",
                "created_by_id": "mem-01",
                "created_by_name": "Admin 1",
                "max_uses": None,
                "uses_count": 0,
                "expires_at": None,
                "is_active": True,
                "created_at": "2026-11-10T00:00:00.000Z",
            },
            {
                "id": "inv-editor-unbounded",
                "board_id": "board-uuid-1",
                "token": "kb_inv_editor_wildcard",
                "role": "EDITOR",
                "created_by_id": "mem-01",
                "created_by_name": "Admin 1",
                "max_uses": None,
                "uses_count": 0,
                "expires_at": None,
                "is_active": True,
                "created_at": "2026-11-10T00:00:00.000Z",
            },
        ],
    }

    response = client.post(
        "/internal/v1/audit-permissions",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    validated = AIPermissionAuditResponseSchema.model_validate(data)

    # 100 - 25 (100% admins) - 25 (unbounded admin link) - 15 (unbounded editor link) - 20 (public read with sensitive links) = 15
    assert validated.security_score < 50.0
    assert validated.risk_level == AIPermissionRiskLevelEnum.HIGH
    assert len(validated.findings) >= 3
    assert len(validated.recommendations) >= 2


def test_audit_permissions_docs_contract_sample() -> None:
    """Verify docs/api-contract.md 8.4 exact sample matches specification."""
    payload = {
        "board_title": "Kinetix Platform Launch",
        "visibility": "WORKSPACE",
        "members": [
            {
                "id": "88888888-8888-4888-8888-888888888881",
                "name": "Alex Rivera",
                "email": "alex@kinetix.dev",
                "avatar_url": None,
                "initials": "AR",
                "color": "#3b82f6",
                "role": "ADMIN",
                "joined_at": "2026-11-08T00:00:00.000Z",
            }
        ],
        "invite_links": [
            {
                "id": "inv-001",
                "board_id": "11111111-1111-4111-8111-111111111111",
                "token": "kb_inv_8f92a1bc3d4e",
                "role": "EDITOR",
                "created_by_id": "88888888-8888-4888-8888-888888888881",
                "created_by_name": "Alex Rivera",
                "max_uses": 10,
                "uses_count": 3,
                "expires_at": None,
                "is_active": True,
                "created_at": "2026-11-10T10:00:00.000Z",
            }
        ],
    }

    response = client.post(
        "/internal/v1/audit-permissions",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    validated = _canonical_contracts.AIPermissionAuditResponseSchema.model_validate(data)
    assert validated.security_score >= 0.0 and validated.security_score <= 100.0
    assert validated.risk_level in (_canonical_contracts.AIPermissionRiskLevelEnum.LOW, _canonical_contracts.AIPermissionRiskLevelEnum.MEDIUM)


def test_audit_permissions_live_llm_mode_and_error_fallback() -> None:
    """Verify live LLM orchestration path and fallback on network/upstream LLM error."""
    mock_llm_output = {
        "security_score": 75.0,
        "risk_level": "MEDIUM",
        "summary": "LLM Access Audit: Board has moderate permission risks.",
        "findings": [
            "Invite link grants EDITOR role without expiration timestamp.",
        ],
        "recommendations": [
            "Configure a 14-day expiration timestamp on active invite links.",
        ],
    }

    mock_response = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": json.dumps(mock_llm_output),
                    }
                }
            ]
        },
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )

    request_payload = {
        "board_title": "Production Deployment Board",
        "visibility": "WORKSPACE",
        "members": [
            {
                "id": "mem-01",
                "name": "Dev Lead",
                "email": "lead@kinetix.dev",
                "avatar_url": None,
                "initials": "DL",
                "color": "#3b82f6",
                "role": "ADMIN",
            }
        ],
        "invite_links": [
            {
                "id": "inv-01",
                "board_id": "b-1",
                "token": "kb_inv_mock",
                "role": "EDITOR",
                "created_by_id": "mem-01",
                "created_by_name": "Dev Lead",
                "max_uses": 5,
                "uses_count": 1,
                "expires_at": None,
                "is_active": True,
                "created_at": "2026-11-10T00:00:00.000Z",
            }
        ],
    }

    # 1. Test live LLM orchestration path
    with patch("app.permission_auditor.get_settings") as mock_settings:
        from app.config import Settings
        mock_settings.return_value = Settings(
            llm_api_key="sk-real-valid-api-key-for-testing",
        )
        with patch.object(
            httpx.AsyncClient,
            "post",
            new=AsyncMock(return_value=mock_response),
        ):
            res = client.post(
                "/internal/v1/audit-permissions",
                headers={"X-Internal-Token": DEFAULT_TOKEN},
                json=request_payload,
            )
            assert res.status_code == 200
            body = res.json()
            assert body["security_score"] == 75.0
            assert body["risk_level"] == "MEDIUM"
            assert body["summary"] == mock_llm_output["summary"]
            assert body["findings"] == mock_llm_output["findings"]

        # 2. Test fallback on network / upstream LLM error
        with patch.object(
            httpx.AsyncClient,
            "post",
            new=AsyncMock(side_effect=httpx.ConnectError("OpenAI unreachable")),
        ):
            fallback_res = client.post(
                "/internal/v1/audit-permissions",
                headers={"X-Internal-Token": DEFAULT_TOKEN},
                json=request_payload,
            )
            assert fallback_res.status_code == 200
            fallback_body = fallback_res.json()
            assert fallback_body["security_score"] == 90.0  # 100 - 10 for max_uses with no expires_at
            assert fallback_body["risk_level"] == "LOW"
            assert "Production Deployment Board" in fallback_body["summary"]


# ============================================================================
# PHASE 7 TESTS: VISUAL DEPENDENCY GRAPH & AI CRITICAL PATH ANALYZER
# ============================================================================


def test_analyze_dependencies_missing_token_returns_401_standard_error() -> None:
    """Verify POST /internal/v1/analyze-dependencies without X-Internal-Token returns 401 StandardErrorSchema."""
    payload = {
        "board_title": "Kanbanify Launch Board",
        "graph": {
            "board_id": "11111111-1111-4111-8111-111111111111",
            "nodes": [],
            "edges": [],
            "critical_path_card_ids": [],
            "total_blocked_cards": 0,
            "has_circular_dependency": False,
        },
    }
    response = client.post("/internal/v1/analyze-dependencies", json=payload)
    assert response.status_code == 401
    envelope = StandardErrorSchema.model_validate(response.json())
    assert envelope.error.code == "UNAUTHORIZED"
    assert envelope.error.message == "Missing or invalid X-Internal-Token header."


def test_analyze_dependencies_invalid_token_returns_401_standard_error() -> None:
    """Verify POST /internal/v1/analyze-dependencies with invalid X-Internal-Token returns 401 StandardErrorSchema."""
    payload = {
        "board_title": "Kanbanify Launch Board",
        "graph": {
            "board_id": "11111111-1111-4111-8111-111111111111",
            "nodes": [],
            "edges": [],
            "critical_path_card_ids": [],
            "total_blocked_cards": 0,
            "has_circular_dependency": False,
        },
    }
    response = client.post(
        "/internal/v1/analyze-dependencies",
        headers={"X-Internal-Token": "invalid_sync_token"},
        json=payload,
    )
    assert response.status_code == 401
    envelope = StandardErrorSchema.model_validate(response.json())
    assert envelope.error.code == "UNAUTHORIZED"


def test_analyze_dependencies_empty_board_title_returns_400_validation_error() -> None:
    """Verify POST /internal/v1/analyze-dependencies with empty board_title returns 400 validation error."""
    payload = {
        "board_title": "",
        "graph": {
            "board_id": "11111111-1111-4111-8111-111111111111",
            "nodes": [],
            "edges": [],
            "critical_path_card_ids": [],
            "total_blocked_cards": 0,
            "has_circular_dependency": False,
        },
    }
    response = client.post(
        "/internal/v1/analyze-dependencies",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert response.status_code == 400
    envelope = StandardErrorSchema.model_validate(response.json())
    assert envelope.error.code == "VALIDATION_ERROR"


def test_analyze_dependencies_api_contract_single_card_example() -> None:
    """
    Verify POST /internal/v1/analyze-dependencies with the exact contract sample from docs/api-contract.md:
    1 card on critical path, 0 active blockers, returns 200 OK matching AICriticalPathResponse 100%.
    """
    payload = {
        "board_title": "Kanbanify Launch Board",
        "graph": {
            "board_id": "11111111-1111-4111-8111-111111111111",
            "nodes": [
                {
                    "card_id": "44444444-4444-4444-8444-444444444441",
                    "title": "Implement OAuth2 PKCE flow",
                    "column_id": "33333333-3333-4333-8333-333333333331",
                    "column_title": "Backlog",
                    "priority": "HIGH",
                    "story_points": 5,
                    "is_completed": False,
                    "assignee_initials": ["AR"],
                    "in_degree": 0,
                    "out_degree": 1,
                    "is_on_critical_path": True,
                }
            ],
            "edges": [],
            "critical_path_card_ids": ["44444444-4444-4444-8444-444444444441"],
            "total_blocked_cards": 0,
            "has_circular_dependency": False,
        },
    }

    response = client.post(
        "/internal/v1/analyze-dependencies",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()

    # Validate against local contract schema
    local_val = AICriticalPathResponseSchema.model_validate(data)
    # Validate against root canonical schemas.py 100%
    canonical_val = _canonical_contracts.AICriticalPathResponseSchema.model_validate(data)

    assert local_val.critical_path_titles == ["Implement OAuth2 PKCE flow"]
    assert canonical_val.critical_path_titles == ["Implement OAuth2 PKCE flow"]
    assert local_val.top_blocker_cards == []
    assert 3 <= len(local_val.unblocking_recommendations) <= 5
    assert "critical path" in local_val.risk_summary.lower()
    assert "5 story points" in local_val.risk_summary


def test_analyze_dependencies_complex_dependency_graph_with_top_blockers() -> None:
    """
    Verify POST /internal/v1/analyze-dependencies with multi-node graph from docs/api-contract.md (lines 2092-2113):
    Blocker card sits on critical path, blocking 3 downstream tasks.
    """
    payload = {
        "board_title": "Kinetix Core Platform",
        "graph": {
            "board_id": "11111111-1111-4111-8111-111111111111",
            "nodes": [
                {
                    "card_id": "44444444-4444-4444-8444-444444444441",
                    "title": "Implement OAuth2 PKCE flow",
                    "column_id": "33333333-3333-4333-8333-333333333331",
                    "column_title": "In Progress",
                    "priority": "HIGH",
                    "story_points": 8,
                    "is_completed": False,
                    "assignee_initials": ["AR"],
                    "in_degree": 0,
                    "out_degree": 3,
                    "is_on_critical_path": True,
                },
                {
                    "card_id": "44444444-4444-4444-8444-444444444442",
                    "title": "Implement Webhook Dispatcher",
                    "column_id": "33333333-3333-4333-8333-333333333331",
                    "column_title": "Backlog",
                    "priority": "HIGH",
                    "story_points": 5,
                    "is_completed": False,
                    "assignee_initials": ["BC"],
                    "in_degree": 1,
                    "out_degree": 1,
                    "is_on_critical_path": True,
                },
                {
                    "card_id": "44444444-4444-4444-8444-444444444443",
                    "title": "Deploy Release 1.0",
                    "column_id": "33333333-3333-4333-8333-333333333332",
                    "column_title": "Backlog",
                    "priority": "URGENT",
                    "story_points": 3,
                    "is_completed": False,
                    "assignee_initials": ["AR"],
                    "in_degree": 1,
                    "out_degree": 0,
                    "is_on_critical_path": True,
                },
                {
                    "card_id": "44444444-4444-4444-8444-444444444444",
                    "title": "Setup Prometheus Monitoring",
                    "column_id": "33333333-3333-4333-8333-333333333332",
                    "column_title": "Backlog",
                    "priority": "MEDIUM",
                    "story_points": 2,
                    "is_completed": False,
                    "assignee_initials": ["DL"],
                    "in_degree": 1,
                    "out_degree": 0,
                    "is_on_critical_path": False,
                },
            ],
            "edges": [
                {
                    "from_card_id": "44444444-4444-4444-8444-444444444441",
                    "to_card_id": "44444444-4444-4444-8444-444444444442",
                    "is_resolved": False,
                    "is_critical": True,
                },
                {
                    "from_card_id": "44444444-4444-4444-8444-444444444442",
                    "to_card_id": "44444444-4444-4444-8444-444444444443",
                    "is_resolved": False,
                    "is_critical": True,
                },
                {
                    "from_card_id": "44444444-4444-4444-8444-444444444441",
                    "to_card_id": "44444444-4444-4444-8444-444444444444",
                    "is_resolved": False,
                    "is_critical": False,
                },
            ],
            "critical_path_card_ids": [
                "44444444-4444-4444-8444-444444444441",
                "44444444-4444-4444-8444-444444444442",
                "44444444-4444-4444-8444-444444444443",
            ],
            "total_blocked_cards": 3,
            "has_circular_dependency": False,
        },
    }

    response = client.post(
        "/internal/v1/analyze-dependencies",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    validated = _canonical_contracts.AICriticalPathResponseSchema.model_validate(data)

    # 1. Critical path titles
    assert validated.critical_path_titles == [
        "Implement OAuth2 PKCE flow",
        "Implement Webhook Dispatcher",
        "Deploy Release 1.0",
    ]

    # 2. Top blocker cards
    assert len(validated.top_blocker_cards) >= 1
    top_blocker = validated.top_blocker_cards[0]
    assert top_blocker.card_id == "44444444-4444-4444-8444-444444444441"
    assert top_blocker.title == "Implement OAuth2 PKCE flow"
    assert top_blocker.blocks_count == 3
    assert "critical path" in top_blocker.reason.lower()

    # 3. Risk summary highlights
    assert "3 cards sit on the critical path" in validated.risk_summary
    assert "16 story points" in validated.risk_summary  # 8 + 5 + 3
    assert "3 total downstream tasks" in validated.risk_summary
    assert "Delayed release risk: High" in validated.risk_summary

    # 4. Actionable unblocking recommendations
    assert 3 <= len(validated.unblocking_recommendations) <= 5
    assert any("Prioritize 'Implement OAuth2 PKCE flow'" in rec for rec in validated.unblocking_recommendations)
    assert any("Split high-story-point critical path card" in rec for rec in validated.unblocking_recommendations)


def test_analyze_dependencies_circular_dependency_deadlock() -> None:
    """Verify circular dependency deadlock produces critical warning and resolution recommendation."""
    payload = {
        "board_title": "Deadlock Board",
        "graph": {
            "board_id": "11111111-1111-4111-8111-111111111111",
            "nodes": [
                {
                    "card_id": "c-1",
                    "title": "Task Alpha",
                    "column_id": "col-1",
                    "column_title": "Backlog",
                    "priority": "HIGH",
                    "story_points": 3,
                    "is_completed": False,
                    "assignee_initials": ["A"],
                    "in_degree": 1,
                    "out_degree": 1,
                    "is_on_critical_path": True,
                },
                {
                    "card_id": "c-2",
                    "title": "Task Beta",
                    "column_id": "col-1",
                    "column_title": "Backlog",
                    "priority": "HIGH",
                    "story_points": 5,
                    "is_completed": False,
                    "assignee_initials": ["B"],
                    "in_degree": 1,
                    "out_degree": 1,
                    "is_on_critical_path": True,
                },
            ],
            "edges": [
                {"from_card_id": "c-1", "to_card_id": "c-2", "is_resolved": False, "is_critical": True},
                {"from_card_id": "c-2", "to_card_id": "c-1", "is_resolved": False, "is_critical": True},
            ],
            "critical_path_card_ids": ["c-1", "c-2"],
            "total_blocked_cards": 2,
            "has_circular_dependency": True,
        },
    }

    response = client.post(
        "/internal/v1/analyze-dependencies",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    validated = _canonical_contracts.AICriticalPathResponseSchema.model_validate(data)

    assert "CRITICAL: Circular dependency cycle detected" in validated.risk_summary
    assert any("circular dependency" in rec.lower() for rec in validated.unblocking_recommendations)
    assert 3 <= len(validated.unblocking_recommendations) <= 5


def test_analyze_dependencies_unassigned_and_blocked_critical_cards_recommendations() -> None:
    """Verify unassigned cards and blocked critical path cards generate targeted recommendations."""
    payload = {
        "board_title": "Unassigned & Blocked Board",
        "graph": {
            "board_id": "11111111-1111-4111-8111-111111111111",
            "nodes": [
                {
                    "card_id": "c-orphan",
                    "title": "Orphan Critical Task",
                    "column_id": "col-1",
                    "column_title": "To Do",
                    "priority": "HIGH",
                    "story_points": 3,
                    "is_completed": False,
                    "assignee_initials": [],
                    "in_degree": 1,
                    "out_degree": 0,
                    "is_on_critical_path": True,
                },
                {
                    "card_id": "c-root",
                    "title": "Root Blocker Task",
                    "column_id": "col-1",
                    "column_title": "To Do",
                    "priority": "HIGH",
                    "story_points": 2,
                    "is_completed": False,
                    "assignee_initials": ["JD"],
                    "in_degree": 0,
                    "out_degree": 1,
                    "is_on_critical_path": True,
                },
            ],
            "edges": [
                {"from_card_id": "c-root", "to_card_id": "c-orphan", "is_resolved": False, "is_critical": True},
            ],
            "critical_path_card_ids": ["c-root", "c-orphan"],
            "total_blocked_cards": 1,
            "has_circular_dependency": False,
        },
    }

    response = client.post(
        "/internal/v1/analyze-dependencies",
        headers={"X-Internal-Token": DEFAULT_TOKEN},
        json=payload,
    )
    assert response.status_code == 200
    validated = AICriticalPathResponseSchema.model_validate(response.json())

    # Check unassigned owner recommendation
    assert any("dedicated owner to critical path card 'Orphan Critical Task'" in rec for rec in validated.unblocking_recommendations)
    # Check blocked critical path swarming recommendation
    assert any("Swarm team efforts to clear prerequisite blockers for 'Orphan Critical Task'" in rec for rec in validated.unblocking_recommendations)


def test_analyze_dependencies_live_llm_mode_and_error_fallback() -> None:
    """Verify live LLM orchestration path and graceful fallback on network / upstream error."""
    mock_llm_output = {
        "risk_summary": "LLM Analysis: Critical path has 1 card with high bottleneck potential.",
        "critical_path_titles": [
            "Implement OAuth2 PKCE flow",
        ],
        "top_blocker_cards": [
            {
                "card_id": "44444444-4444-4444-8444-444444444441",
                "title": "Implement OAuth2 PKCE flow",
                "blocks_count": 3,
                "reason": "Blocks downstream authentication and webhook integrations.",
            }
        ],
        "unblocking_recommendations": [
            "Pair program on OAuth2 PKCE flow to expedite code review.",
            "Decouple Webhook Dispatcher from PKCE dependency if secret tokens can be mocked.",
            "Establish automated integration tests for authentication middleware.",
        ],
    }

    mock_response = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": json.dumps(mock_llm_output),
                    }
                }
            ]
        },
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )

    payload = {
        "board_title": "Production Board",
        "graph": {
            "board_id": "11111111-1111-4111-8111-111111111111",
            "nodes": [
                {
                    "card_id": "44444444-4444-4444-8444-444444444441",
                    "title": "Implement OAuth2 PKCE flow",
                    "column_id": "col-1",
                    "column_title": "Backlog",
                    "priority": "HIGH",
                    "story_points": 5,
                    "is_completed": False,
                    "assignee_initials": ["AR"],
                    "in_degree": 0,
                    "out_degree": 3,
                    "is_on_critical_path": True,
                }
            ],
            "edges": [],
            "critical_path_card_ids": ["44444444-4444-4444-8444-444444444441"],
            "total_blocked_cards": 3,
            "has_circular_dependency": False,
        },
    }

    # 1. Test live LLM orchestration path
    with patch("app.critical_path_analyzer.get_settings") as mock_settings:
        from app.config import Settings
        mock_settings.return_value = Settings(
            llm_api_key="sk-real-valid-api-key-for-testing",
        )
        with patch.object(
            httpx.AsyncClient,
            "post",
            new=AsyncMock(return_value=mock_response),
        ):
            res = client.post(
                "/internal/v1/analyze-dependencies",
                headers={"X-Internal-Token": DEFAULT_TOKEN},
                json=payload,
            )
            assert res.status_code == 200
            body = res.json()
            assert body["risk_summary"] == mock_llm_output["risk_summary"]
            assert body["critical_path_titles"] == mock_llm_output["critical_path_titles"]
            assert len(body["top_blocker_cards"]) == 1
            assert body["top_blocker_cards"][0]["blocks_count"] == 3
            assert body["unblocking_recommendations"] == mock_llm_output["unblocking_recommendations"]

        # 2. Test fallback on network / upstream LLM error
        with patch.object(
            httpx.AsyncClient,
            "post",
            new=AsyncMock(side_effect=httpx.ConnectError("OpenAI unreachable")),
        ):
            fallback_res = client.post(
                "/internal/v1/analyze-dependencies",
                headers={"X-Internal-Token": DEFAULT_TOKEN},
                json=payload,
            )
            assert fallback_res.status_code == 200
            fallback_body = fallback_res.json()
            assert "1 card sits on the critical path" in fallback_body["risk_summary"]
            assert fallback_body["critical_path_titles"] == ["Implement OAuth2 PKCE flow"]
            assert 3 <= len(fallback_body["unblocking_recommendations"]) <= 5





