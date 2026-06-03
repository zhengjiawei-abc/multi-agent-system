from __future__ import annotations

import ast
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List


ROOT = Path(__file__).resolve().parent
PATCH_ROOT = ROOT / "patches"
BACKUP_ROOT = PATCH_ROOT / "backups"
HISTORY_PATH = PATCH_ROOT / "history.jsonl"
PATCH_ROOT.mkdir(exist_ok=True)
BACKUP_ROOT.mkdir(exist_ok=True)


ALLOWED_FILES = {
    "runtime/server.py": ROOT / "server.py",
    "runtime/Agent.py": ROOT / "Agent.py",
    "runtime/connectors.py": ROOT / "connectors.py",
    "desktop/app.js": ROOT / "quantumflow-mvp" / "app.js",
    "desktop/styles.css": ROOT / "quantumflow-mvp" / "styles.css",
    "desktop/index.html": ROOT / "quantumflow-mvp" / "index.html",
    "sandbox/notes.py": PATCH_ROOT / "sandbox_notes.py",
}


@dataclass
class PatchCandidate:
    target_key: str
    target_path: Path
    suggestion: str
    next_text: str
    preview_lines: List[str]


def resolve_target(target_key: str) -> Path:
    if target_key not in ALLOWED_FILES:
        raise ValueError(f"Target is not allowed: {target_key}")
    path = ALLOWED_FILES[target_key].resolve()
    if not str(path).startswith(str(ROOT.resolve())):
        raise ValueError("Resolved target escaped workspace.")
    return path


def build_candidate(target_key: str, suggestion: str) -> PatchCandidate:
    target_path = resolve_target(target_key)
    current = target_path.read_text(encoding="utf-8")
    block = suggestion_to_block(target_path, suggestion)
    next_text = current.rstrip() + "\n\n" + block + "\n"
    preview = block.splitlines()
    return PatchCandidate(target_key, target_path, suggestion, next_text, preview)


def suggestion_to_block(target_path: Path, suggestion: str) -> str:
    safe = suggestion.strip().replace("\r", " ")
    suffix = target_path.suffix.lower()
    if suffix == ".py":
        return "\n".join(
            [
                "# QuantumFlow accepted review suggestion",
                f"# {safe}",
                "def quantumflow_review_note():",
                f"    return {safe!r}",
            ]
        )
    if suffix == ".js":
        return "\n".join(
            [
                "// QuantumFlow accepted review suggestion",
                f"// {safe}",
                "const quantumflowReviewNote = " + repr(safe) + ";",
            ]
        )
    if suffix == ".css":
        return "\n".join(["/* QuantumFlow accepted review suggestion", f"   {safe}", "*/"])
    if suffix == ".html":
        return f"<!-- QuantumFlow accepted review suggestion: {safe} -->"
    return f"# QuantumFlow accepted review suggestion: {safe}"


def validate_candidate(candidate: PatchCandidate) -> Dict[str, object]:
    suffix = candidate.target_path.suffix.lower()
    if not candidate.suggestion.strip():
        return {"ok": False, "reason": "Suggestion is empty."}
    if "syntax_error" in candidate.suggestion or "报错" in candidate.suggestion:
        return {"ok": False, "reason": "Suggestion contains an explicit error marker."}
    if suffix == ".py":
        try:
            ast.parse(candidate.next_text)
        except SyntaxError as exc:
            return {"ok": False, "reason": f"Python syntax failed: {exc.msg}"}
    if suffix == ".js":
        bracket_result = validate_balanced_pairs(candidate.next_text)
        if not bracket_result["ok"]:
            return bracket_result
    if suffix == ".css":
        if candidate.next_text.count("{") != candidate.next_text.count("}"):
            return {"ok": False, "reason": "CSS brace mismatch."}
    if suffix == ".html":
        for tag in ["div", "section", "article", "button", "form"]:
            opens = candidate.next_text.count(f"<{tag}")
            closes = candidate.next_text.count(f"</{tag}>")
            if closes > opens:
                return {"ok": False, "reason": f"HTML closing tag mismatch: {tag}"}
    return {"ok": True, "reason": "Validation passed."}


def apply_candidate(candidate: PatchCandidate) -> Dict[str, object]:
    validation = validate_candidate(candidate)
    if not validation["ok"]:
        return validation

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = BACKUP_ROOT / f"{candidate.target_path.name}.{timestamp}.bak"
    backup_path.write_text(candidate.target_path.read_text(encoding="utf-8"), encoding="utf-8")
    candidate.target_path.write_text(candidate.next_text, encoding="utf-8")
    result = {
        "ok": True,
        "reason": "Patch applied.",
        "backup": str(backup_path),
        "target": str(candidate.target_path),
    }
    record_history(candidate, result)
    return result


def validate_balanced_pairs(text: str) -> Dict[str, object]:
    stack: List[str] = []
    pairs = {"(": ")", "{": "}", "[": "]"}
    closing = set(pairs.values())
    in_string: str | None = None
    escaped = False

    for char in text:
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == in_string:
                in_string = None
            continue
        if char in {"'", '"', "`"}:
            in_string = char
            continue
        if char in pairs:
            stack.append(pairs[char])
        elif char in closing:
            if not stack or stack.pop() != char:
                return {"ok": False, "reason": f"JavaScript bracket mismatch near {char}."}
    if stack:
        return {"ok": False, "reason": "JavaScript bracket mismatch: unclosed bracket."}
    return {"ok": True, "reason": "Validation passed."}


def record_history(candidate: PatchCandidate, result: Dict[str, object]) -> None:
    entry = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "target_key": candidate.target_key,
        "target": str(candidate.target_path),
        "suggestion": candidate.suggestion,
        "result": result,
    }
    with HISTORY_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


def read_history(limit: int = 20) -> List[Dict[str, object]]:
    if not HISTORY_PATH.exists():
        return []
    lines = HISTORY_PATH.read_text(encoding="utf-8").splitlines()
    entries = [json.loads(line) for line in lines if line.strip()]
    return entries[-limit:][::-1]
