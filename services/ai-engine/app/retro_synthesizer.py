"""
AI Sprint Retrospective Synthesizer & Estimation Analyzer (`POST /internal/v1/synthesize-retro`).
Evaluates retrospective board notes (`RetroItemSchema`) alongside sprint execution metrics
(completed cards, overdue cards, total estimated vs logged hours) to synthesize:
- `sprint_morale_score` (0 to 100)
- `estimation_accuracy_summary` (explaining under-estimating, over-estimating, or well-calibrated within ±15%)
- `key_themes` (distilled top-voted agile patterns)
- `suggested_retro_items` (constructive feedback notes)
- 3 concrete `recommended_action_items` (directly addressing highest-voted improvements & estimation drift)

Implements Dual-Mode Intelligence:
1. Live LLM Orchestration via OpenAI-compatible JSON mode (`httpx`) when a valid `LLM_API_KEY` is configured.
2. Deterministic Agile Retrospective Synthesizer (Zero-Config Ready) when `LLM_API_KEY` is missing,
   a placeholder, or the upstream LLM request fails.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.contracts import (
    AIRetroActionItemSchema,
    AIRetroAnalysisRequestSchema,
    AIRetroAnalysisResponseSchema,
    AIRetroSuggestedItemSchema,
    PriorityEnum,
    RetroCategoryEnum,
    RetroItemSchema,
)

logger = logging.getLogger("kinetix.ai_engine.retro_synthesizer")


def _format_hours(hours: float) -> str:
    """Format hour values cleanly as 1 decimal place (e.g., 40.0, 42.5)."""
    return f"{float(hours):.1f}"


def calculate_morale_score(
    retro_items: list[RetroItemSchema],
    completed_cards_count: int,
    overdue_cards_count: int,
) -> float:
    """
    Compute `sprint_morale_score` (0.0 to 100.0) based on:
    - Sentiment score (0-60 pts): ratio of WENT_WELL + KUDOS vs TO_IMPROVE items,
      weighted by votes (votes + 1).
    - Delivery score (0-40 pts): completed_cards_count vs overdue_cards_count.
    - Overdue penalty (0-15 pts deduction): penalties for schedule slippage.
    """
    positive_items = [
        item
        for item in retro_items
        if item.category in (RetroCategoryEnum.WENT_WELL, RetroCategoryEnum.KUDOS)
    ]
    improvement_items = [
        item
        for item in retro_items
        if item.category == RetroCategoryEnum.TO_IMPROVE
    ]

    pos_weight = sum(item.votes + 1 for item in positive_items)
    improve_weight = sum(item.votes + 1 for item in improvement_items)

    if pos_weight + improve_weight > 0:
        sentiment_ratio = pos_weight / (pos_weight + improve_weight)
    else:
        # Default healthy baseline when no sentiment items exist
        sentiment_ratio = 0.75

    sentiment_score = sentiment_ratio * 60.0

    # Delivery ratio
    total_delivery_cards = completed_cards_count + overdue_cards_count
    if total_delivery_cards > 0:
        delivery_ratio = completed_cards_count / total_delivery_cards
    else:
        delivery_ratio = 0.85

    delivery_score = delivery_ratio * 40.0

    # Overdue penalty deduction
    if overdue_cards_count > 0:
        overdue_penalty = min(15.0, overdue_cards_count * 9.0)
    else:
        overdue_penalty = 0.0

    raw_morale = sentiment_score + delivery_score - overdue_penalty
    clamped = max(0.0, min(100.0, raw_morale))
    return float(round(clamped))


def calculate_estimation_summary(
    total_estimated_hours: float,
    total_logged_hours: float,
) -> str:
    """
    Compute estimation accuracy summary by comparing total_logged_hours against total_estimated_hours.
    Explains whether the team is under-estimating, over-estimating, or well-calibrated within ±15%.
    """
    est = float(total_estimated_hours)
    logged = float(total_logged_hours)

    if est <= 0.0 and logged <= 0.0:
        return "No estimation or logged hours recorded for this sprint."

    if est <= 0.0 and logged > 0.0:
        return (
            f"Team logged {_format_hours(logged)}h without initial sprint estimates. "
            "Consider establishing story point or hour estimation during sprint planning to gauge team velocity."
        )

    variance_pct = round((logged / est) * 100.0)
    ratio = logged / est

    if 0.85 <= ratio <= 1.15:
        return (
            f"Team logged {_format_hours(logged)}h against {_format_hours(est)}h estimated "
            f"({variance_pct}% variance). High estimation accuracy within healthy agile variance limits."
        )

    if ratio > 1.15:
        diff_pct = round((ratio - 1.0) * 100.0)
        return (
            f"Team logged {_format_hours(logged)}h against {_format_hours(est)}h estimated "
            f"({variance_pct}% variance). The team is under-estimating tasks ({diff_pct}% more time than planned). "
            "Recommend breaking down complex user stories into granular subtasks and adding estimation buffer."
        )

    # ratio < 0.85
    diff_pct = round((1.0 - ratio) * 100.0)
    return (
        f"Team logged {_format_hours(logged)}h against {_format_hours(est)}h estimated "
        f"({variance_pct}% variance). The team is over-estimating task effort, completing work "
        f"{diff_pct}% faster than planned. Team capacity can safely be expanded for upcoming sprints."
    )


def extract_key_themes(
    retro_items: list[RetroItemSchema],
    completed_cards_count: int,
    overdue_cards_count: int,
) -> list[str]:
    """Extract top-voted patterns from retro_items into high-level agile themes."""
    themes: list[str] = []

    if retro_items:
        sorted_items = sorted(retro_items, key=lambda item: item.votes, reverse=True)

        went_well_items = [
            it
            for it in sorted_items
            if it.category in (RetroCategoryEnum.WENT_WELL, RetroCategoryEnum.KUDOS)
        ]
        improve_items = [
            it for it in sorted_items if it.category == RetroCategoryEnum.TO_IMPROVE
        ]
        action_items = [
            it for it in sorted_items if it.category == RetroCategoryEnum.ACTION_ITEMS
        ]

        if went_well_items:
            top_pos = went_well_items[0]
            content = top_pos.content.strip().rstrip(".")
            themes.append(f"High velocity and strong execution: {content}")

        if improve_items:
            top_imp = improve_items[0]
            content = top_imp.content.strip().rstrip(".")
            themes.append(f"Operational friction: {content}")

        if len(themes) < 3 and len(went_well_items) > 1:
            content = went_well_items[1].content.strip().rstrip(".")
            themes.append(f"Team collaboration highlight: {content}")
        elif len(themes) < 3 and action_items:
            content = action_items[0].content.strip().rstrip(".")
            themes.append(f"Key improvement initiative: {content}")
        elif len(themes) < 3 and len(improve_items) > 1:
            content = improve_items[1].content.strip().rstrip(".")
            themes.append(f"Secondary workflow bottleneck: {content}")

    if not themes:
        themes.append(
            f"Delivered {completed_cards_count} completed cards successfully during the sprint cycle."
        )
        if overdue_cards_count > 0:
            themes.append(
                f"Schedule slippage risk on {overdue_cards_count} overdue card(s) requiring immediate unblocking."
            )
        else:
            themes.append(
                "Consistent sprint cadence with zero overdue deliverables across active columns."
            )
        themes.append(
            "Strong team collaboration and active cross-functional knowledge sharing."
        )

    return themes[:4]


def generate_suggested_retro_items(
    retro_items: list[RetroItemSchema],
    total_estimated_hours: float,
    total_logged_hours: float,
    overdue_cards_count: int,
) -> list[AIRetroSuggestedItemSchema]:
    """Generate suggested retrospective items addressing improvements, estimation, and wins."""
    suggested: list[AIRetroSuggestedItemSchema] = []

    improve_items = [
        it for it in retro_items if it.category == RetroCategoryEnum.TO_IMPROVE
    ]
    if improve_items:
        top_imp = max(improve_items, key=lambda it: it.votes)
        content_lower = top_imp.content.lower()
        if any(w in content_lower for w in ("pr", "review", "pull request", "code review")):
            suggested.append(
                AIRetroSuggestedItemSchema(
                    category=RetroCategoryEnum.ACTION_ITEMS,
                    content="Configure automated PR reminder bot on Discord/Slack for reviews older than 4 hours.",
                )
            )
        elif any(w in content_lower for w in ("test", "qa", "bug", "defect", "flaky")):
            suggested.append(
                AIRetroSuggestedItemSchema(
                    category=RetroCategoryEnum.ACTION_ITEMS,
                    content="Automate end-to-end regression tests in CI pipeline to catch defects prior to QA handover.",
                )
            )
        else:
            clean_text = top_imp.content.strip().rstrip(".")
            suggested.append(
                AIRetroSuggestedItemSchema(
                    category=RetroCategoryEnum.ACTION_ITEMS,
                    content=f"Establish targeted action plan to resolve: {clean_text}.",
                )
            )
    else:
        suggested.append(
            AIRetroSuggestedItemSchema(
                category=RetroCategoryEnum.ACTION_ITEMS,
                content="Configure automated PR reminder bot on Discord/Slack for reviews older than 4 hours.",
            )
        )

    # Positive reinforcement item
    suggested.append(
        AIRetroSuggestedItemSchema(
            category=RetroCategoryEnum.WENT_WELL,
            content="Pomodoro focus timer adoption improved uninterrupted deep work cycles.",
        )
    )

    # Estimation or schedule suggestion
    est = float(total_estimated_hours)
    logged = float(total_logged_hours)
    if est > 0.0 and logged > est * 1.15:
        suggested.append(
            AIRetroSuggestedItemSchema(
                category=RetroCategoryEnum.TO_IMPROVE,
                content="Task estimates drifted significantly beyond logged hours; introduce 15-minute calibration spikes.",
            )
        )
    elif overdue_cards_count > 0:
        suggested.append(
            AIRetroSuggestedItemSchema(
                category=RetroCategoryEnum.TO_IMPROVE,
                content="Mid-sprint scope changes created schedule pressure leading to overdue cards.",
            )
        )

    return suggested[:3]


def generate_recommended_action_items(
    retro_items: list[RetroItemSchema],
    total_estimated_hours: float,
    total_logged_hours: float,
    overdue_cards_count: int,
) -> list[AIRetroActionItemSchema]:
    """
    Generate exactly 3 concrete recommended action items:
    1. Directly addressing the highest-voted TO_IMPROVE note.
    2. Directly addressing estimation drift or time tracking calibration.
    3. Continuous systemic agile process enhancement.
    """
    actions: list[AIRetroActionItemSchema] = []

    # 1. Action item addressing highest-voted TO_IMPROVE
    improve_items = [
        it for it in retro_items if it.category == RetroCategoryEnum.TO_IMPROVE
    ]
    if improve_items:
        top_imp = max(improve_items, key=lambda it: it.votes)
        content_lower = top_imp.content.lower()

        if any(w in content_lower for w in ("pr", "review", "pull request", "code review")):
            actions.append(
                AIRetroActionItemSchema(
                    title="Automate PR Review Reminders on Slack",
                    priority=PriorityEnum.HIGH,
                    story_points=2,
                )
            )
        elif any(w in content_lower for w in ("test", "qa", "bug", "defect", "flaky")):
            actions.append(
                AIRetroActionItemSchema(
                    title="Implement Automated Regression Test Suite for CI Pipeline",
                    priority=PriorityEnum.HIGH,
                    story_points=3,
                )
            )
        elif any(w in content_lower for w in ("deploy", "ci", "cd", "release", "migration")):
            actions.append(
                AIRetroActionItemSchema(
                    title="Automate Deployment Verification and Zero-Downtime Rollback",
                    priority=PriorityEnum.HIGH,
                    story_points=3,
                )
            )
        elif any(w in content_lower for w in ("doc", "spec", "requirement", "ready")):
            actions.append(
                AIRetroActionItemSchema(
                    title="Define Card Definition-of-Ready and Technical Spec Templates",
                    priority=PriorityEnum.MEDIUM,
                    story_points=2,
                )
            )
        else:
            clean_title = top_imp.content.strip().rstrip(".").capitalize()
            actions.append(
                AIRetroActionItemSchema(
                    title=f"Resolve Sprint Impediment: {clean_title[:70]}",
                    priority=PriorityEnum.HIGH,
                    story_points=2,
                )
            )
    else:
        if overdue_cards_count > 0:
            actions.append(
                AIRetroActionItemSchema(
                    title="Establish Mid-Sprint WIP Triage to Eliminate Overdue Deliverables",
                    priority=PriorityEnum.HIGH,
                    story_points=2,
                )
            )
        else:
            actions.append(
                AIRetroActionItemSchema(
                    title="Automate PR Review Reminders on Slack",
                    priority=PriorityEnum.HIGH,
                    story_points=2,
                )
            )

    # 2. Action item addressing estimation drift
    est = float(total_estimated_hours)
    logged = float(total_logged_hours)

    if est > 0.0 and logged > est * 1.15:
        # Under-estimating
        actions.append(
            AIRetroActionItemSchema(
                title="Calibrate Story Point Estimation with Planning Poker & Spike Buffers",
                priority=PriorityEnum.HIGH,
                story_points=3,
            )
        )
    elif est > 0.0 and logged < est * 0.85:
        # Over-estimating
        actions.append(
            AIRetroActionItemSchema(
                title="Expand Sprint Backlog Capacity for High-Priority Tech Debt",
                priority=PriorityEnum.MEDIUM,
                story_points=3,
            )
        )
    else:
        # Well-calibrated or nominal
        actions.append(
            AIRetroActionItemSchema(
                title="Document Pomodoro Best Practices in Engineering Handbook",
                priority=PriorityEnum.MEDIUM,
                story_points=1,
            )
        )

    # 3. Action item addressing systemic team velocity
    actions.append(
        AIRetroActionItemSchema(
            title="Conduct Bi-Weekly Automated Dependency & Bottleneck Health Check",
            priority=PriorityEnum.MEDIUM,
            story_points=2,
        )
    )

    return actions[:3]


def synthesize_retro_with_heuristics(
    request: AIRetroAnalysisRequestSchema,
) -> AIRetroAnalysisResponseSchema:
    """Deterministic agile retrospective synthesizer evaluating notes and sprint metrics."""
    morale_score = calculate_morale_score(
        request.retro_items,
        request.completed_cards_count,
        request.overdue_cards_count,
    )

    estimation_summary = calculate_estimation_summary(
        request.total_estimated_hours,
        request.total_logged_hours,
    )

    key_themes = extract_key_themes(
        request.retro_items,
        request.completed_cards_count,
        request.overdue_cards_count,
    )

    suggested_items = generate_suggested_retro_items(
        request.retro_items,
        request.total_estimated_hours,
        request.total_logged_hours,
        request.overdue_cards_count,
    )

    recommended_actions = generate_recommended_action_items(
        request.retro_items,
        request.total_estimated_hours,
        request.total_logged_hours,
        request.overdue_cards_count,
    )

    return AIRetroAnalysisResponseSchema(
        sprint_morale_score=morale_score,
        estimation_accuracy_summary=estimation_summary,
        key_themes=key_themes,
        suggested_retro_items=suggested_items,
        recommended_action_items=recommended_actions,
    )


def _normalize_llm_retro_payload(
    raw_data: dict[str, Any],
    request: AIRetroAnalysisRequestSchema,
) -> AIRetroAnalysisResponseSchema:
    """Normalize and validate raw LLM JSON response, applying deterministic fallbacks when fields are malformed."""
    deterministic = synthesize_retro_with_heuristics(request)

    # 1. Morale score
    raw_score = raw_data.get("sprint_morale_score")
    if isinstance(raw_score, (int, float)) and 0.0 <= float(raw_score) <= 100.0:
        morale_score = float(round(float(raw_score)))
    else:
        morale_score = deterministic.sprint_morale_score

    # 2. Estimation accuracy summary
    raw_summary = raw_data.get("estimation_accuracy_summary")
    if isinstance(raw_summary, str) and raw_summary.strip():
        estimation_summary = raw_summary.strip()
    else:
        estimation_summary = deterministic.estimation_accuracy_summary

    # 3. Key themes
    raw_themes = raw_data.get("key_themes")
    themes: list[str] = []
    if isinstance(raw_themes, list):
        for item in raw_themes:
            text = str(item).strip()
            if text:
                themes.append(text)
    if not themes:
        themes = deterministic.key_themes

    # 4. Suggested retro items
    raw_suggested = raw_data.get("suggested_retro_items")
    suggested: list[AIRetroSuggestedItemSchema] = []
    if isinstance(raw_suggested, list):
        for it in raw_suggested:
            if isinstance(it, dict):
                cat_str = str(it.get("category", "")).upper().strip()
                content = str(it.get("content", "")).strip()
                try:
                    category = RetroCategoryEnum(cat_str)
                except ValueError:
                    category = RetroCategoryEnum.ACTION_ITEMS
                if content:
                    suggested.append(
                        AIRetroSuggestedItemSchema(category=category, content=content)
                    )
    if not suggested:
        suggested = deterministic.suggested_retro_items

    # 5. Recommended action items (ensure exactly 3 items)
    raw_actions = raw_data.get("recommended_action_items")
    actions: list[AIRetroActionItemSchema] = []
    if isinstance(raw_actions, list):
        for it in raw_actions:
            if isinstance(it, dict):
                title = str(it.get("title", "")).strip()
                prio_str = str(it.get("priority", "MEDIUM")).upper().strip()
                try:
                    priority = PriorityEnum(prio_str)
                except ValueError:
                    priority = PriorityEnum.MEDIUM
                raw_sp = it.get("story_points", 2)
                try:
                    sp = max(0, min(100, int(raw_sp)))
                except (ValueError, TypeError):
                    sp = 2
                if title:
                    actions.append(
                        AIRetroActionItemSchema(
                            title=title, priority=priority, story_points=sp
                        )
                    )

    # Pad or trim to ensure exactly 3 action items
    if len(actions) < 3:
        for fallback_act in deterministic.recommended_action_items:
            if len(actions) >= 3:
                break
            if not any(a.title.lower() == fallback_act.title.lower() for a in actions):
                actions.append(fallback_act)

    if len(actions) > 3:
        actions = actions[:3]

    if not actions:
        actions = deterministic.recommended_action_items

    return AIRetroAnalysisResponseSchema(
        sprint_morale_score=morale_score,
        estimation_accuracy_summary=estimation_summary,
        key_themes=themes,
        suggested_retro_items=suggested,
        recommended_action_items=actions,
    )


async def _call_llm_synthesize_retro(
    request: AIRetroAnalysisRequestSchema,
    settings: Settings,
) -> AIRetroAnalysisResponseSchema:
    """Call external OpenAI-compatible chat completions endpoint in JSON mode for Retrospective Synthesis."""
    deterministic_baseline = synthesize_retro_with_heuristics(request)

    system_prompt = (
        "You are the Kinetix Principal AI Agile Coach & Sprint Retrospective Synthesizer. "
        "Given sprint retrospective items (category, content, votes), completed cards count, "
        "overdue cards count, total estimated hours, and total logged hours, synthesize a comprehensive "
        "agile retrospective report. "
        "Compute sprint morale score (0 to 100), explain estimation accuracy comparing logged vs estimated "
        "hours (explicitly stating whether the team is under-estimating, over-estimating, or well-calibrated within ±15%), "
        "extract key themes, suggest retro items, and produce exactly 3 concrete recommended action items "
        "({ title, priority, story_points }) that directly address the highest-voted TO_IMPROVE notes and any estimation drift. "
        "Respond ONLY with a valid JSON object matching this exact schema:\n"
        "{\n"
        '  "sprint_morale_score": number (0 to 100),\n'
        '  "estimation_accuracy_summary": "concise explanation of variance and calibration within ±15%",\n'
        '  "key_themes": ["theme 1", "theme 2"],\n'
        '  "suggested_retro_items": [{"category": "ACTION_ITEMS" | "WENT_WELL" | "TO_IMPROVE" | "KUDOS", "content": "..."}],\n'
        '  "recommended_action_items": [\n'
        '    {"title": "concrete action 1", "priority": "LOW"|"MEDIUM"|"HIGH"|"URGENT", "story_points": number},\n'
        '    {"title": "concrete action 2", "priority": "LOW"|"MEDIUM"|"HIGH"|"URGENT", "story_points": number},\n'
        '    {"title": "concrete action 3", "priority": "LOW"|"MEDIUM"|"HIGH"|"URGENT", "story_points": number}\n'
        "  ]\n"
        "}"
    )

    user_payload = {
        "board_title": request.board_title,
        "retro_items": [item.model_dump(mode="json") for item in request.retro_items],
        "completed_cards_count": request.completed_cards_count,
        "overdue_cards_count": request.overdue_cards_count,
        "total_estimated_hours": request.total_estimated_hours,
        "total_logged_hours": request.total_logged_hours,
        "deterministic_baseline_morale_score": deterministic_baseline.sprint_morale_score,
        "deterministic_baseline_estimation_summary": deterministic_baseline.estimation_accuracy_summary,
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
        raise TypeError("LLM retrospective synthesizer response content is not a JSON object")

    return _normalize_llm_retro_payload(parsed, request)


async def synthesize_retro(
    request: AIRetroAnalysisRequestSchema,
    settings: Settings | None = None,
) -> AIRetroAnalysisResponseSchema:
    """
    Orchestrate Dual-Mode AI Sprint Retrospective Synthesis:
    - Uses live LLM when a valid `LLM_API_KEY` is configured.
    - Automatically falls back to the Deterministic Agile Retrospective Synthesizer when
      `LLM_API_KEY` is missing/placeholder or if the upstream LLM request fails.
    """
    active_settings = settings or get_settings()
    if active_settings.has_valid_llm_key:
        try:
            return await _call_llm_synthesize_retro(request, active_settings)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "External LLM retrospective synthesizer call failed (%s); falling back to deterministic synthesizer.",
                exc,
            )

    return synthesize_retro_with_heuristics(request)
