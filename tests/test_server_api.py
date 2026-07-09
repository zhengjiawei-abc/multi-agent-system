"""Integration tests for the QuantumFlow server API via TestClient."""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import server


@pytest.fixture
def client():
    with TestClient(server.app) as c:
        yield c


def test_snapshot_endpoint(client):
    resp = client.get("/api/snapshot")
    assert resp.status_code == 200
    data = resp.json()
    assert "agents" in data
    assert "tasks" in data
    assert "queue" in data


def test_agents_health_endpoint(client):
    resp = client.get("/api/agents/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert "agents" in body


def test_arbitrate_returns_routing_fields(client):
    resp = client.post("/api/agents/arbitrate", json={"title": "实现后端 api 数据库接口"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["recommended_agent"] == "backend"
    top = data["scores"][0]
    for field in ("score", "base_score", "success_rate", "in_flight", "circuit_open"):
        assert field in top


def test_arbitrate_requires_title(client):
    assert client.post("/api/agents/arbitrate", json={}).status_code == 400


def test_create_task_runs_pipeline(client):
    resp = client.post(
        "/api/tasks",
        json={"title": "做一个图书管理系统前端 vue 页面", "owner_id": "master", "source": "desktop"},
    )
    assert resp.status_code == 200
    # Pipeline runs via background asyncio; poll for artifacts.
    artifacts = []
    for _ in range(40):
        artifacts = client.get("/api/code-artifacts?limit=8").json()
        if artifacts:
            break
        time.sleep(0.25)
    assert artifacts, "pipeline produced no code artifacts"
    # Every artifact carries an explanation noting its source (llm/cache/fallback).
    assert all("explanation" in a for a in artifacts)


def test_create_task_rejects_unknown_owner(client):
    resp = client.post("/api/tasks", json={"title": "x", "owner_id": "nobody"})
    assert resp.status_code == 400


def test_reset_endpoint(client):
    assert client.post("/api/reset").status_code == 200
