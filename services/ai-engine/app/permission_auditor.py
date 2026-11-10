"""
AI Workspace Access & Permission Auditor (`POST /internal/v1/audit-permissions`).
Evaluates workspace access, role distribution (`ADMIN`, `EDITOR`, `VIEWER`),
and active token invite links under Zero-Trust and Least-Privilege access principles.

Implements Dual-Mode Intelligence:
1. Live LLM Orchestration via OpenAI-compatible JSON mode (`httpx`) when a valid `LLM_API_KEY` is configured.
2. Deterministic Zero-Trust RBAC Heuristic Auditor (Zero-Config Ready) when `LLM_API_KEY` is missing,
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
    AIPermissionAuditRequestSchema,
    AIPermissionAuditResponseSchema,
    AIPermissionRiskLevelEnum,
    BoardInviteLinkSchema,
)

logger = logging.getLogger("kinetix.ai_engine.permission_auditor")


def map_score_to_risk_level(score: float) -> AIPermissionRiskLevelEnum:
    """
    Map numeric security score (0-100) to AIPermissionRiskLevelEnum:
    - >= 80: "LOW"
    - 50-79: "MEDIUM"
    - < 50: "HIGH"
    """
    if score >= 80.0:
        return AIPermissionRiskLevelEnum.LOW
    if score >= 50.0:
        return AIPermissionRiskLevelEnum.MEDIUM
    return AIPermissionRiskLevelEnum.HIGH


def _is_link_active(link: BoardInviteLinkSchema) -> bool:
    """Check if an invite link is currently active and not expired."""
    if not getattr(link, "is_active", True):
        return False

    expires_at = getattr(link, "expires_at", None)
    if expires_at is None:
        return True

    now = datetime.now(UTC)
    if isinstance(expires_at, datetime):
        link_dt = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=UTC)
        return link_dt > now

    if isinstance(expires_at, str) and expires_at.strip():
        try:
            dt = datetime.fromisoformat(expires_at)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            return dt > now
        except (ValueError, TypeError):
            return True

    return True


def audit_permissions_with_heuristics(
    request: AIPermissionAuditRequestSchema,
) -> AIPermissionAuditResponseSchema:
    """
    Deterministic Zero-Trust RBAC Heuristic Auditor (Zero-Config Ready).
    Evaluates:
    1. Role distribution: flags if > 50% of members hold ADMIN role.
    2. Invite link risk: flags active invite links granting ADMIN/EDITOR with expires_at is None AND max_uses is None.
    3. Board visibility: flags PUBLIC_READ boards with active sensitive invite links.
    Computes security score (0-100), maps to risk level, and generates actionable findings & recommendations.
    """
    board_title = request.board_title.strip()
    visibility = str(request.visibility).strip().upper()
    members = request.members or []
    invite_links = request.invite_links or []

    score = 100.0
    findings: list[str] = []
    recommendations: list[str] = []

    # 1. Analyze role distribution
    total_members = len(members)
    admin_count = 0
    editor_count = 0
    viewer_count = 0

    for m in members:
        raw_role = m.role.value if hasattr(m.role, "value") else str(m.role)
        role_upper = raw_role.upper()
        if role_upper == "ADMIN":
            admin_count += 1
        elif role_upper == "EDITOR":
            editor_count += 1
        elif role_upper == "VIEWER":
            viewer_count += 1

    if total_members > 1 and (admin_count / total_members) > 0.5:
        admin_pct = round((admin_count / total_members) * 100)
        # Deduct proportional points for excessive admin sprawl
        score -= 25.0
        findings.append(
            f"Excessive admin privileges: {admin_count} of {total_members} members ({admin_pct}%) hold ADMIN role, violating least-privilege principle."
        )
        recommendations.append(
            "Downgrade inactive or non-essential Admins to Editor or Viewer role to minimize high-privilege blast radius."
        )
    elif total_members == 0:
        score -= 10.0
        findings.append("No members are currently assigned to this board.")
        recommendations.append("Assign designated workspace members with appropriate RBAC roles.")
    elif total_members >= 1 and admin_count == 0:
        score -= 15.0
        findings.append("No members hold ADMIN role on this board, risking administrative lockout.")
        recommendations.append("Assign at least one trusted team member to the ADMIN role.")

    # 2. Analyze active invite links
    active_sensitive_links: list[BoardInviteLinkSchema] = []
    unbounded_links_count = 0

    for link in invite_links:
        if not _is_link_active(link):
            continue

        raw_role = link.role.value if hasattr(link.role, "value") else str(link.role)
        role_upper = raw_role.upper()
        is_sensitive = role_upper in ("ADMIN", "EDITOR")
        if is_sensitive:
            active_sensitive_links.append(link)

        has_no_expiry = link.expires_at is None or (
            isinstance(link.expires_at, str) and not link.expires_at.strip()
        )
        has_no_max_uses = link.max_uses is None or link.max_uses <= 0

        # Unbounded invite link risk: active link granting ADMIN or EDITOR with expires_at == null AND max_uses == null
        if is_sensitive and has_no_expiry and has_no_max_uses:
            unbounded_links_count += 1
            deduction = 25.0 if role_upper == "ADMIN" else 15.0
            score -= deduction
            findings.append(
                f"Unbounded invite link '{link.token}' grants {role_upper} role with unlimited expiration and unbounded usage."
            )
            recommendations.append(
                f"Set a 7-day expiration timestamp and a max_uses limit on active {role_upper} invite link '{link.token}'."
            )
        elif is_sensitive and has_no_expiry:
            # Active sensitive link with max_uses but no expiration
            score -= 10.0
            findings.append(
                f"Invite link '{link.token}' grants {role_upper} role with unlimited expiration."
            )
            recommendations.append(
                f"Configure expiration timestamps on active {role_upper} invite link '{link.token}'."
            )

    # 3. Analyze visibility vs sensitive invite links
    if visibility == "PUBLIC_READ" and len(active_sensitive_links) > 0:
        score -= 20.0
        token_preview = [l.token for l in active_sensitive_links[:3]]
        findings.append(
            f"Board visibility is PUBLIC_READ while {len(active_sensitive_links)} active privileged invite link(s) ({', '.join(token_preview)}) grant write/admin access."
        )
        recommendations.append(
            "Revoke active invite links with write/admin privileges or restrict board visibility from PUBLIC_READ to WORKSPACE or PRIVATE."
        )
    elif visibility == "PUBLIC_READ" and (editor_count + admin_count) > 0 and len(findings) == 0:
        recommendations.append(
            "Verify that public read access aligns with organizational data security guidelines."
        )

    # 4. Final score clamping & risk level mapping
    final_score = max(0.0, min(100.0, float(round(score, 1))))
    risk_level = map_score_to_risk_level(final_score)

    # 5. Executive summary synthesis
    if final_score >= 80.0:
        summary = (
            f"Board '{board_title}' demonstrates a strong zero-trust access posture (Security Score: {round(final_score)}/100, LOW risk). "
            f"Role distribution ({admin_count} Admin, {editor_count} Editor, {viewer_count} Viewer) and invite link controls comply with least-privilege standards."
        )
        if not recommendations:
            recommendations.append(
                "Maintain periodic RBAC access audits and rotate active invite tokens regularly."
            )
    elif 50.0 <= final_score < 80.0:
        primary_finding = findings[0] if findings else "Active permissions require configuration review."
        summary = (
            f"Moderate permission risk detected on '{board_title}' (Security Score: {round(final_score)}/100, MEDIUM risk). "
            f"{primary_finding}"
        )
    else:
        summary = (
            f"High security risk identified on '{board_title}' (Security Score: {round(final_score)}/100, HIGH risk). "
            f"Multiple least-privilege violations and unbounded invite links require immediate mitigation."
        )

    # Deduplicate recommendations preserving order
    deduped_recs: list[str] = []
    seen_recs: set[str] = set()
    for rec in recommendations:
        if rec not in seen_recs:
            seen_recs.add(rec)
            deduped_recs.append(rec)

    return AIPermissionAuditResponseSchema(
        security_score=final_score,
        risk_level=risk_level,
        summary=summary,
        findings=findings,
        recommendations=deduped_recs,
    )


def _normalize_llm_audit_payload(
    raw_data: dict[str, Any],
    fallback_request: AIPermissionAuditRequestSchema,
) -> AIPermissionAuditResponseSchema:
    """Validate, sanitize, and normalize raw LLM JSON output into `AIPermissionAuditResponseSchema`."""
    deterministic = audit_permissions_with_heuristics(fallback_request)

    raw_score = raw_data.get("security_score")
    try:
        score = float(raw_score)  # type: ignore[arg-type]
        score = max(0.0, min(100.0, float(round(score, 1))))
    except (TypeError, ValueError):
        score = deterministic.security_score

    # Map score to canonical risk level to guarantee threshold consistency
    risk_level = map_score_to_risk_level(score)

    raw_summary = str(raw_data.get("summary") or "").strip()
    summary = raw_summary if raw_summary else deterministic.summary

    raw_findings = raw_data.get("findings")
    findings: list[str] = []
    if isinstance(raw_findings, list):
        for item in raw_findings:
            text = str(item).strip()
            if text:
                findings.append(text)
    if not findings and deterministic.findings:
        findings = deterministic.findings

    raw_recs = raw_data.get("recommendations")
    recommendations: list[str] = []
    if isinstance(raw_recs, list):
        for item in raw_recs:
            text = str(item).strip()
            if text:
                recommendations.append(text)
    if not recommendations:
        recommendations = deterministic.recommendations

    return AIPermissionAuditResponseSchema(
        security_score=score,
        risk_level=risk_level,
        summary=summary,
        findings=findings,
        recommendations=recommendations,
    )


async def _call_llm_audit_permissions(
    request: AIPermissionAuditRequestSchema,
    settings: Settings,
) -> AIPermissionAuditResponseSchema:
    """Call external OpenAI-compatible chat completions endpoint in JSON mode for Access & Permission Audit."""
    deterministic_baseline = audit_permissions_with_heuristics(request)

    system_prompt = (
        "You are the Kinetix Principal AI Security Engineer & Least-Privilege Access Analyzer. "
        "Analyze board member roles (ADMIN, EDITOR, VIEWER), board visibility (PRIVATE, WORKSPACE, PUBLIC_READ), "
        "and active invite links under Zero-Trust RBAC principles. "
        "Rules: "
        "- Deduct points if > 50% of members hold ADMIN role (violating least-privilege). "
        "- Deduct points if active invite links grant ADMIN or EDITOR role with no expiration and no max_uses. "
        "- Deduct points if board visibility is PUBLIC_READ while sensitive invite links are active. "
        "Score mapping: >= 80 is 'LOW', 50-79 is 'MEDIUM', < 50 is 'HIGH'. "
        "Respond ONLY with a valid JSON object matching this schema:\n"
        "{\n"
        '  "security_score": number (0 to 100),\n'
        '  "risk_level": "LOW" | "MEDIUM" | "HIGH",\n'
        '  "summary": "actionable executive summary",\n'
        '  "findings": ["finding 1", "finding 2"],\n'
        '  "recommendations": ["recommendation 1", "recommendation 2"]\n'
        "}"
    )

    user_payload = {
        "board_title": request.board_title,
        "visibility": request.visibility,
        "members": [m.model_dump(mode="json") for m in request.members],
        "invite_links": [l.model_dump(mode="json") for l in request.invite_links],
        "heuristic_baseline_score": deterministic_baseline.security_score,
        "heuristic_baseline_risk_level": deterministic_baseline.risk_level.value,
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
        raise TypeError("LLM permission auditor response content is not a JSON object")

    return _normalize_llm_audit_payload(parsed, request)


async def audit_permissions(
    request: AIPermissionAuditRequestSchema,
    settings: Settings | None = None,
) -> AIPermissionAuditResponseSchema:
    """
    Orchestrate Dual-Mode AI Workspace Access & Permission Audit:
    - Uses live LLM when a valid `LLM_API_KEY` is configured.
    - Automatically falls back to the Deterministic Zero-Trust RBAC Heuristic Auditor when
      `LLM_API_KEY` is missing/placeholder or if the upstream LLM request fails.
    """
    active_settings = settings or get_settings()
    if active_settings.has_valid_llm_key:
        try:
            return await _call_llm_audit_permissions(request, active_settings)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "External LLM permission auditor call failed (%s); falling back to deterministic heuristic auditor.",
                exc,
            )

    return audit_permissions_with_heuristics(request)
