"""
Smart Task Decomposer & Risk Analyzer (`POST /internal/v1/decompose-task`).
Implements Dual-Mode Intelligence:
1. Live LLM Orchestration via OpenAI-compatible JSON mode (`httpx`) when a valid `LLM_API_KEY` is configured.
2. Deterministic Domain-Aware Heuristic Fallback Engine (Zero-Config Ready) when `LLM_API_KEY` is missing,
   a placeholder, or the upstream LLM request fails.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

import httpx

from app.config import Settings, get_settings
from app.contracts import (
    AIDecomposeRequestSchema,
    AIDecomposeResponseSchema,
    PriorityEnum,
    SuggestedSubtaskSchema,
)

logger = logging.getLogger("kinetix.ai_engine.decomposer")

FIBONACCI_POINTS: tuple[int, ...] = (1, 2, 3, 5, 8)
BASE62_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"


def fractional_position(index: int) -> str:
    """
    Generate lexicographical fractional index keys ("a0", "a1", "a2", "a3", "a4", ...).
    Guarantees strict ASCII lexicographical ordering (`"a0" < "a1" < "a2"`).
    """
    if index < 0:
        raise ValueError("index must be non-negative")
    if index < len(BASE62_DIGITS):
        return f"a{BASE62_DIGITS[index]}"
    high = (index // len(BASE62_DIGITS)) - 1
    low = index % len(BASE62_DIGITS)
    return f"b{BASE62_DIGITS[high % len(BASE62_DIGITS)]}{BASE62_DIGITS[low]}"


def snap_to_fibonacci(value: float) -> int:
    """Snap any numeric estimate to the nearest Fibonacci story point in (1, 2, 3, 5, 8)."""
    return min(FIBONACCI_POINTS, key=lambda fib: (abs(fib - value), fib))


@dataclass(frozen=True)
class DomainProfile:
    """Domain-specific engineering heuristic template."""

    name: str
    keywords: tuple[str, ...]
    base_points: int
    default_priority: PriorityEnum
    subtasks: tuple[str, ...]
    risks: tuple[str, ...]


DOMAIN_PROFILES: tuple[DomainProfile, ...] = (
    DomainProfile(
        name="auth",
        keywords=(
            "auth",
            "authentication",
            "authorization",
            "oauth",
            "oauth2",
            "pkce",
            "jwt",
            "token",
            "session",
            "login",
            "sso",
            "rbac",
            "permission",
            "password",
            "security",
            "credential",
        ),
        base_points=5,
        default_priority=PriorityEnum.HIGH,
        subtasks=(
            "Register authentication provider credentials, scopes, and allowed redirect URIs",
            "Implement token verification, PKCE challenge/verifier, and cryptographic validation",
            "Create session callback endpoint with secure rotation and cookie/header policies",
            "Add role/permission guard middleware and integration tests for unauthorized edge cases",
        ),
        risks=(
            "Callback URL or CORS origin mismatch across local, staging, and production environments",
            "Token replay or clock-skew expiration edge cases during refresh rotation",
            "Provider rate limits during high-concurrency token introspection",
        ),
    ),
    DomainProfile(
        name="payment",
        keywords=(
            "payment",
            "stripe",
            "billing",
            "checkout",
            "invoice",
            "subscription",
            "pricing",
            "refund",
            "charge",
            "ledger",
            "payout",
        ),
        base_points=5,
        default_priority=PriorityEnum.HIGH,
        subtasks=(
            "Define idempotent payment intent schema and billing state machine transitions",
            "Implement checkout session creation and cryptographic webhook signature verification",
            "Handle asynchronous webhook events (succeeded, failed, disputed) with retry safety",
            "Add sandbox integration tests covering duplicate webhook delivery and partial failures",
        ),
        risks=(
            "Duplicate charge or double-fulfillment if idempotency keys are not strictly enforced",
            "Out-of-order webhook delivery between checkout redirect and async event processing",
            "Webhook signature verification failure if raw request body is mutated by middleware",
        ),
    ),
    DomainProfile(
        name="database",
        keywords=(
            "database",
            "db",
            "postgres",
            "postgresql",
            "sql",
            "schema",
            "migration",
            "drizzle",
            "index",
            "query",
            "transaction",
            "redis",
            "cache",
        ),
        base_points=3,
        default_priority=PriorityEnum.HIGH,
        subtasks=(
            "Design relational schema changes, foreign key constraints, and composite indexes",
            "Generate forward and rollback database migrations with zero-downtime defaults",
            "Implement data access queries with transaction boundaries and connection pooling",
            "Benchmark query execution plans (`EXPLAIN ANALYZE`) under representative load",
        ),
        risks=(
            "Table-level lock contention during migration on high-traffic tables",
            "N+1 query regressions or missing composite index on sort/filter columns",
            "Cache invalidation drift between PostgreSQL source-of-truth and Redis state",
        ),
    ),
    DomainProfile(
        name="ui",
        keywords=(
            "ui",
            "ux",
            "frontend",
            "react",
            "nextjs",
            "tailwind",
            "modal",
            "drag",
            "dnd",
            "kanban",
            "column",
            "board",
            "card",
            "component",
            "css",
            "animation",
            "responsive",
            "optimistic",
        ),
        base_points=3,
        default_priority=PriorityEnum.MEDIUM,
        subtasks=(
            "Build accessible component structure and responsive Tailwind layout states",
            "Wire optimistic Zustand/TanStack Query state updates with rollback on error",
            "Integrate keyboard navigation, focus management, and loading/skeleton transitions",
            "Verify cross-viewport rendering and interaction fidelity in component tests",
        ),
        risks=(
            "Optimistic UI state flicker or stale cache reconciliation during concurrent WebSocket updates",
            "Drag-and-drop pointer sensor conflicts with nested interactive controls on mobile/touch devices",
            "Layout shift (CLS) when asynchronous card metadata or subtasks populate dynamically",
        ),
    ),
    DomainProfile(
        name="api",
        keywords=(
            "api",
            "rest",
            "endpoint",
            "fastify",
            "fastapi",
            "websocket",
            "ws",
            "realtime",
            "real-time",
            "pubsub",
            "broadcast",
            "route",
            "middleware",
            "webhook",
            "contract",
            "payload",
        ),
        base_points=3,
        default_priority=PriorityEnum.MEDIUM,
        subtasks=(
            "Validate request and response payloads against shared contract schemas",
            "Implement endpoint handler logic with structured `StandardErrorSchema` error envelopes",
            "Wire real-time event emission and internal service propagation with timeout guards",
            "Write contract conformance tests covering 2xx, 400/401, and 404 response paths",
        ),
        risks=(
            "Schema drift between TypeScript Zod contracts and Python Pydantic v2 models",
            "WebSocket broadcast fan-out latency or dropped events during client reconnection",
            "Upstream service timeout cascading into blocking request handlers without circuit breaking",
        ),
    ),
    DomainProfile(
        name="deployment",
        keywords=(
            "deploy",
            "deployment",
            "docker",
            "compose",
            "kubernetes",
            "k8s",
            "ci",
            "cd",
            "pipeline",
            "infra",
            "infrastructure",
            "monitoring",
            "logging",
            "healthcheck",
            "env",
            "container",
        ),
        base_points=3,
        default_priority=PriorityEnum.MEDIUM,
        subtasks=(
            "Configure multi-stage container build and locked port bindings per service registry",
            "Define readiness/liveness healthcheck probes and service startup dependency ordering",
            "Validate environment variable injection and secret isolation against `.env.example`",
            "Run end-to-end smoke verification across networked service containers",
        ),
        risks=(
            "Container startup race condition before PostgreSQL or Redis passes readiness checks",
            "Port collision or localhost vs service-hostname resolution mismatch inside Docker networks",
            "Missing environment variables causing silent fallback or startup crash in staging",
        ),
    ),
    DomainProfile(
        name="bug",
        keywords=(
            "bug",
            "fix",
            "hotfix",
            "crash",
            "error",
            "issue",
            "regression",
            "leak",
            "broken",
            "race",
            "deadlock",
            "timeout",
            "defect",
            "patch",
        ),
        base_points=2,
        default_priority=PriorityEnum.HIGH,
        subtasks=(
            "Write a deterministic reproduction test case isolating the root failure condition",
            "Trace state mutation and timing boundaries to identify the underlying cause",
            "Implement minimal targeted fix with defensive input and state invariants",
            "Verify regression test suite passes and audit adjacent flows for side effects",
        ),
        risks=(
            "Symptom-level workaround masking an underlying concurrency or state synchronization race",
            "Unintended behavioral regression in callers relying on previous error/fallback semantics",
        ),
    ),
    DomainProfile(
        name="ai",
        keywords=(
            "ai",
            "llm",
            "openai",
            "gpt",
            "prompt",
            "embedding",
            "vector",
            "decompose",
            "heuristic",
            "agent",
            "copilot",
            "inference",
            "model",
        ),
        base_points=5,
        default_priority=PriorityEnum.MEDIUM,
        subtasks=(
            "Define structured JSON output schema and deterministic prompt constraints",
            "Implement async LLM client orchestration with strict timeout and token budgets",
            "Build domain-aware deterministic fallback engine for zero-config and outage resilience",
            "Add unit and contract tests verifying both live LLM mocking and fallback determinism",
        ),
        risks=(
            "Malformed or hallucinated JSON structure from upstream LLM violating strict Pydantic contracts",
            "Third-party LLM API latency spikes or rate-limit 429 responses impacting user experience",
        ),
    ),
)

URGENT_KEYWORDS: frozenset[str] = frozenset(
    {
        "urgent",
        "critical",
        "blocker",
        "outage",
        "p0",
        "sev0",
        "sev1",
        "hotfix",
        "vulnerability",
        "breach",
        "down",
    }
)

HIGH_KEYWORDS: frozenset[str] = frozenset(
    {
        "high",
        "important",
        "security",
        "production",
        "oauth",
        "oauth2",
        "pkce",
        "payment",
        "migration",
        "crash",
        "deadlock",
    }
)

LOW_KEYWORDS: frozenset[str] = frozenset(
    {
        "low",
        "minor",
        "typo",
        "cosmetic",
        "cleanup",
        "nit",
        "docs",
        "documentation",
        "comment",
        "rename",
    }
)

HIGH_COMPLEXITY_KEYWORDS: frozenset[str] = frozenset(
    {
        "architecture",
        "distributed",
        "end-to-end",
        "e2e",
        "refactor",
        "orchestration",
        "multi-tenant",
        "realtime",
        "real-time",
        "concurrency",
        "pkce",
        "oauth2",
        "migration",
    }
)

LOW_COMPLEXITY_KEYWORDS: frozenset[str] = frozenset(
    {
        "simple",
        "small",
        "minor",
        "typo",
        "tweak",
        "bump",
        "copy",
        "label",
        "text",
    }
)


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9][a-z0-9_-]*", text.lower())


def _score_domains(title: str, description: str) -> list[tuple[int, DomainProfile]]:
    title_tokens = set(_tokenize(title))
    desc_tokens = set(_tokenize(description))
    combined_lower = f"{title} {description}".lower()

    scored: list[tuple[int, DomainProfile]] = []
    for profile in DOMAIN_PROFILES:
        score = 0
        for kw in profile.keywords:
            if kw in title_tokens:
                score += 4
            elif kw in title.lower():
                score += 3
            if kw in desc_tokens:
                score += 2
            elif kw in combined_lower:
                score += 1
        if score > 0:
            scored.append((score, profile))

    scored.sort(key=lambda item: item[0], reverse=True)
    return scored


def _infer_priority(
    title: str,
    description: str,
    matched_profiles: list[DomainProfile],
) -> PriorityEnum:
    tokens = set(_tokenize(f"{title} {description}"))
    if tokens & URGENT_KEYWORDS:
        return PriorityEnum.URGENT
    if tokens & HIGH_KEYWORDS:
        return PriorityEnum.HIGH
    if tokens & LOW_KEYWORDS:
        return PriorityEnum.LOW
    if matched_profiles:
        priority_rank = {
            PriorityEnum.LOW: 0,
            PriorityEnum.MEDIUM: 1,
            PriorityEnum.HIGH: 2,
            PriorityEnum.URGENT: 3,
        }
        return max(
            (p.default_priority for p in matched_profiles[:2]),
            key=lambda pr: priority_rank[pr],
        )
    return PriorityEnum.MEDIUM


def _infer_story_points(
    title: str,
    description: str,
    matched_profiles: list[DomainProfile],
    board_context: list[str],
) -> int:
    tokens = set(_tokenize(f"{title} {description}"))
    base = matched_profiles[0].base_points if matched_profiles else 3

    delta = 0
    if len(matched_profiles) >= 2:
        delta += 1
    if len(matched_profiles) >= 3:
        delta += 1
    if len(tokens & HIGH_COMPLEXITY_KEYWORDS) >= 2:
        delta += 2
    elif len(tokens & HIGH_COMPLEXITY_KEYWORDS) == 1:
        delta += 1
    if len(description.strip()) > 240:
        delta += 1
    if len(board_context) >= 5:
        delta += 1

    if tokens & LOW_COMPLEXITY_KEYWORDS and not (tokens & HIGH_COMPLEXITY_KEYWORDS):
        delta -= 2

    raw_estimate = max(1, min(8, base + delta))
    return snap_to_fibonacci(raw_estimate)


def decompose_with_heuristics(
    request: AIDecomposeRequestSchema,
) -> AIDecomposeResponseSchema:
    """
    Deterministic Smart Fallback Engine (Zero-Config Ready).
    Analyzes domain keywords in `card_title`, `card_description`, and `board_context`
    to produce context-aware subtasks with fractional indices ("a0", "a1", ...),
    Fibonacci story points (1, 2, 3, 5, 8), priority, and technical risks.
    """
    title = request.card_title.strip()
    description = request.card_description.strip()
    board_context = [ctx.strip() for ctx in request.board_context if ctx and ctx.strip()]

    scored = _score_domains(title, description)
    matched_profiles = [profile for _, profile in scored]

    subtask_titles: list[str] = []
    risk_items: list[str] = []

    if matched_profiles:
        primary = matched_profiles[0]
        # Include primary domain subtasks, contextualized to the card
        if len(matched_profiles) == 1:
            subtask_titles.extend(primary.subtasks[:4])
        else:
            secondary = matched_profiles[1]
            subtask_titles.extend(primary.subtasks[:3])
            for candidate in secondary.subtasks:
                if candidate not in subtask_titles:
                    subtask_titles.append(candidate)
                    break
            if len(subtask_titles) < 4 and len(primary.subtasks) >= 4:
                subtask_titles.append(primary.subtasks[3])

        # Tailor the final verification/integration subtask with the card title
        short_subject = title[:80].rstrip(".")
        if len(subtask_titles) < 5 and description:
            subtask_titles.append(
                f"Verify '{short_subject}' against acceptance criteria: {description[:110].rstrip('.')}"
            )

        for profile in matched_profiles[:2]:
            for risk in profile.risks:
                if risk not in risk_items and len(risk_items) < 3:
                    risk_items.append(risk)
    else:
        short_subject = title[:90].rstrip(".")
        subtask_titles = [
            f"Define technical specification and contract boundaries for '{short_subject}'",
            f"Implement core domain logic and state handling for '{short_subject}'",
            "Add input validation, error handling (`StandardErrorSchema`), and telemetry",
            f"Write automated unit and integration tests verifying '{short_subject}'",
        ]
        risk_items = [
            f"Underspecified edge cases in '{short_subject}' requiring contract clarification",
            "Integration boundary assumptions with upstream or downstream board workflows",
        ]

    # Incorporate board_context awareness into risks if related tasks exist on the board
    if board_context:
        context_preview = ", ".join(f"'{item[:50]}'" for item in board_context[:2])
        risk_items.append(
            f"Cross-card sequencing dependency with active board items ({context_preview})"
        )

    suggested_subtasks = [
        SuggestedSubtaskSchema(
            title=subtask_title[:280],
            position=fractional_position(idx),
        )
        for idx, subtask_title in enumerate(subtask_titles[:5])
    ]

    estimated_points = _infer_story_points(
        title=title,
        description=description,
        matched_profiles=matched_profiles,
        board_context=board_context,
    )
    suggested_priority = _infer_priority(
        title=title,
        description=description,
        matched_profiles=matched_profiles,
    )

    return AIDecomposeResponseSchema(
        suggested_subtasks=suggested_subtasks,
        estimated_story_points=estimated_points,
        suggested_priority=suggested_priority,
        potential_risks=risk_items[:4],
    )


def _normalize_llm_payload(
    raw_data: dict[str, object],
    fallback_request: AIDecomposeRequestSchema,
) -> AIDecomposeResponseSchema:
    """
    Normalize and strictly validate LLM JSON output into `AIDecomposeResponseSchema`.
    Guarantees valid fractional positions ("a0", "a1", ...) and Fibonacci story points.
    """
    raw_subtasks = raw_data.get("suggested_subtasks")
    normalized_subtasks: list[SuggestedSubtaskSchema] = []

    if isinstance(raw_subtasks, list):
        for idx, item in enumerate(raw_subtasks[:6]):
            if isinstance(item, dict):
                raw_title = str(item.get("title", "")).strip()
            elif isinstance(item, str):
                raw_title = item.strip()
            else:
                continue
            if raw_title:
                normalized_subtasks.append(
                    SuggestedSubtaskSchema(
                        title=raw_title[:280],
                        position=fractional_position(len(normalized_subtasks)),
                    )
                )

    if not normalized_subtasks:
        return decompose_with_heuristics(fallback_request)

    raw_points = raw_data.get("estimated_story_points", 3)
    try:
        numeric_points = int(str(raw_points))
    except (ValueError, TypeError):
        numeric_points = 3
    estimated_points = snap_to_fibonacci(numeric_points)

    raw_priority = str(raw_data.get("suggested_priority", "MEDIUM")).upper().strip()
    try:
        priority = PriorityEnum(raw_priority)
    except ValueError:
        priority = PriorityEnum.MEDIUM

    raw_risks = raw_data.get("potential_risks")
    risks: list[str] = []
    if isinstance(raw_risks, list):
        for r in raw_risks[:5]:
            text = str(r).strip()
            if text:
                risks.append(text)
    if not risks:
        risks = decompose_with_heuristics(fallback_request).potential_risks

    return AIDecomposeResponseSchema(
        suggested_subtasks=normalized_subtasks,
        estimated_story_points=estimated_points,
        suggested_priority=priority,
        potential_risks=risks,
    )


async def _call_llm_decompose(
    request: AIDecomposeRequestSchema,
    settings: Settings,
) -> AIDecomposeResponseSchema:
    """Call OpenAI-compatible chat completions endpoint in JSON mode via `httpx`."""
    system_prompt = (
        "You are the Kinetix Principal AI Engineering Copilot. "
        "Break down the given Kanban card into 3 to 5 concrete, actionable engineering subtasks. "
        "Respond ONLY with a valid JSON object matching this exact schema:\n"
        "{\n"
        '  "suggested_subtasks": [{"title": "string", "position": "a0"}],\n'
        '  "estimated_story_points": 3, // MUST be a Fibonacci integer in [1, 2, 3, 5, 8]\n'
        '  "suggested_priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",\n'
        '  "potential_risks": ["string"]\n'
        "}"
    )
    user_payload = {
        "card_title": request.card_title,
        "card_description": request.card_description,
        "board_context": request.board_context,
    }

    url = f"{settings.llm_base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key.strip()}",
        "Content-Type": "application/json",
    }
    body = {
        "model": settings.llm_model,
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_payload)},
        ],
    }

    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        response = await client.post(url, headers=headers, json=body)
        response.raise_for_status()
        payload = response.json()

    content = payload["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    if not isinstance(parsed, dict):
        raise TypeError("LLM response content is not a JSON object")

    return _normalize_llm_payload(parsed, request)


async def decompose_task(
    request: AIDecomposeRequestSchema,
    settings: Settings | None = None,
) -> AIDecomposeResponseSchema:
    """
    Orchestrate Dual-Mode Task Decomposition:
    - Uses live LLM when a valid `LLM_API_KEY` is configured.
    - Automatically falls back to the deterministic domain heuristic engine when
      `LLM_API_KEY` is missing/placeholder or if the external LLM call fails.
    """
    active_settings = settings or get_settings()
    if active_settings.has_valid_llm_key:
        try:
            return await _call_llm_decompose(request, active_settings)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "External LLM call failed (%s); falling back to deterministic heuristic engine.",
                exc,
            )

    return decompose_with_heuristics(request)
