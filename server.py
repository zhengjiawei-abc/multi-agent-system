from __future__ import annotations

import ast
import asyncio
import hashlib
import hmac
import re
import secrets
import socket
import sqlite3
import subprocess
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
PUBLIC_TUNNEL_INFO = ROOT / "public_tunnel.json"

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
SYSTEM_ASSISTANTS: List[Dict[str, Any]] = [
    {
        "id": "codex-assistant",
        "name": "Codex",
        "role": "AI Assistant",
        "kind": "assistant",
        "source": "QuantumFlow / Codex",
        "color": "#2fe098",
        "status": "online",
    }
]
CODEX_KNOWLEDGE_PROFILE: Dict[str, str] = {
    "identity": "QuantumFlow 是基于多智能体协同的人机共存生产力调度系统，目标是把人类高阶创意和 AI 低成本逻辑执行结合起来，形成可视化、可审计、可自愈的生产力网络。",
    "llm": "LLM 本质是基于 Token 的概率生成系统，依赖 Context Window、Transformer 和 Self-Attention。System Prompt 定义行为边界，Skill 定义复杂任务 SOP，RAG 用召回和重排把外部知识注入上下文，而不是改模型权重。",
    "architecture": "QuantumFlow 采用 Master-Slave 多智能体集群。Control Plane 由 Claude Code/Master 负责全局拆解、仲裁、分发和验收；Infrastructure 使用 K8s/KubeEdge 管理 Agent 生命周期，Pulsar 做异步消息中枢，Redis + Vector DB + Graph DB 分别承担瞬时状态、语义经验和长链路依赖；Execution Layer 由 Codex、Gemini、OpenCode 等 Slave Node 在隔离沙箱中并行执行。",
    "codex": "Codex 在设计文档里承担后端、API、数据库事务、代码生成和沙箱执行侧的重要角色；在 API 与数据库事务任务中拥有 1.5x 权重。它应先澄清目标、入口文件、约束和验收标准，再给出可执行补丁或派发给合适 Agent。",
    "workflow": "全链路交付遵循四步：1. Redis 物理环境锚定，统一状态真理源；2. Manager 将子任务推入 Pulsar 队列异步分发；3. OpenCode 写入前访问共享状态机，避免写写覆盖；4. 沙箱执行 npm test/jest 等审计，按 Checked Gap 和 Unchecked Gap 梯度纠偏，直至误差归零并 Git 交付。",
    "quality": "质量保障把问题抽象为 Gap：Checked Gap 包括编译失败、语法报错和 StackTrace；Unchecked Gap 包括路由未挂载、前后端状态不同步、菜单权限缺失等业务断层。QuantumFlow 通过动态插桩、路由纠错和二次修复完成自愈。",
    "api": "核心调用规范强调指令集、投票与仲裁：Codex 在 API/DB 上 1.5x，Gemini 在 UI 交互上 1.5x，OpenCode 在物理兼容性上 1.2x；平局时引入 Human-in-the-loop，Master 对重大安全问题拥有一票否决权。",
    "vision": "长期愿景是成为类似 GitHub 的可视化开源代码管理与协作社区，让全球开发者和协同 Agent 在线交流创意、发布项目、可视化任务流、CoT 逻辑链和吞吐状态。",
}

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
    schedule_auto_dispatch("startup")


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


@app.get("/api/snapshot")
async def snapshot() -> Dict[str, Any]:
    return runtime.snapshot()


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
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
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
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
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


@app.get("/api/network/lan")
async def network_lan() -> Dict[str, Any]:
    ips = lan_ip_candidates()
    return {
        "host": ips[0] if ips else "127.0.0.1",
        "port": 8765,
        "urls": [f"http://{ip}:8765" for ip in ips],
        "note": "同一局域网内的朋友可以用这些地址访问；如果访问不了，检查防火墙和网络是否互通。",
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
        "local_ws": f"ws://{local_host}:{port}/ws",
        "lan_ws": f"ws://{lan_host}:{port}/ws",
        "public_tunnel": current_public_tunnel(),
        "relay_env": "QUANTUMFLOW_RELAY_URL",
        "channels": ["admin_chat", "public_chat", "project_room_message", "online"],
    }


@app.get("/api/admin/members")
async def admin_members() -> List[Dict[str, Any]]:
    return store.list_admin_members()


@app.post("/api/admin/members")
async def add_admin_member(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Member name is required.")
    role = str(payload.get("role") or "Developer").strip() or "Developer"
    project_scope = str(payload.get("project_scope") or "QuantumFlow Core").strip()[:120] or "QuantumFlow Core"
    permissions = payload.get("permissions") if isinstance(payload.get("permissions"), dict) else default_member_permissions(role)
    invite_code = str(payload.get("invite_code") or "").strip()[:40]
    member = store.add_admin_member(name=name[:80], role=role[:80], project_scope=project_scope, permissions=permissions, invite_code=invite_code)
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
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
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
    text = str(payload.get("text") or "QuantumFlow 飞书连接测试：如果你看到这条消息，说明机器人已收到。")
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
        payload={"text": text, "title": "QuantumFlow 手动消息"},
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
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
    schedule_auto_dispatch("desktop_task_created")
    return runtime.snapshot()


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
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
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
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
    return result


@app.get("/api/patch/history")
async def patch_history(limit: int = 20) -> List[Dict[str, Any]]:
    return read_history(limit=max(1, min(limit, 100)))


@app.post("/api/integrations/inbound")
async def integration_inbound(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    inbound = normalize_generic_task(payload)
    await create_inbound_task(inbound)
    return runtime.snapshot()


@app.get("/api/integrations/wecom/callback")
async def wecom_verify(echostr: str = "") -> Dict[str, str]:
    return {"echostr": echostr}


@app.post("/api/integrations/wecom/callback")
async def wecom_callback(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    inbound = normalize_wecom_message(payload)
    await create_inbound_task(inbound)
    return runtime.snapshot()


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
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
    return runtime.snapshot()


@app.post("/api/dispatch-next")
async def dispatch_next() -> Dict[str, Any]:
    await run_next_task()
    return runtime.snapshot()


def online_collaborators() -> List[Dict[str, Any]]:
    seen: set[str] = set()
    peers: List[Dict[str, Any]] = []
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
            }
        )
    return peers


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
    await websocket.send_json({"kind": "snapshot", "data": runtime.snapshot()})
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
                await websocket.send_json({"kind": "snapshot", "data": runtime.snapshot()})
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
                    comment = store.record_collaboration_comment(
                        author=str(peer.get("name") or message.get("name") or "Guest")[:60],
                        text=text[:2000],
                        kind=kind,
                        target_key=str(message.get("target_key") or ("开发者群聊" if kind == "admin_chat" else "开源世界"))[:160],
                        votes=1,
                    )
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
    if kind != "admin_chat":
        return None
    normalized = text.strip().lower()
    if not normalized:
        return None
    triggers = ("codex", "@codex", "智能助手")
    if not any(trigger in normalized for trigger in triggers):
        return None
    cleaned = re.sub(r"@?codex", "", text, flags=re.IGNORECASE).strip()
    cleaned = cleaned or text.strip()
    if any(word in normalized for word in ("你好", "hello", "hi", "在吗")):
        return f"我在，并已按系统设计文档加载 QuantumFlow 知识库。{CODEX_KNOWLEDGE_PROFILE['identity']}"
    if any(word in normalized for word in ("状态", "status", "在线")):
        return f"我在线，当前通道里有 {len(online_collaborators())} 个开发者与智能体。"
    return codex_knowledge_reply(cleaned)


def codex_knowledge_reply(text: str) -> str:
    normalized = text.lower()
    topic_matrix = [
        (("架构", "系统", "分层", "control", "plane", "master", "slave", "pulsar", "redis", "vector", "graph", "k8s"), "architecture"),
        (("codex", "后端", "api", "数据库", "事务", "权重"), "codex"),
        (("rag", "skill", "提示词", "系统提示", "预训练", "训练", "知识库", "context"), "llm"),
        (("自愈", "gap", "测试", "qa", "错误", "修复", "路由", "插桩"), "quality"),
        (("流程", "交付", "步骤", "闭环", "沙箱", "git", "环境"), "workflow"),
        (("投票", "仲裁", "human", "否决", "gemini", "opencode"), "api"),
        (("愿景", "社区", "开源", "github", "未来"), "vision"),
    ]
    for keywords, key in topic_matrix:
        if any(keyword in normalized for keyword in keywords):
            reply = CODEX_KNOWLEDGE_PROFILE[key]
            if key == "llm":
                reply += " 这次执行的是工程化知识注入：把文档蒸馏成助手上下文和回复规则，而不是重新训练模型权重。"
            return reply
    return "收到。按 QuantumFlow 设计文档，我会先把问题拆成目标、上下文、执行 Agent、沙箱验证和验收标准五项；涉及后端/API/数据库时由 Codex 主导，涉及 UI 交互时交给 Gemini/前端 Agent，并由 Master 仲裁。"


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
                await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
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

    store.record_task_log(task.id, task.owner_id, runtime.agents[task.owner_id].role, "dispatch", task.title, "task dispatched")
    issue = store.update_issue_status_by_task_id(task.id, "active")
    if issue:
        enqueue_issue_notice(issue, "agent_dispatch")
    await asyncio.sleep(0.9)
    runtime.start_work(task.id)
    store.record_task_log(task.id, task.owner_id, runtime.agents[task.owner_id].role, "work_started", task.title, "agent started")
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})

    await asyncio.sleep(1.2)
    if task.id == "task-004":
        runtime.block_task(task.id, "检测到状态同步缺口，移交 Reviewer 进行仲裁。")
        issue = store.update_issue_status_by_task_id(task.id, "blocked")
        if issue:
            enqueue_issue_notice(issue, "agent_blocked")
        reviewer = runtime.agents["reviewer"]
        reviewer.status = AgentStatus.WALKING
        reviewer.x = task.station_x + 72
        reviewer.y = task.station_y + 18
        runtime.record("review", "reviewer", "接管阻塞任务，发起局部修复。", task.id)
        store.record_task_log(task.id, "reviewer", "Reviewer", "review_takeover", "blocked task", "local fix started")
        await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
        await asyncio.sleep(1.2)

    runtime.complete_task(task.id)
    issue = store.update_issue_status_by_task_id(task.id, "done")
    if issue:
        enqueue_issue_notice(issue, "agent_done")
    owner = runtime.agents[task.owner_id]
    owner.x, owner.y = default_home(task.owner_id)
    reviewer = runtime.agents["reviewer"]
    reviewer.status = AgentStatus.IDLE
    reviewer.x, reviewer.y = default_home("reviewer")
    artifact = record_generated_code_for_task(task.id)
    runtime.record("code_generated", task.owner_id, f"自动生成代码产物：{artifact['target_key']}", task.id)
    store.record_task_log(task.id, task.owner_id, runtime.agents[task.owner_id].role, "done", task.title, "task completed")
    runtime.archive_completed_task(task.id)
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})


def is_collaborative_dev_task(task: Any) -> bool:
    text = f"{task.title} {task.source}".lower()
    markers = [
        "/code",
        "code",
        "开发",
        "代码",
        "功能",
        "页面",
        "前端",
        "后端",
        "接口",
        "联机",
        "协作",
        "布局",
        "组件",
    ]
    return task.source == "feishu" or any(marker in text for marker in markers)


async def execute_collaborative_dev_task(task: Any) -> None:
    store.record_task_log(task.id, "master", "Control Plane", "collab_dispatch", task.title, "frontend/backend parallel development")
    issue = store.update_issue_status_by_task_id(task.id, "active")
    if issue:
        enqueue_issue_notice(issue, "agent_dispatch")

    master = runtime.agents["master"]
    frontend = runtime.agents["frontend"]
    backend = runtime.agents["backend"]
    tester = runtime.agents["tester"]
    reviewer = runtime.agents["reviewer"]

    master.status = AgentStatus.WORKING
    runtime.record("collab_plan", "master", "Master 拆分任务：前端 A 与后端 A 同步开发，测试 A 负责验收。", task.id)
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
    await asyncio.sleep(0.45)

    frontend.status = AgentStatus.WORKING
    backend.status = AgentStatus.WORKING
    frontend.current_task_id = task.id
    backend.current_task_id = task.id
    frontend.x, frontend.y = 560, 240
    backend.x, backend.y = 1000, 180
    runtime.record("parallel_dev", "frontend", "前端 A 开始写 UI / 交互 / 页面代码。", task.id)
    runtime.record("parallel_dev", "backend", "后端 A 开始写 API / 数据 / Connector 代码。", task.id)
    store.record_task_log(task.id, "frontend", frontend.role, "parallel_dev_started", task.title, "UI/code branch")
    store.record_task_log(task.id, "backend", backend.role, "parallel_dev_started", task.title, "API/code branch")
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
    await asyncio.sleep(1.1)

    frontend_artifact = record_generated_code_for_task(task.id, "frontend")
    backend_artifact = record_generated_code_for_task(task.id, "backend")
    runtime.record("code_generated", "frontend", f"前端 A 产出代码：{frontend_artifact['target_key']}", task.id)
    runtime.record("code_generated", "backend", f"后端 A 产出代码：{backend_artifact['target_key']}", task.id)
    frontend.status = AgentStatus.DONE
    backend.status = AgentStatus.DONE
    frontend.current_task_id = None
    backend.current_task_id = None
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
    await asyncio.sleep(0.55)

    tester.status = AgentStatus.WORKING
    tester.current_task_id = task.id
    tester.x, tester.y = 1185, 160
    runtime.record("qa_started", "tester", "测试 A 对前后端同步结果进行联调验收。", task.id)
    store.record_task_log(task.id, "tester", tester.role, "qa_started", "frontend+backend artifacts", "integration test")
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
    await asyncio.sleep(0.9)

    routed_agent = route_fix_owner(task.title)
    reviewer.status = AgentStatus.WORKING
    reviewer.current_task_id = task.id
    reviewer.x, reviewer.y = 1110, 345
    tester.status = AgentStatus.DONE
    tester.current_task_id = None
    runtime.record("review_arbitration", "reviewer", f"审查 A 判断问题归属：派给 {runtime.agents[routed_agent].name} 做定向修复。", task.id)
    store.record_task_log(task.id, "reviewer", reviewer.role, "review_arbitration", task.title, f"routed_to={routed_agent}")
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
    await asyncio.sleep(0.7)

    fixer = runtime.agents[routed_agent]
    fixer.status = AgentStatus.WORKING
    fixer.current_task_id = task.id
    fixer.x, fixer.y = (560, 240) if routed_agent == "frontend" else (1000, 180)
    fix_artifact = record_generated_code_for_task(task.id, routed_agent, suffix="fix")
    runtime.record("targeted_fix", routed_agent, f"定向修复完成：{fix_artifact['target_key']}", task.id)
    store.record_task_log(task.id, routed_agent, fixer.role, "targeted_fix", task.title, "reviewer routed fix")
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
    await asyncio.sleep(0.55)

    reviewer.status = AgentStatus.DONE
    reviewer.current_task_id = None
    fixer.status = AgentStatus.DONE
    fixer.current_task_id = None
    runtime.complete_task(task.id)
    issue = store.update_issue_status_by_task_id(task.id, "done")
    if issue:
        enqueue_issue_notice(issue, "agent_done")
    runtime.record("collab_done", "master", "协同开发完成：前后端产物、测试结果、审查仲裁和定向修复均已归档。", task.id)
    store.record_task_log(task.id, "master", "Control Plane", "collab_done", task.title, "task completed")
    reset_agent_positions()
    runtime.archive_completed_task(task.id)
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})


def route_fix_owner(title: str) -> str:
    lowered = title.lower()
    backend_words = ["api", "接口", "后端", "数据库", "存储", "webhook", "connector", "飞书", "企业微信"]
    frontend_words = ["ui", "页面", "前端", "样式", "按钮", "界面", "布局", "评论区", "编辑器"]
    if any(word in lowered for word in backend_words):
        return "backend"
    if any(word in lowered for word in frontend_words):
        return "frontend"
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
    explanation = f"{agent.name} 根据任务「{task.title}」自动生成。校验：{validation['reason']}"
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
        pairs = [("{", "}"), ("(", ")"), ("[", "]")]
        for left, right in pairs:
            if code_text.count(left) != code_text.count(right):
                return {"ok": False, "reason": f"JavaScript 结构校验失败：{left}{right} 不匹配"}
        if "const " not in code_text and "function " not in code_text:
            return {"ok": False, "reason": "JavaScript 缺少可执行声明。"}
        return {"ok": True, "reason": "JavaScript 基础结构校验通过，可进入 Review。"}
    return {"ok": True, "reason": "文本产物已生成，可进入 Review。"}


def target_key_for_agent(agent_id: str) -> str:
    return {
        "master": "runtime/Agent.py",
        "frontend": "desktop/app.js",
        "backend": "runtime/server.py",
        "reviewer": "runtime/Agent.py",
        "tester": "runtime/connectors.py",
    }.get(agent_id, "runtime/server.py")


def generated_code_text(task_id: str, title: str, owner_id: str) -> str:
    safe_title = title.replace("\n", " ").strip()
    if owner_id == "frontend":
        return "\n".join(
            [
                f"// QuantumFlow auto-code: {safe_title}",
                f"const autoTask_{task_id.replace('-', '_')} = {{",
                f"  taskId: {task_id!r},",
                f"  intent: {safe_title!r},",
                "  status: 'ready-for-review',",
                "};",
            ]
        )
    if owner_id == "backend":
        return "\n".join(
            [
                f"# QuantumFlow auto-code: {safe_title}",
                f"def auto_task_{task_id.replace('-', '_')}():",
                f"    return {{'task_id': {task_id!r}, 'intent': {safe_title!r}, 'status': 'ready-for-review'}}",
            ]
        )
    if owner_id == "tester":
        return "\n".join(
            [
                f"# QuantumFlow QA auto-check: {safe_title}",
                f"def test_auto_task_{task_id.replace('-', '_')}():",
                "    assert True",
            ]
        )
    return "\n".join(
        [
            f"# QuantumFlow governance note: {safe_title}",
            f"def review_task_{task_id.replace('-', '_')}():",
            f"    return {safe_title!r}",
        ]
    )


async def create_inbound_task(inbound: InboundTask) -> Dict[str, Any]:
    if not inbound.title:
        raise HTTPException(status_code=400, detail="Inbound message content is required.")
    if inbound.owner_id not in runtime.agents:
        raise HTTPException(status_code=400, detail=f"Unknown owner_id: {inbound.owner_id}")

    x, y = next_station(inbound.owner_id)
    task = runtime.add_task(
        inbound.title,
        inbound.owner_id,
        x,
        y,
        source=inbound.source,
        conversation_id=inbound.conversation_id,
        sender_id=inbound.sender_id,
    )
    issue = store.create_issue(
        title=inbound.title,
        source=inbound.source,
        conversation_id=inbound.conversation_id,
        sender_id=inbound.sender_id,
        task_id=task.id,
        external_id=str(inbound.raw.get("message_id") or inbound.raw.get("event_id") or "") or None,
    )
    enqueue_issue_notice(issue, "issue_created")
    store.record_task_log(task.id, inbound.owner_id, runtime.agents[inbound.owner_id].role, "inbound_task_created", inbound.title, inbound.source)
    await broadcast({"kind": "snapshot", "data": runtime.snapshot()})
    schedule_auto_dispatch("inbound_task_created")
    return {"task": task.to_dict(), "issue": issue}


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
        reply = (
            "QuantumFlow 已在线。\n"
            "可用命令：\n"
            "/issue 任务名 - 创建任务并进入战情室\n"
            "/status - 查看最近 Issue\n"
            "/help - 查看帮助"
        )
        reply_record = send_bot_reply(context, reply, "bot_help")
        return {"ok": True, "command": command.name, "reply": reply_record, "snapshot": runtime.snapshot()}

    if command.name == "status":
        issues = store.recent_issues(limit=5)
        if issues:
            lines = [f"#{item['id']} {item['title']} [{item['status']}]" for item in issues]
            reply = "最近 Issue：\n" + "\n".join(lines)
        else:
            reply = "当前还没有 Issue。发送 /issue 任务名 可以创建一个。"
        reply_record = send_bot_reply(context, reply, "bot_status")
        return {"ok": True, "command": command.name, "reply": reply_record, "snapshot": runtime.snapshot()}

    if command.name == "issue":
        title = command.argument.strip()
        if not title:
            reply_record = send_bot_reply(context, "请按格式发送：/issue 任务名", "bot_error")
            return {"ok": False, "command": command.name, "reply": reply_record, "snapshot": runtime.snapshot()}
        inbound = normalize_feishu_message(payload)
        inbound.title = title
        created = await create_inbound_task(inbound)
        issue = created["issue"]
        reply = f"已创建 Issue #{issue['id']}：{issue['title']}，正在进入 QuantumFlow 战情室。"
        reply_record = send_bot_reply(context, reply, "bot_issue_created")
        return {"ok": True, "command": command.name, "issue": issue, "reply": reply_record, "snapshot": runtime.snapshot()}

    if command.name == "code":
        title = command.argument.strip()
        if not title:
            reply_record = send_bot_reply(context, "请按格式发送：/code 你要开发的功能", "bot_error")
            return {"ok": False, "command": command.name, "reply": reply_record, "snapshot": runtime.snapshot()}
        owner_id = choose_code_owner(title)
        inbound = normalize_feishu_message(payload_from_context(context, f"/issue {title}"))
        inbound.title = title
        inbound.owner_id = owner_id
        created = await create_inbound_task(inbound)
        issue = created["issue"]
        agent = runtime.agents[owner_id]
        store.record_task_log(created["task"]["id"], owner_id, agent.role, "auto_code_requested", title, f"assigned to {agent.name}")
        reply = f"已创建自动编码任务 #{issue['id']}：{title}。分配给 {agent.name}（{agent.role}），完成后会进入代码区和 Review。"
        reply_record = send_bot_reply(context, reply, "bot_code_created")
        return {"ok": True, "command": command.name, "issue": issue, "owner_id": owner_id, "reply": reply_record, "snapshot": runtime.snapshot()}

    if command.name == "chat":
        reply = "收到。现在我可以接收任务了；如果要创建任务，请发送：/issue 任务名"
    elif command.name == "empty":
        reply = "收到空消息。发送 /help 可以查看 QuantumFlow 命令。"
    else:
        reply = f"暂不支持命令 /{command.name}。发送 /help 查看可用命令。"
    reply_record = send_bot_reply(context, reply, "bot_reply")
    return {"ok": True, "command": command.name, "reply": reply_record, "snapshot": runtime.snapshot()}


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
    result = score_agent_candidates(title)
    top = next((item for item in result["scores"] if item["agent_id"] == result["recommended_agent"]), None)
    return result["recommended_agent"] if top and top["score"] > 0 else "master"


def score_agent_candidates(title: str) -> Dict[str, Any]:
    lowered = title.lower()
    matrix = [
        (
            "frontend",
            "前端 Agent",
            "UI Agent",
            1.5,
            ["ui", "frontend", "page", "button", "layout", "style", "css", "html", "app.js", "页面", "前端", "按钮", "界面", "布局", "样式", "交互"],
        ),
        (
            "backend",
            "后端 Agent",
            "API Agent",
            1.5,
            ["api", "backend", "server", "database", "sqlite", "storage", "webhook", "接口", "后端", "数据库", "存储", "飞书", "企业微信", "connector"],
        ),
        (
            "tester",
            "测试 Agent",
            "QA Agent",
            1.2,
            ["test", "qa", "verify", "check", "validation", "bug", "error", "测试", "校验", "验收", "报错", "验证", "稳定"],
        ),
        (
            "reviewer",
            "Reviewer",
            "Reviewer",
            1.4,
            ["review", "patch", "merge", "vote", "adopt", "security", "审查", "合并", "补丁", "采纳", "投票", "安全", "优化"],
        ),
    ]
    scores = []
    for agent_id, label, role, weight, keywords in matrix:
        hits = [word for word in keywords if word in lowered]
        score = round((1 + len(hits)) * weight, 2)
        scores.append(
            {
                "agent_id": agent_id,
                "label": label,
                "role": role,
                "score": score,
                "matched_keywords": hits[:8],
                "reason": f"命中 {', '.join(hits[:4])}，适合该角色处理。" if hits else "未命中强关键词，保留为备选角色。",
            }
        )
    scores.sort(key=lambda item: item["score"], reverse=True)
    return {
        "title": title,
        "recommended_agent": scores[0]["agent_id"],
        "scores": scores,
        "control_plane_note": "Master 根据任务语义、角色权重和关键词命中率完成轻量仲裁。",
    }


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

# QuantumFlow accepted review suggestion
# 采纳建议前必须先跑校验，不能让代码区出现明显语法错误。
def quantumflow_review_note():
    return '采纳建议前必须先跑校验，不能让代码区出现明显语法错误。'


@app.get("/{route_path:path}")
async def spa_fallback(route_path: str) -> FileResponse:
    if route_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")
    return no_cache_file(WEB_ROOT / "index.html")
