from __future__ import annotations

import os
from typing import Any

from langchain.chat_models import init_chat_model

from cc_switch_config import load_codex_provider_config
from Model import (
    ModelProfile,
    env_key_for_provider,
    has_provider_key,
    profile_for_agent,
    resolve_provider_base_url,
    resolve_provider_key,
)


class MissingModelKey(RuntimeError):
    pass


def active_codex_model_name() -> str:
    profile = profile_for_agent("master")
    return profile.model


def active_codex_provider_summary() -> dict[str, str | bool | None]:
    config = load_codex_provider_config()
    return {
        "model": active_codex_model_name(),
        "provider": config.name if config else "environment",
        "base_url": resolve_provider_base_url("openai", "master"),
        "has_api_key": bool(resolve_provider_key("openai", "master")),
    }


def build_chat_model(profile: ModelProfile, agent_id: str | None = None) -> Any:
    provider_key = resolve_provider_key(profile.provider, agent_id)
    if not provider_key and not has_provider_key(profile.provider):
        key_name = env_key_for_provider(profile.provider)
        fallback = " or CODEX_API_KEY" if profile.provider == "openai" else ""
        raise MissingModelKey(f"Missing {key_name}{fallback}; set it before calling {profile.provider}:{profile.model}.")

    if profile.provider == "openai" and provider_key:
        os.environ["OPENAI_API_KEY"] = provider_key
        os.environ["CODEX_API_KEY"] = provider_key
        base_url = resolve_provider_base_url("openai", agent_id)
        if base_url:
            os.environ["OPENAI_BASE_URL"] = base_url
            os.environ["OPENAI_API_BASE"] = base_url

    model_id = profile.model
    kwargs = {
        "temperature": profile.temperature,
        "max_tokens": profile.max_tokens,
    }
    if profile.provider == "openai":
        model_id = f"openai:{profile.model}"
    else:
        kwargs["model_provider"] = profile.provider

    return init_chat_model(model_id, **kwargs)


def invoke_agent(agent_id: str, prompt: str) -> str:
    profile = profile_for_agent(agent_id)
    model = build_chat_model(profile, agent_id)
    response = model.invoke(prompt)
    return getattr(response, "content", str(response))


def invoke_codex_rag(question: str, rag_context: str) -> str:
    prompt = f"""你是 QuantumFlow 里的 Codex AI Assistant。
请用中文回答，语气简洁、工程化、可执行。
必须优先遵循 RAG 上下文；如果上下文不足，明确说明你是在基于当前系统设计做推断。
不要泄露或复述任何 API Key、token、secret。

RAG 上下文：
{rag_context or "暂无额外片段。"}

用户问题：
{question}
"""
    return invoke_agent("master", prompt).strip()


if __name__ == "__main__":
    try:
        print(invoke_agent("frontend", "用一句话说明 QuantumFlow 是什么。"))
    except MissingModelKey as exc:
        print(exc)
