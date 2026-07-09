"""Tests for patch_service validation and history resilience."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import patch_service
from patch_service import read_history, validate_code_text


def test_validate_python_ok():
    result = validate_code_text("project/app/main.py", "def f():\n    return 1\n")
    assert result["ok"]
    assert result["language"] == "python"


def test_validate_python_syntax_error():
    result = validate_code_text("a.py", "def broken(:\n")
    assert not result["ok"]
    assert "syntax" in result["reason"].lower()


def test_validate_empty_rejected():
    assert not validate_code_text("a.py", "   ")["ok"]


def test_validate_nul_bytes_rejected():
    assert not validate_code_text("a.py", "x\x00y")["ok"]


def test_validate_json_ok_and_bad():
    assert validate_code_text("d.json", '{"a": 1}')["ok"]
    assert not validate_code_text("d.json", '{"a": }')["ok"]


def test_validate_js_balanced_pairs():
    assert validate_code_text("app.js", "function f(){ return [1,2]; }")["ok"]
    assert not validate_code_text("app.js", "function f({ return [1,2; }")["ok"]


def test_read_history_skips_corrupt_lines(tmp_path, monkeypatch):
    history = tmp_path / "history.jsonl"
    history.write_text(
        '{"a": 1}\n'
        "this is not json\n"
        '{"b": 2}\n',
        encoding="utf-8",
    )
    monkeypatch.setattr(patch_service, "HISTORY_PATH", history)
    entries = read_history(limit=10)
    # Corrupt middle line is skipped, valid ones returned (newest first).
    assert len(entries) == 2
    assert entries[0] == {"b": 2}


def test_read_history_missing_file(tmp_path, monkeypatch):
    monkeypatch.setattr(patch_service, "HISTORY_PATH", tmp_path / "nope.jsonl")
    assert read_history() == []
