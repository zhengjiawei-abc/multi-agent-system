"""QuantumFlow Orchestrator — OpenClaw-aligned resilience layer.

This module turns the choreographed "fake" multi-agent pipeline into a real one:
each agent call goes through the LLM (via LLM.invoke_agent) with retries,
exponential backoff, a per-agent circuit breaker, idempotency keys, and a
graceful template fallback so the product still works without API keys.

Design notes (see Multi-Agent/docs/multi-agent-design.md):
- Stateless orchestrator over an in-process asyncio queue (single-host scale).
- Specialized agents share one base model but differ by role prompt + temperature.
- Routing combines static keyword scoring with live load + historical success.
- Errors use idempotent retries with backoff (1s, 4s, 15s) + circuit breaker.
"""

from __future__ import annotations

import hashlib
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional


# Exponential backoff schedule (seconds). Mirrors OpenClaw's retry queue tiers.
BACKOFF_SCHEDULE = (1.0, 4.0, 15.0)
# Circuit breaker: stop calling an agent after N failures within WINDOW seconds.
BREAKER_FAILURE_THRESHOLD = 5
BREAKER_WINDOW_SECONDS = 600.0
BREAKER_COOLDOWN_SECONDS = 120.0


@dataclass
class AgentHealth:
    """Live health + load for one agent, used by routing and the breaker."""

    success: int = 0
    failure: int = 0
    in_flight: int = 0
    recent_failures: list[float] = field(default_factory=list)
    opened_at: Optional[float] = None

    def success_rate(self) -> float:
        total = self.success + self.failure
        return 1.0 if total == 0 else self.success / total


class CircuitBreaker:
    """Per-agent circuit breaker with a rolling failure window."""

    def __init__(self) -> None:
        self._health: Dict[str, AgentHealth] = {}
        self._lock = threading.Lock()

    def health(self, agent_id: str) -> AgentHealth:
        with self._lock:
            return self._health.setdefault(agent_id, AgentHealth())

    def is_open(self, agent_id: str, now: Optional[float] = None) -> bool:
        now = now or time.time()
        health = self.health(agent_id)
        with self._lock:
            if health.opened_at is None:
                return False
            if now - health.opened_at >= BREAKER_COOLDOWN_SECONDS:
                # Half-open: allow a probe call and reset the failure trail.
                health.opened_at = None
                health.recent_failures.clear()
                return False
            return True

    def record_success(self, agent_id: str) -> None:
        health = self.health(agent_id)
        with self._lock:
            health.success += 1
            health.recent_failures.clear()
            health.opened_at = None

    def record_failure(self, agent_id: str, now: Optional[float] = None) -> None:
        now = now or time.time()
        health = self.health(agent_id)
        with self._lock:
            health.failure += 1
            health.recent_failures = [
                ts for ts in health.recent_failures if now - ts < BREAKER_WINDOW_SECONDS
            ]
            health.recent_failures.append(now)
            if len(health.recent_failures) >= BREAKER_FAILURE_THRESHOLD:
                health.opened_at = now

    def enter(self, agent_id: str) -> None:
        health = self.health(agent_id)
        with self._lock:
            health.in_flight += 1

    def leave(self, agent_id: str) -> None:
        health = self.health(agent_id)
        with self._lock:
            health.in_flight = max(0, health.in_flight - 1)

    def snapshot(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            return {
                agent_id: {
                    "success": h.success,
                    "failure": h.failure,
                    "in_flight": h.in_flight,
                    "success_rate": round(h.success_rate(), 3),
                    "circuit_open": h.opened_at is not None,
                }
                for agent_id, h in self._health.items()
            }


# Module-level singleton: the runtime is one process, so one breaker is enough.
breaker = CircuitBreaker()
# Idempotency cache: correlation_id -> produced result, prevents duplicate work.
_idempotency_cache: Dict[str, str] = {}
_idempotency_lock = threading.Lock()


ROLE_BRIEF = {
    "master": "你是团队负责人，负责拆解需求并输出项目 README / 整合说明。",
    "frontend": "你是前端工程师，输出可运行的界面与交互代码。",
    "backend": "你是后端工程师，输出可运行的 API、数据模型与服务代码。",
    "tester": "你是测试工程师，输出针对该功能、可直接执行的测试代码。",
    "reviewer": "你是代码审查者，输出 Markdown 审查清单与关键风险点。",
}


def correlation_id(task_id: str, agent_id: str, step: str = "") -> str:
    """Idempotency key built from task + agent + step (OpenClaw pattern)."""
    raw = f"{task_id}|{agent_id}|{step}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def build_prompt(agent_id: str, title: str, target_key: str) -> str:
    brief = ROLE_BRIEF.get(agent_id, "你是一名工程师，输出可运行的代码。")
    suffix = target_key.rsplit(".", 1)[-1] if "." in target_key else "txt"
    return (
        f"{brief}\n\n"
        f"任务标题：{title}\n"
        f"目标文件：{target_key}（类型 .{suffix}）\n\n"
        "要求：\n"
        "- 只输出该文件的完整内容，不要解释、不要 Markdown 代码围栏。\n"
        "- 代码必须可直接运行，命名清晰，包含必要的注释。\n"
        "- 不要输出任何 API Key、token 或密钥。\n"
    )


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines).strip()
    return stripped


def generate_agent_code(
    agent_id: str,
    task_id: str,
    title: str,
    target_key: str,
    fallback: Callable[[], str],
    step: str = "",
) -> Dict[str, Any]:
    """Produce code for one agent through the LLM with full resilience.

    Returns a dict: {code, source, attempts, correlation_id, error}.
    `source` is one of: "llm", "cache", "fallback".
    Never raises — on exhausted retries or an open breaker it returns the
    template fallback so the pipeline always completes.
    """
    from LLM import MissingModelKey, invoke_agent  # local import avoids cycle

    cid = correlation_id(task_id, agent_id, step)
    with _idempotency_lock:
        if cid in _idempotency_cache:
            return {
                "code": _idempotency_cache[cid],
                "source": "cache",
                "attempts": 0,
                "correlation_id": cid,
                "error": None,
            }

    def finish(code: str, source: str, attempts: int, error: Optional[str]) -> Dict[str, Any]:
        if code.strip():
            with _idempotency_lock:
                _idempotency_cache[cid] = code
        return {
            "code": code,
            "source": source,
            "attempts": attempts,
            "correlation_id": cid,
            "error": error,
        }

    if breaker.is_open(agent_id):
        return finish(fallback(), "fallback", 0, "circuit_open")

    prompt = build_prompt(agent_id, title, target_key)
    breaker.enter(agent_id)
    last_error: Optional[str] = None
    try:
        for attempt in range(len(BACKOFF_SCHEDULE) + 1):
            try:
                raw = invoke_agent(agent_id, prompt)
                code = _strip_code_fence(raw)
                if not code.strip():
                    raise ValueError("empty LLM response")
                breaker.record_success(agent_id)
                return finish(code, "llm", attempt + 1, None)
            except (MissingModelKey, ImportError) as exc:
                # Non-transient (no key / missing dependency): don't burn
                # retries, fall back to the template immediately.
                return finish(fallback(), "fallback", attempt + 1, str(exc))
            except Exception as exc:  # noqa: BLE001 - resilience boundary
                last_error = str(exc)
                if _is_non_transient(last_error):
                    return finish(fallback(), "fallback", attempt + 1, last_error)
                breaker.record_failure(agent_id)
                if attempt < len(BACKOFF_SCHEDULE):
                    time.sleep(BACKOFF_SCHEDULE[attempt])
        return finish(fallback(), "fallback", len(BACKOFF_SCHEDULE) + 1, last_error)
    finally:
        breaker.leave(agent_id)


def _is_non_transient(message: str) -> bool:
    """Errors that retrying cannot fix — fail fast instead of backing off."""
    lowered = message.lower()
    markers = (
        "requires the",
        "pip install",
        "no module named",
        "not installed",
        "invalid api key",
        "incorrect api key",
        "authentication",
        "unauthorized",
        "401",
        "model_not_found",
    )
    return any(marker in lowered for marker in markers)


def route_score(base_score: float, agent_id: str) -> Dict[str, Any]:
    """Adjust a keyword base score by live success rate and current load.

    OpenClaw picks "the best agent based on load and historical success rate".
    We keep keyword affinity as the primary signal, then nudge by health:
    higher success rate and lower in-flight load raise the effective score.
    A tripped circuit breaker heavily penalizes the agent.
    """
    health = breaker.health(agent_id)
    success_rate = health.success_rate()
    load_penalty = 1.0 / (1.0 + health.in_flight)
    breaker_penalty = 0.2 if breaker.is_open(agent_id) else 1.0
    effective = round(base_score * (0.5 + 0.5 * success_rate) * load_penalty * breaker_penalty, 3)
    return {
        "effective_score": effective,
        "success_rate": round(success_rate, 3),
        "in_flight": health.in_flight,
        "circuit_open": breaker.is_open(agent_id),
    }
