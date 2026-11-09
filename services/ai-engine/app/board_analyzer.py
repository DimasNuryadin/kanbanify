"""
AI Executive Sprint Health & Bottleneck Analyzer (`POST /internal/v1/analyze-board`).
Evaluates quantitative board metrics (`BoardAnalyticsSchema`) and generates an executive agile report
(`AIAnalyticsReportSchema`) including `health_score`, `health_status`, `executive_summary`,
data-backed `bottlenecks`, and tailored `actionable_recommendations`.

Implements Dual-Mode Intelligence:
1. Live LLM Orchestration via OpenAI-compatible JSON mode (`httpx`) when a valid `LLM_API_KEY` is configured.
2. Deterministic Quantitative Agile Analyzer (Zero-Config Ready) when `LLM_API_KEY` is missing,
   a placeholder, or the upstream LLM request fails.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.contracts import (
    AIAnalyticsReportSchema,
    AIAnalyticsRequestSchema,
    BoardAnalyticsSchema,
    ColumnMetricSchema,
    MemberWorkloadSchema,
    PriorityEnum,
    SprintHealthStatusEnum,
)

logger = logging.getLogger("kinetix.ai_engine.board_analyzer")


def map_score_to_health_status(score: float) -> SprintHealthStatusEnum:
    """
    Map numeric health score (0-100) to SprintHealthStatusEnum:
    - >= 80: "EXCELLENT"
    - 60-79: "ON_TRACK"
    - 40-59: "AT_RISK"
    - < 40: "CRITICAL"
    """
    if score >= 80:
        return SprintHealthStatusEnum.EXCELLENT
    if score >= 60:
        return SprintHealthStatusEnum.ON_TRACK
    if score >= 40:
        return SprintHealthStatusEnum.AT_RISK
    return SprintHealthStatusEnum.CRITICAL


def calculate_health_score(analytics: BoardAnalyticsSchema) -> float:
    """
    Calculate a deterministic sprint health score (0-100) based on:
    - Base score weighted by:
      * `completion_rate`
      * `completed_story_points / total_story_points`
      * `checklist_completion_rate`
    - Deductions for:
      * `overdue_cards_count`
      * `blocked_cards_count`
      * columns where `is_bottleneck === true`
    """
    completion_pct = max(0.0, min(100.0, float(analytics.completion_rate)))
    if analytics.total_story_points > 0:
        sp_pct = max(
            0.0,
            min(
                100.0,
                (float(analytics.completed_story_points) / float(analytics.total_story_points))
                * 100.0,
            ),
        )
    else:
        sp_pct = completion_pct

    checklist_pct = max(0.0, min(100.0, float(analytics.checklist_completion_rate)))

    # Weighted progress index (0 - 100)
    weighted_progress = (
        0.40 * completion_pct + 0.35 * sp_pct + 0.25 * checklist_pct
    )

    # Active sprint baseline: an active in-progress sprint with steady velocity starts from a healthy baseline
    if analytics.total_cards == 0:
        base_score = 88.0
    else:
        base_score = 59.0 + 0.41 * weighted_progress

    # Deductions for risk factors
    bottleneck_columns_count = sum(
        1
        for col in analytics.cards_by_column
        if col.is_bottleneck
        or (col.wip_limit is not None and col.card_count > col.wip_limit)
    )

    overdue_penalty = min(30.0, float(analytics.overdue_cards_count) * 2.5)
    blocked_penalty = min(30.0, float(analytics.blocked_cards_count) * 4.0)
    bottleneck_penalty = min(25.0, float(bottleneck_columns_count) * 3.0)

    raw_score = (
        base_score
        - overdue_penalty
        - blocked_penalty
        - bottleneck_penalty
    )
    clamped = max(0.0, min(100.0, raw_score))
    return float(round(clamped))


def _detect_bottleneck_columns(
    columns: list[ColumnMetricSchema],
) -> list[ColumnMetricSchema]:
    """Return columns flagged with `is_bottleneck` or breaching their `wip_limit`."""
    detected: list[ColumnMetricSchema] = []
    for col in columns:
        if col.is_bottleneck or (
            col.wip_limit is not None and col.card_count > col.wip_limit
        ):
            detected.append(col)
    return detected


def _detect_overloaded_members(
    members: list[MemberWorkloadSchema],
) -> list[MemberWorkloadSchema]:
    """Identify team members with high active story points, high open card load, or overdue cards."""
    if not members:
        return []
    sorted_members = sorted(
        members,
        key=lambda m: (
            m.active_story_points,
            m.assigned_cards_count - m.completed_cards_count,
            m.overdue_cards_count,
        ),
        reverse=True,
    )
    overloaded: list[MemberWorkloadSchema] = []
    for m in sorted_members:
        open_cards = max(0, m.assigned_cards_count - m.completed_cards_count)
        if (
            m.active_story_points >= 10
            or open_cards >= 3
            or m.overdue_cards_count >= 1
            or m.assigned_cards_count >= 4
        ):
            overloaded.append(m)
    return overloaded


def _format_num(val: float) -> str:
    """Format float cleanly as int string if whole number, else 1 decimal place."""
    if float(val).is_integer():
        return str(int(val))
    return f"{val:.1f}"


def generate_bottlenecks(analytics: BoardAnalyticsSchema) -> list[str]:
    """
    Inspect `cards_by_column`, `overdue_cards_count`, `blocked_cards_count`, and `workload_by_member`
    to generate specific, data-backed bottleneck statements naming exact columns and team members.
    """
    bottlenecks: list[str] = []

    # 1. Column bottlenecks (`is_bottleneck === true` or WIP limit exceeded)
    bottleneck_cols = _detect_bottleneck_columns(analytics.cards_by_column)
    for col in bottleneck_cols:
        if col.wip_limit is not None:
            bottlenecks.append(
                f"Column '{col.column_title}' exceeds its WIP limit ({col.card_count} active cards vs limit of {col.wip_limit}, {_format_num(col.total_story_points)} story points)."
            )
        else:
            bottlenecks.append(
                f"Column '{col.column_title}' is a workflow bottleneck with {col.card_count} active cards ({_format_num(col.total_story_points)} story points)."
            )

    # 2. Overdue and blocked cards
    if analytics.overdue_cards_count > 0 and analytics.blocked_cards_count > 0:
        overdue_label = (
            "1 card is"
            if analytics.overdue_cards_count == 1
            else f"{analytics.overdue_cards_count} cards are"
        )
        blocked_label = (
            "1 card is"
            if analytics.blocked_cards_count == 1
            else f"{analytics.blocked_cards_count} cards are"
        )
        bottlenecks.append(
            f"{overdue_label} currently past due date and {blocked_label} flagged as blocked."
        )
    elif analytics.overdue_cards_count > 0:
        overdue_label = (
            "1 card is"
            if analytics.overdue_cards_count == 1
            else f"{analytics.overdue_cards_count} cards are"
        )
        bottlenecks.append(
            f"{overdue_label} past due date, creating schedule slippage risk."
        )
    elif analytics.blocked_cards_count > 0:
        blocked_label = (
            "1 card is"
            if analytics.blocked_cards_count == 1
            else f"{analytics.blocked_cards_count} cards are"
        )
        bottlenecks.append(
            f"{blocked_label} currently blocked by upstream dependencies."
        )

    # 3. Member workload imbalances / overloaded team members
    overloaded_members = _detect_overloaded_members(analytics.workload_by_member)
    for member in overloaded_members[:2]:
        open_cards = max(
            0, member.assigned_cards_count - member.completed_cards_count
        )
        overdue_suffix = (
            f" ({member.overdue_cards_count} overdue)"
            if member.overdue_cards_count > 0
            else ""
        )
        bottlenecks.append(
            f"{member.member_name} is carrying {_format_num(member.active_story_points)} active story points across {open_cards} open cards{overdue_suffix}."
        )

    # 4. Priority concentration or high uncompleted backlog
    urgent_metrics = [
        p
        for p in analytics.cards_by_priority
        if p.priority == PriorityEnum.URGENT and p.count > 0
    ]
    if urgent_metrics and len(bottlenecks) < 4:
        urg = urgent_metrics[0]
        if urg.count >= 2:
            bottlenecks.append(
                f"High concentration of URGENT work ({urg.count} cards totaling {_format_num(urg.story_points)} story points) competing for immediate capacity."
            )

    # 5. If no explicit bottlenecks were triggered, inspect largest non-done column or provide a clean status note
    if not bottlenecks:
        active_cols = [
            c
            for c in analytics.cards_by_column
            if c.column_title.lower() not in ("done", "completed", "shipped")
            and c.card_count > 0
        ]
        if active_cols:
            busiest = max(
                active_cols, key=lambda c: (c.card_count, c.total_story_points)
            )
            bottlenecks.append(
                f"Column '{busiest.column_title}' holds the highest concentration of active work ({busiest.card_count} cards, {_format_num(busiest.total_story_points)} story points)."
            )
        else:
            bottlenecks.append(
                "No critical WIP limit breaches, blocked cards, or overdue bottlenecks detected across board columns."
            )

    return bottlenecks[:5]


def generate_actionable_recommendations(
    analytics: BoardAnalyticsSchema,
) -> list[str]:
    """
    Generate 3 to 5 concrete, tailored actionable recommendations referencing specific
    columns, team members, blocked/overdue counts, and checklist/automation metrics.
    """
    recommendations: list[str] = []

    bottleneck_cols = _detect_bottleneck_columns(analytics.cards_by_column)
    overloaded_members = _detect_overloaded_members(analytics.workload_by_member)

    # 1. Recommendation for bottleneck columns & blocked cards
    if bottleneck_cols:
        primary_col = bottleneck_cols[0]
        limit_str = (
            f"its WIP limit of {primary_col.wip_limit}"
            if primary_col.wip_limit is not None
            else "optimal flow capacity"
        )
        if analytics.blocked_cards_count > 0:
            blocked_str = (
                "the 1 blocked card"
                if analytics.blocked_cards_count == 1
                else f"the {analytics.blocked_cards_count} blocked cards"
            )
            recommendations.append(
                f"Swarm on {blocked_str} in '{primary_col.column_title}' to clear dependencies and bring the column back within {limit_str}."
            )
        else:
            excess = (
                max(1, primary_col.card_count - primary_col.wip_limit)
                if primary_col.wip_limit is not None
                else 1
            )
            recommendations.append(
                f"Pause new card pull into '{primary_col.column_title}' and complete or move {excess} in-flight card(s) to restore {limit_str}."
            )
    elif analytics.blocked_cards_count > 0:
        recommendations.append(
            f"Escalate and resolve the {analytics.blocked_cards_count} blocked card(s) during daily standup before starting new backlog items."
        )

    # 2. Recommendation for overloaded team members
    if overloaded_members:
        top_member = overloaded_members[0]
        # Check if there is a lighter-loaded member on the board to suggest rebalancing to
        lighter_members = [
            m
            for m in analytics.workload_by_member
            if m.member_id != top_member.member_id
            and m.active_story_points < top_member.active_story_points
        ]
        if lighter_members:
            lighter_sorted = sorted(
                lighter_members, key=lambda m: m.active_story_points
            )
            target_names = " or ".join(m.member_name for m in lighter_sorted[:2])
            recommendations.append(
                f"Rebalance 1 to 2 active cards from {top_member.member_name} ({_format_num(top_member.active_story_points)} active pts) to {target_names} to equalize sprint capacity."
            )
        else:
            recommendations.append(
                f"Rebalance 1 High-priority card from {top_member.member_name} ({_format_num(top_member.active_story_points)} active story points) or defer non-critical scope to the next sprint."
            )

    # 3. Recommendation for overdue cards
    if analytics.overdue_cards_count > 0:
        card_noun = (
            "1 overdue card"
            if analytics.overdue_cards_count == 1
            else f"{analytics.overdue_cards_count} overdue cards"
        )
        recommendations.append(
            f"Review and renegotiate target due dates or descope subtasks for the {card_noun} during tomorrow's standup."
        )

    # 4. Recommendation for checklist completion or task decomposition
    if analytics.checklist_completion_rate < 75.0 and len(recommendations) < 5:
        recommendations.append(
            f"Drive checklist completion (currently {analytics.checklist_completion_rate:.1f}%) by closing out remaining verification items before moving cards to Done."
        )

    # 5. Recommendation for WIP limits or Butler automation
    unbounded_active_cols = [
        c
        for c in analytics.cards_by_column
        if c.wip_limit is None
        and c.column_title.lower() not in ("backlog", "done", "completed", "shipped")
        and c.card_count >= 3
    ]
    if unbounded_active_cols and len(recommendations) < 5:
        col_name = unbounded_active_cols[0].column_title
        recommendations.append(
            f"Configure an explicit WIP limit on column '{col_name}' ({unbounded_active_cols[0].card_count} active cards) to prevent multi-tasking thrash."
        )

    if len(recommendations) < 3:
        recommendations.append(
            "Leverage Kinetix Butler automation rules to auto-assign reviewers and mark due dates complete when cards transition to Done."
        )
    if len(recommendations) < 3:
        recommendations.append(
            "Maintain current sprint cadence and use AI Smart Decomposer to break down upcoming backlog epics into <= 5 story point cards."
        )

    return recommendations[:5]


def generate_executive_summary(
    board_title: str,
    analytics: BoardAnalyticsSchema,
    health_score: float,
    health_status: SprintHealthStatusEnum,
) -> str:
    """Synthesize a crisp, markdown-formatted executive summary of the board's sprint health."""
    bottleneck_cols = _detect_bottleneck_columns(analytics.cards_by_column)
    sp_delivered = _format_num(analytics.completed_story_points)
    sp_total = _format_num(analytics.total_story_points)

    status_descriptors = {
        SprintHealthStatusEnum.EXCELLENT: "operating at peak velocity",
        SprintHealthStatusEnum.ON_TRACK: "progressing steadily",
        SprintHealthStatusEnum.AT_RISK: "experiencing delivery friction",
        SprintHealthStatusEnum.CRITICAL: "facing severe delivery risk",
    }
    descriptor = status_descriptors.get(health_status, "progressing")

    risk_clauses: list[str] = []
    if bottleneck_cols:
        b_col = bottleneck_cols[0]
        if b_col.wip_limit is not None:
            risk_clauses.append(
                f"a WIP limit breach in **{b_col.column_title}** ({b_col.card_count}/{b_col.wip_limit} cards)"
            )
        else:
            risk_clauses.append(
                f"a workflow bottleneck in **{b_col.column_title}** ({b_col.card_count} cards)"
            )
    if analytics.overdue_cards_count > 0:
        risk_clauses.append(
            f"{analytics.overdue_cards_count} overdue card{'s' if analytics.overdue_cards_count != 1 else ''}"
        )
    if analytics.blocked_cards_count > 0:
        risk_clauses.append(
            f"{analytics.blocked_cards_count} blocked card{'s' if analytics.blocked_cards_count != 1 else ''}"
        )

    if risk_clauses:
        joined_risks = " and ".join(
            [", ".join(risk_clauses[:-1]), risk_clauses[-1]]
            if len(risk_clauses) > 1
            else risk_clauses
        )
        return (
            f"Sprint velocity on **{board_title}** is {descriptor} at **{analytics.completion_rate:.1f}% completion** "
            f"({sp_delivered}/{sp_total} story points delivered, health score **{round(health_score)}/100**), "
            f"though {joined_risks} require attention."
        )

    return (
        f"Sprint execution on **{board_title}** is {descriptor} at **{analytics.completion_rate:.1f}% completion** "
        f"({sp_delivered}/{sp_total} story points delivered, checklist progress at {analytics.checklist_completion_rate:.1f}%) "
        f"with zero blocked or overdue cards."
    )


def analyze_board_with_heuristics(
    request: AIAnalyticsRequestSchema,
) -> AIAnalyticsReportSchema:
    """
    Deterministic Quantitative Agile Analyzer (Zero-Config Ready).
    Computes `health_score`, `health_status`, `executive_summary`, `bottlenecks`,
    and `actionable_recommendations` directly from `BoardAnalyticsSchema`.
    """
    analytics = request.analytics
    board_title = request.board_title.strip()

    health_score = calculate_health_score(analytics)
    health_status = map_score_to_health_status(health_score)
    bottlenecks = generate_bottlenecks(analytics)
    recommendations = generate_actionable_recommendations(analytics)
    executive_summary = generate_executive_summary(
        board_title=board_title,
        analytics=analytics,
        health_score=health_score,
        health_status=health_status,
    )

    generated_at = (
        datetime.now(UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )

    return AIAnalyticsReportSchema(
        health_score=health_score,
        health_status=health_status,
        executive_summary=executive_summary,
        bottlenecks=bottlenecks,
        actionable_recommendations=recommendations,
        generated_at=generated_at,
    )


def _normalize_llm_analytics_payload(
    raw_data: dict[str, Any],
    fallback_request: AIAnalyticsRequestSchema,
) -> AIAnalyticsReportSchema:
    """
    Validate, sanitize, and normalize raw LLM JSON output into `AIAnalyticsReportSchema`.
    Guarantees accurate `health_score` (0-100), matching `health_status` enum,
    non-empty `executive_summary`, `bottlenecks`, `actionable_recommendations`, and ISO `generated_at`.
    """
    deterministic = analyze_board_with_heuristics(fallback_request)

    raw_score = raw_data.get("health_score")
    try:
        score = float(raw_score)  # type: ignore[arg-type]
        score = max(0.0, min(100.0, float(round(score))))
    except (TypeError, ValueError):
        score = deterministic.health_score

    # Map score to canonical status to guarantee threshold consistency (>=80, 60-79, 40-59, <40)
    status = map_score_to_health_status(score)

    raw_summary = str(raw_data.get("executive_summary") or "").strip()
    executive_summary = (
        raw_summary if raw_summary else deterministic.executive_summary
    )

    raw_bottlenecks = raw_data.get("bottlenecks")
    bottlenecks: list[str] = []
    if isinstance(raw_bottlenecks, list):
        for item in raw_bottlenecks[:6]:
            text = str(item).strip()
            if text:
                bottlenecks.append(text)
    if not bottlenecks:
        bottlenecks = deterministic.bottlenecks

    raw_recommendations = raw_data.get("actionable_recommendations")
    recommendations: list[str] = []
    if isinstance(raw_recommendations, list):
        for item in raw_recommendations[:6]:
            text = str(item).strip()
            if text:
                recommendations.append(text)
    if not recommendations:
        recommendations = deterministic.actionable_recommendations

    raw_generated_at = raw_data.get("generated_at")
    if isinstance(raw_generated_at, str) and raw_generated_at.strip():
        generated_at: datetime | str = raw_generated_at.strip()
    else:
        generated_at = deterministic.generated_at

    return AIAnalyticsReportSchema(
        health_score=score,
        health_status=status,
        executive_summary=executive_summary,
        bottlenecks=bottlenecks,
        actionable_recommendations=recommendations,
        generated_at=generated_at,
    )


async def _call_llm_analyze_board(
    request: AIAnalyticsRequestSchema,
    settings: Settings,
) -> AIAnalyticsReportSchema:
    """Call external OpenAI-compatible chat completions endpoint in JSON mode for Sprint Health Analysis."""
    deterministic_baseline = analyze_board_with_heuristics(request)

    system_prompt = (
        "You are the Kinetix Principal Agile Intelligence Engine. "
        "Given a Kanban/Scrum board title and real-time quantitative sprint metrics (`BoardAnalyticsSchema`), "
        "synthesize an executive sprint health & bottleneck report. "
        "You MUST specifically name bottlenecked columns (where `is_bottleneck` is true or `card_count > wip_limit`) "
        "and overloaded team members from `workload_by_member` in `bottlenecks` and `actionable_recommendations`. "
        "Score mapping rules: >= 80 is 'EXCELLENT', 60-79 is 'ON_TRACK', 40-59 is 'AT_RISK', < 40 is 'CRITICAL'. "
        "Respond ONLY with a valid JSON object matching this exact schema:\n"
        "{\n"
        '  "health_score": number (0 to 100),\n'
        '  "health_status": "EXCELLENT" | "ON_TRACK" | "AT_RISK" | "CRITICAL",\n'
        '  "executive_summary": "concise markdown summary referencing completion rate and story points",\n'
        '  "bottlenecks": ["specific data-backed bottleneck 1", "bottleneck 2"],\n'
        '  "actionable_recommendations": ["concrete recommendation 1", "recommendation 2", "recommendation 3"]\n'
        "}"
    )

    user_payload = {
        "board_title": request.board_title,
        "analytics": request.analytics.model_dump(mode="json"),
        "quantitative_baseline_score": deterministic_baseline.health_score,
        "quantitative_baseline_status": deterministic_baseline.health_status.value,
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
        raise TypeError("LLM board analyzer response content is not a JSON object")

    return _normalize_llm_analytics_payload(parsed, request)


async def analyze_board(
    request: AIAnalyticsRequestSchema,
    settings: Settings | None = None,
) -> AIAnalyticsReportSchema:
    """
    Orchestrate Dual-Mode AI Executive Sprint Health & Bottleneck Analysis:
    - Uses live LLM when a valid `LLM_API_KEY` is configured.
    - Automatically falls back to the Deterministic Quantitative Agile Analyzer when
      `LLM_API_KEY` is missing/placeholder or if the upstream LLM request fails.
    """
    active_settings = settings or get_settings()
    if active_settings.has_valid_llm_key:
        try:
            return await _call_llm_analyze_board(request, active_settings)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "External LLM board analyzer call failed (%s); falling back to deterministic quantitative analyzer.",
                exc,
            )

    return analyze_board_with_heuristics(request)
