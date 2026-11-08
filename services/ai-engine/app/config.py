"""Configuration and locked environment settings for Kinetix AI Engine (Port 8001)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Load .env from service directory or monorepo root if available
_SERVICE_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _SERVICE_DIR.parent.parent

for _env_candidate in (_SERVICE_DIR / ".env", _REPO_ROOT / ".env"):
    if _env_candidate.is_file():
        load_dotenv(dotenv_path=_env_candidate, override=False)

PLACEHOLDER_API_KEYS: frozenset[str] = frozenset(
    {
        "",
        "your_llm_api_key_here",
        "changeme",
        "placeholder",
        "none",
        "null",
    }
)


@dataclass(frozen=True)
class Settings:
    """Stateless runtime configuration bound to the Kinetix Port & Environment Registry."""

    ai_engine_port: int = 8001
    internal_service_token: str = "orca_internal_sync_token_2026"
    llm_api_key: str = "your_llm_api_key_here"
    llm_model: str = "gpt-4o-mini"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_timeout_seconds: float = 12.0
    service_name: str = "kinetix-ai-engine"
    service_version: str = "1.0.0"

    @property
    def has_valid_llm_key(self) -> bool:
        """Return True only when a real, non-placeholder LLM API key is configured."""
        cleaned = self.llm_api_key.strip()
        return bool(cleaned) and cleaned.lower() not in PLACEHOLDER_API_KEYS


def get_settings() -> Settings:
    """Read current environment variables dynamically to support runtime & test overrides."""
    raw_port = os.getenv("AI_ENGINE_PORT", "8001").strip()
    try:
        port = int(raw_port)
    except ValueError:
        port = 8001

    return Settings(
        ai_engine_port=port,
        internal_service_token=os.getenv(
            "INTERNAL_SERVICE_TOKEN", "orca_internal_sync_token_2026"
        ),
        llm_api_key=os.getenv("LLM_API_KEY", "your_llm_api_key_here"),
        llm_model=os.getenv("LLM_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini",
        llm_base_url=os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
        llm_timeout_seconds=float(os.getenv("LLM_TIMEOUT_SECONDS", "12.0")),
        service_name=os.getenv("AI_ENGINE_SERVICE_NAME", "kinetix-ai-engine"),
        service_version="1.0.0",
    )
