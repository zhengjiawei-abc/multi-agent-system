"""Tests for the OpenClaw-aligned orchestrator resilience layer."""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import orchestrator
from orchestrator import CircuitBreaker, breaker, generate_agent_code, route_score


@pytest.fixture(autouse=True)
def reset_state():
    """Each test starts with a clean breaker + idempotency cache."""
    orchestrator._idempotency_cache.clear()
    breaker._health.clear()
    yield
    orchestrator._idempotency_cache.clear()
    breaker._health.clear()


def test_correlation_id_is_stable_and_unique():
    a = orchestrator.correlation_id("task-1", "frontend", "step")
    b = orchestrator.correlation_id("task-1", "frontend", "step")
    c = orchestrator.correlation_id("task-1", "backend", "step")
    assert a == b
    assert a != c
    assert len(a) == 16


def test_strip_code_fence_removes_markdown():
    fenced = "```python\nprint('hi')\n```"
    assert orchestrator._strip_code_fence(fenced) == "print('hi')"
    assert orchestrator._strip_code_fence("plain code") == "plain code"


def test_non_transient_detection():
    assert orchestrator._is_non_transient("Invalid API key provided")
    assert orchestrator._is_non_transient("No module named 'langchain_openai'")
    assert orchestrator._is_non_transient("401 Unauthorized")
    assert not orchestrator._is_non_transient("connection reset by peer")


def test_circuit_breaker_opens_after_threshold():
    cb = CircuitBreaker()
    for _ in range(orchestrator.BREAKER_FAILURE_THRESHOLD):
        cb.record_failure("backend")
    assert cb.is_open("backend")


def test_circuit_breaker_half_open_after_cooldown(monkeypatch):
    cb = CircuitBreaker()
    base = 1000.0
    for _ in range(orchestrator.BREAKER_FAILURE_THRESHOLD):
        cb.record_failure("backend", now=base)
    assert cb.is_open("backend", now=base)
    # After cooldown the breaker half-opens (allows a probe).
    later = base + orchestrator.BREAKER_COOLDOWN_SECONDS + 1
    assert not cb.is_open("backend", now=later)


def test_circuit_breaker_resets_on_success():
    cb = CircuitBreaker()
    for _ in range(orchestrator.BREAKER_FAILURE_THRESHOLD):
        cb.record_failure("tester")
    assert cb.is_open("tester")
    cb.record_success("tester")
    assert not cb.is_open("tester")


def test_generate_uses_llm_when_available(monkeypatch):
    monkeypatch.setattr("LLM.invoke_agent", lambda agent_id, prompt: "GENERATED CODE")
    result = generate_agent_code(
        "frontend", "task-llm", "build ui", "project/app.js",
        fallback=lambda: "TEMPLATE",
    )
    assert result["source"] == "llm"
    assert result["code"] == "GENERATED CODE"
    assert result["attempts"] == 1


def test_generate_falls_back_on_missing_key(monkeypatch):
    from LLM import MissingModelKey

    def boom(agent_id, prompt):
        raise MissingModelKey("no key")

    monkeypatch.setattr("LLM.invoke_agent", boom)
    result = generate_agent_code(
        "backend", "task-nokey", "build api", "project/main.py",
        fallback=lambda: "TEMPLATE FALLBACK",
    )
    assert result["source"] == "fallback"
    assert result["code"] == "TEMPLATE FALLBACK"
    assert result["attempts"] == 1  # no wasted retries


def test_generate_retries_transient_then_falls_back(monkeypatch):
    calls = {"n": 0}

    def flaky(agent_id, prompt):
        calls["n"] += 1
        raise RuntimeError("connection reset")

    monkeypatch.setattr("LLM.invoke_agent", flaky)
    monkeypatch.setattr(orchestrator, "BACKOFF_SCHEDULE", (0.0, 0.0))  # no real sleep
    result = generate_agent_code(
        "tester", "task-flaky", "tests", "project/test.py",
        fallback=lambda: "FALLBACK",
    )
    assert result["source"] == "fallback"
    assert calls["n"] == 3  # 1 initial + 2 retries
    assert breaker.health("tester").failure == 3


def test_generate_idempotency_cache(monkeypatch):
    calls = {"n": 0}

    def once(agent_id, prompt):
        calls["n"] += 1
        return "FIRST"

    monkeypatch.setattr("LLM.invoke_agent", once)
    r1 = generate_agent_code("frontend", "task-idem", "x", "a.js", fallback=lambda: "F")
    r2 = generate_agent_code("frontend", "task-idem", "x", "a.js", fallback=lambda: "F")
    assert r1["source"] == "llm"
    assert r2["source"] == "cache"
    assert calls["n"] == 1  # second call served from cache


def test_route_score_penalizes_open_breaker():
    healthy = route_score(5.0, "frontend")
    for _ in range(orchestrator.BREAKER_FAILURE_THRESHOLD):
        breaker.record_failure("backend")
    tripped = route_score(5.0, "backend")
    assert tripped["circuit_open"] is True
    assert tripped["effective_score"] < healthy["effective_score"]
