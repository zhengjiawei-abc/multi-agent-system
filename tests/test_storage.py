"""Tests for storage connection lifecycle and audit logging."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from storage import SnapshotStore


@pytest.fixture
def store(tmp_path):
    return SnapshotStore(tmp_path / "test.db")


def test_connect_closes_and_commits(store):
    # Many sequential ops must not leak handles or fail to persist.
    for i in range(50):
        store.record_task_log(f"task-{i}", "frontend", "UI", "created", f"title {i}")
    logs = store.recent_task_logs(limit=10)
    assert len(logs) == 10


def test_connect_rolls_back_on_error(store, tmp_path):
    # Force an error inside the context manager; should rollback, not leak.
    with pytest.raises(Exception):
        with store._connect() as conn:
            conn.execute("CREATE TABLE temp_t (id INTEGER)")
            conn.execute("INSERT INTO temp_t VALUES (1)")
            raise RuntimeError("boom")
    # A fresh connection still works (handle was closed, db not locked).
    store.record_task_log("after", "backend", "API", "ok", "still works")
    assert store.recent_task_logs(limit=1)[0]["task_id"] == "after"


def test_code_artifact_roundtrip(store):
    artifact = store.record_code_artifact(
        "task-1", "frontend", "project/app.js", "console.log(1)", "test", status="validated"
    )
    assert artifact["id"]
    assert artifact["status"] == "validated"
    recent = store.recent_code_artifacts(limit=5)
    assert recent[0]["code_text"] == "console.log(1)"


def test_snapshot_save_and_recent(store):
    store.save({"agents": [], "tasks": [], "events": []})
    rows = store.recent(limit=5)
    assert len(rows) == 1


def test_wal_mode_enabled(store):
    with store._connect() as conn:
        mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
    assert mode.lower() == "wal"
