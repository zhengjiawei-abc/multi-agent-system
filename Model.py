from __future__ import annotations

import os
from dataclasses import dataclass

from cc_switch_config import load_codex_provider_config


@dataclass(frozen=True)
class ModelProfile:
    provider: str
    model: str
    temperature: float = 0.3
    max_tokens: int = 2048


MODEL_PROFILES = {
    "master": ModelProfile("openai", "gpt-5.5", temperature=0.2),
    "frontend": ModelProfile("openai", "gpt-5.5", temperature=0.35),
    "backend": ModelProfile("openai", "gpt-5.5", temperature=0.25),
    "reviewer": ModelProfile("openai", "gpt-5.5", temperature=0.1),
    "tester": ModelProfile("openai", "gpt-5.5", temperature=0.1),
}


def profile_for_agent(agent_id: str) -> ModelProfile:
    base = MODEL_PROFILES.get(agent_id, ModelProfile("openai", "gpt-5.5"))
    cc_switch = load_codex_provider_config() if base.provider == "openai" else None
    prefix = agent_env_prefix(agent_id)
    return ModelProfile(
        provider=os.getenv(f"{prefix}_PROVIDER", base.provider),
        model=os.getenv(f"{prefix}_MODEL", os.getenv("CODEX_MODEL", cc_switch.model if cc_switch and cc_switch.model else base.model)),
        temperature=float(os.getenv(f"{prefix}_TEMPERATURE", base.temperature)),
        max_tokens=int(os.getenv(f"{prefix}_MAX_TOKENS", base.max_tokens)),
    )


def agent_env_prefix(agent_id: str) -> str:
    safe = "".join(ch if ch.isalnum() else "_" for ch in agent_id.upper())
    return f"QUANTUMFLOW_{safe}"


def env_key_for_provider(provider: str) -> str:
    return {
        "anthropic": "ANTHROPIC_API_KEY",
        "google_genai": "GEMINI_API_KEY",
        "openai": "OPENAI_API_KEY",
        "deepseek": "DEEPSEEK_API_KEY",
    }.get(provider, "")


def has_provider_key(provider: str) -> bool:
    key_name = env_key_for_provider(provider)
    if provider == "openai":
        cc_switch = load_codex_provider_config()
        if os.getenv("CODEX_API_KEY") or (cc_switch and cc_switch.api_key):
            return True
    return bool(key_name and os.getenv(key_name))


def resolve_provider_key(provider: str, agent_id: str | None = None) -> str | None:
    if agent_id:
        prefix = agent_env_prefix(agent_id)
        agent_key = os.getenv(f"{prefix}_API_KEY") or os.getenv(f"CODEX_{agent_id.upper()}_API_KEY")
        if agent_key:
            return agent_key
    if provider == "openai":
        cc_switch = load_codex_provider_config()
        return os.getenv("OPENAI_API_KEY") or os.getenv("CODEX_API_KEY") or (cc_switch.api_key if cc_switch else None)
    key_name = env_key_for_provider(provider)
    return os.getenv(key_name) if key_name else None


def resolve_provider_base_url(provider: str, agent_id: str | None = None) -> str | None:
    if agent_id:
        prefix = agent_env_prefix(agent_id)
        agent_url = os.getenv(f"{prefix}_BASE_URL") or os.getenv(f"CODEX_{agent_id.upper()}_BASE_URL")
        if agent_url:
            return agent_url
    if provider == "openai":
        cc_switch = load_codex_provider_config()
        return (
            os.getenv("CODEX_BASE_URL")
            or os.getenv("OPENAI_BASE_URL")
            or os.getenv("OPENAI_API_BASE")
            or (cc_switch.base_url if cc_switch else None)
        )
    return os.getenv(f"{provider.upper()}_BASE_URL")
