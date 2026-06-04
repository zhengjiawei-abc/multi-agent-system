from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List


class SnapshotStore:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self._ensure_schema()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path)

    def _ensure_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    data TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_snapshots_created_at
                ON snapshots(created_at)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS adopt_record (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT NOT NULL,
                    reviewer_id TEXT NOT NULL,
                    option_text TEXT NOT NULL,
                    vote_weight REAL NOT NULL DEFAULT 1,
                    vote_count INTEGER NOT NULL DEFAULT 0,
                    comment TEXT,
                    target_key TEXT,
                    candidate_id TEXT,
                    adopted_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_adopt_record_adopted_at
                ON adopt_record(adopted_at)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS task_execution_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT,
                    agent_id TEXT NOT NULL,
                    role TEXT,
                    action TEXT NOT NULL,
                    input_text TEXT,
                    output_text TEXT,
                    duration_ms INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'ok',
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_task_execution_log_created_at
                ON task_execution_log(created_at)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS issue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    external_id TEXT,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'open',
                    source TEXT NOT NULL,
                    conversation_id TEXT,
                    sender_id TEXT,
                    task_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_issue_updated_at
                ON issue(updated_at)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS connector_outbox (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    connector TEXT NOT NULL,
                    conversation_id TEXT,
                    recipient_id TEXT,
                    event_type TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TEXT NOT NULL,
                    sent_at TEXT,
                    result TEXT,
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    next_attempt_at TEXT
                )
                """
            )
            self._ensure_column(conn, "connector_outbox", "result", "TEXT")
            self._ensure_column(conn, "connector_outbox", "attempt_count", "INTEGER NOT NULL DEFAULT 0")
            self._ensure_column(conn, "connector_outbox", "next_attempt_at", "TEXT")
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_connector_outbox_status
                ON connector_outbox(status, created_at)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS bot_message (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    connector TEXT NOT NULL,
                    conversation_id TEXT,
                    sender_id TEXT,
                    direction TEXT NOT NULL,
                    text TEXT NOT NULL,
                    command TEXT,
                    status TEXT NOT NULL DEFAULT 'received',
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_bot_message_created_at
                ON bot_message(created_at)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS code_artifact (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT NOT NULL,
                    agent_id TEXT NOT NULL,
                    target_key TEXT NOT NULL,
                    code_text TEXT NOT NULL,
                    explanation TEXT,
                    status TEXT NOT NULL DEFAULT 'generated',
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_code_artifact_created_at
                ON code_artifact(created_at)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS project_delivery (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    package_name TEXT NOT NULL,
                    package_path TEXT NOT NULL,
                    project_path TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'ready',
                    validation TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_project_delivery_task
                ON project_delivery(task_id, created_at)
                """
            )
            self._ensure_column(conn, "project_delivery", "last_test_status", "TEXT")
            self._ensure_column(conn, "project_delivery", "last_test_output", "TEXT")
            self._ensure_column(conn, "project_delivery", "last_test_at", "TEXT")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS collaboration_comment (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    author TEXT NOT NULL,
                    text TEXT NOT NULL,
                    kind TEXT NOT NULL DEFAULT 'suggestion',
                    target_key TEXT,
                    votes INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'open',
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_collaboration_comment_created_at
                ON collaboration_comment(created_at)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS codex_memory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source TEXT NOT NULL,
                    role TEXT NOT NULL,
                    text TEXT NOT NULL,
                    tags TEXT NOT NULL DEFAULT '',
                    pinned INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_codex_memory_created_at
                ON codex_memory(created_at)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS admin_member (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'Developer',
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL
                )
                """
            )
            self._ensure_column(conn, "admin_member", "project_scope", "TEXT DEFAULT 'QuantumFlow Core'")
            self._ensure_column(conn, "admin_member", "permissions", "TEXT DEFAULT '{}'")
            self._ensure_column(conn, "admin_member", "invite_code", "TEXT")
            self._ensure_column(conn, "admin_member", "user_id", "INTEGER")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS project_room (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    owner TEXT,
                    invite_code TEXT NOT NULL UNIQUE,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_project_room_invite_code
                ON project_room(invite_code)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS project_room_member (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room_id INTEGER NOT NULL,
                    user_id INTEGER,
                    display_name TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'Developer',
                    status TEXT NOT NULL DEFAULT 'active',
                    joined_at TEXT NOT NULL,
                    UNIQUE(room_id, user_id),
                    FOREIGN KEY(room_id) REFERENCES project_room(id)
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS project_room_message (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room_id INTEGER NOT NULL,
                    user_id INTEGER,
                    author TEXT NOT NULL,
                    kind TEXT NOT NULL DEFAULT 'chat',
                    text TEXT NOT NULL,
                    file_name TEXT,
                    code_language TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(room_id) REFERENCES project_room(id)
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_project_room_message_room
                ON project_room_message(room_id, created_at)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS api_registry (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    method TEXT NOT NULL,
                    path TEXT NOT NULL,
                    description TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_api_registry_method_path
                ON api_registry(method, path)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS app_user (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    display_name TEXT NOT NULL,
                    email TEXT UNIQUE,
                    phone TEXT UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'Developer',
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL,
                    last_login_at TEXT
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_app_user_email
                ON app_user(email)
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_app_user_phone
                ON app_user(phone)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS verification_code (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    target TEXT NOT NULL,
                    channel TEXT NOT NULL,
                    purpose TEXT NOT NULL,
                    code_hash TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    used_at TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_verification_code_lookup
                ON verification_code(target, purpose, created_at)
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS user_session (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES app_user(id)
                )
                """
            )

    def save(self, snapshot: Dict[str, Any]) -> None:
        payload = json.dumps(snapshot, ensure_ascii=False)
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO snapshots(created_at, data) VALUES (?, ?)",
                (datetime.now().isoformat(timespec="seconds"), payload),
            )

    def recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, created_at, data FROM snapshots ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()

        history = []
        for row_id, created_at, data in rows:
            history.append(
                {
                    "id": row_id,
                    "created_at": created_at,
                    "data": json.loads(data),
                }
            )
        return history

    def record_adoption(
        self,
        task_id: str,
        reviewer_id: str,
        option_text: str,
        vote_weight: float,
        vote_count: int,
        comment: str = "",
        target_key: str = "",
        candidate_id: str = "",
    ) -> Dict[str, Any]:
        adopted_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO adopt_record(
                    task_id, reviewer_id, option_text, vote_weight, vote_count,
                    comment, target_key, candidate_id, adopted_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (task_id, reviewer_id, option_text, vote_weight, vote_count, comment, target_key, candidate_id, adopted_at),
            )
            row_id = cursor.lastrowid
        return {
            "id": row_id,
            "task_id": task_id,
            "reviewer_id": reviewer_id,
            "option_text": option_text,
            "vote_weight": vote_weight,
            "vote_count": vote_count,
            "comment": comment,
            "target_key": target_key,
            "candidate_id": candidate_id,
            "adopted_at": adopted_at,
        }

    def recent_adoptions(self, limit: int = 20) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, task_id, reviewer_id, option_text, vote_weight, vote_count,
                       comment, target_key, candidate_id, adopted_at
                FROM adopt_record
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {
                "id": row[0],
                "task_id": row[1],
                "reviewer_id": row[2],
                "option_text": row[3],
                "vote_weight": row[4],
                "vote_count": row[5],
                "comment": row[6],
                "target_key": row[7],
                "candidate_id": row[8],
                "adopted_at": row[9],
            }
            for row in rows
        ]

    def record_task_log(
        self,
        task_id: str | None,
        agent_id: str,
        role: str,
        action: str,
        input_text: str = "",
        output_text: str = "",
        duration_ms: int = 0,
        status: str = "ok",
    ) -> Dict[str, Any]:
        created_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO task_execution_log(
                    task_id, agent_id, role, action, input_text, output_text,
                    duration_ms, status, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (task_id, agent_id, role, action, input_text, output_text, duration_ms, status, created_at),
            )
            row_id = cursor.lastrowid
        return {
            "id": row_id,
            "task_id": task_id,
            "agent_id": agent_id,
            "role": role,
            "action": action,
            "input_text": input_text,
            "output_text": output_text,
            "duration_ms": duration_ms,
            "status": status,
            "created_at": created_at,
        }

    def recent_task_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, task_id, agent_id, role, action, input_text, output_text,
                       duration_ms, status, created_at
                FROM task_execution_log
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {
                "id": row[0],
                "task_id": row[1],
                "agent_id": row[2],
                "role": row[3],
                "action": row[4],
                "input_text": row[5],
                "output_text": row[6],
                "duration_ms": row[7],
                "status": row[8],
                "created_at": row[9],
            }
            for row in rows
        ]

    def create_issue(
        self,
        title: str,
        source: str,
        conversation_id: str | None = None,
        sender_id: str | None = None,
        task_id: str | None = None,
        external_id: str | None = None,
        status: str = "open",
    ) -> Dict[str, Any]:
        now = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO issue(
                    external_id, title, status, source, conversation_id,
                    sender_id, task_id, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (external_id, title, status, source, conversation_id, sender_id, task_id, now, now),
            )
            row_id = cursor.lastrowid
        return {
            "id": row_id,
            "external_id": external_id,
            "title": title,
            "status": status,
            "source": source,
            "conversation_id": conversation_id,
            "sender_id": sender_id,
            "task_id": task_id,
            "created_at": now,
            "updated_at": now,
        }

    def update_issue_status(self, issue_id: int, status: str) -> Dict[str, Any] | None:
        now = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            conn.execute("UPDATE issue SET status = ?, updated_at = ? WHERE id = ?", (status, now, issue_id))
            row = conn.execute(
                """
                SELECT id, external_id, title, status, source, conversation_id,
                       sender_id, task_id, created_at, updated_at
                FROM issue
                WHERE id = ?
                """,
                (issue_id,),
            ).fetchone()
        return self._issue_from_row(row) if row else None

    def update_issue_execution(self, issue_id: int, status: str, task_id: str) -> Dict[str, Any] | None:
        now = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            conn.execute(
                "UPDATE issue SET status = ?, task_id = ?, updated_at = ? WHERE id = ?",
                (status, task_id, now, issue_id),
            )
            row = conn.execute(
                """
                SELECT id, external_id, title, status, source, conversation_id,
                       sender_id, task_id, created_at, updated_at
                FROM issue
                WHERE id = ?
                """,
                (issue_id,),
            ).fetchone()
        return self._issue_from_row(row) if row else None

    def get_issue(self, issue_id: int) -> Dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, external_id, title, status, source, conversation_id,
                       sender_id, task_id, created_at, updated_at
                FROM issue
                WHERE id = ?
                """,
                (issue_id,),
            ).fetchone()
        return self._issue_from_row(row) if row else None

    def update_issue_status_by_task_id(self, task_id: str, status: str) -> Dict[str, Any] | None:
        now = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            conn.execute("UPDATE issue SET status = ?, updated_at = ? WHERE task_id = ?", (status, now, task_id))
            row = conn.execute(
                """
                SELECT id, external_id, title, status, source, conversation_id,
                       sender_id, task_id, created_at, updated_at
                FROM issue
                WHERE task_id = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (task_id,),
            ).fetchone()
        return self._issue_from_row(row) if row else None

    def recent_issues(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, external_id, title, status, source, conversation_id,
                       sender_id, task_id, created_at, updated_at
                FROM issue
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [self._issue_from_row(row) for row in rows]

    def enqueue_connector_message(
        self,
        connector: str,
        event_type: str,
        payload: Dict[str, Any],
        conversation_id: str | None = None,
        recipient_id: str | None = None,
        status: str = "pending",
    ) -> Dict[str, Any]:
        created_at = datetime.now().isoformat(timespec="seconds")
        payload_text = json.dumps(payload, ensure_ascii=False)
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO connector_outbox(
                    connector, conversation_id, recipient_id, event_type,
                    payload, status, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (connector, conversation_id, recipient_id, event_type, payload_text, status, created_at),
            )
            row_id = cursor.lastrowid
        return {
            "id": row_id,
            "connector": connector,
            "conversation_id": conversation_id,
            "recipient_id": recipient_id,
            "event_type": event_type,
            "payload": payload,
            "status": status,
            "created_at": created_at,
            "sent_at": None,
        }

    def recent_outbox(self, limit: int = 50, status: str | None = None) -> List[Dict[str, Any]]:
        query = """
            SELECT id, connector, conversation_id, recipient_id, event_type,
                   payload, status, created_at, sent_at, result, attempt_count, next_attempt_at
            FROM connector_outbox
        """
        params: tuple[Any, ...]
        if status:
            query += " WHERE status = ?"
            params = (status, limit)
        else:
            params = (limit,)
        query += " ORDER BY id DESC LIMIT ?"
        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
        return [
            {
                "id": row[0],
                "connector": row[1],
                "conversation_id": row[2],
                "recipient_id": row[3],
                "event_type": row[4],
                "payload": json.loads(row[5]),
                "status": row[6],
                "created_at": row[7],
                "sent_at": row[8],
                "result": json.loads(row[9]) if row[9] else {},
                "attempt_count": row[10],
                "next_attempt_at": row[11],
            }
            for row in rows
        ]

    def mark_outbox_sent(self, message_id: int, status: str = "sent", result: Dict[str, Any] | None = None) -> Dict[str, Any] | None:
        sent_at = datetime.now().isoformat(timespec="seconds") if status in {"sent", "dry_run"} else None
        result_text = json.dumps(result or {}, ensure_ascii=False)
        with self._connect() as conn:
            attempt_count = conn.execute("SELECT attempt_count FROM connector_outbox WHERE id = ?", (message_id,)).fetchone()
            attempts = int(attempt_count[0]) + 1 if attempt_count else 1
            next_attempt_at = None
            if status == "failed":
                delay_seconds = min(60, 2**min(attempts, 5))
                next_attempt_at = datetime.fromtimestamp(datetime.now().timestamp() + delay_seconds).isoformat(timespec="seconds")
            conn.execute(
                "UPDATE connector_outbox SET status = ?, sent_at = ?, result = ?, attempt_count = ?, next_attempt_at = ? WHERE id = ?",
                (status, sent_at, result_text, attempts, next_attempt_at, message_id),
            )
            row = conn.execute(
                """
                SELECT id, connector, conversation_id, recipient_id, event_type,
                       payload, status, created_at, sent_at, result, attempt_count, next_attempt_at
                FROM connector_outbox
                WHERE id = ?
                """,
                (message_id,),
            ).fetchone()
        if not row:
            return None
        return {
            "id": row[0],
            "connector": row[1],
            "conversation_id": row[2],
            "recipient_id": row[3],
            "event_type": row[4],
            "payload": json.loads(row[5]),
            "status": row[6],
            "created_at": row[7],
            "sent_at": row[8],
            "result": json.loads(row[9]) if row[9] else {},
            "attempt_count": row[10],
            "next_attempt_at": row[11],
        }

    def retryable_outbox(self, limit: int = 20) -> List[Dict[str, Any]]:
        now = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, connector, conversation_id, recipient_id, event_type,
                       payload, status, created_at, sent_at, result, attempt_count, next_attempt_at
                FROM connector_outbox
                WHERE status = 'pending'
                   OR (status = 'failed' AND (next_attempt_at IS NULL OR next_attempt_at <= ?))
                ORDER BY id ASC
                LIMIT ?
                """,
                (now, limit),
            ).fetchall()
        return [
            {
                "id": row[0],
                "connector": row[1],
                "conversation_id": row[2],
                "recipient_id": row[3],
                "event_type": row[4],
                "payload": json.loads(row[5]),
                "status": row[6],
                "created_at": row[7],
                "sent_at": row[8],
                "result": json.loads(row[9]) if row[9] else {},
                "attempt_count": row[10],
                "next_attempt_at": row[11],
            }
            for row in rows
        ]

    def record_bot_message(
        self,
        connector: str,
        direction: str,
        text: str,
        conversation_id: str | None = None,
        sender_id: str | None = None,
        command: str | None = None,
        status: str = "received",
    ) -> Dict[str, Any]:
        created_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO bot_message(
                    connector, conversation_id, sender_id, direction,
                    text, command, status, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (connector, conversation_id, sender_id, direction, text, command, status, created_at),
            )
            row_id = cursor.lastrowid
        return {
            "id": row_id,
            "connector": connector,
            "conversation_id": conversation_id,
            "sender_id": sender_id,
            "direction": direction,
            "text": text,
            "command": command,
            "status": status,
            "created_at": created_at,
        }

    def recent_bot_messages(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, connector, conversation_id, sender_id, direction,
                       text, command, status, created_at
                FROM bot_message
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {
                "id": row[0],
                "connector": row[1],
                "conversation_id": row[2],
                "sender_id": row[3],
                "direction": row[4],
                "text": row[5],
                "command": row[6],
                "status": row[7],
                "created_at": row[8],
            }
            for row in rows
        ]

    def record_code_artifact(
        self,
        task_id: str,
        agent_id: str,
        target_key: str,
        code_text: str,
        explanation: str = "",
        status: str = "generated",
    ) -> Dict[str, Any]:
        created_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO code_artifact(
                    task_id, agent_id, target_key, code_text,
                    explanation, status, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (task_id, agent_id, target_key, code_text, explanation, status, created_at),
            )
            row_id = cursor.lastrowid
        return {
            "id": row_id,
            "task_id": task_id,
            "agent_id": agent_id,
            "target_key": target_key,
            "code_text": code_text,
            "explanation": explanation,
            "status": status,
            "created_at": created_at,
        }

    def recent_code_artifacts(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, task_id, agent_id, target_key, code_text,
                       explanation, status, created_at
                FROM code_artifact
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {
                "id": row[0],
                "task_id": row[1],
                "agent_id": row[2],
                "target_key": row[3],
                "code_text": row[4],
                "explanation": row[5],
                "status": row[6],
                "created_at": row[7],
            }
            for row in rows
        ]

    def record_project_delivery(
        self,
        task_id: str,
        title: str,
        package_name: str,
        package_path: str,
        project_path: str,
        status: str = "ready",
        validation: str = "",
    ) -> Dict[str, Any]:
        created_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO project_delivery(
                    task_id, title, package_name, package_path,
                    project_path, status, validation, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (task_id, title, package_name, package_path, project_path, status, validation, created_at),
            )
            row_id = cursor.lastrowid
        return {
            "id": row_id,
            "task_id": task_id,
            "title": title,
            "package_name": package_name,
            "package_path": package_path,
            "project_path": project_path,
            "status": status,
            "validation": validation,
            "created_at": created_at,
        }

    def get_project_delivery(self, delivery_id: int) -> Dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, task_id, title, package_name, package_path,
                       project_path, status, validation, created_at,
                       last_test_status, last_test_output, last_test_at
                FROM project_delivery
                WHERE id = ?
                """,
                (delivery_id,),
            ).fetchone()
        return self._project_delivery_from_row(row) if row else None

    def recent_project_deliveries(self, limit: int = 20) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, task_id, title, package_name, package_path,
                       project_path, status, validation, created_at,
                       last_test_status, last_test_output, last_test_at
                FROM project_delivery
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [self._project_delivery_from_row(row) for row in rows]

    def update_project_delivery_test(
        self,
        delivery_id: int,
        test_status: str,
        test_output: str,
    ) -> Dict[str, Any] | None:
        tested_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            cursor = conn.execute(
                """
                UPDATE project_delivery
                SET last_test_status = ?, last_test_output = ?, last_test_at = ?
                WHERE id = ?
                """,
                (test_status, test_output, tested_at, delivery_id),
            )
            if cursor.rowcount == 0:
                return None
        return self.get_project_delivery(delivery_id)

    def _project_delivery_from_row(self, row: tuple[Any, ...]) -> Dict[str, Any]:
        return {
            "id": row[0],
            "task_id": row[1],
            "title": row[2],
            "package_name": row[3],
            "package_path": row[4],
            "project_path": row[5],
            "status": row[6],
            "validation": row[7],
            "created_at": row[8],
            "last_test_status": row[9] if len(row) > 9 else None,
            "last_test_output": row[10] if len(row) > 10 else None,
            "last_test_at": row[11] if len(row) > 11 else None,
        }

    def record_collaboration_comment(
        self,
        author: str,
        text: str,
        kind: str = "suggestion",
        target_key: str | None = None,
        votes: int = 0,
        status: str = "open",
    ) -> Dict[str, Any]:
        created_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO collaboration_comment(
                    author, text, kind, target_key, votes, status, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (author, text, kind, target_key, votes, status, created_at),
            )
            row_id = cursor.lastrowid
        return {
            "id": row_id,
            "author": author,
            "name": author,
            "text": text,
            "kind": kind,
            "target_key": target_key,
            "votes": votes,
            "status": status,
            "created_at": created_at,
        }

    def recent_collaboration_comments(self, limit: int = 80, kind: str | None = None) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            if kind:
                rows = conn.execute(
                    """
                    SELECT id, author, text, kind, target_key, votes, status, created_at
                    FROM collaboration_comment
                    WHERE kind = ?
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (kind, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT id, author, text, kind, target_key, votes, status, created_at
                    FROM collaboration_comment
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (limit,),
                ).fetchall()
        return [
            {
                "id": row[0],
                "author": row[1],
                "name": row[1],
                "text": row[2],
                "kind": row[3],
                "target_key": row[4],
                "votes": row[5],
                "status": row[6],
                "created_at": row[7],
            }
            for row in reversed(rows)
        ]

    def clear_collaboration_comments(self, kind: str | None = None) -> int:
        with self._connect() as conn:
            if kind:
                cursor = conn.execute("DELETE FROM collaboration_comment WHERE kind = ?", (kind,))
            else:
                cursor = conn.execute("DELETE FROM collaboration_comment")
            return cursor.rowcount

    def record_codex_memory(
        self,
        source: str,
        role: str,
        text: str,
        tags: str = "",
        pinned: bool = False,
    ) -> Dict[str, Any]:
        created_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            existing = None
            if pinned or "project-index" in tags:
                existing = conn.execute(
                    "SELECT id FROM codex_memory WHERE source = ? AND role = ? AND tags = ? LIMIT 1",
                    (source, role, tags),
                ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE codex_memory
                    SET text = ?, pinned = ?, created_at = ?
                    WHERE id = ?
                    """,
                    (text, 1 if pinned else 0, created_at, existing[0]),
                )
                row_id = existing[0]
            else:
                cursor = conn.execute(
                    """
                    INSERT INTO codex_memory(source, role, text, tags, pinned, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (source, role, text, tags, 1 if pinned else 0, created_at),
                )
                row_id = cursor.lastrowid
        return {
            "id": row_id,
            "source": source,
            "role": role,
            "text": text,
            "tags": tags,
            "pinned": bool(pinned),
            "created_at": created_at,
        }

    def recent_codex_memories(self, limit: int = 80) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, source, role, text, tags, pinned, created_at
                FROM codex_memory
                ORDER BY pinned DESC, id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {
                "id": row[0],
                "source": row[1],
                "role": row[2],
                "text": row[3],
                "tags": row[4],
                "pinned": bool(row[5]),
                "created_at": row[6],
            }
            for row in rows
        ]

    def list_admin_members(self) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT m.id, m.name, m.role, m.status, m.created_at, m.project_scope, m.permissions, m.invite_code,
                       m.user_id, u.username, u.display_name, u.email, u.phone
                FROM admin_member m
                LEFT JOIN app_user u ON u.id = m.user_id
                ORDER BY m.id DESC
                """
            ).fetchall()
        return [
            {
                "id": row[0],
                "name": row[1],
                "role": row[2],
                "status": row[3],
                "created_at": row[4],
                "project_scope": row[5] or "QuantumFlow Core",
                "permissions": json.loads(row[6] or "{}"),
                "invite_code": row[7] or "",
                "user_id": row[8],
                "username": row[9] or "",
                "display_name": row[10] or row[1],
                "email": row[11] or "",
                "phone": row[12] or "",
            }
            for row in rows
        ]

    def add_admin_member(
        self,
        name: str,
        user_id: int | None = None,
        role: str = "Developer",
        status: str = "active",
        project_scope: str = "QuantumFlow Core",
        permissions: Dict[str, Any] | None = None,
        invite_code: str = "",
    ) -> Dict[str, Any]:
        created_at = datetime.now().isoformat(timespec="seconds")
        permission_text = json.dumps(permissions or {}, ensure_ascii=False)
        with self._connect() as conn:
            if user_id is not None:
                existing = conn.execute("SELECT id FROM admin_member WHERE user_id = ? LIMIT 1", (user_id,)).fetchone()
                if not existing:
                    existing = conn.execute(
                        "SELECT id FROM admin_member WHERE user_id IS NULL AND name = ? LIMIT 1",
                        (name,),
                    ).fetchone()
                if existing:
                    conn.execute(
                        """
                        UPDATE admin_member
                        SET name = ?, role = ?, status = ?, project_scope = ?, permissions = ?, invite_code = ?, user_id = ?
                        WHERE id = ?
                        """,
                        (name, role, status, project_scope, permission_text, invite_code, user_id, existing[0]),
                    )
                    row_id = existing[0]
                    return next((item for item in self.list_admin_members() if item["id"] == row_id), None) or {
                        "id": row_id,
                        "name": name,
                        "user_id": user_id,
                        "role": role,
                        "status": status,
                        "created_at": created_at,
                        "project_scope": project_scope,
                        "permissions": permissions or {},
                        "invite_code": invite_code,
                    }
            cursor = conn.execute(
                """
                INSERT INTO admin_member(name, role, status, created_at, project_scope, permissions, invite_code, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (name, role, status, created_at, project_scope, permission_text, invite_code, user_id),
            )
            row_id = cursor.lastrowid
        return {
            "id": row_id,
            "name": name,
            "user_id": user_id,
            "role": role,
            "status": status,
            "created_at": created_at,
            "project_scope": project_scope,
            "permissions": permissions or {},
            "invite_code": invite_code,
        }

    def delete_admin_member(self, member_id: int) -> bool:
        with self._connect() as conn:
            cursor = conn.execute("DELETE FROM admin_member WHERE id = ?", (member_id,))
            return cursor.rowcount > 0

    def update_admin_member(
        self,
        member_id: int,
        role: str | None = None,
        status: str | None = None,
        project_scope: str | None = None,
        permissions: Dict[str, Any] | None = None,
        invite_code: str | None = None,
    ) -> Dict[str, Any] | None:
        current = None
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, name, role, status, created_at, project_scope, permissions, invite_code, user_id
                FROM admin_member WHERE id = ?
                """,
                (member_id,),
            ).fetchone()
            if row:
                current = {
                    "role": row[2],
                    "status": row[3],
                    "project_scope": row[5] or "QuantumFlow Core",
                    "permissions": json.loads(row[6] or "{}"),
                    "invite_code": row[7] or "",
                    "user_id": row[8],
                }
            if not current:
                return None
            next_permissions = permissions if permissions is not None else current["permissions"]
            conn.execute(
                """
                UPDATE admin_member
                SET role = ?, status = ?, project_scope = ?, permissions = ?, invite_code = ?
                WHERE id = ?
                """,
                (
                    role or current["role"],
                    status or current["status"],
                    project_scope or current["project_scope"],
                    json.dumps(next_permissions, ensure_ascii=False),
                    invite_code if invite_code is not None else current["invite_code"],
                    member_id,
                ),
            )
        return next((item for item in self.list_admin_members() if item["id"] == member_id), None)

    def create_project_room(self, name: str, description: str, owner: str, invite_code: str) -> Dict[str, Any]:
        created_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO project_room(name, description, owner, invite_code, status, created_at)
                VALUES (?, ?, ?, ?, 'active', ?)
                """,
                (name, description, owner, invite_code, created_at),
            )
            row_id = cursor.lastrowid
        return {
            "id": row_id,
            "name": name,
            "description": description,
            "owner": owner,
            "invite_code": invite_code,
            "status": "active",
            "created_at": created_at,
            "member_count": 0,
        }

    def list_project_rooms(self) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT r.id, r.name, r.description, r.owner, r.invite_code, r.status, r.created_at,
                       COUNT(m.id) AS member_count
                FROM project_room r
                LEFT JOIN project_room_member m ON m.room_id = r.id AND m.status = 'active'
                GROUP BY r.id
                ORDER BY r.id DESC
                """
            ).fetchall()
        return [
            {
                "id": row[0],
                "name": row[1],
                "description": row[2] or "",
                "owner": row[3] or "",
                "invite_code": row[4],
                "status": row[5],
                "created_at": row[6],
                "member_count": row[7],
            }
            for row in rows
        ]

    def find_project_room_by_invite(self, invite_code: str) -> Dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, name, description, owner, invite_code, status, created_at
                FROM project_room
                WHERE invite_code = ? AND status = 'active'
                """,
                (invite_code,),
            ).fetchone()
        if not row:
            return None
        return {
            "id": row[0],
            "name": row[1],
            "description": row[2] or "",
            "owner": row[3] or "",
            "invite_code": row[4],
            "status": row[5],
            "created_at": row[6],
        }

    def join_project_room(
        self,
        room_id: int,
        user_id: int | None,
        display_name: str,
        role: str = "Developer",
    ) -> Dict[str, Any]:
        joined_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO project_room_member(room_id, user_id, display_name, role, status, joined_at)
                VALUES (?, ?, ?, ?, 'active', ?)
                """,
                (room_id, user_id, display_name, role, joined_at),
            )
            row = conn.execute(
                """
                SELECT id, room_id, user_id, display_name, role, status, joined_at
                FROM project_room_member
                WHERE room_id = ? AND (user_id = ? OR display_name = ?)
                ORDER BY id DESC LIMIT 1
                """,
                (room_id, user_id, display_name),
            ).fetchone()
        return {
            "id": row[0],
            "room_id": row[1],
            "user_id": row[2],
            "display_name": row[3],
            "role": row[4],
            "status": row[5],
            "joined_at": row[6],
        }

    def list_user_project_rooms(self, user_id: int) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT r.id, r.name, r.description, r.owner, r.invite_code, r.status,
                       m.role, m.joined_at
                FROM project_room_member m
                JOIN project_room r ON r.id = m.room_id
                WHERE m.user_id = ? AND m.status = 'active'
                ORDER BY m.id DESC
                """,
                (user_id,),
            ).fetchall()
        return [
            {
                "id": row[0],
                "name": row[1],
                "description": row[2] or "",
                "owner": row[3] or "",
                "invite_code": row[4],
                "status": row[5],
                "role": row[6],
                "joined_at": row[7],
            }
            for row in rows
        ]

    def get_project_room(self, room_id: int) -> Dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, name, description, owner, invite_code, status, created_at
                FROM project_room
                WHERE id = ?
                """,
                (room_id,),
            ).fetchone()
        if not row:
            return None
        return {
            "id": row[0],
            "name": row[1],
            "description": row[2] or "",
            "owner": row[3] or "",
            "invite_code": row[4],
            "status": row[5],
            "created_at": row[6],
        }

    def record_project_room_message(
        self,
        room_id: int,
        author: str,
        text: str,
        user_id: int | None = None,
        kind: str = "chat",
        file_name: str | None = None,
        code_language: str | None = None,
    ) -> Dict[str, Any]:
        created_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO project_room_message(room_id, user_id, author, kind, text, file_name, code_language, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (room_id, user_id, author, kind, text, file_name, code_language, created_at),
            )
            row_id = cursor.lastrowid
        return {
            "id": row_id,
            "room_id": room_id,
            "user_id": user_id,
            "author": author,
            "kind": kind,
            "text": text,
            "file_name": file_name,
            "code_language": code_language,
            "created_at": created_at,
        }

    def list_project_room_messages(self, room_id: int, limit: int = 100) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, room_id, user_id, author, kind, text, file_name, code_language, created_at
                FROM project_room_message
                WHERE room_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (room_id, limit),
            ).fetchall()
        return [
            {
                "id": row[0],
                "room_id": row[1],
                "user_id": row[2],
                "author": row[3],
                "kind": row[4],
                "text": row[5],
                "file_name": row[6],
                "code_language": row[7],
                "created_at": row[8],
            }
            for row in reversed(rows)
        ]

    def list_api_registry(self) -> List[Dict[str, Any]]:
        self.seed_api_registry()
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, method, path, description, status, created_at
                FROM api_registry
                ORDER BY id DESC
                """
            ).fetchall()
        return [
            {
                "id": row[0],
                "method": row[1],
                "path": row[2],
                "description": row[3] or "",
                "status": row[4],
                "created_at": row[5],
            }
            for row in rows
        ]

    def add_api_registry(self, method: str, path: str, description: str = "", status: str = "active") -> Dict[str, Any]:
        created_at = datetime.now().isoformat(timespec="seconds")
        method = method.upper()
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT OR REPLACE INTO api_registry(method, path, description, status, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (method, path, description, status, created_at),
            )
            row_id = cursor.lastrowid
        return {"id": row_id, "method": method, "path": path, "description": description, "status": status, "created_at": created_at}

    def delete_api_registry(self, api_id: int) -> bool:
        with self._connect() as conn:
            cursor = conn.execute("DELETE FROM api_registry WHERE id = ?", (api_id,))
            return cursor.rowcount > 0

    def seed_api_registry(self) -> None:
        defaults = [
            ("POST", "/api/tasks", "创建任务并进入调度队列"),
            ("POST", "/api/issues/:id/execute", "选择 Issue 执行"),
            ("POST", "/api/issues/:id/reject", "驳回 Issue"),
            ("GET", "/api/task-logs", "读取 Agent 执行日志"),
            ("POST", "/api/bot/chat", "飞书 Bot 对话入口"),
        ]
        created_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            for method, path, description in defaults:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO api_registry(method, path, description, status, created_at)
                    VALUES (?, ?, ?, 'active', ?)
                    """,
                    (method, path, description, created_at),
                )

    def create_verification_code(
        self,
        target: str,
        channel: str,
        purpose: str,
        code_hash: str,
        expires_at: str,
    ) -> Dict[str, Any]:
        created_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO verification_code(target, channel, purpose, code_hash, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (target, channel, purpose, code_hash, expires_at, created_at),
            )
            row_id = cursor.lastrowid
        return {
            "id": row_id,
            "target": target,
            "channel": channel,
            "purpose": purpose,
            "expires_at": expires_at,
            "created_at": created_at,
        }

    def latest_verification_code(self, target: str, purpose: str) -> Dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, target, channel, purpose, code_hash, expires_at, used_at, created_at
                FROM verification_code
                WHERE target = ? AND purpose = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (target, purpose),
            ).fetchone()
        if not row:
            return None
        return {
            "id": row[0],
            "target": row[1],
            "channel": row[2],
            "purpose": row[3],
            "code_hash": row[4],
            "expires_at": row[5],
            "used_at": row[6],
            "created_at": row[7],
        }

    def mark_verification_code_used(self, code_id: int) -> None:
        used_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            conn.execute("UPDATE verification_code SET used_at = ? WHERE id = ?", (used_at, code_id))

    def create_user(
        self,
        username: str,
        display_name: str,
        password_hash: str,
        email: str | None = None,
        phone: str | None = None,
        role: str = "Developer",
        status: str = "active",
    ) -> Dict[str, Any]:
        created_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO app_user(username, display_name, email, phone, password_hash, role, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (username, display_name, email, phone, password_hash, role, status, created_at),
            )
            row_id = cursor.lastrowid
        return {
            "id": row_id,
            "username": username,
            "display_name": display_name,
            "email": email,
            "phone": phone,
            "role": role,
            "status": status,
            "created_at": created_at,
            "last_login_at": None,
        }

    def find_user_by_account(self, account: str) -> Dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, username, display_name, email, phone, password_hash, role, status, created_at, last_login_at
                FROM app_user
                WHERE username = ? OR email = ? OR phone = ? OR display_name = ?
                LIMIT 1
                """,
                (account, account, account, account),
            ).fetchone()
        return self._user_from_row(row, include_password=True) if row else None

    def get_user(self, user_id: int) -> Dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, username, display_name, email, phone, password_hash, role, status, created_at, last_login_at
                FROM app_user
                WHERE id = ?
                """,
                (user_id,),
            ).fetchone()
        return self._user_from_row(row) if row else None

    def update_user_password(self, user_id: int, password_hash: str) -> Dict[str, Any] | None:
        with self._connect() as conn:
            conn.execute("UPDATE app_user SET password_hash = ? WHERE id = ?", (password_hash, user_id))
        return self.get_user(user_id)

    def update_user_profile(self, user_id: int, display_name: str) -> Dict[str, Any] | None:
        with self._connect() as conn:
            conn.execute("UPDATE app_user SET display_name = ? WHERE id = ?", (display_name, user_id))
        return self.get_user(user_id)

    def update_user_access(self, user_id: int, role: str | None = None, status: str | None = None) -> Dict[str, Any] | None:
        current = self.get_user(user_id)
        if not current:
            return None
        with self._connect() as conn:
            conn.execute(
                "UPDATE app_user SET role = ?, status = ? WHERE id = ?",
                (role or current["role"], status or current["status"], user_id),
            )
        return self.get_user(user_id)

    def touch_user_login(self, user_id: int) -> None:
        last_login_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            conn.execute("UPDATE app_user SET last_login_at = ? WHERE id = ?", (last_login_at, user_id))

    def create_session(self, token: str, user_id: int, expires_at: str) -> Dict[str, Any]:
        created_at = datetime.now().isoformat(timespec="seconds")
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO user_session(token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (token, user_id, created_at, expires_at),
            )
        return {"token": token, "user_id": user_id, "created_at": created_at, "expires_at": expires_at}

    def get_session_user(self, token: str, now: str) -> Dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT u.id, u.username, u.display_name, u.email, u.phone, u.password_hash,
                       u.role, u.status, u.created_at, u.last_login_at
                FROM user_session s
                JOIN app_user u ON u.id = s.user_id
                WHERE s.token = ? AND s.expires_at > ? AND u.status = 'active'
                """,
                (token, now),
            ).fetchone()
        return self._user_from_row(row) if row else None

    def delete_session(self, token: str) -> bool:
        with self._connect() as conn:
            cursor = conn.execute("DELETE FROM user_session WHERE token = ?", (token,))
            return cursor.rowcount > 0

    def _user_from_row(self, row: tuple[Any, ...], include_password: bool = False) -> Dict[str, Any]:
        user = {
            "id": row[0],
            "username": row[1],
            "display_name": row[2],
            "email": row[3],
            "phone": row[4],
            "role": row[6],
            "status": row[7],
            "created_at": row[8],
            "last_login_at": row[9],
        }
        if include_password:
            user["password_hash"] = row[5]
        return user

    def _ensure_column(self, conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
        columns = [row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
        if column not in columns:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    def _issue_from_row(self, row: tuple[Any, ...]) -> Dict[str, Any]:
        return {
            "id": row[0],
            "external_id": row[1],
            "title": row[2],
            "status": row[3],
            "source": row[4],
            "conversation_id": row[5],
            "sender_id": row[6],
            "task_id": row[7],
            "created_at": row[8],
            "updated_at": row[9],
        }
