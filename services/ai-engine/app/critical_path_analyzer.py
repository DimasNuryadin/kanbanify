"""
AI Critical Path & Dependency Bottleneck Analyzer (`POST /internal/v1/analyze-dependencies`).
Evaluates visual graph dependencies (`BoardDependencyGraphSchema`) and produces an agile operations research
critical path report (`AICriticalPathResponseSchema`) including `risk_summary`, `critical_path_titles`,
`top_blocker_cards`, and `unblocking_recommendations`.

Implements Dual-Mode Intelligence:
1. Live LLM Orchestration via OpenAI-compatible JSON mode (`httpx`) when a valid `LLM_API_KEY` is configured.
2. Deterministic Graph Critical Path Analyzer (Operations Research Heuristics) when `LLM_API_KEY` is missing,
   a placeholder, or the upstream LLM request fails.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.contracts import (
    AICriticalPathRequestSchema,
    AICriticalPathResponseSchema,
    CriticalPathBlockerCardSchema,
    DependencyNodeSchema,
    PriorityEnum,
)

logger = logging.getLogger("kinetix.ai_engine.critical_path_analyzer")


def analyze_critical_path_with_heuristics(
    request: AICriticalPathRequestSchema,
) -> AICriticalPathResponseSchema:
    """
    Deterministic Graph Operations Research & Agile Dependency Analyzer.
    Analyzes `request.graph` to extract:
    - `critical_path_titles`: ordered card titles on the critical path
    - `top_blocker_cards`: uncompleted blocker cards sorted by out-degree with detailed bottleneck reasons
    - `risk_summary`: synthesis of total blocked cards, critical path story points, circular dependency risk
    - `unblocking_recommendations`: 3-5 actionable graph-level recommendations
    """
    board_title = request.board_title.strip()
    graph = request.graph
    nodes = graph.nodes
    edges = graph.edges

    nodes_by_id: dict[str, DependencyNodeSchema] = {node.card_id: node for node in nodes}

    # 1. Map critical_path_card_ids to human-readable titles
    critical_path_titles: list[str] = []
    critical_ids: list[str] = list(graph.critical_path_card_ids)

    # If critical_path_card_ids is empty, look for nodes with is_on_critical_path == True
    if not critical_ids:
        critical_ids = [node.card_id for node in nodes if node.is_on_critical_path]

    for cid in critical_ids:
        if cid in nodes_by_id:
            critical_path_titles.append(nodes_by_id[cid].title)
        else:
            critical_path_titles.append(cid)

    # Critical path nodes and total story points
    critical_nodes = [nodes_by_id[cid] for cid in critical_ids if cid in nodes_by_id]
    total_critical_sp = sum(node.story_points or 0 for node in critical_nodes)

    # 2. Identify top_blocker_cards
    # Outgoing edges mapping: from_card_id -> list of downstream dependent edges
    outgoing_edges: dict[str, list[Any]] = {}
    for edge in edges:
        outgoing_edges.setdefault(edge.from_card_id, []).append(edge)

    total_blocked = graph.total_blocked_cards
    has_circular = graph.has_circular_dependency
    cp_count = len(critical_path_titles)

    # Rank uncompleted nodes with active blocks (highest out-degree / downstream dependencies)
    blocker_candidates: list[tuple[DependencyNodeSchema, int, list[str]]] = []
    if total_blocked > 0:
        for node in nodes:
            if node.is_completed:
                continue

            downstream = outgoing_edges.get(node.card_id, [])
            unresolved_downstream = [e for e in downstream if not e.is_resolved]
            effective_blocks = max(node.out_degree, len(unresolved_downstream))

            if effective_blocks > 0:
                downstream_titles = [
                    nodes_by_id[e.to_card_id].title
                    for e in unresolved_downstream
                    if e.to_card_id in nodes_by_id
                ]
                blocker_candidates.append((node, effective_blocks, downstream_titles))

    # Sort blocker candidates:
    # 1. effective_blocks descending
    # 2. is_on_critical_path descending
    # 3. story_points descending
    blocker_candidates.sort(
        key=lambda item: (
            item[1],
            item[0].is_on_critical_path or item[0].card_id in critical_ids,
            item[0].story_points or 0,
        ),
        reverse=True,
    )

    top_blocker_cards: list[CriticalPathBlockerCardSchema] = []
    for node, blocks_count, downstream_titles in blocker_candidates[:5]:
        is_critical = node.is_on_critical_path or node.card_id in critical_ids

        # Build detailed contextual reason
        if downstream_titles:
            if len(downstream_titles) == 1:
                target_str = f"'{downstream_titles[0]}'"
            elif len(downstream_titles) <= 3:
                target_str = ", ".join(f"'{t}'" for t in downstream_titles)
            else:
                target_str = (
                    f"'{downstream_titles[0]}', '{downstream_titles[1]}', "
                    f"and {len(downstream_titles) - 2} other tasks"
                )
            blocks_clause = (
                f"Blocks {blocks_count} downstream task{'s' if blocks_count != 1 else ''} ({target_str})"
            )
        else:
            blocks_clause = f"Blocks {blocks_count} downstream task{'s' if blocks_count != 1 else ''}"

        if is_critical:
            impact_clause = "Sits directly on the critical path, threatening project release milestone."
        else:
            impact_clause = "High dependency fan-out creates a significant workflow pipeline bottleneck."

        if node.story_points and node.story_points >= 5:
            complexity_clause = f" High complexity ({node.story_points} story points)."
        elif node.priority in (PriorityEnum.URGENT, PriorityEnum.HIGH):
            complexity_clause = f" {node.priority.value.capitalize()} priority card."
        else:
            complexity_clause = ""

        reason = f"{blocks_clause}. {impact_clause}{complexity_clause}".strip()

        top_blocker_cards.append(
            CriticalPathBlockerCardSchema(
                card_id=node.card_id,
                title=node.title,
                blocks_count=blocks_count,
                reason=reason,
            )
        )

    # 3. Synthesize clear risk_summary
    card_verb_clause = "1 card sits" if cp_count == 1 else f"{cp_count} cards sit"
    sp_clause = f" ({total_critical_sp} story points)" if total_critical_sp > 0 else ""

    if has_circular:
        risk_summary = (
            f"CRITICAL: Circular dependency cycle detected on '{board_title}' creating an execution deadlock. "
            f"{card_verb_clause} on the critical path{sp_clause} "
            f"with {total_blocked} total blocked card{'s' if total_blocked != 1 else ''}. Immediate graph resolution required."
        )
    elif top_blocker_cards:
        primary_blocker = top_blocker_cards[0]
        severity = "High" if total_critical_sp >= 8 or primary_blocker.blocks_count >= 3 else "Moderate"
        risk_summary = (
            f"{card_verb_clause} on the critical path{sp_clause} "
            f"blocking {total_blocked} total downstream task{'s' if total_blocked != 1 else ''}. "
            f"Delayed release risk: {severity}. Primary bottleneck: '{primary_blocker.title}'."
        )
    elif total_blocked > 0:
        risk_summary = (
            f"{card_verb_clause} on the critical path{sp_clause} with {total_blocked} total blocked card{'s' if total_blocked != 1 else ''}. "
            f"Delayed release risk: Moderate."
        )
    elif cp_count > 0:
        risk_summary = (
            f"{card_verb_clause} on the critical path{sp_clause}. "
            f"No active blockers or circular dependencies detected. Delayed release risk: Low."
        )
    else:
        risk_summary = (
            f"No critical path bottlenecks or circular dependencies detected on '{board_title}'. "
            f"All {len(nodes)} cards are independent or resolved."
        )

    # 4. Generate 3 to 5 concrete unblocking recommendations
    recommendations: list[str] = []

    # Recommendation A: Circular dependency resolution if present
    if has_circular:
        recommendations.append(
            "Resolve the circular dependency cycle immediately by decoupling mutual blockers or reversing inverted dependencies."
        )

    # Recommendation B: Prioritize primary blocker
    if top_blocker_cards:
        primary = top_blocker_cards[0]
        sp_text = f" ({nodes_by_id[primary.card_id].story_points} SP)" if primary.card_id in nodes_by_id and nodes_by_id[primary.card_id].story_points else ""
        recommendations.append(
            f"Prioritize '{primary.title}'{sp_text} immediately to unblock {primary.blocks_count} downstream task{'s' if primary.blocks_count != 1 else ''}."
        )

    # Recommendation C: Secondary blocker if exists
    if len(top_blocker_cards) > 1:
        secondary = top_blocker_cards[1]
        recommendations.append(
            f"Assign an expedited pairing or review cycle to '{secondary.title}' to clear {secondary.blocks_count} blocked dependencies."
        )

    # Recommendation D: High-complexity critical path card splitting
    high_sp_candidates = [
        node for node in critical_nodes
        if not node.is_completed and (node.story_points or 0) >= 5
    ]
    if high_sp_candidates:
        heaviest = max(high_sp_candidates, key=lambda n: n.story_points or 0)
        recommendations.append(
            f"Split high-story-point critical path card '{heaviest.title}' ({heaviest.story_points} story points) into smaller parallel subtasks to accelerate velocity."
        )

    # Recommendation E: Unassigned critical path card
    unassigned_critical = [
        node for node in critical_nodes
        if not node.is_completed and not node.assignee_initials
    ]
    if unassigned_critical:
        unassigned = unassigned_critical[0]
        recommendations.append(
            f"Assign a dedicated owner to critical path card '{unassigned.title}' to prevent scheduling delays."
        )

    # Recommendation F: Blocked critical path node swarming
    blocked_critical = [
        node for node in critical_nodes
        if not node.is_completed and node.in_degree > 0
    ]
    if blocked_critical:
        blocked_card = blocked_critical[0]
        recommendations.append(
            f"Swarm team efforts to clear prerequisite blockers for '{blocked_card.title}', which directly blocks critical path completion."
        )

    # Guarantee 3 to 5 recommendations with contextual best practices
    if len(recommendations) < 3 and critical_path_titles:
        recommendations.append(
            f"Track daily standup progress on critical path anchor '{critical_path_titles[0]}' to prevent sprint schedule slippage."
        )
    if len(recommendations) < 3:
        recommendations.append(
            "Enforce strict Work-In-Progress (WIP) limits across active development columns to prevent multitasking friction."
        )
    if len(recommendations) < 3:
        recommendations.append(
            "Define explicit acceptance criteria and checklist items for all critical path cards prior to starting implementation."
        )
    if len(recommendations) < 3:
        recommendations.append(
            "Decouple downstream tasks where interface contracts or mock schemas can be established ahead of implementation."
        )

    # Deduplicate while preserving order and limit to 5
    seen_recs: set[str] = set()
    deduped_recs: list[str] = []
    for rec in recommendations:
        cleaned = rec.strip()
        if cleaned and cleaned not in seen_recs:
            seen_recs.add(cleaned)
            deduped_recs.append(cleaned)
        if len(deduped_recs) == 5:
            break

    return AICriticalPathResponseSchema(
        risk_summary=risk_summary,
        critical_path_titles=critical_path_titles,
        top_blocker_cards=top_blocker_cards,
        unblocking_recommendations=deduped_recs,
    )


def _normalize_llm_critical_path_payload(
    raw_data: dict[str, Any],
    fallback_request: AICriticalPathRequestSchema,
) -> AICriticalPathResponseSchema:
    """
    Validate, sanitize, and normalize raw LLM JSON output into `AICriticalPathResponseSchema`.
    Guarantees conformance with `packages/contracts/schemas.py`.
    """
    deterministic = analyze_critical_path_with_heuristics(fallback_request)

    # 1. Risk summary
    raw_summary = str(raw_data.get("risk_summary") or "").strip()
    risk_summary = raw_summary if raw_summary else deterministic.risk_summary

    # 2. Critical path titles
    raw_titles = raw_data.get("critical_path_titles")
    critical_path_titles: list[str] = []
    if isinstance(raw_titles, list):
        for item in raw_titles:
            t = str(item).strip()
            if t:
                critical_path_titles.append(t)
    if not critical_path_titles:
        critical_path_titles = deterministic.critical_path_titles

    # 3. Top blocker cards
    raw_blockers = raw_data.get("top_blocker_cards")
    top_blocker_cards: list[CriticalPathBlockerCardSchema] = []
    if isinstance(raw_blockers, list):
        for b in raw_blockers:
            if not isinstance(b, dict):
                continue
            card_id = str(b.get("card_id") or "").strip()
            title = str(b.get("title") or "").strip()
            reason = str(b.get("reason") or "").strip()
            try:
                blocks_count = max(0, int(b.get("blocks_count", 0)))
            except (ValueError, TypeError):
                blocks_count = 0

            if card_id and title and reason:
                top_blocker_cards.append(
                    CriticalPathBlockerCardSchema(
                        card_id=card_id,
                        title=title,
                        blocks_count=blocks_count,
                        reason=reason,
                    )
                )
    if not top_blocker_cards and deterministic.top_blocker_cards:
        top_blocker_cards = deterministic.top_blocker_cards

    # 4. Unblocking recommendations (guaranteed 3 to 5)
    raw_recs = raw_data.get("unblocking_recommendations")
    recs: list[str] = []
    if isinstance(raw_recs, list):
        for item in raw_recs:
            r = str(item).strip()
            if r and r not in recs:
                recs.append(r)

    # Augment if fewer than 3
    if len(recs) < 3:
        for d_rec in deterministic.unblocking_recommendations:
            if d_rec not in recs:
                recs.append(d_rec)
            if len(recs) >= 3:
                break

    # Cap to max 5
    recs = recs[:5]

    return AICriticalPathResponseSchema(
        risk_summary=risk_summary,
        critical_path_titles=critical_path_titles,
        top_blocker_cards=top_blocker_cards,
        unblocking_recommendations=recs,
    )


async def _call_llm_analyze_critical_path(
    request: AICriticalPathRequestSchema,
    settings: Settings,
) -> AICriticalPathResponseSchema:
    """Call external OpenAI-compatible chat completions endpoint in JSON mode for Critical Path Analysis."""
    deterministic_baseline = analyze_critical_path_with_heuristics(request)

    system_prompt = (
        "You are the Kinetix Principal AI Operations Research & Agile Graph Engineer. "
        "Given a Kanban board title and a dependency graph (`BoardDependencyGraphSchema`), "
        "analyze the critical path, identify bottleneck blocker cards, and formulate concrete unblocking strategies.\n\n"
        "Requirements:\n"
        "1. Map `graph.critical_path_card_ids` to their human-readable card titles in `critical_path_titles` in sequence.\n"
        "2. Identify `top_blocker_cards` by ranking uncompleted nodes with highest out-degree (cards blocking the greatest number of downstream cards). "
        "For each blocker card, provide `card_id`, `title`, `blocks_count`, and a clear `reason` explaining why it is a bottleneck.\n"
        "3. Synthesize a clear `risk_summary` highlighting total blocked cards, total story points on the critical path, and circular dependency risk.\n"
        "4. Generate 3 to 5 concrete `unblocking_recommendations` (e.g. 'Prioritize [Blocker Title] immediately to unblock X downstream tasks', "
        "'Split high-story-point critical path card [Title] into parallel subtasks').\n\n"
        "Respond ONLY with a valid JSON object matching this exact schema:\n"
        "{\n"
        '  "risk_summary": "concise risk summary referencing critical path story points and blockers",\n'
        '  "critical_path_titles": ["Title 1", "Title 2"],\n'
        '  "top_blocker_cards": [\n'
        "    {\n"
        '      "card_id": "uuid",\n'
        '      "title": "card title",\n'
        '      "blocks_count": 3,\n'
        '      "reason": "explanation of bottleneck impact"\n'
        "    }\n"
        "  ],\n"
        '  "unblocking_recommendations": [\n'
        '    "concrete recommendation 1",\n'
        '    "concrete recommendation 2",\n'
        '    "concrete recommendation 3"\n'
        "  ]\n"
        "}"
    )

    user_payload = {
        "board_title": request.board_title,
        "graph": request.graph.model_dump(mode="json"),
        "deterministic_baseline": deterministic_baseline.model_dump(mode="json"),
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
        raise TypeError("LLM critical path analyzer response content is not a JSON object")

    return _normalize_llm_critical_path_payload(parsed, request)


async def analyze_dependencies(
    request: AICriticalPathRequestSchema,
    settings: Settings | None = None,
) -> AICriticalPathResponseSchema:
    """
    Orchestrate Dual-Mode AI Critical Path & Dependency Bottleneck Analysis:
    - Uses live LLM when a valid `LLM_API_KEY` is configured.
    - Automatically falls back to the Deterministic Graph Operations Research Analyzer when
      `LLM_API_KEY` is missing/placeholder or if the upstream LLM request fails.
    """
    active_settings = settings or get_settings()
    if active_settings.has_valid_llm_key:
        try:
            return await _call_llm_analyze_critical_path(request, active_settings)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "External LLM critical path analyzer call failed (%s); falling back to deterministic graph analyzer.",
                exc,
            )

    return analyze_critical_path_with_heuristics(request)
