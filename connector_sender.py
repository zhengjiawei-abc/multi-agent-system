from __future__ import annotations

import json
import os
from pathlib import Path
import urllib.error
import urllib.request
from typing import Any, Dict


ROOT = Path(__file__).resolve().parent
CONNECTOR_CONFIG_PATH = ROOT / "connector.config.json"


def send_connector_message(message: Dict[str, Any]) -> Dict[str, Any]:
    connector = str(message.get("connector") or "")
    payload = message.get("payload") if isinstance(message.get("payload"), dict) else {}
    if connector == "feishu":
        return send_feishu_message(payload)
    if connector == "wecom":
        return send_wecom_message(payload)
    return {
        "ok": True,
        "mode": "dry_run",
        "reason": f"No sender configured for connector: {connector}",
        "text": payload.get("text", ""),
    }


def send_feishu_message(payload: Dict[str, Any]) -> Dict[str, Any]:
    webhook = connector_config().get("feishu_webhook_url") or os.getenv("FEISHU_WEBHOOK_URL", "").strip()
    body = {
        "msg_type": "text",
        "content": {"text": str(payload.get("text") or payload.get("title") or "QuantumFlow update")},
    }
    if not webhook:
        return {"ok": True, "mode": "dry_run", "reason": "FEISHU_WEBHOOK_URL is not configured.", "body": body}
    return post_json(webhook, body)


def send_wecom_message(payload: Dict[str, Any]) -> Dict[str, Any]:
    webhook = connector_config().get("wecom_webhook_url") or os.getenv("WECOM_WEBHOOK_URL", "").strip()
    body = {
        "msgtype": "text",
        "text": {"content": str(payload.get("text") or payload.get("title") or "QuantumFlow update")},
    }
    if not webhook:
        return {"ok": True, "mode": "dry_run", "reason": "WECOM_WEBHOOK_URL is not configured.", "body": body}
    return post_json(webhook, body)


def post_json(url: str, body: Dict[str, Any]) -> Dict[str, Any]:
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            text = response.read().decode("utf-8", errors="replace")
            parsed = parse_json_response(text)
            if isinstance(parsed, dict) and "code" in parsed:
                accepted = response.status == 200 and parsed.get("code") == 0
            else:
                accepted = 200 <= response.status < 300
            return {
                "ok": accepted,
                "mode": "http",
                "status": response.status,
                "response": text,
                "json": parsed,
                "proof": "Feishu server accepted the webhook." if accepted else "Webhook returned but was not accepted.",
            }
    except urllib.error.URLError as exc:
        return {"ok": False, "mode": "http", "reason": str(exc)}
    except (TimeoutError, OSError) as exc:
        # socket.timeout (Py3.10+) is TimeoutError, not URLError; catch all
        # transport-level failures so a webhook never crashes the caller.
        return {"ok": False, "mode": "http", "reason": f"connection error: {exc}"}


def parse_json_response(text: str) -> Any:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def connector_config() -> Dict[str, str]:
    if not CONNECTOR_CONFIG_PATH.exists():
        return {}
    try:
        data = json.loads(CONNECTOR_CONFIG_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return {str(key): str(value).strip() for key, value in data.items() if str(value).strip()}


def save_connector_config(data: Dict[str, Any]) -> Dict[str, str]:
    current = connector_config()
    for key in ("feishu_webhook_url", "wecom_webhook_url"):
        if key in data:
            current[key] = str(data.get(key) or "").strip()
    CONNECTOR_CONFIG_PATH.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    return current
