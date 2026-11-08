"""
Natural Language Butler Rule Parser & Bilingual Automation Compiler (`POST /internal/v1/parse-automation`).
Translates freeform plain text instructions (Indonesian & English) into structured Butler automation rules.

Implements Dual-Mode Intelligence:
1. Live LLM Orchestration via OpenAI-compatible JSON mode (`httpx`) when a valid `LLM_API_KEY` is configured.
2. Deterministic Bilingual Rule Compiler fallback (Zero-Config Ready) supporting Indonesian and English
   natural language prompts with automated context mapping for columns, members, and labels.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.contracts import (
    AIParseAutomationColumnContextSchema,
    AIParseAutomationLabelContextSchema,
    AIParseAutomationMemberContextSchema,
    AIParseAutomationRequestSchema,
    AIParseAutomationResponseSchema,
    AutomationActionSchema,
    AutomationActionTypeEnum,
    AutomationTriggerSchema,
    AutomationTriggerTypeEnum,
    PriorityEnum,
)

logger = logging.getLogger("kinetix.ai_engine.rule_parser")

# ============================================================================
# BILINGUAL SYNONYM & KEYWORD DICTIONARIES (Indonesian & English)
# ============================================================================

COLOR_SYNONYMS: dict[str, str] = {
    # Indonesian
    "hijau": "green",
    "kuning": "yellow",
    "oranye": "orange",
    "jingga": "orange",
    "merah": "red",
    "ungu": "purple",
    "biru": "blue",
    "biru langit": "sky",
    "langit": "sky",
    "merah muda": "pink",
    "merah jambu": "pink",
    "hitam": "black",
    # English & Universal
    "green": "green",
    "yellow": "yellow",
    "orange": "orange",
    "red": "red",
    "purple": "purple",
    "blue": "blue",
    "sky": "sky",
    "lime": "lime",
    "pink": "pink",
    "black": "black",
}

PRIORITY_KEYWORDS: dict[str, PriorityEnum] = {
    # URGENT
    "urgent": PriorityEnum.URGENT,
    "darurat": PriorityEnum.URGENT,
    "kritis": PriorityEnum.URGENT,
    "critical": PriorityEnum.URGENT,
    "blocker": PriorityEnum.URGENT,
    "p0": PriorityEnum.URGENT,
    # HIGH
    "high": PriorityEnum.HIGH,
    "tinggi": PriorityEnum.HIGH,
    "penting": PriorityEnum.HIGH,
    "p1": PriorityEnum.HIGH,
    # MEDIUM
    "medium": PriorityEnum.MEDIUM,
    "sedang": PriorityEnum.MEDIUM,
    "normal": PriorityEnum.MEDIUM,
    "menengah": PriorityEnum.MEDIUM,
    "p2": PriorityEnum.MEDIUM,
    # LOW
    "low": PriorityEnum.LOW,
    "rendah": PriorityEnum.LOW,
    "minor": PriorityEnum.LOW,
    "p3": PriorityEnum.LOW,
}


# ============================================================================
# CONTEXT MAPPING HELPERS
# ============================================================================


def find_matching_column(
    text: str,
    columns: list[AIParseAutomationColumnContextSchema],
) -> tuple[AIParseAutomationColumnContextSchema | None, str | None]:
    """
    Search text for matching column title or extracted column name.
    Returns (matched_column_schema, matched_or_extracted_title).
    """
    if not text:
        return None, None

    text_lower = text.lower()

    # 1. Exact or whole-word match against provided board columns (longest match first)
    sorted_cols = sorted(columns, key=lambda c: len(c.title), reverse=True)
    for col in sorted_cols:
        col_lower = col.title.lower().strip()
        if not col_lower:
            continue
        pattern = r"\b" + re.escape(col_lower) + r"\b"
        if re.search(pattern, text_lower):
            return col, col.title

    # 2. Extract column name following prepositions like "ke <name>", "to <name>", "in <name>"
    prep_patterns = [
        r"(?:pindah\s+ke|dipindahkan\s+ke|masuk\s+ke|ke\s+kolom|di\s+kolom)\s+([a-zA-Z0-9_\-\s]+?)(?:,|\.|$|dan|and|otomatis|maka|then|dengan)",
        r"(?:moved\s+to|moves\s+to|move\s+to|to\s+column|in\s+column|into)\s+([a-zA-Z0-9_\-\s]+?)(?:,|\.|$|dan|and|automatically|then|with)",
        r"(?:ke|to|into)\s+([a-zA-Z0-9_\-]+)",
    ]
    for pat in prep_patterns:
        match = re.search(pat, text_lower)
        if match:
            candidate = match.group(1).strip()
            # Check if candidate matches any existing column
            for col in sorted_cols:
                if col.title.lower() == candidate or col.title.lower() in candidate:
                    return col, col.title
            return None, candidate.title()

    # 3. Fallback: if columns exist and text mentions single-word column substring
    for col in sorted_cols:
        if col.title.lower() in text_lower:
            return col, col.title

    return None, None


def find_matching_member(
    text: str,
    members: list[AIParseAutomationMemberContextSchema],
) -> str | None:
    """
    Match member name from prompt against board_members.
    Falls back to the first member in board_members if user specifies a generic 'assign member'.
    """
    if not members:
        return None

    text_lower = text.lower()

    # 1. Look for explicit member name match (longest first)
    sorted_members = sorted(members, key=lambda m: len(m.name), reverse=True)
    for m in sorted_members:
        name_lower = m.name.lower().strip()
        if not name_lower:
            continue
        pattern = r"\b" + re.escape(name_lower) + r"\b"
        if re.search(pattern, text_lower):
            return m.id
        # First name match if length >= 3
        first_name = name_lower.split()[0]
        if len(first_name) >= 3 and re.search(
            r"\b" + re.escape(first_name) + r"\b", text_lower
        ):
            return m.id

    # 2. Check for generic assignment keywords (Indonesian & English)
    generic_assign_patterns = [
        r"\bassign\s+member\b",
        r"\bassign\s+ke\s+member\b",
        r"\bassign\s+anggota\b",
        r"\btugaskan\s+member\b",
        r"\btugaskan\s+anggota\b",
        r"\btambahkan\s+member\b",
        r"\btambahkan\s+anggota\b",
        r"\bassign\s+to\b",
        r"\bassign\s+card\b",
        r"\bassign\b",
        r"\btugaskan\b",
    ]
    for pat in generic_assign_patterns:
        if re.search(pat, text_lower):
            return members[0].id

    return None


def find_matching_label(
    text: str,
    labels: list[AIParseAutomationLabelContextSchema],
) -> str | None:
    """
    Match label from prompt against board_labels by title, color synonym, or generic fallback.
    """
    if not labels:
        return None

    text_lower = text.lower()

    # 1. Exact label name match
    sorted_labels = sorted(labels, key=lambda l: len(l.name), reverse=True)
    for lbl in sorted_labels:
        if lbl.name:
            pattern = r"\b" + re.escape(lbl.name.lower().strip()) + r"\b"
            if re.search(pattern, text_lower):
                return lbl.id

    # 2. Color keyword match (bilingual)
    for synonym, standard_color in COLOR_SYNONYMS.items():
        if re.search(r"\b" + re.escape(synonym) + r"\b", text_lower):
            for lbl in labels:
                if lbl.color.lower().strip() == standard_color:
                    return lbl.id

    # 3. Generic label addition fallback
    generic_label_patterns = [
        r"\bberi\s+(?:[a-zA-Z0-9_\-]+\s+)?label\b",
        r"\btambahkan\s+(?:[a-zA-Z0-9_\-]+\s+)?label\b",
        r"\btempel\s+(?:[a-zA-Z0-9_\-]+\s+)?label\b",
        r"\bkasih\s+(?:[a-zA-Z0-9_\-]+\s+)?label\b",
        r"\badd\s+(?:[a-zA-Z0-9_\-]+\s+)?label\b",
        r"\battach\s+(?:[a-zA-Z0-9_\-]+\s+)?label\b",
        r"\btag\s+with\b",
        r"\bapply\s+(?:[a-zA-Z0-9_\-]+\s+)?label\b",
    ]
    for pat in generic_label_patterns:
        if re.search(pat, text_lower):
            return labels[0].id

    return None


def find_priority(text: str) -> PriorityEnum | None:
    """Extract priority enum from text if present."""
    text_lower = text.lower()
    for kw, prio in PRIORITY_KEYWORDS.items():
        if re.search(r"\b" + re.escape(kw) + r"\b", text_lower):
            return prio
    return None


# ============================================================================
# NATURAL LANGUAGE CLAUSE SPLITTING & BILINGUAL RULE COMPILER
# ============================================================================


def split_prompt_clauses(prompt: str) -> tuple[str, str]:
    """
    Split user prompt into (trigger_clause, actions_clause).
    Handles bilingual boundary markers like ', otomatis', 'maka', ', then', etc.
    """
    cleaned = prompt.strip()
    delimiters = [
        r",\s*otomatis\s+",
        r"\s+otomatis\s+",
        r",\s*maka\s+",
        r"\s+maka\s+",
        r",\s*automatically\s+",
        r"\s+automatically\s+",
        r",\s*then\s+",
        r"\s+then\s+",
        r",\s*lalu\s+",
        r"\s+lalu\s+",
        r",\s*",
    ]
    for pattern in delimiters:
        parts = re.split(pattern, cleaned, maxsplit=1, flags=re.IGNORECASE)
        if len(parts) == 2 and parts[0].strip() and parts[1].strip():
            p0 = parts[0].lower().strip()
            # If parts[0] looks like a condition
            if any(
                p0.startswith(w)
                for w in (
                    "saat",
                    "ketika",
                    "jika",
                    "apabila",
                    "bila",
                    "when",
                    "on",
                    "if",
                    "whenever",
                    "after",
                )
            ):
                return parts[0].strip(), parts[1].strip()

    # Fallback: check if an action starter appears in prompt
    action_split_patterns = [
        r"\b(?:centang|selesaikan|tandai)\s+due\s+date\b",
        r"\b(?:mark|complete|check)\s+due\s+date\b",
        r"\b(?:assign|tugaskan)\b",
        r"\b(?:beri|tambahkan|tempel|add|attach)\s+.*?\s*label\b",
        r"\b(?:set|atur|ubah)\s+prioritas\b",
        r"\b(?:set|change)\s+priority\b",
        r"\b(?:pindahkan|geser)\s+(?:kartu|ke)\b",
        r"\bmove\s+(?:card|to)\b",
        r"\b(?:tambahkan|buat|add|create)\s+checklist\b",
        r"\b(?:tambahkan|beri|post|add)\s+comment\b",
    ]
    for pat in action_split_patterns:
        match = re.search(pat, cleaned, flags=re.IGNORECASE)
        if match and match.start() > 5:
            trigger_part = cleaned[: match.start()].strip().rstrip(",").strip()
            action_part = cleaned[match.start() :].strip()
            return trigger_part, action_part

    return cleaned, cleaned


def parse_trigger(
    trigger_text: str,
    full_prompt: str,
    columns: list[AIParseAutomationColumnContextSchema],
    labels: list[AIParseAutomationLabelContextSchema],
) -> AutomationTriggerSchema:
    """Determine the trigger type and populate matching column/priority/label attributes."""
    trigger_lower = trigger_text.lower()
    combined_lower = f"{trigger_text} {full_prompt}".lower()

    # 1. WHEN_CHECKLIST_COMPLETED
    checklist_trigger_patterns = [
        r"\bchecklist\b.*?\b(?:selesai|komplit|tuntas|lengkap|dicentang|complete|completed|done|finished)\b",
        r"\b(?:semua|all)\b.*?\bchecklist\b.*?\b(?:selesai|complete|done)\b",
    ]
    if any(re.search(pat, trigger_lower) for pat in checklist_trigger_patterns):
        return AutomationTriggerSchema(
            type=AutomationTriggerTypeEnum.WHEN_CHECKLIST_COMPLETED
        )

    # 2. WHEN_PRIORITY_CHANGED
    priority_trigger_patterns = [
        r"\bprioritas\b.*?\b(?:berubah|diubah|menjadi|ganti)\b",
        r"\bpriority\b.*?\b(?:changed|changes|becomes|is\s+set|change)\b",
        r"\bperubahan\s+prioritas\b",
    ]
    if any(re.search(pat, trigger_lower) for pat in priority_trigger_patterns):
        prio = find_priority(trigger_text) or find_priority(full_prompt)
        return AutomationTriggerSchema(
            type=AutomationTriggerTypeEnum.WHEN_PRIORITY_CHANGED,
            priority=prio,
        )

    # 3. WHEN_LABEL_ADDED
    label_trigger_patterns = [
        r"\blabel\b.*?\b(?:ditambahkan|ditempel|diberikan|added|attached|tagged)\b",
        r"\b(?:diberi|ditempel)\s+label\b",
        r"\btagged\s+with\b",
    ]
    if any(re.search(pat, trigger_lower) for pat in label_trigger_patterns):
        matched_label_id = find_matching_label(trigger_text, labels)
        return AutomationTriggerSchema(
            type=AutomationTriggerTypeEnum.WHEN_LABEL_ADDED,
            label_id=matched_label_id,
        )

    # 4. WHEN_CARD_CREATED
    card_created_patterns = [
        r"\bkartu\b.*?\b(?:dibuat|ditambahkan|baru)\b",
        r"\b(?:membuat|tambah|penambahan)\s+kartu\b",
        r"\bcard\b.*?\b(?:created|added|new)\b",
        r"\b(?:creation|addition)\s+of\s+card\b",
    ]
    if any(re.search(pat, trigger_lower) for pat in card_created_patterns):
        col, col_title = find_matching_column(trigger_text, columns)
        return AutomationTriggerSchema(
            type=AutomationTriggerTypeEnum.WHEN_CARD_CREATED,
            column_id=col.id if col else None,
            column_title_match=col_title,
        )

    # 5. Default & Primary: WHEN_CARD_MOVED_TO_COLUMN
    # Check trigger text first for column, then full prompt
    col, col_title = find_matching_column(trigger_text, columns)
    if not col_title:
        col, col_title = find_matching_column(full_prompt, columns)

    # If still no column matched, but columns exist and prompt mentions movement
    if not col and columns:
        for c in columns:
            if "done" in c.title.lower() and "done" in combined_lower:
                col = c
                col_title = c.title
                break

    return AutomationTriggerSchema(
        type=AutomationTriggerTypeEnum.WHEN_CARD_MOVED_TO_COLUMN,
        column_id=col.id if col else None,
        column_title_match=col_title if col_title else (col.title if col else None),
    )


def parse_actions(
    action_text: str,
    full_prompt: str,
    columns: list[AIParseAutomationColumnContextSchema],
    members: list[AIParseAutomationMemberContextSchema],
    labels: list[AIParseAutomationLabelContextSchema],
) -> list[AutomationActionSchema]:
    """Parse one or more automation actions from the action text or full prompt."""
    actions: list[AutomationActionSchema] = []
    text_lower = action_text.lower()
    full_lower = full_prompt.lower()

    # 1. MARK_DUE_DATE_COMPLETE
    due_complete_patterns = [
        r"\b(?:centang|selesaikan|tandai|mark|complete|check)\b.*?\bdue\s+date\b",
        r"\bdue\s+date\b.*?\b(?:selesai|lengkap|complete|done|completed)\b",
        r"\b(?:centang|selesaikan|tandai)\b.*?\btenggat\b",
        r"\btenggat\b.*?\b(?:selesai|lengkap)\b",
    ]
    if any(re.search(pat, text_lower) for pat in due_complete_patterns) or any(
        re.search(pat, full_lower) for pat in due_complete_patterns
    ):
        actions.append(
            AutomationActionSchema(
                type=AutomationActionTypeEnum.MARK_DUE_DATE_COMPLETE,
                due_complete_value=True,
            )
        )

    # 2. ASSIGN_MEMBER
    assign_patterns = [
        r"\b(?:assign|tugaskan|tambahkan)\b.*?\b(?:member|anggota|ke|to|user)\b",
        r"\bassign\b",
        r"\btugaskan\b",
    ]
    if any(re.search(pat, text_lower) for pat in assign_patterns):
        matched_member_id = find_matching_member(action_text, members) or (
            members[0].id if members else None
        )
        actions.append(
            AutomationActionSchema(
                type=AutomationActionTypeEnum.ASSIGN_MEMBER,
                member_id=matched_member_id,
                due_complete_value=None,
            )
        )

    # 3. ADD_LABEL
    label_patterns = [
        r"\b(?:beri|tambahkan|tempel|kasih|pasang)\b.*?\blabel\b",
        r"\b(?:add|attach|apply|tag)\b.*?\blabel\b",
        r"\btag\s+with\b",
        r"\blabeli\b",
    ]
    if any(re.search(pat, text_lower) for pat in label_patterns):
        matched_label_id = find_matching_label(action_text, labels) or (
            labels[0].id if labels else None
        )
        actions.append(
            AutomationActionSchema(
                type=AutomationActionTypeEnum.ADD_LABEL,
                label_id=matched_label_id,
                due_complete_value=None,
            )
        )

    # 4. SET_PRIORITY
    priority_action_patterns = [
        r"\b(?:set|atur|ubah|jadikan|make|change)\b.*?\bpriorit",
        r"\bprioritas\b.*?\b(?:urgent|darurat|tinggi|high|sedang|medium|rendah|low)\b",
        r"\bpriority\b.*?\b(?:urgent|high|medium|low)\b",
        r"\bmark\s+as\s+urgent\b",
    ]
    if any(re.search(pat, text_lower) for pat in priority_action_patterns):
        prio = find_priority(action_text) or PriorityEnum.HIGH
        actions.append(
            AutomationActionSchema(
                type=AutomationActionTypeEnum.SET_PRIORITY,
                priority=prio,
                due_complete_value=None,
            )
        )

    # 5. MOVE_CARD_TO_COLUMN
    move_action_patterns = [
        r"\b(?:pindahkan|geser|kirim)\b.*?\b(?:kartu|ke|kolom)\b",
        r"\b(?:move|send|transfer)\b.*?\b(?:card|to|column)\b",
    ]
    if any(re.search(pat, text_lower) for pat in move_action_patterns):
        col, _ = find_matching_column(action_text, columns)
        actions.append(
            AutomationActionSchema(
                type=AutomationActionTypeEnum.MOVE_CARD_TO_COLUMN,
                target_column_id=col.id if col else None,
                due_complete_value=None,
            )
        )

    # 6. ADD_CHECKLIST
    checklist_action_patterns = [
        r"\b(?:tambahkan|buat|tambah|add|create|attach)\b.*?\bchecklist\b",
    ]
    if any(re.search(pat, text_lower) for pat in checklist_action_patterns):
        title_match = re.search(
            r'checklist\s+["\']([^"\']+)["\']', action_text, re.IGNORECASE
        )
        if not title_match:
            title_match = re.search(
                r"checklist\s+([a-zA-Z0-9_\-\s]+?)(?:,|\.|$|dengan|with)",
                action_text,
                re.IGNORECASE,
            )
        cl_title = title_match.group(1).strip() if title_match else "Checklist"
        actions.append(
            AutomationActionSchema(
                type=AutomationActionTypeEnum.ADD_CHECKLIST,
                checklist_title=cl_title[:150],
                checklist_items=["Review details", "Verify implementation"],
                due_complete_value=None,
            )
        )

    # 7. POST_COMMENT
    comment_action_patterns = [
        r"\b(?:tambahkan|tulis|beri|kirim|post|add|write)\b.*?\b(?:comment|komentar)\b",
        r"\bcomment\b",
        r"\bkomentar\b",
    ]
    if any(re.search(pat, text_lower) for pat in comment_action_patterns):
        comment_match = re.search(
            r'(?:komentar|comment)\s*[:\-]?\s*["\']([^"\']+)["\']',
            action_text,
            re.IGNORECASE,
        )
        if not comment_match:
            comment_match = re.search(
                r"(?:komentar|comment)\s*[:\-]?\s*(.+?)(?:,|\.|$)",
                action_text,
                re.IGNORECASE,
            )
        c_text = (
            comment_match.group(1).strip()
            if comment_match
            else "Automated Butler rule executed."
        )
        actions.append(
            AutomationActionSchema(
                type=AutomationActionTypeEnum.POST_COMMENT,
                comment_text=c_text,
                due_complete_value=None,
            )
        )

    # If no actions matched yet, provide intelligent default action
    if not actions:
        if any(k in text_lower or k in full_lower for k in ("assign", "tugas")):
            actions.append(
                AutomationActionSchema(
                    type=AutomationActionTypeEnum.ASSIGN_MEMBER,
                    member_id=members[0].id if members else None,
                    due_complete_value=None,
                )
            )
        elif any(k in text_lower or k in full_lower for k in ("label", "tag")):
            actions.append(
                AutomationActionSchema(
                    type=AutomationActionTypeEnum.ADD_LABEL,
                    label_id=labels[0].id if labels else None,
                    due_complete_value=None,
                )
            )
        else:
            actions.append(
                AutomationActionSchema(
                    type=AutomationActionTypeEnum.MARK_DUE_DATE_COMPLETE,
                    due_complete_value=True,
                )
            )

    return actions


def generate_rule_title_and_description(
    trigger: AutomationTriggerSchema,
    actions: list[AutomationActionSchema],
    prompt: str,
) -> tuple[str, str]:
    """Generate concise name and human-readable description matching the prompt language."""
    is_indonesian = any(
        w in prompt.lower()
        for w in (
            "saat",
            "ketika",
            "jika",
            "kartu",
            "pindah",
            "centang",
            "otomatis",
            "beri",
            "tambahkan",
            "dan",
            "ke",
        )
    )

    action_names: list[str] = []
    for a in actions:
        if a.type == AutomationActionTypeEnum.MARK_DUE_DATE_COMPLETE:
            action_names.append(
                "Selesaikan Due Date" if is_indonesian else "Mark Due Complete"
            )
        elif a.type == AutomationActionTypeEnum.ASSIGN_MEMBER:
            action_names.append(
                "Tugaskan Member" if is_indonesian else "Assign Member"
            )
        elif a.type == AutomationActionTypeEnum.ADD_LABEL:
            action_names.append("Tempel Label" if is_indonesian else "Attach Label")
        elif a.type == AutomationActionTypeEnum.SET_PRIORITY:
            action_names.append("Atur Prioritas" if is_indonesian else "Set Priority")
        elif a.type == AutomationActionTypeEnum.MOVE_CARD_TO_COLUMN:
            action_names.append("Pindah Kolom" if is_indonesian else "Move Card")
        elif a.type == AutomationActionTypeEnum.ADD_CHECKLIST:
            action_names.append(
                "Tambah Checklist" if is_indonesian else "Add Checklist"
            )
        elif a.type == AutomationActionTypeEnum.POST_COMMENT:
            action_names.append("Beri Komentar" if is_indonesian else "Post Comment")

    actions_summary = " & ".join(action_names) if action_names else "Automate Card"

    if trigger.type == AutomationTriggerTypeEnum.WHEN_CARD_MOVED_TO_COLUMN:
        col = trigger.column_title_match or "Column"
        name = (
            f"Pindah ke {col}: {actions_summary}"
            if is_indonesian
            else f"When Moved to {col}: {actions_summary}"
        )
        desc = (
            f"Ketika kartu dipindahkan ke kolom {col}, otomatis {', '.join(a.lower() for a in action_names)}."
            if is_indonesian
            else f"When a card is moved to {col}, automatically {', '.join(a.lower() for a in action_names)}."
        )
    elif trigger.type == AutomationTriggerTypeEnum.WHEN_CARD_CREATED:
        col = (
            f" di {trigger.column_title_match}"
            if trigger.column_title_match
            else (" in " + trigger.column_title_match if trigger.column_title_match else "")
        )
        name = (
            f"Kartu Baru{col}: {actions_summary}"
            if is_indonesian
            else f"On Card Created{col}: {actions_summary}"
        )
        desc = (
            f"Saat kartu baru dibuat{col}, otomatis {', '.join(a.lower() for a in action_names)}."
            if is_indonesian
            else f"When a new card is created{col}, automatically {', '.join(a.lower() for a in action_names)}."
        )
    elif trigger.type == AutomationTriggerTypeEnum.WHEN_CHECKLIST_COMPLETED:
        name = (
            f"Checklist Selesai: {actions_summary}"
            if is_indonesian
            else f"Checklist Completed: {actions_summary}"
        )
        desc = (
            f"Ketika seluruh checklist selesai, otomatis {', '.join(a.lower() for a in action_names)}."
            if is_indonesian
            else f"When all checklists are completed, automatically {', '.join(a.lower() for a in action_names)}."
        )
    elif trigger.type == AutomationTriggerTypeEnum.WHEN_PRIORITY_CHANGED:
        prio = trigger.priority.value if trigger.priority else "Urgent"
        name = (
            f"Prioritas {prio}: {actions_summary}"
            if is_indonesian
            else f"Priority {prio}: {actions_summary}"
        )
        desc = (
            f"Saat prioritas kartu berubah menjadi {prio}, otomatis {', '.join(a.lower() for a in action_names)}."
            if is_indonesian
            else f"When card priority changes to {prio}, automatically {', '.join(a.lower() for a in action_names)}."
        )
    elif trigger.type == AutomationTriggerTypeEnum.WHEN_LABEL_ADDED:
        name = (
            f"Label Ditempel: {actions_summary}"
            if is_indonesian
            else f"Label Attached: {actions_summary}"
        )
        desc = (
            f"Ketika label ditempel pada kartu, otomatis {', '.join(a.lower() for a in action_names)}."
            if is_indonesian
            else f"When label is attached to card, automatically {', '.join(a.lower() for a in action_names)}."
        )
    else:
        name = f"Butler Rule: {actions_summary}"
        desc = f"Execute {actions_summary} on trigger condition."

    return name[:150], desc


def parse_automation_with_compiler(
    request: AIParseAutomationRequestSchema,
) -> AIParseAutomationResponseSchema:
    """
    Deterministic domain-aware heuristic rule compiler.
    Translates English and Indonesian freeform Butler prompts into contract-compliant schemas.
    """
    prompt = request.prompt.strip()
    trigger_clause, actions_clause = split_prompt_clauses(prompt)

    trigger = parse_trigger(
        trigger_clause, prompt, request.board_columns, request.board_labels
    )
    actions = parse_actions(
        actions_clause,
        prompt,
        request.board_columns,
        request.board_members,
        request.board_labels,
    )

    name, desc = generate_rule_title_and_description(trigger, actions, prompt)

    return AIParseAutomationResponseSchema(
        name=name,
        description=desc,
        trigger=trigger,
        actions=actions,
    )


# ============================================================================
# LLM ORCHESTRATION & NORMALIZATION
# ============================================================================


def _normalize_llm_automation_payload(
    raw_data: dict[str, Any],
    fallback_request: AIParseAutomationRequestSchema,
) -> AIParseAutomationResponseSchema:
    """
    Validate, sanitize, and normalize raw LLM output into `AIParseAutomationResponseSchema`.
    Resolves column/member/label IDs from board context if LLM only returned titles/names.
    """
    heuristic_fallback = parse_automation_with_compiler(fallback_request)

    # 1. Name & Description
    raw_name = str(raw_data.get("name") or "").strip()
    rule_name = raw_name[:150] if raw_name else heuristic_fallback.name
    raw_desc = str(raw_data.get("description") or "").strip()
    rule_desc = raw_desc if raw_desc else heuristic_fallback.description

    # 2. Trigger
    raw_trigger = raw_data.get("trigger")
    if isinstance(raw_trigger, dict):
        raw_type = str(raw_trigger.get("type", "")).strip().upper()
        try:
            trigger_type = AutomationTriggerTypeEnum(raw_type)
        except ValueError:
            trigger_type = heuristic_fallback.trigger.type

        column_id = raw_trigger.get("column_id")
        column_title = raw_trigger.get("column_title_match")
        raw_priority = raw_trigger.get("priority")
        label_id = raw_trigger.get("label_id")

        # Resolve column_id from title if missing
        if not column_id and column_title:
            for col in fallback_request.board_columns:
                if col.title.lower() == str(column_title).lower().strip():
                    column_id = col.id
                    break

        # Resolve column_title if missing
        if column_id and not column_title:
            for col in fallback_request.board_columns:
                if col.id == str(column_id):
                    column_title = col.title
                    break

        priority_val: PriorityEnum | None = None
        if raw_priority:
            try:
                priority_val = PriorityEnum(str(raw_priority).upper().strip())
            except ValueError:
                priority_val = None

        trigger = AutomationTriggerSchema(
            type=trigger_type,
            column_id=str(column_id) if column_id else None,
            column_title_match=str(column_title) if column_title else None,
            priority=priority_val,
            label_id=str(label_id) if label_id else None,
        )
    else:
        trigger = heuristic_fallback.trigger

    # 3. Actions
    raw_actions = raw_data.get("actions")
    normalized_actions: list[AutomationActionSchema] = []
    if isinstance(raw_actions, list):
        for act in raw_actions:
            if not isinstance(act, dict):
                continue
            act_type_str = str(act.get("type", "")).strip().upper()
            try:
                act_type = AutomationActionTypeEnum(act_type_str)
            except ValueError:
                continue

            member_id = act.get("member_id")
            label_id = act.get("label_id")
            priority = act.get("priority")
            target_column_id = act.get("target_column_id")
            checklist_title = act.get("checklist_title")
            checklist_items = act.get("checklist_items")
            comment_text = act.get("comment_text")
            due_complete_value = act.get("due_complete_value")

            # Resolve member_id if member name or generic was returned
            if act_type == AutomationActionTypeEnum.ASSIGN_MEMBER:
                if not member_id and fallback_request.board_members:
                    member_id = fallback_request.board_members[0].id
                due_complete_value = None

            # Resolve label_id if label name was returned
            if act_type == AutomationActionTypeEnum.ADD_LABEL:
                if not label_id and fallback_request.board_labels:
                    label_id = fallback_request.board_labels[0].id
                due_complete_value = None

            # Resolve priority
            prio_enum: PriorityEnum | None = None
            if priority:
                try:
                    prio_enum = PriorityEnum(str(priority).upper().strip())
                except ValueError:
                    prio_enum = None

            if act_type == AutomationActionTypeEnum.MARK_DUE_DATE_COMPLETE:
                due_complete_value = True

            normalized_actions.append(
                AutomationActionSchema(
                    type=act_type,
                    member_id=str(member_id) if member_id else None,
                    label_id=str(label_id) if label_id else None,
                    priority=prio_enum,
                    target_column_id=str(target_column_id)
                    if target_column_id
                    else None,
                    checklist_title=str(checklist_title)[:150]
                    if checklist_title
                    else None,
                    checklist_items=[str(item) for item in checklist_items]
                    if isinstance(checklist_items, list)
                    else None,
                    comment_text=str(comment_text) if comment_text else None,
                    due_complete_value=due_complete_value,
                )
            )

    if not normalized_actions:
        normalized_actions = heuristic_fallback.actions

    return AIParseAutomationResponseSchema(
        name=rule_name,
        description=rule_desc,
        trigger=trigger,
        actions=normalized_actions,
    )


async def _call_llm_parse_automation(
    request: AIParseAutomationRequestSchema,
    settings: Settings,
) -> AIParseAutomationResponseSchema:
    """Call external OpenAI-compatible chat completions endpoint in JSON mode for Butler rule parsing."""
    system_prompt = (
        "You are the Kinetix Principal AI Butler Natural Language Automation Compiler. "
        "Given a freeform user prompt (in Indonesian or English) and board context (columns, members, labels), "
        "parse the prompt into a structured automation rule. "
        "You MUST map column titles to column_id, member names to member_id, and label names/colors to label_id. "
        "Respond ONLY with a valid JSON object matching this exact schema:\n"
        "{\n"
        '  "name": "concise rule title (max 150 chars)",\n'
        '  "description": "human readable explanation",\n'
        '  "trigger": {\n'
        '    "type": "WHEN_CARD_MOVED_TO_COLUMN" | "WHEN_CARD_CREATED" | "WHEN_CHECKLIST_COMPLETED" | "WHEN_PRIORITY_CHANGED" | "WHEN_LABEL_ADDED",\n'
        '    "column_id": "string or null",\n'
        '    "column_title_match": "string or null",\n'
        '    "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null,\n'
        '    "label_id": "string or null"\n'
        "  },\n"
        '  "actions": [\n'
        "    {\n"
        '      "type": "MARK_DUE_DATE_COMPLETE" | "ASSIGN_MEMBER" | "ADD_LABEL" | "SET_PRIORITY" | "MOVE_CARD_TO_COLUMN" | "ADD_CHECKLIST" | "POST_COMMENT",\n'
        '      "member_id": "string or null",\n'
        '      "label_id": "string or null",\n'
        '      "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null,\n'
        '      "target_column_id": "string or null",\n'
        '      "checklist_title": "string or null",\n'
        '      "checklist_items": ["string"] or null,\n'
        '      "comment_text": "string or null",\n'
        '      "due_complete_value": true | null\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    user_payload = {
        "prompt": request.prompt,
        "board_columns": [c.model_dump(mode="json") for c in request.board_columns],
        "board_members": [m.model_dump(mode="json") for m in request.board_members],
        "board_labels": [lbl.model_dump(mode="json") for lbl in request.board_labels],
    }

    url = f"{settings.llm_base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.llm_api_key.strip()}",
        "Content-Type": "application/json",
    }
    body = {
        "model": settings.llm_model,
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
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
        raise TypeError("LLM rule parser response content is not a JSON object")

    return _normalize_llm_automation_payload(parsed, request)


async def parse_automation(
    request: AIParseAutomationRequestSchema,
    settings: Settings | None = None,
) -> AIParseAutomationResponseSchema:
    """
    Orchestrate Dual-Mode Butler Automation Parsing:
    - Uses live LLM when a valid `LLM_API_KEY` is configured.
    - Automatically falls back to deterministic bilingual rule compiler when
      `LLM_API_KEY` is missing/placeholder or if the external LLM call fails.
    """
    active_settings = settings or get_settings()
    if active_settings.has_valid_llm_key:
        try:
            return await _call_llm_parse_automation(request, active_settings)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "External LLM automation parser call failed (%s); falling back to deterministic bilingual compiler.",
                exc,
            )

    return parse_automation_with_compiler(request)
