from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict


@dataclass
class InboundTask:
    source: str
    title: str
    owner_id: str = "master"
    conversation_id: str | None = None
    sender_id: str | None = None
    raw: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class BotCommand:
    name: str
    argument: str = ""
    text: str = ""


def normalize_generic_task(payload: Dict[str, Any]) -> InboundTask:
    title = str(payload.get("title") or payload.get("text") or payload.get("content") or "").strip()
    return InboundTask(
        source=str(payload.get("source", "generic_app")),
        title=title,
        owner_id=str(payload.get("owner_id", "master")),
        conversation_id=optional_str(payload.get("conversation_id")),
        sender_id=optional_str(payload.get("sender_id")),
        raw=payload,
    )


def normalize_wecom_message(payload: Dict[str, Any]) -> InboundTask:
    # This is a plaintext development adapter. Production WeCom callbacks
    # should verify signature and decrypt encrypted XML/JSON first.
    title = str(payload.get("Content") or payload.get("content") or payload.get("text") or "").strip()
    sender = payload.get("FromUserName") or payload.get("from_user") or payload.get("sender_id")
    conversation = payload.get("ChatId") or payload.get("chat_id") or payload.get("conversation_id")
    return InboundTask(
        source="wecom",
        title=title,
        owner_id=str(payload.get("owner_id", "master")),
        conversation_id=optional_str(conversation),
        sender_id=optional_str(sender),
        raw=payload,
    )


def normalize_feishu_message(payload: Dict[str, Any]) -> InboundTask:
    # Development adapter for Feishu/Lark event callbacks. Production should
    # verify challenge/signature and decrypt encrypted events when configured.
    event = payload.get("event") if isinstance(payload.get("event"), dict) else payload
    message = event.get("message") if isinstance(event.get("message"), dict) else {}
    sender = event.get("sender") if isinstance(event.get("sender"), dict) else {}
    content = message.get("content") or payload.get("content") or payload.get("text") or ""
    title = parse_message_text(content).strip()
    if title.startswith("/issue"):
        title = title.removeprefix("/issue").strip()
    return InboundTask(
        source="feishu",
        title=title,
        owner_id=str(payload.get("owner_id") or event.get("owner_id") or "master"),
        conversation_id=optional_str(message.get("chat_id") or event.get("chat_id")),
        sender_id=optional_str(sender.get("sender_id") or event.get("sender_id")),
        raw=payload,
    )


def feishu_message_context(payload: Dict[str, Any]) -> Dict[str, Any]:
    event = payload.get("event") if isinstance(payload.get("event"), dict) else payload
    message = event.get("message") if isinstance(event.get("message"), dict) else {}
    sender = event.get("sender") if isinstance(event.get("sender"), dict) else {}
    content = message.get("content") or payload.get("content") or payload.get("text") or ""
    text = parse_message_text(content).strip()
    return {
        "text": text,
        "conversation_id": optional_str(message.get("chat_id") or event.get("chat_id")),
        "sender_id": optional_str(sender.get("sender_id") or event.get("sender_id")),
        "message_id": optional_str(message.get("message_id") or event.get("message_id") or payload.get("message_id")),
        "raw": payload,
    }


def parse_bot_command(text: str) -> BotCommand:
    stripped = text.strip()
    if not stripped:
        return BotCommand("empty", "", text)
    if not stripped.startswith("/"):
        return BotCommand("chat", stripped, text)
    name, _, argument = stripped.partition(" ")
    command = name.lstrip("/").strip().lower()
    aliases = {
        "任务": "issue",
        "代码": "code",
        "开发": "code",
        "状态": "status",
        "帮助": "help",
    }
    return BotCommand(aliases.get(command, command), argument.strip(), text)


def optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_message_text(content: Any) -> str:
    if isinstance(content, dict):
        for key in ("text", "title", "content"):
            if content.get(key):
                return str(content[key])
        return json.dumps(content, ensure_ascii=False)
    text = str(content or "").strip()
    if not text:
        return ""
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return text
    if isinstance(parsed, dict):
        for key in ("text", "title", "content"):
            if parsed.get(key):
                return str(parsed[key])
    return text
