"""
AI Smart Slack/Discord Notification Formatter (`POST /internal/v1/format-notification`).
Dual-Mode Intelligence ChatOps Formatter:
1. Live LLM Orchestration via OpenAI-compatible JSON mode when a valid `LLM_API_KEY` is configured.
2. Deterministic ChatOps Digest Builder (Zero-Config Ready) when `LLM_API_KEY` is missing,
   a placeholder, or the upstream LLM request fails.

Synthesizes:
- Crisp human-friendly summary text (e.g., '🚀 Kanbanify Daily Digest for [Board Title]: 4 cards moved, 2 automations executed...')
- Valid Slack Block Kit payload (`slack_block_kit_payload` with header, summary section, breakdown/highlights, and footer context)
- Valid Discord Embed payload (`discord_embed_payload` with embeds array containing title, description, color code, fields, and footer)
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.contracts import (
    ActivityActionTypeEnum,
    ActivitySchema,
    AISummaryNotificationRequestSchema,
    AISummaryNotificationResponseSchema,
)

logger = logging.getLogger("kinetix.ai_engine.notification_formatter")


def count_activities(activities: list[ActivitySchema]) -> dict[str, int]:
    """
    Count occurrences of key Kanban lifecycle activities:
    - cards created
    - cards moved
    - cards completed (checklist completed or moved to Done/Completed column)
    - comments added
    - automations triggered (rule executions or automated activities)
    - cards archived
    - members assigned
    """
    counts = {
        "cards_created": 0,
        "cards_moved": 0,
        "cards_completed": 0,
        "comments_added": 0,
        "automations_triggered": 0,
        "cards_archived": 0,
        "members_assigned": 0,
    }

    for act in activities:
        action = (
            act.action_type.value
            if hasattr(act.action_type, "value")
            else str(act.action_type)
        )
        desc = (act.description or "").lower()
        details = getattr(act, "details", {}) or {}
        target_col = str(
            details.get("target_column")
            or details.get("target_column_title")
            or ""
        ).lower()

        is_completed = (
            "done" in target_col
            or "complete" in target_col
            or "shipped" in target_col
            or "closed" in target_col
            or "moved to 'done'" in desc
            or "to 'done'" in desc
            or "to done" in desc
            or "marked complete" in desc
            or "marked due date as complete" in desc
        )

        if action == ActivityActionTypeEnum.CARD_CREATED.value:
            counts["cards_created"] += 1
        elif action == ActivityActionTypeEnum.CARD_MOVED.value:
            counts["cards_moved"] += 1
            if is_completed:
                counts["cards_completed"] += 1
        elif action == ActivityActionTypeEnum.CHECKLIST_COMPLETED.value:
            counts["cards_completed"] += 1
        elif action == ActivityActionTypeEnum.COMMENT_ADDED.value:
            counts["comments_added"] += 1
        elif action == ActivityActionTypeEnum.AUTOMATION_TRIGGERED.value:
            counts["automations_triggered"] += 1
        elif action == ActivityActionTypeEnum.CARD_ARCHIVED.value:
            counts["cards_archived"] += 1
        elif action == ActivityActionTypeEnum.MEMBER_ASSIGNED.value:
            counts["members_assigned"] += 1

        # Check if activity is flagged automated but wasn't AUTOMATION_TRIGGERED
        if (
            act.is_automated
            and action != ActivityActionTypeEnum.AUTOMATION_TRIGGERED.value
        ):
            counts["automations_triggered"] += 1

    return counts


def format_activity_markdown(act: ActivitySchema) -> str:
    """Format an individual activity into Slack-compatible mrkdwn."""
    actor = act.actor_name or "User"
    details = getattr(act, "details", {}) or {}
    action = (
        act.action_type.value
        if hasattr(act.action_type, "value")
        else str(act.action_type)
    )
    card_title = details.get("card_title")
    target_col = details.get("target_column") or details.get("target_column_title")
    rule_name = details.get("rule_name")

    if action == "CARD_MOVED":
        if card_title and target_col:
            return f"*{actor}* moved *{card_title}* to *{target_col}*"
        if card_title:
            return f"*{actor}* moved *{card_title}*"
    elif action == "CARD_CREATED":
        if card_title:
            return f"*{actor}* created *{card_title}*"
    elif action == "AUTOMATION_TRIGGERED":
        if rule_name and card_title:
            return f"*Butler Automation* triggered *{rule_name}* on *{card_title}*"
        if rule_name:
            return f"*Butler Automation* triggered *{rule_name}*"
    elif action == "COMMENT_ADDED" and card_title:
        return f"*{actor}* commented on *{card_title}*"
    elif action == "CHECKLIST_COMPLETED" and card_title:
        return f"*{actor}* completed checklist on *{card_title}*"
    elif action == "CARD_ARCHIVED" and card_title:
        return f"*{actor}* archived *{card_title}*"
    elif action == "MEMBER_ASSIGNED" and card_title:
        return f"*{actor}* was assigned to *{card_title}*"

    # Fallback to existing description if available
    if act.description and act.description.strip():
        desc = act.description.strip()
        if not desc.startswith("*") and actor in desc:
            # Emphasize actor name in description
            desc = desc.replace(actor, f"*{actor}*", 1)
        return desc

    return f"*{actor}* performed *{action}*"


def format_activity_discord_field(act: ActivitySchema) -> tuple[str, str]:
    """Format an individual activity into Discord field (name, value)."""
    actor = act.actor_name or "User"
    details = getattr(act, "details", {}) or {}
    action = (
        act.action_type.value
        if hasattr(act.action_type, "value")
        else str(act.action_type)
    )
    card_title = details.get("card_title")
    target_col = details.get("target_column") or details.get("target_column_title")
    rule_name = details.get("rule_name")

    if action == "CARD_MOVED":
        name = "Card Moved"
        if card_title and target_col:
            val = f"**{card_title}** moved to **{target_col}** by {actor}"
        elif card_title:
            val = f"**{card_title}** moved by {actor}"
        else:
            val = act.description or f"Card moved by {actor}"
        return name, val

    if action == "CARD_CREATED":
        name = "Card Created"
        val = (
            f"**{card_title}** created by {actor}"
            if card_title
            else (act.description or f"Card created by {actor}")
        )
        return name, val

    if action == "AUTOMATION_TRIGGERED":
        name = "Automation Triggered"
        if rule_name and card_title:
            val = f"**{rule_name}** executed on card **{card_title}**"
        elif rule_name:
            val = f"**{rule_name}** executed"
        else:
            val = act.description or "Butler automation executed"
        return name, val

    if action == "COMMENT_ADDED":
        name = "Comment Added"
        val = (
            f"**{actor}** commented on **{card_title}**"
            if card_title
            else (act.description or f"Comment added by {actor}")
        )
        return name, val

    if action == "CHECKLIST_COMPLETED":
        name = "Checklist Completed"
        val = (
            f"Checklist completed on **{card_title}** by {actor}"
            if card_title
            else (act.description or f"Checklist completed by {actor}")
        )
        return name, val

    name = action.replace("_", " ").title()
    val = act.description or f"{actor} performed {action}"
    return name, val


def synthesize_summary_text(
    board_title: str,
    activities: list[ActivitySchema],
    counts: dict[str, int],
) -> str:
    """Synthesize a crisp, human-friendly summary text."""
    if not activities:
        return f"🚀 Kanbanify Daily Digest for {board_title}: No recent activities recorded."

    parts: list[str] = []
    if counts["cards_moved"] > 0:
        parts.append(
            f"{counts['cards_moved']} card{'s' if counts['cards_moved'] > 1 else ''} moved"
        )
    if counts["cards_created"] > 0:
        parts.append(
            f"{counts['cards_created']} card{'s' if counts['cards_created'] > 1 else ''} created"
        )
    if counts["cards_completed"] > 0:
        parts.append(
            f"{counts['cards_completed']} card{'s' if counts['cards_completed'] > 1 else ''} completed"
        )
    if counts["automations_triggered"] > 0:
        parts.append(
            f"{counts['automations_triggered']} automation{'s' if counts['automations_triggered'] > 1 else ''} executed"
        )
    if counts["comments_added"] > 0:
        parts.append(
            f"{counts['comments_added']} comment{'s' if counts['comments_added'] > 1 else ''} added"
        )
    if counts["cards_archived"] > 0:
        parts.append(
            f"{counts['cards_archived']} card{'s' if counts['cards_archived'] > 1 else ''} archived"
        )
    if counts["members_assigned"] > 0:
        parts.append(
            f"{counts['members_assigned']} member{'s' if counts['members_assigned'] > 1 else ''} assigned"
        )

    if not parts:
        parts.append(
            f"{len(activities)} event{'s' if len(activities) > 1 else ''} recorded"
        )

    counts_str = ", ".join(parts)
    return f"🚀 Kanbanify Daily Digest for {board_title}: {counts_str}."


def build_slack_block_kit_payload(
    board_title: str,
    summary_text: str,
    activities: list[ActivitySchema],
    counts: dict[str, int],
    timestamp_str: str,
) -> dict[str, Any]:
    """Construct a valid, rich Slack Block Kit payload."""
    header_text = f"📋 Kanbanify Board Activity: {board_title}"
    if len(header_text) > 150:
        header_text = header_text[:147] + "..."

    blocks: list[dict[str, Any]] = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": header_text,
                "emoji": True,
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": summary_text,
            },
        },
    ]

    # Metrics Breakdown Section (Fields)
    field_elements: list[dict[str, Any]] = []
    if counts["cards_moved"] > 0:
        field_elements.append(
            {"type": "mrkdwn", "text": f"*Cards Moved:*\n{counts['cards_moved']}"}
        )
    if counts["cards_created"] > 0:
        field_elements.append(
            {"type": "mrkdwn", "text": f"*Cards Created:*\n{counts['cards_created']}"}
        )
    if counts["cards_completed"] > 0:
        field_elements.append(
            {"type": "mrkdwn", "text": f"*Completed:*\n{counts['cards_completed']}"}
        )
    if counts["automations_triggered"] > 0:
        field_elements.append(
            {
                "type": "mrkdwn",
                "text": f"*Automations:*\n{counts['automations_triggered']}",
            }
        )
    if counts["comments_added"] > 0:
        field_elements.append(
            {"type": "mrkdwn", "text": f"*Comments:*\n{counts['comments_added']}"}
        )

    if field_elements:
        blocks.append({
            "type": "section",
            "fields": field_elements[:10],
        })

    # Recent Activity Highlights
    if activities:
        highlights_lines: list[str] = []
        for act in activities[:5]:
            line = format_activity_markdown(act)
            if line:
                highlights_lines.append(f"• {line}")
        if highlights_lines:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Recent Highlights:*\n" + "\n".join(highlights_lines),
                },
            })

    # Footer Context Block
    blocks.append({
        "type": "context",
        "elements": [
            {
                "type": "mrkdwn",
                "text": f"⚡ Dispatched via Kanbanify Webhook Dispatcher | {timestamp_str}",
            }
        ],
    })

    return {"blocks": blocks}


def build_discord_embed_payload(
    board_title: str,
    summary_text: str,
    activities: list[ActivitySchema],
    counts: dict[str, int],
    timestamp_str: str,
) -> dict[str, Any]:
    """Construct a valid, rich Discord Embed payload."""
    fields: list[dict[str, Any]] = []

    # Activity Breakdown Field
    breakdown_lines: list[str] = []
    if counts["cards_moved"] > 0:
        breakdown_lines.append(f"• Cards Moved: {counts['cards_moved']}")
    if counts["cards_created"] > 0:
        breakdown_lines.append(f"• Cards Created: {counts['cards_created']}")
    if counts["cards_completed"] > 0:
        breakdown_lines.append(f"• Cards Completed: {counts['cards_completed']}")
    if counts["automations_triggered"] > 0:
        breakdown_lines.append(
            f"• Butler Automations: {counts['automations_triggered']}"
        )
    if counts["comments_added"] > 0:
        breakdown_lines.append(f"• Comments Added: {counts['comments_added']}")
    if counts["cards_archived"] > 0:
        breakdown_lines.append(f"• Cards Archived: {counts['cards_archived']}")
    if counts["members_assigned"] > 0:
        breakdown_lines.append(f"• Members Assigned: {counts['members_assigned']}")

    if breakdown_lines:
        fields.append({
            "name": "Activity Breakdown",
            "value": "\n".join(breakdown_lines),
            "inline": False,
        })

    # Individual Activity Highlight Fields
    for act in activities[:6]:
        act_name, act_val = format_activity_discord_field(act)
        fields.append({
            "name": act_name,
            "value": act_val,
            "inline": False,
        })

    # Color code: Green (65280) if cards completed, Indigo (6514417) standard, Purple (10181046) if automations
    if counts["cards_completed"] > 0:
        color = 65280
    elif counts["automations_triggered"] > 0:
        color = 10181046
    else:
        color = 6514417

    embed: dict[str, Any] = {
        "title": f"📋 Board Update: {board_title}",
        "description": f"Recent activity summary on board **{board_title}**:\n{summary_text}",
        "color": color,
        "fields": fields,
        "footer": {
            "text": "Kanbanify Webhook Dispatcher",
        },
        "timestamp": timestamp_str,
    }

    return {
        "username": "Kanbanify Bot",
        "avatar_url": "https://kinetix.internal/icons/bot-avatar.png",
        "embeds": [embed],
    }


def format_notification_with_heuristics(
    request: AISummaryNotificationRequestSchema,
) -> AISummaryNotificationResponseSchema:
    """Deterministic ChatOps Digest Builder."""
    board_title = request.board_title.strip()
    activities = request.recent_activities
    counts = count_activities(activities)

    timestamp_str = (
        datetime.now(UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )

    summary_text = synthesize_summary_text(board_title, activities, counts)

    slack_payload = build_slack_block_kit_payload(
        board_title=board_title,
        summary_text=summary_text,
        activities=activities,
        counts=counts,
        timestamp_str=timestamp_str,
    )

    discord_payload = build_discord_embed_payload(
        board_title=board_title,
        summary_text=summary_text,
        activities=activities,
        counts=counts,
        timestamp_str=timestamp_str,
    )

    return AISummaryNotificationResponseSchema(
        slack_block_kit_payload=slack_payload,
        discord_embed_payload=discord_payload,
        summary_text=summary_text,
    )


def _normalize_llm_response(
    raw_data: dict[str, Any],
    fallback: AISummaryNotificationResponseSchema,
) -> AISummaryNotificationResponseSchema:
    """Normalize and validate LLM output against the response contract."""
    raw_summary = str(raw_data.get("summary_text") or "").strip()
    summary_text = raw_summary if raw_summary else fallback.summary_text

    raw_slack = raw_data.get("slack_block_kit_payload")
    if (
        isinstance(raw_slack, dict)
        and "blocks" in raw_slack
        and isinstance(raw_slack["blocks"], list)
        and len(raw_slack["blocks"]) > 0
    ):
        slack_payload = raw_slack
    else:
        slack_payload = fallback.slack_block_kit_payload

    raw_discord = raw_data.get("discord_embed_payload")
    if (
        isinstance(raw_discord, dict)
        and "embeds" in raw_discord
        and isinstance(raw_discord["embeds"], list)
        and len(raw_discord["embeds"]) > 0
    ):
        discord_payload = raw_discord
    else:
        discord_payload = fallback.discord_embed_payload

    return AISummaryNotificationResponseSchema(
        slack_block_kit_payload=slack_payload,
        discord_embed_payload=discord_payload,
        summary_text=summary_text,
    )


async def _call_llm_format_notification(
    request: AISummaryNotificationRequestSchema,
    settings: Settings,
) -> AISummaryNotificationResponseSchema:
    """Call external OpenAI-compatible chat completions endpoint in JSON mode."""
    deterministic = format_notification_with_heuristics(request)

    system_prompt = (
        "You are the Kanbanify Principal ChatOps Notification Formatter. "
        "Given a Kanban board title and recent board activities, synthesize a crisp, human-friendly "
        "digest summary text, Slack Block Kit payload, and Discord Embed payload. "
        "The summary_text should follow the format: '🚀 Kanbanify Daily Digest for [Board Title]: 4 cards moved, 2 automations executed...'. "
        "The slack_block_kit_payload must contain a 'blocks' array with header, summary section, breakdown/highlights, and context footer. "
        "The discord_embed_payload must contain an 'embeds' array with title, description, color, fields, and footer. "
        "Respond ONLY with a valid JSON object matching this schema:\n"
        "{\n"
        '  "summary_text": "string",\n'
        '  "slack_block_kit_payload": {"blocks": [...]},\n'
        '  "discord_embed_payload": {"embeds": [...]}\n'
        "}"
    )

    activities_dump = [
        act.model_dump(mode="json") for act in request.recent_activities
    ]

    user_payload = {
        "board_title": request.board_title,
        "recent_activities": activities_dump,
        "deterministic_baseline_summary": deterministic.summary_text,
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
        raise TypeError("LLM notification formatter response content is not a JSON object")

    return _normalize_llm_response(parsed, deterministic)


async def format_notification(
    request: AISummaryNotificationRequestSchema,
    settings: Settings | None = None,
) -> AISummaryNotificationResponseSchema:
    """
    Orchestrate Dual-Mode AI Smart Slack/Discord Notification Formatter:
    - Uses live LLM when a valid `LLM_API_KEY` is configured.
    - Automatically falls back to the Deterministic ChatOps Digest Builder when
      `LLM_API_KEY` is missing/placeholder or if the upstream LLM request fails.
    """
    active_settings = settings or get_settings()
    if active_settings.has_valid_llm_key:
        try:
            return await _call_llm_format_notification(request, active_settings)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "External LLM notification formatter call failed (%s); falling back to deterministic builder.",
                exc,
            )

    return format_notification_with_heuristics(request)
