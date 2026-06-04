from __future__ import annotations

import json
import os
import sqlite3
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class CodexProviderConfig:
    provider_id: str
    name: str
    model: str | None = None
    base_url: str | None = None
    api_key: str | None = None


def load_codex_provider_config() -> CodexProviderConfig | None:
    cc_home = Path(os.getenv("CC_SWITCH_HOME") or Path.home() / ".cc-switch")
    provider_id = _current_codex_provider_id(cc_home)
    if not provider_id:
        return None

    db_path = cc_home / "cc-switch.db"
    if not db_path.exists():
        return None

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT id, name, settings_config FROM providers WHERE id = ? AND app_type = 'codex' LIMIT 1",
            (provider_id,),
        ).fetchone()
        endpoint = conn.execute(
            "SELECT url FROM provider_endpoints WHERE provider_id = ? AND app_type = 'codex' ORDER BY added_at DESC LIMIT 1",
            (provider_id,),
        ).fetchone()
    except sqlite3.Error:
        return None
    finally:
        try:
            conn.close()
        except Exception:
            pass

    if not row:
        return None

    settings = _json_object(row["settings_config"])
    auth = settings.get("auth") if isinstance(settings.get("auth"), dict) else {}
    config_text = settings.get("config") if isinstance(settings.get("config"), str) else ""
    config = _toml_object(config_text)
    model = _string_or_none(config.get("model"))
    base_url = _base_url_from_codex_config(config) or _string_or_none(endpoint["url"] if endpoint else None)
    api_key = _first_string(
        auth.get("OPENAI_API_KEY"),
        auth.get("CODEX_API_KEY"),
        auth.get("apiKey"),
        auth.get("api_key"),
    )

    return CodexProviderConfig(
        provider_id=str(row["id"]),
        name=str(row["name"] or "cc-switch"),
        model=model,
        base_url=base_url,
        api_key=api_key,
    )


def _current_codex_provider_id(cc_home: Path) -> str | None:
    settings_path = cc_home / "settings.json"
    data = _read_json_file(settings_path)
    provider_id = _string_or_none(data.get("currentProviderCodex")) if data else None
    if provider_id:
        return provider_id

    db_path = cc_home / "cc-switch.db"
    if not db_path.exists():
        return None
    try:
        conn = sqlite3.connect(db_path)
        row = conn.execute(
            "SELECT id FROM providers WHERE app_type = 'codex' AND is_current = 1 LIMIT 1"
        ).fetchone()
        return str(row[0]) if row else None
    except sqlite3.Error:
        return None
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _base_url_from_codex_config(config: dict[str, Any]) -> str | None:
    provider_name = _string_or_none(config.get("model_provider"))
    providers = config.get("model_providers")
    if isinstance(providers, dict):
        if provider_name and isinstance(providers.get(provider_name), dict):
            url = _string_or_none(providers[provider_name].get("base_url"))
            if url:
                return url
        for provider in providers.values():
            if isinstance(provider, dict):
                url = _string_or_none(provider.get("base_url"))
                if url:
                    return url
    return None


def _read_json_file(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str) or not value.strip():
        return {}
    try:
        data = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def _toml_object(value: str) -> dict[str, Any]:
    if not value.strip():
        return {}
    try:
        data = tomllib.loads(value)
    except tomllib.TOMLDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def _first_string(*values: Any) -> str | None:
    for value in values:
        text = _string_or_none(value)
        if text:
            return text
    return None


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
