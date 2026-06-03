from __future__ import annotations

import importlib
import json
from pathlib import Path

from Agent import default_runtime


ROOT = Path(__file__).resolve().parent


def check_files() -> list[str]:
    required = [
        ROOT / "Agent.py",
        ROOT / "Model.py",
        ROOT / "LLM.py",
        ROOT / "RAG.py",
        ROOT / "server.py",
        ROOT / "quantumflow-mvp" / "index.html",
        ROOT / "quantumflow-mvp" / "styles.css",
        ROOT / "quantumflow-mvp" / "app.js",
    ]
    return [str(path) for path in required if not path.exists()]


def main() -> None:
    missing = check_files()
    if missing:
        raise SystemExit(f"Missing required files: {missing}")

    runtime = default_runtime()
    task = runtime.dispatch_next()
    if task is None:
        raise SystemExit("Expected one task to dispatch.")
    runtime.start_work(task.id)
    runtime.complete_task(task.id)

    snapshot = runtime.snapshot()
    json.dumps(snapshot, ensure_ascii=False)

    importlib.import_module("Model")
    importlib.import_module("RAG")
    importlib.import_module("LLM")
    importlib.import_module("server")
    importlib.import_module("storage")
    importlib.import_module("patch_service")

    print("QuantumFlow health check passed.")
    print(f"Agents: {len(snapshot['agents'])}")
    print(f"Tasks: {len(snapshot['tasks'])}")
    print(f"Events: {len(snapshot['events'])}")


if __name__ == "__main__":
    main()
