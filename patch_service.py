from __future__ import annotations

import ast
import hashlib
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

ALLOWED_ROOTS = [
    ROOT,
    ROOT / "quantumflow-mvp",
    ROOT / "desktop-electron",
    ROOT / "generated_repos",
    PATCH_ROOT,
]

EXCLUDED_PARTS = {
    ".git",
    ".agents",
    ".codex",
    ".venv",
    "__pycache__",
    "node_modules",
    "release",
    "tmp_git_source_for_sync.git",
}

BINARY_EXTENSIONS = {
    ".7z",
    ".bin",
    ".bmp",
    ".db",
    ".dll",
    ".exe",
    ".gif",
    ".ico",
    ".jar",
    ".jpg",
    ".jpeg",
    ".pdf",
    ".png",
    ".pyc",
    ".sqlite",
    ".webp",
    ".zip",
}

LANGUAGE_BY_EXTENSION = {
    ".bat": "batch",
    ".c": "c",
    ".cc": "cpp",
    ".cmake": "cmake",
    ".cpp": "cpp",
    ".cs": "csharp",
    ".css": "css",
    ".csv": "csv",
    ".dart": "dart",
    ".go": "go",
    ".h": "c",
    ".hpp": "cpp",
    ".html": "html",
    ".java": "java",
    ".js": "javascript",
    ".json": "json",
    ".jsx": "javascript",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".lua": "lua",
    ".md": "markdown",
    ".php": "php",
    ".ps1": "powershell",
    ".py": "python",
    ".rb": "ruby",
    ".rs": "rust",
    ".sh": "shell",
    ".sql": "sql",
    ".svelte": "svelte",
    ".swift": "swift",
    ".toml": "toml",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".txt": "text",
    ".vue": "vue",
    ".xml": "xml",
    ".yaml": "yaml",
    ".yml": "yaml",
}

COMMENT_STYLES = {
    "html": ("<!--", "-->"),
    "markdown": ("<!--", "-->"),
    "svelte": ("<!--", "-->"),
    "vue": ("<!--", "-->"),
    "xml": ("<!--", "-->"),
    "css": ("/*", "*/"),
    "c": ("//", ""),
    "cpp": ("//", ""),
    "csharp": ("//", ""),
    "dart": ("//", ""),
    "go": ("//", ""),
    "java": ("//", ""),
    "javascript": ("//", ""),
    "kotlin": ("//", ""),
    "lua": ("--", ""),
    "php": ("//", ""),
    "rust": ("//", ""),
    "swift": ("//", ""),
    "typescript": ("//", ""),
    "batch": ("REM", ""),
    "powershell": ("#", ""),
    "python": ("#", ""),
    "ruby": ("#", ""),
    "shell": ("#", ""),
    "toml": ("#", ""),
    "yaml": ("#", ""),
}


@dataclass
class PatchCandidate:
    target_key: str
    target_path: Path
    suggestion: str
    next_text: str
    preview_lines: List[str]
    base_hash: str
    language: str


def resolve_target(target_key: str) -> Path:
    normalized_key = normalize_target_key(target_key)
    if normalized_key in ALLOWED_FILES:
        path = ALLOWED_FILES[normalized_key].resolve()
    else:
        path = (ROOT / normalized_key).resolve()

    if not is_allowed_path(path):
        raise ValueError("Resolved target escaped workspace.")
    if any(part in EXCLUDED_PARTS for part in path.relative_to(ROOT.resolve()).parts):
        raise ValueError(f"Target is in an excluded project area: {target_key}")
    if is_binary_path(path):
        raise ValueError(f"Binary target is not supported for text patching: {target_key}")
    return path


def build_candidate(target_key: str, suggestion: str, base_hash: str | None = None) -> PatchCandidate:
    target_path = resolve_target(target_key)
    current = target_path.read_text(encoding="utf-8") if target_path.exists() else ""
    current_hash = text_hash(current)
    block = suggestion_to_block(target_path, suggestion)
    next_text = current.rstrip() + "\n\n" + block + "\n"
    preview = block.splitlines()
    return PatchCandidate(
        normalize_target_key(target_key),
        target_path,
        suggestion,
        next_text,
        preview,
        base_hash or current_hash,
        language_for_path(target_path),
    )


def suggestion_to_block(target_path: Path, suggestion: str) -> str:
    safe = " ".join(suggestion.strip().replace("\r", " ").splitlines())
    language = language_for_path(target_path)
    if language == "python":
        return "\n".join(
            [
                "# QuantumFlow accepted review suggestion",
                f"# {safe}",
                "def quantumflow_review_note():",
                f"    return {safe!r}",
            ]
        )
    if language in {"javascript", "typescript"}:
        return "\n".join(
            [
                "// QuantumFlow accepted review suggestion",
                f"// {safe}",
                "const quantumflowReviewNote = " + repr(safe) + ";",
            ]
        )
    opener, closer = COMMENT_STYLES.get(language, ("#", ""))
    if closer:
        return f"{opener} QuantumFlow accepted review suggestion: {safe} {closer}"
    return f"{opener} QuantumFlow accepted review suggestion: {safe}"


def validate_candidate(candidate: PatchCandidate) -> Dict[str, object]:
    if not candidate.suggestion.strip():
        return {"ok": False, "reason": "Suggestion is empty.", "language": candidate.language}
    if "syntax_error" in candidate.suggestion.lower():
        return {"ok": False, "reason": "Suggestion contains an explicit error marker.", "language": candidate.language}

    current_text = candidate.target_path.read_text(encoding="utf-8") if candidate.target_path.exists() else ""
    if candidate.base_hash != text_hash(current_text):
        return {
            "ok": False,
            "reason": "Target changed after preview; refresh candidate to avoid overwriting concurrent work.",
            "code": "STALE_BASE",
            "language": candidate.language,
        }
    return validate_code_text(candidate.target_path, candidate.next_text)


def apply_candidate(candidate: PatchCandidate) -> Dict[str, object]:
    validation = validate_candidate(candidate)
    if not validation["ok"]:
        return validation

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = BACKUP_ROOT / f"{candidate.target_path.name}.{timestamp}.bak"
    if candidate.target_path.exists():
        backup_path.write_text(candidate.target_path.read_text(encoding="utf-8"), encoding="utf-8")
    candidate.target_path.parent.mkdir(parents=True, exist_ok=True)
    candidate.target_path.write_text(candidate.next_text, encoding="utf-8")
    result = {
        "ok": True,
        "reason": "Patch applied.",
        "backup": str(backup_path),
        "target": str(candidate.target_path),
        "language": candidate.language,
        "content_hash": text_hash(candidate.next_text),
    }
    record_history(candidate, result)
    return result


def validate_code_text(path_or_key: Path | str, text: str) -> Dict[str, object]:
    language = language_for_path(path_or_key)
    if not text.strip():
        return {"ok": False, "reason": "Code text is empty.", "language": language}
    if "\x00" in text:
        return {"ok": False, "reason": "Code text contains NUL bytes.", "language": language}
    if language == "python":
        try:
            ast.parse(text)
        except SyntaxError as exc:
            return {"ok": False, "reason": f"Python syntax failed: {exc.msg}", "language": language}
    if language in {"javascript", "typescript", "css", "c", "cpp", "csharp", "dart", "go", "java", "kotlin", "php", "rust", "swift"}:
        bracket_result = validate_balanced_pairs(text)
        if not bracket_result["ok"]:
            bracket_result["language"] = language
            return bracket_result
    if language == "json":
        try:
            json.loads(text)
        except json.JSONDecodeError as exc:
            return {"ok": False, "reason": f"JSON syntax failed: line {exc.lineno}", "language": language}
    if language == "html":
        for tag in ["div", "section", "article", "button", "form"]:
            opens = text.count(f"<{tag}")
            closes = text.count(f"</{tag}>")
            if closes > opens:
                return {"ok": False, "reason": f"HTML closing tag mismatch: {tag}", "language": language}
    return {"ok": True, "reason": f"{language} compatibility validation passed.", "language": language}


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
                return {"ok": False, "reason": f"Bracket mismatch near {char}."}
    if stack:
        return {"ok": False, "reason": "Bracket mismatch: unclosed bracket."}
    return {"ok": True, "reason": "Balanced pair validation passed."}


def normalize_target_key(target_key: str) -> str:
    key = str(target_key or "").strip().replace("\\", "/").lstrip("/")
    if not key:
        raise ValueError("target_key is required.")
    return key


def is_allowed_path(path: Path) -> bool:
    resolved = path.resolve()
    return any(is_relative_to(resolved, root.resolve()) for root in ALLOWED_ROOTS)


def is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
    except ValueError:
        return False
    return True


def is_binary_path(path: Path) -> bool:
    return path.suffix.lower() in BINARY_EXTENSIONS


def language_for_path(path_or_key: Path | str) -> str:
    path = Path(path_or_key)
    name = path.name.lower()
    if name in {"dockerfile", "makefile", "readme", "license"}:
        return name
    return LANGUAGE_BY_EXTENSION.get(path.suffix.lower(), "text")


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def record_history(candidate: PatchCandidate, result: Dict[str, object]) -> None:
    entry = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "target_key": candidate.target_key,
        "target": str(candidate.target_path),
        "suggestion": candidate.suggestion,
        "base_hash": candidate.base_hash,
        "language": candidate.language,
        "result": result,
    }
    with HISTORY_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


def read_history(limit: int = 20) -> List[Dict[str, object]]:
    if not HISTORY_PATH.exists():
        return []
    lines = HISTORY_PATH.read_text(encoding="utf-8").splitlines()
    entries: List[Dict[str, object]] = []
    for line in lines:
        if not line.strip():
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            # Skip a single corrupt line instead of failing the whole read.
            continue
    return entries[-limit:][::-1]
