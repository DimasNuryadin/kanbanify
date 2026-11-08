"""
Smart Task Decomposer (`POST /internal/v1/decompose-task`) &
Trello Power-Up Smart Card Enrichment Engine (`POST /internal/v1/enrich-card`).

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
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.contracts import (
    AIDecomposeRequestSchema,
    AIDecomposeResponseSchema,
    AISuggestCardEnrichmentRequestSchema,
    AISuggestCardEnrichmentResponseSchema,
    LabelColorEnum,
    LabelSchema,
    PriorityEnum,
    SuggestedChecklistSchema,
    SuggestedLabelSchema,
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
    """Domain-specific engineering heuristic template for decomposition and Trello card enrichment."""

    name: str
    keywords: tuple[str, ...]
    base_points: int
    default_priority: PriorityEnum
    subtasks: tuple[str, ...]
    qa_steps: tuple[str, ...]
    acceptance_criteria: tuple[str, ...]
    technical_notes: tuple[str, ...]
    labels: tuple[tuple[str, LabelColorEnum], ...]
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
        qa_steps=(
            "Verify state parameter CSRF protection and S256 PKCE code challenge validation",
            "Test expired, tampered, and replayed token rejection returning 401 StandardErrorSchema",
            "Audit HTTP-only session cookie flags and CORS origin headers across staging and prod",
        ),
        acceptance_criteria=(
            "End-to-end authentication handshake succeeds with S256 PKCE code challenge verification",
            "Unauthorized or tampered credentials deterministically return `401 UNAUTHORIZED` (`StandardErrorSchema`)",
            "Session tokens rotate securely without leaking sensitive secrets in URLs or client logs",
        ),
        technical_notes=(
            "Enforce constant-time signature/digest comparisons (`hmac.compare_digest` / `crypto.timingSafeEqual`).",
            "Bind redirect URIs and token issuers strictly to environment configuration (`.env.example`).",
        ),
        labels=(
            ("Architecture", LabelColorEnum.BLUE),
            ("AI Assisted", LabelColorEnum.PURPLE),
            ("Ship Ready", LabelColorEnum.GREEN),
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
        qa_steps=(
            "Replay identical webhook payloads concurrently to verify idempotency key deduplication",
            "Verify invalid webhook signatures are rejected before mutating billing state",
            "Confirm failed payment transitions trigger grace-period and user notification states",
        ),
        acceptance_criteria=(
            "All payment mutations enforce deterministic idempotency keys to prevent double charges",
            "Webhook endpoint verifies cryptographic signatures against the raw request payload",
            "Subscription lifecycle transitions (`active`, `past_due`, `canceled`) persist atomically",
        ),
        technical_notes=(
            "Preserve raw unparsed request buffers for Stripe/webhook HMAC signature verification.",
            "Wrap ledger and subscription status updates inside serializable database transactions.",
        ),
        labels=(
            ("Architecture", LabelColorEnum.BLUE),
            ("Blocker", LabelColorEnum.RED),
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
        qa_steps=(
            "Verify migration up/down idempotency against a seeded PostgreSQL test instance",
            "Run `EXPLAIN ANALYZE` on board/card queries to confirm composite index utilization",
            "Test concurrent write transactions to verify zero deadlocks or orphaned records",
        ),
        acceptance_criteria=(
            "Schema migrations apply cleanly with zero data loss and preserve foreign-key integrity",
            "Hot-path queries utilize composite indexes (e.g. `(board_id, position)`) for O(1) ordering",
            "All database access remains strictly confined to `apps/api` per the Database Ownership Rule",
        ),
        technical_notes=(
            "Use lexicographical fractional index strings (`a0`, `a1`, `a0V`) to support single-row reordering.",
            "Avoid full-table locks by adding nullable/defaulted columns before backfilling constraints.",
        ),
        labels=(
            ("Architecture", LabelColorEnum.BLUE),
            ("Tech Debt", LabelColorEnum.ORANGE),
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
        qa_steps=(
            "Verify zero layout shift (CLS) and smooth 60fps drag-and-drop transitions across columns",
            "Test optimistic state rollback when an upstream API request returns an error",
            "Validate keyboard accessibility (`Tab`, `Escape`, `Enter`) and screen-reader ARIA labels",
        ),
        acceptance_criteria=(
            "UI updates optimistically with sub-16ms frame responsiveness and rolls back cleanly on API failure",
            "Component state adheres strictly to `BoardSchema`, `ColumnSchema`, and `CardSchema` contracts",
            "Interactive controls support full keyboard navigation and responsive mobile/desktop viewports",
        ),
        technical_notes=(
            "Compute fractional index midpoints (`a0` -> `a0V` -> `a1`) on the client prior to `PATCH /move`.",
            "Reconcile incoming WebSocket events (`CARD_MOVED`, `CARD_UPDATED`) idempotently against local store.",
        ),
        labels=(
            ("Frontend UX", LabelColorEnum.SKY),
            ("Ship Ready", LabelColorEnum.GREEN),
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
        qa_steps=(
            "Verify 100% payload conformance against `packages/contracts/index.ts` and `schemas.py`",
            "Test invalid payloads and unauthorized calls return `StandardErrorSchema` envelopes",
            "Confirm WebSocket `WSMessageSchema` broadcast reaches subscribed board peers",
        ),
        acceptance_criteria=(
            "Request and response bodies validate 1:1 against `@kinetix/contracts` and `schemas.py`",
            "All error paths (`400`, `401`, `404`, `500`) return the canonical `StandardErrorSchema` envelope",
            "Mutations broadcast real-time `WSMessageSchema` events to connected board clients",
        ),
        technical_notes=(
            "Enforce `X-Internal-Token` authentication on all `/internal/v1/*` service-to-service routes.",
            "Bound cross-service HTTP requests with explicit timeouts and deterministic fallback handling.",
        ),
        labels=(
            ("Architecture", LabelColorEnum.BLUE),
            ("Ship Ready", LabelColorEnum.GREEN),
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
        qa_steps=(
            "Verify `GET /health` returns `200 OK` on locked ports (`8000` for API, `8001` for AI Engine)",
            "Test container restart resilience and `depends_on: condition: service_healthy` ordering",
            "Audit image layers to ensure zero `.env` secrets or `.venv`/`node_modules` host leakage",
        ),
        acceptance_criteria=(
            "All services bind strictly to locked ports (`3000`, `8000`, `8001`, `5432`, `6379`)",
            "Healthcheck endpoints respond with `HealthCheckResponseSchema` (`status: 'ok'`, `version: '1.0.0'`)",
            "Service startup succeeds cleanly in zero-config mode when optional external keys are placeholders",
        ),
        technical_notes=(
            "Keep `services/ai-engine` stateless with zero direct connections to PostgreSQL or Redis.",
            "Align all environment variable defaults with the root `.env.example` contract.",
        ),
        labels=(
            ("Architecture", LabelColorEnum.BLUE),
            ("Tech Debt", LabelColorEnum.ORANGE),
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
        qa_steps=(
            "Confirm reproduction test fails prior to the patch and passes deterministically after",
            "Run full unit and contract regression suite to verify zero collateral breakage",
            "Test boundary inputs (empty payloads, concurrent updates, network timeouts)",
        ),
        acceptance_criteria=(
            "Root failure cause is eliminated and covered by an automated regression test",
            "Error boundary returns a structured `StandardErrorSchema` response instead of an unhandled crash",
            "No performance or behavioral regressions occur in adjacent board/card workflows",
        ),
        technical_notes=(
            "Avoid symptom-only guards; ensure state transitions remain atomic under concurrent access.",
            "Preserve full backward compatibility with locked request/response schemas.",
        ),
        labels=(
            ("Blocker", LabelColorEnum.RED),
            ("Tech Debt", LabelColorEnum.ORANGE),
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
            "enrich",
            "enrichment",
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
        qa_steps=(
            "Verify live LLM JSON normalization snaps story points to Fibonacci values (1, 2, 3, 5, 8)",
            "Test offline/placeholder `LLM_API_KEY` mode produces deterministic, domain-aware output",
            "Validate all generated checklists and subtasks use strict fractional positions (`a0`, `a1`, ...)",
        ),
        acceptance_criteria=(
            "Endpoint returns `200 OK` matching `packages/contracts/schemas.py` in both LLM and offline modes",
            "Generated subtasks and checklists use lexicographical fractional indexing (`a0`, `a1`, `a2`)",
            "Missing or invalid `X-Internal-Token` is rejected with `401 UNAUTHORIZED` (`StandardErrorSchema`)",
        ),
        technical_notes=(
            "Use `httpx.AsyncClient` with explicit timeout bounds and automatic heuristic fallback.",
            "Validate all outgoing payloads through Pydantic v2 contract models before returning.",
        ),
        labels=(
            ("AI Assisted", LabelColorEnum.PURPLE),
            ("Architecture", LabelColorEnum.BLUE),
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


# ============================================================================
# 1. TASK DECOMPOSER (`POST /internal/v1/decompose-task`)
# ============================================================================


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
        for item in raw_subtasks[:6]:
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


# ============================================================================
# 2. TRELLO SMART CARD ENRICHMENT ENGINE (`POST /internal/v1/enrich-card`)
# ============================================================================


def _build_structured_description(
    title: str,
    description: str,
    board_context: list[str],
    matched_profiles: list[DomainProfile],
    priority: PriorityEnum,
    story_points: int,
) -> str:
    """
    Generate a structured Markdown card specification with mandatory
    `## Objective`, `## Acceptance Criteria`, and `## Technical Notes` sections.
    """
    clean_title = title.strip().rstrip(".")
    clean_desc = description.strip()

    if clean_desc:
        objective_body = (
            f"Deliver **{clean_title}** — {clean_desc.rstrip('.')}. "
            f"Target priority is **{priority.value}** with an estimated effort of **{story_points} story points**."
        )
    else:
        domain_tag = matched_profiles[0].name.upper() if matched_profiles else "CORE"
        objective_body = (
            f"Design, implement, and verify **{clean_title}** within the `{domain_tag}` workstream. "
            f"Target priority is **{priority.value}** with an estimated effort of **{story_points} story points**."
        )

    criteria: list[str] = []
    notes: list[str] = []

    if matched_profiles:
        for profile in matched_profiles[:2]:
            for ac in profile.acceptance_criteria:
                if ac not in criteria and len(criteria) < 4:
                    criteria.append(ac)
            for note in profile.technical_notes:
                if note not in notes and len(notes) < 3:
                    notes.append(note)
    else:
        criteria = [
            f"Core implementation for '{clean_title}' satisfies all functional and contract requirements",
            "Request/response validation and error paths adhere to `StandardErrorSchema`",
            "Unit and integration tests cover happy-path and edge-case execution flows",
        ]
        notes = [
            "Maintain strict conformance with `packages/contracts/index.ts` and `packages/contracts/schemas.py`.",
            "Preserve O(1) lexicographical fractional indexing (`a0`, `a1`, `a0V`) across ordered entities.",
        ]

    if clean_desc and len(criteria) < 4:
        criteria.append(f"Verified scope coverage: {clean_desc[:140].rstrip('.')}")

    if board_context:
        ctx_summary = ", ".join(f"`{c[:45]}`" for c in board_context[:3])
        notes.append(f"Coordinate integration boundaries with related board items: {ctx_summary}.")

    ac_markdown = "\n".join(f"- {item}" for item in criteria)
    notes_markdown = "\n".join(f"- {item}" for item in notes)

    return (
        f"## Objective\n"
        f"{objective_body}\n\n"
        f"## Acceptance Criteria\n"
        f"{ac_markdown}\n\n"
        f"## Technical Notes\n"
        f"{notes_markdown}"
    )


def _select_suggested_labels(
    title: str,
    description: str,
    matched_profiles: list[DomainProfile],
    priority: PriorityEnum,
    available_labels: list[LabelSchema],
) -> list[SuggestedLabelSchema]:
    """
    Recommend Trello labels (`name` + `color`) based on domain, urgency, and `available_labels`.
    """
    candidates: list[tuple[str, LabelColorEnum]] = []

    if priority == PriorityEnum.URGENT:
        candidates.append(("Blocker", LabelColorEnum.RED))
        candidates.append(("Hotfix", LabelColorEnum.ORANGE))

    for profile in matched_profiles[:2]:
        for label_pair in profile.labels:
            if label_pair not in candidates:
                candidates.append(label_pair)

    if not candidates:
        if priority == PriorityEnum.HIGH:
            candidates.append(("Architecture", LabelColorEnum.BLUE))
            candidates.append(("Tech Debt", LabelColorEnum.ORANGE))
        elif priority == PriorityEnum.LOW:
            candidates.append(("Needs Spec", LabelColorEnum.YELLOW))
            candidates.append(("Ship Ready", LabelColorEnum.GREEN))
        else:
            candidates.append(("Architecture", LabelColorEnum.BLUE))
            candidates.append(("AI Assisted", LabelColorEnum.PURPLE))
            candidates.append(("Ship Ready", LabelColorEnum.GREEN))

    # Always ensure at least 2 distinct label recommendations
    if len(candidates) == 1:
        fallback_second = (
            ("Ship Ready", LabelColorEnum.GREEN)
            if candidates[0][1] != LabelColorEnum.GREEN
            else ("Architecture", LabelColorEnum.BLUE)
        )
        candidates.append(fallback_second)

    # Map against available_labels on the board when provided
    by_color: dict[LabelColorEnum, LabelSchema] = {}
    for avail in available_labels:
        if avail.color not in by_color and avail.name.strip():
            by_color[avail.color] = avail

    combined_tokens = set(_tokenize(f"{title} {description}"))
    resolved: list[SuggestedLabelSchema] = []
    seen_colors: set[LabelColorEnum] = set()

    # First check if any available_label name directly matches card tokens
    for avail in available_labels:
        avail_tokens = set(_tokenize(avail.name))
        if avail_tokens and (avail_tokens & combined_tokens) and avail.color not in seen_colors:
            resolved.append(
                SuggestedLabelSchema(
                    name=(avail.name.strip() or avail.color.value.capitalize())[:100],
                    color=avail.color,
                )
            )
            seen_colors.add(avail.color)

    for default_name, color in candidates:
        if color in seen_colors:
            continue
        if color in by_color:
            board_label = by_color[color]
            name_to_use = board_label.name.strip() or default_name
        else:
            name_to_use = default_name
        resolved.append(SuggestedLabelSchema(name=name_to_use[:100], color=color))
        seen_colors.add(color)
        if len(resolved) >= 3:
            break

    return resolved[:3]


def enrich_card_with_heuristics(
    request: AISuggestCardEnrichmentRequestSchema,
) -> AISuggestCardEnrichmentResponseSchema:
    """
    Deterministic Trello Power-Up Smart Card Enrichment Engine (Zero-Config Ready).
    Generates:
    - Structured Markdown `structured_description` / `suggested_description`
      with `## Objective`, `## Acceptance Criteria`, and `## Technical Notes`.
    - Multiple grouped `suggested_checklists` ("Implementation Steps" and "QA & Verification")
      with lexicographical fractional indices ("a0", "a1", ...).
    - Recommended Trello `suggested_labels` and `suggested_label_colors`.
    - `estimated_story_points`, `suggested_priority`, and `potential_risks`.
    """
    title = request.card_title.strip()
    description = request.card_description.strip()
    board_context = [ctx.strip() for ctx in request.board_context if ctx and ctx.strip()]

    scored = _score_domains(title, description)
    matched_profiles = [profile for _, profile in scored]

    decompose_result = decompose_with_heuristics(
        AIDecomposeRequestSchema(
            card_title=title,
            card_description=description,
            board_context=board_context,
        )
    )

    implementation_items = [
        SuggestedSubtaskSchema(
            title=item.title[:280],
            position=fractional_position(idx),
        )
        for idx, item in enumerate(decompose_result.suggested_subtasks[:4])
    ]

    qa_titles: list[str] = []
    if matched_profiles:
        for profile in matched_profiles[:2]:
            for qa_step in profile.qa_steps:
                if qa_step not in qa_titles and len(qa_titles) < 3:
                    qa_titles.append(qa_step)
    else:
        short_subject = title[:80].rstrip(".")
        qa_titles = [
            f"Verify unit and contract test coverage for '{short_subject}'",
            "Validate error responses conform to `StandardErrorSchema` across edge cases",
            "Perform end-to-end smoke verification on the interactive board workspace",
        ]

    qa_items = [
        SuggestedSubtaskSchema(
            title=qa_title[:280],
            position=fractional_position(idx),
        )
        for idx, qa_title in enumerate(qa_titles[:3])
    ]

    qa_checklist_title = (
        "QA & Security Verification"
        if matched_profiles and matched_profiles[0].name in ("auth", "payment")
        else "QA & Verification"
    )

    suggested_checklists = [
        SuggestedChecklistSchema(
            title="Implementation Steps",
            position=fractional_position(0),
            items=implementation_items,
        ),
        SuggestedChecklistSchema(
            title=qa_checklist_title,
            position=fractional_position(1),
            items=qa_items,
        ),
    ]

    suggested_labels = _select_suggested_labels(
        title=title,
        description=description,
        matched_profiles=matched_profiles,
        priority=decompose_result.suggested_priority,
        available_labels=request.available_labels,
    )

    structured_description = _build_structured_description(
        title=title,
        description=description,
        board_context=board_context,
        matched_profiles=matched_profiles,
        priority=decompose_result.suggested_priority,
        story_points=decompose_result.estimated_story_points,
    )

    return AISuggestCardEnrichmentResponseSchema(
        structured_description=structured_description,
        suggested_description=structured_description,
        suggested_checklists=suggested_checklists,
        suggested_labels=suggested_labels,
        suggested_label_colors=[lbl.color for lbl in suggested_labels],
        estimated_story_points=decompose_result.estimated_story_points,
        suggested_priority=decompose_result.suggested_priority,
        potential_risks=decompose_result.potential_risks,
    )


def _ensure_markdown_sections(description: str, fallback_description: str) -> str:
    """Ensure the structured Markdown description contains Objective, Acceptance Criteria, and Technical Notes."""
    cleaned = description.strip()
    if not cleaned:
        return fallback_description

    lowered = cleaned.lower()
    has_objective = "objective" in lowered
    has_ac = "acceptance criteria" in lowered
    has_notes = "technical notes" in lowered

    if has_objective and has_ac and has_notes:
        return cleaned

    sections: list[str] = []
    if not has_objective:
        sections.append(f"## Objective\n{cleaned}")
    else:
        sections.append(cleaned)

    if not has_ac:
        sections.append(
            "## Acceptance Criteria\n"
            "- Implementation satisfies shared Zod and Pydantic v2 contract schemas\n"
            "- All error boundaries return `StandardErrorSchema` responses"
        )
    if not has_notes:
        sections.append(
            "## Technical Notes\n"
            "- Preserve lexicographical fractional indexing (`a0`, `a1`, `a0V`) for ordered items.\n"
            "- Verify end-to-end behavior with automated unit and contract tests."
        )

    return "\n\n".join(sections)


def _normalize_llm_enrichment_payload(
    raw_data: dict[str, Any],
    fallback_request: AISuggestCardEnrichmentRequestSchema,
) -> AISuggestCardEnrichmentResponseSchema:
    """
    Normalize and strictly validate LLM JSON output into `AISuggestCardEnrichmentResponseSchema`.
    Guarantees structured Markdown sections, fractional checklist positions, valid `LabelColorEnum` colors,
    and Fibonacci story points.
    """
    heuristic_fallback = enrich_card_with_heuristics(fallback_request)

    raw_desc = str(
        raw_data.get("structured_description")
        or raw_data.get("suggested_description")
        or ""
    ).strip()
    structured_description = _ensure_markdown_sections(
        raw_desc, heuristic_fallback.structured_description
    )

    # Normalize checklists
    raw_checklists = raw_data.get("suggested_checklists")
    normalized_checklists: list[SuggestedChecklistSchema] = []
    if isinstance(raw_checklists, list):
        for cl_entry in raw_checklists[:4]:
            if not isinstance(cl_entry, dict):
                continue
            cl_title = str(cl_entry.get("title", "Checklist")).strip() or "Checklist"
            raw_items = cl_entry.get("items")
            normalized_items: list[SuggestedSubtaskSchema] = []
            if isinstance(raw_items, list):
                for item in raw_items[:6]:
                    if isinstance(item, dict):
                        item_title = str(item.get("title", "")).strip()
                    elif isinstance(item, str):
                        item_title = item.strip()
                    else:
                        continue
                    if item_title:
                        normalized_items.append(
                            SuggestedSubtaskSchema(
                                title=item_title[:280],
                                position=fractional_position(len(normalized_items)),
                            )
                        )
            if normalized_items:
                normalized_checklists.append(
                    SuggestedChecklistSchema(
                        title=cl_title[:150],
                        position=fractional_position(len(normalized_checklists)),
                        items=normalized_items,
                    )
                )

    if not normalized_checklists:
        normalized_checklists = heuristic_fallback.suggested_checklists

    # Normalize labels
    raw_labels = raw_data.get("suggested_labels")
    raw_colors = raw_data.get("suggested_label_colors")
    normalized_labels: list[SuggestedLabelSchema] = []
    seen_colors: set[LabelColorEnum] = set()

    if isinstance(raw_labels, list):
        for lbl in raw_labels[:4]:
            if isinstance(lbl, dict):
                name_str = str(lbl.get("name", "")).strip()
                color_str = str(lbl.get("color", "")).lower().strip()
                try:
                    color_enum = LabelColorEnum(color_str)
                except ValueError:
                    continue
                if not name_str:
                    name_str = color_enum.value.capitalize()
                if color_enum not in seen_colors:
                    normalized_labels.append(
                        SuggestedLabelSchema(name=name_str[:100], color=color_enum)
                    )
                    seen_colors.add(color_enum)

    if not normalized_labels and isinstance(raw_colors, list):
        for c in raw_colors[:4]:
            color_str = str(c).lower().strip()
            try:
                color_enum = LabelColorEnum(color_str)
            except ValueError:
                continue
            if color_enum not in seen_colors:
                normalized_labels.append(
                    SuggestedLabelSchema(
                        name=color_enum.value.capitalize(),
                        color=color_enum,
                    )
                )
                seen_colors.add(color_enum)

    if not normalized_labels:
        normalized_labels = heuristic_fallback.suggested_labels

    # Normalize story points
    raw_points = raw_data.get(
        "estimated_story_points", heuristic_fallback.estimated_story_points
    )
    try:
        numeric_points = int(str(raw_points))
    except (ValueError, TypeError):
        numeric_points = heuristic_fallback.estimated_story_points
    estimated_points = snap_to_fibonacci(numeric_points)

    # Normalize priority
    raw_priority = (
        str(
            raw_data.get(
                "suggested_priority", heuristic_fallback.suggested_priority.value
            )
        )
        .upper()
        .strip()
    )
    try:
        priority = PriorityEnum(raw_priority)
    except ValueError:
        priority = heuristic_fallback.suggested_priority

    # Normalize risks
    raw_risks = raw_data.get("potential_risks")
    risks: list[str] = []
    if isinstance(raw_risks, list):
        for r in raw_risks[:5]:
            text = str(r).strip()
            if text:
                risks.append(text)
    if not risks:
        risks = heuristic_fallback.potential_risks

    return AISuggestCardEnrichmentResponseSchema(
        structured_description=structured_description,
        suggested_description=structured_description,
        suggested_checklists=normalized_checklists,
        suggested_labels=normalized_labels,
        suggested_label_colors=[lbl.color for lbl in normalized_labels],
        estimated_story_points=estimated_points,
        suggested_priority=priority,
        potential_risks=risks,
    )


async def _call_llm_enrich_card(
    request: AISuggestCardEnrichmentRequestSchema,
    settings: Settings,
) -> AISuggestCardEnrichmentResponseSchema:
    """Call OpenAI-compatible chat completions endpoint in JSON mode for Trello Card Enrichment."""
    system_prompt = (
        "You are the Kinetix Principal AI Trello Power-Up Enrichment Copilot. "
        "Given a card title, description, board context, and available labels, generate a complete "
        "enrichment package. Respond ONLY with a valid JSON object matching this exact schema:\n"
        "{\n"
        '  "structured_description": "## Objective\\n...\\n\\n## Acceptance Criteria\\n- ...\\n\\n## Technical Notes\\n- ...",\n'
        '  "suggested_checklists": [\n'
        '    {"title": "Implementation Steps", "position": "a0", "items": [{"title": "string", "position": "a0"}]},\n'
        '    {"title": "QA & Verification", "position": "a1", "items": [{"title": "string", "position": "a0"}]}\n'
        "  ],\n"
        '  "suggested_labels": [{"name": "string", "color": "green|yellow|orange|red|purple|blue|sky|lime|pink|black"}],\n'
        '  "estimated_story_points": 5, // Fibonacci integer in [1, 2, 3, 5, 8]\n'
        '  "suggested_priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",\n'
        '  "potential_risks": ["string"]\n'
        "}"
    )
    user_payload = {
        "card_title": request.card_title,
        "card_description": request.card_description,
        "board_context": request.board_context,
        "available_labels": [
            {"name": lbl.name, "color": lbl.color.value}
            for lbl in request.available_labels
        ],
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
        raise TypeError("LLM enrichment response content is not a JSON object")

    return _normalize_llm_enrichment_payload(parsed, request)


async def enrich_card(
    request: AISuggestCardEnrichmentRequestSchema,
    settings: Settings | None = None,
) -> AISuggestCardEnrichmentResponseSchema:
    """
    Orchestrate Dual-Mode Trello Card Enrichment:
    - Uses live LLM when a valid `LLM_API_KEY` is configured.
    - Automatically falls back to the deterministic domain heuristic engine when
      `LLM_API_KEY` is missing/placeholder or if the external LLM call fails.
    """
    active_settings = settings or get_settings()
    if active_settings.has_valid_llm_key:
        try:
            return await _call_llm_enrich_card(request, active_settings)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "External LLM enrichment call failed (%s); falling back to deterministic heuristic engine.",
                exc,
            )

    return enrich_card_with_heuristics(request)
