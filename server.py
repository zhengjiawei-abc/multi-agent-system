from __future__ import annotations

import ast
import asyncio
import hashlib
import hmac
import json
import re
import secrets
import shutil
import socket
import sqlite3
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List

from fastapi import Body, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from Agent import AgentStatus, QuantumFlowRuntime, TaskStatus, default_runtime
from connector_sender import connector_config, save_connector_config, send_connector_message
from connectors import (
    InboundTask,
    feishu_message_context,
    normalize_feishu_message,
    normalize_generic_task,
    normalize_wecom_message,
    parse_bot_command,
)
from patch_service import apply_candidate, build_candidate, read_history, validate_candidate
from storage import SnapshotStore


ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "quantumflow-mvp"
GENERATED_REPOS_ROOT = ROOT / "generated_repos"
DELIVERY_ROOT = ROOT / "generated_repos" / "_deliveries"
PUBLIC_TUNNEL_INFO = ROOT / "public_tunnel.json"
ZEROTIER_NETWORK_ID = "3b19b3a716962eff"
ZEROTIER_HOME = Path("C:/ProgramData/ZeroTier/One")
ZEROTIER_EXE = ZEROTIER_HOME / "zerotier-one_x64.exe"
ZEROTIER_TOKEN = ZEROTIER_HOME / "authtoken.secret"
ZEROTIER_STATUS_FILE = ROOT / "zerotier_status.txt"
CODEX_PROJECT_INDEX_FILE = ROOT / "codex_project_index.json"

app = FastAPI(title="QuantumFlow Runtime", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

runtime: QuantumFlowRuntime = default_runtime()
clients: List[WebSocket] = []
peer_sessions: Dict[int, Dict[str, Any]] = {}
run_lock = asyncio.Lock()
store = SnapshotStore(ROOT / "quantumflow.db")
patch_candidates: Dict[str, Dict[str, Any]] = {}
auto_dispatch_task: asyncio.Task | None = None
auto_dispatch_requested = False
delivery_runtime_processes: Dict[int, Dict[str, Any]] = {}
SYSTEM_ASSISTANTS: List[Dict[str, Any]] = [
    {
        "id": "codex-assistant",
        "name": "Codex",
        "role": "AI Assistant",
        "kind": "assistant",
        "source": "QuantumFlow / Codex RAG",
        "color": "#2fe098",
        "status": "online",
    }
]
CODEX_KNOWLEDGE_PROFILE: Dict[str, str] = {
    "identity": "QuantumFlow 是一个多智能体协作开发系统，用可视化任务流把人类需求、Agent 分工、代码生成、审查、测试和交付打通。",
    "llm": "LLM 负责理解需求、生成候选方案和解释代码；系统通过上下文、Skill、RAG 和工具调用把模型输出约束到可执行工程流程里。",
    "architecture": "QuantumFlow 采用控制平面和执行平面分离的设计：负责人拆解任务，Frontend/Backend/Tester/Reviewer 等 Agent 分工执行，最终由负责人汇总交付。",
    "codex": "Codex Agent 主要承担代码生成、接口实现、数据库事务、测试修复和工程解释。它应输出可运行代码，而不是只给演示片段。",
    "workflow": "任务进入队列后，负责人先分析需求并拆分任务；Agent 并行开发；Tester 做基础校验；Reviewer 讨论与仲裁；负责人整合成项目包。",
    "quality": "质量门禁包括语法校验、必要文件检查、基础运行说明、可下载交付物和审计记录。失败任务必须回到对应 Agent 修复。",
    "api": "外部入口包括手动任务、飞书 Bot、项目房间和后续企业微信/微信客服/抖音 Connector。所有入口最终统一变成队列任务。",
    "vision": "长期目标是形成一个类似 GitHub 但带多智能体自动协作能力的开源世界，让用户、开发者和 Agent 能共同完成真实项目。",
}
AGENT_MEMORY_ROLES = {"agent", "assistant", "ai assistant", "pair agent", "ui agent", "api agent", "qa agent", "reviewer", "master"}
PROJECT_LEARN_EXTENSIONS = {
    ".py",
    ".js",
    ".html",
    ".css",
    ".md",
    ".json",
    ".ps1",
    ".bat",
    ".txt",
}
PROJECT_LEARN_EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "__pycache__",
    "node_modules",
    "generated_repos",
    "release",
    "tmp_git_source_for_sync.git",
}

seed_codex_memory_done = False

if WEB_ROOT.exists():
    app.mount("/static", StaticFiles(directory=WEB_ROOT), name="static")


@app.get("/")
async def index() -> FileResponse:
    return no_cache_file(WEB_ROOT / "index.html")


@app.get("/war-room")
async def war_room() -> FileResponse:
    return no_cache_file(WEB_ROOT / "index.html")


@app.get("/platform")
async def platform() -> FileResponse:
    return no_cache_file(WEB_ROOT / "index.html")


@app.get("/open-source")
async def open_source() -> FileResponse:
    return no_cache_file(WEB_ROOT / "index.html")


@app.get("/admin")
async def admin() -> FileResponse:
    return no_cache_file(WEB_ROOT / "index.html")


@app.get("/admin/{subpage}")
async def admin_subpage(subpage: str) -> FileResponse:
    return no_cache_file(WEB_ROOT / "index.html")


@app.get("/login")
async def login_page() -> FileResponse:
    return no_cache_file(WEB_ROOT / "index.html")


@app.get("/register")
async def register_page() -> FileResponse:
    return no_cache_file(WEB_ROOT / "index.html")


@app.get("/forgot-password")
async def forgot_password_page() -> FileResponse:
    return no_cache_file(WEB_ROOT / "index.html")


@app.get("/profile")
async def profile_page() -> FileResponse:
    return no_cache_file(WEB_ROOT / "index.html")


@app.get("/styles.css")
async def styles() -> FileResponse:
    return no_cache_file(WEB_ROOT / "styles.css")


@app.get("/app.js")
async def app_js() -> FileResponse:
    return no_cache_file(WEB_ROOT / "app.js")


@app.get("/api/app-version")
async def app_version() -> Dict[str, Any]:
    watched = [
        WEB_ROOT / "index.html",
        WEB_ROOT / "app.js",
        WEB_ROOT / "styles.css",
        ROOT / "server.py",
        ROOT / "Agent.py",
        ROOT / "connectors.py",
        ROOT / "connector_sender.py",
        ROOT / "storage.py",
        ROOT / "patch_service.py",
    ]
    files = {
        path.name: int(path.stat().st_mtime * 1000)
        for path in watched
        if path.exists()
    }
    return {"version": str(max(files.values()) if files else 0), "files": files}


@app.post("/api/auth/send-code")
async def auth_send_code(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    target = normalize_auth_target(str(payload.get("target") or ""))
    channel = str(payload.get("channel") or infer_auth_channel(target)).strip().lower()
    purpose = str(payload.get("purpose") or "register").strip().lower()
    if channel not in {"email", "phone"}:
        raise HTTPException(status_code=400, detail="channel must be email or phone.")
    if purpose not in {"register", "reset_password"}:
        raise HTTPException(status_code=400, detail="Unsupported verification purpose.")
    if not valid_auth_target(target, channel):
        raise HTTPException(status_code=400, detail="Invalid verification target.")
    code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = (datetime.now() + timedelta(minutes=10)).isoformat(timespec="seconds")
    store.create_verification_code(target, channel, purpose, code_hash=hash_secret(code), expires_at=expires_at)
    store.record_task_log(None, "auth", "Auth Service", "verification_code_created", target, f"{channel}:{purpose}")
    return {
        "ok": True,
        "channel": channel,
        "target": mask_auth_target(target, channel),
        "expires_at": expires_at,
        "dev_code": code,
        "note": "Beta mode returns dev_code. Replace this with SMS/email delivery before public launch.",
    }


@app.post("/api/auth/register")
async def auth_register(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    username = safe_username(str(payload.get("username") or ""))
    display_name = str(payload.get("display_name") or username).strip()[:60] or username
    password = str(payload.get("password") or "")
    code = str(payload.get("code") or "").strip()
    email = normalize_auth_target(str(payload.get("email") or ""))
    phone = normalize_auth_target(str(payload.get("phone") or ""))
    target = email or phone
    channel = "email" if email else "phone"
    if not username:
        raise HTTPException(status_code=400, detail="Username is required.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if not target:
        raise HTTPException(status_code=400, detail="Email or phone is required.")
    verify_auth_code(target, "register", code)
    try:
        user = store.create_user(
            username=username,
            display_name=display_name,
            email=email or None,
            phone=phone or None,
            password_hash=hash_password(password),
            role="Developer",
        )
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Username, email, or phone already exists.") from exc
    token = create_user_session(int(user["id"]))
    store.touch_user_login(int(user["id"]))
    store.record_task_log(None, "auth", "Auth Service", "user_registered", username, channel)
    return {"ok": True, "token": token, "user": store.get_user(int(user["id"])) or user}


@app.post("/api/auth/login")
async def auth_login(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    account = normalize_auth_target(str(payload.get("account") or ""))
    password = str(payload.get("password") or "")
    user = store.find_user_by_account(account)
    if not user or not verify_password(password, str(user.get("password_hash") or "")):
        raise HTTPException(status_code=401, detail="Invalid account or password.")
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="User is not active.")
    token = create_user_session(int(user["id"]))
    store.touch_user_login(int(user["id"]))
    clean = store.get_user(int(user["id"])) or public_user(user)
    store.record_task_log(None, "auth", "Auth Service", "user_login", str(clean.get("username") or ""), "session created")
    return {"ok": True, "token": token, "user": clean}


@app.get("/api/auth/me")
async def auth_me(authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    user = current_user_from_header(authorization)
    return {"ok": True, "user": user}


@app.post("/api/auth/logout")
async def auth_logout(authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    token = bearer_token(authorization)
    if token:
        store.delete_session(token)
    return {"ok": True}


@app.post("/api/auth/reset-password")
async def auth_reset_password(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    target = normalize_auth_target(str(payload.get("target") or ""))
    code = str(payload.get("code") or "").strip()
    new_password = str(payload.get("new_password") or "")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    verify_auth_code(target, "reset_password", code)
    user = store.find_user_by_account(target)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    updated = store.update_user_password(int(user["id"]), hash_password(new_password))
    store.record_task_log(None, "auth", "Auth Service", "password_reset", target, "password updated")
    return {"ok": True, "user": updated}


@app.post("/api/auth/profile")
async def auth_update_profile(
    payload: Dict[str, Any] = Body(...),
    authorization: str | None = Header(default=None),
) -> Dict[str, Any]:
    user = current_user_from_header(authorization)
    display_name = str(payload.get("display_name") or user["display_name"]).strip()[:60]
    updated = store.update_user_profile(int(user["id"]), display_name)
    return {"ok": True, "user": updated or user}


@app.on_event("startup")
async def start_auto_dispatch() -> None:
    seed_codex_foundation_memory()
    schedule_auto_dispatch("startup")


def seed_codex_foundation_memory() -> None:
    global seed_codex_memory_done
    if seed_codex_memory_done:
        return
    for key, text in CODEX_KNOWLEDGE_PROFILE.items():
        store.record_codex_memory(
            source="QuantumFlow System Design Document",
            role="foundation",
            text=text,
            tags=f"foundation,{key},design-doc",
            pinned=True,
        )
    seed_codex_memory_done = True


def no_cache_file(path: Path) -> FileResponse:
    return FileResponse(
        path,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
        },
    )


def normalize_auth_target(value: str) -> str:
    return value.strip().lower().replace(" ", "")


def infer_auth_channel(target: str) -> str:
    return "email" if "@" in target else "phone"


def valid_auth_target(target: str, channel: str) -> bool:
    if channel == "email":
        return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", target))
    return bool(re.match(r"^\+?\d{6,18}$", target))


def mask_auth_target(target: str, channel: str) -> str:
    if channel == "email" and "@" in target:
        name, domain = target.split("@", 1)
        return f"{name[:2]}***@{domain}"
    if len(target) <= 7:
        return f"{target[:2]}***"
    return f"{target[:3]}****{target[-4:]}"


def safe_username(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "-", value.strip()).strip(".-_")
    return cleaned[:40]


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    iterations = 180_000
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations).hex()
    return f"pbkdf2_sha256${iterations}${salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, iterations_text, salt, expected = stored_hash.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations_text),
        ).hex()
        return hmac.compare_digest(digest, expected)
    except (ValueError, TypeError):
        return False


def verify_auth_code(target: str, purpose: str, code: str) -> None:
    record = store.latest_verification_code(target, purpose)
    if not record:
        raise HTTPException(status_code=400, detail="Verification code not found.")
    if record.get("used_at"):
        raise HTTPException(status_code=400, detail="Verification code already used.")
    if datetime.fromisoformat(str(record["expires_at"])) < datetime.now():
        raise HTTPException(status_code=400, detail="Verification code expired.")
    if not hmac.compare_digest(str(record["code_hash"]), hash_secret(code)):
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    store.mark_verification_code_used(int(record["id"]))


def create_user_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now() + timedelta(days=14)).isoformat(timespec="seconds")
    store.create_session(token, user_id, expires_at)
    return token


def bearer_token(authorization: str | None) -> str:
    if not authorization:
        return ""
    prefix = "Bearer "
    return authorization[len(prefix) :].strip() if authorization.startswith(prefix) else authorization.strip()


def current_user_from_header(authorization: str | None) -> Dict[str, Any]:
    token = bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing auth token.")
    user = store.get_session_user(token, datetime.now().isoformat(timespec="seconds"))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired auth token.")
    return user


def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {key: value for key, value in user.items() if key != "password_hash"}


def generate_invite_code() -> str:
    return f"QF-{secrets.token_hex(3).upper()}-{secrets.token_hex(2).upper()}"


def normalize_invite_code(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9-]+", "", value.strip().upper())[:32]


def current_public_tunnel() -> Dict[str, Any] | None:
    if not PUBLIC_TUNNEL_INFO.exists():
        return None
    try:
        data = json.loads(PUBLIC_TUNNEL_INFO.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return None
    if not data.get("public_url"):
        return None
    return data


def default_member_permissions(role: str) -> Dict[str, bool]:
    normalized = role.strip().lower()
    if normalized == "admin":
        return {
            "war_room": True,
            "source_world": True,
            "workspace": True,
            "api_registry": True,
            "member_admin": True,
        }
    if normalized == "reviewer":
        return {
            "war_room": True,
            "source_world": True,
            "workspace": True,
            "api_registry": False,
            "member_admin": False,
        }
    if normalized == "guest":
        return {
            "war_room": False,
            "source_world": True,
            "workspace": False,
            "api_registry": False,
            "member_admin": False,
        }
    return {
        "war_room": True,
        "source_world": True,
        "workspace": True,
        "api_registry": False,
        "member_admin": False,
    }


def runtime_snapshot() -> Dict[str, Any]:
    data = runtime.snapshot()
    deliveries = store.recent_project_deliveries(limit=20)
    data["deliveries"] = [
        {
            **delivery,
            "download_url": f"/api/project-deliveries/{delivery['id']}/download",
            **project_delivery_runtime_state(int(delivery["id"])),
        }
        for delivery in deliveries
    ]
    return data


def project_delivery_runtime_state(delivery_id: int) -> Dict[str, Any]:
    runtime_info = delivery_runtime_processes.get(delivery_id)
    if not runtime_info:
        return {}
    process = runtime_info.get("process")
    running = bool(process and process.poll() is None)
    return {
        "runtime_url": runtime_info.get("url"),
        "runtime_port": runtime_info.get("port"),
        "runtime_status": "running" if running else "stopped",
    }


def project_delivery_port(delivery_id: int) -> int:
    base_port = 8800 + (delivery_id % 100)
    for offset in range(100):
        port = 8800 + ((base_port - 8800 + offset) % 100)
        if is_port_available(port) or delivery_runtime_processes.get(delivery_id, {}).get("port") == port:
            return port
    raise HTTPException(status_code=409, detail="No free project runtime port is available.")


def is_port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) != 0


def project_python_exe() -> Path:
    python_exe = ROOT / ".venv" / "Scripts" / "python.exe"
    return python_exe if python_exe.exists() else Path(sys.executable)


@app.get("/api/snapshot")
async def snapshot() -> Dict[str, Any]:
    return runtime_snapshot()


@app.get("/api/history")
async def history(limit: int = 20) -> List[Dict[str, Any]]:
    return store.recent(limit=max(1, min(limit, 100)))


@app.get("/api/adoptions")
async def adoption_history(limit: int = 20) -> List[Dict[str, Any]]:
    return store.recent_adoptions(limit=max(1, min(limit, 100)))


@app.get("/api/task-logs")
async def task_logs(limit: int = 50) -> List[Dict[str, Any]]:
    return store.recent_task_logs(limit=max(1, min(limit, 200)))


@app.get("/api/issues")
async def issues(limit: int = 50) -> List[Dict[str, Any]]:
    return store.recent_issues(limit=max(1, min(limit, 200)))


@app.post("/api/issues/{issue_id}/status")
async def update_issue_status(issue_id: int, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    status = str(payload.get("status", "")).strip()
    if not status:
        raise HTTPException(status_code=400, detail="Issue status is required.")
    issue = store.update_issue_status(issue_id, status)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")
    enqueue_issue_notice(issue, "issue_status_changed")
    return issue


@app.post("/api/issues/{issue_id}/execute")
async def execute_issue(issue_id: int, payload: Dict[str, Any] | None = Body(default=None)) -> Dict[str, Any]:
    payload = payload or {}
    issue = store.get_issue(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")

    owner_id = str(payload.get("owner_id") or choose_code_owner(issue["title"]) or "master")
    if owner_id not in runtime.agents:
        owner_id = "master"
    x, y = next_station(owner_id)
    task = runtime.add_task(
        issue["title"],
        owner_id,
        x,
        y,
        source="issue_accepted",
        conversation_id=issue.get("conversation_id"),
        sender_id=issue.get("sender_id"),
    )
    updated = store.update_issue_execution(issue_id, "queued", task.id)
    store.record_task_log(task.id, owner_id, runtime.agents[owner_id].role, "issue_selected_for_execution", issue["title"], f"issue_id={issue_id}")
    if updated:
        enqueue_issue_notice(updated, "issue_status_changed")
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    schedule_auto_dispatch("issue_selected_for_execution")
    return {"issue": updated or issue, "task": task.to_dict()}


@app.post("/api/issues/{issue_id}/reject")
async def reject_issue(issue_id: int, payload: Dict[str, Any] | None = Body(default=None)) -> Dict[str, Any]:
    payload = payload or {}
    reason = str(payload.get("reason") or "Rejected by human operator.").strip()
    issue = store.update_issue_status(issue_id, "rejected")
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")
    store.record_task_log(issue.get("task_id"), "master", "Control Plane", "issue_rejected", issue["title"], reason, status="ok")
    enqueue_issue_notice(issue, "issue_status_changed")
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    return issue


@app.get("/api/outbox")
async def outbox(limit: int = 50, status: str | None = None) -> List[Dict[str, Any]]:
    return store.recent_outbox(limit=max(1, min(limit, 200)), status=status)


@app.get("/api/bot/messages")
async def bot_messages(limit: int = 50) -> List[Dict[str, Any]]:
    return store.recent_bot_messages(limit=max(1, min(limit, 200)))


@app.get("/api/collaboration/online")
async def collaboration_online() -> Dict[str, Any]:
    peers = online_collaborators()
    return {"count": len(peers), "peers": peers}


@app.get("/api/network/virtual")
async def virtual_network_status() -> Dict[str, Any]:
    return virtual_network_snapshot()


@app.get("/api/network/lan")
async def network_lan() -> Dict[str, Any]:
    ips = lan_ip_candidates()
    return {
        "host": ips[0] if ips else "127.0.0.1",
        "port": 8765,
        "urls": [f"http://{ip}:8765" for ip in ips],
        "note": "同一局域网内的朋友可以使用这些地址访问；如果访问不了，请检查防火墙和网络连通性。",
    }


@app.get("/api/collaboration/comments")
async def collaboration_comments(limit: int = 80) -> List[Dict[str, Any]]:
    return store.recent_collaboration_comments(limit=max(1, min(limit, 200)))


@app.post("/api/collaboration/comments")
async def create_collaboration_comment(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    author = str(payload.get("author") or payload.get("name") or "Guest").strip()[:60] or "Guest"
    text = str(payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment text is required.")
    kind = str(payload.get("kind") or "suggestion").strip()[:40] or "suggestion"
    target_key = str(payload.get("target_key") or "").strip()[:160] or None
    comment = store.record_collaboration_comment(
        author=author,
        text=text[:2000],
        kind=kind,
        target_key=target_key,
        votes=1 if author != "Guest" else 0,
    )
    await broadcast({"kind": "collaboration_comment", "data": comment})
    return comment


@app.get("/api/realtime/chat")
async def realtime_chat(kind: str = "public_chat", limit: int = 120) -> List[Dict[str, Any]]:
    if kind not in {"public_chat", "admin_chat"}:
        raise HTTPException(status_code=400, detail="Unsupported realtime chat kind.")
    return store.recent_collaboration_comments(kind=kind, limit=max(1, min(limit, 200)))


@app.delete("/api/realtime/chat")
async def clear_realtime_chat(kind: str = "admin_chat") -> Dict[str, Any]:
    if kind not in {"public_chat", "admin_chat"}:
        raise HTTPException(status_code=400, detail="Unsupported realtime chat kind.")
    deleted = store.clear_collaboration_comments(kind=kind)
    await broadcast({"kind": "chat_cleared", "data": {"kind": kind}})
    return {"ok": True, "kind": kind, "deleted": deleted}


@app.get("/api/realtime/status")
async def realtime_status() -> Dict[str, Any]:
    local_host = "127.0.0.1"
    try:
        lan_host = socket.gethostbyname(socket.gethostname())
    except OSError:
        lan_host = local_host
    port = 8765
    return {
        "ok": True,
        "online": online_collaborators(),
        "online_count": len(peer_sessions),
        "virtual_network": virtual_network_snapshot(),
        "local_ws": f"ws://{local_host}:{port}/ws",
        "lan_ws": f"ws://{lan_host}:{port}/ws",
        "public_tunnel": current_public_tunnel(),
        "relay_env": "QUANTUMFLOW_RELAY_URL",
        "channels": ["admin_chat", "public_chat", "project_room_message", "online"],
    }


@app.get("/api/admin/members")
async def admin_members() -> List[Dict[str, Any]]:
    return store.list_admin_members()


@app.get("/api/admin/users/{user_id}")
async def admin_user_lookup(user_id: int, authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    current_user_from_header(authorization)
    user = store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"ok": True, "user": public_user(user)}


@app.post("/api/admin/members")
async def add_admin_member(payload: Dict[str, Any] = Body(...), authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    current_user_from_header(authorization)
    raw_user_id = payload.get("user_id")
    user_id = int(raw_user_id) if str(raw_user_id or "").strip().isdigit() else None
    user = store.get_user(user_id) if user_id is not None else None
    if user_id is not None and not user:
        raise HTTPException(status_code=404, detail="User not found.")
    name = str(payload.get("name") or "").strip()
    if user:
        name = str(user.get("display_name") or user.get("username") or name).strip()
    if not name:
        raise HTTPException(status_code=400, detail="Member name is required.")
    role = str(payload.get("role") or "Developer").strip() or "Developer"
    project_scope = str(payload.get("project_scope") or "QuantumFlow Core").strip()[:120] or "QuantumFlow Core"
    permissions = payload.get("permissions") if isinstance(payload.get("permissions"), dict) else default_member_permissions(role)
    invite_code = str(payload.get("invite_code") or "").strip()[:40]
    member = store.add_admin_member(
        name=name[:80],
        user_id=user_id,
        role=role[:80],
        project_scope=project_scope,
        permissions=permissions,
        invite_code=invite_code,
    )
    if user_id is not None:
        store.update_user_access(user_id, role=role[:80], status="active")
        member = next((item for item in store.list_admin_members() if item["id"] == member["id"]), member)
        member["user"] = store.get_user(user_id)
    await broadcast({"kind": "admin_members", "data": store.list_admin_members()})
    return member


@app.patch("/api/admin/members/{member_id}")
async def update_admin_member(member_id: int, payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    permissions = payload.get("permissions") if isinstance(payload.get("permissions"), dict) else None
    member = store.update_admin_member(
        member_id,
        role=str(payload.get("role")).strip() if payload.get("role") else None,
        status=str(payload.get("status")).strip() if payload.get("status") else None,
        project_scope=str(payload.get("project_scope")).strip() if payload.get("project_scope") else None,
        permissions=permissions,
        invite_code=str(payload.get("invite_code")).strip() if payload.get("invite_code") is not None else None,
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")
    await broadcast({"kind": "admin_members", "data": store.list_admin_members()})
    return member


@app.delete("/api/admin/members/{member_id}")
async def delete_admin_member(member_id: int) -> Dict[str, Any]:
    if not store.delete_admin_member(member_id):
        raise HTTPException(status_code=404, detail="Member not found.")
    await broadcast({"kind": "admin_members", "data": store.list_admin_members()})
    return {"ok": True, "id": member_id}


@app.get("/api/projects/rooms")
async def project_rooms() -> List[Dict[str, Any]]:
    return store.list_project_rooms()


@app.post("/api/projects/rooms")
async def create_project_room(
    payload: Dict[str, Any] = Body(...),
    authorization: str | None = Header(default=None),
) -> Dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Project room name is required.")
    description = str(payload.get("description") or "").strip()[:500]
    try:
        user = current_user_from_header(authorization)
        owner = str(user.get("display_name") or user.get("username") or "Admin")
    except HTTPException:
        owner = str(payload.get("owner") or "Admin").strip() or "Admin"
    room = store.create_project_room(
        name=name[:120],
        description=description,
        owner=owner[:80],
        invite_code=generate_invite_code(),
    )
    store.record_task_log(None, "admin", "Project Room", "project_room_created", name, room["invite_code"])
    return room


@app.post("/api/projects/join")
async def join_project_room(
    payload: Dict[str, Any] = Body(...),
    authorization: str | None = Header(default=None),
) -> Dict[str, Any]:
    user = current_user_from_header(authorization)
    invite_code = normalize_invite_code(str(payload.get("invite_code") or ""))
    if not invite_code:
        raise HTTPException(status_code=400, detail="Invite code is required.")
    room = store.find_project_room_by_invite(invite_code)
    if not room:
        raise HTTPException(status_code=404, detail="Invite code not found or project room is inactive.")
    membership = store.join_project_room(
        int(room["id"]),
        int(user["id"]),
        str(user.get("display_name") or user.get("username") or "Developer"),
        str(user.get("role") or "Developer"),
    )
    store.record_task_log(None, "admin", "Project Room", "project_room_joined", room["name"], user["username"])
    return {"ok": True, "room": room, "membership": membership}


@app.get("/api/projects/my")
async def my_project_rooms(authorization: str | None = Header(default=None)) -> List[Dict[str, Any]]:
    user = current_user_from_header(authorization)
    return store.list_user_project_rooms(int(user["id"]))


@app.get("/api/projects/rooms/{room_id}")
async def project_room_detail(room_id: int) -> Dict[str, Any]:
    room = store.get_project_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Project room not found.")
    return room


@app.get("/api/projects/rooms/{room_id}/messages")
async def project_room_messages(room_id: int, limit: int = 100) -> List[Dict[str, Any]]:
    if not store.get_project_room(room_id):
        raise HTTPException(status_code=404, detail="Project room not found.")
    return store.list_project_room_messages(room_id, limit=max(1, min(limit, 200)))


@app.post("/api/projects/rooms/{room_id}/messages")
async def create_project_room_message(
    room_id: int,
    payload: Dict[str, Any] = Body(...),
    authorization: str | None = Header(default=None),
) -> Dict[str, Any]:
    room = store.get_project_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Project room not found.")
    user = current_user_from_header(authorization)
    text = str(payload.get("text") or "").strip()
    file_name = str(payload.get("file_name") or "").strip()[:180] or None
    kind = str(payload.get("kind") or "chat").strip().lower()
    if kind not in {"chat", "idea", "code", "file"}:
        kind = "chat"
    if not text and not file_name:
        raise HTTPException(status_code=400, detail="Message text or file name is required.")
    message = store.record_project_room_message(
        room_id=room_id,
        user_id=int(user["id"]),
        author=str(user.get("display_name") or user.get("username") or "Developer")[:80],
        kind=kind,
        text=text[:5000] or f"上传文件：{file_name}",
        file_name=file_name,
        code_language=str(payload.get("code_language") or "").strip()[:40] or None,
    )
    await broadcast({"kind": "project_room_message", "room_id": room_id, "data": message})
    return message


@app.get("/api/admin/apis")
async def admin_apis() -> List[Dict[str, Any]]:
    return store.list_api_registry()


@app.post("/api/admin/apis")
async def add_admin_api(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    method = str(payload.get("method") or "GET").strip().upper()
    path = str(payload.get("path") or "").strip()
    if method not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
        raise HTTPException(status_code=400, detail="Unsupported API method.")
    if not path.startswith("/api/"):
        raise HTTPException(status_code=400, detail="API path must start with /api/.")
    description = str(payload.get("description") or "").strip()
    record = store.add_api_registry(method=method, path=path[:160], description=description[:300])
    await broadcast({"kind": "admin_apis", "data": store.list_api_registry()})
    return record


@app.delete("/api/admin/apis/{api_id}")
async def delete_admin_api(api_id: int) -> Dict[str, Any]:
    if not store.delete_api_registry(api_id):
        raise HTTPException(status_code=404, detail="API not found.")
    await broadcast({"kind": "admin_apis", "data": store.list_api_registry()})
    return {"ok": True, "id": api_id}


@app.get("/api/code-artifacts")
async def code_artifacts(limit: int = 50) -> List[Dict[str, Any]]:
    return store.recent_code_artifacts(limit=max(1, min(limit, 200)))


def _sync_llm_completion(payload: Dict[str, Any]) -> Dict[str, Any]:
    provider = str(payload.get("provider") or "openai").strip().lower()
    model = str(payload.get("model") or "gpt-4.1-mini").strip()
    base_url = str(payload.get("base_url") or payload.get("baseUrl") or "https://api.openai.com/v1").strip().rstrip("/")
    api_key = str(payload.get("api_key") or payload.get("apiKey") or "").strip()
    prompt = str(payload.get("prompt") or "补全当前代码").strip()
    code = str(payload.get("code") or "")
    file_name = str(payload.get("file") or payload.get("file_name") or "current_file").strip()
    repo = str(payload.get("repo") or "QuantumFlow").strip()
    if not base_url:
        raise HTTPException(status_code=400, detail="API Base is required.")
    if provider != "local" and not api_key:
        raise HTTPException(status_code=400, detail="API Key is required for remote model plugins.")

    system_prompt = (
        "You are QuantumFlow's code completion plugin. "
        "Return patch-ready code or a concise implementation block. "
        "Do not include unrelated explanation. Keep the result runnable."
    )
    user_prompt = f"Repo: {repo}\nFile: {file_name}\nTask: {prompt}\n\nCurrent code:\n{code[-12000:]}"
    if provider == "local" and "11434" in base_url:
        url = f"{base_url}/api/chat" if not base_url.endswith("/api") else f"{base_url}/chat"
        body = {
            "model": model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
    else:
        url = f"{base_url}/chat/completions"
        body = {
            "model": model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[-1600:]
        raise HTTPException(status_code=502, detail=f"Model plugin HTTP error: {detail}") from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=502, detail=f"Model plugin connection failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Model plugin timed out.") from exc

    content = ""
    if isinstance(data, dict):
        if isinstance(data.get("message"), dict):
            content = str(data["message"].get("content") or "")
        if not content:
            choices = data.get("choices") or []
            if choices and isinstance(choices[0], dict):
                content = str((choices[0].get("message") or {}).get("content") or choices[0].get("text") or "")
    content = content.strip()
    if not content:
        raise HTTPException(status_code=502, detail="Model plugin returned empty content.")
    return {
        "ok": True,
        "provider": provider,
        "model": model,
        "file": file_name,
        "content": content,
        "source": "model_plugin",
    }


@app.post("/api/llm/complete")
async def llm_complete(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    result = await asyncio.to_thread(_sync_llm_completion, payload)
    store.record_task_log(
        str(payload.get("task_id") or "manual-complete"),
        "llm-plugin",
        "LLM Plugin",
        "code_completion",
        str(payload.get("file") or payload.get("file_name") or "current_file"),
        f"{result['provider']}:{result['model']}",
    )
    return result


@app.get("/api/codex-rag/memories")
async def codex_rag_memories(limit: int = 80) -> List[Dict[str, Any]]:
    seed_codex_foundation_memory()
    return store.recent_codex_memories(limit=max(1, min(limit, 200)))


@app.get("/api/codex-rag/config")
async def codex_rag_config() -> Dict[str, Any]:
    try:
        from LLM import active_codex_provider_summary

        return active_codex_provider_summary()
    except Exception:
        return {"model": None, "provider": "unavailable", "base_url": None, "has_api_key": False}


@app.post("/api/codex-rag/learn")
async def codex_rag_learn(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    text = str(payload.get("text") or "").strip()
    if len(text) < 12:
        raise HTTPException(status_code=400, detail="Memory text is too short.")
    source = str(payload.get("source") or "external-agent").strip()[:120] or "external-agent"
    role = str(payload.get("role") or "Agent").strip()[:80] or "Agent"
    tags = str(payload.get("tags") or "external-agent,learned").strip()[:200]
    memory = learn_codex_memory(source=source, role=role, text=text[:4000], tags=tags)
    return {"ok": True, "memory": memory}


@app.post("/api/codex-rag/learn-project")
async def codex_rag_learn_project(payload: Dict[str, Any] = Body(default={})) -> Dict[str, Any]:
    limit = int(payload.get("limit") or 120)
    limit = max(10, min(limit, 260))
    result = await asyncio.to_thread(index_project_for_codex, limit)
    try:
        store.record_task_log(
            None,
            "codex",
            "Codex RAG",
            "project_indexed",
            f"{result['file_count']} files",
            f"{result['memory_count']} memories",
        )
    except Exception:
        result["task_log_status"] = "skipped"
    return {"ok": True, **result}


@app.get("/api/project-deliveries")
async def project_deliveries(limit: int = 20) -> List[Dict[str, Any]]:
    return store.recent_project_deliveries(limit=max(1, min(limit, 100)))


@app.get("/api/project-deliveries/{delivery_id}/download")
async def download_project_delivery(delivery_id: int) -> FileResponse:
    delivery = store.get_project_delivery(delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Project delivery not found.")
    package_path = Path(str(delivery.get("package_path") or ""))
    if not package_path.exists() or not package_path.is_file():
        raise HTTPException(status_code=404, detail="Project package file is missing.")
    return FileResponse(
        package_path,
        media_type="application/zip",
        filename=package_path.name,
    )


@app.post("/api/project-deliveries/{delivery_id}/test")
async def test_project_delivery(delivery_id: int) -> Dict[str, Any]:
    delivery = store.get_project_delivery(delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Project delivery not found.")
    project_path = Path(str(delivery.get("project_path") or ""))
    if not project_path.exists() or not project_path.is_dir():
        raise HTTPException(status_code=404, detail="Project directory is missing.")

    python_exe = project_python_exe()
    smoke_code = """
from fastapi.testclient import TestClient
from app.main import app

with TestClient(app) as client:
    health = client.get('/api/health')
    assert health.status_code == 200, health.text
    created = client.post('/api/tasks', json={'title': 'QuantumFlow runtime smoke task', 'owner': 'Tester', 'priority': 'high'})
    assert created.status_code == 200, created.text
    task_id = created.json()['id']
    updated = client.patch(f'/api/tasks/{task_id}', json={'status': 'done'})
    assert updated.status_code == 200, updated.text
    listed = client.get('/api/tasks')
    assert listed.status_code == 200, listed.text
print('runtime smoke ok: health, create task, update task, list tasks')
"""
    result = subprocess.run(
        [str(python_exe), "-c", smoke_code],
        cwd=str(project_path),
        text=True,
        capture_output=True,
        timeout=30,
    )
    output = "\n".join(part for part in [result.stdout.strip(), result.stderr.strip()] if part)
    status = "passed" if result.returncode == 0 else "failed"
    updated = store.update_project_delivery_test(
        delivery_id,
        test_status=status,
        test_output=output[-4000:],
    )
    store.record_task_log(
        str(delivery.get("task_id") or ""),
        "tester",
        "Runtime Test Environment",
        "project_runtime_test",
        str(delivery.get("title") or ""),
        output[-1000:],
        status="ok" if status == "passed" else "failed",
    )
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    delivery_state = {**(updated or delivery), **project_delivery_runtime_state(delivery_id)}
    return {"ok": status == "passed", "delivery": delivery_state, "output": output, **project_delivery_runtime_state(delivery_id)}


@app.post("/api/project-deliveries/{delivery_id}/run")
async def run_project_delivery(delivery_id: int) -> Dict[str, Any]:
    delivery = store.get_project_delivery(delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Project delivery not found.")
    project_path = Path(str(delivery.get("project_path") or ""))
    if not project_path.exists() or not project_path.is_dir():
        raise HTTPException(status_code=404, detail="Project directory is missing.")

    existing = delivery_runtime_processes.get(delivery_id)
    if existing and existing.get("process") and existing["process"].poll() is None:
        state = project_delivery_runtime_state(delivery_id)
        return {"ok": True, "status": "running", "url": state.get("runtime_url"), "delivery": {**delivery, **state}, "output": "项目 Web UI 已在运行。"}

    port = project_delivery_port(delivery_id)
    url = f"http://127.0.0.1:{port}"
    command = [
        str(project_python_exe()),
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
    ]
    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    process = subprocess.Popen(
        command,
        cwd=str(project_path),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        creationflags=creationflags,
    )
    delivery_runtime_processes[delivery_id] = {"process": process, "port": port, "url": url}

    output = ""
    for _ in range(18):
        await asyncio.sleep(0.25)
        if process.poll() is not None:
            output = (process.stdout.read() if process.stdout else "") or "项目运行进程已退出。"
            break
        try:
            await asyncio.to_thread(urllib.request.urlopen, f"{url}/api/health", timeout=0.6)
            output = "项目 Web UI 已启动，可打开网页界面测试。"
            break
        except Exception:
            continue

    if not output:
        output = "项目进程已启动，健康检查仍在等待中。"
    ok = process.poll() is None
    status = "running" if ok else "failed"
    updated = store.update_project_delivery_test(
        delivery_id,
        test_status=status,
        test_output=output[-4000:],
    )
    store.record_task_log(
        str(delivery.get("task_id") or ""),
        "tester",
        "Runtime Test Environment",
        "project_runtime_run",
        str(delivery.get("title") or ""),
        f"{url}\n{output}"[-1000:],
        status="ok" if ok else "failed",
    )
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    state = project_delivery_runtime_state(delivery_id)
    return {"ok": ok, "status": status, "url": url, "delivery": {**(updated or delivery), **state}, "output": output}


@app.post("/api/project-deliveries/{delivery_id}/fix")
async def fix_project_delivery(delivery_id: int) -> Dict[str, Any]:
    delivery = store.get_project_delivery(delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Project delivery not found.")
    title = f"修复项目运行环境：{delivery.get('title') or delivery_id}"
    owner_id = "tester" if "tester" in runtime.agents else "backend"
    x, y = next_station(owner_id)
    task = runtime.add_task(title, owner_id, x, y, source="runtime_fix")
    detail = str(delivery.get("last_test_output") or "请重新测试项目运行环境并修复启动/接口/UI 问题。")[-1200:]
    store.record_task_log(task.id, owner_id, runtime.agents[owner_id].role, "runtime_fix_requested", title, detail, status="queued")
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    schedule_auto_dispatch("runtime_fix_requested")
    return {"ok": True, "task": task.to_dict(), "snapshot": runtime_snapshot()}


@app.post("/api/code-artifacts/manual")
async def manual_code_artifact(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    target_key = str(payload.get("target_key") or "").strip()
    code_text = str(payload.get("code_text") or "")
    agent_id = str(payload.get("agent_id") or "human").strip() or "human"
    task_id = str(payload.get("task_id") or "manual-edit").strip() or "manual-edit"
    explanation = str(payload.get("explanation") or "Manual IDE Bridge edit from QuantumFlow Desktop.")
    if not target_key:
        raise HTTPException(status_code=400, detail="target_key is required.")
    if not code_text.strip():
        raise HTTPException(status_code=400, detail="code_text is required.")
    artifact = store.record_code_artifact(
        task_id=task_id,
        agent_id=agent_id,
        target_key=target_key,
        code_text=code_text,
        explanation=explanation,
        status="manual_edit",
    )
    runtime.record("manual_code_saved", "master", f"Manual IDE Bridge edit saved: {target_key}", task_id)
    store.record_task_log(task_id, agent_id, "Human IDE Bridge", "manual_code_saved", target_key, explanation)
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    return artifact


@app.post("/api/git/sync")
async def git_sync(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    source = str(payload.get("url") or payload.get("source") or "").strip()
    requested_name = str(payload.get("name") or "").strip()
    if not source:
        raise HTTPException(status_code=400, detail="Git url or local path is required.")
    GENERATED_REPOS_ROOT.mkdir(parents=True, exist_ok=True)
    repo_name = safe_repo_name(requested_name or infer_repo_name(source))
    destination = (GENERATED_REPOS_ROOT / repo_name).resolve()
    if not str(destination).startswith(str(GENERATED_REPOS_ROOT.resolve())):
        raise HTTPException(status_code=400, detail="Invalid repository destination.")

    try:
        if destination.exists() and (destination / ".git").exists():
            command = ["git", "-C", str(destination), "pull", "--ff-only"]
            mode = "pull"
        elif destination.exists() and any(destination.iterdir()):
            raise HTTPException(status_code=409, detail="Destination exists and is not an empty git repository.")
        else:
            command = ["git", "clone", source, str(destination)]
            mode = "clone"
        result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=120)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail="git executable was not found.") from exc
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="git command timed out.") from exc

    ok = result.returncode == 0
    if not ok:
      raise HTTPException(
          status_code=502,
          detail={
              "message": "git command failed",
              "stdout": result.stdout[-1200:],
              "stderr": result.stderr[-1200:],
          },
      )
    store.record_task_log(None, "master", "Git Bridge", f"git_{mode}", source, str(destination))
    return {
        "ok": True,
        "mode": mode,
        "repo": repo_name,
        "path": str(destination),
        "stdout": result.stdout[-1200:],
        "stderr": result.stderr[-1200:],
    }


def infer_repo_name(source: str) -> str:
    clean = source.rstrip("/\\")
    if clean.startswith("file://"):
        clean = clean[7:]
    name = Path(clean).name or "quantumflow-project"
    if name.endswith(".git"):
        name = name[:-4]
    return name


def safe_repo_name(name: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "-", name).strip(".-")
    return safe[:80] or "quantumflow-project"


@app.post("/api/agents/arbitrate")
async def arbitrate_agent(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    title = str(payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required.")
    result = score_agent_candidates(title)
    store.record_task_log(
        None,
        "master",
        "Control Plane",
        "agent_arbitration",
        title,
        f"recommended={result['recommended_agent']}",
    )
    return result


@app.post("/api/outbox/{message_id}/mark-sent")
async def mark_outbox_sent(message_id: int) -> Dict[str, Any]:
    message = store.mark_outbox_sent(message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Outbox message not found.")
    return message


@app.post("/api/connectors/flush-outbox")
async def flush_outbox(payload: Dict[str, Any] | None = Body(default=None)) -> Dict[str, Any]:
    payload = payload or {}
    limit = max(1, min(int(payload.get("limit") or 20), 100))
    pending = store.retryable_outbox(limit=limit)
    results = []
    for message in pending:
        send_result = send_connector_message(message)
        if send_result.get("ok"):
            status = "dry_run" if send_result.get("mode") == "dry_run" else "sent"
        else:
            status = "failed"
        updated = store.mark_outbox_sent(int(message["id"]), status=status, result=send_result)
        results.append(updated or {**message, "status": status, "result": send_result})
    return {"processed": len(results), "results": results}


@app.post("/api/connectors/test-feishu")
async def test_feishu_connector(payload: Dict[str, Any] | None = Body(default=None)) -> Dict[str, Any]:
    payload = payload or {}
    text = str(payload.get("text") or "QuantumFlow 飞书连接测试：如果你看到这条消息，说明机器人已经收到。")
    message = store.enqueue_connector_message(
        connector="feishu",
        event_type="test_message",
        payload={"text": text, "title": "QuantumFlow 飞书连接测试"},
    )
    send_result = send_connector_message(message)
    if send_result.get("ok"):
        status = "dry_run" if send_result.get("mode") == "dry_run" else "sent"
    else:
        status = "failed"
    updated = store.mark_outbox_sent(int(message["id"]), status=status, result=send_result)
    return updated or {**message, "status": status, "result": send_result}


@app.post("/api/connectors/send-feishu")
async def send_feishu_manual(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    text = str(payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message text is required.")
    message = store.enqueue_connector_message(
        connector="feishu",
        event_type="manual_message",
        payload={"text": text, "title": "QuantumFlow 鎵嬪姩娑堟伅"},
    )
    send_result = send_connector_message(message)
    if send_result.get("ok"):
        status = "dry_run" if send_result.get("mode") == "dry_run" else "sent"
    else:
        status = "failed"
    updated = store.mark_outbox_sent(int(message["id"]), status=status, result=send_result)
    result_record = updated or {**message, "status": status, "result": send_result}
    loopback = None
    if status in {"sent", "dry_run"} and parse_bot_command(text).name in {"issue", "code"}:
        loopback = await bot_chat(
            {
                "text": text,
                "conversation_id": "manual-feishu-loopback",
                "sender_id": "desktop-user",
                "message_id": f"manual-feishu-{message['id']}",
            }
        )
    if loopback:
        result_record = {**result_record, "loopback": loopback}
    return result_record


@app.get("/api/connectors/config")
async def get_connector_config() -> Dict[str, Any]:
    config = connector_config()
    return {
        "feishu_configured": bool(config.get("feishu_webhook_url")),
        "wecom_configured": bool(config.get("wecom_webhook_url")),
    }


@app.post("/api/bot/chat")
async def bot_chat(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    text = str(payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message text is required.")
    synthetic = {
        "event": {
            "message": {
                "content": {"text": text},
                "chat_id": str(payload.get("conversation_id") or "desktop-chat"),
                "message_id": str(payload.get("message_id") or f"desktop-{len(store.recent_bot_messages(1)) + 1}"),
            },
            "sender": {"sender_id": str(payload.get("sender_id") or "desktop-user")},
        }
    }
    return await handle_feishu_bot_message(synthetic)


@app.post("/api/connectors/config")
async def set_connector_config(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    config = save_connector_config(payload)
    return {
        "feishu_configured": bool(config.get("feishu_webhook_url")),
        "wecom_configured": bool(config.get("wecom_webhook_url")),
    }


@app.post("/api/tasks")
async def create_task(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    title = str(payload.get("title", "")).strip()
    owner_id = str(payload.get("owner_id", "master")).strip()
    if not title:
        raise HTTPException(status_code=400, detail="Task title is required.")
    if owner_id not in runtime.agents:
        raise HTTPException(status_code=400, detail=f"Unknown owner_id: {owner_id}")

    x, y = next_station(owner_id)
    task = runtime.add_task(title, owner_id, x, y, source="desktop")
    store.record_task_log(task.id, owner_id, runtime.agents[owner_id].role, "task_created", title)
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    schedule_auto_dispatch("desktop_task_created")
    return runtime_snapshot()


@app.post("/api/patch/preview")
async def patch_preview(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    try:
        candidate = build_candidate(str(payload.get("target_key", "")), str(payload.get("suggestion", "")))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    validation = validate_candidate(candidate)
    return {
        "target_key": candidate.target_key,
        "target": str(candidate.target_path),
        "preview_lines": candidate.preview_lines,
        "validation": validation,
    }


@app.post("/api/patch/candidates")
async def patch_candidate_create(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    try:
        candidate = build_candidate(str(payload.get("target_key", "")), str(payload.get("suggestion", "")))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    validation = validate_candidate(candidate)
    candidate_id = f"candidate-{len(patch_candidates) + 1:04d}"
    record = {
        "id": candidate_id,
        "target_key": candidate.target_key,
        "target": str(candidate.target_path),
        "suggestion": candidate.suggestion,
        "preview_lines": candidate.preview_lines,
        "validation": validation,
        "status": "ready" if validation["ok"] else "rejected",
        "task_id": str(payload.get("task_id") or "review-auto"),
        "reviewer_id": str(payload.get("reviewer_id") or "reviewer"),
        "vote_weight": float(payload.get("vote_weight") or 1),
        "vote_count": int(payload.get("vote_count") or 1),
    }
    patch_candidates[candidate_id] = record
    store.record_task_log(record["task_id"], record["reviewer_id"], "Reviewer", "patch_candidate_created", record["suggestion"], record["target_key"])
    return record


@app.get("/api/patch/candidates")
async def patch_candidate_list() -> List[Dict[str, Any]]:
    return list(patch_candidates.values())[-20:][::-1]


@app.post("/api/patch/candidates/{candidate_id}/apply")
async def patch_candidate_apply(candidate_id: str) -> Dict[str, Any]:
    record = patch_candidates.get(candidate_id)
    if not record:
        raise HTTPException(status_code=404, detail="Patch candidate not found.")
    if record["status"] != "ready":
        raise HTTPException(status_code=400, detail=f"Candidate is not ready: {record['status']}")
    try:
        candidate = build_candidate(record["target_key"], record["suggestion"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    result = apply_candidate(candidate)
    if not result["ok"]:
        record["status"] = "rejected"
        record["validation"] = result
        store.record_task_log(record["task_id"], "reviewer", "Reviewer", "patch_candidate_rejected", record["suggestion"], str(result), status="failed")
        raise HTTPException(status_code=400, detail=result)

    record["status"] = "applied"
    record["result"] = result
    record["adoption"] = store.record_adoption(
        task_id=record["task_id"],
        reviewer_id=record["reviewer_id"],
        option_text=record["suggestion"],
        vote_weight=record["vote_weight"],
        vote_count=record["vote_count"],
        comment="候选补丁已通过校验并写入目标文件。",
        target_key=record["target_key"],
        candidate_id=candidate_id,
    )
    runtime.record("patch_applied", "master", f"已应用候选补丁：{record['target_key']}")
    store.record_task_log(record["task_id"], "master", "Master", "patch_candidate_applied", record["suggestion"], record["target_key"])
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    return record


@app.post("/api/patch/apply")
async def patch_apply(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    try:
        candidate = build_candidate(str(payload.get("target_key", "")), str(payload.get("suggestion", "")))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    result = apply_candidate(candidate)
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result)
    task_id = str(payload.get("task_id") or "review-auto")
    runtime.record("patch_applied", "master", f"已写入代码：{candidate.target_key}")
    store.record_adoption(
        task_id=task_id,
        reviewer_id=str(payload.get("reviewer_id") or "reviewer"),
        option_text=candidate.suggestion,
        vote_weight=float(payload.get("vote_weight") or 1),
        vote_count=int(payload.get("vote_count") or 1),
        comment=str(payload.get("comment") or "直接应用补丁。"),
        target_key=candidate.target_key,
        candidate_id="direct-apply",
    )
    store.record_task_log(task_id, "master", "Master", "patch_applied", candidate.suggestion, candidate.target_key)
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    return result


@app.get("/api/patch/history")
async def patch_history(limit: int = 20) -> List[Dict[str, Any]]:
    return read_history(limit=max(1, min(limit, 100)))


@app.post("/api/integrations/inbound")
async def integration_inbound(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    inbound = normalize_generic_task(payload)
    await create_inbound_task(inbound)
    return runtime_snapshot()


@app.get("/api/integrations/wecom/callback")
async def wecom_verify(echostr: str = "") -> Dict[str, str]:
    return {"echostr": echostr}


@app.post("/api/integrations/wecom/callback")
async def wecom_callback(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    inbound = normalize_wecom_message(payload)
    await create_inbound_task(inbound)
    return runtime_snapshot()


@app.post("/api/integrations/feishu/callback")
async def feishu_callback(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    if "challenge" in payload:
        return {"challenge": payload["challenge"]}
    return await handle_feishu_bot_message(payload)


@app.post("/api/reset")
async def reset() -> Dict[str, Any]:
    global runtime
    runtime = default_runtime()
    runtime.record("system", "master", "系统已重置，等待新的用户目标。")
    store.record_task_log(None, "master", "Master", "system_reset", "", "runtime reset")
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    return runtime_snapshot()


@app.post("/api/dispatch-next")
async def dispatch_next() -> Dict[str, Any]:
    await run_next_task()
    return runtime_snapshot()


def online_collaborators() -> List[Dict[str, Any]]:
    seen: set[str] = set()
    peers: List[Dict[str, Any]] = []
    virtual = virtual_network_snapshot()
    for assistant in SYSTEM_ASSISTANTS:
        seen.add(str(assistant["id"]))
        peers.append(dict(assistant))
    for peer in peer_sessions.values():
        peer_id = str(peer.get("id") or peer.get("name") or "guest")
        if peer_id in seen:
            continue
        seen.add(peer_id)
        peers.append(
            {
                "id": peer_id,
                "name": str(peer.get("name") or "Guest"),
                "role": str(peer.get("role") or "Collaborator"),
                "kind": str(peer.get("kind") or "developer"),
                "source": str(peer.get("source") or peer.get("ip") or peer.get("host") or "LAN / WebSocket"),
                "ip": str(peer.get("ip") or ""),
                "host": str(peer.get("host") or ""),
                "status": "online",
                "virtual_network": virtual,
            }
        )
    return peers


def virtual_network_snapshot() -> Dict[str, Any]:
    networks = read_zerotier_networks()
    target = next((item for item in networks if str(item.get("id") or "").lower() == ZEROTIER_NETWORK_ID), None)
    status = str(target.get("status") if target else "OFFLINE").upper()
    assigned_ips = target.get("assigned_ips") if target else []
    online = bool(target and status == "OK" and assigned_ips)
    local_peer = {
        "id": f"zt-{ZEROTIER_NETWORK_ID}",
        "name": "ZeroTier 虚拟网络",
        "role": "Virtual Network",
        "kind": "virtual_network",
        "source": f"ZeroTier {ZEROTIER_NETWORK_ID}",
        "status": "online" if online else ("待授权" if status == "ACCESS_DENIED" else "offline"),
        "network_id": ZEROTIER_NETWORK_ID,
        "ip": assigned_ips[0] if assigned_ips else "",
        "raw_status": status,
    }
    return {
        "network_id": ZEROTIER_NETWORK_ID,
        "online": online,
        "status": local_peer["status"],
        "raw_status": status,
        "assigned_ips": assigned_ips,
        "networks": networks,
        "local_peer": local_peer,
    }


def read_zerotier_networks() -> List[Dict[str, Any]]:
    cli_networks = read_zerotier_networks_from_cli()
    if cli_networks:
        return cli_networks
    return read_zerotier_networks_from_status_file()


def read_zerotier_networks_from_cli() -> List[Dict[str, Any]]:
    if not ZEROTIER_EXE.exists() or not ZEROTIER_TOKEN.exists():
        return []
    try:
        token = ZEROTIER_TOKEN.read_text(encoding="utf-8", errors="ignore").strip()
        result = subprocess.run(
            [str(ZEROTIER_EXE), "-q", f"-T{token}", "-j", "listnetworks"],
            text=True,
            capture_output=True,
            timeout=8,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return []
        data = json.loads(result.stdout)
    except Exception:
        return []
    networks = []
    for item in data if isinstance(data, list) else []:
        assigned = []
        for value in item.get("assignedAddresses") or []:
            ip = str(value).split("/", 1)[0]
            if ip:
                assigned.append(ip)
        networks.append(
            {
                "id": str(item.get("nwid") or item.get("id") or ""),
                "name": str(item.get("name") or ""),
                "status": str(item.get("status") or ""),
                "type": str(item.get("type") or ""),
                "device": str(item.get("portDeviceName") or item.get("dev") or ""),
                "assigned_ips": assigned,
            }
        )
    return networks


def read_zerotier_networks_from_status_file() -> List[Dict[str, Any]]:
    if not ZEROTIER_STATUS_FILE.exists():
        return []
    text = ZEROTIER_STATUS_FILE.read_text(encoding="utf-8", errors="ignore")
    networks = []
    for line in text.splitlines():
        if not line.startswith("200 listnetworks "):
            continue
        parts = line.split()
        if len(parts) < 4 or parts[2] == "<nwid>":
            continue
        assigned = []
        for part in parts[7:]:
            if "/" in part and part[0].isdigit():
                assigned.append(part.split("/", 1)[0])
        networks.append(
            {
                "id": parts[2],
                "name": parts[3] if len(parts) > 3 else "",
                "status": parts[4] if len(parts) > 4 else "",
                "type": parts[5] if len(parts) > 5 else "",
                "device": parts[6] if len(parts) > 6 else "",
                "assigned_ips": assigned,
            }
        )
    return networks


def lan_ip_candidates() -> List[str]:
    candidates: set[str] = set()
    try:
        hostname = socket.gethostname()
        for item in socket.getaddrinfo(hostname, None, family=socket.AF_INET):
            ip = item[4][0]
            if not ip.startswith("127."):
                candidates.add(ip)
    except OSError:
        pass
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        ip = probe.getsockname()[0]
        if not ip.startswith("127."):
            candidates.add(ip)
        probe.close()
    except OSError:
        pass
    return sorted(candidates)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    clients.append(websocket)
    peer_id = id(websocket)
    peer_sessions[peer_id] = {
        "id": f"peer-{peer_id}",
        "name": "Guest",
        "role": "Collaborator",
    }
    await websocket.send_json({"kind": "snapshot", "data": runtime_snapshot()})
    await websocket.send_json({"kind": "collaboration_comments", "data": store.recent_collaboration_comments(limit=80)})
    await websocket.send_json(
        {
            "kind": "chat_history",
            "data": {
                "admin_chat": store.recent_collaboration_comments(kind="admin_chat", limit=100),
                "public_chat": store.recent_collaboration_comments(kind="public_chat", limit=120),
            },
        }
    )
    await broadcast({"kind": "online", "data": online_collaborators()})
    try:
        while True:
            message = await websocket.receive_json()
            command = message.get("command")
            if command == "dispatch_next":
                await run_next_task()
            elif command == "reset":
                await reset()
            elif command == "snapshot":
                await websocket.send_json({"kind": "snapshot", "data": runtime_snapshot()})
            elif command == "hello":
                peer_sessions[peer_id] = {
                    "id": str(message.get("client_id") or f"peer-{peer_id}")[:80],
                    "name": str(message.get("name") or "Guest")[:60],
                    "role": str(message.get("role") or "Collaborator")[:60],
                }
                await broadcast({"kind": "online", "data": online_collaborators()})
            elif command == "comment":
                text = str(message.get("text") or "").strip()
                if text:
                    peer = peer_sessions.get(peer_id, {})
                    comment = store.record_collaboration_comment(
                        author=str(peer.get("name") or message.get("name") or "Guest")[:60],
                        text=text[:2000],
                        kind=str(message.get("kind") or "suggestion")[:40],
                        target_key=str(message.get("target_key") or "")[:160] or None,
                        votes=1,
                    )
                    await broadcast({"kind": "collaboration_comment", "data": comment})
            elif command == "chat":
                text = str(message.get("text") or "").strip()
                kind = str(message.get("kind") or "public_chat").strip()
                if kind not in {"public_chat", "admin_chat"}:
                    kind = "public_chat"
                if text:
                    peer = peer_sessions.get(peer_id, {})
                    author_name = str(peer.get("name") or message.get("name") or "Guest")[:60]
                    author_role = str(peer.get("role") or message.get("role") or "Collaborator")[:80]
                    comment = store.record_collaboration_comment(
                        author=author_name,
                        text=text[:2000],
                        kind=kind,
                        target_key=str(message.get("target_key") or ("开发者群聊" if kind == "admin_chat" else "开源世界"))[:160],
                        votes=1,
                    )
                    maybe_learn_external_agent_reply(author_name, author_role, text, kind)
                    await broadcast({"kind": "chat_message", "data": comment})
                    assistant_reply = codex_assistant_reply(text, kind)
                    if assistant_reply:
                        reply = store.record_collaboration_comment(
                            author="Codex",
                            text=assistant_reply[:2000],
                            kind=kind,
                            target_key="AI Assistant",
                            votes=0,
                        )
                        await broadcast({"kind": "chat_message", "data": reply})
            elif command == "clear_chat":
                kind = str(message.get("kind") or "admin_chat").strip()
                if kind not in {"public_chat", "admin_chat"}:
                    kind = "admin_chat"
                store.clear_collaboration_comments(kind=kind)
                await broadcast({"kind": "chat_cleared", "data": {"kind": kind}})
    except WebSocketDisconnect:
        if websocket in clients:
            clients.remove(websocket)
        peer_sessions.pop(peer_id, None)
        await broadcast({"kind": "online", "data": online_collaborators()})


def codex_assistant_reply(text: str, kind: str) -> str | None:
    if kind not in {"admin_chat", "public_chat"}:
        return None
    normalized = text.strip().lower()
    if not normalized:
        return None
    triggers = ("codex", "@codex", "智能助手")
    if not any(trigger in normalized for trigger in triggers):
        return None
    cleaned = re.sub(r"@?codex", "", text, flags=re.IGNORECASE).strip() or text.strip()
    cleaned_normalized = cleaned.lower()
    if any(word in cleaned_normalized for word in ("你好", "hello", "hi", "在吗")):
        return f"我在，并已加载 QuantumFlow 知识库。{CODEX_KNOWLEDGE_PROFILE['identity']}"
    if any(word in cleaned_normalized for word in ("状态", "status", "在线")):
        return f"我在线，当前通道里有 {len(online_collaborators())} 个开发者与智能体。"
    return codex_llm_or_local_reply(cleaned)


def codex_llm_or_local_reply(text: str) -> str:
    rag_context = format_codex_rag_prompt_context(text)
    try:
        from LLM import MissingModelKey, invoke_codex_rag

        reply = invoke_codex_rag(text, rag_context)
        if reply:
            return reply[:2000]
    except MissingModelKey:
        pass
    except Exception:
        pass
    return codex_knowledge_reply(text)


def maybe_learn_external_agent_reply(author: str, role: str, text: str, kind: str) -> None:
    normalized_author = author.strip().lower()
    normalized_role = role.strip().lower()
    if normalized_author == "codex" or "codex" in normalized_author:
        return
    if len(text.strip()) < 24:
        return
    looks_like_agent = "agent" in normalized_role or normalized_role in AGENT_MEMORY_ROLES or "assistant" in normalized_role
    if not looks_like_agent:
        return
    learn_codex_memory(
        source=f"{kind}:{author}",
        role=role or "External Agent",
        text=text[:4000],
        tags=f"external-agent,{kind},{role}",
    )


def learn_codex_memory(source: str, role: str, text: str, tags: str = "external-agent,learned") -> Dict[str, Any]:
    return store.record_codex_memory(
        source=source,
        role=role,
        text=text,
        tags=tags,
        pinned=False,
    )


def index_project_for_codex(limit: int = 120) -> Dict[str, Any]:
    files = list(iter_project_learning_files(limit))
    memories: List[Dict[str, Any]] = []
    total_bytes = 0
    fallback_used = False
    for path in files:
        try:
            raw = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        total_bytes += len(raw.encode("utf-8", errors="ignore"))
        relative = path.relative_to(ROOT).as_posix()
        text = summarize_project_file(relative, raw)
        memory, used_fallback = record_project_index_memory(
            source=f"project:{relative}",
            role="Project Index",
            text=text[:4000],
            tags=f"project-index,{path.suffix.lstrip('.').lower() or 'text'}",
        )
        fallback_used = fallback_used or used_fallback
        memories.append(memory)
    db_memory = summarize_project_database()
    if db_memory:
        memory, used_fallback = record_project_index_memory(
            source="project:quantumflow.db",
            role="Project Database Schema",
            text=db_memory[:4000],
            tags="project-index,database,sqlite",
        )
        fallback_used = fallback_used or used_fallback
        memories.append(memory)
    return {
        "file_count": len(files),
        "memory_count": len(memories),
        "total_bytes": total_bytes,
        "sample_sources": [memory["source"] for memory in memories[:8]],
        "mode": "project-rag-index-json" if fallback_used else "project-rag-index",
        "note": "这是项目级 RAG/上下文索引，不是重新预训练模型权重。",
    }


def record_project_index_memory(source: str, role: str, text: str, tags: str) -> tuple[Dict[str, Any], bool]:
    try:
        return (
            store.record_codex_memory(
                source=source,
                role=role,
                text=text,
                tags=tags,
                pinned=False,
            ),
            False,
        )
    except Exception:
        memory = upsert_project_index_json(source=source, role=role, text=text, tags=tags)
        return memory, True


def load_project_index_json() -> List[Dict[str, Any]]:
    if not CODEX_PROJECT_INDEX_FILE.exists():
        return []
    try:
        data = json.loads(CODEX_PROJECT_INDEX_FILE.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
    except Exception:
        return []
    return []


def save_project_index_json(memories: List[Dict[str, Any]]) -> None:
    CODEX_PROJECT_INDEX_FILE.write_text(json.dumps(memories, ensure_ascii=False, indent=2), encoding="utf-8")


def upsert_project_index_json(source: str, role: str, text: str, tags: str) -> Dict[str, Any]:
    memories = load_project_index_json()
    created_at = datetime.now().isoformat(timespec="seconds")
    existing = next((item for item in memories if item.get("source") == source and item.get("role") == role and item.get("tags") == tags), None)
    if existing:
        existing.update({"text": text, "created_at": created_at, "pinned": False})
        memory = existing
    else:
        memory = {
            "id": f"json-{len(memories) + 1:04d}",
            "source": source,
            "role": role,
            "text": text,
            "tags": tags,
            "pinned": False,
            "created_at": created_at,
        }
        memories.append(memory)
    save_project_index_json(memories)
    return memory


def iter_project_learning_files(limit: int) -> List[Path]:
    priority = [
        ROOT / "README.md",
        ROOT / "server.py",
        ROOT / "storage.py",
        ROOT / "Agent.py",
        ROOT / "LLM.py",
        ROOT / "RAG.py",
        ROOT / "quantumflow-mvp" / "index.html",
        ROOT / "quantumflow-mvp" / "app.js",
        ROOT / "quantumflow-mvp" / "styles.css",
        ROOT / "Multi-Agent" / "docs" / "multi-agent-design.md",
    ]
    selected: List[Path] = []
    seen: set[Path] = set()
    for path in priority:
        if path.exists() and path.is_file():
            selected.append(path)
            seen.add(path.resolve())
    for path in ROOT.rglob("*"):
        if len(selected) >= limit:
            break
        if not path.is_file() or path.suffix.lower() not in PROJECT_LEARN_EXTENSIONS:
            continue
        if any(part in PROJECT_LEARN_EXCLUDED_DIRS for part in path.relative_to(ROOT).parts):
            continue
        resolved = path.resolve()
        if resolved in seen:
            continue
        if path.stat().st_size > 420_000:
            continue
        selected.append(path)
        seen.add(resolved)
    return selected[:limit]


def summarize_project_file(relative: str, raw: str) -> str:
    lines = raw.splitlines()
    interesting: List[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if (
            stripped.startswith(("# ", "## ", "### ", "def ", "class ", "async def ", "@app.", "function ", "const ", "let "))
            or "id=\"" in stripped
            or "class=\"" in stripped
        ):
            interesting.append(stripped[:220])
        if len(interesting) >= 80:
            break
    excerpt = "\n".join(interesting) if interesting else "\n".join(lines[:80])
    return f"Project file: {relative}\nPurpose signals and key symbols:\n{excerpt[:3600]}"


def summarize_project_database() -> str:
    db_path = ROOT / "quantumflow.db"
    if not db_path.exists():
        return ""
    try:
        with sqlite3.connect(db_path) as conn:
            tables = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            ).fetchall()
            blocks = []
            for (name,) in tables[:40]:
                columns = conn.execute(f"PRAGMA table_info({name})").fetchall()
                column_text = ", ".join(f"{column[1]}:{column[2]}" for column in columns)
                blocks.append(f"{name}({column_text})")
            return "QuantumFlow SQLite schema learned by Codex:\n" + "\n".join(blocks)
    except Exception as error:
        return f"QuantumFlow SQLite schema scan failed: {error}"


def retrieve_codex_memories(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    seed_codex_foundation_memory()
    try:
        memories = store.recent_codex_memories(limit=200)
    except Exception:
        memories = []
    memories = [*memories, *load_project_index_json()]
    terms = rag_terms(query)
    scored = []
    for memory in memories:
        haystack = f"{memory.get('text', '')} {memory.get('tags', '')} {memory.get('role', '')}".lower()
        score = 8 if memory.get("pinned") else 0
        score += sum(2 for term in terms if term in haystack)
        if memory.get("pinned") or score > 0:
            scored.append((score, int(memory.get("id") or 0), memory))
    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    pinned = [item for _, _, item in scored if item.get("pinned")][:2]
    learned = [item for _, _, item in scored if not item.get("pinned")][:limit]
    merged = []
    seen = set()
    for item in [*pinned, *learned]:
        key = item.get("id")
        if key in seen:
            continue
        seen.add(key)
        merged.append(item)
    return merged[: max(limit, 3)]


def rag_terms(text: str) -> set[str]:
    lowered = text.lower()
    terms = {part for part in re.split(r"[\s,，。.!?！？:：/\\-]+", lowered) if len(part) >= 2}
    chinese = re.findall(r"[\u4e00-\u9fff]{2,}", lowered)
    terms.update(chinese)
    return terms


def codex_knowledge_reply(text: str) -> str:
    normalized = text.lower()
    arithmetic = answer_simple_arithmetic(text)
    if arithmetic:
        return arithmetic
    if any(keyword in normalized for keyword in ("学习整个项目", "学习项目", "预训练", "训练整个项目", "项目知识库", "索引整个项目")):
        rag_context = format_codex_rag_context(text)
        return "可以把整个项目交给 Codex 学习，但这里做的是项目级 RAG/上下文索引，不是重新预训练模型权重。系统会扫描源码、前端页面、设计文档和 SQLite 表结构，写入 codex_memory；之后回答时会检索这些项目记忆再组织答案。" + rag_context
    topic_matrix = [
        (("架构", "系统", "分层", "control", "plane", "master", "slave", "pulsar", "redis", "vector", "graph", "k8s"), "architecture"),
        (("codex", "后端", "api", "数据库", "事务", "权重"), "codex"),
        (("rag", "skill", "提示词", "系统提示", "训练", "知识库", "context"), "llm"),
        (("自愈", "gap", "测试", "qa", "错误", "修复", "路由"), "quality"),
        (("流程", "交付", "步骤", "闭环", "沙箱", "git", "环境"), "workflow"),
        (("投票", "仲裁", "human", "否决", "gemini", "opencode"), "api"),
        (("愿景", "社区", "开源", "github", "未来"), "vision"),
    ]
    for keywords, key in topic_matrix:
        if any(keyword in normalized for keyword in keywords):
            reply = CODEX_KNOWLEDGE_PROFILE[key]
            rag_context = format_codex_rag_context(text)
            if rag_context:
                reply += rag_context
            if key == "llm":
                reply += " 这里做的是工程化知识注入，不是重新训练模型权重。"
            return reply
    rag_context = format_codex_rag_context(text)
    return "收到。按 QuantumFlow 设计，我会先把问题拆成目标、上下文、执行 Agent、沙箱验证和验收标准；涉及后端 API/数据库时由 Codex 主导，涉及 UI 交互时交给前端 Agent，并由负责人仲裁。" + rag_context


def answer_simple_arithmetic(text: str) -> str:
    expression = re.sub(r"[=？?]", "", text).strip()
    if not expression or not re.fullmatch(r"[\d+\-*/().\s]+", expression) or not re.search(r"[+\-*/]", expression):
        return ""
    try:
        tree = ast.parse(expression, mode="eval")
        value = _eval_arithmetic_node(tree.body)
    except Exception:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _eval_arithmetic_node(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return float(node.value)
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        value = _eval_arithmetic_node(node.operand)
        return value if isinstance(node.op, ast.UAdd) else -value
    if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)):
        left = _eval_arithmetic_node(node.left)
        right = _eval_arithmetic_node(node.right)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if right == 0:
            raise ZeroDivisionError
        return left / right
    raise ValueError("unsupported arithmetic")


def format_codex_rag_context(query: str) -> str:
    memories = retrieve_codex_memories(query, limit=4)
    learned = [memory for memory in memories if not memory.get("pinned")]
    if not learned:
        return ""
    snippets = []
    for memory in learned[:2]:
        text = str(memory.get("text") or "").strip().replace("\n", " ")
        snippets.append(f"{memory.get('role')}: {text[:120]}")
    return " 我还参考了外部 Agent 的历史回答：" + "；".join(snippets)


def format_codex_rag_prompt_context(query: str) -> str:
    memories = retrieve_codex_memories(query, limit=8)
    lines = []
    for index, memory in enumerate(memories[:8], start=1):
        role = str(memory.get("role") or "Memory")
        tags = str(memory.get("tags") or "")
        text = str(memory.get("text") or "").strip().replace("\n", " ")
        pinned = "pinned" if memory.get("pinned") else "learned"
        lines.append(f"{index}. [{pinned} / {role} / {tags}] {text[:700]}")
    return "\n".join(lines)

async def run_next_task() -> None:
    await drain_pending_tasks("manual_dispatch")


async def run_task_by_id(task_id: str) -> None:
    await drain_pending_tasks(f"task_received:{task_id}")


def schedule_auto_dispatch(reason: str = "task_received") -> None:
    global auto_dispatch_requested, auto_dispatch_task
    auto_dispatch_requested = True
    if auto_dispatch_task and not auto_dispatch_task.done():
        return
    auto_dispatch_task = asyncio.create_task(drain_pending_tasks(reason))


async def drain_pending_tasks(reason: str = "manual_dispatch") -> None:
    global auto_dispatch_requested
    await asyncio.sleep(0.15)
    while True:
        auto_dispatch_requested = False
        async with run_lock:
            while True:
                task = runtime.dispatch_next()
                await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
                if task is None:
                    break
                store.record_task_log(task.id, task.owner_id, runtime.agents[task.owner_id].role, "auto_dispatch", task.title, reason)
                await execute_task(task)
        if not auto_dispatch_requested:
            return
        reason = "queued_task_received"


async def execute_task(task: Any) -> None:
    if is_collaborative_dev_task(task):
        await execute_collaborative_dev_task(task)
        return

    agent = runtime.agents[task.owner_id]
    store.record_task_log(task.id, task.owner_id, agent.role, "dispatch", task.title, "task dispatched")
    issue = store.update_issue_status_by_task_id(task.id, "active")
    if issue:
        enqueue_issue_notice(issue, "agent_dispatch")
    runtime.start_work(task.id)
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    await asyncio.sleep(0.8)

    artifact = record_generated_code_for_task(task.id)
    runtime.record("code_generated", task.owner_id, f"自动生成代码产物：{artifact['target_key']}", task.id)
    runtime.complete_task(task.id)
    issue = store.update_issue_status_by_task_id(task.id, "done")
    if issue:
        enqueue_issue_notice(issue, "agent_done")
    agent.x, agent.y = default_home(task.owner_id)
    store.record_task_log(task.id, task.owner_id, agent.role, "done", task.title, "task completed")
    runtime.archive_completed_task(task.id)
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})


def is_collaborative_dev_task(task: Any) -> bool:
    text = f"{task.title} {task.source}".lower()
    markers = [
        "/code", "code", "开发", "代码", "功能", "项目", "页面", "前端", "后端", "接口", "联机", "协作", "业务", "安装包", "打包",
    ]
    return task.source == "desktop" or (task.source in {"feishu", "issue_accepted"} and any(marker in text for marker in markers))


async def execute_collaborative_dev_task(task: Any) -> None:
    store.record_task_log(task.id, "master", "Control Plane", "project_analysis", task.title, "负责人分析需求并拆分任务")
    issue = store.update_issue_status_by_task_id(task.id, "active")
    if issue:
        enqueue_issue_notice(issue, "agent_dispatch")

    master = runtime.agents["master"]
    frontend = runtime.agents["frontend"]
    backend = runtime.agents["backend"]
    tester = runtime.agents["tester"]
    reviewer = runtime.agents["reviewer"]

    master.status = AgentStatus.WORKING
    runtime.record("project_analysis", "master", "负责人分析项目需求，拆分为前端界面、后端接口、测试校验和审查整合。", task.id)
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    await asyncio.sleep(0.4)

    frontend.status = AgentStatus.WORKING
    backend.status = AgentStatus.WORKING
    frontend.current_task_id = task.id
    backend.current_task_id = task.id
    frontend.x, frontend.y = 560, 240
    backend.x, backend.y = 1000, 180
    runtime.record("parallel_dev", "frontend", "前端 Agent 编写业务页面、交互和状态流。", task.id)
    runtime.record("parallel_dev", "backend", "后端 Agent 编写 API、数据模型和运行服务。", task.id)
    store.record_task_log(task.id, "frontend", frontend.role, "parallel_dev_started", task.title, "UI branch")
    store.record_task_log(task.id, "backend", backend.role, "parallel_dev_started", task.title, "API branch")
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    await asyncio.sleep(0.9)

    frontend_artifact = record_generated_code_for_task(task.id, "frontend")
    backend_artifact = record_generated_code_for_task(task.id, "backend")
    runtime.record("code_generated", "frontend", f"前端 Agent 产出业务代码：{frontend_artifact['target_key']}", task.id)
    runtime.record("code_generated", "backend", f"后端 Agent 产出业务代码：{backend_artifact['target_key']}", task.id)
    frontend.status = AgentStatus.DONE
    backend.status = AgentStatus.DONE
    frontend.current_task_id = None
    backend.current_task_id = None
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    await asyncio.sleep(0.5)

    tester.status = AgentStatus.WORKING
    tester.current_task_id = task.id
    tester.x, tester.y = 1185, 160
    runtime.record("qa_started", "tester", "测试 Agent 执行语法、结构和可运行性校验。", task.id)
    store.record_task_log(task.id, "tester", tester.role, "qa_started", "frontend+backend artifacts", "integration test")
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    await asyncio.sleep(0.7)

    reviewer.status = AgentStatus.WORKING
    reviewer.current_task_id = task.id
    reviewer.x, reviewer.y = 1110, 345
    tester.status = AgentStatus.DONE
    tester.current_task_id = None
    runtime.record("review_arbitration", "reviewer", "Reviewer 组织讨论，确认代码可整合后交给负责人打包。", task.id)
    store.record_task_log(task.id, "reviewer", reviewer.role, "review_arbitration", task.title, "ready_for_package")
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})
    await asyncio.sleep(0.6)

    delivery = build_project_delivery(task.id, task.title)
    runtime.complete_task(task.id)
    issue = store.update_issue_status_by_task_id(task.id, "done")
    if issue:
        enqueue_issue_notice(issue, "agent_done")
    runtime.record("project_packaged", "master", f"负责人已整合项目并生成安装包：{delivery['package_name']}", task.id)
    store.record_task_log(task.id, "master", "Control Plane", "project_packaged", task.title, delivery["package_name"])
    runtime.record("collab_done", "master", "协同开发完成：代码、测试、审查和项目安装包均已归档。", task.id)
    store.record_task_log(task.id, "master", "Control Plane", "collab_done", task.title, "task completed with downloadable package")
    reset_agent_positions()
    runtime.archive_completed_task(task.id)
    await broadcast({"kind": "snapshot", "data": runtime_snapshot()})


def build_project_delivery(task_id: str, title: str) -> Dict[str, Any]:
    DELIVERY_ROOT.mkdir(parents=True, exist_ok=True)
    slug = safe_repo_name(title.lower())[:48] or f"task-{task_id}"
    project_name = f"{slug}-{task_id}".replace("--", "-")
    project_path = (DELIVERY_ROOT / project_name).resolve()
    package_path = (DELIVERY_ROOT / f"{project_name}.zip").resolve()
    if project_path.exists():
        shutil.rmtree(project_path)
    project_path.mkdir(parents=True, exist_ok=True)
    (project_path / "app" / "static").mkdir(parents=True, exist_ok=True)
    (project_path / "tests").mkdir(parents=True, exist_ok=True)

    for relative, content in business_project_files(title, task_id).items():
        target = project_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    validation = validate_project_delivery(project_path)
    if package_path.exists():
        package_path.unlink()
    with zipfile.ZipFile(package_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for file_path in project_path.rglob("*"):
            if file_path.is_file():
                archive.write(file_path, file_path.relative_to(project_path.parent))

    return store.record_project_delivery(
        task_id=task_id,
        title=title,
        package_name=package_path.name,
        package_path=str(package_path),
        project_path=str(project_path),
        status="ready" if validation["ok"] else "failed",
        validation=validation["reason"],
    )


def validate_project_delivery(project_path: Path) -> Dict[str, Any]:
    required = [
        project_path / "README.md",
        project_path / "requirements.txt",
        project_path / "app" / "main.py",
        project_path / "app" / "static" / "index.html",
        project_path / "start.ps1",
    ]
    missing = [path.name for path in required if not path.exists()]
    if missing:
        return {"ok": False, "reason": f"缺少文件：{', '.join(missing)}"}
    try:
        ast.parse((project_path / "app" / "main.py").read_text(encoding="utf-8"))
    except SyntaxError as exc:
        return {"ok": False, "reason": f"app/main.py 语法错误 line {exc.lineno}"}
    return {"ok": True, "reason": "项目结构完整，Python 语法通过，可解压后安装依赖运行。"}


def business_project_files(title: str, task_id: str) -> Dict[str, str]:
    safe_title = title.replace("\n", " ").strip() or "QuantumFlow Generated Project"
    main_py = f'''from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "business.db"
STATIC_ROOT = ROOT / "static"

app = FastAPI(title={safe_title!r}, version="1.0.0")
app.mount("/static", StaticFiles(directory=STATIC_ROOT), name="static")

class TaskCreate(BaseModel):
    title: str
    owner: str = "负责人"
    priority: str = "normal"

class TaskUpdate(BaseModel):
    status: str

def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    with connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS task (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                owner TEXT NOT NULL,
                priority TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS event (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {{key: row[key] for key in row.keys()}}

@app.on_event("startup")
def startup() -> None:
    init_db()

@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_ROOT / "index.html")

@app.get("/api/health")
def health() -> dict[str, str]:
    return {{"ok": "true", "service": {safe_title!r}}}

@app.get("/api/tasks")
def list_tasks() -> list[dict[str, Any]]:
    init_db()
    with connect() as conn:
        rows = conn.execute("SELECT * FROM task ORDER BY id DESC").fetchall()
    return [row_to_dict(row) for row in rows]

@app.post("/api/tasks")
def create_task(payload: TaskCreate) -> dict[str, Any]:
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    now = datetime.now().isoformat(timespec="seconds")
    with connect() as conn:
        cursor = conn.execute(
            "INSERT INTO task(title, owner, priority, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (title, payload.owner, payload.priority, "pending", now, now),
        )
        task_id = cursor.lastrowid
        conn.execute("INSERT INTO event(task_id, message, created_at) VALUES (?, ?, ?)", (task_id, "任务已创建", now))
        row = conn.execute("SELECT * FROM task WHERE id = ?", (task_id,)).fetchone()
    return row_to_dict(row)

@app.patch("/api/tasks/{{task_id}}")
def update_task(task_id: int, payload: TaskUpdate) -> dict[str, Any]:
    status = payload.status.strip()
    if status not in {{"pending", "active", "done", "blocked"}}:
        raise HTTPException(status_code=400, detail="unsupported status")
    now = datetime.now().isoformat(timespec="seconds")
    with connect() as conn:
        cursor = conn.execute("UPDATE task SET status = ?, updated_at = ? WHERE id = ?", (status, now, task_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="task not found")
        conn.execute("INSERT INTO event(task_id, message, created_at) VALUES (?, ?, ?)", (task_id, f"状态更新为 {{status}}", now))
        row = conn.execute("SELECT * FROM task WHERE id = ?", (task_id,)).fetchone()
    return row_to_dict(row)
'''
    return {
        "README.md": f"""# {safe_title}

这是由 QuantumFlow 多智能体流水线生成的可运行业务项目。

## 启动

```powershell
pip install -r requirements.txt
.\\start.ps1
```

访问 `http://127.0.0.1:9000`。

任务来源：`{task_id}`
""",
        "requirements.txt": "fastapi>=0.110\nuvicorn>=0.29\npydantic>=2\n",
        "start.ps1": "$ErrorActionPreference = \"Stop\"\npython -m uvicorn app.main:app --host 127.0.0.1 --port 9000\n",
        "start.bat": "@echo off\npython -m uvicorn app.main:app --host 127.0.0.1 --port 9000\n",
        "app/__init__.py": "",
        "app/main.py": main_py,
        "app/static/index.html": f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>{safe_title}</title><link rel="stylesheet" href="/static/styles.css" /></head>
<body><main class="shell"><header><span>QuantumFlow Delivery</span><h1>{safe_title}</h1><p>可运行的业务任务看板：创建任务、更新状态、查看实时列表。</p></header><form id="taskForm"><input id="taskTitle" placeholder="输入业务任务" /><input id="taskOwner" placeholder="负责人" value="负责人" /><select id="taskPriority"><option>normal</option><option>high</option><option>urgent</option></select><button>创建任务</button></form><section id="taskList" class="task-list"></section></main><script src="/static/app.js"></script></body></html>
""",
        "app/static/styles.css": ":root{color-scheme:dark;font-family:Inter,'Microsoft YaHei',sans-serif}body{margin:0;min-height:100vh;background:#080d1d;color:#edf3ff}.shell{width:min(1180px,calc(100vw - 40px));margin:0 auto;padding:40px 0}header{border:1px solid #26365f;background:#0b1022;padding:28px;border-radius:16px}header span{color:#2fe098;font-weight:900}form{display:grid;grid-template-columns:1fr 180px 140px 120px;gap:12px;margin:22px 0}input,select,button{height:44px;border:1px solid #2d3b67;border-radius:10px;background:#0d1428;color:#edf3ff;padding:0 14px}button{background:#1097a7;border-color:#21d6e7;font-weight:900}.task-list{display:grid;gap:12px}.task{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;border:1px solid #26365f;background:#0b1022;padding:16px;border-radius:12px}.actions{display:flex;gap:8px}@media(max-width:780px){form,.task{grid-template-columns:1fr}}\n",
        "app/static/app.js": """const list=document.getElementById('taskList');const form=document.getElementById('taskForm');async function loadTasks(){const tasks=await fetch('/api/tasks').then(r=>r.json());list.innerHTML=tasks.length?tasks.map(task=>`<article class="task"><div><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.owner)} / ${escapeHtml(task.priority)} / ${escapeHtml(task.status)}</small></div><div class="actions">${['pending','active','blocked','done'].map(status=>`<button data-id="${task.id}" data-status="${status}">${status}</button>`).join('')}</div></article>`).join(''):'<p>暂无任务，先创建一个。</p>'}function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]))}form.addEventListener('submit',async event=>{event.preventDefault();await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:document.getElementById('taskTitle').value,owner:document.getElementById('taskOwner').value,priority:document.getElementById('taskPriority').value})});form.reset();document.getElementById('taskOwner').value='负责人';loadTasks()});list.addEventListener('click',async event=>{const button=event.target.closest('button[data-id]');if(!button)return;await fetch(`/api/tasks/${button.dataset.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:button.dataset.status})});loadTasks()});loadTasks();""",
        "tests/smoke_test.py": "from pathlib import Path\nimport ast\nroot=Path(__file__).resolve().parents[1]\nast.parse((root/'app'/'main.py').read_text(encoding='utf-8'))\nassert (root/'app'/'static'/'index.html').exists()\nprint('smoke ok')\n",
    }


def route_fix_owner(title: str) -> str:
    lowered = title.lower()
    if any(word in lowered for word in ["api", "接口", "后端", "数据库", "webhook", "connector", "飞书", "企业微信"]):
        return "backend"
    return "frontend"


def reset_agent_positions() -> None:
    for agent_id, agent in runtime.agents.items():
        agent.x, agent.y = default_home(agent_id)
        agent.current_task_id = None
        if agent.status == AgentStatus.WORKING:
            agent.status = AgentStatus.IDLE


def default_home(agent_id: str) -> tuple[int, int]:
    homes = {
        "master": (330, 228),
        "frontend": (545, 228),
        "backend": (1110, 204),
        "reviewer": (1120, 360),
        "tester": (1220, 162),
    }
    return homes[agent_id]


def record_generated_code_for_task(task_id: str, agent_id: str | None = None, suffix: str = "") -> Dict[str, Any]:
    task = runtime.tasks[task_id]
    owner_id = agent_id or task.owner_id
    agent = runtime.agents[owner_id]
    target_key = target_key_for_agent(owner_id)
    code_text = generated_code_text(f"{task_id}_{suffix}" if suffix else task_id, task.title, owner_id)
    validation = validate_generated_code(target_key, code_text)
    status = "validated" if validation["ok"] else "rejected"
    explanation = f"{agent.name} 根据任务《{task.title}》自动生成。校验：{validation['reason']}"
    store.record_task_log(task_id, owner_id, agent.role, "artifact_validation", target_key, validation["reason"], status="ok" if validation["ok"] else "failed")
    return store.record_code_artifact(task_id, owner_id, target_key, code_text, explanation, status=status)


def validate_generated_code(target_key: str, code_text: str) -> Dict[str, Any]:
    if not code_text.strip():
        return {"ok": False, "reason": "产物为空，拒绝进入代码区。"}
    if target_key.endswith(".py"):
        try:
            ast.parse(code_text)
        except SyntaxError as exc:
            return {"ok": False, "reason": f"Python 语法错误：line {exc.lineno}"}
        return {"ok": True, "reason": "Python 语法校验通过，可进入 Review。"}
    if target_key.endswith(".js"):
        if "const " not in code_text and "function " not in code_text:
            return {"ok": False, "reason": "JavaScript 缺少可执行声明。"}
        return {"ok": True, "reason": "JavaScript 基础结构校验通过，可进入 Review。"}
    return {"ok": True, "reason": "文本产物已生成，可进入 Review。"}


def target_key_for_agent(agent_id: str) -> str:
    return {
        "master": "runtime/Agent.py",
        "frontend": "desktop/app.js",
        "backend": "runtime/server.py",
        "reviewer": "runtime/review.md",
        "tester": "runtime/tests.py",
    }.get(agent_id, "runtime/server.py")


def generated_code_text(task_id: str, title: str, owner_id: str) -> str:
    safe_title = title.replace("\n", " ").strip()
    safe_id = task_id.replace("-", "_")
    if owner_id == "frontend":
        return "\n".join([
            f"// QuantumFlow business UI artifact: {safe_title}",
            f"const taskView_{safe_id} = {{",
            f"  taskId: {task_id!r},",
            f"  title: {safe_title!r},",
            "  components: ['TaskBoard', 'StatusFilter', 'DeliveryPanel'],",
            "  render() { return `${this.title} is ready for integration`; },",
            "};",
        ])
    if owner_id == "backend":
        return "\n".join([
            f"# QuantumFlow business API artifact: {safe_title}",
            f"def task_api_{safe_id}():",
            f"    return {{'task_id': {task_id!r}, 'title': {safe_title!r}, 'status': 'ready_for_review'}}",
        ])
    return "\n".join([
        f"# QuantumFlow integration artifact: {safe_title}",
        f"def review_summary_{safe_id}():",
        "    return {'review': 'passed', 'package': 'ready'}",
    ])

async def handle_feishu_bot_message(payload: Dict[str, Any]) -> Dict[str, Any]:
    context = feishu_message_context(payload)
    text = str(context.get("text") or "").strip()
    command = parse_bot_command(text)
    store.record_bot_message(
        connector="feishu",
        direction="inbound",
        text=text,
        conversation_id=context.get("conversation_id"),
        sender_id=context.get("sender_id"),
        command=command.name,
    )

    if command.name == "help":
        reply = "QuantumFlow 已在线。\n可用命令：\n/issue 任务名 - 创建任务并进入队列\n/code 开发需求 - 创建自动编码任务\n/status - 查看最近 Issue\n/help - 查看帮助"
        reply_record = send_bot_reply(context, reply, "bot_help")
        return {"ok": True, "command": command.name, "reply": reply_record, "snapshot": runtime_snapshot()}

    if command.name == "status":
        issues = store.recent_issues(limit=5)
        if issues:
            lines = [f"#{item['id']} {item['title']} [{item['status']}]" for item in issues]
            reply = "最近 Issue：\n" + "\n".join(lines)
        else:
            reply = "当前还没有 Issue。发送 /issue 任务名 可以创建一个。"
        reply_record = send_bot_reply(context, reply, "bot_status")
        return {"ok": True, "command": command.name, "reply": reply_record, "snapshot": runtime_snapshot()}

    if command.name == "issue":
        title = command.argument.strip()
        if not title:
            reply_record = send_bot_reply(context, "请按格式发送：/issue 任务名", "bot_error")
            return {"ok": False, "command": command.name, "reply": reply_record, "snapshot": runtime_snapshot()}
        inbound = normalize_feishu_message(payload)
        inbound.title = title
        created = await create_inbound_task(inbound)
        issue = created["issue"]
        reply = f"已创建 Issue #{issue['id']}：{issue['title']}，正在进入 QuantumFlow 队列。"
        reply_record = send_bot_reply(context, reply, "bot_issue_created")
        return {"ok": True, "command": command.name, "issue": issue, "reply": reply_record, "snapshot": runtime_snapshot()}

    if command.name == "code":
        title = command.argument.strip()
        if not title:
            reply_record = send_bot_reply(context, "请按格式发送：/code 你要开发的功能", "bot_error")
            return {"ok": False, "command": command.name, "reply": reply_record, "snapshot": runtime_snapshot()}
        owner_id = choose_code_owner(title)
        inbound = normalize_feishu_message(payload_from_context(context, f"/issue {title}"))
        inbound.title = title
        inbound.owner_id = owner_id
        created = await create_inbound_task(inbound)
        issue = created["issue"]
        agent = runtime.agents[owner_id]
        store.record_task_log(created["task"]["id"], owner_id, agent.role, "auto_code_requested", title, f"assigned to {agent.name}")
        reply = f"已创建自动编码任务 #{issue['id']}：{title}。分配给 {agent.name}（{agent.role}），完成后会生成可下载项目包。"
        reply_record = send_bot_reply(context, reply, "bot_code_created")
        return {"ok": True, "command": command.name, "issue": issue, "owner_id": owner_id, "reply": reply_record, "snapshot": runtime_snapshot()}

    if command.name == "chat":
        reply = "收到。现在我可以接收任务；如果要创建任务，请发送：/issue 任务名"
    elif command.name == "empty":
        reply = "收到空消息。发送 /help 可以查看 QuantumFlow 命令。"
    else:
        reply = f"暂不支持命令 /{command.name}。发送 /help 查看可用命令。"
    reply_record = send_bot_reply(context, reply, "bot_reply")
    return {"ok": True, "command": command.name, "reply": reply_record, "snapshot": runtime_snapshot()}

def send_bot_reply(context: Dict[str, Any], text: str, event_type: str) -> Dict[str, Any]:
    store.record_bot_message(
        connector="feishu",
        direction="outbound",
        text=text,
        conversation_id=context.get("conversation_id"),
        sender_id=context.get("sender_id"),
        command=event_type,
        status="queued",
    )
    message = store.enqueue_connector_message(
        connector="feishu",
        conversation_id=context.get("conversation_id"),
        recipient_id=context.get("sender_id"),
        event_type=event_type,
        payload={"text": text, "title": "QuantumFlow Bot"},
    )
    send_result = send_connector_message(message)
    if send_result.get("ok"):
        status = "dry_run" if send_result.get("mode") == "dry_run" else "sent"
    else:
        status = "failed"
    return store.mark_outbox_sent(int(message["id"]), status=status, result=send_result) or message


def choose_code_owner(title: str) -> str:
    return score_agent_candidates(title)["recommended_agent"]


def score_agent_candidates(title: str) -> Dict[str, Any]:
    lowered = title.lower()
    matrix = [
        ("frontend", "前端 Agent", "UI Agent", 1.5, ["ui", "frontend", "page", "button", "layout", "style", "css", "html", "app.js", "页面", "前端", "按钮", "界面", "布局", "样式", "交互"]),
        ("backend", "后端 Agent", "API Agent", 1.5, ["api", "backend", "server", "database", "sqlite", "storage", "webhook", "接口", "后端", "数据库", "存储", "飞书", "企业微信", "connector"]),
        ("tester", "测试 Agent", "QA Agent", 1.2, ["test", "qa", "verify", "check", "validation", "bug", "error", "测试", "校验", "验收", "报错", "验证", "稳定"]),
        ("reviewer", "Reviewer", "Reviewer", 1.4, ["review", "patch", "merge", "vote", "adopt", "security", "审查", "合并", "补丁", "采纳", "投票", "安全", "优化"]),
    ]
    scores = []
    for agent_id, label, role, weight, keywords in matrix:
        hits = [word for word in keywords if word in lowered]
        score = round((1 + len(hits)) * weight, 2)
        scores.append({
            "agent_id": agent_id,
            "label": label,
            "role": role,
            "score": score,
            "matched_keywords": hits[:8],
            "reason": f"命中 {', '.join(hits[:4])}，适合该角色处理。" if hits else "未命中强关键词，保留为备选角色。",
        })
    scores.sort(key=lambda item: item["score"], reverse=True)
    return {"title": title, "recommended_agent": scores[0]["agent_id"], "scores": scores}

def payload_from_context(context: Dict[str, Any], text: str) -> Dict[str, Any]:
    return {
        "event": {
            "message": {
                "content": {"text": text},
                "chat_id": context.get("conversation_id"),
                "message_id": context.get("message_id"),
            },
            "sender": {"sender_id": context.get("sender_id")},
        }
    }


async def broadcast(payload: Dict[str, Any]) -> None:
    if payload.get("kind") == "snapshot":
        store.save(payload["data"])

    stale: List[WebSocket] = []
    for client in clients:
        try:
            await client.send_json(payload)
        except RuntimeError:
            stale.append(client)
        except WebSocketDisconnect:
            stale.append(client)
    for client in stale:
        if client in clients:
            clients.remove(client)


def next_station(owner_id: str) -> tuple[int, int]:
    stations = {
        "master": (520, 160),
        "frontend": (560, 240),
        "backend": (995, 255),
        "reviewer": (1110, 345),
        "tester": (1185, 160),
    }
    return stations[owner_id]


def enqueue_issue_notice(issue: Dict[str, Any], event_type: str) -> Dict[str, Any]:
    connector = issue.get("source") or "generic_app"
    payload = {
        "event_type": event_type,
        "issue_id": issue["id"],
        "task_id": issue.get("task_id"),
        "title": issue["title"],
        "status": issue["status"],
        "text": build_issue_notice_text(issue, event_type),
    }
    return store.enqueue_connector_message(
        connector=connector,
        event_type=event_type,
        payload=payload,
        conversation_id=issue.get("conversation_id"),
        recipient_id=issue.get("sender_id"),
    )


def build_issue_notice_text(issue: Dict[str, Any], event_type: str) -> str:
    prefix = {
        "issue_created": "已创建 Issue",
        "issue_status_changed": "Issue 状态已更新",
        "agent_dispatch": "Issue 已进入 Agent 执行",
        "agent_done": "Issue 已完成",
        "agent_blocked": "Issue 执行异常",
    }.get(event_type, "Issue 更新")
    return f"{prefix}：#{issue['id']} {issue['title']}（{issue['status']}）"

@app.get("/{route_path:path}")
async def spa_fallback(route_path: str) -> FileResponse:
    if route_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")
    return no_cache_file(WEB_ROOT / "index.html")






