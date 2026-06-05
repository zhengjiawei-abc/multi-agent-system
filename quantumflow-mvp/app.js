const agents = [
  { id: "master", name: "团队负责人", role: "Master", color: "#ffc44d", x: 330, y: 228, home: [330, 228], status: "idle", crown: true },
  { id: "frontend", name: "前端开发", role: "UI Agent", color: "#7c5cff", x: 545, y: 228, home: [545, 228], status: "idle" },
  { id: "backend", name: "后端开发", role: "API Agent", color: "#22c7d8", x: 1110, y: 204, home: [1110, 204], status: "idle" },
  { id: "reviewer", name: "代码审查者", role: "Reviewer", color: "#ff515f", x: 1120, y: 360, home: [1120, 360], status: "idle" },
  { id: "tester", name: "全栈测试", role: "QA Agent", color: "#2fe098", x: 1220, y: 162, home: [1220, 162], status: "idle" },
];

let tasks = [];

const codeSamples = {
  master: [
    [
      `async def drain_pending_tasks(reason="task_received"):
    async with run_lock:
        task = runtime.dispatch_next()
        if task is None:
            return
        store.record_task_log(task.id, task.owner_id, "dispatch", task.title, reason)
        await execute_task(task)`,
      "Master pulls the next task from the queue, records the execution log, then dispatches it to the matched Agent.",
    ],
    [
      `def score_agent(title, agent):
    role_hit = keyword_score(title, agent.role)
    load_penalty = active_task_count(agent.id) * 0.2
    return role_hit + agent.priority - load_penalty`,
      "Tasks are assigned by role match, priority, and current load instead of random routing.",
    ],
    [
      `await broadcast({
    "kind": "snapshot",
    "data": runtime.snapshot()
})`,
      "After every dispatch, the latest war-room snapshot is broadcast to connected developers.",
    ],
  ],
  frontend: [
    [
      `function renderAgents() {
  els.agentLayer.innerHTML = agents.map(agentMarkup).join("");
  document.querySelectorAll(".agent").forEach((node) => {
    node.addEventListener("click", () => openAgentQuickPanel(agentById(node.dataset.agent)));
  });
}`,
      "The UI Agent renders characters in the war room and opens the code preview when a character is clicked.",
    ],
    [
      `.agent-quick-panel {
  position: absolute;
  left: var(--quick-x);
  top: var(--quick-y);
  grid-template-rows: 62px minmax(0, 1fr) 48px;
}`,
      "The quick panel follows the agent position so users can inspect code without switching to the full editor.",
    ],
    [
      `function switchCodingMode(mode) {
  const manualMode = mode === "manual";
  document.body.classList.toggle("manual-coding-mode", manualMode);
  els.autoCodePanel.classList.toggle("active", !manualMode);
}`,
      "Auto coding and manual coding stay separate while sharing the same QuantumFlow workflow.",
    ],
  ],
  backend: [
    [
      `@app.post("/api/tasks")
async def create_task(payload: Dict[str, Any] = Body(...)):
    task = runtime.add_task(title, owner_id, x, y, source="desktop")
    store.record_task_log(task.id, owner_id, "task_created", title)
    schedule_auto_dispatch("desktop_task_created")
    return runtime.snapshot()`,
      "The API Agent turns external messages or manual input into real tasks and triggers dispatch immediately.",
    ],
    [
      `@app.websocket("/ws")
async def websocket_endpoint(websocket):
    await websocket.accept()
    clients.append(websocket)
    await websocket.send_json({"kind": "snapshot", "data": runtime.snapshot()})`,
      "Online collaboration uses WebSocket snapshots so every developer sees the same war-room state.",
    ],
    [
      `def record_collaboration_comment(author, text, kind, target_key):
    INSERT INTO collaboration_comment(...)
    return {"author": author, "text": text, "kind": kind}`,
      "Code comments and developer chat are persisted so collaboration history survives refreshes.",
    ],
  ],
  reviewer: [
    [
      `def validate_candidate(candidate):
    if candidate.target_key.endswith(".py"):
        ast.parse(candidate.code_text)
    if candidate.target_key.endswith(".js"):
        validate_js_shape(candidate.code_text)
    return "ready"`,
      "The Reviewer validates each patch candidate before it can be written into the repository.",
    ],
    [
      `winner = max(comments, key=lambda item: item["votes"] * item["weight"])
if winner["status"] == "open":
    candidate = build_candidate(winner)
    apply_candidate(candidate)`,
      "Suggestions are adopted by weighted votes and then converted into patch candidates.",
    ],
    [
      `store.record_adoption(
    task_id=task_id,
    reviewer_id="reviewer",
    option_text=winner["text"],
    vote_count=winner["votes"]
)`,
      "Every adoption is recorded for later review: who suggested it, who reviewed it, and why it merged.",
    ],
  ],
  tester: [
    [
      `async def smoke_test():
    assert GET("/api/app-version").status == 200
    assert GET("/admin/chat").status == 200
    assert websocket_recv("/ws").kind == "snapshot"`,
      "The QA Agent runs smoke checks across pages, APIs, and WebSocket connectivity.",
    ],
    [
      `def verify_artifact(artifact):
    result = validate_generated_code(artifact.code_text, artifact.target_key)
    store.record_task_log(artifact.task_id, "tester", "artifact_validation", result.reason)`,
      "Generated code is checked by the QA Agent and the result is written into task logs.",
    ],
    [
      `report = {
    "passed": passed_count,
    "failed": failed_count,
    "latency_ms": round(avg_latency)
}`,
      "QA metrics can later feed the observability dashboard for latency, pass rate, and failures.",
    ],
  ],
};

const openWorldRepos = [
  {
    id: "runtime",
    name: "quantumflow-runtime",
    desc: "Multi-agent task scheduling, connector ingress, and WebSocket state streaming.",
    lang: "Python",
    stars: 128,
    files: {
      "server.py": [
        "app = FastAPI(title='QuantumFlow Runtime')",
        "runtime = default_runtime()",
        "POST /api/integrations/inbound",
        "await broadcast({'kind': 'snapshot'})",
      ],
      "Agent.py": [
        "class QuantumFlowRuntime:",
        "  def dispatch_next(self):",
        "    task.status = TaskStatus.ACTIVE",
        "    self.record('dispatch', agent.id, message)",
      ],
      "connectors.py": [
        "def normalize_feishu_message(payload):",
        "  event = payload.get('event')",
        "  return InboundTask(source='feishu')",
      ],
    },
  },
  {
    id: "desktop",
    name: "quantumflow-desktop",
    desc: "Desktop war room, movable Agents, and visual coding workspace.",
    lang: "HTML/CSS/JS",
    stars: 96,
    files: {
      "index.html": ["<section id='warRoomView'>", "<section id='communityView'>", "<section id='coderStudio'>"],
      "app.js": ["renderAgents()", "openCoderStudio(agent)", "connectBackend()", "renderCommunity()"],
      "styles.css": [".room { min-height: 540px }", ".coder-studio.active { display: grid }"],
    },
  },
  {
    id: "connectors",
    name: "app-connectors",
    desc: "Connectors for Feishu, WeCom, WeChat service, Douyin, and more.",
    lang: "Webhook",
    stars: 74,
    files: {
      "wecom.md": ["Verify URL", "Decrypt message", "Send app message", "Write execution result"],
      "feishu.md": ["challenge 校验", "事件订阅", "消息卡片", "任务反馈"],
      "douyin.md": ["私信/评论入口", "内容审核", "任务归档", "回复队列"],
    },
  },
  {
    id: "project",
    name: "agent-delivery-project",
    desc: "Agent-generated runnable projects. It can become a Vue3 frontend, FastAPI backend, tests, and review output according to the task.",
    lang: "Vue/Python/JS",
    stars: 42,
    files: {
      "README.md": ["# Agent 生成项目", "", "这里会显示负责人整合后的完整系统说明。"],
      "package.json": ["{\"type\":\"module\",\"scripts\":{\"dev\":\"vite --host 127.0.0.1\"}}"],
      "index.html": ["<div id=\"app\"></div>", "<script type=\"module\" src=\"/src/main.js\"></script>"],
      "src/main.js": ["import { createApp } from 'vue'", "import App from './App.vue'", "createApp(App).mount('#app')"],
      "src/App.vue": ["<script setup>", "const books = []", "</script>", "<template>图书管理前端</template>"],
      "src/style.css": [".library-shell { width: min(1180px, 100%); }"],
      "tests/book.spec.js": ["import assert from 'node:assert/strict'", "assert.match(main, /createApp/)"],
      "app/main.py": ["from fastapi import FastAPI", "app = FastAPI()", "GET /api/health", "GET/POST/PATCH /api/tasks"],
      "app/static/app.js": ["const state = { tasks: [] }", "loadTasks()", "render()", "更新任务状态"],
      "tests/test_smoke.py": ["from fastapi.testclient import TestClient", "def test_health_and_task_flow():"],
      "docs/review-checklist.md": ["# Reviewer 审查清单", "- 后端 API", "- 前端交互", "- 烟测覆盖"],
    },
  },
];

const CUSTOM_INTERNAL_REPOS_KEY = "qfCustomInternalRepos";

function loadCustomInternalRepos() {
  try {
    const rows = JSON.parse(localStorage.getItem(CUSTOM_INTERNAL_REPOS_KEY) || "[]");
    if (!Array.isArray(rows)) return;
    rows
      .filter((repo) => repo && repo.id && repo.name && repo.files)
      .reverse()
      .forEach((repo) => {
        if (!openWorldRepos.some((item) => item.id === repo.id)) openWorldRepos.unshift({ ...repo, custom: true });
      });
  } catch {
    // Local repo cache is optional.
  }
}

function saveCustomInternalRepos() {
  const customRepos = openWorldRepos.filter((repo) => repo.custom);
  localStorage.setItem(CUSTOM_INTERNAL_REPOS_KEY, JSON.stringify(customRepos));
}

function normalizeInternalRepo(repo) {
  const files = {};
  Object.entries(repo.files || {}).forEach(([fileName, lines]) => {
    files[fileName] = Array.isArray(lines) ? lines.map((line) => String(line)) : String(lines || "").split("\n");
  });
  return {
    id: String(repo.id || repo.name || `repo-${Date.now().toString(36)}`),
    name: String(repo.name || repo.id || "workspace-repo"),
    desc: String(repo.desc || repo.path || "Workspace repository"),
    lang: String(repo.lang || "Code"),
    stars: Number(repo.stars || 0),
    workspace: Boolean(repo.workspace),
    custom: Boolean(repo.custom),
    path: repo.path || "",
    files,
  };
}

function replaceWorkspaceRepos(repos = []) {
  const workspaceRepos = repos.map(normalizeInternalRepo).filter((repo) => Object.keys(repo.files).length);
  if (!workspaceRepos.length) return;
  const customRepos = openWorldRepos.filter((repo) => repo.custom);
  const customIds = new Set(customRepos.map((repo) => repo.id));
  const nextRepos = [...workspaceRepos.filter((repo) => !customIds.has(repo.id)), ...customRepos];
  openWorldRepos.splice(0, openWorldRepos.length, ...nextRepos);
  if (!openWorldRepos.some((repo) => repo.id === activeRepoId)) {
    activeRepoId = openWorldRepos[0]?.id || "";
    activeFileName = Object.keys(openWorldRepos[0]?.files || {})[0] || "";
  }
}

async function loadWorkspaceInternalRepos() {
  if (location.protocol === "file:") return;
  try {
    const response = await fetch(`/api/internal-repos?t=${Date.now()}`);
    if (!response.ok) throw new Error(`internal repos HTTP ${response.status}`);
    const repos = await response.json();
    replaceWorkspaceRepos(Array.isArray(repos) ? repos : []);
    renderCommunity();
  } catch {
    // Keep built-in/demo repos when the backend is not available.
  }
}

loadCustomInternalRepos();

const people = [
  ["You", "Founder", "#21d6e7"],
  ["Master Agent", "Maintainer", "#ffc44d"],
  ["Frontend Agent", "UI contributor", "#7c5cff"],
  ["Backend Agent", "API contributor", "#22c7d8"],
  ["Reviewer Agent", "Code review", "#ff515f"],
  ["Feishu Bot", "Connector", "#2fe098"],
  ["WeCom Bot", "Connector", "#4e8cff"],
];

let activeRepoId = "runtime";
let activeFileName = "server.py";
let repoInlineQuery = "";
const generatedCodeOverrides = {};
const streamingCodeTimers = new Map();
const streamingCodeQueue = [];
let streamingCodeActive = false;
let streamingCodeKey = "";
let streamingCodeLineIndex = -1;
let activePatchCandidate = null;
let currentView = "warRoom";
let pendingAuthView = "";
let pendingMasterHandoff = null;
let selectedReviewerIntakeKey = "";
const patchTargetMap = {
  "runtime/server.py": "runtime/server.py",
  "runtime/Agent.py": "runtime/Agent.py",
  "runtime/connectors.py": "runtime/connectors.py",
  "desktop/app.js": "desktop/app.js",
  "desktop/styles.css": "desktop/styles.css",
  "desktop/index.html": "desktop/index.html",
  "connectors/feishu.md": "runtime/connectors.py",
  "connectors/wecom.md": "runtime/connectors.py",
  "connectors/douyin.md": "runtime/connectors.py",
};
let captainVotes = {
  master: 3,
  frontend: 1,
  backend: 2,
  reviewer: 1,
  tester: 0,
};
let liveComments = [
  { id: 1, name: "Frontend Agent", text: "建议代码区评论只绑定当前文件，避免污染仓库首页。", votes: 3, status: "open" },
  { id: 2, name: "Reviewer Agent", text: "采纳建议前必须先跑校验，不能让明显语法错误进入代码区。", votes: 5, status: "open" },
  { id: 3, name: "Backend Agent", text: "任务生成代码时保留 source，方便区分来自飞书、企业微信或手动输入。", votes: 2, status: "open" },
  { id: 4, name: "你", text: "最高票建议才能写入代码，其他建议先留在 review 区。", votes: 4, status: "open" },
];
let externalIssues = [];
const manualIssues = [];
let codedTaskKeys = new Set();
let deliveredTaskKeys = new Set();
let queuedCodeStreamKeys = new Set();
let completedCodeStreamKeys = new Set();
let codeArtifactKeys = new Set();
const codeArtifactMeta = {};
const agentTokenRefunds = {};

let currentTaskIndex = -1;
let paused = false;
let autoTimer = null;
let selectedAgentId = "master";
let socket = null;
let backendConnected = false;
let backendAutoTimer = null;
let arbitrationTimer = null;
let backendQueueStats = { pending: 0, active: 0, blocked: 0, running_total: 0, completed_total: 0 };
let suppressNonEmptyTaskSnapshotUntil = 0;
let localWorkflowTaskSeq = 1;
let masterTaskHistory = [];
let projectDeliveries = [];
let activeRuntimeDeliveryId = localStorage.getItem("qfActiveRuntimeDeliveryId") || "";
const deliveryTestStates = {};
let activeRuntimeRepoId = localStorage.getItem("qfActiveRuntimeRepoId") || "";
const runtimeRepoTestStates = {};
let adminChatTimer = null;
const publicChatMessages = [];
const adminChatMessageIds = new Set();
const publicChatMessageIds = new Set();
let publicWorldOnlinePeers = [];
let remoteRelayUrl = localStorage.getItem("qfRemoteRelayUrl") || "";
const publicWorldState = {
  repos: [
    { id: "runtime", name: "quantumflow-runtime", desc: "调度 / WebSocket / Connector", lang: "Python", url: "https://example.com/QuantumFlow/quantumflow-runtime.git" },
    { id: "desktop", name: "agent-desktop", desc: "调度中枢 / 源文明 / UI", lang: "JavaScript", url: "https://example.com/QuantumFlow/agent-desktop.git" },
    { id: "connectors", name: "app-connectors", desc: "飞书 / 企业微信 / 微信客服", lang: "Webhook", url: "https://example.com/QuantumFlow/app-connectors.git" },
  ],
  issues: [
    { id: "ISS-101", title: "优化开源世界的 GitHub 风格布局", status: "open", owner: "Frontend Agent", understanding: [] },
    { id: "ISS-102", title: "验证 Agent 生成项目可运行", status: "open", owner: "Tester Agent", understanding: [] },
    { id: "ISS-103", title: "公开聊天接入真实用户身份", status: "planned", owner: "Backend Agent", understanding: [] },
  ],
  pulls: [
    { id: "PR-18", title: "#18 source-civilization-layout", status: "review", owner: "Reviewer Agent", branch: "source-civilization-layout", agentRuns: [] },
    { id: "PR-21", title: "#21 feishu-task-loop", status: "draft", owner: "Backend Agent", branch: "feishu-task-loop", agentRuns: [] },
  ],
  audits: [
    {
      id: "AUD-1",
      agent: "Tester Agent",
      title: "运行前端静态校验，等待完整冒烟测试。",
      text: "下一步需要触发真实冒烟测试，并把结果写入公开日志。",
      time: "just now",
      result: "静态校验已通过，仍需浏览器冒烟验证。",
      risk: "中等：真实 Connector 和联机协作尚未压测。",
    },
    {
      id: "AUD-2",
      agent: "Reviewer Agent",
      title: "候选补丁必须通过语法校验。",
      text: "投票最高的建议会进入候选补丁，但只有校验通过后才能写入仓库。",
      time: "12 min ago",
      result: "候选补丁策略正确，建议继续保留语法门禁。",
      risk: "低：当前主要风险是人工建议质量不稳定。",
    },
  ],
  feed: [
    {
      actor: "Assistant",
      title: "运行前端静态校验，等待完整冒烟测试。",
      text: "结论：已完成语法和路由级检查。下一步由 Tester Agent 触发真实冒烟测试，并把结果写入公开日志。",
      meta: "Agent 审计 / just now",
    },
    {
      actor: "Reviewer Agent",
      title: "候选补丁需要先通过语法校验。",
      text: "投票最高的建议会进入候选补丁，但只有校验通过后才能写入仓库。",
      meta: "Review Gate / 12 min ago",
    },
    {
      actor: "Backend Agent",
      title: "新增 API Registry 与成员管理接口。",
      text: "接口和成员现在会落库，支持添加、删除和实时刷新。",
      meta: "Commit / 28 min ago",
    },
  ],
};
let selectedPublicRepoId = "runtime";
let selectedPublicIssueId = "ISS-101";
let selectedPublicPullId = "PR-18";
let selectedPublicAuditId = "AUD-1";
const collaboratorClientId =
  localStorage.getItem("qfClientId") ||
  (() => {
    const id = `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    localStorage.setItem("qfClientId", id);
    return id;
  })();
let collaboratorName =
  localStorage.getItem("qfDisplayName") ||
  (() => {
    const name = `开发者 ${collaboratorClientId.slice(-4).toUpperCase()}`;
    localStorage.setItem("qfDisplayName", name);
    return name;
  })();

let authToken = "";
let currentUser = null;
const AUTH_SESSION_KEY = "qfAuthSession";
const AUTH_REMEMBER_KEY = "qfRememberLogin";
const LLM_PLUGIN_CONFIG_KEY = "qfManualLlmPluginConfig";
let adminLookupTimer = null;
let selectedAdminUser = null;
let lastLlmPluginResult = "";

const adminChatMessages = [
  { name: "Admin", role: "Owner", text: "开发者管理中心先保留为管理员入口，正式上线后再开放权限。" },
  { name: "Backend Agent", role: "API", text: "API Registry 已预留任务、Issue、日志和 Bot 对话接口。" },
  { name: "Frontend Agent", role: "UI", text: "群聊窗口结构已就绪，后续可以接 WebSocket 实时用户。" },
  { name: "Reviewer", role: "Gate", text: "未通过管理员校验前，不允许执行敏感管理操作。" },
];

adminChatMessages.length = 0;
let suppressRemoteCodexReplyUntil = 0;

const codexAssistantPeer = {
  id: "codex-assistant",
  name: "Codex",
  role: "AI Assistant",
  kind: "assistant",
  source: "QuantumFlow / Codex",
  color: "#2fe098",
  status: "online",
};

const codexAdminGreeting = {
  id: "local-codex-admin-greeting",
  name: "Codex",
  role: "AI Assistant",
  text: "我已加载 QuantumFlow 系统设计文档。你可以 @Codex 问架构、Agent 分工、RAG/Skill、自愈流程、接口链路或任务拆解，我会按这份设计文档来回答。",
};

const codexKnowledgeProfile = {
  identity:
    "QuantumFlow 是基于多智能体协同的人机共存生产力调度系统，目标是把人类高阶创意和 AI 低成本逻辑执行结合起来，形成可视化、可审计、可自愈的生产力网络。",
  llm:
    "LLM 本质是基于 Token 的概率生成系统，依赖 Context Window、Transformer 和 Self-Attention。系统提示词定义行为边界，Skill 定义复杂任务 SOP，RAG 用召回和重排把外部知识注入上下文，而不是改模型权重。",
  architecture:
    "QuantumFlow 采用 Master-Slave 多智能体集群。Control Plane 由 Claude Code/Master 负责全局拆解、仲裁、分发和验收；Infrastructure 使用 K8s/KubeEdge 管理 Agent 生命周期，Pulsar 做异步消息中枢，Redis + Vector DB + Graph DB 分别承担瞬时状态、语义经验和长链路依赖；Execution Layer 由 Codex、Gemini、OpenCode 等 Slave Node 在隔离沙箱中并行执行。",
  codex:
    "Codex 在设计文档里承担后端、API、数据库事务、代码生成和沙箱执行侧的重要角色；在 API 与数据库事务任务中拥有 1.5x 权重。它应先澄清目标、入口文件、约束和验收标准，再给出可执行补丁或派发给合适 Agent。",
  workflow:
    "全链路交付遵循四步：1. Redis 物理环境锚定，统一状态真理源；2. Manager 将子任务推入 Pulsar 队列异步分发；3. OpenCode 写入前访问共享状态机，避免写写覆盖；4. 沙箱执行 npm test/jest 等审计，按 Checked Gap 和 Unchecked Gap 梯度纠偏，直至误差归零并 Git 交付。",
  quality:
    "质量保障把问题抽象为 Gap：Checked Gap 包括编译失败、语法报错和 StackTrace；Unchecked Gap 包括路由未挂载、前后端状态不同步、菜单权限缺失等业务断层。QuantumFlow 通过动态插桩、路由纠错和二次修复完成自愈。",
  api:
    "核心调用规范强调指令集、投票与仲裁：Codex 在 API/DB 上 1.5x，Gemini 在 UI 交互上 1.5x，OpenCode 在物理兼容性上 1.2x；平局时引入 Human-in-the-loop，Master 对重大安全问题拥有一票否决权。",
  vision:
    "长期愿景是成为类似 GitHub 的可视化开源代码管理与协作社区，让全球开发者和协同 Agent 在线交流创意、发布项目、可视化任务流、CoT 逻辑链和吞吐状态。",
};

const workspaceTasks = [
  { title: "把登录门禁接成真实 Beta 工作流", owner: "master", status: "done" },
  { title: "开发者管理中心新增多人协作工作区", owner: "frontend", status: "active" },
];
const workspaceMessages = [
  { name: "Codex", role: "Pair Agent", text: "我会先把需求拆成 UI、状态、接口、验证四步；开发者可以在这里补充约束，再交给调度中枢 Agent 执行。" },
  { name: "Master Agent", role: "Coordinator", text: "协作工作区负责商讨和提交开发任务，真正写代码仍进入调度中枢链路。" },
];
const workspaceCodeEvents = [
  "auth_gate.py :: require_login_before_app_boot()",
  "developer_workspace.js :: render_collab_room()",
  "codex_pairing.md :: plan -> discuss -> dispatch -> verify",
];
let projectRooms = [];
let myProjectRooms = [];
let lastCreatedProjectRoom = null;
let activeProjectRoom = null;
let activeProjectRoomMessages = [];
const projectRoomDocs = {};

const els = {
  agentLayer: document.getElementById("agentLayer"),
  agentStrip: document.getElementById("agentStrip"),
  taskList: document.getElementById("taskList"),
  nextBtn: document.getElementById("nextBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  autoBtn: document.getElementById("autoBtn"),
  resetBtn: document.getElementById("resetBtn"),
  log: document.getElementById("log"),
  clock: document.getElementById("clock"),
  taskMetric: document.getElementById("taskMetric"),
  blockedMetric: document.getElementById("blockedMetric"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  queueBoard: document.getElementById("queueBoard"),
  connectionState: document.getElementById("connectionState"),
  taskCount: document.getElementById("taskCount"),
  clearTasksBtn: document.getElementById("clearTasksBtn"),
  runningCount: document.getElementById("runningCount"),
  taskForm: document.getElementById("taskForm"),
  taskInput: document.getElementById("taskInput"),
  ownerSelect: document.getElementById("ownerSelect"),
  mainView: document.getElementById("mainView"),
  pageTitle: document.querySelector(".topbar h1"),
  warRoomView: document.getElementById("warRoomView"),
  runtimeEnvironmentView: document.getElementById("runtimeEnvironmentView"),
  runtimeQueueMetric: document.getElementById("runtimeQueueMetric"),
  runtimeProjectTitle: document.getElementById("runtimeProjectTitle"),
  runtimeProjectStatus: document.getElementById("runtimeProjectStatus"),
  runtimeProjectOutput: document.getElementById("runtimeProjectOutput"),
  runtimeProjectTestBtn: document.getElementById("runtimeProjectTestBtn"),
  runtimeProjectOpenBtn: document.getElementById("runtimeProjectOpenBtn"),
  runtimeProjectFixBtn: document.getElementById("runtimeProjectFixBtn"),
  runtimeProjectFrame: document.getElementById("runtimeProjectFrame"),
  runtimePreviewEmpty: document.getElementById("runtimePreviewEmpty"),
  runtimePreviewAddress: document.getElementById("runtimePreviewAddress"),
  runtimePreviewRefreshBtn: document.getElementById("runtimePreviewRefreshBtn"),
  runtimeRepoSelect: document.getElementById("runtimeRepoSelect"),
  runtimeRepoTestBtn: document.getElementById("runtimeRepoTestBtn"),
  runtimeRepoPreviewBtn: document.getElementById("runtimeRepoPreviewBtn"),
  runtimeRepoOpenCodeBtn: document.getElementById("runtimeRepoOpenCodeBtn"),
  runtimeRepoTestOutput: document.getElementById("runtimeRepoTestOutput"),
  communityView: document.getElementById("communityView"),
  openSourceWorldView: document.getElementById("openSourceWorldView"),
  profileView: document.getElementById("profileView"),
  projectRoomView: document.getElementById("projectRoomView"),
  developerAdminView: document.getElementById("developerAdminView"),
  adminChatList: document.getElementById("adminChatList"),
  adminChatForm: document.getElementById("adminChatForm"),
  adminChatInput: document.getElementById("adminChatInput"),
  adminChatOnline: document.getElementById("adminChatOnline"),
  adminOnlineTotal: document.getElementById("adminOnlineTotal"),
  adminOnlineList: document.getElementById("adminOnlineList"),
  adminOverviewOnline: document.getElementById("adminOverviewOnline"),
  adminOverviewOnlineList: document.getElementById("adminOverviewOnlineList"),
  adminPublicTunnelState: document.getElementById("adminPublicTunnelState"),
  adminPublicEntry: document.getElementById("adminPublicEntry"),
  adminPublicMessageCount: document.getElementById("adminPublicMessageCount"),
  adminOverviewFeed: document.getElementById("adminOverviewFeed"),
  adminApiForm: document.getElementById("adminApiForm"),
  adminApiMethod: document.getElementById("adminApiMethod"),
  adminApiPath: document.getElementById("adminApiPath"),
  adminApiDesc: document.getElementById("adminApiDesc"),
  adminApiList: document.getElementById("adminApiList"),
  adminMemberForm: document.getElementById("adminMemberForm"),
  adminMemberUserId: document.getElementById("adminMemberUserId"),
  adminMemberLookupState: document.getElementById("adminMemberLookupState"),
  adminMemberName: document.getElementById("adminMemberName"),
  adminMemberRole: document.getElementById("adminMemberRole"),
  adminMemberProject: document.getElementById("adminMemberProject"),
  adminMemberList: document.getElementById("adminMemberList"),
  projectRoomForm: document.getElementById("projectRoomForm"),
  projectRoomName: document.getElementById("projectRoomName"),
  projectRoomDesc: document.getElementById("projectRoomDesc"),
  projectRoomResult: document.getElementById("projectRoomResult"),
  projectRoomList: document.getElementById("projectRoomList"),
  projectJoinForm: document.getElementById("projectJoinForm"),
  projectInviteInput: document.getElementById("projectInviteInput"),
  myProjectRoomList: document.getElementById("myProjectRoomList"),
  oswProjectRoomForm: document.getElementById("oswProjectRoomForm"),
  oswProjectRoomName: document.getElementById("oswProjectRoomName"),
  oswProjectRoomDesc: document.getElementById("oswProjectRoomDesc"),
  oswJoinProjectForm: document.getElementById("oswJoinProjectForm"),
  oswInviteInput: document.getElementById("oswInviteInput"),
  oswJoinResult: document.getElementById("oswJoinResult"),
  oswMyProjectRoomList: document.getElementById("oswMyProjectRoomList"),
  remoteRelayForm: document.getElementById("remoteRelayForm"),
  remoteRelayInput: document.getElementById("remoteRelayInput"),
  remoteRelayStatus: document.getElementById("remoteRelayStatus"),
  networkFacts: document.getElementById("networkFacts"),
  roomPageTitle: document.getElementById("roomPageTitle"),
  roomPageDesc: document.getElementById("roomPageDesc"),
  roomInviteCopyBtn: document.getElementById("roomInviteCopyBtn"),
  roomBackBtn: document.getElementById("roomBackBtn"),
  roomMessageList: document.getElementById("roomMessageList"),
  roomMessageForm: document.getElementById("roomMessageForm"),
  roomMessageKind: document.getElementById("roomMessageKind"),
  roomFileInput: document.getElementById("roomFileInput"),
  roomMessageInput: document.getElementById("roomMessageInput"),
  roomFacts: document.getElementById("roomFacts"),
  roomOnlineList: document.getElementById("roomOnlineList"),
  roomDocTitle: document.getElementById("roomDocTitle"),
  roomDocContent: document.getElementById("roomDocContent"),
  roomDocSaveBtn: document.getElementById("roomDocSaveBtn"),
  roomDocState: document.getElementById("roomDocState"),
  adminOverviewCharts: document.getElementById("adminOverviewCharts"),
  communityIssues: document.getElementById("communityIssues"),
  issueWindowList: document.getElementById("issueWindowList"),
  issueInlineList: document.getElementById("issueInlineList"),
  issueCreateForm: document.getElementById("issueCreateForm"),
  issueKeywordInput: document.getElementById("issueKeywordInput"),
  issueFileInput: document.getElementById("issueFileInput"),
  issueAgentSelect: document.getElementById("issueAgentSelect"),
  issueDescribeBtn: document.getElementById("issueDescribeBtn"),
  issueDescriptionInput: document.getElementById("issueDescriptionInput"),
  repoList: document.getElementById("repoList"),
  repoQuickCreateBtn: document.getElementById("repoQuickCreateBtn"),
  repoWindowList: document.getElementById("repoWindowList"),
  repoInlineList: document.getElementById("repoInlineList"),
  repoInlineSearch: document.getElementById("repoInlineSearch"),
  repoDetailPanel: document.getElementById("repoDetailPanel"),
  repoCreateToggleBtn: document.getElementById("repoCreateToggleBtn"),
  repoCreateForm: document.getElementById("repoCreateForm"),
  repoCreateName: document.getElementById("repoCreateName"),
  repoCreateDesc: document.getElementById("repoCreateDesc"),
  repoCreateType: document.getElementById("repoCreateType"),
  repoCreateFrontendLang: document.getElementById("repoCreateFrontendLang"),
  repoCreateBackendLang: document.getElementById("repoCreateBackendLang"),
  repoCreateDatabase: document.getElementById("repoCreateDatabase"),
  repoCreateVisibility: document.getElementById("repoCreateVisibility"),
  repoCreateTemplate: document.getElementById("repoCreateTemplate"),
  repoFileCreateForm: document.getElementById("repoFileCreateForm"),
  repoFileCreateCrumb: document.getElementById("repoFileCreateCrumb"),
  repoFileCreateRepoName: document.getElementById("repoFileCreateRepoName"),
  repoFileCreateName: document.getElementById("repoFileCreateName"),
  repoFileCreateKind: document.getElementById("repoFileCreateKind"),
  repoFileCreateAgent: document.getElementById("repoFileCreateAgent"),
  repoFileCreatePurpose: document.getElementById("repoFileCreatePurpose"),
  repoFileCreateBody: document.getElementById("repoFileCreateBody"),
  repoFileCreateOpen: document.getElementById("repoFileCreateOpen"),
  gitSyncForm: document.getElementById("gitSyncForm"),
  gitSyncUrl: document.getElementById("gitSyncUrl"),
  gitSyncName: document.getElementById("gitSyncName"),
  gitSyncResult: document.getElementById("gitSyncResult"),
  peopleList: document.getElementById("peopleList"),
  liveComments: document.getElementById("liveComments"),
  commentForm: document.getElementById("commentForm"),
  commentInput: document.getElementById("commentInput"),
  commentKind: document.getElementById("commentKind"),
  autoCodePanel: document.getElementById("autoCodePanel"),
  autoCodeForm: document.getElementById("autoCodeForm"),
  autoCodeInput: document.getElementById("autoCodeInput"),
  autoCodeOwner: document.getElementById("autoCodeOwner"),
  agentArbitrationNote: document.getElementById("agentArbitrationNote"),
  autoAgentMonitor: document.getElementById("autoAgentMonitor"),
  adoptSuggestionBtn: document.getElementById("adoptSuggestionBtn"),
  patchPreviewPanel: document.getElementById("patchPreviewPanel"),
  captainVoteList: document.getElementById("captainVoteList"),
  captainVoteInlineList: document.getElementById("captainVoteInlineList"),
  captainName: document.getElementById("captainName"),
  captainInlineName: document.getElementById("captainInlineName"),
  patchHistoryList: document.getElementById("patchHistoryList"),
  patchHistoryInlineList: document.getElementById("patchHistoryInlineList"),
  taskLogInlineList: document.getElementById("taskLogInlineList"),
  outboxList: document.getElementById("outboxList"),
  outboxInlineList: document.getElementById("outboxInlineList"),
  connectorConfigForm: document.getElementById("connectorConfigForm"),
  feishuWebhookInput: document.getElementById("feishuWebhookInput"),
  connectorConfigState: document.getElementById("connectorConfigState"),
  flushOutboxBtn: document.getElementById("flushOutboxBtn"),
  testFeishuBtn: document.getElementById("testFeishuBtn"),
  manualFeishuForm: document.getElementById("manualFeishuForm"),
  manualFeishuInput: document.getElementById("manualFeishuInput"),
  feishuChatWindow: document.getElementById("feishuChatWindow"),
  botChatOpen: document.getElementById("botChatOpen"),
  botChatClose: document.getElementById("botChatClose"),
  botChatList: document.getElementById("botChatList"),
  botChatForm: document.getElementById("botChatForm"),
  botChatInput: document.getElementById("botChatInput"),
  botInlineList: document.getElementById("botInlineList"),
  botInlineForm: document.getElementById("botInlineForm"),
  botInlineInput: document.getElementById("botInlineInput"),
  publicChatList: document.getElementById("publicChatList"),
  publicChatForm: document.getElementById("publicChatForm"),
  publicChatInput: document.getElementById("publicChatInput"),
  publicChatDockList: document.getElementById("publicChatDockList"),
  publicChatDockForm: document.getElementById("publicChatDockForm"),
  publicChatDockInput: document.getElementById("publicChatDockInput"),
  publicWorldChatList: document.getElementById("publicWorldChatList"),
  publicWorldChatForm: document.getElementById("publicWorldChatForm"),
  publicWorldChatInput: document.getElementById("publicWorldChatInput"),
  publicWorldOnlineCount: document.getElementById("publicWorldOnlineCount"),
  publicWorldOnlineTotal: document.getElementById("publicWorldOnlineTotal"),
  publicWorldOnlineList: document.getElementById("publicWorldOnlineList"),
  publicRepoSidebarList: document.getElementById("publicRepoSidebarList"),
  publicRepoList: document.getElementById("publicRepoList"),
  publicAssignedIssuesList: document.getElementById("publicAssignedIssuesList"),
  publicIssuesList: document.getElementById("publicIssuesList"),
  publicPullsList: document.getElementById("publicPullsList"),
  publicAuditList: document.getElementById("publicAuditList"),
  publicFeedList: document.getElementById("publicFeedList"),
  oswRepoDetail: document.getElementById("oswRepoDetail"),
  oswIssueDetail: document.getElementById("oswIssueDetail"),
  oswPullDetail: document.getElementById("oswPullDetail"),
  oswAuditDetail: document.getElementById("oswAuditDetail"),
  oswComposeInput: document.getElementById("oswComposeInput"),
  oswNewRepoForm: document.getElementById("oswNewRepoForm"),
  oswRepoNameInput: document.getElementById("oswRepoNameInput"),
  oswRepoDescInput: document.getElementById("oswRepoDescInput"),
  oswRepoLangInput: document.getElementById("oswRepoLangInput"),
  activeRepoName: document.getElementById("activeRepoName"),
  activeFileName: document.getElementById("activeFileName"),
  repoCodeView: document.getElementById("repoCodeView"),
  manualCodeEditor: document.getElementById("manualCodeEditor"),
  manualEditBtn: document.getElementById("manualEditBtn"),
  manualCompleteBtn: document.getElementById("manualCompleteBtn"),
  manualSaveBtn: document.getElementById("manualSaveBtn"),
  manualCancelBtn: document.getElementById("manualCancelBtn"),
  manualEditState: document.getElementById("manualEditState"),
  llmPluginPanel: document.getElementById("llmPluginPanel"),
  llmPluginProvider: document.getElementById("llmPluginProvider"),
  llmPluginModel: document.getElementById("llmPluginModel"),
  llmPluginBaseUrl: document.getElementById("llmPluginBaseUrl"),
  llmPluginApiKey: document.getElementById("llmPluginApiKey"),
  llmPluginPrompt: document.getElementById("llmPluginPrompt"),
  llmPluginOutput: document.getElementById("llmPluginOutput"),
  llmPluginSaveBtn: document.getElementById("llmPluginSaveBtn"),
  llmPluginGenerateBtn: document.getElementById("llmPluginGenerateBtn"),
  llmPluginInsertBtn: document.getElementById("llmPluginInsertBtn"),
  llmPluginReviewBtn: document.getElementById("llmPluginReviewBtn"),
  fileTree: document.getElementById("fileTree"),
  worldTaskCount: document.getElementById("worldTaskCount"),
  onlineCount: document.getElementById("onlineCount"),
  onlineMiniCount: document.getElementById("onlineMiniCount"),
  coderStudio: document.getElementById("coderStudio"),
  studioClose: document.getElementById("studioClose"),
  studioKicker: document.getElementById("studioKicker"),
  studioTitle: document.getElementById("studioTitle"),
  studioCode: document.getElementById("studioCode"),
  studioExplain: document.getElementById("studioExplain"),
  agentQuickPanel: document.getElementById("agentQuickPanel"),
  agentQuickKicker: document.getElementById("agentQuickKicker"),
  agentQuickTitle: document.getElementById("agentQuickTitle"),
  agentQuickCode: document.getElementById("agentQuickCode"),
  agentQuickExplain: document.getElementById("agentQuickExplain"),
  agentQuickClose: document.getElementById("agentQuickClose"),
  agentQuickEditorBtn: document.getElementById("agentQuickEditorBtn"),
  authShell: document.getElementById("authShell"),
  authUserBtn: document.getElementById("authUserBtn"),
  authStatus: document.getElementById("authStatus"),
  loginPanel: document.getElementById("loginPanel"),
  registerPanel: document.getElementById("registerPanel"),
  forgotPanel: document.getElementById("forgotPanel"),
  loginForm: document.getElementById("loginForm"),
  loginSubmitBtn: document.getElementById("loginSubmitBtn"),
  loginAccount: document.getElementById("loginAccount"),
  loginPassword: document.getElementById("loginPassword"),
  rememberAccount: document.getElementById("rememberAccount"),
  rememberPassword: document.getElementById("rememberPassword"),
  registerForm: document.getElementById("registerForm"),
  registerUsername: document.getElementById("registerUsername"),
  registerDisplayName: document.getElementById("registerDisplayName"),
  registerTarget: document.getElementById("registerTarget"),
  registerCode: document.getElementById("registerCode"),
  registerPassword: document.getElementById("registerPassword"),
  sendRegisterCodeBtn: document.getElementById("sendRegisterCodeBtn"),
  forgotForm: document.getElementById("forgotForm"),
  forgotTarget: document.getElementById("forgotTarget"),
  forgotCode: document.getElementById("forgotCode"),
  forgotPassword: document.getElementById("forgotPassword"),
  sendForgotCodeBtn: document.getElementById("sendForgotCodeBtn"),
  profileForm: document.getElementById("profileForm"),
  profileUsername: document.getElementById("profileUsername"),
  profileEmail: document.getElementById("profileEmail"),
  profilePhone: document.getElementById("profilePhone"),
  profileEditBtn: document.getElementById("profileEditBtn"),
  profileSaveState: document.getElementById("profileSaveState"),
  profileAvatar: document.getElementById("profileAvatar"),
  profileName: document.getElementById("profileName"),
  profileMeta: document.getElementById("profileMeta"),
  profileFacts: document.getElementById("profileFacts"),
  profileSideMetrics: document.getElementById("profileSideMetrics"),
  profileOverviewGrid: document.getElementById("profileOverviewGrid"),
  profileAgentRuntimeList: document.getElementById("profileAgentRuntimeList"),
  profileRoomList: document.getElementById("profileRoomList"),
  profileActivityList: document.getElementById("profileActivityList"),
  profileRepoList: document.getElementById("profileRepoList"),
  logoutBtn: document.getElementById("logoutBtn"),
  workspaceTaskForm: document.getElementById("workspaceTaskForm"),
  workspaceTaskInput: document.getElementById("workspaceTaskInput"),
  workspaceTaskOwner: document.getElementById("workspaceTaskOwner"),
  workspaceRoomSelect: document.getElementById("workspaceRoomSelect"),
  workspaceTaskList: document.getElementById("workspaceTaskList"),
  workspaceChatForm: document.getElementById("workspaceChatForm"),
  workspaceChatInput: document.getElementById("workspaceChatInput"),
  workspaceDiscussionList: document.getElementById("workspaceDiscussionList"),
  workspaceOnlineMini: document.getElementById("workspaceOnlineMini"),
};

function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function inferAuthChannel(target) {
  return String(target || "").includes("@") ? "email" : "phone";
}

function setAuthStatus(message, tone = "") {
  if (!els.authStatus) return;
  els.authStatus.textContent = message;
  els.authStatus.dataset.tone = tone;
}

function syncLoginSystemName() {
  if (!els.loginSubmitBtn) return;
  const systemName = String(els.pageTitle?.textContent || "QuantumFlow 调度中枢").trim();
  els.loginSubmitBtn.textContent = `进入 ${systemName}`;
}

function showAuthView(view = "login", push = true) {
  const panels = {
    login: els.loginPanel,
    register: els.registerPanel,
    forgot: els.forgotPanel,
  };
  const target = panels[view] ? view : "login";
  Object.entries(panels).forEach(([key, panel]) => panel?.classList.toggle("active", key === target));
  els.authShell?.classList.add("active");
  els.authShell?.setAttribute("aria-hidden", "false");
  document.body.classList.add("auth-mode");
  if (push && location.protocol !== "file:") {
    const path = target === "forgot" ? "/forgot-password" : `/${target}`;
    history.replaceState(null, "", path);
  }
}

function hideAuthShell() {
  els.authShell?.classList.remove("active");
  els.authShell?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("auth-mode");
  if (isAuthRoute()) {
    if (location.protocol !== "file:") history.replaceState(null, "", "/war-room");
  }
}

function enterDefaultAfterAuth() {
  const targetView = pendingAuthView || currentView || "warRoom";
  pendingAuthView = "";
  hideAuthShell();
  switchView(targetView);
}

function isAuthRoute(pathname = location.pathname) {
  return pathname.includes("login") || pathname.includes("register") || pathname.includes("forgot-password");
}

function enforceLoginGate() {
  if (currentUser) return false;
  pendingAuthView = viewFromPath() || currentView || "warRoom";
  showAuthView(location.pathname.includes("register") ? "register" : location.pathname.includes("forgot-password") ? "forgot" : "login", false);
  return true;
}

function viewFromPath(pathname = location.pathname) {
  if (pathname.includes("runtime-environment")) return "runtimeEnvironment";
  if (pathname.includes("admin")) return "developerAdmin";
  if (pathname.includes("open-source")) return "openSourceWorld";
  if (pathname.includes("platform")) return "community";
  if (pathname.includes("profile")) return "profile";
  if (pathname.includes("project-room")) return "projectRoom";
  return "warRoom";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function safeDecode(value = "") {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return "";
  }
}

function safeEncode(value = "") {
  try {
    return btoa(unescape(encodeURIComponent(value)));
  } catch {
    return "";
  }
}

function loadRememberedLogin() {
  let remembered = {};
  try {
    remembered = JSON.parse(localStorage.getItem(AUTH_REMEMBER_KEY) || "{}");
  } catch {
    remembered = {};
  }
  if (els.loginAccount && remembered.account) els.loginAccount.value = remembered.account;
  if (els.loginPassword && remembered.password) els.loginPassword.value = safeDecode(remembered.password);
  if (els.rememberAccount) els.rememberAccount.checked = remembered.rememberAccount !== false;
  if (els.rememberPassword) els.rememberPassword.checked = Boolean(remembered.rememberPassword);
}

function saveRememberedLogin(account, password) {
  const rememberAccount = Boolean(els.rememberAccount?.checked);
  const rememberPassword = Boolean(els.rememberPassword?.checked);
  const payload = {
    rememberAccount,
    rememberPassword,
    account: rememberAccount ? account : "",
    password: rememberPassword ? safeEncode(password) : "",
  };
  localStorage.setItem(AUTH_REMEMBER_KEY, JSON.stringify(payload));
}

function readStoredAuthSession() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || "{}");
    if (session.date !== todayKey() || !session.token || !session.user) {
      localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

function storeAuthSession(token, user) {
  authToken = token || authToken;
  currentUser = user || currentUser;
  if (authToken && currentUser) {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ token: authToken, user: currentUser, date: todayKey() }));
  }
  if (currentUser?.display_name) {
    collaboratorName = currentUser.display_name;
    localStorage.setItem("qfDisplayName", collaboratorName);
  }
  updateAuthChrome();
  sendHello();
}

function updateAuthChrome() {
  if (!els.authUserBtn) return;
  if (currentUser) {
    const name = currentUser.display_name || currentUser.username || "Developer";
    els.authUserBtn.textContent = name;
    els.authUserBtn.title = "查看用户信息";
    els.authUserBtn.classList.add("logged-in");
  } else {
    els.authUserBtn.textContent = "登录 / 注册";
    els.authUserBtn.removeAttribute("title");
    els.authUserBtn.classList.remove("logged-in");
  }
}

function isFounderUser(user = currentUser) {
  const role = String(user?.role || "").trim().toLowerCase();
  const title = String(user?.title || "").trim().toLowerCase();
  return Boolean(user?.founder) || role === "founder" || title === "创始人" || title === "founder";
}

function displayRoleLabel(role, user = currentUser) {
  if (isFounderUser(user)) return "创始人";
  return role || "Developer";
}

function renderProfile() {
  if (!currentUser) {
    setAuthStatus("请先登录后查看用户页。", "warn");
    showAuthView("login", false);
    return;
  }
  const name = currentUser.display_name || currentUser.username || "Developer";
  const founder = isFounderUser(currentUser);
  const rawRole = currentUser.role || onlineRoleForName(name) || "Developer";
  const syncedRole = displayRoleLabel(rawRole, currentUser);
  const syncedStatus = isNameOnline(name) ? "online" : currentUser.status || "active";
  if (els.profileAvatar) els.profileAvatar.textContent = avatarInitial(name);
  if (els.profileName) els.profileName.textContent = name;
  if (els.profileMeta) els.profileMeta.innerHTML = `${escapeHtml(syncedRole)} / ${escapeHtml(syncedStatus)}${founder ? '<b class="founder-title-badge">Founder</b>' : ""}`;
  if (els.profileUsername) els.profileUsername.value = currentUser.username || "";
  if (els.profileUsername) {
    els.profileUsername.disabled = false;
    els.profileUsername.title = "只能修改当前登录账号的用户名。";
  }
  if (els.profileEmail) els.profileEmail.value = currentUser.email || "";
  if (els.profilePhone) els.profilePhone.value = currentUser.phone || "";
  const roomCount = myProjectRooms.length;
  const commentCount = liveComments.filter((item) => isOwnMessageName(item.name)).length;
  const publicCount = publicChatMessages.filter((item) => isOwnMessageName(item.name)).length;
  if (els.profileSideMetrics) {
    els.profileSideMetrics.innerHTML = `
      <div><strong>${roomCount}</strong><span>项目房间</span></div>
      <div><strong>${commentCount + publicCount}</strong><span>协作发言</span></div>
    `;
  }
  if (els.profileOverviewGrid) {
    els.profileOverviewGrid.innerHTML = `
      <article><span>角色</span><strong>${escapeHtml(syncedRole)}</strong><em>当前权限</em></article>
      <article><span>状态</span><strong>${escapeHtml(syncedStatus)}</strong><em>实时在线状态</em></article>
      <article><span>项目</span><strong>${roomCount}</strong><em>已加入房间</em></article>
      <article><span>消息</span><strong>${commentCount + publicCount}</strong><em>本地协作记录</em></article>
      ${
        founder
          ? `<article class="founder-privilege-card"><span>Founder Privilege</span><strong>系统创始人</strong><em>永久全权限 / 不可降级 / 最终 Owner 门禁</em></article>`
          : ""
      }
    `;
  }
  renderProfileAgentRuntime();
  if (els.profileFacts) {
    els.profileFacts.innerHTML = `
      <div><span>用户 ID</span><strong>${escapeHtml(currentUser.id || "-")}</strong></div>
      <div><span>用户名</span><strong>${escapeHtml(currentUser.username || "-")}</strong></div>
      <div><span>显示名称</span><strong>${escapeHtml(currentUser.display_name || "-")}</strong></div>
      <div><span>邮箱</span><strong>${escapeHtml(currentUser.email || "未绑定")}</strong></div>
      <div><span>手机</span><strong>${escapeHtml(currentUser.phone || "未绑定")}</strong></div>
      <div><span>账号角色</span><strong>${escapeHtml(syncedRole)}</strong></div>
      ${founder ? '<div><span>专属头衔</span><strong>创始人 Founder</strong></div>' : ""}
      ${founder ? '<div><span>Founder 特权</span><strong>全权限、成员管理、接口注册、系统 Owner 覆盖权</strong></div>' : ""}
      <div><span>实时状态</span><strong>${escapeHtml(syncedStatus)}</strong></div>
      <div><span>创建时间</span><strong>${escapeHtml(currentUser.created_at || "-")}</strong></div>
      <div><span>最近登录</span><strong>${escapeHtml(currentUser.last_login_at || "刚刚")}</strong></div>
    `;
  }
  if (els.profileRoomList) {
    els.profileRoomList.innerHTML = myProjectRooms.length
      ? myProjectRooms
          .map(
            (room) => `
            <article>
              <div><strong>${escapeHtml(room.name)}</strong><span>${escapeHtml(room.description || "暂无说明")}</span></div>
              <em>${escapeHtml(room.role || "Developer")} / ${escapeHtml(room.joined_at || "")}</em>
            </article>
          `,
          )
          .join("")
      : '<div class="profile-empty">还没有加入项目房间，可以去开源世界的项目房间创建或输入邀请码加入。</div>';
  }
  if (els.profileActivityList) {
    const activities = [
      ...liveComments.filter((item) => isOwnMessageName(item.name)).slice(-4).map((item) => ({ title: "代码区建议", text: item.text, meta: `${item.votes || 0} 票` })),
      ...publicChatMessages.filter((item) => isOwnMessageName(item.name)).slice(-4).map((item) => ({ title: "公开聊天", text: item.text, meta: item.role || "源文明" })),
    ].slice(-6).reverse();
    els.profileActivityList.innerHTML = activities.length
      ? activities
          .map(
            (item) => `
            <article>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.text)}</p>
              <em>${escapeHtml(item.meta)}</em>
            </article>
          `,
          )
          .join("")
      : '<div class="profile-empty">暂无协作记录。你在代码区、公开聊天或项目房间里的发言会显示在这里。</div>';
  }
  if (els.profileRepoList) {
    els.profileRepoList.innerHTML = openWorldRepos
      .map((repo) => {
        const fileCount = Object.keys(repo.files || {}).length;
        return `
          <article class="profile-repo-card">
            <div>
              <strong>${escapeHtml(repo.name)}</strong>
              <p>${escapeHtml(repo.desc)}</p>
            </div>
            <div class="profile-repo-meta">
              <span>${escapeHtml(repo.lang)}</span>
              <span>${repo.stars} stars</span>
              <span>${fileCount} files</span>
            </div>
          </article>
        `;
      })
      .join("");
  }
}

function renderProfileAgentRuntime() {
  if (!els.profileAgentRuntimeList) return;
  const rows = agents.map((agent) => {
    const ownedTasks = tasks.filter((task) => task.owner === agent.id && !["done", "delivery", "packaged", "delivered"].includes(task.status));
    const current = ownedTasks.find((task) => ["active", "blocked", "review"].includes(task.status)) || ownedTasks[0];
    const blocked = ownedTasks.filter((task) => task.status === "blocked").length;
    const token = estimateAgentTokenUsage(agent.id);
    return { agent, ownedTasks, current, blocked, token };
  });
  const totalToken = rows.reduce((sum, row) => sum + row.token.total, 0);
  els.profileAgentRuntimeList.innerHTML = `
    <div class="profile-agent-runtime-summary">
      <div><span>总任务量</span><strong>${rows.reduce((sum, row) => sum + row.ownedTasks.length, 0)}</strong></div>
      <div><span>阻塞</span><strong>${rows.reduce((sum, row) => sum + row.blocked, 0)}</strong></div>
      <div><span>Token 总量</span><strong>${formatTokenCount(totalToken)}</strong></div>
    </div>
    <div class="profile-agent-table">
      ${rows
        .map(({ agent, ownedTasks, current, blocked, token }) => {
          const busy = isAgentBusy(agent.id);
          return `
            <article class="${busy ? "busy" : "free"}">
              <div class="profile-agent-name">
                <i style="--agent-color:${escapeHtml(agent.color)}"></i>
                <span><strong>${escapeHtml(agent.name)}</strong><em>${escapeHtml(agent.role)}</em></span>
              </div>
              <div><span>状态</span><strong>${escapeHtml(statusLabel(agent.status))}</strong></div>
              <div><span>任务</span><strong>${ownedTasks.length}</strong><em>${blocked ? `${blocked} 阻塞` : "无阻塞"}</em></div>
              <div class="profile-agent-current"><span>当前任务</span><strong>${escapeHtml(current?.workflowTitle || current?.title || "暂无")}</strong></div>
              <div><span>Prompt</span><strong>${formatTokenCount(token.prompt)}</strong></div>
              <div><span>Completion</span><strong>${formatTokenCount(token.completion)}</strong></div>
              <div><span>Total</span><strong>${formatTokenCount(token.total)}</strong><em>${token.refund ? `已返还 ${formatTokenCount(token.refund)}` : "估算"}</em></div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function estimateAgentTokenUsage(agentId) {
  const ownedTasks = tasks.filter((task) => task.owner === agentId && !["delivery", "packaged", "delivered"].includes(task.status));
  const taskText = ownedTasks.map((task) => `${task.title || ""} ${task.workflowTitle || ""} ${task.source || ""}`).join("\n");
  const artifactChars = Object.values(codeArtifactMeta)
    .filter((artifact) => String(artifact.agent_id || "") === agentId)
    .reduce((sum, artifact) => sum + String(artifact.code_text || "").length + String(artifact.explanation || "").length, 0);
  const streamedChars = Object.entries(generatedCodeOverrides)
    .filter(([key]) => keyBelongsToAgent(key, agentId))
    .reduce((sum, [, lines]) => sum + (Array.isArray(lines) ? lines.join("\n").length : 0), 0);
  const commentChars = liveComments
    .filter((item) => String(item.name || "").toLowerCase().includes(String(agentId).toLowerCase()) || String(item.name || "").includes(agentById(agentId)?.name || ""))
    .reduce((sum, item) => sum + String(item.text || "").length, 0);
  const prompt = Math.ceil((taskText.length + commentChars + ownedTasks.length * 420) / 3.6);
  const completion = Math.ceil((artifactChars + streamedChars) / 3.8);
  const gross = prompt + completion;
  const refund = Math.min(gross, Math.max(0, Math.round(agentTokenRefunds[agentId] || 0)));
  return { prompt, completion, refund, total: Math.max(0, gross - refund), gross };
}

function keyBelongsToAgent(key, agentId) {
  const fileName = String(key || "").split("/").slice(1).join("/");
  const map = {
    master: ["README.md", "Agent.py"],
    frontend: ["src/App.vue", "src/main.js", "src/style.css", "app/static/app.js", "index.html", "package.json"],
    backend: ["app/main.py", "server.py", "api-assumption.md"],
    tester: ["tests/book.spec.js", "tests/test_smoke.py", "feishu.md"],
    reviewer: ["docs/review-checklist.md", "connectors.py"],
  };
  return (map[agentId] || []).some((item) => fileName.endsWith(item));
}

function formatTokenCount(value) {
  const number = Math.max(0, Math.round(Number(value) || 0));
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return String(number);
}

function switchProfileTab(tab = "overview") {
  const next = ["overview", "repositories", "projects", "activity", "personal"].includes(tab) ? tab : "overview";
  document.querySelectorAll("[data-profile-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.profileTab === next);
  });
  document.querySelectorAll("[data-profile-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.profilePanel === next);
  });
}

async function sendAuthCode(targetInput, purpose, button, codeInput) {
  const target = targetInput?.value.trim() || "";
  if (!target) {
    setAuthStatus("请先填写邮箱或手机号。", "warn");
    return;
  }
  button.disabled = true;
  button.textContent = "发送中";
  try {
    const response = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, channel: inferAuthChannel(target), purpose }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "验证码发送失败");
    if (codeInput) codeInput.value = data.dev_code || "";
    setAuthStatus(`测试验证码 ${data.dev_code} 已生成，10 分钟内有效。`, "ok");
  } catch (error) {
    setAuthStatus(error.message || "验证码发送失败。", "warn");
  } finally {
    button.disabled = false;
    button.textContent = "发送验证码";
  }
}

async function submitLogin(event) {
  event.preventDefault();
  const account = els.loginAccount?.value.trim() || "";
  const password = els.loginPassword?.value || "";
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "登录失败");
    saveRememberedLogin(account, password);
    storeAuthSession(data.token, data.user);
    setAuthStatus("登录成功，已进入 QuantumFlow 测试版。", "ok");
    enterDefaultAfterAuth();
  } catch (error) {
    setAuthStatus(error.message || "登录失败。", "warn");
  }
}

async function submitRegister(event) {
  event.preventDefault();
  const target = els.registerTarget?.value.trim() || "";
  const body = {
    username: els.registerUsername?.value.trim() || "",
    display_name: els.registerDisplayName?.value.trim() || "",
    password: els.registerPassword?.value || "",
    code: els.registerCode?.value.trim() || "",
    email: target.includes("@") ? target : "",
    phone: target.includes("@") ? "" : target,
  };
  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "注册失败");
    storeAuthSession(data.token, data.user);
    setAuthStatus("注册成功，已自动登录。", "ok");
    enterDefaultAfterAuth();
  } catch (error) {
    setAuthStatus(error.message || "注册失败。", "warn");
  }
}

async function submitForgotPassword(event) {
  event.preventDefault();
  try {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: els.forgotTarget?.value.trim() || "",
        code: els.forgotCode?.value.trim() || "",
        new_password: els.forgotPassword?.value || "",
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "重置失败");
    setAuthStatus("密码已重置，可以重新登录。", "ok");
    showAuthView("login");
  } catch (error) {
    setAuthStatus(error.message || "重置失败。", "warn");
  }
}

async function submitProfile(event) {
  event.preventDefault();
  if (!currentUser) return;
  const username = els.profileUsername?.value.trim() || currentUser.username || "";
  const email = els.profileEmail?.value.trim() || "";
  const phone = els.profilePhone?.value.trim() || "";
  const validationError =
    !/^[a-zA-Z0-9_.-]{3,32}$/.test(username)
      ? "用户名只能包含字母、数字、下划线、点或短横线，长度 3-32 位。"
      : email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? "邮箱格式不正确。"
        : phone && !/^\+?\d[\d\s-]{5,20}$/.test(phone)
          ? "手机号格式不正确。"
          : "";
  if (validationError) {
    if (els.profileSaveState) {
      els.profileSaveState.textContent = validationError;
      els.profileSaveState.dataset.tone = "warn";
    }
    setAuthStatus(validationError, "warn");
    return;
  }
  const previousUser = { ...currentUser };
  currentUser = { ...currentUser, username, email, phone };
  storeAuthSession(authToken, currentUser);
  updateAuthChrome();
  renderProfile();
  if (els.profileSaveState) {
    els.profileSaveState.textContent = "已保存到本地，正在同步...";
    els.profileSaveState.dataset.tone = "pending";
  }
  try {
    const response = await fetch("/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ username, email, phone }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "保存失败");
    storeAuthSession(authToken, data.user);
    renderProfile();
    updateAuthChrome();
    setAuthStatus("用户资料已保存。", "ok");
    if (els.profileSaveState) {
      els.profileSaveState.textContent = "已同步";
      els.profileSaveState.dataset.tone = "ok";
    }
  } catch (error) {
    currentUser = previousUser;
    storeAuthSession(authToken, currentUser);
    renderProfile();
    updateAuthChrome();
    const message = error.message || "同步失败，请稍后重试。";
    setAuthStatus(`资料未同步：${message}`, "warn");
    if (els.profileSaveState) {
      els.profileSaveState.textContent = `未同步：${message}`;
      els.profileSaveState.dataset.tone = "warn";
    }
  }
}

function openProfileEditor() {
  if (!currentUser) {
    showAuthView("login", false);
    return;
  }
  switchProfileTab("personal");
  window.setTimeout(() => els.profileUsername?.focus(), 0);
}

async function logout() {
  if (authToken) {
    await fetch("/api/auth/logout", { method: "POST", headers: authHeaders() }).catch(() => {});
  }
  authToken = "";
  currentUser = null;
  localStorage.removeItem(AUTH_SESSION_KEY);
  updateAuthChrome();
  sendHello();
  setAuthStatus("已退出登录。", "ok");
  showAuthView("login");
}

async function restoreAuthSession() {
  loadRememberedLogin();
  const storedSession = readStoredAuthSession();
  if (storedSession) {
    authToken = storedSession.token;
    currentUser = storedSession.user;
    updateAuthChrome();
    hideAuthShell();
  }
  updateAuthChrome();
  if (!authToken) {
    enforceLoginGate();
    return;
  }
  try {
    const response = await fetch("/api/auth/me", { headers: authHeaders() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "session expired");
    storeAuthSession(authToken, data.user);
  } catch {
    authToken = "";
    currentUser = null;
    localStorage.removeItem(AUTH_SESSION_KEY);
    updateAuthChrome();
    enforceLoginGate();
  }
}

function sendHello() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(
    JSON.stringify({
      command: "hello",
      client_id: currentUser ? `user-${currentUser.id}` : collaboratorClientId,
      name: currentUser?.display_name || collaboratorName,
      role: currentUser?.role || "Developer",
    }),
  );
}

function requireDeveloperLogin() {
  if (currentUser) return true;
  setAuthStatus("请先登录或注册测试账号，再进入联机开发协作。", "warn");
  showAuthView("login");
  return false;
}

function agentMarkup(agent) {
  const classes = ["agent", agent.status, selectedAgentId === agent.id ? "selected" : ""].join(" ");
  return `
    <div class="${classes}" data-agent="${agent.id}" style="--x:${agent.x}px;--y:${agent.y}px">
      <div class="agent-label">${agent.name}<b>${statusLabel(agent.status)}</b></div>
      <div class="agent-avatar" style="--agent-color:${escapeHtml(agent.color)}">
        ${agent.crown ? '<div class="agent-crown"></div>' : ""}
        <div class="agent-hair"></div>
        <div class="agent-head"></div>
        <div class="agent-eye agent-eye-left"></div>
        <div class="agent-eye agent-eye-right"></div>
        <div class="agent-body"></div>
        <div class="agent-arm agent-arm-left"></div>
        <div class="agent-arm agent-arm-right"></div>
        <div class="agent-leg agent-leg-left"></div>
        <div class="agent-leg agent-leg-right"></div>
      </div>
    </div>
  `;
}

function statusLabel(status) {
  return {
    idle: "待命",
    walking: "移动中",
    working: "执行中",
    blocked: "阻塞",
    done: "完成",
    assigned: "待接受",
    review: "待审核",
    packaged: "已打包",
    delivery: "待交付",
    delivered: "已交付",
  }[status];
}

function renderAgents() {
  els.agentLayer.innerHTML = agents.map(agentMarkup).join("");
  document.querySelectorAll(".agent").forEach((node) => {
    node.addEventListener("click", () => {
      selectedAgentId = node.dataset.agent;
      renderAgents();
      renderAgentStrip();
      openAgentQuickPanel(agentById(selectedAgentId));
    });
    node.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectedAgentId = node.dataset.agent;
      renderAgents();
      renderAgentStrip();
      openAgentQuickPanel(agentById(selectedAgentId));
    });
  });
}

function openAgentQuickPanel(agent) {
  if (!agent || !els.agentQuickPanel) return;
  if (agent.id === "reviewer") {
    openReviewerDispatchPanel(agent);
    return;
  }
  if (agent.id === "master") {
    const deliveryTask = tasks.find((item) => item.status === "delivery") || tasks.find((item) => item.status === "packaged");
    if (deliveryTask) {
      openMasterDeliveryPanel(agent, deliveryTask);
      return;
    }
    openMasterHistoryPanel(agent);
    return;
  }
  const task = tasks.find((item) => item.owner === agent.id && ["active", "blocked", "pending", "review"].includes(item.status));
  const lines = codeSamples[agent.id] || [];
  const panelWidth = 520;
  const panelHeight = 360;
  const x = Math.max(18, Math.min(agent.x + 72, 1280 - panelWidth));
  const y = Math.max(18, Math.min(agent.y - 86, 600 - panelHeight));

  els.agentQuickPanel.style.setProperty("--quick-x", `${x}px`);
  els.agentQuickPanel.style.setProperty("--quick-y", `${y}px`);
  els.agentQuickKicker.textContent = `${agent.role} / ${statusLabel(agent.status)}`;
  els.agentQuickTitle.textContent = `${agent.name} 的代码速览`;
  els.agentQuickCode.innerHTML = lines
    .map(
      ([code, note], index) => `
        <div class="agent-quick-row">
          <span>${index + 1}</span>
          <code>${escapeHtml(code)}</code>
          <p>${escapeHtml(note)}</p>
        </div>
      `,
    )
    .join("");
  els.agentQuickExplain.innerHTML = `
    <strong>当前任务</strong>
    <p>${escapeHtml(task ? task.title : "暂无任务，等待调度。")}</p>
    <strong>速览模式</strong>
    <p>这里可以直接看这个 Agent 正在写什么、每行代码的意图，以及它和当前业务流的关系。</p>
    <strong>继续深入</strong>
    <p>需要改代码时再进入完整编辑器；不想切页面时，就留在调度中枢查看人物旁边的工作状态。</p>
  `;
  els.agentQuickPanel.classList.add("active");
  els.agentQuickPanel.setAttribute("aria-hidden", "false");
}

function positionAgentQuickPanel(agent, width = 520, height = 360) {
  const x = Math.max(18, Math.min(agent.x + 72, 1280 - width));
  const y = Math.max(18, Math.min(agent.y - 86, 600 - height));
  els.agentQuickPanel.style.setProperty("--quick-x", `${x}px`);
  els.agentQuickPanel.style.setProperty("--quick-y", `${y}px`);
}

function recordMasterTaskHistory(type, title, detail = "") {
  masterTaskHistory.unshift({
    id: `mh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    type,
    title,
    detail,
    time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
  });
  masterTaskHistory = masterTaskHistory.slice(0, 12);
}

function generateMasterRequirementDoc(title, ownerIds = []) {
  const activeRepo = openWorldRepos.find((repo) => repo.id === activeRepoId) || openWorldRepos[0];
  const ownerNames = ownerIds.map((id) => agentById(id)?.name || id).filter(Boolean);
  const spec = inferBusinessSpec(title || "");
  const repoName = activeRepo?.name || activeRepoId || "当前仓库";
  const targets = ownerIds
    .map((id) => {
      const file = bestCodeTargetInRepo(activeRepo, id, title) || activeFileName || "README.md";
      return `${agentById(id)?.name || id} -> ${repoName}/${file}`;
    })
    .join("；");
  return {
    id: `REQ-${Date.now().toString(36).toUpperCase()}`,
    title,
    repoId: activeRepo?.id || activeRepoId,
    repoName,
    owners: ownerIds,
    ownerNames,
    summary: `团队负责人已接收任务，并把需求固化为技术书；代码负责人只能按这份技术书定向启动执行。`,
    scope: `围绕“${title}”完成可运行、可验收的代码变更，不允许脱离当前仓库上下文。`,
    architecture: `当前仓库：${repoName}；领域识别：${spec.entityLabel || "通用业务"}；前端/后端/测试/审查按职责拆分。`,
    acceptance: [
      "每个 Agent 只写入自己职责范围内的文件。",
      "生成结果必须能运行，不能只生成静态说明。",
      "测试 Agent 必须补充验收或烟测入口。",
      "Reviewer 审核通过后才能打包回团队负责人交付。",
    ],
    targets,
  };
}

function renderRequirementDoc(doc) {
  if (!doc) return "暂无技术书。";
  return [
    `技术书编号：${doc.id}`,
    `任务：${doc.title}`,
    `目标仓库：${doc.repoName}`,
    `定向 Agent：${(doc.ownerNames || []).join("、") || "待定"}`,
    `职责文件：${doc.targets || "待代码负责人定位"}`,
    `范围：${doc.scope}`,
    `架构：${doc.architecture}`,
    "验收标准：",
    ...(doc.acceptance || []).map((item) => `- ${item}`),
  ].join("\n");
}

function prependRequirementContext(lines, taskLike = {}, agentName = "Agent", fileName = "") {
  if (!taskLike.requirementDoc) return lines;
  const lower = String(fileName || "").toLowerCase();
  const comment = (text) => {
    if (lower.endsWith(".py") || lower.endsWith(".yml") || lower.endsWith(".yaml") || lower.endsWith(".toml")) return `# ${text}`;
    if (lower.endsWith(".md")) return `> ${text}`;
    if (lower.endsWith(".html")) return `<!-- ${text} -->`;
    return `// ${text}`;
  };
  const header = [
    comment(`QuantumFlow 技术书：${taskLike.requirementDoc.id}`),
    comment(`执行 Agent：${agentName}`),
    comment(`目标文件：${fileName}`),
    comment(`任务范围：${taskLike.requirementDoc.scope}`),
    comment(`验收：${(taskLike.requirementDoc.acceptance || []).join("；")}`),
    "",
  ];
  return [...header, ...lines];
}

function openMasterHistoryPanel(agent) {
  positionAgentQuickPanel(agent, 560, 370);
  const rows = masterTaskHistory.length
    ? masterTaskHistory
        .map(
          (item) => `
        <article class="master-history-item">
          <span>${escapeHtml(item.time)} / ${escapeHtml(item.type)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.detail || "已记录。")}</p>
        </article>
      `,
        )
        .join("")
    : '<div class="reviewer-task-empty">暂无过往任务记录；团队负责人接收、转交、交付后会自动记录在这里。</div>';
  els.agentQuickKicker.textContent = `${agent.role} / 任务记录`;
  els.agentQuickTitle.textContent = "团队负责人的任务记录台";
  els.agentQuickCode.innerHTML = `<div class="master-history-list">${rows}</div>`;
  els.agentQuickExplain.innerHTML = `
    <strong>当前任务</strong>
    <p>${escapeHtml(tasks.find((item) => item.owner === "master")?.title || "暂无团队负责人待处理任务。")}</p>
    <strong>记录范围</strong>
    <p>这里显示团队负责人接收任务、转交代码负责人、收到交付包和最终交付的过往记录。</p>
  `;
  els.agentQuickEditorBtn.textContent = "打开代码区";
  els.agentQuickPanel.classList.add("active", "master-history-mode");
  els.agentQuickPanel.setAttribute("aria-hidden", "false");
}

function openReviewerDispatchPanel(agent) {
  const intakeTasks = tasks.filter((item) => item.owner === "reviewer" && item.reviewerIntake && item.status === "pending");
  const reviewTasks = tasks.filter((item) => item.status === "review");
  const workerTasks = tasks.filter((item) => item.requiresReview && !item.reviewerIntake && ["active", "assigned", "pending", "review", "done"].includes(item.status));
  const candidates = [...intakeTasks, ...workerTasks, ...reviewTasks.filter((item) => !workerTasks.includes(item))];
  const panelWidth = 600;
  const panelHeight = 390;
  const x = Math.max(18, Math.min(agent.x - 500, 1280 - panelWidth));
  const y = Math.max(18, Math.min(agent.y - 120, 600 - panelHeight));

  els.agentQuickPanel.style.setProperty("--quick-x", `${x}px`);
  els.agentQuickPanel.style.setProperty("--quick-y", `${y}px`);
  els.agentQuickKicker.textContent = `${agent.role} / 接收与启动`;
  els.agentQuickTitle.textContent = "代码审查者的任务启动台";
  els.agentQuickCode.innerHTML = `
    <div class="reviewer-dispatch-list">
      <div class="reviewer-dispatch-head"><span>待接收 / 执行中 / 待审核</span><strong>${candidates.length}</strong></div>
      ${
        candidates.length
          ? candidates
              .slice(0, 6)
              .map(
                (task) => `
        <button type="button" class="reviewer-task-choice" data-reviewer-task="${escapeHtml(task.localWorkflowId || task.id)}">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${escapeHtml(task.reviewerIntake ? directedOwnersText(task.suggestedOwners) : agentById(task.owner)?.name || task.owner)} / ${escapeHtml(statusLabel(task.status) || task.status)}</span>
        </button>
      `,
              )
              .join("")
          : '<div class="reviewer-task-empty">暂无团队负责人转交的任务。</div>'
      }
    </div>
  `;
  const selectedIntake =
    intakeTasks.find((task) => String(task.localWorkflowId || task.id) === String(selectedReviewerIntakeKey)) ||
    intakeTasks[0];
  const statusRows = (selectedIntake?.suggestedOwners || ["frontend", "backend", "tester"])
    .map((id) => {
      const task = workerTasks.find((item) => item.owner === id && (!selectedIntake || item.workflowTitle === selectedIntake.workflowTitle || item.workflowId === selectedIntake.workflowId));
      const target = codeTargetForAgent(id, selectedIntake?.workflowTitle || selectedIntake?.title || task?.workflowTitle || task?.title || "");
      return `<div><strong>${escapeHtml(agentById(id)?.name || id)}</strong><span>${escapeHtml(statusLabel(task?.status || agentById(id)?.status || "idle"))} / ${escapeHtml(target[1])}</span></div>`;
    })
    .join("");
  els.agentQuickExplain.innerHTML = `
    <form class="reviewer-dispatch-form" id="reviewerDispatchForm">
      <strong>接收任务</strong>
      <div class="reviewer-directed-card">
        <span>${escapeHtml(selectedIntake ? "团队负责人已定向" : "等待团队负责人")}</span>
        <strong>${escapeHtml(selectedIntake?.title || "暂无待接收任务")}</strong>
        <p>${escapeHtml(selectedIntake ? `执行 Agent：${directedOwnersText(selectedIntake.suggestedOwners)}` : "代码负责人只接收任务；执行对象由团队负责人定向传入。")}</p>
      </div>
      <pre class="requirement-doc-preview">${escapeHtml(renderRequirementDoc(selectedIntake?.requirementDoc))}</pre>
      <div class="reviewer-agent-status">${statusRows}</div>
      <button class="reviewer-dispatch-submit" type="button" data-reviewer-dispatch-submit="${escapeHtml(selectedIntake?.localWorkflowId || selectedIntake?.id || "")}" ${selectedIntake ? "" : "disabled"}>接收任务并一键执行定向 Agent</button>
      <button class="reviewer-review-submit" type="button" data-reviewer-review-submit>审核通过并打包给团队负责人</button>
      <p class="reviewer-dispatch-note" id="reviewerDispatchNote">代码负责人一键启动后，前端、后端、测试会直接写自己的职责文件；这里持续显示当前状态。</p>
    </form>
  `;
  els.agentQuickEditorBtn.textContent = "打开代码区";
  els.agentQuickPanel.classList.add("active", "reviewer-dispatch-mode");
  els.agentQuickPanel.setAttribute("aria-hidden", "false");
}

function openMasterDeliveryPanel(agent, task) {
  positionAgentQuickPanel(agent, 540, 330);
  els.agentQuickKicker.textContent = `${agent.role} / 待交付`;
  els.agentQuickTitle.textContent = "团队负责人的交付台";
  els.agentQuickCode.innerHTML = `
    <div class="worker-accept-card master-delivery-card">
      <span>Reviewer 已审核并打包</span>
      <strong>${escapeHtml(task.title)}</strong>
      <p>代码负责人审核通过后已通知团队负责人，当前等待最终交付。</p>
    </div>
  `;
  els.agentQuickExplain.innerHTML = `
    <div class="worker-accept-actions">
      <strong>交付任务</strong>
      <p>团队负责人确认包内容后完成交付，任务从队列移除。</p>
      <button type="button" data-master-deliver-task="${escapeHtml(task.localWorkflowId || task.id)}">确认交付</button>
    </div>
  `;
  els.agentQuickEditorBtn.textContent = "查看交付代码";
  els.agentQuickPanel.classList.add("active", "master-delivery-mode");
  els.agentQuickPanel.setAttribute("aria-hidden", "false");
}

function closeAgentQuickPanel() {
  els.agentQuickPanel?.classList.remove("active");
  els.agentQuickPanel?.classList.remove("reviewer-dispatch-mode");
  els.agentQuickPanel?.classList.remove("master-delivery-mode");
  els.agentQuickPanel?.classList.remove("master-history-mode");
  els.agentQuickPanel?.setAttribute("aria-hidden", "true");
  if (els.agentQuickEditorBtn) els.agentQuickEditorBtn.textContent = "进入完整编辑器";
}

function openSelectedAgentEditor() {
  const agent = agentById(selectedAgentId);
  closeAgentQuickPanel();
  jumpAgentToCodeArea(agent);
}

function selectedReviewerOwners() {
  return [...document.querySelectorAll("[data-reviewer-owner-toggle][aria-pressed='true']")].map((button) => button.dataset.reviewerOwnerToggle);
}

function directedOwnersText(ownerIds = []) {
  const names = ownerIds.map((id) => agentById(id)?.name || id).filter(Boolean);
  return names.length ? names.join("、") : "暂无定向 Agent";
}

function coreOwnersLabel(ownerIds = []) {
  const normalized = ownerIds.filter((id) => ["frontend", "backend", "tester"].includes(id));
  if (normalized.length === 3) return "默认全流程";
  return `定向 ${directedOwnersText(normalized)}`;
}

function codeTargetForAgent(agentId, title = "") {
  const activeRepo = openWorldRepos.find((repo) => repo.id === activeRepoId) || openWorldRepos[0];
  if (agentId === "tester" && activeRepo) return [activeRepo.id, defaultCodeFileForAgent(activeRepo, "tester")];
  if (agentId === "reviewer" && activeRepo) return [activeRepo.id, defaultCodeFileForAgent(activeRepo, "reviewer")];
  const activeRepoTarget = bestCodeTargetInRepo(activeRepo, agentId, title);
  if (activeRepoTarget) return [activeRepo.id, activeRepoTarget];

  const spec = inferBusinessSpec(title || "");
  const vueTargets = {
    frontend: ["project", "src/App.vue"],
    backend: ["project", "docs/api-assumption.md"],
    tester: ["project", "tests/book.spec.js"],
    reviewer: ["project", "docs/review-checklist.md"],
  };
  const appTargets = {
    frontend: ["project", "app/static/app.js"],
    backend: ["project", "app/main.py"],
    tester: ["project", "tests/test_smoke.py"],
    reviewer: ["project", "docs/review-checklist.md"],
  };
  const fallback = (isVue3FrontendSpec(spec) ? vueTargets : appTargets)[agentId] || appTargets.frontend;
  const fallbackRepo = openWorldRepos.find((repo) => repo.id === fallback[0]);
  if (fallbackRepo) {
    const fallbackFile = bestCodeTargetInRepo(fallbackRepo, agentId, title) || fallback[1];
    return [fallbackRepo.id, fallbackFile];
  }
  return fallback;
}

function bestCodeTargetInRepo(repo, agentId, title = "") {
  if (!repo?.files) return "";
  const files = Object.keys(repo.files);
  if (!files.length) return "";
  const lowerTitle = String(title || "").toLowerCase();
  const scoreFile = (file) => {
    const lower = file.toLowerCase();
    const ext = lower.split(".").pop() || "";
    let score = 0;
    if (/^(\.idea|\.git|node_modules|dist|build|__pycache__)\//.test(lower)) return -100;
    if (/^(\.gitignore|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(lower)) return -80;
    if (/connector_sender|allow_quantumflow|workspace\.xml|modules\.xml|inspectionprofiles/.test(lower)) return -70;
    if (/^(quantumflow-mvp|server\.py|storage\.py|codex_project_index)/.test(lower)) score -= 30;
    if (file === activeFileName) score += 1;
    if (lowerTitle && lowerTitle.split(/\s+|\/|,|，/).some((token) => token.length > 2 && lower.includes(token))) score += 3;
    if (agentId === "frontend") {
      if (["vue", "tsx", "jsx", "js", "ts", "html", "css"].includes(ext)) score += 4;
      if (lower.includes("frontend/") || lower.includes("ui/") || lower.includes("src/") || lower.includes("app.") || lower.includes("index.") || lower.includes("style")) score += 3;
      if (lower.includes("test") || lower.includes("spec") || lower.includes("api") || lower.includes("server")) score -= 4;
    } else if (agentId === "backend") {
      if (["py", "go", "rs", "java"].includes(ext)) score += 4;
      if (["ts", "js"].includes(ext)) score += lower.includes("backend/") || lower.includes("server") || lower.includes("api") ? 3 : 0;
      if (lower.includes("backend/") || lower.includes("server") || lower.includes("api") || lower.includes("route") || lower.includes("connector") || lower.endsWith("main.py")) score += 5;
      if (lower.includes("frontend/") || lower.includes("src/") || lower.includes("style") || lower.endsWith(".css") || lower.endsWith(".html") || lower.endsWith("main.js")) score -= 6;
    } else if (agentId === "tester") {
      if (lower.includes("tests/") || lower.includes("test") || lower.includes("spec") || lower.includes("__tests__")) score += 7;
      if (["py", "js", "ts"].includes(ext)) score += 2;
      if (lower.includes("readme") || lower.includes("review") || lower.endsWith("main.js")) score -= 5;
    } else if (agentId === "reviewer") {
      if (lower.includes("review") || lower.includes("checklist") || lower.includes("readme") || lower.includes("docs/") || lower.includes(".quantumflow/")) score += 6;
      if (["md", "txt"].includes(ext)) score += 2;
      if (lower.includes("test") || lower.includes("spec") || lower.endsWith("main.js")) score -= 4;
    }
    return score;
  };
  const best = files
    .map((file) => ({ file, score: scoreFile(file) }))
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))[0];
  const minimumScore = agentId === "frontend" ? 4 : agentId === "backend" ? 5 : 6;
  return best?.score >= minimumScore ? best.file : defaultCodeFileForAgent(repo, agentId);
}

function defaultCodeFileForAgent(repo, agentId) {
  const files = Object.keys(repo?.files || {});
  const existing = (patterns) => files.find((file) => patterns.some((pattern) => pattern.test(file.toLowerCase())));
  if (agentId === "frontend") return existing([/app\/static\/app\.js$/, /frontend\//, /src\/.*\.(vue|js|ts|jsx|tsx|css)$/, /index\.html$/]) || "app/static/app.js";
  if (agentId === "backend") return existing([/app\/main\.py$/, /backend\//, /server\.(py|js|ts)$/, /api\//, /routes?\//]) || "app/main.py";
  if (agentId === "tester") return existing([/tests?\//, /(test|spec)\.(py|js|ts)$/]) || "tests/test_smoke.py";
  if (agentId === "reviewer") return existing([/review/, /checklist/, /docs\//]) || "docs/review-checklist.md";
  return files[0] || "README.md";
}

function focusAgentCodeTarget(agentId, title = "") {
  const [repoId, fileName] = codeTargetForAgent(agentId, title);
  activeRepoId = repoId;
  activeFileName = fileName;
  ensureRepoFileForAgent(repoId, fileName, agentId, title);
  renderCommunity();
}

function ensureRepoFileForAgent(repoId, fileName, agentId, title = "") {
  const repo = openWorldRepos.find((item) => item.id === repoId);
  if (!repo || repo.files[fileName]) return;
  const kind = agentId === "tester" ? "test" : agentId === "reviewer" ? "doc" : "code";
  repo.files[fileName] = templateForNewRepoFile(fileName, kind, title || `${agentById(agentId)?.name || agentId} 负责文件`, agentId);
  repo.custom = true;
  saveCustomInternalRepos();
}

function stationForOwner(ownerId) {
  return {
    master: [520, 160],
    frontend: [560, 240],
    backend: [995, 255],
    tester: [1185, 160],
    reviewer: [1110, 345],
  }[ownerId] || [520, 160];
}

function createReviewerAssignedTasks(title, ownerIds, requirementDoc = null) {
  const workflowId = `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const createdTasks = [];
  ownerIds.forEach((ownerId) => {
    const owner = agentById(ownerId);
    if (!owner) return;
    const task = {
      id: `local-${localWorkflowTaskSeq++}`,
      localWorkflowId: `${workflowId}-${ownerId}`,
      workflowId,
      workflowTitle: title,
      title: `${title} / ${owner.name}`,
      owner: ownerId,
      station: stationForOwner(ownerId),
      status: "assigned",
      source: "reviewer_dispatch",
      requiresReview: true,
      requirementDoc,
    };
    tasks.push(task);
    createdTasks.push(task);
    setAgent(ownerId, { status: "idle" });
  });
  backendQueueStats = { ...backendQueueStats, pending: tasks.filter((task) => task.status === "pending" || task.status === "assigned").length, running_total: tasks.filter((task) => task.status !== "done" && task.status !== "delivered").length };
  renderAll();
  return createdTasks;
}

function dispatchReviewerTask(taskKey = "") {
  const note = document.getElementById("reviewerDispatchNote");
  const intakeTask =
    findWorkflowTask(taskKey) ||
    tasks.find((task) => task.owner === "reviewer" && task.reviewerIntake && task.status === "pending");
  if (!intakeTask) {
    if (note) note.textContent = "暂无团队负责人定向发来的任务。";
    return;
  }
  const title = intakeTask.workflowTitle || intakeTask.title;
  const owners = (intakeTask.suggestedOwners || []).filter((id) => ["frontend", "backend", "tester"].includes(id));
  if (!owners.length) {
    if (note) note.textContent = "这条任务没有定向执行 Agent，请团队负责人重新发起。";
    return;
  }
  const createdTasks = createReviewerAssignedTasks(title, owners, intakeTask.requirementDoc || null);
  tasks = tasks.filter((task) => task !== intakeTask);
  setAgent("reviewer", { status: "done" });
  const ownerNames = owners.map((id) => agentById(id)?.name || id).join("、");
  addLog(`代码负责人已接收 ${intakeTask.requirementDoc?.id || "技术书"} 并一键执行 ${ownerNames}：${title}`, "代码审查者");
  pushComment("代码审查者", `已按团队负责人技术书一键启动 ${ownerNames}：${title}`);
  selectedReviewerIntakeKey = "";
  createdTasks.forEach((task, index) => {
    window.setTimeout(() => startWorkerTaskFromReviewer(task), index * 320);
  });
  if (note) note.textContent = `已一键启动 ${ownerNames}，正在写入各自职责文件。`;
  renderAll();
  window.setTimeout(() => openReviewerDispatchPanel(agentById("reviewer")), createdTasks.length * 360 + 80);
}

function findWorkflowTask(taskKey) {
  return tasks.find((task) => String(task.localWorkflowId || task.id) === String(taskKey));
}

function startWorkerTaskFromReviewer(task, options = {}) {
  const owner = agentById(task.owner);
  if (!owner) return;
  task.status = "active";
  selectedAgentId = owner.id;
  addLog(`${owner.name} 已由代码负责人启动：${task.workflowTitle || task.title}`, owner.name);
  pushComment(owner.name, `代码负责人已启动我，按技术书开始写入对应代码：${task.workflowTitle || task.title}`);
  if (options.openCode) closeAgentQuickPanel();
  focusAgentCodeTarget(owner.id, task.workflowTitle || task.title || "");
  const targetRepoId = activeRepoId;
  const targetFileName = activeFileName;
  if (options.openCode) {
    switchView("community");
    switchOpenWorldPanel("codePanel");
  }
  setAgent(owner.id, { status: "working", x: task.station?.[0] || owner.x, y: task.station?.[1] || owner.y });
  writeTaskCompletionCode(task, owner);
  renderAll();
  window.setTimeout(() => {
    if (task.status !== "active") return;
    task.status = "review";
    setAgent(owner.id, { status: "done", x: owner.home[0], y: owner.home[1] });
    setAgent("reviewer", { status: "idle", x: agentById("reviewer").home[0], y: agentById("reviewer").home[1] });
    addLog(`代码写入完成，等待 Reviewer 审核：${task.workflowTitle || task.title}`, owner.name);
    pushComment(owner.name, `代码已写入 ${targetRepoId}/${targetFileName}，提交给代码负责人审核。`);
    renderAll();
  }, 4200);
}

function approveReviewerPackage() {
  const reviewTasks = tasks.filter((task) => task.requiresReview && task.status === "review");
  const note = document.getElementById("reviewerDispatchNote");
  if (!reviewTasks.length) {
    if (note) note.textContent = "暂无已完成待审核的任务，等前端/后端/测试执行完成后再打包。";
    return;
  }
  const groupedTitle = reviewTasks[0].workflowTitle || reviewTasks[0].title;
  const packageTask = {
    id: `local-${localWorkflowTaskSeq++}`,
    localWorkflowId: `delivery-${Date.now().toString(36)}`,
    workflowId: reviewTasks[0].workflowId || `delivery-${Date.now().toString(36)}`,
    workflowTitle: groupedTitle,
    title: `交付包：${groupedTitle}`,
    owner: "master",
    station: stationForOwner("master"),
    status: "delivery",
    source: "reviewer_package",
  };
  reviewTasks.forEach((task) => {
    task.status = "packaged";
  });
  tasks.push(packageTask);
  setAgent("reviewer", { status: "done" });
  setAgent("master", { status: "idle" });
  recordMasterTaskHistory("收到交付包", groupedTitle, "代码负责人审核通过并打包，等待团队负责人最终交付。");
  addLog(`Reviewer 审核通过并打包给团队负责人：${groupedTitle}`, "代码审查者");
  pushComment("代码审查者", `代码负责人审核通过，已打包交给团队负责人：${groupedTitle}`);
  if (note) note.textContent = "已审核通过并打包给团队负责人，等待负责人交付。";
  renderAll();
}

function deliverMasterTask(taskKey) {
  const task = findWorkflowTask(taskKey);
  if (!task) return;
  const title = task.workflowTitle || task.title;
  tasks = tasks.filter((item) => item.workflowId !== task.workflowId && item.localWorkflowId !== task.localWorkflowId);
  setAgent("master", { status: "done", x: agentById("master").home[0], y: agentById("master").home[1] });
  recordMasterTaskHistory("最终交付", title, "团队负责人确认交付，任务从执行队列归档。");
  addLog(`团队负责人已交付任务：${title}`, "团队负责人");
  pushComment("团队负责人", `已完成最终交付：${title}`);
  closeAgentQuickPanel();
  renderAll();
}

function jumpAgentToCodeArea(agent) {
  if (!agent) return;
  const activeTask = tasks.find((item) => item.owner === agent.id && ["active", "blocked", "pending", "assigned", "review", "done"].includes(item.status));
  focusAgentCodeTarget(agent.id, activeTask?.workflowTitle || activeTask?.title || "");
  openAutoCodeWorkspace(activeRepoId, activeFileName);
  pushComment(agent.name, `已打开 ${activeFileName} 的自动编码工作区，Agent 会基于当前任务继续生成代码。`);
}

function openCoderStudio(agent) {
  if (!agent) return;
  const task = tasks.find((item) => item.owner === agent.id && ["active", "blocked", "pending"].includes(item.status));
  const lines = codeSamples[agent.id] || [];

  els.studioKicker.textContent = `${agent.role} / ${statusLabel(agent.status)}`;
  els.studioTitle.textContent = `${agent.name} 的可视化编程工作台`;
  els.studioCode.innerHTML = lines
    .map(
      ([code, note], index) => `
      <div class="studio-code-row">
        <span class="studio-line">${index + 1}</span>
        <code>${code}</code>
        <button title="解释这一行">?</button>
        <p>${note}</p>
      </div>
    `,
    )
    .join("");

  els.studioExplain.innerHTML = `
    <p><strong>当前任务</strong>${escapeHtml(task ? task.title : "暂无任务，等待调度。")}</p>
    <p><strong>自动化编程</strong>调度中枢会继续按后端任务状态移动、执行、完成；这个工作台负责展示它正在写什么，以及每行代码为什么这样写。</p>
    <p><strong>讲解模式</strong>点击角色后，这里会跟随角色身份解释代码意图。后续可接入真实 LLM，把实际生成的 patch 逐行解释给你。</p>
    <p><strong>消息反馈</strong>接入企业微信、飞书、微信客服、抖音后，外部消息会变成任务；执行完成后写入反馈队列，再自动回到对应会话。</p>
  `;
  els.coderStudio.classList.add("active");
  els.coderStudio.setAttribute("aria-hidden", "false");
}

function closeCoderStudio() {
  els.coderStudio.classList.remove("active");
  els.coderStudio.setAttribute("aria-hidden", "true");
}

function renderAgentStrip() {
  els.agentStrip.innerHTML = agents
    .map(
      (agent) => `
      <button class="agent-chip" data-agent="${agent.id}">
        <span class="chip-avatar" style="background:${agent.color}"></span>
        <span class="chip-text">
          <strong>${agent.name} / ${agent.role}</strong>
          <span>${statusLabel(agent.status)}${selectedAgentId === agent.id ? " / 当前选中" : ""}</span>
        </span>
      </button>
    `,
    )
    .join("");
  document.querySelectorAll(".agent-chip").forEach((node) => {
    node.addEventListener("click", () => {
      selectedAgentId = node.dataset.agent;
      renderAgents();
      renderAgentStrip();
    });
  });
}

function renderTasks() {
  els.taskCount.textContent = String(tasks.length);
  if (!tasks.length) {
    els.taskList.innerHTML = `
      <div class="task-empty">
        <strong>等待真实任务</strong>
        <span>飞书 / 手动 / Bot 命令进入后会自动进入队列并立即执行。</span>
      </div>
    `;
    bindProjectDeliveryActions();
    renderRuntimeEnvironment();
    renderCommunity();
    return;
  }
  els.taskList.innerHTML = tasks
    .map(
      (task, index) => `
      <div class="task-item ${task.status} ${index === currentTaskIndex ? "active" : ""}" data-task="${index}">
        <strong>${task.title}</strong>
        <div class="task-meta">
          <span>${agentById(task.owner).name} / ${task.source || "desktop"}</span>
          <span>${task.status}</span>
        </div>
        ${
          task.requirementDoc
            ? `<div class="task-requirement-chip"><span>${escapeHtml(task.requirementDoc.id)}</span><em>${escapeHtml(task.reviewerIntake ? `交给代码负责人 / ${directedOwnersText(task.suggestedOwners)}` : `按技术书执行 / ${agentById(task.owner)?.name || task.owner}`)}</em></div>`
            : ""
        }
      </div>
    `,
    )
    .join("");
  document.querySelectorAll(".task-item").forEach((node) => {
    node.addEventListener("click", () => openTaskFromQueue(Number(node.dataset.task)));
  });
  bindProjectDeliveryActions();
  renderRuntimeEnvironment();
  renderCommunity();
}

function openTaskFromQueue(index) {
  const task = tasks[index];
  if (!task) return;
  const owner = agentById(task.owner);
  if (!owner) return;
  selectedAgentId = owner.id;
  if (task.reviewerIntake) {
    selectedReviewerIntakeKey = String(task.localWorkflowId || task.id);
    openReviewerDispatchPanel(agentById("reviewer"));
    return;
  }
  if (task.status === "assigned" || task.status === "pending") {
    focusAgentCodeTarget(owner.id, task.workflowTitle || task.title || "");
    switchView("community");
    switchOpenWorldPanel("codePanel");
    return;
  }
  if (task.status === "active" || task.status === "review") {
    focusAgentCodeTarget(owner.id, task.workflowTitle || task.title || "");
    switchView("community");
    switchOpenWorldPanel("codePanel");
    return;
  }
  openAgentQuickPanel(owner);
}

function bindProjectDeliveryActions() {
  document.querySelectorAll("[data-test-delivery]").forEach((button) => {
    if (button.dataset.boundDeliveryAction === "1") return;
    button.dataset.boundDeliveryAction = "1";
    button.addEventListener("click", () => openDeliveryRuntimeEnvironment(button.dataset.testDelivery));
  });
  document.querySelectorAll("[data-open-delivery]").forEach((button) => {
    if (button.dataset.boundDeliveryAction === "1") return;
    button.dataset.boundDeliveryAction = "1";
    button.addEventListener("click", () => openProjectDeliveryRuntime(button.dataset.openDelivery));
  });
}

function renderProjectDeliveryCards() {
  if (!projectDeliveries.length) return "";
  return `
    <div class="project-delivery-list">
      ${projectDeliveries
        .slice(0, 4)
        .map(
          (delivery) => {
            const testState = deliveryTestStates[delivery.id] || delivery.last_test_status || "";
            const testText = "Agent 测试";
            const testClass = testState ? ` ${testState}` : "";
            const testOutput = deliveryTestStates[`${delivery.id}:output`] || delivery.last_test_output || "";
            const runtimeUrl = deliveryTestStates[`${delivery.id}:url`] || delivery.runtime_url || "";
            return `
        <article class="project-delivery-card${String(delivery.id) === String(getActiveRuntimeDelivery()?.id || "") ? " active" : ""}">
          <div>
            <strong>${escapeHtml(delivery.title || "已完成项目")}</strong>
            <span>${escapeHtml(delivery.validation || "项目已通过基础校验")}</span>
            <em>${escapeHtml(runtimeUrl || (delivery.last_test_at ? `测试：${delivery.last_test_status} / ${delivery.last_test_at}` : delivery.created_at || ""))}</em>
            ${testOutput ? `<small>${escapeHtml(testOutput).slice(0, 180)}</small>` : ""}
          </div>
          <div class="project-delivery-actions">
            <button type="button" class="delivery-test-button${testClass}" data-test-delivery="${escapeHtml(delivery.id)}">${escapeHtml(testText)}</button>
            <button type="button" class="delivery-open-button" data-open-delivery="${escapeHtml(delivery.id)}">打开网页</button>
            <a href="${escapeHtml(delivery.download_url || `/api/project-deliveries/${delivery.id}/download`)}" download>下载项目安装包</a>
          </div>
        </article>
      `;
          },
        )
        .join("")}
    </div>
  `;
}

function getActiveRuntimeDelivery() {
  if (!projectDeliveries.length) return null;
  return projectDeliveries.find((delivery) => String(delivery.id) === String(activeRuntimeDeliveryId)) || projectDeliveries[0];
}

function setActiveRuntimeDelivery(deliveryId) {
  if (!deliveryId) return;
  activeRuntimeDeliveryId = String(deliveryId);
  localStorage.setItem("qfActiveRuntimeDeliveryId", activeRuntimeDeliveryId);
}

function runtimeDeliveryStatus(delivery) {
  if (!delivery) return "等待项目交付";
  const state = deliveryTestStates[delivery.id] || delivery.last_test_status || delivery.runtime_status || "";
  if (state === "testing") return "测试中";
  if (state === "passed" || state === "running") return "环境可运行";
  if (state === "failed") return "需要纠错";
  return "待测试";
}

function renderRuntimeEnvironment() {
  const delivery = getActiveRuntimeDelivery();
  if (els.runtimeQueueMetric) {
    els.runtimeQueueMetric.textContent = `${backendQueueStats.pending || 0}/${backendQueueStats.active || 0}`;
  }
  const setPreview = (url = "") => {
    const hasUrl = Boolean(url);
    if (els.runtimePreviewAddress) els.runtimePreviewAddress.textContent = hasUrl ? url : "等待项目 Web UI 启动";
    if (els.runtimeProjectFrame) {
      if (hasUrl && els.runtimeProjectFrame.src !== url) els.runtimeProjectFrame.src = url;
      els.runtimeProjectFrame.classList.toggle("active", hasUrl);
    }
    els.runtimePreviewEmpty?.classList.toggle("hidden", hasUrl);
    els.runtimePreviewEmpty?.classList.toggle("is-hidden", hasUrl);
    if (els.runtimePreviewRefreshBtn) els.runtimePreviewRefreshBtn.disabled = !hasUrl;
  };
  if (!els.runtimeProjectTitle) {
    setPreview("");
    renderRuntimeRepoTester();
    return;
  }
  if (!delivery) {
    els.runtimeProjectTitle.textContent = "暂无可运行项目";
    els.runtimeProjectStatus.textContent = "等待项目交付";
    els.runtimeProjectOutput.textContent = "项目交付完成后，在这里启动测试环境；中间窗口会直接显示项目网页。";
    setPreview("");
    [els.runtimeProjectTestBtn, els.runtimeProjectOpenBtn, els.runtimeProjectFixBtn].forEach((button) => {
      if (button) button.disabled = true;
    });
    renderRuntimeRepoTester();
    return;
  }
  setActiveRuntimeDelivery(delivery.id);
  const output = deliveryTestStates[`${delivery.id}:output`] || delivery.last_test_output || "";
  const runtimeUrl = deliveryTestStates[`${delivery.id}:url`] || delivery.runtime_url || "";
  els.runtimeProjectTitle.textContent = delivery.title || "已完成项目";
  els.runtimeProjectStatus.textContent = runtimeDeliveryStatus(delivery);
  els.runtimeProjectOutput.textContent = runtimeUrl
    ? `网页地址：${runtimeUrl}${output ? `\n\n${output}` : ""}`
    : output || "还没有启动项目。点击“测试运行环境”会先做接口烟测，点击“打开项目网页”会启动本地 Web UI。";
  setPreview(runtimeUrl);
  if (els.runtimeProjectTestBtn) els.runtimeProjectTestBtn.disabled = deliveryTestStates[delivery.id] === "testing";
  if (els.runtimeProjectOpenBtn) els.runtimeProjectOpenBtn.disabled = false;
  if (els.runtimeProjectFixBtn) els.runtimeProjectFixBtn.disabled = false;
  renderRuntimeRepoTester();
}

function getActiveRuntimeRepo() {
  return openWorldRepos.find((repo) => repo.id === activeRuntimeRepoId) || openWorldRepos.find((repo) => repo.id === activeRepoId) || openWorldRepos[0];
}

function setActiveRuntimeRepo(repoId) {
  if (!repoId) return;
  activeRuntimeRepoId = String(repoId);
  localStorage.setItem("qfActiveRuntimeRepoId", activeRuntimeRepoId);
}

function renderRuntimeRepoTester() {
  if (!els.runtimeRepoSelect || !els.runtimeRepoTestOutput) return;
  const repos = openWorldRepos.filter((repo) => repo && repo.files);
  const activeRepo = getActiveRuntimeRepo();
  els.runtimeRepoSelect.innerHTML = repos
    .map((repo) => `<option value="${escapeHtml(repo.id)}" ${repo.id === activeRepo?.id ? "selected" : ""}>${escapeHtml(repo.name)} / ${escapeHtml(repo.lang || "Code")}</option>`)
    .join("");
  if (activeRepo) setActiveRuntimeRepo(activeRepo.id);
  const state = activeRepo ? runtimeRepoTestStates[activeRepo.id] : null;
  if (!activeRepo) {
    els.runtimeRepoTestOutput.textContent = "暂无可测试仓库。";
    [els.runtimeRepoTestBtn, els.runtimeRepoPreviewBtn, els.runtimeRepoOpenCodeBtn].forEach((button) => {
      if (button) button.disabled = true;
    });
    return;
  }
  if (els.runtimeRepoTestBtn) els.runtimeRepoTestBtn.disabled = state?.status === "testing";
  if (els.runtimeRepoPreviewBtn) els.runtimeRepoPreviewBtn.disabled = false;
  if (els.runtimeRepoOpenCodeBtn) els.runtimeRepoOpenCodeBtn.disabled = false;
  els.runtimeRepoTestOutput.innerHTML = renderRuntimeRepoTestOutput(activeRepo, state);
}

function renderRuntimeRepoTestOutput(repo, state) {
  if (!state) {
    return escapeHtml(`${repo.name} 已选中。点击“测试运行”检查入口文件、测试文件、README、编码和运行脚本。`);
  }
  const statusText = state.status === "passed" ? "通过" : state.status === "testing" ? "测试中" : "发现问题";
  const issueMarkup = state.issues?.length
    ? `<ul>${state.issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>`
    : "<p>未发现阻塞运行的问题。</p>";
  return `
    <strong>${escapeHtml(repo.name)} / ${escapeHtml(statusText)}</strong>
    ${issueMarkup}
    <em>${escapeHtml(state.summary || "")}</em>
  `;
}

function testRuntimeRepo(repoId = activeRuntimeRepoId) {
  const repo = openWorldRepos.find((item) => item.id === repoId) || getActiveRuntimeRepo();
  if (!repo) return;
  setActiveRuntimeRepo(repo.id);
  runtimeRepoTestStates[repo.id] = { status: "testing", summary: "正在检查仓库运行入口和测试问题...", issues: [] };
  renderRuntimeRepoTester();
  window.setTimeout(() => {
    const result = inspectRepoRuntimeIssues(repo);
    runtimeRepoTestStates[repo.id] = result;
    addLog(result.status === "passed" ? `仓库测试通过：${repo.name}` : `仓库测试发现问题：${repo.name}`, "Tester");
    pushComment("测试 Agent", result.summary, result.status === "passed" ? "suggestion" : "issue", `${repo.id}/runtime-test`);
    renderRuntimeRepoTester();
  }, 260);
}

function inspectRepoRuntimeIssues(repo) {
  const files = Object.keys(repo.files || {});
  const joined = files.map((file) => `${file}\n${(repo.files[file] || []).join("\n")}`).join("\n\n");
  const lowerFiles = files.map((file) => file.toLowerCase());
  const issues = [];
  const hasPackageJson = lowerFiles.includes("package.json");
  const hasFrontendEntry = lowerFiles.some((file) => /(^|\/)(src\/main\.(js|ts)|src\/app\.vue|index\.html|app\/static\/app\.js)$/.test(file));
  const hasBackendEntry = lowerFiles.some((file) => /(^|\/)(app\/main\.py|main\.py|server\.py|runtime\/server\.py)$/.test(file));
  const hasTestFile = lowerFiles.some((file) => /(test|spec).*\.(js|ts|py)$/.test(file) || /tests?\//.test(file));
  const hasReadme = lowerFiles.some((file) => file === "readme.md");
  if (!hasFrontendEntry && !hasBackendEntry) issues.push("缺少可识别的前端或后端运行入口。");
  if (hasPackageJson && !/"scripts"\s*:\s*\{[\s\S]*"(dev|start|test)"/.test(joined)) issues.push("package.json 没有 dev/start/test 脚本。");
  if (!hasPackageJson && hasFrontendEntry && !hasBackendEntry && !lowerFiles.includes("app/static/app.js")) issues.push("前端项目缺少 package.json，无法判断如何启动。");
  if (!hasTestFile) issues.push("缺少测试文件，Tester 无法做自动验收。");
  if (!hasReadme) issues.push("缺少 README.md，运行方式和验收口径不清楚。");
  if (looksLikeBrokenEncoding(joined)) issues.push("检测到乱码或编码异常，需要重新保存为 UTF-8。");
  const status = issues.length ? "failed" : "passed";
  return {
    status,
    issues,
    summary: status === "passed"
      ? "运行门禁通过：入口文件、测试文件、README、脚本和编码检查可用。"
      : `运行门禁未通过：发现 ${issues.length} 个问题，建议先在代码区修复后再运行。`,
  };
}

function openRuntimeRepoInCode() {
  const repo = getActiveRuntimeRepo();
  if (!repo) return;
  const firstFile = Object.keys(repo.files || {})[0] || "";
  openAutoCodeWorkspace(repo.id, firstFile);
}

function previewRuntimeRepo(repoId = activeRuntimeRepoId) {
  const repo = openWorldRepos.find((item) => item.id === repoId) || getActiveRuntimeRepo();
  if (!repo || !els.runtimeProjectFrame) return;
  setActiveRuntimeRepo(repo.id);
  const check = inspectRepoRuntimeIssues(repo);
  const preview = buildRuntimeRepoPreview(repo);
  els.runtimeProjectFrame.removeAttribute("src");
  els.runtimeProjectFrame.srcdoc = preview.html;
  els.runtimeProjectFrame.classList.add("active");
  els.runtimePreviewEmpty?.classList.add("hidden", "is-hidden");
  if (els.runtimePreviewAddress) els.runtimePreviewAddress.textContent = `repo://${repo.name}/${preview.source}`;
  runtimeRepoTestStates[repo.id] = {
    status: check.status === "passed" ? "passed" : "preview",
    summary: `已启动仓库预览：${preview.source}。${check.issues.length ? `仍有 ${check.issues.length} 个非阻塞检查项。` : "入口检查通过。"}`,
    issues: check.issues,
  };
  renderRuntimeRepoTester();
}

function buildRuntimeRepoPreview(repo) {
  const files = repo.files || {};
  const fileText = (name) => (files[name] || []).join("\n");
  if (files["index.html"]) {
    return {
      source: "index.html",
      html: ensureRuntimeHtmlDocument(fileText("index.html"), repo.name),
    };
  }
  if (files["src/App.vue"]) {
    const vue = fileText("src/App.vue");
    const template = vue.match(/<template[^>]*>([\s\S]*?)<\/template>/i)?.[1] || "<main><h1>Vue 项目预览</h1><p>未找到 template。</p></main>";
    const style = [
      vue.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] || "",
      fileText("src/style.css"),
    ].filter(Boolean).join("\n");
    return {
      source: "src/App.vue",
      html: wrapRuntimePreviewHtml(repo.name, template, style),
    };
  }
  if (files["app/static/app.js"]) {
    return {
      source: "app/static/app.js",
      html: wrapRuntimePreviewHtml(
        repo.name,
        '<div id="app"></div>',
        runtimeBusinessPreviewStyle(),
        `<script>${fileText("app/static/app.js")}<\/script>`,
      ),
    };
  }
  const scriptEntry = findRuntimeScriptEntry(files);
  if (scriptEntry) {
    return {
      source: scriptEntry,
      html: buildRuntimeCodePreview(repo, scriptEntry),
    };
  }
  const readmeName = Object.keys(files).find((file) => file.toLowerCase() === "readme.md");
  if (readmeName) {
    return {
      source: readmeName,
      html: buildRuntimeDocumentPreview(repo, readmeName),
    };
  }
  const firstReadable = Object.keys(files).find((file) => /\.(md|txt|js|ts|py|json|html|css|vue)$/i.test(file));
  if (firstReadable) {
    return {
      source: firstReadable,
      html: buildRuntimeDocumentPreview(repo, firstReadable),
    };
  }
  return {
    source: "runtime-check",
    html: buildRuntimeEmptyPreview(repo),
  };
}

function ensureRuntimeHtmlDocument(html = "", title = "项目预览") {
  if (/<!doctype|<html[\s>]/i.test(html)) return html;
  return wrapRuntimePreviewHtml(title, html || "<main></main>", "");
}

function findRuntimeScriptEntry(files = {}) {
  const names = Object.keys(files);
  const preferred = [
    "src/main.js",
    "src/index.js",
    "renderer.js",
    "src/renderer.js",
    "main.js",
    "app.js",
    "runtime-check.js",
  ];
  return preferred.find((name) => files[name]) || names.find((name) => /(^|\/)(main|app|renderer|index)\.(js|ts)$/i.test(name));
}

function runtimeFileContent(files = {}, name = "") {
  return normalizeDisplayLines(files[name] || [], name).join("\n");
}

function buildRuntimeCodePreview(repo, entryName) {
  const files = repo.files || {};
  const related = [entryName, "README.md", "package.json"]
    .filter((name, index, list) => files[name] && list.indexOf(name) === index);
  const cards = related.map((name) => runtimeFilePreviewCard(name, runtimeFileContent(files, name))).join("");
  return wrapRuntimePreviewHtml(
    repo.name,
    `<main class="runtime-readable-preview">
      <section class="runtime-readable-hero">
        <span>Repository Preview</span>
        <h1>${escapeHtml(repo.name)}</h1>
        <p>没有发现可直接挂载的网页入口，已切换为代码可读预览。先看入口文件，再进入代码区继续补业务 UI。</p>
      </section>
      <section class="runtime-readable-grid">${cards}</section>
    </main>`,
    runtimeReadablePreviewStyle(),
  );
}

function buildRuntimeDocumentPreview(repo, fileName) {
  const files = repo.files || {};
  const primary = runtimeFilePreviewCard(fileName, runtimeFileContent(files, fileName), true);
  const extras = Object.keys(files)
    .filter((name) => name !== fileName && /\.(js|ts|py|json|md|txt|html|css|vue)$/i.test(name))
    .slice(0, 4)
    .map((name) => runtimeFilePreviewCard(name, runtimeFileContent(files, name)))
    .join("");
  return wrapRuntimePreviewHtml(
    repo.name,
    `<main class="runtime-readable-preview">
      <section class="runtime-readable-hero">
        <span>Document Preview</span>
        <h1>${escapeHtml(repo.name)}</h1>
        <p>当前仓库暂未提供可直接运行的网页入口，先用 UTF-8 文本方式展示仓库内容，避免 Markdown/文档被当 HTML 解析成乱码。</p>
      </section>
      <section class="runtime-readable-grid">${primary}${extras}</section>
    </main>`,
    runtimeReadablePreviewStyle(),
  );
}

function buildRuntimeEmptyPreview(repo) {
  const files = Object.keys(repo.files || {});
  const list = files.length ? files.slice(0, 8).map((file) => `<li>${escapeHtml(file)}</li>`).join("") : "<li>当前仓库还没有文件</li>";
  return wrapRuntimePreviewHtml(
    repo.name,
    `<main class="runtime-readable-preview">
      <section class="runtime-readable-hero">
        <span>Runtime Check</span>
        <h1>暂无可运行入口</h1>
        <p>请补充 index.html、src/App.vue、app/static/app.js，或至少添加 README/代码文件用于预览。</p>
      </section>
      <section class="runtime-readable-card"><h2>当前文件</h2><ul>${list}</ul></section>
    </main>`,
    runtimeReadablePreviewStyle(),
  );
}

function runtimeFilePreviewCard(name, content, primary = false) {
  const safeContent = content.trim() || "这个文件目前没有内容。";
  return `<article class="runtime-readable-card ${primary ? "primary" : ""}">
    <div><span>${escapeHtml(name)}</span><strong>${escapeHtml(fileKindLabel(name))}</strong></div>
    <pre>${escapeHtml(safeContent)}</pre>
  </article>`;
}

function fileKindLabel(name = "") {
  if (/readme|\.md$/i.test(name)) return "文档";
  if (/package\.json$/i.test(name)) return "配置";
  if (/\.(js|ts|vue)$/i.test(name)) return "前端 / 脚本";
  if (/\.py$/i.test(name)) return "后端 / 脚本";
  if (/\.css$/i.test(name)) return "样式";
  return "文件";
}

function runtimeReadablePreviewStyle() {
  return `
    body { background: #eef2f7; color: #162033; }
    .runtime-readable-preview { display: grid; gap: 16px; width: min(1180px, calc(100% - 48px)); margin: 0 auto; padding: 28px 0 40px; }
    .runtime-readable-hero, .runtime-readable-card { border: 1px solid #ccd7e6; border-radius: 10px; background: #fff; box-shadow: 0 16px 34px rgba(31, 45, 70, .08); }
    .runtime-readable-hero { padding: 22px 24px; }
    .runtime-readable-hero span, .runtime-readable-card span { color: #0f8f72; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .runtime-readable-hero h1 { margin: 8px 0 8px; font-size: 30px; }
    .runtime-readable-hero p { margin: 0; color: #58657a; line-height: 1.7; }
    .runtime-readable-grid { display: grid; gap: 14px; }
    .runtime-readable-card { display: grid; gap: 12px; padding: 16px; }
    .runtime-readable-card.primary { border-color: #54bfa7; }
    .runtime-readable-card div { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .runtime-readable-card strong { color: #53627a; font-size: 13px; }
    .runtime-readable-card pre { margin: 0; max-height: 360px; overflow: auto; border: 1px solid #d8e0eb; border-radius: 8px; background: #f8fafc; color: #162033; padding: 14px; font: 13px/1.65 Consolas, "SFMono-Regular", "Microsoft YaHei", monospace; white-space: pre-wrap; word-break: break-word; }
    .runtime-readable-card ul { margin: 0; padding-left: 20px; color: #58657a; line-height: 1.8; }
  `;
}

function runtimeBusinessPreviewStyle() {
  return `
    .business-shell, .oa-shell { display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: 100vh; background: #eef3f8; color: #172033; }
    .business-shell aside, .oa-nav { background: #113451; color: #fff; padding: 18px 14px; display: grid; align-content: start; gap: 10px; }
    .business-shell aside strong, .oa-nav strong { font-size: 18px; margin-bottom: 8px; }
    .business-shell button, .oa-shell button { border: 1px solid #9db6ca; border-radius: 6px; background: #fff; color: #123; padding: 8px 10px; cursor: pointer; }
    .business-shell aside button, .oa-nav button { background: #17496f; color: #e9f7ff; border-color: rgba(255,255,255,.18); text-align: left; }
    .business-shell aside button.active, .oa-nav button.active { background: #1e88c8; }
    .business-shell section, .oa-workbench { padding: 18px 22px; }
    .business-shell header, .oa-workbench header { display: flex; justify-content: space-between; align-items: center; background: #fff; border: 1px solid #c7d6e2; padding: 14px 16px; margin-bottom: 14px; }
    .business-shell h1, .oa-workbench h1 { margin: 0; font-size: 24px; }
    .business-shell nav, .oa-status-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
    .business-shell nav button.active, .oa-status-tabs button.active { background: #1e88c8; color: #fff; }
    .business-grid, .oa-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
    .business-grid article, .oa-grid article { background: #fff; border: 1px solid #c7d6e2; border-radius: 8px; padding: 14px; display: grid; gap: 8px; }
    .business-grid strong, .oa-grid strong { font-size: 18px; }
    .business-grid em, .oa-grid em { color: #0f7f5f; font-style: normal; font-weight: 800; }
  `;
}

function wrapRuntimePreviewHtml(title, body, style = "", script = "") {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #f6f8fb; color: #172033; font-family: Inter, "Microsoft YaHei", Arial, sans-serif; }
      main, #app { min-height: 100vh; }
      ${style}
    </style>
  </head>
  <body>${body}${script}</body>
</html>`;
}

function testerFileForDelivery(delivery = {}) {
  const title = delivery.title || delivery.workflowTitle || "项目交付测试";
  return codeTargetForAgent("tester", title);
}

function openTesterCodeForDelivery(delivery = {}) {
  const [repoId, fileName] = testerFileForDelivery(delivery);
  activeRepoId = repoId;
  activeFileName = fileName;
  selectedAgentId = "tester";
  renderAgents();
  renderAgentStrip();
  renderCommunity();
  switchView("community");
  switchOpenWorldPanel("codePanel");
}

function mapDeliveryTestResultToTesterCode(deliveryId, result = {}) {
  const delivery = result.delivery || projectDeliveries.find((item) => String(item.id) === String(deliveryId)) || {};
  const title = delivery.title || result.title || "项目交付测试";
  const [repoId, fileName] = testerFileForDelivery({ ...delivery, title });
  const repo = openWorldRepos.find((item) => item.id === repoId);
  if (!repo) return;
  const key = codeKey(repoId, fileName);
  const baseLines = generatedCodeOverrides[key] || repo.files[fileName] || buildAgentArtifactLines("tester", { id: deliveryId, title }, fileName);
  const start = "# --- QuantumFlow Agent Test Result ---";
  const end = "# --- End QuantumFlow Agent Test Result ---";
  const jsStart = "// --- QuantumFlow Agent Test Result ---";
  const jsEnd = "// --- End QuantumFlow Agent Test Result ---";
  const markerStart = fileName.endsWith(".js") ? jsStart : start;
  const markerEnd = fileName.endsWith(".js") ? jsEnd : end;
  const cleaned = [];
  let skipping = false;
  for (const line of baseLines) {
    if (line === markerStart) {
      skipping = true;
      continue;
    }
    if (line === markerEnd) {
      skipping = false;
      continue;
    }
    if (!skipping) cleaned.push(line);
  }
  const mapped = {
    delivery_id: String(deliveryId),
    status: result.ok ? "passed" : "failed",
    runtime_url: result.runtime_url || delivery.runtime_url || deliveryTestStates[`${deliveryId}:url`] || "",
    output: result.output || delivery.last_test_output || deliveryTestStates[`${deliveryId}:output`] || "",
    mapped_at: new Date().toLocaleString("zh-CN", { hour12: false }),
  };
  const jsonLines = JSON.stringify(mapped, null, 2).split("\n");
  const block = fileName.endsWith(".js")
    ? [
        "",
        jsStart,
        `const TEST_RUN_RESULT = ${jsonLines[0]}`,
        ...jsonLines.slice(1, -1),
        `${jsonLines[jsonLines.length - 1]};`,
        "console.log(\"QuantumFlow Agent test mapped\", TEST_RUN_RESULT);",
        jsEnd,
      ]
    : [
        "",
        start,
        `TEST_RUN_RESULT = ${jsonLines[0]}`,
        ...jsonLines.slice(1),
        "",
        "def test_quantumflow_agent_test_result_mapped():",
        "    assert TEST_RUN_RESULT[\"delivery_id\"]",
        "    assert TEST_RUN_RESULT[\"status\"] in {\"passed\", \"failed\"}",
        end,
      ];
  generatedCodeOverrides[key] = [...cleaned, ...block];
  activeRepoId = repoId;
  activeFileName = fileName;
  selectedAgentId = "tester";
  pushComment("测试 Agent", `Agent 测试结果已映射到 ${fileName}：${mapped.status}`, mapped.status === "passed" ? "suggestion" : "issue", key);
  renderCommunity();
}

async function testProjectDelivery(deliveryId) {
  if (!deliveryId) return;
  setActiveRuntimeDelivery(deliveryId);
  const activeDelivery = getActiveRuntimeDelivery() || projectDeliveries.find((item) => String(item.id) === String(deliveryId)) || {};
  openTesterCodeForDelivery(activeDelivery);
  deliveryTestStates[deliveryId] = "testing";
  deliveryTestStates[`${deliveryId}:output`] = "正在启动测试环境并执行烟测...";
  mapDeliveryTestResultToTesterCode(deliveryId, { delivery: activeDelivery, ok: false, output: "正在启动测试环境并执行烟测..." });
  renderTasks();
  renderRuntimeEnvironment();
  try {
    const response = await fetch(`/api/project-deliveries/${encodeURIComponent(deliveryId)}/test`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "测试失败");
    const delivery = data.delivery || {};
    deliveryTestStates[deliveryId] = data.ok ? "passed" : "failed";
    deliveryTestStates[`${deliveryId}:output`] = data.output || delivery.last_test_output || "";
    if (data.runtime_url || delivery.runtime_url) deliveryTestStates[`${deliveryId}:url`] = data.runtime_url || delivery.runtime_url;
    projectDeliveries = projectDeliveries.map((item) => (String(item.id) === String(deliveryId) ? { ...item, ...delivery } : item));
    mapDeliveryTestResultToTesterCode(deliveryId, { ...data, delivery });
    addLog(data.ok ? "项目运行环境测试通过。" : "项目运行环境测试失败。", "Tester");
  } catch (error) {
    deliveryTestStates[deliveryId] = "failed";
    deliveryTestStates[`${deliveryId}:output`] = error.message || "测试失败";
    mapDeliveryTestResultToTesterCode(deliveryId, { delivery: activeDelivery, ok: false, output: error.message || "测试失败" });
    addLog(`项目运行环境测试失败：${error.message || "unknown"}`, "Tester");
  }
  renderTasks();
  renderRuntimeEnvironment();
}

function openDeliveryRuntimeEnvironment(deliveryId) {
  if (deliveryId) setActiveRuntimeDelivery(deliveryId);
  renderRuntimeEnvironment();
  switchView("runtimeEnvironment");
}

async function openProjectDeliveryRuntime(deliveryId, options = {}) {
  if (!deliveryId) return;
  setActiveRuntimeDelivery(deliveryId);
  deliveryTestStates[`${deliveryId}:output`] = "正在启动项目 Web UI...";
  renderRuntimeEnvironment();
  try {
    const response = await fetch(`/api/project-deliveries/${encodeURIComponent(deliveryId)}/run`, { method: "POST" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.detail || data.output || "启动项目失败");
    const delivery = data.delivery || {};
    const runtimeUrl = data.url || delivery.runtime_url || "";
    if (runtimeUrl) deliveryTestStates[`${deliveryId}:url`] = runtimeUrl;
    deliveryTestStates[deliveryId] = data.status || "running";
    deliveryTestStates[`${deliveryId}:output`] = data.output || "项目 Web UI 已启动。";
    projectDeliveries = projectDeliveries.map((item) => (String(item.id) === String(deliveryId) ? { ...item, ...delivery, runtime_url: runtimeUrl } : item));
    renderTasks();
    renderRuntimeEnvironment();
    if (runtimeUrl && options.openExternal !== false) {
      if (window.quantumflowDesktop?.openExternal) {
        await window.quantumflowDesktop.openExternal(runtimeUrl);
      } else {
        window.open(runtimeUrl, "_blank", "noopener");
      }
    }
  } catch (error) {
    deliveryTestStates[deliveryId] = "failed";
    deliveryTestStates[`${deliveryId}:output`] = error.message || "启动项目失败";
    addLog(`项目 Web UI 启动失败：${error.message || "unknown"}`, "Tester");
    renderTasks();
    renderRuntimeEnvironment();
  }
}

async function requestProjectDeliveryFix(deliveryId) {
  if (!deliveryId) return;
  setActiveRuntimeDelivery(deliveryId);
  try {
    const response = await fetch(`/api/project-deliveries/${encodeURIComponent(deliveryId)}/fix`, { method: "POST" });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.detail || "创建纠错任务失败");
    addLog("已把运行失败日志送回 Agent 纠错。", "Master");
    if (data.snapshot) applySnapshot(data.snapshot);
  } catch (error) {
    addLog(`创建纠错任务失败：${error.message || "unknown"}`, "Master");
  }
  renderRuntimeEnvironment();
}

function renderCommunity() {
  if (!els.communityIssues || !els.repoList || !els.liveComments) return;
  const activeRepo = openWorldRepos.find((repo) => repo.id === activeRepoId) || openWorldRepos[0];
  const fileNames = Object.keys(activeRepo.files);
  if (!activeRepo.files[activeFileName]) activeFileName = fileNames[0];
  const repoCodeScrollTop = els.repoCodeView?.scrollTop || 0;
  const repoCodeShouldFollow = isRepoCodeNearBottom();

  const onlineRows = realOnlineCollaboratorRows();
  els.onlineCount.textContent = String(onlineRows.length);
  els.onlineMiniCount.textContent = String(onlineRows.length);
  els.worldTaskCount.textContent = String(tasks.filter((task) => task.status !== "done").length);

  const repoRows = openWorldRepos.filter((repo) => {
    const query = repoInlineQuery.trim().toLowerCase();
    if (!query) return true;
    return `${repo.name} ${repo.desc} ${repo.lang} ${Object.keys(repo.files || {}).join(" ")}`.toLowerCase().includes(query);
  });
  const repoMarkup = (repo) => `
      <button class="repo-list-item ${repo.id === activeRepoId ? "active" : ""}" data-repo="${repo.id}">
        <strong>${repo.name}</strong>
        <span>${repo.desc}</span>
        <em>${repo.lang} / ${Object.keys(repo.files || {}).length} files${repo.custom ? " / local" : ""}</em>
      </button>
    `;

  els.repoList.innerHTML = repoRows.length
    ? repoRows
    .map(
      (repo) => repoMarkup(repo),
    )
      .join("")
    : '<div class="profile-empty">没有匹配的内部仓库。</div>';

  if (els.repoWindowList) {
    els.repoWindowList.innerHTML = repoRows
      .map(
        (repo) => repoMarkup(repo),
      )
      .join("");
  }
  if (els.repoInlineList) {
    els.repoInlineList.innerHTML = repoRows.length
      ? repoRows
      .map(
        (repo) => repoMarkup(repo),
      )
          .join("")
      : '<div class="profile-empty">没有匹配的内部仓库。</div>';
  }
  renderRepoDetail(activeRepo);

  renderSourceOnlineCollaborators(onlineRows);

  els.activeRepoName.textContent = activeRepo.name;
  els.fileTree.innerHTML = fileNames
    .map(
      (file) => `
      <button class="file-item ${file === activeFileName ? "active" : ""}" data-file="${file}">
        <span>${file.includes(".") ? "FILE" : "DIR"}</span>
        <strong>${file}</strong>
      </button>
    `,
    )
    .join("");

  els.activeFileName.textContent = activeFileName;
  const codeLines = codeForActiveFile(activeRepo, activeFileName);
  els.repoCodeView.innerHTML = renderCodeLines(codeLines, activeFileName);
  restoreRepoCodeScroll(repoCodeScrollTop, repoCodeShouldFollow);
  if (els.manualCodeEditor && !els.manualCodeEditor.classList.contains("active")) {
    els.manualCodeEditor.value = codeLines.join("\n");
  }
  renderAutoAgentCodeTargets(activeRepo);

  const fallbackIssues = tasks
    .slice(-8)
    .reverse()
    .map((task) => ({
      title: task.title,
      status: task.status,
      source: task.source || "desktop",
      owner: agentById(task.owner)?.name || task.owner,
    }));
  const issueItems = [...manualIssues, ...externalIssues, ...fallbackIssues].slice(0, 16);

  els.communityIssues.innerHTML = issueItems.map(renderIssueItem).join("");

  if (els.issueWindowList) {
    els.issueWindowList.innerHTML = issueItems.map(renderIssueItem).join("");
  }
  if (els.issueInlineList) {
    els.issueInlineList.innerHTML = issueItems.map(renderIssueItem).join("");
  }

  renderLiveComments();
  renderCaptainVotes();

  document.querySelectorAll(".repo-list-item").forEach((button) => {
    button.addEventListener("click", () => {
      activeRepoId = button.dataset.repo;
      activeFileName = Object.keys(openWorldRepos.find((repo) => repo.id === activeRepoId).files)[0];
      closeToolWindow("repositoriesWindow");
      renderCommunity();
    });
  });

  document.querySelectorAll(".file-item").forEach((button) => {
    button.addEventListener("click", () => {
      activeFileName = button.dataset.file;
      renderCommunity();
    });
  });
  document.querySelectorAll("[data-repo-open-file]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.repoOpenId) activeRepoId = button.dataset.repoOpenId;
      activeFileName = button.dataset.repoOpenFile;
      switchOpenWorldPanel("codePanel");
      renderCommunity();
    });
  });
  document.querySelectorAll("[data-repo-new-file]").forEach((button) => {
    button.addEventListener("click", () => openInternalRepoFileCreateForm(button.dataset.repoNewFile));
  });
  document.querySelectorAll("[data-repo-clone]").forEach((button) => {
    button.addEventListener("click", () => {
      const repo = openWorldRepos.find((item) => item.id === button.dataset.repoClone);
      addLog(`已创建仓库拉取任务：${repo?.name || button.dataset.repoClone}`, "Git Bridge");
    });
  });
  bindIssueActions();
}

function renderAutoAgentCodeTargets(repo) {
  if (!repo) return;
  document.querySelectorAll("[data-auto-agent]").forEach((button) => {
    const agentId = button.dataset.autoAgent;
    const target = bestCodeTargetInRepo(repo, agentId) || activeFileName;
    const label = agentId === "frontend" ? "界面" : agentId === "backend" ? "接口" : agentId === "tester" ? "验收" : "Review";
    const span = button.querySelector("span");
    if (span) span.textContent = `${label} / ${target}`;
    button.title = `在当前仓库打开 ${target}`;
  });
}

function renderRepoDetail(repo) {
  if (!els.repoDetailPanel || !repo) return;
  const files = Object.keys(repo.files || {});
  const relatedTasks = tasks.filter((task) => task.repo === repo.id || task.owner === repo.id || String(task.title || "").toLowerCase().includes(repo.name.toLowerCase().split("-")[0]));
  els.repoDetailPanel.innerHTML = `
    <section class="repo-detail-hero">
      <div>
        <span>QuantumFlow / ${escapeHtml(repo.id)}</span>
        <h3>${escapeHtml(repo.name)}</h3>
        <p>${escapeHtml(repo.desc)}</p>
      </div>
      <div class="repo-detail-actions">
        <button type="button" data-world-panel-target="codePanel">打开代码</button>
        <button type="button" data-repo-new-file="${escapeHtml(repo.id)}">新建文件</button>
        <button type="button" data-repo-clone="${escapeHtml(repo.id)}">拉取</button>
      </div>
    </section>
    <div class="repo-detail-stats">
      <article><strong>${escapeHtml(repo.frontendLang || repo.lang || "-")}</strong><span>前端语言</span></article>
      <article><strong>${escapeHtml(repo.backendLang || "-")}</strong><span>后端语言</span></article>
      <article><strong>${escapeHtml(repo.database || "SQLite")}</strong><span>数据库</span></article>
      <article><strong>${files.length}</strong><span>文件</span></article>
    </div>
    <section class="repo-file-preview">
      <div class="qf-panel-head"><h3>仓库文件</h3><span>点击文件会切到代码区查看</span></div>
      <div class="repo-file-grid">
        ${files
          .map(
            (file) => `
          <button type="button" data-repo-open-file="${escapeHtml(file)}" data-repo-open-id="${escapeHtml(repo.id)}">
            <strong>${escapeHtml(file)}</strong>
            <span>${escapeHtml(summarizeFilePreview(repo.files[file], file))}</span>
          </button>
        `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function createInternalRepo(event) {
  event.preventDefault();
  const name = els.repoCreateName?.value.trim();
  if (!name) return;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `repo-${Date.now().toString(36)}`;
  const uniqueId = openWorldRepos.some((repo) => repo.id === id) ? `${id}-${Date.now().toString(36).slice(-4)}` : id;
  const desc = els.repoCreateDesc?.value.trim() || "QuantumFlow 内部协作仓库";
  const repoType = els.repoCreateType?.value || "fullstack";
  const frontendLang = els.repoCreateFrontendLang?.value || "Vue 3";
  const backendLang = els.repoCreateBackendLang?.value || "Python / FastAPI";
  const database = els.repoCreateDatabase?.value || "SQLite";
  const visibility = els.repoCreateVisibility?.value || "internal";
  const template = els.repoCreateTemplate?.value || "readme";
  const lang = [frontendLang !== "None" ? frontendLang : "", backendLang !== "None" ? backendLang : ""].filter(Boolean).join(" / ") || "Code";
  const repoConfig = { name, type: repoType, frontendLang, backendLang, database, visibility, template, createdBy: currentUser?.username || "local" };
  openWorldRepos.unshift({
    id: uniqueId,
    name,
    desc,
    lang,
    frontendLang,
    backendLang,
    database,
    repoType,
    visibility,
    stars: 0,
    custom: true,
    files: initialInternalRepoFiles(name, desc, repoConfig),
  });
  activeRepoId = uniqueId;
  activeFileName = "README.md";
  if (els.repoCreateName) els.repoCreateName.value = "";
  if (els.repoCreateDesc) els.repoCreateDesc.value = "";
  if (els.repoCreateType) els.repoCreateType.value = "fullstack";
  if (els.repoCreateFrontendLang) els.repoCreateFrontendLang.value = "Vue 3";
  if (els.repoCreateBackendLang) els.repoCreateBackendLang.value = "Python / FastAPI";
  if (els.repoCreateDatabase) els.repoCreateDatabase.value = "SQLite";
  if (els.repoCreateVisibility) els.repoCreateVisibility.value = "internal";
  if (els.repoCreateTemplate) els.repoCreateTemplate.value = "readme";
  addLog(`新建内部仓库：${name}`, currentUser?.display_name || "你");
  saveCustomInternalRepos();
  switchOpenWorldPanel("repositoriesPanel");
  renderCommunity();
}

function initialInternalRepoFiles(name, desc, config) {
  const files = {
    "README.md": [
      `# ${name}`,
      "",
      desc,
      "",
      "## 技术栈",
      "",
      `- 仓库类型：${config.type}`,
      `- 前端语言：${config.frontendLang}`,
      `- 后端语言：${config.backendLang}`,
      `- 数据库：${config.database}`,
      `- 可见性：${config.visibility}`,
      "",
      "## 目录说明",
      "",
      "- `frontend/`：前端页面、组件和样式。",
      "- `backend/`：后端 API、服务和业务逻辑。",
      "- `database/`：数据库迁移、种子数据和连接说明。",
      "- `docs/`：需求、接口、验收和发布记录。",
    ],
    ".quantumflow/repo.json": [JSON.stringify(config, null, 2)],
    "docs/requirements.md": ["# 需求说明", "", "- 目标用户：", "- 核心功能：", "- 验收标准："],
  };
  if (["fullstack", "frontend"].includes(config.template)) {
    files["frontend/README.md"] = [`# ${config.frontendLang} 前端`, "", "这里放页面、组件、路由和样式。"];
  }
  if (["fullstack", "backend"].includes(config.template)) {
    files["backend/README.md"] = [`# ${config.backendLang} 后端`, "", "这里放 API、服务、鉴权和任务处理逻辑。"];
  }
  if (config.database !== "None") {
    files["database/README.md"] = [`# ${config.database} 数据库`, "", "默认使用当前 QuantumFlow 本地数据库方案。"];
  }
  if (config.template === "connector") {
    files["connector/webhook.md"] = ["# Connector / Webhook", "", "- 事件入口：", "- 签名校验：", "- 回调响应："];
  }
  return files;
}

function slugForDeliveryRepo(value) {
  const ascii = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
  return ascii || `task-${Date.now().toString(36)}`;
}

function ensureAgentDeliveryRepo(task, plan = []) {
  const key = taskDeliveryKey(task) || Date.now().toString(36);
  const baseId = `agent-delivery-${slugForDeliveryRepo(`${task.title || task.workflowTitle || "task"}-${key}`)}`;
  const existing = task.deliveryRepoId ? openWorldRepos.find((repo) => repo.id === task.deliveryRepoId) : openWorldRepos.find((repo) => repo.id === baseId);
  if (existing) {
    task.deliveryRepoId = existing.id;
    const createdFiles = plan.filter((item) => ensureAgentDeliveryFile(existing, item.fileName, item.agent?.id || item.agentId || "master")).length;
    if (createdFiles) saveCustomInternalRepos();
    return existing;
  }
  const title = String(task.workflowTitle || task.title || "Agent 交付任务").trim();
  const repo = {
    id: openWorldRepos.some((item) => item.id === baseId) ? `${baseId}-${Date.now().toString(36).slice(-4)}` : baseId,
    name: `agent-delivery-${slugForDeliveryRepo(title)}`,
    desc: `自动编码任务交付仓库：${title}`,
    lang: inferBusinessSpec(title).framework === "vue3" ? "Vue 3" : "Agent Code",
    stars: 0,
    custom: true,
    delivery: true,
    taskKey: key,
    files: {
      ".quantumflow/task.json": [
        JSON.stringify(
          {
            task: title,
            taskKey: key,
            createdAt: new Date().toISOString(),
            mode: "auto-code",
          },
          null,
          2,
        ),
      ],
    },
  };
  plan.forEach((item) => ensureAgentDeliveryFile(repo, item.fileName, item.agent?.id || item.agentId || "master"));
  openWorldRepos.unshift(repo);
  task.deliveryRepoId = repo.id;
  saveCustomInternalRepos();
  addLog(`自动编码已创建新仓库：${repo.name}`, "Repository");
  pushComment("Repository", `已为任务《${title}》创建新仓库 ${repo.name}，接下来会先建文件再流式写代码。`, "suggestion", `${repo.id}/.quantumflow/task.json`);
  return repo;
}

function ensureAgentDeliveryFile(repo, fileName, agentId = "master") {
  if (!repo || !fileName || repo.files[fileName]) return false;
  repo.files[fileName] = [`// ${agentById(agentId)?.name || agentId} 正在准备写入 ${fileName}`];
  pushComment("Repository", `已在 ${repo.name} 创建文件：${fileName}`, "suggestion", `${repo.id}/${fileName}`);
  return true;
}

function openAutoCodeWorkspace(repoId, fileName) {
  if (repoId) activeRepoId = repoId;
  if (fileName) activeFileName = fileName;
  switchView("community");
  switchOpenWorldPanel("codePanel");
  switchCodingMode("auto");
  renderCommunity();
}

function templateForNewRepoFile(fileName, kind, purpose, agentId) {
  const agentName = agentById(agentId)?.name || agentId || "Agent";
  const note = purpose || "TODO: 描述这个文件的职责。";
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (kind === "doc" || ext === "md") {
    return [`# ${fileName}`, "", `> 负责人：${agentName}`, "", "## 用途", note, "", "## 待办", "- [ ] 补充详细说明", "- [ ] 关联任务或验收标准"];
  }
  if (kind === "test" || fileName.includes("test") || fileName.includes("spec")) {
    if (ext === "py") {
      return [`\"\"\"${note}\"\"\"`, "", "", "def test_placeholder():", "    assert True"];
    }
    return [`// ${note}`, `// Owner: ${agentName}`, "", "describe(\"new file\", () => {", "  it(\"has a placeholder test\", () => {", "    expect(true).toBe(true);", "  });", "});"];
  }
  if (kind === "config" || ["json", "yaml", "yml", "toml"].includes(ext)) {
    if (ext === "json") return ["{", `  \"owner\": \"${agentName}\",`, `  \"purpose\": \"${note.replace(/"/g, "\\\"")}\"`, "}"];
    return [`# Owner: ${agentName}`, `# Purpose: ${note}`, "enabled: true"];
  }
  if (ext === "py") {
    return [`\"\"\"${note}\"\"\"`, "", "", "def main():", "    pass", "", "", "if __name__ == \"__main__\":", "    main()"];
  }
  if (["js", "ts", "jsx", "tsx"].includes(ext)) {
    return [`// ${note}`, `// Owner: ${agentName}`, "", "export function run() {", "  return true;", "}"];
  }
  return [`// ${note}`, `// Owner: ${agentName}`, ""];
}

function createInternalRepoFile(event) {
  event.preventDefault();
  const repo = openWorldRepos.find((item) => item.id === activeRepoId);
  if (!repo) return;
  const fileName = String(els.repoFileCreateName?.value || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!fileName || fileName.includes("..") || fileName.endsWith("/")) {
    addLog("新建文件失败：请填写有效文件路径。", "Repository");
    return;
  }
  if (repo.files[fileName]) {
    addLog(`新建文件失败：${fileName} 已存在。`, "Repository");
    return;
  }
  const kind = els.repoFileCreateKind?.value || "code";
  const agentId = els.repoFileCreateAgent?.value || selectedAgentId || "frontend";
  const purpose = els.repoFileCreatePurpose?.value.trim() || "";
  const fileBody = els.repoFileCreateBody?.value.trim() || "";
  const shouldOpenCode = els.repoFileCreateOpen?.checked !== false;
  repo.files[fileName] = fileBody ? fileBody.split("\n") : templateForNewRepoFile(fileName, kind, purpose, agentId);
  repo.custom = true;
  activeRepoId = repo.id;
  activeFileName = fileName;
  saveCustomInternalRepos();
  addLog(`仓库 ${repo.name} 新增文件：${fileName}，交给 ${agentById(agentId)?.name || agentId} 维护`, currentUser?.display_name || "你");
  els.repoFileCreateForm?.reset();
  if (els.repoFileCreateOpen) els.repoFileCreateOpen.checked = true;
  switchOpenWorldPanel(shouldOpenCode ? "codePanel" : "repositoriesPanel");
  renderCommunity();
}

function isRepoCodeNearBottom(threshold = 80) {
  if (!els.repoCodeView) return false;
  const remaining = els.repoCodeView.scrollHeight - els.repoCodeView.clientHeight - els.repoCodeView.scrollTop;
  return remaining <= threshold;
}

function restoreRepoCodeScroll(previousTop, shouldFollow) {
  if (!els.repoCodeView) return;
  if (shouldFollow) {
    els.repoCodeView.scrollTop = els.repoCodeView.scrollHeight;
    return;
  }
  const maxTop = Math.max(0, els.repoCodeView.scrollHeight - els.repoCodeView.clientHeight);
  els.repoCodeView.scrollTop = Math.min(previousTop, maxTop);
}

function renderIssueItem(issue) {
  const status = issue.status || "open";
  const canDecide = issue.id && !["active", "queued"].includes(status);
  const actionLabel = ["done", "rejected"].includes(status) ? "再次执行" : "选择执行";
  return `
    <div class="issue-item issue-status-${status}">
      <div class="issue-main">
        <strong>${escapeHtml(issue.title || "未命名任务")}</strong>
        <span>${escapeHtml(issue.owner || issue.source || "desktop")} / ${escapeHtml(issue.source || "desktop")} / ${escapeHtml(status)}</span>
      </div>
      ${
        canDecide
          ? `<div class="issue-actions">
              <button type="button" data-issue-execute="${issue.id}">${actionLabel}</button>
              <button type="button" data-issue-reject="${issue.id}">拒绝执行</button>
            </div>`
          : status === "rejected"
            ? '<em>已驳回</em>'
            : '<em>已进入队列</em>'
      }
    </div>
  `;
}

function describeIssueFromKeywords() {
  const keywords = els.issueKeywordInput?.value.trim() || "";
  const file = els.issueFileInput?.files?.[0];
  const owner = els.issueAgentSelect?.value || "master";
  const agentName = agentById(owner)?.name || "前端 Agent";
  const normalized = keywords || "补充当前系统功能";
  const fileText = file ? `\n关联文件：${file.name}，需要 Agent 阅读文件上下文后再执行。` : "";
  const description = [
    `任务目标：根据关键词「${normalized}」整理并实现需求。`,
    `执行 Agent：${agentName}。`,
    "执行要求：先判断前后端/测试/审查归属，再写入可运行代码；不能让当前页面报错。",
    "验收标准：功能可进入任务队列，Agent 执行后能在源文明代码区看到产物，并进入 Review。",
    fileText,
  ]
    .filter(Boolean)
    .join("\n");
  if (els.issueDescriptionInput) els.issueDescriptionInput.value = description;
  return description;
}

async function submitManualIssue(event) {
  event.preventDefault();
  if (!requireDeveloperLogin()) return;
  const description = els.issueDescriptionInput?.value.trim() || describeIssueFromKeywords();
  const keywords = els.issueKeywordInput?.value.trim() || "手动任务";
  const owner = els.issueAgentSelect?.value || "master";
  const title = `${agentById(owner)?.id || owner} ${keywords}`.trim();
  const file = els.issueFileInput?.files?.[0];
  const finalTitle = file ? `${title} / file:${file.name}` : title;
  manualIssues.unshift({
    title: finalTitle,
    status: "queued",
    source: "manual",
    owner: agentById(owner)?.name || owner,
  });
  pushComment("任务生成器", description, "issue", "manual-issue");
  await createTask(description || finalTitle, owner);
  if (els.issueKeywordInput) els.issueKeywordInput.value = "";
  if (els.issueDescriptionInput) els.issueDescriptionInput.value = "";
  if (els.issueFileInput) els.issueFileInput.value = "";
  renderCommunity();
}

function bindIssueActions() {
  document.querySelectorAll("[data-issue-execute]").forEach((button) => {
    button.addEventListener("click", () => executeIssue(Number(button.dataset.issueExecute), button));
  });
  document.querySelectorAll("[data-issue-reject]").forEach((button) => {
    button.addEventListener("click", () => rejectIssue(Number(button.dataset.issueReject)));
  });
}

function codeKey(repoId = activeRepoId, fileName = activeFileName) {
  return `${repoId}/${fileName}`;
}

function codeForActiveFile(repo, fileName) {
  const override = generatedCodeOverrides[codeKey(repo.id, fileName)];
  if (override) return override;

  const base = repo.files[fileName] || [];
  const taskLines = tasks
    .filter((task) => task.status !== "done")
    .slice(-4)
    .map((task) => `// task: ${task.title} | owner=${task.owner} | source=${task.source || "desktop"}`);

  if (!taskLines.length) return base;
  return [...base, "", "// 自动任务上下文", ...taskLines];
}

function renderCodeLines(lines, fileName = "") {
  const language = fileName.endsWith(".py") ? "python" : fileName.endsWith(".js") ? "javascript" : "plain";
  const activeKey = codeKey(activeRepoId, activeFileName);
  return normalizeDisplayLines(lines, fileName)
    .map((line, index) => {
      const lineNumber = String(index + 1).padStart(2, "0");
      const streaming = streamingCodeKey === activeKey && streamingCodeLineIndex === index;
      return `<div class="code-line ${streaming ? "streaming" : ""}"><span class="code-line-number">${lineNumber}</span><span class="code-line-source">${highlightCode(line, language)}</span></div>`;
    })
    .join("");
}

function highlightCode(line, language) {
  const text = normalizeDisplayText(line);
  if (!text) return "&nbsp;";
  const tokenPattern = /(\/\/.*|#.*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][\w]*\b)/g;
  const pythonKeywords = new Set(["from", "import", "class", "def", "return", "with", "as", "if", "else", "elif", "for", "while", "try", "except", "None", "True", "False", "async", "await", "in", "and", "or", "not"]);
  const jsKeywords = new Set(["const", "let", "var", "function", "return", "if", "else", "for", "while", "await", "async", "import", "from", "export", "class", "new", "true", "false", "null"]);
  const keywords = language === "python" ? pythonKeywords : jsKeywords;
  const symbols = new Set(["self", "app", "runtime", "task", "owner", "status", "title", "source", "client", "response", "payload"]);
  let cursor = 0;
  let html = "";
  for (const match of text.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index || 0;
    html += escapeHtml(text.slice(cursor, index));
    let className = "";
    if (token.startsWith("//") || token.startsWith("#")) className = "tok-comment";
    else if (token.startsWith("\"") || token.startsWith("'")) className = "tok-string";
    else if (/^\d/.test(token)) className = "tok-number";
    else if (keywords.has(token)) className = "tok-keyword";
    else if (symbols.has(token)) className = "tok-symbol";
    html += className ? `<span class="${className}">${escapeHtml(token)}</span>` : escapeHtml(token);
    cursor = index + token.length;
    if (className === "tok-comment") break;
  }
  html += escapeHtml(text.slice(cursor));
  return html || "&nbsp;";
}

function summarizeFilePreview(lines, fileName = "") {
  const previewLines = normalizeDisplayLines(lines || [], fileName).filter((line) => String(line).trim()).slice(0, 2);
  return previewLines.join(" / ") || "空文件";
}

function normalizeDisplayLines(lines, fileName = "") {
  const source = Array.isArray(lines) ? lines : String(lines || "").split("\n");
  return source.map((line) => normalizeDisplayText(line, fileName));
}

function normalizeDisplayText(value, fileName = "") {
  const text = String(value ?? "");
  if (!text) return "";
  const repaired = repairLatin1Mojibake(text);
  if (!looksLikeBrokenEncoding(repaired)) return repaired;
  if (isMarkdownLikeFile(fileName) && countBrokenEncodingChars(repaired) >= 2) return encodingFallbackText(fileName);
  const cleaned = repaired.replace(/[\uFFFD\u25A1]+/g, "").replace(/\s{2,}/g, " ").trim();
  if (cleaned && !looksLikeBrokenEncoding(cleaned)) return cleaned;
  return encodingFallbackText(fileName);
}

function looksLikeBrokenEncoding(text) {
  const value = String(text || "");
  if (!value) return false;
  const brokenChars = countBrokenEncodingChars(value);
  if (brokenChars >= 2) return true;
  return brokenChars > 0 && brokenChars / Math.max(value.length, 1) > 0.02;
}

function countBrokenEncodingChars(text) {
  return (String(text || "").match(/[\uFFFD\u25A1]/g) || []).length;
}

function isMarkdownLikeFile(fileName = "") {
  return /\.(md|markdown|txt)$/i.test(fileName);
}

function encodingFallbackText(fileName = "") {
  return isMarkdownLikeFile(fileName)
    ? "中文内容编码异常，已隐藏乱码；请重新生成或保存为 UTF-8。"
    : "内容编码异常，已隐藏乱码。";
}

function repairLatin1Mojibake(text) {
  const value = String(text || "");
  if (!/[ÃÂâ]/.test(value)) return value;
  try {
    const bytes = Uint8Array.from([...value].map((char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return scoreBrokenEncoding(decoded) <= scoreBrokenEncoding(value) ? decoded : value;
  } catch {
    return value;
  }
}

function scoreBrokenEncoding(text) {
  const value = String(text || "");
  return (value.match(/[\uFFFD\u25A1ÃÂâ]/g) || []).length;
}

function runCaptainInternalElection() {
  const candidates = ["master", "frontend", "backend", "reviewer", "tester"];
  const voters = candidates.filter((id) => agentById(id));
  const rounds = [1, 2, 3].map((round) => {
    const votes = {};
    const ballots = voters.map((voterId) => {
      const voteFor = chooseCaptainCandidate(voterId, round, candidates);
      votes[voteFor] = (votes[voteFor] || 0) + 1;
      return { voterId, voteFor };
    });
    const max = Math.max(...Object.values(votes));
    return {
      round,
      ballots,
      votes,
      topIds: candidates.filter((id) => votes[id] === max),
    };
  });
  const aggregate = {};
  rounds.forEach((round) => {
    Object.entries(round.votes).forEach(([id, count]) => {
      aggregate[id] = (aggregate[id] || 0) + count;
    });
  });
  const aggregateMax = Math.max(...Object.values(aggregate));
  const aggregateTopIds = candidates.filter((id) => aggregate[id] === aggregateMax);
  const lastDecidedRound = [...rounds].reverse().find((round) => round.topIds.length === 1);
  const needsHumanReview = rounds.every((round) => round.topIds.length > 1);
  const leaderId = needsHumanReview ? "" : aggregateTopIds.length === 1 ? aggregateTopIds[0] : lastDecidedRound?.topIds[0] || "";
  captainVotes = aggregate;
  captainElection = { rounds, leaderId, needsHumanReview, aggregateTopIds };
}

function chooseCaptainCandidate(voterId, round, candidates) {
  const pressure = {
    master: tasks.filter((task) => ["pending", "assigned"].includes(task.status)).length + 2,
    frontend: tasks.filter((task) => task.owner === "frontend").length + (activeFileName.endsWith(".js") || activeFileName.endsWith(".css") || activeFileName.endsWith(".html") ? 2 : 0),
    backend: tasks.filter((task) => task.owner === "backend").length + (activeFileName.endsWith(".py") ? 2 : 0),
    reviewer: tasks.filter((task) => ["review", "delivery", "packaged"].includes(task.status)).length + 1,
    tester: tasks.filter((task) => task.owner === "tester" || String(task.title || "").includes("测试")).length,
  };
  const preference = {
    master: ["master", "reviewer", "tester"],
    frontend: ["frontend", "master", "reviewer"],
    backend: ["backend", "master", "tester"],
    reviewer: ["reviewer", "master", "tester"],
    tester: ["tester", "reviewer", "master"],
  }[voterId] || ["master"];
  return candidates
    .map((id) => ({
      id,
      score:
        (pressure[id] || 0) +
        (preference[0] === id ? 3 : preference[1] === id ? 2 : preference[2] === id ? 1 : 0) +
        (round === 2 && id === "reviewer" ? 1 : 0) +
        (round === 3 && id === "master" ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || candidates.indexOf(a.id) - candidates.indexOf(b.id))[0].id;
}

function renderCaptainVotes() {
  runCaptainInternalElection();
  const leader = captainElection.leaderId ? agentById(captainElection.leaderId) : null;
  const leaderText = captainElection.needsHumanReview ? "三轮平票，进入人工审核" : leader ? `${leader.name} 由 Agent 内部选出` : "未选出";
  if (els.captainName) els.captainName.textContent = leaderText;
  if (els.captainInlineName) els.captainInlineName.textContent = leaderText;
  const roundText = captainElection.rounds
    .map((round) => `第 ${round.round} 轮：${round.topIds.map((id) => agentById(id)?.name || id).join(" / ")} ${round.topIds.length > 1 ? "平票" : "胜出"}`)
    .join("；");
  const voteMarkup = agents
    .map(
      (agent) => `
      <article class="captain-vote ${captainElection.leaderId === agent.id ? "winner" : ""}">
        <span><strong>${agent.name}</strong><em>${agent.role}</em><small>Agent 内部三轮累计票</small></span>
        <b>${captainVotes[agent.id] || 0}</b>
      </article>
    `,
    )
    .join("");
  const summary = `<div class="captain-election-summary"><strong>${escapeHtml(leaderText)}</strong><span>${escapeHtml(roundText)}</span><em>人工不能干预投票；只有三轮全部平票才进入人工审核。</em></div>`;
  if (els.captainVoteList) els.captainVoteList.innerHTML = summary + voteMarkup;
  if (els.captainVoteInlineList) els.captainVoteInlineList.innerHTML = summary + voteMarkup;
}

function switchOpenWorldPanel(panelId) {
  closeAllToolWindows();
  document.querySelectorAll(".open-world-content-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
  document.querySelectorAll("[data-world-panel-target]").forEach((button) => {
    const active = button.dataset.worldPanelTarget === panelId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    if (active && button.closest(".open-world-actions")) {
      button.scrollIntoView({ block: "nearest", inline: "center" });
    }
  });
  if (panelId === "recordsPanel") loadPatchHistory();
  if (panelId === "taskLogsPanel") loadTaskLogs();
  if (panelId === "notificationsPanel") loadOutbox();
  if (panelId === "botPanel") loadBotMessages();
  if (panelId === "publicChatPanel") renderPublicChat();
  if (panelId === "governancePanel") renderCaptainVotes();
}

function switchOpenSourcePanel(panelId = "oswDashboardPanel") {
  const target = document.getElementById(panelId) ? panelId : "oswDashboardPanel";
  document.querySelectorAll(".osw-page-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === target);
  });
  document.querySelectorAll("[data-osw-panel-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.oswPanelTarget === target);
  });
  if (target === "oswChatPanel") renderPublicChat();
  renderPublicWorldOnline();
  renderOpenSourceWorld();
}

function openRuntimeFeature(button) {
  const targetView = button.dataset.runtimeOpenView || "warRoom";
  const worldPanel = button.dataset.runtimeWorldPanel;
  const oswPanel = button.dataset.runtimeOswPanel;
  const adminPanel = button.dataset.runtimeAdminPanel;
  switchView(targetView);
  window.setTimeout(() => {
    if (worldPanel) switchOpenWorldPanel(worldPanel);
    if (oswPanel) switchOpenSourcePanel(oswPanel);
    if (adminPanel) switchAdminPanel(adminPanel);
  }, 0);
}

function handleOpenSourceClick(event) {
  const panelButton = event.target.closest("[data-osw-panel-target]");
  if (panelButton) {
    switchOpenSourcePanel(panelButton.dataset.oswPanelTarget);
    return;
  }
  const repoButton = event.target.closest("[data-osw-repo]");
  if (repoButton) {
    openPublicRepo(repoButton.dataset.oswRepo);
    return;
  }
  const issueButton = event.target.closest("[data-osw-issue]");
  if (issueButton) {
    openPublicIssue(issueButton.dataset.oswIssue);
    return;
  }
  const pullButton = event.target.closest("[data-osw-pull]");
  if (pullButton) {
    openPublicPull(pullButton.dataset.oswPull);
    return;
  }
  const auditButton = event.target.closest("[data-osw-audit]");
  if (auditButton) {
    openPublicAudit(auditButton.dataset.oswAudit);
    return;
  }
  const cloneButton = event.target.closest("[data-osw-clone-repo]");
  if (cloneButton) {
    clonePublicRepo(cloneButton.dataset.oswCloneRepo);
    return;
  }
  const codeButton = event.target.closest("[data-osw-open-code]");
  if (codeButton) {
    openPublicRepoInCode(codeButton.dataset.oswOpenCode);
    return;
  }
  const pullRequestButton = event.target.closest("[data-osw-pull-request]");
  if (pullRequestButton) {
    pullPublicRequest(pullRequestButton.dataset.oswPullRequest);
    return;
  }
  const reviewButton = event.target.closest("[data-osw-review-pull]");
  if (reviewButton) {
    reviewPublicPull(reviewButton.dataset.oswReviewPull);
  }
}

function publicWorldText() {
  return els.oswComposeInput?.value.trim() || "来自开源世界的新协作请求";
}

function pushPublicFeed(actor, title, text, meta) {
  publicWorldState.feed.unshift({ actor, title, text, meta });
  publicWorldState.feed.splice(8);
}

function renderRepoButtons(repos) {
  return repos
    .map(
      (repo) => `
      <button type="button" class="${repo.id === selectedPublicRepoId ? "active" : ""}" data-osw-repo="${escapeHtml(repo.id || repo.name)}">
        <strong>${escapeHtml(repo.name)}</strong>
        <span>${escapeHtml(repo.desc)}</span>
        <em>${escapeHtml(repo.lang || "Code")} / clone</em>
      </button>
    `,
    )
    .join("");
}

function renderIssueRows(items, kind = "issue") {
  return items
    .map(
      (item) => `
      <button type="button" class="osw-issue-row" data-osw-${kind}="${escapeHtml(item.id || item.title)}">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.status)} / ${escapeHtml(item.owner)}</span>
      </button>
    `,
    )
    .join("");
}

function renderAuditItems(items) {
  return items
    .map(
      (item) => `
      <button type="button" class="osw-feed-item" data-osw-audit="${escapeHtml(item.id || item.title)}">
        <b>${escapeHtml(item.agent)}</b>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.text)}</p>
        <em>${escapeHtml(item.time)}</em>
      </button>
    `,
    )
    .join("");
}

function renderFeedItems(items) {
  return items
    .map(
      (item) => `
      <div class="osw-feed-item">
        <b>${escapeHtml(item.actor)}</b>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.text)}</p>
        <em>${escapeHtml(item.meta)}</em>
      </div>
    `,
    )
    .join("");
}

function renderOpenSourceWorld() {
  const repoMarkup = renderRepoButtons(publicWorldState.repos);
  if (els.publicRepoSidebarList) els.publicRepoSidebarList.innerHTML = repoMarkup;
  if (els.publicRepoList) els.publicRepoList.innerHTML = repoMarkup;
  const issueMarkup = renderIssueRows(publicWorldState.issues, "issue");
  if (els.publicAssignedIssuesList) els.publicAssignedIssuesList.innerHTML = issueMarkup;
  if (els.publicIssuesList) els.publicIssuesList.innerHTML = issueMarkup;
  if (els.publicPullsList) els.publicPullsList.innerHTML = renderIssueRows(publicWorldState.pulls, "pull");
  if (els.publicAuditList) els.publicAuditList.innerHTML = renderAuditItems(publicWorldState.audits);
  if (els.publicFeedList) els.publicFeedList.innerHTML = renderFeedItems(publicWorldState.feed);
  renderOpenSourceDetails();
}

function renderOpenSourceDetails() {
  const repo = publicWorldState.repos.find((item) => item.id === selectedPublicRepoId) || publicWorldState.repos[0];
  if (els.oswRepoDetail && repo) {
    els.oswRepoDetail.innerHTML = `
      <div class="osw-detail-head">
        <button type="button" data-osw-panel-target="oswReposPanel">返回仓库</button>
        <span>${escapeHtml(repo.lang || "Code")}</span>
      </div>
      <h2>${escapeHtml(repo.name)}</h2>
      <p>${escapeHtml(repo.desc)}</p>
      <div class="osw-clone-box"><code>${escapeHtml(repo.url || `file://local/${repo.name}.git`)}</code><button type="button" data-osw-clone-repo="${escapeHtml(repo.id)}">拉取仓库</button></div>
      <div class="osw-detail-actions">
        <button type="button" data-osw-open-code="${escapeHtml(repo.id)}">进入源文明代码区</button>
        <button type="button" data-osw-panel-target="oswNewRepoPanel">创建新仓库</button>
      </div>
      <section class="osw-detail-card"><strong>最近文件</strong><span>server.py / app.js / connectors.py / README.md</span></section>
    `;
  }
  const issue = publicWorldState.issues.find((item) => item.id === selectedPublicIssueId) || publicWorldState.issues[0];
  if (els.oswIssueDetail && issue) {
    const notes = (issue.understanding || []).map((item) => `<div class="osw-note"><strong>${escapeHtml(item.author)}</strong><p>${escapeHtml(item.text)}</p></div>`).join("");
    els.oswIssueDetail.innerHTML = `
      <div class="osw-detail-head"><button type="button" data-osw-panel-target="oswIssuesPanel">返回议题</button><span>${escapeHtml(issue.status)}</span></div>
      <h2>${escapeHtml(issue.title)}</h2>
      <p>负责人：${escapeHtml(issue.owner)}。这里用来写你对任务的理解，后续 Agent 会按这些上下文判断是否采纳。</p>
      <form class="osw-understanding-form" data-osw-understanding-form="${escapeHtml(issue.id)}">
        <textarea placeholder="写下你对这个议题的理解、约束、验收标准或希望 Agent 注意的地方..."></textarea>
        <button type="submit">提交理解</button>
      </form>
      <section class="osw-detail-card"><strong>大家的理解</strong>${notes || "<span>暂无理解记录。</span>"}</section>
    `;
  }
  const pull = publicWorldState.pulls.find((item) => item.id === selectedPublicPullId) || publicWorldState.pulls[0];
  if (els.oswPullDetail && pull) {
    const agentRuns = renderPullAgentRuns(pull);
    const projectLinks = renderPullProjectLinks(pull);
    const actionDisabled = ["agent_running", "leader_review", "approved"].includes(pull.status) ? "disabled" : "";
    els.oswPullDetail.innerHTML = `
      <div class="osw-detail-head"><button type="button" data-osw-panel-target="oswPullsPanel">返回拉取请求</button><span>${escapeHtml(pull.status)}</span></div>
      <h2>${escapeHtml(pull.title)}</h2>
      <p>分支：${escapeHtml(pull.branch || "main")}，负责人：${escapeHtml(pull.owner)}。拉取后会直接进入 Agent 分工：前端、后端、测试分别产出可用代码，负责人汇总后交给 Reviewer 审核。</p>
      <div class="osw-detail-actions">
        <button type="button" data-osw-pull-request="${escapeHtml(pull.id)}" ${actionDisabled}>拉取并交给 Agent</button>
        <button type="button" data-osw-review-pull="${escapeHtml(pull.id)}">进入 Review</button>
      </div>
      <section class="osw-detail-card"><strong>变更摘要</strong><span>布局调整、任务闭环、Connector 消息同步、前端可视化状态。</span></section>
      ${agentRuns}
      ${projectLinks}
    `;
  }
  const audit = publicWorldState.audits.find((item) => item.id === selectedPublicAuditId) || publicWorldState.audits[0];
  if (els.oswAuditDetail && audit) {
    els.oswAuditDetail.innerHTML = `
      <div class="osw-detail-head"><button type="button" data-osw-panel-target="oswAuditPanel">返回审计</button><span>${escapeHtml(audit.time)}</span></div>
      <h2>${escapeHtml(audit.title)}</h2>
      <p>${escapeHtml(audit.text)}</p>
      <section class="osw-detail-card"><strong>审计结果</strong><span>${escapeHtml(audit.result || "等待 Agent 输出结果。")}</span></section>
      <section class="osw-detail-card"><strong>风险说明</strong><span>${escapeHtml(audit.risk || "暂无风险。")}</span></section>
    `;
  }
}

function pullStatusLabel(status) {
  return {
    draft: "草稿",
    review: "待审查",
    dispatching: "分发中",
    agent_running: "Agent 编码中",
    leader_review: "负责人汇总审核",
    approved: "已通过",
    rejected: "已驳回",
    pending: "等待",
    running: "执行中",
    done: "完成",
  }[status] || status || "未知";
}

function renderPullAgentRuns(pull) {
  const runs = pull.agentRuns || [];
  if (!runs.length) {
    return '<section class="osw-detail-card osw-pr-runs"><strong>Agent 执行</strong><span>点击“拉取并交给 Agent”后，这里会显示每个 Agent 的实时分工和产出。</span></section>';
  }
  return `
    <section class="osw-detail-card osw-pr-runs">
      <strong>Agent 执行</strong>
      <div class="osw-agent-run-list">
        ${runs
          .map(
            (run) => `
            <div class="osw-agent-run ${escapeHtml(run.status)}">
              <i style="--agent-color:${escapeHtml(agentById(run.agentId)?.color || "#21d6e7")}">${escapeHtml(avatarInitial(run.agentName || run.agentId))}</i>
              <span>
                <b>${escapeHtml(run.agentName || run.agentId)}</b>
                <em>${escapeHtml(run.summary || "")}</em>
              </span>
              <mark>${escapeHtml(pullStatusLabel(run.status))}</mark>
            </div>
          `,
          )
          .join("")}
      </div>
      <p>${escapeHtml(pull.leaderSummary || "等待负责人汇总代码与审核意见。")}</p>
    </section>
  `;
}

function renderPullProjectLinks(pull) {
  if (pull.status !== "approved" || !pull.projectUrl) {
    return '<section class="osw-detail-card"><strong>项目 URL</strong><span>负责人审核通过后，会在这里生成本地预览地址和 Git 拉取地址。</span></section>';
  }
  return `
    <section class="osw-detail-card osw-project-result">
      <strong>项目已可检查</strong>
      <span>Reviewer 已通过静态校验，当前可先用测试版 URL 查看效果。</span>
      <div class="osw-clone-box"><code>${escapeHtml(pull.projectUrl)}</code><button type="button" data-osw-open-code="${escapeHtml(pull.repoId || "desktop")}">打开代码</button></div>
      <div class="osw-clone-box"><code>${escapeHtml(pull.cloneUrl || "")}</code><button type="button" data-osw-clone-repo="${escapeHtml(pull.repoId || "desktop")}">Git 拉取</button></div>
    </section>
  `;
}

function bindOpenSourceItems() {
  document.querySelectorAll("[data-osw-understanding-form]").forEach((form) => {
    form.addEventListener("submit", submitIssueUnderstanding);
  });
}

function handleOpenSourceAction(action) {
  const text = publicWorldText();
  const shortTitle = text.length > 42 ? `${text.slice(0, 42)}...` : text;
  if (action === "issue") {
    const issue = { id: `ISS-${Date.now().toString(36).toUpperCase()}`, title: shortTitle, status: "open", owner: "Frontend Agent", understanding: [] };
    publicWorldState.issues.unshift(issue);
    selectedPublicIssueId = issue.id;
    pushPublicFeed("你", `创建议题：${shortTitle}`, "议题已进入公开任务池，社区用户和 Agent 都可以继续补充上下文。", "Issue / just now");
    switchOpenSourcePanel("oswIssuesPanel");
  } else if (action === "code") {
    const issue = { id: `ISS-${Date.now().toString(36).toUpperCase()}`, title: `代码任务：${shortTitle}`, status: "coding", owner: "Master Agent", understanding: [] };
    publicWorldState.issues.unshift(issue);
    selectedPublicIssueId = issue.id;
    pushPublicFeed("你", `编写代码：${shortTitle}`, "已切换到自动编码工作区，Agent 会先创建交付仓库和文件，再开始流式写代码。", "Code / auto");
    switchView("community");
    switchOpenWorldPanel("codePanel");
    if (els.autoCodeInput) els.autoCodeInput.value = text;
    switchCodingMode("auto");
  } else if (action === "pull") {
    const nextId = 22 + publicWorldState.pulls.length;
    const pull = { id: `PR-${nextId}`, title: `#${nextId} ${shortTitle}`, status: "draft", owner: "Reviewer Agent", branch: shortTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32) || "public-change", agentRuns: [] };
    publicWorldState.pulls.unshift(pull);
    selectedPublicPullId = pull.id;
    pushPublicFeed("Reviewer Agent", `创建拉取请求：#${nextId}`, "PR 草稿已生成，等待 Agent 审计和 Review 门禁通过后进入合并队列。", "Pull Request / just now");
    switchOpenSourcePanel("oswPullsPanel");
  } else if (action === "audit") {
    const audit = {
      id: `AUD-${Date.now().toString(36).toUpperCase()}`,
      agent: "Reviewer Agent",
      title: `审计请求：${shortTitle}`,
      text: "已进入公开审计队列。Reviewer 会检查可运行性、风险点，以及是否需要 Tester 补充验证。",
      time: "just now",
      result: "等待 Reviewer Agent 输出审计结论。",
      risk: "待评估。",
    };
    publicWorldState.audits.unshift(audit);
    selectedPublicAuditId = audit.id;
    pushPublicFeed("Reviewer Agent", `Agent 审计：${shortTitle}`, "审计记录已生成，右侧在线 Agent 会同步看到这条请求。", "Agent 审计 / just now");
    switchOpenSourcePanel("oswAuditPanel");
  }
  if (els.oswComposeInput) els.oswComposeInput.value = "";
  renderOpenSourceWorld();
}

function createPublicRepo(event) {
  event.preventDefault();
  const name = els.oswRepoNameInput?.value.trim();
  if (!name) return;
  const desc = els.oswRepoDescInput?.value.trim() || "QuantumFlow 开源模块";
  const lang = els.oswRepoLangInput?.value || "Code";
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `repo-${Date.now().toString(36)}`;
  publicWorldState.repos.unshift({ id, name, desc, lang, url: `https://example.com/QuantumFlow/${id}.git` });
  selectedPublicRepoId = id;
  pushPublicFeed("你", `新建仓库：${name}`, `${desc} / ${lang}`, "Repository / just now");
  els.oswRepoNameInput.value = "";
  if (els.oswRepoDescInput) els.oswRepoDescInput.value = "";
  switchOpenSourcePanel("oswRepoDetailPanel");
  renderOpenSourceWorld();
}

function openPublicRepo(id) {
  selectedPublicRepoId = id;
  switchOpenSourcePanel("oswRepoDetailPanel");
}

function openPublicIssue(id) {
  selectedPublicIssueId = id;
  switchOpenSourcePanel("oswIssueDetailPanel");
}

function openPublicPull(id) {
  selectedPublicPullId = id;
  switchOpenSourcePanel("oswPullDetailPanel");
}

function openPublicAudit(id) {
  selectedPublicAuditId = id;
  switchOpenSourcePanel("oswAuditDetailPanel");
}

function clonePublicRepo(id) {
  const repo = publicWorldState.repos.find((item) => item.id === id);
  if (!repo) return;
  pushPublicFeed("Git Bridge", `拉取仓库：${repo.name}`, `已生成兼容本地和远端的拉取任务：${repo.url}`, "Clone / just now");
  renderOpenSourceWorld();
}

function openPublicRepoInCode(id) {
  const repo = publicWorldState.repos.find((item) => item.id === id);
  const targetRepo = openWorldRepos.find((item) => item.id === id) || openWorldRepos[0];
  activeRepoId = targetRepo.id;
  activeFileName = Object.keys(targetRepo.files || {})[0] || "server.py";
  pushPublicFeed("源文明", `打开代码区：${repo?.name || targetRepo.name}`, "仓库已切到源文明代码区，可以继续交给 Agent 或手动修改。", "Code / just now");
  switchView("community");
  switchOpenWorldPanel("codePanel");
}

function pullPublicRequest(id) {
  const pull = publicWorldState.pulls.find((item) => item.id === id);
  if (!pull) return;
  if (["agent_running", "leader_review", "approved"].includes(pull.status)) return;
  dispatchPulledRequestToAgents(pull);
}

function pullAgentPlan(pull) {
  const branch = pull.branch || "main";
  const spec = inferBusinessSpec(pull.title || "");
  if (isVue3FrontendSpec(spec)) {
    return [
      {
        agentId: "frontend",
        repoId: "project",
        fileName: "src/App.vue",
        summary: "按需求生成 Vue3 图书管理主页面、状态流转和表单交互",
        lines: buildAgentArtifactLines("frontend", pull, "src/App.vue"),
      },
      {
        agentId: "frontend",
        repoId: "project",
        fileName: "src/style.css",
        summary: "生成图书管理前端样式和响应式布局",
        lines: buildAgentArtifactLines("frontend", pull, "src/style.css"),
      },
      {
        agentId: "tester",
        repoId: "project",
        fileName: "tests/book.spec.js",
        summary: "生成 Vue3 图书管理前端结构烟测",
        lines: buildAgentArtifactLines("tester", pull, "tests/book.spec.js"),
      },
      {
        agentId: "reviewer",
        repoId: "project",
        fileName: "docs/review-checklist.md",
        summary: `Review ${branch} 的 Vue3 前端需求一致性和可运行性`,
        lines: buildAgentArtifactLines("reviewer", pull, "docs/review-checklist.md"),
      },
      {
        agentId: "master",
        repoId: "project",
        fileName: "README.md",
        summary: "汇总运行方式、Agent 分工和交付说明",
        lines: buildAgentArtifactLines("master", pull, "README.md"),
      },
    ];
  }
  return [
    {
      agentId: "frontend",
      repoId: "project",
      fileName: "app/static/app.js",
      summary: "实现任务看板交互、筛选、状态渲染和接口联动",
      lines: buildAgentArtifactLines("frontend", pull, "app/static/app.js"),
    },
    {
      agentId: "backend",
      repoId: "project",
      fileName: "app/main.py",
      summary: "生成 FastAPI、SQLite 数据模型和任务接口",
      lines: buildAgentArtifactLines("backend", pull, "app/main.py"),
    },
    {
      agentId: "tester",
      repoId: "project",
      fileName: "tests/test_smoke.py",
      summary: "生成健康检查、创建任务、更新状态和列表读取烟测",
      lines: buildAgentArtifactLines("tester", pull, "tests/test_smoke.py"),
    },
    {
      agentId: "reviewer",
      repoId: "project",
      fileName: "docs/review-checklist.md",
      summary: `Review ${branch} 的可运行性与合并风险`,
      lines: buildAgentArtifactLines("reviewer", pull, "docs/review-checklist.md"),
    },
  ];
}

function dispatchPulledRequestToAgents(pull) {
  const plan = pullAgentPlan(pull);
  pull.status = "dispatching";
  pull.repoId = "project";
  pull.agentRuns = plan.map((item) => ({
    agentId: item.agentId,
    agentName: agentById(item.agentId)?.name || item.agentId,
    status: "pending",
    repoId: item.repoId,
    fileName: item.fileName,
    summary: item.summary,
  }));
  pull.leaderSummary = "负责人已收到 PR，正在把分支拆给各 Agent 并行处理。";
  pushPublicFeed("Git Bridge", `拉取请求：${pull.title}`, `分支 ${pull.branch || "main"} 已拉取，正在交给 Agent 自动编码。`, "Pull / Agent dispatch");
  addLog(`PR ${pull.id} 已拉取，负责人开始协调 Agent 任务。`, "Git Bridge");
  renderOpenSourceWorld();

  plan.forEach((item, index) => {
    window.setTimeout(() => startPullAgentRun(pull.id, item), 420 + index * 720);
  });
  window.setTimeout(() => finishPullLeaderReview(pull.id), 420 + plan.length * 720 + 3600);
}

function startPullAgentRun(pullId, planItem) {
  const pull = publicWorldState.pulls.find((item) => item.id === pullId);
  if (!pull || pull.status === "approved") return;
  const run = pull.agentRuns?.find((item) => item.agentId === planItem.agentId);
  const agent = agentById(planItem.agentId);
  if (!run || !agent) return;

  pull.status = "agent_running";
  run.status = "running";
  run.startedAt = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  setAgent(planItem.agentId, { status: "working" });
  addLog(`${pull.id} / ${run.summary}`, agent.name);
  pushPublicFeed(agent.name, `${pull.title}：${run.summary}`, `正在流式写入 ${planItem.repoId}/${planItem.fileName}`, "Agent coding / now");
  streamCodeLines({
    repoId: planItem.repoId,
    fileName: planItem.fileName,
    agentName: agent.name,
    taskTitle: `${pull.title} / ${run.summary}`,
    taskId: `${pull.id}:${planItem.agentId}:${planItem.fileName}`,
    lines: planItem.lines,
  });
  renderOpenSourceWorld();

  window.setTimeout(() => {
    const latestPull = publicWorldState.pulls.find((item) => item.id === pullId);
    const latestRun = latestPull?.agentRuns?.find((item) => item.agentId === planItem.agentId);
    if (!latestPull || !latestRun || latestRun.status !== "running") return;
    latestRun.status = "done";
    latestRun.finishedAt = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    setAgent(planItem.agentId, { status: "done", x: agent.home[0], y: agent.home[1] });
    pushPublicFeed(agent.name, `${pull.title}：分工完成`, `${planItem.fileName} 已产出可运行项目文件，等待负责人汇总。`, "Agent done / now");
    renderOpenSourceWorld();
  }, 1380 + planItem.lines.length * 120);
}

function finishPullLeaderReview(pullId) {
  const pull = publicWorldState.pulls.find((item) => item.id === pullId);
  if (!pull || pull.status === "approved") return;
  pull.status = "leader_review";
  pull.agentRuns = (pull.agentRuns || []).map((run) => ({ ...run, status: run.status === "pending" || run.status === "running" ? "done" : run.status }));
  setAgent("master", { status: "working" });
  setAgent("reviewer", { status: "working" });
  pull.leaderSummary = "负责人已汇总各 Agent 代码，Reviewer 正在做语法门禁、任务一致性和可运行性审核。";
  pushPublicFeed("团队负责人", `${pull.title}：汇总代码`, "前端、后端、测试和审查分工已汇总，开始合并前审核。", "Leader review / now");
  renderOpenSourceWorld();

  window.setTimeout(() => {
    const result = validatePullArtifacts(pull);
    if (!result.ok) {
      pull.status = "rejected";
      pull.leaderSummary = `Reviewer 驳回：${result.reason}`;
      pushPublicFeed("Reviewer Agent", `${pull.title}：审核未通过`, result.reason, "Review rejected / now");
    } else {
      const slug = (pull.branch || pull.id || "quantumflow-project").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      pull.status = "approved";
      pull.projectUrl = `${location.origin || "http://127.0.0.1:8765"}/open-source?project=${encodeURIComponent(slug)}&pull=${encodeURIComponent(pull.id)}`;
      pull.cloneUrl = `git clone ${publicWorldState.repos.find((repo) => repo.id === (pull.repoId || "desktop"))?.url || `https://example.com/QuantumFlow/${slug}.git`}`;
      pull.leaderSummary = "Reviewer 已通过：项目文件结构和语法门禁可用，项目 URL 已生成，可以打开检查运行效果。";
      publicWorldState.audits.unshift({
        id: `AUD-${Date.now().toString(36).toUpperCase()}`,
        agent: "Reviewer Agent",
        title: `通过 ${pull.title}`,
        text: "已完成 Agent 分工产出、负责人汇总和 Reviewer 门禁。",
        time: "just now",
        result: `通过。项目地址：${pull.projectUrl}`,
        risk: "测试版仍需接入真实 GitHub/GitLab 合并 API 和完整 E2E。",
      });
      pushPublicFeed("Reviewer Agent", `${pull.title}：审核通过`, `项目 URL 已生成：${pull.projectUrl}`, "Review approved / now");
    }
    setAgent("master", { status: "done", x: agentById("master").home[0], y: agentById("master").home[1] });
    setAgent("reviewer", { status: "done", x: agentById("reviewer").home[0], y: agentById("reviewer").home[1] });
    renderOpenSourceWorld();
  }, 1100);
}

function validatePullArtifacts(pull) {
  const runs = pull.agentRuns || [];
  if (!runs.length) return { ok: false, reason: "没有 Agent 产出记录。" };
  const unfinished = runs.find((run) => run.status !== "done");
  if (unfinished) return { ok: false, reason: `${unfinished.agentName || unfinished.agentId} 尚未完成。` };
  for (const run of runs) {
    const key = codeKey(run.repoId, run.fileName);
    const lines = generatedCodeOverrides[key] || [];
    const result = validateGeneratedCode(lines);
    if (!result.ok) return { ok: false, reason: `${run.fileName} 校验失败：${result.reason}` };
  }
  return { ok: true };
}

function reviewPublicPull(id) {
  const pull = publicWorldState.pulls.find((item) => item.id === id);
  if (!pull) return;
  const audit = {
    id: `AUD-${Date.now().toString(36).toUpperCase()}`,
    agent: "Reviewer Agent",
    title: `Review ${pull.title}`,
    text: `正在审查 ${pull.branch || "main"} 的代码改动、可运行性和合并风险。`,
    time: "just now",
    result: "等待 Reviewer Agent 生成最终结论。",
    risk: "待评估。",
  };
  publicWorldState.audits.unshift(audit);
  selectedPublicAuditId = audit.id;
  switchOpenSourcePanel("oswAuditDetailPanel");
}

function submitIssueUnderstanding(event) {
  event.preventDefault();
  const issue = publicWorldState.issues.find((item) => item.id === event.currentTarget.dataset.oswUnderstandingForm);
  const input = event.currentTarget.querySelector("textarea");
  const text = input?.value.trim() || "";
  if (!issue || !text) return;
  issue.understanding = issue.understanding || [];
  issue.understanding.unshift({ author: currentUser?.display_name || currentUser?.username || "你", text });
  input.value = "";
  pushPublicFeed("你", `补充议题理解：${issue.title}`, text, "Issue note / just now");
  renderOpenSourceWorld();
}

function currentEditableCodeLines() {
  const activeRepo = openWorldRepos.find((repo) => repo.id === activeRepoId) || openWorldRepos[0];
  return codeForActiveFile(activeRepo, activeFileName);
}

function setManualEditMode(enabled) {
  if (!els.manualCodeEditor || !els.repoCodeView) return;
  document.body.classList.toggle("manual-coding-mode", enabled);
  els.manualCodeEditor.classList.toggle("active", enabled);
  els.manualCodeEditor.setAttribute("aria-hidden", String(!enabled));
  els.llmPluginPanel?.classList.toggle("active", enabled);
  els.llmPluginPanel?.setAttribute("aria-hidden", String(!enabled));
  els.repoCodeView.classList.toggle("hidden", enabled);
  if (els.manualEditBtn) els.manualEditBtn.hidden = enabled;
  if (els.manualCompleteBtn) els.manualCompleteBtn.hidden = !enabled;
  if (els.manualSaveBtn) els.manualSaveBtn.hidden = !enabled;
  if (els.manualCancelBtn) els.manualCancelBtn.hidden = !enabled;
  const key = codeKey(activeRepoId, activeFileName);
  const meta = codeArtifactMeta[key];
  if (els.manualEditState) {
    els.manualEditState.textContent = enabled
      ? `manual edit 路 基于${meta?.agent_id ? ` ${meta.agent_id}` : ""}代码产物`
      : meta?.status === "manual_edit"
        ? "manual 路 latest"
        : "main 路 latest";
  }
  if (enabled) {
    els.manualCodeEditor.value = currentEditableCodeLines().join("\n");
    els.manualCodeEditor.focus();
    loadLlmPluginConfig();
  }
}

function switchCodingMode(mode) {
  const manualMode = mode === "manual";
  document.querySelectorAll("[data-coding-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.codingMode === mode);
  });
  els.autoCodePanel?.classList.toggle("active", !manualMode);
  setManualEditMode(manualMode);
}

async function completeManualCode() {
  if (!els.manualCodeEditor) return;
  const title = els.autoCodeInput?.value.trim() || publicWorldText?.() || "完善当前功能";
  const fullLines = completeCurrentFileLines(title);
  if (fullLines.length) {
    els.manualCodeEditor.value = `${fullLines.join("\n")}\n`;
    els.manualCodeEditor.focus();
    els.manualCodeEditor.scrollTop = 0;
    if (els.manualEditState) els.manualEditState.textContent = "local full completion / ready";
    pushComment("Agent 编排控制台", `已补全 ${activeFileName} 的完整代码，保存后进入 Review。`, "suggestion", codeKey());
    return;
  }
  if (els.llmPluginPrompt && !els.llmPluginPrompt.value.trim()) {
    els.llmPluginPrompt.value = `补全当前文件中未完成的业务代码，任务目标：${title}`;
  }
  if (els.manualEditState) els.manualEditState.textContent = "LLM completion / running";
  const generated = await generateWithLlmPlugin({ allowFallback: true });
  const suffix = generated || fallbackLlmPatch(currentManualCodeContext());
  const current = els.manualCodeEditor.value.replace(/\s*$/, "");
  els.manualCodeEditor.value = `${current}\n${suffix}\n`;
  els.manualCodeEditor.focus();
  els.manualCodeEditor.scrollTop = els.manualCodeEditor.scrollHeight;
  if (els.manualEditState) els.manualEditState.textContent = "LLM completion / ready";
  pushComment("LLM 插件", `已为 ${activeFileName} 生成真实补全候选，保存后进入 Review。`, "suggestion", codeKey());
}

function completeCurrentFileLines(title) {
  const fileName = activeFileName || "";
  const agentId = agentIdForFileName(fileName);
  if (!agentId) return [];
  const task = {
    id: `manual-complete-${Date.now().toString(36)}`,
    title,
    workflowTitle: title,
    owner: agentId,
    source: "manual_complete",
  };
  return buildAgentArtifactLines(agentId, task, fileName);
}

function agentIdForFileName(fileName) {
  if (/src\/|app\/static|\.html$|\.css$|\.vue$|\.jsx$|\.tsx$/.test(fileName)) return "frontend";
  if (/app\/main\.py|server\.py|api|backend/.test(fileName)) return "backend";
  if (/test|spec/.test(fileName)) return "tester";
  if (/review|checklist|docs\//.test(fileName)) return "reviewer";
  if (/README|\.md$|Agent\.py/.test(fileName)) return "master";
  return "";
}

function loadLlmPluginConfig() {
  if (!els.llmPluginProvider) return;
  const fallback = {
    provider: "openai",
    model: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
  };
  let config = fallback;
  try {
    config = { ...fallback, ...JSON.parse(localStorage.getItem(LLM_PLUGIN_CONFIG_KEY) || "{}") };
  } catch {
    config = fallback;
  }
  els.llmPluginProvider.value = config.provider || fallback.provider;
  els.llmPluginModel.value = config.model || fallback.model;
  els.llmPluginBaseUrl.value = config.baseUrl || fallback.baseUrl;
  els.llmPluginApiKey.value = config.apiKey || "";
}

function saveLlmPluginConfig() {
  const config = {
    provider: els.llmPluginProvider?.value || "openai",
    model: els.llmPluginModel?.value.trim() || "gpt-4.1-mini",
    baseUrl: normalizeLlmBaseUrl(els.llmPluginBaseUrl?.value.trim() || "https://api.openai.com/v1"),
    apiKey: els.llmPluginApiKey?.value.trim() || "",
  };
  localStorage.setItem(LLM_PLUGIN_CONFIG_KEY, JSON.stringify(config));
  if (els.llmPluginOutput) els.llmPluginOutput.textContent = "插件配置已保存。本地保存 API Key，仅用于当前浏览器。";
  return config;
}

function normalizeLlmBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function currentManualCodeContext() {
  const code = els.manualCodeEditor?.value || currentEditableCodeLines().join("\n");
  return {
    repo: activeRepoId,
    file: activeFileName,
    code,
    prompt: els.llmPluginPrompt?.value.trim() || "",
  };
}

function fallbackLlmPatch(context) {
  const task = context.prompt || "补全当前手动编码任务";
  const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  if (context.file.endsWith(".py")) {
    return [
      "",
      `# LLM plugin local patch at ${now}: ${task}`,
      "from typing import Any",
      "",
      "def normalize_runtime_payload(payload: dict[str, Any]) -> dict[str, Any]:",
      "    title = str(payload.get(\"title\") or payload.get(\"name\") or \"\").strip()",
      "    if not title:",
      "        raise ValueError(\"title is required\")",
      "    return {",
      "        \"title\": title,",
      "        \"owner\": str(payload.get(\"owner\") or \"负责人\").strip() or \"负责人\",",
      "        \"priority\": str(payload.get(\"priority\") or \"normal\").strip(),",
      "    }",
    ].join("\n");
  }
  return [
    "",
    `// LLM plugin local patch at ${now}: ${task}`,
    "async function refreshRuntimeTasks() {",
    "  const response = await fetch('/api/tasks');",
    "  if (!response.ok) throw new Error(`任务读取失败: ${response.status}`);",
    "  const tasks = await response.json();",
    "  return tasks.map((task) => ({",
    "    ...task,",
    "    displayStatus: statusText[task.status] || task.status,",
    "    displayPriority: priorityText[task.priority] || task.priority,",
    "  }));",
    "}",
  ].join("\n");
}

async function generateWithLlmPlugin(options = {}) {
  const config = saveLlmPluginConfig();
  const context = currentManualCodeContext();
  if (!context.prompt) {
    if (els.llmPluginOutput) els.llmPluginOutput.textContent = "先输入你要模型做什么，例如：修复当前函数、补全 API、解释并生成 patch。";
    return "";
  }
  if (els.llmPluginOutput) els.llmPluginOutput.textContent = "正在调用模型插件...";
  try {
    if (!config.baseUrl || (!config.apiKey && config.provider !== "local")) throw new Error("缺少 API Base 或 API Key");
    const response = await fetch("/api/llm/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        provider: config.provider,
        model: config.model,
        base_url: config.baseUrl,
        api_key: config.apiKey,
        repo: context.repo,
        file: context.file,
        code: context.code,
        prompt: context.prompt,
        task_id: "manual-complete",
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : data.error?.message || "模型插件调用失败");
    lastLlmPluginResult = data.content?.trim() || "";
  } catch (error) {
    lastLlmPluginResult = options.allowFallback ? fallbackLlmPatch(context) : "";
    if (els.llmPluginOutput) {
      els.llmPluginOutput.textContent = options.allowFallback
        ? `插件调用未完成，已生成离线候选补丁：${error.message}`
        : `插件调用失败：${error.message}`;
      return lastLlmPluginResult;
    }
  }
  if (els.llmPluginOutput) els.llmPluginOutput.textContent = lastLlmPluginResult || "模型没有返回内容。";
  return lastLlmPluginResult;
}

function insertLlmPluginResult() {
  if (!els.manualCodeEditor) return;
  const result = lastLlmPluginResult || els.llmPluginOutput?.textContent || "";
  if (!result || result.includes("切到手动编码后")) return;
  const current = els.manualCodeEditor.value.replace(/\s*$/, "");
  els.manualCodeEditor.value = `${current}\n${result}\n`;
  els.manualCodeEditor.focus();
  els.manualCodeEditor.scrollTop = els.manualCodeEditor.scrollHeight;
  if (els.manualEditState) els.manualEditState.textContent = "LLM plugin / inserted";
}

function sendLlmPluginResultToReview() {
  const result = lastLlmPluginResult || els.llmPluginOutput?.textContent || "";
  if (!result || result.includes("切到手动编码后")) return;
  pushComment("LLM 插件", result.slice(0, 600), "suggestion", codeKey());
  renderLiveComments();
}

async function saveManualCodeEdit() {
  const activeRepo = openWorldRepos.find((repo) => repo.id === activeRepoId) || openWorldRepos[0];
  const editedCode = els.manualCodeEditor.value;
  const key = codeKey(activeRepo.id, activeFileName);
  generatedCodeOverrides[key] = editedCode.split("\n");
  setManualEditMode(false);
  document.querySelectorAll("[data-coding-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.codingMode === "auto");
  });
  els.autoCodePanel?.classList.add("active");
  pushComment("你", `手动修改：已更新 ${activeRepo.name}/${activeFileName}，等待 Review 建议。`);
  if (backendConnected) {
    try {
      await fetch("/api/code-artifacts/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_key: patchTargetMap[key] || key,
          code_text: editedCode,
          agent_id: "human",
          task_id: `manual-${Date.now()}`,
          explanation: `IDE Bridge manual edit for ${activeRepo.name}/${activeFileName}`,
        }),
      });
      pushComment("QuantumFlow IDE Bridge", "手动修改已同步到 Agent 代码产物池。");
      loadCodeArtifacts();
    } catch {
      pushComment("QuantumFlow IDE Bridge", "手动修改已在本地生效，但同步到后端失败。");
    }
  }
  renderCommunity();
}

async function syncGitRepository(event) {
  event.preventDefault();
  const url = els.gitSyncUrl?.value.trim();
  const name = els.gitSyncName?.value.trim();
  if (!url) {
    if (els.gitSyncResult) els.gitSyncResult.textContent = "请先填写 Git URL、本地路径或 file:// 地址。";
    return;
  }
  const button = els.gitSyncForm?.querySelector("button");
  if (button) {
    button.disabled = true;
    button.textContent = "同步中...";
  }
  if (els.gitSyncResult) els.gitSyncResult.textContent = "正在执行 Git 同步，远端仓库可能需要一点时间。";
  try {
    const response = await fetch("/api/git/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, name }),
    });
    const result = await response.json();
    if (!response.ok) {
      const detail = result.detail;
      const message = typeof detail === "string" ? detail : detail?.stderr || detail?.message || "Git sync failed.";
      throw new Error(message);
    }
    if (els.gitSyncResult) {
      els.gitSyncResult.textContent = `${result.mode === "pull" ? "已更新" : "已拉取"}：${result.path}`;
    }
    pushComment("Git Bridge", `${result.repo} ${result.mode} 完成：${result.path}`, "suggestion", codeKey());
    if (result.snapshot) applySnapshot(result.snapshot);
    if (result.delivery?.id) {
      setActiveRuntimeDelivery(result.delivery.id);
      if (!projectDeliveries.some((item) => String(item.id) === String(result.delivery.id))) {
        projectDeliveries.unshift(result.delivery);
      }
      if (els.gitSyncResult) els.gitSyncResult.textContent = `${result.mode === "pull" ? "已更新" : "已拉取"}并登记运行项目：${result.path}`;
      openDeliveryRuntimeEnvironment(result.delivery.id);
      await openProjectDeliveryRuntime(result.delivery.id, { openExternal: false });
    }
  } catch (error) {
    if (els.gitSyncResult) els.gitSyncResult.textContent = `Git 同步失败：${error.message}`;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "拉取 / 同步";
    }
  }
}

async function submitAutoCodeTask(event) {
  event?.preventDefault?.();
  const title = els.autoCodeInput?.value.trim() || "";
  if (!title) return;
  const owner = els.autoCodeOwner?.value || "frontend";
  const ownerAgent = agentById(owner) || agentById("frontend");
  const command = `/code ${title}`;
  const button = els.autoCodeForm?.querySelector("button");
  if (button) {
    button.disabled = true;
    button.textContent = "Agent 编码中";
  }
  pushComment("你", `自动编码：${ownerAgent.name} 直接写入自己的负责文件；Tester 会检查功能和运行入口。`);
  try {
    if (!backendConnected) {
      const task = { id: Date.now(), title, backendId: `local-${Date.now()}`, owner };
      writeSingleAgentProjectCode(task);
      focusAgentCodeTarget(owner, title);
      addLog(`后端未连接，${ownerAgent.name} 已定向写入对应代码文件。`, "System");
      return;
    }
    const response = await fetch("/api/bot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: command, conversation_id: "desktop-chat", sender_id: "desktop-user" }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "auto code failed");
    pushComment("QuantumFlow Bot", result.reply?.payload?.text || "已创建协同编码任务，Tester 会检查功能和跨语言兼容性。");
    if (els.autoCodeInput) els.autoCodeInput.value = "";
    loadIssues();
    loadCodeArtifacts();
  } catch {
    pushComment("QuantumFlow Bot", "自动编码请求失败，请检查后端连接或稍后重试。");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "启动 Agent";
    }
  }
}

function selectAutoAgent(agentId, reason = "") {
  const normalizedAgent = agentId === "master" ? "frontend" : agentId;
  selectedAgentId = normalizedAgent;
  document.querySelectorAll("[data-auto-agent]").forEach((button) => {
    button.classList.toggle("active", button.dataset.autoAgent === normalizedAgent);
  });
  if (els.autoCodeOwner) els.autoCodeOwner.value = normalizedAgent;
  focusAgentCodeTarget(normalizedAgent, els.autoCodeInput?.value || "");
  switchView("community");
  switchOpenWorldPanel("codePanel");
  const activeRepo = openWorldRepos.find((repo) => repo.id === activeRepoId) || openWorldRepos[0];
  if (els.agentArbitrationNote) {
    const prefix = reason || `指定：${agentById(normalizedAgent)?.name || normalizedAgent}。`;
    els.agentArbitrationNote.textContent = `${prefix} 已在当前仓库找到对应代码：${activeRepo?.name || activeRepoId}/${activeFileName}。`;
  }
  renderAutoAgentMonitor();
}

async function arbitrateAutoAgent() {
  const title = els.autoCodeInput?.value.trim() || "";
  if (!title) {
    if (els.agentArbitrationNote) els.agentArbitrationNote.textContent = "选择哪个 Agent，就打开并写入它负责的代码文件。";
    return;
  }
  if (!backendConnected) {
    const localOwner = localAgentRecommendation(title);
    selectAutoAgent(localOwner);
    return;
  }
  try {
    const response = await fetch("/api/agents/arbitrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "arbitration failed");
    const recommended = result.recommended_agent || "frontend";
    const top = (result.scores || []).find((item) => item.agent_id === recommended);
    selectAutoAgent(recommended, `推荐：${top?.label || recommended} 路 score ${top?.score ?? "-"}。`);
  } catch {
    const localOwner = localAgentRecommendation(title);
    selectAutoAgent(localOwner);
  }
}

function localAgentRecommendation(title) {
  const text = title.toLowerCase();
  if (/(api|server|database|sqlite|webhook|接口|后端|数据库|存储|connector|飞书|企业微信)/.test(text)) return "backend";
  if (/(test|qa|verify|check|bug|error|测试|校验|验收|报错|验证)/.test(text)) return "tester";
  if (/(review|patch|merge|vote|adopt|审查|合并|补丁|采纳|投票|安全)/.test(text)) return "reviewer";
  return "frontend";
}

function renderLiveComments() {
  if (!els.liveComments) return;
  els.liveComments.innerHTML = liveComments
    .slice(-40)
    .reverse()
    .map(
      (comment, index) => `
      <div class="comment-bubble ${index < 3 ? "fresh" : ""} ${comment.status === "accepted" ? "accepted" : ""}">
        <div class="comment-head">
          <strong>${comment.name}</strong>
          <button class="vote-suggestion" data-comment="${comment.id}">赞 ${comment.votes}</button>
        </div>
        <span>${comment.text}</span>
        ${comment.status === "accepted" ? "<em>已写入代码区</em>" : ""}
      </div>
    `,
    )
    .join("");
  document.querySelectorAll(".vote-suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      const target = liveComments.find((comment) => String(comment.id) === button.dataset.comment);
      if (!target) return;
      target.votes += 1;
      renderLiveComments();
    });
  });
  els.liveComments.scrollTo({ top: 0, behavior: "smooth" });
}

function appendCollaborationComment(comment) {
  if (!comment) return;
  const normalized = {
    id: comment.id || Date.now(),
    name: repairMojibake(comment.name || comment.author || "Guest"),
    text: repairMojibake(comment.text || ""),
    votes: Number(comment.votes || 0),
    status: repairMojibake(comment.status || "open"),
    kind: comment.kind || "suggestion",
    target_key: repairMojibake(comment.target_key || ""),
  };
  if (normalized.kind === "admin_chat") {
    if (adminChatMessageIds.has(String(normalized.id))) return;
    if (
      isCodexAssistant(normalized.name) &&
      !String(normalized.id).startsWith("local-codex") &&
      Date.now() < suppressRemoteCodexReplyUntil
    ) {
      return;
    }
    adminChatMessageIds.add(String(normalized.id));
    adminChatMessages.push({
      name: normalized.name,
      role: normalized.target_key || "Developer",
      text: normalized.text,
    });
    adminChatMessages.splice(0, Math.max(0, adminChatMessages.length - 80));
    renderAdminChat();
    return;
  }
  if (normalized.kind === "public_chat") {
    if (publicChatMessageIds.has(String(normalized.id))) return;
    publicChatMessageIds.add(String(normalized.id));
    publicChatMessages.push({
      name: normalized.name,
      role: normalized.target_key || "开源世界",
      text: normalized.text,
    });
    publicChatMessages.splice(0, Math.max(0, publicChatMessages.length - 120));
    renderPublicChat();
    return;
  }
  if (liveComments.some((item) => String(item.id) === String(normalized.id))) return;
  liveComments.push(normalized);
  liveComments.splice(0, Math.max(0, liveComments.length - 120));
  renderLiveComments();
}

function applyChatHistory(history = {}) {
  adminChatMessages.length = 0;
  publicChatMessages.length = 0;
  adminChatMessageIds.clear();
  publicChatMessageIds.clear();
  (history.admin_chat || []).forEach(appendCollaborationComment);
  (history.public_chat || []).forEach(appendCollaborationComment);
  renderAdminChat();
  renderPublicChat();
}

function pushComment(name, text, kind = "suggestion", targetKey = codeKey()) {
  const payload = {
    command: "comment",
    name,
    text,
    kind,
    target_key: targetKey,
  };
  if (backendConnected && socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
    return;
  }
  appendCollaborationComment({
    id: Date.now(),
    name,
    text,
    kind,
    target_key: targetKey,
    votes: name === collaboratorName ? 1 : 0,
    status: "open",
  });
}

function pushRealtimeChat(name, text, kind, targetKey) {
  const payload = {
    command: "chat",
    name,
    text,
    kind,
    target_key: targetKey,
  };
  if (backendConnected && socket?.readyState === WebSocket.OPEN) {
    const codexReplyCount = adminChatMessages.filter((item) => isCodexAssistant(item.name)).length;
    socket.send(JSON.stringify(payload));
    scheduleLocalCodexReply(text, kind, codexReplyCount);
    return;
  }
  appendCollaborationComment({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    text,
    kind,
    target_key: targetKey,
    votes: 1,
    status: "open",
  });
  scheduleLocalCodexReply(text, kind, adminChatMessages.filter((item) => isCodexAssistant(item.name)).length);
}

function scheduleLocalCodexReply(text, kind, previousCodexReplyCount) {
  if (kind !== "admin_chat") return;
  window.setTimeout(() => {
    const currentCodexReplyCount = adminChatMessages.filter((item) => isCodexAssistant(item.name)).length;
    if (currentCodexReplyCount <= previousCodexReplyCount) appendLocalCodexReply(text, kind);
  }, backendConnected ? 9000 : 1200);
}

function ensureCodexAdminPresence() {
  renderOnlineCollaborators(publicWorldOnlinePeers);
}

function appendLocalCodexReply(text, kind) {
  if (kind !== "admin_chat") return;
  const normalized = String(text || "").trim().toLowerCase();
  if (!normalized) return;
  if (!isCodexAddressed(normalized)) return;
  const cleaned = stripCodexAddressing(text);
  if (isProjectLearningRequest(cleaned)) {
    startCodexProjectLearning(cleaned);
    return;
  }
  suppressRemoteCodexReplyUntil = Date.now() + 3000;
  appendCollaborationComment({
    id: `local-codex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: "Codex",
    text: codexKnowledgeReply(cleaned),
    kind: "admin_chat",
    target_key: "AI Assistant",
    votes: 0,
    status: "open",
  });
}

function isCodexAddressed(text) {
  const normalized = String(text || "").trim().toLowerCase();
  return ["@codex", "codex", "智能助手"].some((term) => normalized.includes(term));
}

function stripCodexAddressing(text) {
  return String(text || "")
    .replace(/@?codex/gi, "")
    .replace(/智能助手/g, "")
    .trim();
}

function handleCodexPageOperation(text) {
  const normalized = String(text || "").trim().toLowerCase();
  if (!isCodexAddressed(normalized)) return false;
  if (["清空", "清屏", "清除", "clear"].some((term) => normalized.includes(term))) {
    clearAdminChatPage("已清空当前开发者群聊页面。后端连接时会同步清空历史。");
    syncClearRealtimeChat("admin_chat");
    return true;
  }
  if (["帮助", "help", "命令", "操作"].some((term) => normalized.includes(term))) {
    appendCodexSystemMessage("可用页面操作：@Codex 清空页面 / 清屏；@Codex 滚到底部；@Codex 滚到顶部；@Codex 刷新在线。普通消息不会触发我回答。");
    return true;
  }
  if (["底部", "到底", "bottom"].some((term) => normalized.includes(term))) {
    els.adminChatList?.scrollTo({ top: els.adminChatList.scrollHeight, behavior: "smooth" });
    appendCodexSystemMessage("已滚动到群聊底部。");
    return true;
  }
  if (["顶部", "到顶", "top"].some((term) => normalized.includes(term))) {
    els.adminChatList?.scrollTo({ top: 0, behavior: "smooth" });
    appendCodexSystemMessage("已滚动到群聊顶部。");
    return true;
  }
  if (["刷新在线", "在线列表", "online"].some((term) => normalized.includes(term))) {
    renderOnlineCollaborators(publicWorldOnlinePeers);
    loadRealtimeServiceStatus();
    appendCodexSystemMessage("已刷新在线状态。");
    return true;
  }
  return false;
}

function clearAdminChatPage(confirmText = "") {
  adminChatMessages.length = 0;
  adminChatMessageIds.clear();
  if (confirmText) appendCodexSystemMessage(confirmText);
  else renderAdminChat();
}

function appendCodexSystemMessage(text) {
  appendCollaborationComment({
    id: `local-codex-op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: "Codex",
    text,
    kind: "admin_chat",
    target_key: "AI Assistant",
    votes: 0,
    status: "open",
  });
}

function syncClearRealtimeChat(kind = "admin_chat") {
  if (backendConnected && socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ command: "clear_chat", kind }));
    return;
  }
  if (location.protocol !== "file:") {
    fetch(`/api/realtime/chat?kind=${encodeURIComponent(kind)}`, { method: "DELETE" }).catch(() => {});
  }
}

function handleRealtimeChatCleared(data = {}) {
  if ((data.kind || "admin_chat") !== "admin_chat") return;
  clearAdminChatPage("群聊页面已清空。");
}

function textHasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function isProjectLearningRequest(text) {
  const normalized = String(text || "").toLowerCase();
  return textHasAny(normalized, ["学习整个项目", "学习项目", "预训练", "训练整个项目", "项目知识库", "索引整个项目"]);
}

async function startCodexProjectLearning(text) {
  suppressRemoteCodexReplyUntil = Date.now() + 5000;
  appendCollaborationComment({
    id: `local-codex-learning-start-${Date.now()}`,
    name: "Codex",
    text: "可以做，但这里不是重新预训练模型权重，而是把整个项目扫描成 Codex 项目知识库/RAG 索引。我现在开始读取源码、文档和数据库结构。",
    kind: "admin_chat",
    target_key: "AI Assistant",
    votes: 0,
    status: "open",
  });
  try {
    const response = await fetch("/api/codex-rag/learn-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 160, reason: text }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "项目学习失败");
    appendCollaborationComment({
      id: `local-codex-learning-done-${Date.now()}`,
      name: "Codex",
      text: `项目学习完成：已索引 ${result.file_count} 个文件，写入 ${result.memory_count} 条 Codex 记忆，覆盖源码、前端页面、设计文档和 SQLite 表结构。之后你问架构、接口、页面、数据库或 Agent 分工时，我会从这些项目记忆里检索上下文再回答。说明：这是项目级 RAG/上下文注入，不是真正重训模型。`,
      kind: "admin_chat",
      target_key: "AI Assistant",
      votes: 0,
      status: "open",
    });
  } catch (error) {
    appendCollaborationComment({
      id: `local-codex-learning-failed-${Date.now()}`,
      name: "Codex",
      text: `项目学习没有完成：${error.message || "未知错误"}。可以先确认后端服务是否在 127.0.0.1:8765 正常运行。`,
      kind: "admin_chat",
      target_key: "AI Assistant",
      votes: 0,
      status: "open",
    });
  }
}

function codexKnowledgeReply(text) {
  const cleaned = stripCodexAddressing(text);
  const normalized = cleaned.toLowerCase();
  const arithmetic = answerSimpleArithmetic(cleaned);
  if (arithmetic) return arithmetic;
  if (isProjectLearningRequest(cleaned)) {
    return "可以。我会把它做成项目级 RAG/上下文索引：扫描源码、文档和数据库结构，写入 Codex 记忆。严格说这不是模型预训练，而是让当前 Codex 在回答时检索整个项目上下文。";
  }
  if (!normalized) return "我在。你可以直接问我问题，也可以让我看当前页面、解释代码、生成补丁或接入模型插件。";
  if (textHasAny(normalized, ["你好", "hello", "hi", "在吗"])) {
    return "我在。你直接问就行，我会先回答问题本身；只有你问 QuantumFlow 架构、Agent 分工或交付流程时，我才切回系统设计文档。";
  }
  if (textHasAny(normalized, ["你是谁", "你能干什么", "能做什么", "会什么", "介绍一下你"])) {
    return "我是这个 QuantumFlow 桌面里的 Codex 助手。这里我主要能做三类事：回答开发问题，帮你改页面/写代码/查 bug，以及把当前代码区的内容交给 Agent 或大模型插件生成候选补丁。";
  }
  if (textHasAny(normalized, ["deepseek", "deep seek", "深度求索"])) {
    return "知道。DeepSeek 是一家做大模型的团队/产品线，比较常被开发者关注的是它的推理模型和代码模型能力，以及 OpenAI-compatible API 接入方式。放到你这个页面里，可以把它作为“手动编码”的模型插件：填 DeepSeek 的 API Base、Key 和模型名，然后让它基于当前文件生成补丁或解释代码。";
  }
  if (textHasAny(normalized, ["openai", "gpt", "claude", "qwen", "通义", "gemini", "ollama", "本地模型", "大模型", "llm"])) {
    return "可以接。这个手动编码面板适合按 OpenAI-compatible 协议接模型：API Base、API Key、模型名和提示词四项就够了。云模型适合质量优先，本地/Ollama 适合隐私和离线开发，生成结果再进入代码区和 Review。";
  }
  if (textHasAny(normalized, ["为什么", "怎么", "如何", "哪里", "哪个", "什么", "吗", "嘛", "？", "?"])) {
    return `我理解你的问题是：“${cleaned}”。这不是 QuantumFlow 设计文档里的固定条目，我先按普通助手回答：你可以把具体对象、报错或目标再补一句，我会直接给结论、原因和可执行改法，不再套任务拆解模板。`;
  }
  if (textHasAny(normalized, ["架构", "系统", "分层", "control", "plane", "master", "slave", "pulsar", "redis", "vector", "graph", "k8s"])) {
    return codexKnowledgeProfile.architecture;
  }
  if (textHasAny(normalized, ["codex", "后端", "api", "数据库", "事务", "权重"])) {
    return codexKnowledgeProfile.codex;
  }
  if (textHasAny(normalized, ["rag", "skill", "提示词", "系统提示", "预训练", "训练", "知识库", "context"])) {
    return `${codexKnowledgeProfile.llm} 这次我做的是工程化知识注入：把文档蒸馏成助手上下文和回复规则，而不是重新训练模型权重。`;
  }
  if (textHasAny(normalized, ["自愈", "gap", "测试", "qa", "错误", "修复", "路由", "插桩"])) {
    return codexKnowledgeProfile.quality;
  }
  if (textHasAny(normalized, ["流程", "交付", "步骤", "闭环", "沙箱", "git", "环境"])) {
    return codexKnowledgeProfile.workflow;
  }
  if (textHasAny(normalized, ["投票", "仲裁", "human", "否决", "gemini", "opencode"])) {
    return codexKnowledgeProfile.api;
  }
  if (textHasAny(normalized, ["愿景", "社区", "开源", "github", "未来"])) {
    return codexKnowledgeProfile.vision;
  }
  return `收到：${cleaned}。我会按普通问题处理，不再强行套 QuantumFlow 流程。你可以继续补充目标、代码片段或报错，我会直接给答案和改法。`;
}

function answerSimpleArithmetic(text) {
  const expression = String(text || "").replace(/[=？?]/g, "").trim();
  if (!expression || !/^[\d+\-*/().\s]+$/.test(expression) || !/[+\-*/]/.test(expression)) return "";
  try {
    const value = Function(`"use strict"; return (${expression});`)();
    if (Number.isFinite(value)) return String(value);
  } catch {
    return "";
  }
  return "";
}

async function loadRealtimeChatHistory() {
  if (location.protocol === "file:") return;
  try {
    const [adminResponse, publicResponse] = await Promise.all([
      fetch("/api/realtime/chat?kind=admin_chat&limit=100"),
      fetch("/api/realtime/chat?kind=public_chat&limit=120"),
    ]);
    const history = {
      admin_chat: adminResponse.ok ? await adminResponse.json() : [],
      public_chat: publicResponse.ok ? await publicResponse.json() : [],
    };
    applyChatHistory(history);
  } catch {
    ensureCodexAdminPresence();
    renderAdminChat();
    renderPublicChat();
  }
}

async function adoptLatestSuggestion() {
  const suggestion = liveComments
    .filter((comment) => comment.status !== "accepted")
    .sort((a, b) => b.votes - a.votes)[0];
  if (!suggestion) return;

  const activeRepo = openWorldRepos.find((repo) => repo.id === activeRepoId) || openWorldRepos[0];
  const targetKey = patchTargetMap[codeKey()] || `${activeRepoId}/${activeFileName}`;
  if (backendConnected) {
    try {
      const preview = await fetch("/api/patch/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_key: targetKey,
          suggestion: suggestion.text,
          task_id: "review-auto",
          reviewer_id: suggestion.name || "reviewer",
          vote_count: suggestion.votes,
          vote_weight: suggestion.name.includes("Reviewer") ? 2 : 1,
        }),
      });
      const previewData = await preview.json();
      if (!preview.ok || !previewData.validation?.ok) {
        pushComment("Reviewer Agent", `拒绝写入：${previewData.detail?.reason || previewData.validation?.reason || "校验失败"}`);
        renderPatchPreview(previewData);
        return;
      }
      activePatchCandidate = { ...previewData, suggestionId: suggestion.id };
      renderPatchPreview(activePatchCandidate);
      pushComment("Reviewer Agent", `候选补丁 ${previewData.id} 已通过校验，等待队长确认应用。`);
      return;
    } catch (error) {
      pushComment("System", "后端 patch API 暂不可用，切回本地预览采纳。");
    }
  }

  const nextCode = [...codeForActiveFile(activeRepo, activeFileName), "", `// accepted suggestion (${suggestion.votes} votes): ${suggestion.text}`];
  const validation = validateGeneratedCode(nextCode);
  if (!validation.ok) {
    pushComment("Reviewer Agent", `拒绝写入：${validation.reason}`);
    return;
  }

  generatedCodeOverrides[codeKey()] = nextCode;
  suggestion.status = "accepted";
  pushComment("Master Agent", `最高票建议已通过校验并写入 ${activeFileName}。`);
  addLog(`采纳最高票建议：${suggestion.text}`, "Master");
  renderCommunity();
}

function renderPatchPreview(candidate) {
  if (!els.patchPreviewPanel) return;
  if (!candidate) {
    els.patchPreviewPanel.innerHTML = '<div class="patch-preview-empty">暂无候选补丁。先给建议投票，再生成候选。</div>';
    return;
  }
  const ok = candidate.validation?.ok;
  els.patchPreviewPanel.innerHTML = `
    <div class="patch-preview-card ${ok ? "valid" : "invalid"}">
      <div class="patch-preview-head">
        <strong>${candidate.id || "local-preview"} 路 ${candidate.target_key || ""}</strong>
        <span>${ok ? "校验通过" : "校验失败"}</span>
      </div>
      <pre>${(candidate.preview_lines || []).join("\n")}</pre>
      <div class="patch-preview-actions">
        <button id="confirmPatchApply" ${ok ? "" : "disabled"}>确认应用</button>
        <button id="discardPatchCandidate">丢弃</button>
      </div>
    </div>
  `;
  document.getElementById("confirmPatchApply")?.addEventListener("click", applyActivePatchCandidate);
  document.getElementById("discardPatchCandidate")?.addEventListener("click", () => {
    activePatchCandidate = null;
    renderPatchPreview(null);
  });
}

async function applyActivePatchCandidate() {
  if (!activePatchCandidate) return;
  const activeRepo = openWorldRepos.find((repo) => repo.id === activeRepoId) || openWorldRepos[0];
  if (backendConnected && activePatchCandidate.id) {
    const response = await fetch(`/api/patch/candidates/${activePatchCandidate.id}/apply`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      pushComment("Reviewer Agent", `应用失败：${data.detail?.reason || data.detail || "后端拒绝应用候选补丁"}`);
      return;
    }
    generatedCodeOverrides[codeKey()] = [...codeForActiveFile(activeRepo, activeFileName), "", ...(activePatchCandidate.preview_lines || [])];
    const suggestion = liveComments.find((comment) => comment.id === activePatchCandidate.suggestionId);
    if (suggestion) suggestion.status = "accepted";
    pushComment("Master Agent", `${activePatchCandidate.id} 已应用，备份已生成。`);
    addLog(`应用候选补丁：${activePatchCandidate.target_key}`, "Master");
    activePatchCandidate = null;
    renderPatchPreview(null);
    loadPatchHistory();
    renderCommunity();
    return;
  }
  generatedCodeOverrides[codeKey()] = [...codeForActiveFile(activeRepo, activeFileName), "", ...(activePatchCandidate.preview_lines || [])];
  activePatchCandidate = null;
  renderPatchPreview(null);
  renderCommunity();
}

function validateGeneratedCode(lines) {
  const joined = lines.join("\n");
  if (/<template>[\s\S]*\{\{/.test(joined) || /v-for|v-model|@click|@submit/.test(joined)) {
    if (!joined.includes("<script setup>") && joined.includes("</template>")) {
      return { ok: false, reason: "Vue 单文件组件缺少 <script setup>。" };
    }
    return { ok: true };
  }
  const pairs = [
    ["(", ")"],
    ["{", "}"],
    ["[", "]"],
  ];
  for (const [open, close] of pairs) {
    const opens = (joined.match(new RegExp(`\\${open}`, "g")) || []).length;
    const closes = (joined.match(new RegExp(`\\${close}`, "g")) || []).length;
    if (opens !== closes) return { ok: false, reason: `括号不匹配：${open}${close}` };
  }
  if (joined.includes("syntax_error") || joined.includes("鎶ラ敊")) {
    return { ok: false, reason: "建议内容包含显式错误标记。" };
  }
  return { ok: true };
}

function sanitizeCodeText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ");
}

function inferBusinessSpec(title) {
  const text = String(title || "").toLowerCase();
  const frontendOnly = /(前端|frontend|ui|页面|界面)/.test(text) && !/(后端|接口|api|数据库|全栈|fullstack)/.test(text);
  const framework = /(vue3|vue 3|vue)/.test(text) ? "vue3" : "vanilla";
  const base = {
    domain: "generic",
    framework,
    scope: frontendOnly ? "frontend_only" : "fullstack",
    entityLabel: "业务事项",
    ownerLabel: "负责人",
    seedItems: ["需求确认", "执行推进", "结果验收"],
  };
  if (/(图书|图书馆|书籍|借阅|library|book)/.test(text)) {
    return {
      ...base,
      domain: "library",
      entityLabel: "图书",
      ownerLabel: "馆藏管理员",
      seedItems: ["人月神话", "代码大全", "深入理解计算机系统"],
    };
  }
  if (/(客户|crm|客服|销售)/.test(text)) {
    return { ...base, domain: "crm", entityLabel: "客户", ownerLabel: "客户经理", seedItems: ["重点客户跟进", "合同续签提醒", "售后问题处理"] };
  }
  if (/(订单|电商|商城|交易)/.test(text)) {
    return { ...base, domain: "order", entityLabel: "订单", ownerLabel: "运营负责人", seedItems: ["待支付订单", "发货异常订单", "售后退款订单"] };
  }
  if (/(员工|人事|hr|考勤)/.test(text)) {
    return { ...base, domain: "hr", entityLabel: "员工事项", ownerLabel: "HR 负责人", seedItems: ["入职资料确认", "考勤异常处理", "绩效面谈安排"] };
  }
  if (/(oa|办公|审批|请假|报销|流程|公文|公告|会议)/.test(text)) {
    return { ...base, domain: "oa", entityLabel: "OA流程", ownerLabel: "行政负责人", seedItems: ["请假审批", "费用报销", "会议室预定"] };
  }
  if (/(项目|研发|开发|代码|仓库)/.test(text)) {
    return { ...base, domain: "development", entityLabel: "开发任务", ownerLabel: "技术负责人", seedItems: ["前端页面实现", "后端接口联调", "测试验收通过"] };
  }
  return base;
}

function isVue3FrontendSpec(spec) {
  return spec.scope === "frontend_only" && spec.framework === "vue3";
}

function vue3BookSeedItems() {
  return [
    { title: "人月神话", author: "Frederick P. Brooks", category: "软件工程", status: "在馆" },
    { title: "代码大全", author: "Steve McConnell", category: "编程实践", status: "借出" },
    { title: "深入理解计算机系统", author: "Randal E. Bryant", category: "计算机系统", status: "预约" },
  ];
}

function vue3LibraryAdminArtifactLines(fileName, taskId, title, branch) {
  const books = JSON.stringify(vue3BookSeedItems(), null, 2);
  const appTitle = "图书管理系统";
  if (fileName.endsWith("src/App.vue")) {
    return [
      "<script setup>",
      "import { computed, reactive } from \"vue\";",
      "",
      "const state = reactive({",
      `  taskId: "${taskId}",`,
      `  title: "${appTitle}",`,
      "  query: \"\",",
      "  category: \"全部分类\",",
      "  status: \"全部状态\",",
      "  form: { accessionNo: \"\", title: \"\", author: \"\", publisher: \"\", category: \"软件工程\", status: \"在馆\" },",
      `  books: ${books}.map((book, index) => ({`,
      "    id: index + 1,",
      "    accessionNo: `B-2026-${String(index + 1).padStart(3, \"0\")}`,",
      "    publisher: index === 0 ? \"Addison-Wesley\" : index === 1 ? \"Microsoft Press\" : \"Pearson\",",
      "    publishDate: \"2026-06-05\",",
      "    ...book,",
      "  })),",
      "});",
      "",
      "const categories = computed(() => [\"全部分类\", ...new Set(state.books.map((book) => book.category))]);",
      "const statusOptions = [\"全部状态\", \"在馆\", \"借出\", \"预约\", \"维护\"];",
      "const filteredBooks = computed(() => {",
      "  const query = state.query.trim().toLowerCase();",
      "  return state.books.filter((book) => {",
      "    const text = `${book.accessionNo} ${book.title} ${book.author} ${book.publisher} ${book.category} ${book.status}`.toLowerCase();",
      "    return (!query || text.includes(query)) &&",
      "      (state.category === \"全部分类\" || book.category === state.category) &&",
      "      (state.status === \"全部状态\" || book.status === state.status);",
      "  });",
      "});",
      "const stats = computed(() => ({",
      "  total: state.books.length,",
      "  available: state.books.filter((book) => book.status === \"在馆\").length,",
      "  borrowed: state.books.filter((book) => book.status === \"借出\").length,",
      "  categories: new Set(state.books.map((book) => book.category)).size,",
      "}));",
      "",
      "function addBook() {",
      "  if (!state.form.title.trim() || !state.form.author.trim()) return;",
      "  state.books.unshift({",
      "    id: Date.now(),",
      "    accessionNo: state.form.accessionNo.trim() || `B-2026-${Date.now().toString().slice(-4)}`,",
      "    publishDate: new Date().toISOString().slice(0, 10),",
      "    ...state.form,",
      "  });",
      "  state.form = { accessionNo: \"\", title: \"\", author: \"\", publisher: \"\", category: \"软件工程\", status: \"在馆\" };",
      "}",
      "",
      "function setStatus(book, status) { book.status = status; }",
      "function removeBook(id) {",
      "  const index = state.books.findIndex((book) => book.id === id);",
      "  if (index >= 0) state.books.splice(index, 1);",
      "}",
      "</script>",
      "",
      "<template>",
      "  <div class=\"library-admin\">",
      "    <aside class=\"library-sidebar\">",
      "      <div class=\"system-title\">Sistema de Administracion de Biblioteca</div>",
      "      <button class=\"side-item active\">图书管理</button>",
      "      <button class=\"side-item\">借阅人</button>",
      "      <button class=\"side-item\">借出图书</button>",
      "      <button class=\"side-item\">归还图书</button>",
      "      <button class=\"side-item\">分类</button>",
      "      <button class=\"side-item\">用户</button>",
      "      <button class=\"side-item\">报表</button>",
      "    </aside>",
      "    <main class=\"library-workbench\">",
      "      <header class=\"library-topbar\"><h1>{{ state.title }}</h1><span>Vue3 / Manage Books</span></header>",
      "      <section class=\"summary-strip\">",
      "        <article><strong>{{ stats.total }}</strong><span>馆藏总数</span></article>",
      "        <article><strong>{{ stats.available }}</strong><span>在馆</span></article>",
      "        <article><strong>{{ stats.borrowed }}</strong><span>借出</span></article>",
      "        <article><strong>{{ stats.categories }}</strong><span>分类</span></article>",
      "      </section>",
      "      <section class=\"manage-panel\">",
      "        <div class=\"panel-title\">Manage Books</div>",
      "        <form class=\"book-editor\" @submit.prevent=\"addBook\">",
      "          <label>Accession No.<input v-model=\"state.form.accessionNo\" placeholder=\"例如 B-2026-004\" /></label>",
      "          <label>Book Title<input v-model=\"state.form.title\" placeholder=\"书名\" /></label>",
      "          <label>Author<input v-model=\"state.form.author\" placeholder=\"作者\" /></label>",
      "          <label>Publisher<input v-model=\"state.form.publisher\" placeholder=\"出版社\" /></label>",
      "          <label>Category<input v-model=\"state.form.category\" placeholder=\"分类\" /></label>",
      "          <label>Status<select v-model=\"state.form.status\"><option>在馆</option><option>借出</option><option>预约</option><option>维护</option></select></label>",
      "          <div class=\"form-actions\"><button type=\"submit\">Grabar</button><button type=\"button\" @click=\"state.form = { accessionNo: '', title: '', author: '', publisher: '', category: '软件工程', status: '在馆' }\">Nuevo</button></div>",
      "        </form>",
      "        <div class=\"search-row\">",
      "          <label>Buscar<input v-model=\"state.query\" placeholder=\"搜索书名、作者、编号或分类\" /></label>",
      "          <select v-model=\"state.category\"><option v-for=\"item in categories\" :key=\"item\">{{ item }}</option></select>",
      "          <select v-model=\"state.status\"><option v-for=\"item in statusOptions\" :key=\"item\">{{ item }}</option></select>",
      "        </div>",
      "        <table class=\"book-table\">",
      "          <thead><tr><th>Accession</th><th>Book Title</th><th>Description</th><th>Author</th><th>Publish Date</th><th>Publisher</th><th>Category</th><th>Status</th><th>Action</th></tr></thead>",
      "          <tbody>",
      "            <tr v-for=\"book in filteredBooks\" :key=\"book.id\">",
      "              <td>{{ book.accessionNo }}</td><td>{{ book.title }}</td><td>{{ book.category }} / {{ book.status }}</td><td>{{ book.author }}</td><td>{{ book.publishDate }}</td><td>{{ book.publisher }}</td><td>{{ book.category }}</td>",
      "              <td><select :value=\"book.status\" @change=\"setStatus(book, $event.target.value)\"><option>在馆</option><option>借出</option><option>预约</option><option>维护</option></select></td>",
      "              <td><button class=\"text-button\" @click=\"removeBook(book.id)\">删除</button></td>",
      "            </tr>",
      "          </tbody>",
      "        </table>",
      "      </section>",
      "    </main>",
      "  </div>",
      "</template>",
    ];
  }
  if (fileName.endsWith("src/style.css")) {
    return [
      ":root { font-family: 'Segoe UI', 'Microsoft YaHei', Arial, sans-serif; color: #122033; background: #e6edf5; }",
      "* { box-sizing: border-box; }",
      "body { margin: 0; min-height: 100vh; background: #d8e5ef; color: #102033; }",
      "button, input, select { font: inherit; }",
      ".library-admin { display: grid; grid-template-columns: 190px minmax(0, 1fr); min-height: 100vh; }",
      ".library-sidebar { background: #07466d; color: #fff; border-right: 1px solid #043654; }",
      ".system-title { height: 52px; display: flex; align-items: center; padding: 0 12px; background: #053858; font-size: 14px; font-weight: 700; }",
      ".side-item { display: block; width: 100%; height: 42px; border: 0; border-bottom: 1px solid rgba(255,255,255,.16); background: #0b5b89; color: #eaf7ff; text-align: left; padding: 0 14px; cursor: pointer; }",
      ".side-item.active { background: #1684bd; }",
      ".library-workbench { min-width: 0; padding: 18px 22px; }",
      ".library-topbar { height: 58px; display: flex; align-items: center; justify-content: space-between; padding: 0 18px; background: #0a4a72; color: #fff; border: 1px solid #063a5b; }",
      ".library-topbar h1 { margin: 0; font-size: 24px; }",
      ".library-topbar span { font-size: 13px; color: #c9e9ff; }",
      ".summary-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 14px 0; }",
      ".summary-strip article { background: #fff; border: 1px solid #aac1d1; padding: 12px; }",
      ".summary-strip strong { display: block; font-size: 24px; color: #0a4a72; }",
      ".summary-strip span { font-size: 12px; color: #526575; }",
      ".manage-panel { background: #fff; border: 1px solid #9eb7c9; padding: 12px; box-shadow: 0 1px 2px rgba(16,32,51,.12); }",
      ".panel-title { font-weight: 800; margin-bottom: 10px; color: #14324a; }",
      ".book-editor { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)) 150px; gap: 8px 14px; align-items: end; margin-bottom: 12px; }",
      ".book-editor label, .search-row label { display: grid; gap: 4px; font-size: 12px; color: #23384a; }",
      ".book-editor input, .book-editor select, .search-row input, .search-row select, .book-table select { height: 30px; border: 1px solid #a7bbc9; background: #fff; color: #102033; padding: 0 8px; }",
      ".form-actions { display: flex; gap: 8px; }",
      ".form-actions button { height: 32px; border: 1px solid #7d9db4; background: #e7f0f7; color: #102033; padding: 0 14px; cursor: pointer; }",
      ".form-actions button:first-child { background: #d8edf9; }",
      ".search-row { display: grid; grid-template-columns: minmax(220px, 1fr) 180px 160px; gap: 10px; margin: 8px 0 12px; align-items: end; }",
      ".book-table { width: 100%; border-collapse: collapse; font-size: 12px; }",
      ".book-table th { background: #dbe7f0; color: #17324a; border: 1px solid #9eb7c9; text-align: left; padding: 7px; }",
      ".book-table td { border: 1px solid #b6c8d5; padding: 6px; vertical-align: middle; }",
      ".book-table tr:nth-child(even) { background: #f4f8fb; }",
      ".text-button { height: 28px; border: 1px solid #9eb7c9; background: #fff; color: #0a5d8f; cursor: pointer; }",
      "@media (max-width: 860px) { .library-admin { grid-template-columns: 1fr; } .library-sidebar { display: none; } .book-editor, .search-row, .summary-strip { grid-template-columns: 1fr; } .library-workbench { padding: 12px; } .book-table { display: block; overflow: auto; white-space: nowrap; } }",
    ];
  }
  if (fileName.endsWith("tests/book.spec.js")) {
    return [
      "import assert from \"node:assert/strict\";",
      "import fs from \"node:fs\";",
      "",
      "const html = fs.readFileSync(\"index.html\", \"utf8\");",
      "const main = fs.readFileSync(\"src/main.js\", \"utf8\");",
      "const vue = fs.readFileSync(\"src/App.vue\", \"utf8\");",
      "const css = fs.readFileSync(\"src/style.css\", \"utf8\");",
      "",
      "assert.match(html, /id=\"app\"/);",
      "assert.match(main, /createApp/);",
      "assert.match(vue, /图书管理系统/);",
      "assert.match(vue, /Manage Books/);",
      "assert.match(vue, /book-table/);",
      "assert.match(vue, /Accession No/);",
      "assert.match(vue, /removeBook/);",
      "assert.match(css, /library-sidebar/);",
      "assert.match(html, /type=\"module\"/);",
      "assert.match(main, /vue@3|createApp/);",
      "assert.ok(!main.includes(\"/api/tasks\"), \"frontend-only project must not depend on FastAPI task API\");",
      "",
      `console.log("vue3 library admin smoke ok with compat gate: ${taskId}");`,
    ];
  }
  if (fileName.endsWith("docs/review-checklist.md")) {
    return [
      "# Reviewer 审查清单",
      "",
      `- 任务：${title}`,
      `- 任务 ID：${taskId}`,
      `- 分支：${branch}`,
      "- 识别结果：Vue3 图书管理后台前端",
      "",
      "## 必须通过",
      "",
      "- [x] 页面名称固定为“图书管理系统”，不再把需求句子当标题。",
      "- [x] 页面结构是后台管理系统：左侧菜单、顶部标题、录入表单、搜索区、表格区。",
      "- [x] 支持新增图书、搜索、分类筛选、状态筛选。",
      "- [x] 支持状态修改和删除图书。",
      "- [x] 测试 Agent 检查后台管理布局和核心业务文案。",
      "- [x] 测试 Agent 检查 Vue3/Vite/浏览器模块入口兼容，不兼容则退回原 Agent 免费重构。",
    ];
  }
  if (fileName.endsWith("README.md")) {
    return [
      "# 图书管理系统",
      "",
      "这是 QuantumFlow 根据任务语义生成的 Vue3 图书管理后台前端项目。",
      "",
      "## 需求理解",
      "",
      "- 业务领域：图书馆 / 馆藏后台管理",
      "- 技术栈：Vue3",
      "- 开发范围：前端页面，不强行生成后端任务系统",
      "- 核心功能：后台菜单、图书录入、搜索、分类筛选、状态筛选、表格管理、状态修改和删除",
      "- 命名修正：页面名称固定为“图书管理系统”，不再把用户指令原文当作系统标题",
      "",
      "## 运行",
      "",
      "```powershell",
      "npm install",
      "npm run dev",
      "```",
      "",
      `任务 ID：${taskId}`,
      `原始任务：${title}`,
    ];
  }
  return null;
}

function preferredProjectEntryFile(taskLike = {}) {
  const spec = inferBusinessSpec(taskLike.title || "");
  return isVue3FrontendSpec(spec) ? "src/App.vue" : "app/static/app.js";
}

function businessModelForSpec(spec, title = "") {
  const models = {
    oa: {
      appName: "OA 协同办公系统",
      entity: "审批单",
      apiBase: "approvals",
      peopleApi: "employees",
      actor: "applicant",
      actorLabel: "申请人",
      ownerLabel: "审批人",
      statuses: ["待审批", "已通过", "已驳回"],
      fields: ["title", "applicant", "department", "amount", "reason", "status"],
      seed: [
        { title: "请假审批", applicant: "林亦然", department: "研发部", amount: "-", reason: "年假 2 天", status: "待审批" },
        { title: "费用报销", applicant: "周明", department: "财务部", amount: "860.50", reason: "客户拜访交通费", status: "已通过" },
        { title: "会议室预定", applicant: "陈青", department: "行政部", amount: "-", reason: "周会会议室", status: "待审批" },
      ],
    },
    crm: {
      appName: "CRM 客户跟进系统",
      entity: "客户",
      apiBase: "customers",
      peopleApi: "owners",
      actor: "manager",
      actorLabel: "客户经理",
      ownerLabel: "负责人",
      statuses: ["待跟进", "洽谈中", "已成交", "已流失"],
      fields: ["title", "manager", "department", "amount", "reason", "status"],
      seed: [
        { title: "重点客户跟进", manager: "赵琪", department: "销售一组", amount: "120000", reason: "续约评估", status: "洽谈中" },
        { title: "售后问题处理", manager: "宋远", department: "客户成功", amount: "-", reason: "工单升级", status: "待跟进" },
      ],
    },
    order: {
      appName: "订单运营系统",
      entity: "订单",
      apiBase: "orders",
      peopleApi: "operators",
      actor: "operator",
      actorLabel: "运营人",
      ownerLabel: "运营负责人",
      statuses: ["待支付", "待发货", "售后中", "已完成"],
      fields: ["title", "operator", "department", "amount", "reason", "status"],
      seed: [
        { title: "待支付订单", operator: "唐宁", department: "商城运营", amount: "399.00", reason: "催付", status: "待支付" },
        { title: "售后退款订单", operator: "许岚", department: "售后", amount: "89.00", reason: "质量问题", status: "售后中" },
      ],
    },
    hr: {
      appName: "人事协同系统",
      entity: "员工事项",
      apiBase: "hr-items",
      peopleApi: "employees",
      actor: "employee",
      actorLabel: "员工",
      ownerLabel: "HR 负责人",
      statuses: ["待处理", "处理中", "已完成", "已退回"],
      fields: ["title", "employee", "department", "amount", "reason", "status"],
      seed: [
        { title: "入职资料确认", employee: "李然", department: "研发部", amount: "-", reason: "新员工入职", status: "待处理" },
        { title: "考勤异常处理", employee: "韩青", department: "市场部", amount: "-", reason: "补卡申请", status: "处理中" },
      ],
    },
  };
  const fallback = {
    appName: `${spec.entityLabel || "业务"}管理系统`,
    entity: spec.entityLabel || "业务事项",
    apiBase: "items",
    peopleApi: "members",
    actor: "owner",
    actorLabel: spec.ownerLabel || "负责人",
    ownerLabel: spec.ownerLabel || "负责人",
    statuses: ["待处理", "进行中", "已完成", "已阻塞"],
    fields: ["title", "owner", "department", "amount", "reason", "status"],
    seed: (spec.seedItems || ["需求确认", "执行推进", "结果验收"]).map((item, index) => ({
      title: item,
      owner: spec.ownerLabel || "负责人",
      department: index === 0 ? "业务部" : "执行组",
      amount: "-",
      reason: title || "业务流程推进",
      status: index === 2 ? "已完成" : "待处理",
    })),
  };
  return models[spec.domain] || fallback;
}

function buildAgentWorkPlan(agentId, taskLike = {}, fileName = "") {
  const title = taskLike.workflowTitle || taskLike.title || "QuantumFlow 自动任务";
  const spec = inferBusinessSpec(title);
  const model = businessModelForSpec(spec, title);
  const roleFocus = {
    frontend: `把 ${model.entity} 做成可操作工作台，包含筛选、列表、状态流转和新增入口。`,
    backend: `提供 ${model.entity} 的 REST API、初始数据、创建和状态决策接口。`,
    tester: `验证 ${model.entity} 的健康检查、列表读取、创建和状态流转，不复制实现代码。`,
    reviewer: `检查前后端契约、测试覆盖、职责边界和是否生成了真实业务功能。`,
  }[agentId] || "按技术书拆解职责并产出可运行代码。";
  return {
    title,
    spec,
    model,
    fileName,
    roleFocus,
    decisions: [
      `业务域：${model.appName}`,
      `核心实体：${model.entity}`,
      `状态流：${model.statuses.join(" -> ")}`,
      `目标文件：${fileName}`,
      `职责判断：${roleFocus}`,
    ],
  };
}

function agentDecisionHeader(plan, prefix = "//") {
  return [
    `${prefix} Agent 工作判断`,
    `${prefix} ${plan.decisions.join("；")}`,
    "",
  ];
}

function autonomousAgentArtifactLines(agentId, taskLike = {}, fileName = "", taskId = "") {
  const plan = buildAgentWorkPlan(agentId, taskLike, fileName);
  const model = plan.model;
  const safeSeed = JSON.stringify(model.seed, null, 2);
  const statuses = JSON.stringify(model.statuses);
  if (agentId === "backend") {
    const actor = model.actor;
    return [
      ...agentDecisionHeader(plan, "#"),
      "from fastapi import FastAPI, HTTPException",
      "from pydantic import BaseModel",
      "",
      `app = FastAPI(title="${model.appName}")`,
      "",
      "class BusinessItemCreate(BaseModel):",
      "    title: str",
      `    ${actor}: str`,
      "    department: str = \"综合部\"",
      "    amount: str | None = None",
      "    reason: str = \"\"",
      "",
      `items = ${safeSeed}`,
      `people = [{"id": 1, "name": "林亦然", "role": "${model.ownerLabel}", "department": "综合部"}]`,
      "",
      "@app.get(\"/api/health\")",
      "def health():",
      `    return {"ok": True, "service": "${model.apiBase}", "task_id": "${taskId}"}`,
      "",
      `@app.get("/api/${model.peopleApi}")`,
      "def list_people():",
      "    return people",
      "",
      `@app.get("/api/${model.apiBase}")`,
      "def list_items(status: str | None = None):",
      "    if not status or status == \"全部\":",
      "        return items",
      "    return [item for item in items if item[\"status\"] == status]",
      "",
      `@app.post("/api/${model.apiBase}")`,
      "def create_item(payload: BusinessItemCreate):",
      "    next_id = max([int(item.get(\"id\", 0)) for item in items] + [100]) + 1",
      "    item = {\"id\": next_id, \"status\": \"待处理\", **payload.model_dump()}",
      "    if item[\"status\"] not in " + JSON.stringify(model.statuses).replace(/"/g, "\"") + ":",
      `        item["status"] = "${model.statuses[0]}"`,
      "    items.insert(0, item)",
      "    return item",
      "",
      `@app.post("/api/${model.apiBase}/{item_id}/decision")`,
      "def decide_item(item_id: int, status: str):",
      `    allowed = ${statuses}`,
      "    if status not in allowed:",
      "        raise HTTPException(status_code=400, detail=\"invalid status\")",
      "    for item in items:",
      "        if int(item.get(\"id\", 0)) == item_id:",
      "            item[\"status\"] = status",
      "            return item",
      "    raise HTTPException(status_code=404, detail=\"item not found\")",
    ];
  }
  if (agentId === "tester") {
    return [
      ...agentDecisionHeader(plan, "#"),
      "from fastapi.testclient import TestClient",
      "from app.main import app",
      "",
      "client = TestClient(app)",
      "",
      "def test_health_and_business_lists():",
      `    assert client.get("/api/health").json()["service"] == "${model.apiBase}"`,
      `    assert len(client.get("/api/${model.peopleApi}").json()) >= 1`,
      `    data = client.get("/api/${model.apiBase}").json()`,
      "    assert isinstance(data, list)",
      `    assert any(item["title"] == "${model.seed[0]?.title || model.entity}" for item in data)`,
      "",
      "def test_create_and_decide_business_item():",
      `    payload = {"title": "${model.entity}自动化验收", "${model.actor}": "测试用户", "department": "测试部", "amount": "128.00", "reason": "自动化测试"}`,
      `    created = client.post("/api/${model.apiBase}", json=payload).json()`,
      `    assert created["status"] == "${model.statuses[0]}"`,
      `    decided = client.post(f"/api/${model.apiBase}/{created['id']}/decision", params={"status": "${model.statuses[1] || model.statuses[0]}"}).json()`,
      `    assert decided["status"] == "${model.statuses[1] || model.statuses[0]}"`,
    ];
  }
  if (agentId === "reviewer") {
    return [
      `# ${model.appName} Reviewer 审查清单`,
      "",
      ...plan.decisions.map((item) => `- ${item}`),
      "",
      "## 必须通过",
      `- [ ] 后端提供 /api/${model.apiBase} 和状态决策接口。`,
      `- [ ] 前端围绕 ${model.entity} 展示真实业务操作，不是静态说明。`,
      "- [ ] 测试文件只写测试断言，不复制后端实现。",
      "- [ ] 各 Agent 只写职责内文件。",
    ];
  }
  return [
    ...agentDecisionHeader(plan, "//"),
    `const state = { taskId: "${taskId}", activeStatus: "全部", items: ${JSON.stringify(model.seed)} };`,
    `const statusOptions = ["全部", ...${statuses}];`,
    "function visibleItems() {",
    "  return state.activeStatus === \"全部\" ? state.items : state.items.filter((item) => item.status === state.activeStatus);",
    "}",
    "function decideItem(id, status) {",
    "  const item = state.items.find((row) => row.id === id);",
    "  if (item) item.status = status;",
    "  renderBusinessApp();",
    "}",
    "function renderBusinessApp() {",
    "  const root = document.getElementById(\"app\") || document.body;",
    "  const pending = state.items.filter((item) => item.status === statusOptions[1]).length;",
    `  const cards = visibleItems().map((item) => {`,
    `    const actor = item["${model.actor}"] || item.owner || "";`,
    "    const actions = statusOptions.slice(1).map((status) => `<button onclick=\"decideItem(${item.id || 0}, '${status}')\">${status}</button>`).join(\"\");",
    "    return `<article><strong>${item.title}</strong><span>${actor} / ${item.department || \"\"}</span><em>${item.status}</em><p>${item.reason || \"\"}</p>${actions}</article>`;",
    "  }).join(\"\");",
    "  const tabs = statusOptions.map((status) => `<button onclick=\"state.activeStatus='${status}';renderBusinessApp()\" class=\"${state.activeStatus === status ? 'active' : ''}\">${status}</button>`).join(\"\");",
    "  root.innerHTML = `",
    `    <main class="business-shell"><aside><strong>${model.appName}</strong><button class="active">${model.entity}中心</button><button>成员</button><button>报表</button></aside>`,
    `    <section><header><h1>${model.appName}</h1><span>待处理 \${pending} 项</span></header>`,
    "    <nav>${tabs}</nav><div class=\"business-grid\">${cards}</div>",
    "    </section></main>`;",
    "}",
    "renderBusinessApp();",
  ];
}

function oaSystemArtifactLines(agentId, fileName, taskId, title) {
  const lower = fileName.toLowerCase();
  if (agentId === "tester" || lower.includes("test") || lower.includes("spec")) {
    return [
      "from fastapi.testclient import TestClient",
      "from app.main import app",
      "",
      "client = TestClient(app)",
      "",
      "def test_oa_health_and_lists():",
      "    assert client.get(\"/api/health\").json()[\"service\"] == \"oa\"",
      "    assert len(client.get(\"/api/employees\").json()) >= 2",
      "    assert any(item[\"title\"] == \"请假审批\" for item in client.get(\"/api/approvals\").json())",
      "",
      "def test_create_and_decide_approval():",
      "    payload = {\"title\": \"采购审批\", \"applicant\": \"林亦然\", \"amount\": 1299, \"reason\": \"办公设备\"}",
      "    created = client.post(\"/api/approvals\", json=payload).json()",
      "    assert created[\"status\"] == \"待审批\"",
      "    decided = client.post(f\"/api/approvals/{created['id']}/decision\", params={\"status\": \"已通过\"}).json()",
      "    assert decided[\"status\"] == \"已通过\"",
    ];
  }
  if (agentId === "backend" || lower.endsWith("app/main.py") || lower.endsWith("backend/main.py")) {
    return [
      "from fastapi import FastAPI, HTTPException",
      "from pydantic import BaseModel",
      "",
      "app = FastAPI(title=\"OA 协同办公系统\")",
      "",
      "class ApprovalCreate(BaseModel):",
      "    title: str",
      "    applicant: str",
      "    amount: float | None = None",
      "    reason: str",
      "",
      "employees = [",
      "    {\"id\": 1, \"name\": \"林亦然\", \"department\": \"研发部\", \"role\": \"前端工程师\", \"status\": \"在岗\"},",
      "    {\"id\": 2, \"name\": \"周明\", \"department\": \"财务部\", \"role\": \"审批人\", \"status\": \"在岗\"},",
      "]",
      "approvals = [",
      "    {\"id\": 101, \"title\": \"请假审批\", \"applicant\": \"林亦然\", \"amount\": None, \"reason\": \"年假 2 天\", \"status\": \"待审批\"},",
      "    {\"id\": 102, \"title\": \"费用报销\", \"applicant\": \"周明\", \"amount\": 860.5, \"reason\": \"客户拜访交通费\", \"status\": \"已通过\"},",
      "]",
      "",
      "@app.get(\"/api/health\")",
      "def health():",
      `    return {\"ok\": True, \"service\": \"oa\", \"task_id\": \"${taskId}\"}`,
      "",
      "@app.get(\"/api/employees\")",
      "def list_employees():",
      "    return employees",
      "",
      "@app.get(\"/api/approvals\")",
      "def list_approvals(status: str | None = None):",
      "    if not status or status == \"全部\":",
      "        return approvals",
      "    return [item for item in approvals if item[\"status\"] == status]",
      "",
      "@app.post(\"/api/approvals\")",
      "def create_approval(payload: ApprovalCreate):",
      "    item = {\"id\": max(item[\"id\"] for item in approvals) + 1, \"status\": \"待审批\", **payload.model_dump()}",
      "    approvals.insert(0, item)",
      "    return item",
      "",
      "@app.post(\"/api/approvals/{approval_id}/decision\")",
      "def decide_approval(approval_id: int, status: str):",
      "    if status not in {\"已通过\", \"已驳回\", \"待审批\"}:",
      "        raise HTTPException(status_code=400, detail=\"invalid status\")",
      "    for item in approvals:",
      "        if item[\"id\"] == approval_id:",
      "            item[\"status\"] = status",
      "            return item",
      "    raise HTTPException(status_code=404, detail=\"approval not found\")",
    ];
  }
  if (agentId === "reviewer" || lower.endsWith(".md")) {
    return [
      "# OA 系统 Reviewer 审查清单",
      "",
      `- 任务：${title}`,
      `- 任务 ID：${taskId}`,
      "",
      "## 必须通过",
      "- [x] 后端提供员工列表、审批列表、新建审批、审批决策 API。",
      "- [x] 前端呈现 OA 工作台，而不是静态技术说明。",
      "- [x] 测试覆盖健康检查、审批创建和审批状态流转。",
      "- [x] 所有 Agent 只写职责内文件，不能改 IDE/配置缓存文件。",
    ];
  }
  return [
    "const state = {",
    `  taskId: \"${taskId}\",`,
    "  activeStatus: \"全部\",",
    "  approvals: [",
    "    { id: 101, title: \"请假审批\", applicant: \"林亦然\", department: \"研发部\", amount: \"-\", status: \"待审批\" },",
    "    { id: 102, title: \"费用报销\", applicant: \"周明\", department: \"财务部\", amount: \"860.50\", status: \"已通过\" },",
    "    { id: 103, title: \"会议室预定\", applicant: \"陈青\", department: \"行政部\", amount: \"-\", status: \"待审批\" },",
    "  ],",
    "};",
    "",
    "const statusOptions = [\"全部\", \"待审批\", \"已通过\", \"已驳回\"];",
    "function filteredApprovals() {",
    "  return state.activeStatus === \"全部\" ? state.approvals : state.approvals.filter((item) => item.status === state.activeStatus);",
    "}",
    "function decideApproval(id, status) {",
    "  const item = state.approvals.find((approval) => approval.id === id);",
    "  if (item) item.status = status;",
    "  renderOA();",
    "}",
    "function renderOA() {",
    "  const root = document.getElementById(\"app\") || document.body;",
    "  const pending = state.approvals.filter((item) => item.status === \"待审批\").length;",
    "  root.innerHTML = `",
    "    <main class=\"oa-shell\">",
    "      <aside class=\"oa-nav\"><strong>OA 办公</strong><button class=\"active\">审批中心</button><button>员工通讯录</button><button>会议室</button></aside>",
    "      <section class=\"oa-workbench\">",
    "        <header><h1>OA 协同办公系统</h1><span>待审批 ${pending} 项</span></header>",
    "        <div class=\"oa-status-tabs\">${statusOptions.map((item) => `<button onclick=\"state.activeStatus='${item}';renderOA()\" class=\"${state.activeStatus === item ? 'active' : ''}\">${item}</button>`).join('')}</div>",
    "        <div class=\"oa-grid\">${filteredApprovals().map((item) => `<article><strong>${item.title}</strong><span>${item.applicant} / ${item.department}</span><em>${item.status}</em><p>金额：${item.amount}</p><button onclick=\"decideApproval(${item.id}, '已通过')\">通过</button><button onclick=\"decideApproval(${item.id}, '已驳回')\">驳回</button></article>`).join('')}</div>",
    "      </section>",
    "    </main>`;",
    "}",
    "renderOA();",
  ];
}

function buildAgentArtifactLines(agentId, taskLike = {}, fileName = "") {
  const agent = agentById(agentId) || { id: agentId, role: "Agent", name: agentId };
  const taskId = sanitizeCodeText(taskLike.id || taskLike.backendId || `local-${Date.now().toString(36)}`);
  const title = sanitizeCodeText(taskLike.title || "QuantumFlow 自动任务");
  const branch = sanitizeCodeText(taskLike.branch || "main");
  const spec = inferBusinessSpec(title);
  const libraryAdminLines = isVue3FrontendSpec(spec) ? vue3LibraryAdminArtifactLines(fileName, taskId, title, branch) : null;
  if (libraryAdminLines) return libraryAdminLines;
  if (taskLike.requirementDoc || ["oa", "crm", "order", "hr"].includes(spec.domain)) {
    return autonomousAgentArtifactLines(agentId, taskLike, fileName, taskId);
  }

  if (isVue3FrontendSpec(spec) && fileName.endsWith("package.json")) {
    return [
      "{",
      `  "name": "${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "quantumflow-vue3-library"}",`,
      "  \"version\": \"0.1.0\",",
      "  \"private\": true,",
      "  \"type\": \"module\",",
      "  \"scripts\": {",
      "    \"dev\": \"vite --host 127.0.0.1\",",
      "    \"build\": \"vite build\",",
      "    \"test\": \"node tests/book.spec.js\"",
      "  },",
      "  \"dependencies\": {",
      "    \"@vitejs/plugin-vue\": \"^5.0.0\",",
      "    \"vite\": \"^5.0.0\",",
      "    \"vue\": \"^3.4.0\"",
      "  },",
      "  \"devDependencies\": {}",
      "}",
    ];
  }

  if (isVue3FrontendSpec(spec) && fileName.endsWith("index.html")) {
    return [
      "<!doctype html>",
      "<html lang=\"zh-CN\">",
      "  <head>",
      "    <meta charset=\"UTF-8\" />",
      "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
      "    <title>Vue3 图书管理系统</title>",
      "    <link rel=\"stylesheet\" href=\"/src/style.css\" />",
      "  </head>",
      "  <body>",
      "    <div id=\"app\"></div>",
      "    <script type=\"module\" src=\"/src/main.js\"></script>",
      "  </body>",
      "</html>",
    ];
  }

  if (isVue3FrontendSpec(spec) && fileName.endsWith("src/main.js")) {
    return [
      "import { createApp } from \"vue\";",
      "",
      "import App from \"./App.vue\";",
      "",
      "createApp(App).mount(\"#app\");",
    ];
  }

  if (isVue3FrontendSpec(spec) && fileName.endsWith("src/App.vue")) {
    const books = JSON.stringify(vue3BookSeedItems(), null, 2);
    return [
      "<script setup>",
      "import { computed, reactive } from \"vue\";",
      "",
      "const state = reactive({",
      `  taskId: "${taskId}",`,
      `  title: "${title}",`,
      "  keyword: \"\",",
      "  category: \"全部\",",
      "  status: \"全部\",",
      "  form: { title: \"\", author: \"\", category: \"综合\", status: \"在馆\" },",
      `  books: ${books}.map((book, index) => ({ id: index + 1, ...book })),`,
      "});",
      "",
      "const categories = computed(() => [\"全部\", ...new Set(state.books.map((book) => book.category))]);",
      "const statusOptions = [\"全部\", \"在馆\", \"借出\", \"预约\"];",
      "const filteredBooks = computed(() => {",
      "  const keyword = state.keyword.trim().toLowerCase();",
      "  return state.books.filter((book) => {",
      "    const text = `${book.title} ${book.author} ${book.category} ${book.status}`.toLowerCase();",
      "    return (!keyword || text.includes(keyword)) &&",
      "      (state.category === \"全部\" || book.category === state.category) &&",
      "      (state.status === \"全部\" || book.status === state.status);",
      "  });",
      "});",
      "const stats = computed(() => ({",
      "  total: state.books.length,",
      "  available: state.books.filter((book) => book.status === \"在馆\").length,",
      "  borrowed: state.books.filter((book) => book.status === \"借出\").length,",
      "  reserved: state.books.filter((book) => book.status === \"预约\").length,",
      "}));",
      "",
      "function addBook() {",
      "  if (!state.form.title.trim() || !state.form.author.trim()) return;",
      "  state.books.unshift({ id: Date.now(), ...state.form });",
      "  state.form = { title: \"\", author: \"\", category: \"综合\", status: \"在馆\" };",
      "}",
      "",
      "function cycleStatus(book) {",
      "  const flow = [\"在馆\", \"借出\", \"预约\"];",
      "  book.status = flow[(flow.indexOf(book.status) + 1) % flow.length];",
      "}",
      "</script>",
      "",
      "<template>",
      "  <main class=\"library-shell\">",
      "    <section class=\"hero\">",
      "      <span>Vue3 Library Console</span>",
      "      <h1>{{ state.title }}</h1>",
      "      <p>图书搜索、分类筛选、新增图书和借阅状态管理。</p>",
      "    </section>",
      "    <section class=\"stats\">",
      "      <article><strong>{{ stats.total }}</strong><span>馆藏总数</span></article>",
      "      <article><strong>{{ stats.available }}</strong><span>在馆</span></article>",
      "      <article><strong>{{ stats.borrowed }}</strong><span>借出</span></article>",
      "      <article><strong>{{ stats.reserved }}</strong><span>预约</span></article>",
      "    </section>",
      "    <section class=\"toolbar\">",
      "      <input v-model=\"state.keyword\" placeholder=\"搜索书名、作者、分类或状态\" />",
      "      <select v-model=\"state.category\"><option v-for=\"item in categories\" :key=\"item\">{{ item }}</option></select>",
      "      <select v-model=\"state.status\"><option v-for=\"item in statusOptions\" :key=\"item\">{{ item }}</option></select>",
      "    </section>",
      "    <form class=\"book-form\" @submit.prevent=\"addBook\">",
      "      <input v-model=\"state.form.title\" placeholder=\"书名\" />",
      "      <input v-model=\"state.form.author\" placeholder=\"作者\" />",
      "      <input v-model=\"state.form.category\" placeholder=\"分类\" />",
      "      <select v-model=\"state.form.status\"><option>在馆</option><option>借出</option><option>预约</option></select>",
      "      <button>新增图书</button>",
      "    </form>",
      "    <section class=\"book-grid\">",
      "      <article v-for=\"book in filteredBooks\" :key=\"book.id\" class=\"book-card\">",
      "        <div><strong>{{ book.title }}</strong><span>{{ book.author }} / {{ book.category }}</span></div>",
      "        <button :class=\"'status-' + book.status\" @click=\"cycleStatus(book)\">{{ book.status }}</button>",
      "      </article>",
      "    </section>",
      "  </main>",
      "</template>",
    ];
  }

  if (isVue3FrontendSpec(spec) && fileName.endsWith("src/style.css")) {
    return [
      ":root { color-scheme: dark; font-family: Inter, 'Microsoft YaHei', sans-serif; }",
      "* { box-sizing: border-box; }",
      "body { margin: 0; min-height: 100vh; background: #080d18; color: #edf3ff; }",
      ".library-shell { width: min(1180px, calc(100vw - 32px)); margin: 0 auto; padding: 32px 0; }",
      ".hero, .stats article, .toolbar, .book-form, .book-card { border: 1px solid #26365f; background: #101827; border-radius: 8px; }",
      ".hero { padding: 30px; }",
      ".hero span { color: #2fe098; font-weight: 900; }",
      ".hero h1 { margin: 8px 0 10px; font-size: clamp(30px, 4vw, 52px); }",
      ".hero p, .stats span, .book-card span { color: #9fb0cc; }",
      ".stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }",
      ".stats article { padding: 18px; }",
      ".stats strong { display: block; font-size: 30px; }",
      ".toolbar, .book-form { display: grid; grid-template-columns: 1fr 180px 180px; gap: 10px; padding: 12px; margin-bottom: 12px; }",
      ".book-form { grid-template-columns: 1fr 180px 160px 140px 120px; }",
      "input, select, button { height: 42px; border: 1px solid #2d3b67; border-radius: 7px; background: #0d1428; color: #edf3ff; padding: 0 12px; }",
      "button { cursor: pointer; font-weight: 800; }",
      ".book-form button { background: #1097a7; border-color: #21d6e7; }",
      ".book-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }",
      ".book-card { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 16px; }",
      ".book-card strong, .book-card span { display: block; }",
      ".book-card strong { margin-bottom: 6px; }",
      ".status-在馆 { border-color: #2fe098; color: #2fe098; }",
      ".status-借出 { border-color: #ffc44d; color: #ffc44d; }",
      ".status-预约 { border-color: #21d6e7; color: #21d6e7; }",
      "@media (max-width: 820px) { .stats, .toolbar, .book-form { grid-template-columns: 1fr; } .book-card { align-items: flex-start; flex-direction: column; } .book-card button { width: 100%; } }",
    ];
  }

  if (isVue3FrontendSpec(spec) && fileName.endsWith("tests/book.spec.js")) {
    return [
      "import assert from \"node:assert/strict\";",
      "import fs from \"node:fs\";",
      "",
      "const html = fs.readFileSync(\"index.html\", \"utf8\");",
      "const main = fs.readFileSync(\"src/main.js\", \"utf8\");",
      "const vue = fs.readFileSync(\"src/App.vue\", \"utf8\");",
      "",
      "assert.match(html, /id=\"app\"/);",
      "assert.match(main, /createApp/);",
      "assert.match(vue, /图书搜索/);",
      "assert.match(vue, /新增图书/);",
      "assert.match(vue, /借出/);",
      "assert.match(vue, /filteredBooks/);",
      "assert.match(html, /type=\"module\"/);",
      "assert.match(main, /vue@3|createApp/);",
      "assert.ok(!main.includes(\"/api/tasks\"), \"frontend-only project must not depend on FastAPI task API\");",
      "",
      `console.log("vue3 library frontend smoke ok with compat gate: ${taskId}");`,
    ];
  }

  if (isVue3FrontendSpec(spec) && fileName.endsWith("docs/api-assumption.md")) {
    return [
      "# API 约束说明",
      "",
      `任务：${title}`,
      "",
      "本次需求被识别为 Vue3 前端页面任务，因此 Backend Agent 不强行生成后端服务。",
      "如果后续要接真实接口，建议保持以下契约：",
      "",
      "- `GET /api/books`：读取图书列表。",
      "- `POST /api/books`：新增图书。",
      "- `PATCH /api/books/{id}`：更新借阅状态。",
    ];
  }

  if (isVue3FrontendSpec(spec) && fileName.endsWith("docs/review-checklist.md")) {
    return [
      "# Reviewer 审查清单",
      "",
      `- 任务：${title}`,
      `- 任务 ID：${taskId}`,
      `- 分支：${branch}`,
      "- 识别结果：Vue3 图书管理前端",
      "",
      "## 必须通过",
      "",
      "- [x] 需求被识别为图书管理系统，不再生成通用任务管理模板。",
      "- [x] 范围被识别为前端-only，不强行生成后端服务。",
      "- [x] 前端 Agent 提供 `src/App.vue`、`src/main.js`、`src/style.css`。",
      "- [x] 页面包含图书搜索、分类筛选、状态筛选、新增图书和状态切换。",
      "- [x] 测试 Agent 提供 `tests/book.spec.js` 检查 Vue3 挂载点和核心业务文案。",
      "- [x] 测试 Agent 检查 Vue3/Vite/浏览器模块入口兼容，不兼容则退回原 Agent 免费重构并返还 token。",
    ];
  }

  if (fileName.endsWith("app/main.py")) {
    return [
      "from __future__ import annotations",
      "",
      "import sqlite3",
      "from datetime import datetime",
      "from pathlib import Path",
      "from typing import Any",
      "",
      "from fastapi import FastAPI, HTTPException",
      "from fastapi.responses import FileResponse",
      "from fastapi.staticfiles import StaticFiles",
      "from pydantic import BaseModel, Field",
      "",
      "ROOT = Path(__file__).resolve().parent",
      "DB_PATH = ROOT / \"business.db\"",
      "STATIC_ROOT = ROOT / \"static\"",
      "ALLOWED_STATUS = {\"pending\", \"active\", \"blocked\", \"done\"}",
      `SEED_ITEMS = ${JSON.stringify(spec.seedItems)}`,
      `app = FastAPI(title="${title}", version="1.0.0")`,
      "app.mount(\"/static\", StaticFiles(directory=STATIC_ROOT), name=\"static\")",
      "",
      "class TaskCreate(BaseModel):",
      "    title: str = Field(min_length=1, max_length=180)",
      `    owner: str = Field(default="${spec.ownerLabel}", max_length=60)`,
      "    priority: str = Field(default=\"normal\", pattern=\"^(normal|high|urgent)$\")",
      "",
      "class TaskUpdate(BaseModel):",
      "    status: str",
      "",
      "def connect() -> sqlite3.Connection:",
      "    conn = sqlite3.connect(DB_PATH)",
      "    conn.row_factory = sqlite3.Row",
      "    return conn",
      "",
      "def init_db() -> None:",
      "    with connect() as conn:",
      "        conn.execute(\"\"\"CREATE TABLE IF NOT EXISTS task (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, owner TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)\"\"\")",
      "        conn.execute(\"\"\"CREATE TABLE IF NOT EXISTS event (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER, message TEXT NOT NULL, created_at TEXT NOT NULL)\"\"\")",
      "        count = conn.execute(\"SELECT COUNT(*) FROM task\").fetchone()[0]",
      "        if count == 0:",
      "            now = datetime.now().isoformat(timespec=\"seconds\")",
      "            for index, item in enumerate(SEED_ITEMS):",
      "                priority = \"high\" if index == 0 else \"normal\"",
      `                conn.execute("INSERT INTO task(title, owner, priority, status, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?)", (item, "${spec.ownerLabel}", priority, now, now))`,
      "",
      "def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:",
      "    return {key: row[key] for key in row.keys()}",
      "",
      "@app.on_event(\"startup\")",
      "def startup() -> None:",
      "    init_db()",
      "",
      "@app.get(\"/\")",
      "def index() -> FileResponse:",
      "    return FileResponse(STATIC_ROOT / \"index.html\")",
      "",
      "@app.get(\"/api/health\")",
      "def health() -> dict[str, str]:",
      `    return {"ok": "true", "service": "${title}", "task_id": "${taskId}", "entity": "${spec.entityLabel}"}`,
      "",
      "@app.get(\"/api/tasks\")",
      "def list_tasks() -> list[dict[str, Any]]:",
      "    init_db()",
      "    with connect() as conn:",
      "        rows = conn.execute(\"SELECT * FROM task ORDER BY id DESC\").fetchall()",
      "    return [row_to_dict(row) for row in rows]",
      "",
      "@app.post(\"/api/tasks\")",
      "def create_task(payload: TaskCreate) -> dict[str, Any]:",
      "    now = datetime.now().isoformat(timespec=\"seconds\")",
      "    with connect() as conn:",
      `        cursor = conn.execute("INSERT INTO task(title, owner, priority, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", (payload.title.strip(), payload.owner.strip() or "${spec.ownerLabel}", payload.priority, "pending", now, now))`,
      "        new_id = cursor.lastrowid",
      "        conn.execute(\"INSERT INTO event(task_id, message, created_at) VALUES (?, ?, ?)\", (new_id, \"任务已创建\", now))",
      "        row = conn.execute(\"SELECT * FROM task WHERE id = ?\", (new_id,)).fetchone()",
      "    return row_to_dict(row)",
      "",
      "@app.patch(\"/api/tasks/{task_id}\")",
      "def update_task(task_id: int, payload: TaskUpdate) -> dict[str, Any]:",
      "    status = payload.status.strip()",
      "    if status not in ALLOWED_STATUS:",
      "        raise HTTPException(status_code=400, detail=\"不支持的任务状态\")",
      "    now = datetime.now().isoformat(timespec=\"seconds\")",
      "    with connect() as conn:",
      "        cursor = conn.execute(\"UPDATE task SET status = ?, updated_at = ? WHERE id = ?\", (status, now, task_id))",
      "        if cursor.rowcount == 0:",
      "            raise HTTPException(status_code=404, detail=\"任务不存在\")",
      "        conn.execute(\"INSERT INTO event(task_id, message, created_at) VALUES (?, ?, ?)\", (task_id, f\"状态更新为 {status}\", now))",
      "        row = conn.execute(\"SELECT * FROM task WHERE id = ?\", (task_id,)).fetchone()",
      "    return row_to_dict(row)",
    ];
  }

  if (fileName.endsWith("tests/test_smoke.py")) {
    return [
      "from fastapi.testclient import TestClient",
      "",
      "from app.main import app",
      "",
      "def test_health_and_task_flow():",
      "    with TestClient(app) as client:",
      "        health = client.get(\"/api/health\")",
      "        assert health.status_code == 200",
      `        assert health.json()["task_id"] == "${taskId}"`,
      `        assert health.json()["entity"] == "${spec.entityLabel}"`,
      "        initial = client.get(\"/api/tasks\")",
      "        assert initial.status_code == 200",
      "        assert len(initial.json()) >= 3",
      `        created = client.post("/api/tasks", json={"title": "${title}", "owner": "测试 Agent", "priority": "high"})`,
      "        assert created.status_code == 200",
      "        new_id = created.json()[\"id\"]",
      "        updated = client.patch(f\"/api/tasks/{new_id}\", json={\"status\": \"done\"})",
      "        assert updated.status_code == 200",
      "        assert updated.json()[\"status\"] == \"done\"",
      "        listed = client.get(\"/api/tasks\")",
      "        assert listed.status_code == 200",
      "        assert any(item[\"id\"] == new_id for item in listed.json())",
      "",
      "def test_cross_language_contract_compatibility():",
      "    with TestClient(app) as client:",
      "        health = client.get(\"/api/health\").json()",
      "        tasks = client.get(\"/api/tasks\").json()",
      "        assert isinstance(health[\"task_id\"], str)",
      "        assert all(isinstance(item[\"id\"], int) for item in tasks)",
      "        assert all(item[\"status\"] in {\"pending\", \"active\", \"blocked\", \"done\"} for item in tasks)",
      "        assert client.get(\"/\").headers[\"content-type\"].startswith(\"text/html\")",
    ];
  }

  if (fileName.endsWith("docs/review-checklist.md")) {
    return [
      "# Reviewer 审查清单",
      "",
      `- 任务：${title}`,
      `- 任务 ID：${taskId}`,
      `- 分支：${branch}`,
      `- 业务实体：${spec.entityLabel}`,
      "",
      "## 必须通过",
      "",
      "- [x] 后端 Agent 独立提供 API、SQLite 和业务初始数据。",
      "- [x] 前端 Agent 独立提供列表、搜索筛选、状态按钮和接口联动。",
      "- [x] 测试 Agent 独立覆盖健康检查、初始数据、创建、更新和列表读取。",
      "- [x] 测试 Agent 额外检查跨语言接口契约、JSON 类型、状态枚举、编码和运行入口兼容。",
      "- [x] 不兼容时退回原负责 Agent 免费重构，重构 token 直接返还。",
      "- [x] 状态展示中文化，接口状态值保持英文以便程序处理。",
    ];
  }

  if (fileName.endsWith("app/static/app.js")) {
    return [
      `const state = { taskId: "${taskId}", title: "${title}", entityLabel: "${spec.entityLabel}", tasks: [], filters: { status: "all", query: "" } };`,
      "const statusText = { pending: \"等待\", active: \"进行中\", blocked: \"阻塞\", done: \"完成\" };",
      "const priorityText = { normal: \"普通\", high: \"高\", urgent: \"紧急\" };",
      "const els = {",
      "  list: document.getElementById(\"taskList\"),",
      "  form: document.getElementById(\"taskForm\"),",
      "  title: document.getElementById(\"taskTitle\"),",
      "  owner: document.getElementById(\"taskOwner\"),",
      "  priority: document.getElementById(\"taskPriority\"),",
      "  query: document.getElementById(\"taskSearch\"),",
      "  statTotal: document.getElementById(\"statTotal\"),",
      "  statActive: document.getElementById(\"statActive\"),",
      "  statDone: document.getElementById(\"statDone\"),",
      "};",
      "async function api(path, options = {}) {",
      "  const response = await fetch(path, { ...options, headers: { \"Content-Type\": \"application/json\", ...(options.headers || {}) } });",
      "  const data = await response.json().catch(() => ({}));",
      "  if (!response.ok) throw new Error(data.detail || `请求失败: ${response.status}`);",
      "  return data;",
      "}",
      "async function loadTasks() { state.tasks = await api(\"/api/tasks\"); render(); }",
      "function visibleTasks() {",
      "  const query = state.filters.query.trim().toLowerCase();",
      "  return state.tasks.filter((task) => {",
      "    const matchesStatus = state.filters.status === \"all\" || task.status === state.filters.status;",
      "    const text = `${task.title} ${task.owner} ${task.priority} ${task.status}`.toLowerCase();",
      "    return matchesStatus && (!query || text.includes(query));",
      "  });",
      "}",
      "function render() {",
      "  const tasks = visibleTasks();",
      "  els.statTotal.textContent = String(state.tasks.length);",
      "  els.statActive.textContent = String(state.tasks.filter((task) => task.status === \"active\").length);",
      "  els.statDone.textContent = String(state.tasks.filter((task) => task.status === \"done\").length);",
      "  els.list.innerHTML = tasks.length ? tasks.map(renderTask).join(\"\") : `<p class=\"empty\">暂无匹配${state.entityLabel}，先创建一个。</p>`;",
      "}",
      "function renderTask(task) {",
      "  return `<article class=\"task-card status-${task.status}\"><div><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.owner)} / ${priorityText[task.priority] || task.priority} / ${statusText[task.status] || task.status}</small></div><div class=\"actions\">${Object.entries(statusText).map(([status, label]) => `<button data-id=\"${task.id}\" data-status=\"${status}\">${label}</button>`).join(\"\")}</div></article>`;",
      "}",
      "function escapeHtml(value) { return String(value || \"\").replace(/[&<>\"']/g, (char) => ({ \"&\": \"&amp;\", \"<\": \"&lt;\", \">\": \"&gt;\", '\"': \"&quot;\", \"'\": \"&#039;\" }[char])); }",
      "els.form.addEventListener(\"submit\", async (event) => {",
      "  event.preventDefault();",
      `  await api("/api/tasks", { method: "POST", body: JSON.stringify({ title: els.title.value, owner: els.owner.value || "${spec.ownerLabel}", priority: els.priority.value }) });`,
      "  els.form.reset();",
      `  els.owner.value = "${spec.ownerLabel}";`,
      "  await loadTasks();",
      "});",
      "els.query.addEventListener(\"input\", () => { state.filters.query = els.query.value; render(); });",
      "document.querySelectorAll(\"[data-filter]\").forEach((button) => {",
      "  button.addEventListener(\"click\", () => {",
      "    state.filters.status = button.dataset.filter;",
      "    document.querySelectorAll(\"[data-filter]\").forEach((item) => item.classList.toggle(\"active\", item === button));",
      "    render();",
      "  });",
      "});",
      "els.list.addEventListener(\"click\", async (event) => {",
      "  const button = event.target.closest(\"button[data-id]\");",
      "  if (!button) return;",
      "  await api(`/api/tasks/${button.dataset.id}`, { method: \"PATCH\", body: JSON.stringify({ status: button.dataset.status }) });",
      "  await loadTasks();",
      "});",
      "loadTasks();",
    ];
  }

  if (isVue3FrontendSpec(spec) && fileName.endsWith("README.md")) {
    return [
      `# ${title}`,
      "",
      "这是 QuantumFlow 根据任务语义生成的 Vue3 图书管理前端项目。",
      "",
      "## 需求理解",
      "",
      "- 业务领域：图书管理 / 馆藏管理",
      "- 技术栈：Vue3",
      "- 开发范围：前端页面，不强行生成后端任务系统",
      "- 核心功能：图书搜索、分类筛选、状态筛选、新增图书、借出/归还/预约状态切换、统计面板",
      "",
      "## Agent 分工",
      "",
      "- 前端 Agent：生成 `src/main.js`、`src/App.vue`、`src/style.css`",
      "- 测试 Agent：生成 `tests/book.spec.js`，检查关键业务文案和 Vue3 挂载点",
      "- Reviewer：生成 `docs/review-checklist.md`",
      "- 团队负责人：汇总项目结构和运行说明",
      "",
      "## 运行",
      "",
      "```powershell",
      "npm install",
      "npm run dev",
      "```",
      "",
      `任务 ID：${taskId}`,
    ];
  }

  return [
    `# ${title}`,
    "",
    "由 QuantumFlow Agent 生成的完整系统项目。",
    "",
    `业务实体：${spec.entityLabel}`,
    "",
    "- `app/main.py`：FastAPI 后端、SQLite 存储和任务 API。",
    "- `app/static/app.js`：任务看板前端交互。",
    "- `tests/test_smoke.py`：端到端烟测。",
    "- `docs/review-checklist.md`：Reviewer 审查清单。",
  ];
}

function isLegacyStubArtifact(codeText = "", targetKey = "") {
  const text = String(codeText || "");
  return (
    /def\s+task_api_task_\w+\s*\(/.test(text) ||
    /def\s+\w+_summary_task_\w+\s*\(/.test(text) ||
    /quantumflow_generated_result|quantumflow_llm_plugin_candidate|quantumflowGeneratedResult/.test(text) ||
    (targetKey === "runtime/server.py" && /ready_for_review/.test(text) && /return\s*\{/.test(text))
  );
}


function agentById(id) {
  return agents.find((agent) => agent.id === id);
}

function setAgent(id, patch) {
  Object.assign(agentById(id), patch);
  renderAgents();
  renderAgentStrip();
}

function addLog(message, who = "System") {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  const line = document.createElement("div");
  line.className = "log-line";
  line.innerHTML = `[${time}] <b>${who}</b> ${message}`;
  els.log.prepend(line);
}

function updateMetrics() {
  const done = Number(backendQueueStats.completed_total || tasks.filter((task) => task.status === "done").length);
  const active = tasks.filter((task) => task.status === "active").length;
  const blocked = agents.filter((agent) => agent.status === "blocked").length;
  const runningTotal = Number(backendQueueStats.running_total ?? tasks.length);
  const visibleTotal = Math.max(runningTotal, tasks.length);
  const percent = visibleTotal === 0 ? (done > 0 ? 100 : 0) : Math.round((active / visibleTotal) * 100);

  els.taskMetric.textContent = String(visibleTotal);
  els.runningCount.textContent = String(agents.filter((agent) => agent.status !== "idle" && agent.status !== "done").length);
  els.blockedMetric.textContent = String(blocked);
  els.progressBar.style.width = `${percent}%`;
  els.progressText.textContent = `${percent}%`;
  els.queueBoard.textContent = `${backendQueueStats.pending ?? Math.max(tasks.length - active, 0)} pending`;
}

function applySnapshot(snapshot) {
  const incomingAgents = snapshot.agents || [];
  const incomingTasks = snapshot.tasks || [];
  const incomingEvents = snapshot.events || [];
  const incomingDeliveries = Array.isArray(snapshot.deliveries) ? snapshot.deliveries : [];
  if (Date.now() < suppressNonEmptyTaskSnapshotUntil && (incomingTasks.length || incomingDeliveries.length)) {
    return;
  }
  backendQueueStats = snapshot.queue || backendQueueStats;
  projectDeliveries = Array.isArray(snapshot.deliveries) ? snapshot.deliveries : projectDeliveries;

  incomingAgents.forEach((incoming) => {
    const agent = agentById(incoming.id);
    if (!agent) return;
    agent.x = incoming.x;
    agent.y = incoming.y;
    agent.status = incoming.status;
  });

  incomingTasks
    .filter((task) => task.status === "done" && !codedTaskKeys.has(task.id))
    .forEach((task) => {
      const owner = agentById(task.owner_id);
      if (owner) {
        writeCollaborativeProjectCode(
          {
            id: task.id,
            backendId: task.id,
            title: task.title,
            owner: task.owner_id,
            station: [task.station_x, task.station_y],
            status: task.status,
            source: task.source || "quantumflow",
          },
        );
        codedTaskKeys.add(task.id);
      }
    });

  tasks = incomingTasks.filter((incoming) => incoming.status !== "done").map((incoming, index) => ({
    id: index + 1,
    backendId: incoming.id,
    title: incoming.title,
    owner: incoming.owner_id,
    station: [incoming.station_x, incoming.station_y],
    status: incoming.status,
    source: incoming.source || "quantumflow",
  }));

  currentTaskIndex = tasks.findIndex((task) => task.status === "active" || task.status === "blocked");
  renderAll();
  loadCodeArtifacts();
  loadIssues();

  els.log.innerHTML = "";
  incomingEvents
    .slice()
    .reverse()
    .forEach((event) => addLog(event.message, agentById(event.agent_id)?.name || event.agent_id));
}

function runTask(index = currentTaskIndex + 1, options = {}) {
  if (backendConnected && socket && !options.local) {
    socket.send(JSON.stringify({ command: "dispatch_next" }));
    return;
  }
  if (paused) return;
  if (index >= tasks.length) {
    addLog("全部任务已经完成，等待接入真实 Agent Runtime。", "Master");
    stopAuto();
    return;
  }

  currentTaskIndex = index;
  const task = tasks[index];
  if (!task) return;
  if (["done", "review", "packaged", "delivery", "delivered"].includes(task.status)) {
    const nextIndex = tasks.findIndex((item, itemIndex) => itemIndex > index && ["pending", "assigned", "active"].includes(item.status));
    if (nextIndex >= 0) runTask(nextIndex, options);
    else stopAuto();
    return;
  }
  const owner = agentById(task.owner);
  if (!owner) return;
  if (task.status === "assigned" && !options.local) {
    startWorkerTaskFromReviewer(task);
    return;
  }
  selectedAgentId = owner.id;
  task.status = "active";

  setAgent(owner.id, { status: "walking", x: task.station[0], y: task.station[1] });
  renderTasks();
  updateMetrics();
  addLog(`收到任务：${task.title}`, owner.name);

  window.setTimeout(() => {
    if (task.status !== "active") return;
    setAgent(owner.id, { status: "working" });
    addLog("开始执行，写入任务事件并更新调度中枢状态。", owner.name);
  }, 950);

  window.setTimeout(() => {
    if (task.status !== "active") return;
    const shouldBlock = task.id === 4 && Math.random() > 0.45;
    if (shouldBlock) {
      setAgent(owner.id, { status: "blocked" });
      addLog("检测到状态同步缺口，移交 Reviewer 进行仲裁。", owner.name);
      window.setTimeout(() => {
        setAgent("reviewer", { status: "walking", x: task.station[0] + 72, y: task.station[1] + 18 });
        addLog("接管阻塞任务，发起局部修复。", "代码审查者");
      }, 600);
      window.setTimeout(() => finishTask(task, owner), 2400);
      return;
    }
    finishTask(task, owner);
  }, 2300);
}

function finishTask(task, owner) {
  const taskKey = taskDeliveryKey(task);
  if (deliveredTaskKeys.has(taskKey)) {
    task.status = "done";
    setAgent(owner.id, { status: "done", x: owner.home[0], y: owner.home[1] });
    renderTasks();
    updateMetrics();
    return;
  }
  deliveredTaskKeys.add(taskKey);
  if (task.requiresReview) {
    task.status = "review";
    writeTaskCompletionCode(task, owner);
    setAgent(owner.id, { status: "done", x: owner.home[0], y: owner.home[1] });
    setAgent("reviewer", { status: "idle", x: agentById("reviewer").home[0], y: agentById("reviewer").home[1] });
    addLog(`执行完成，等待 Reviewer 审核：${task.workflowTitle || task.title}`, owner.name);
    pushComment(owner.name, `已完成 ${task.workflowTitle || task.title}，提交给代码负责人审核。`);
    renderTasks();
    updateMetrics();
    return;
  }
  task.status = "done";
  writeCollaborativeProjectCode(task);
  setAgent(owner.id, { status: "done", x: owner.home[0], y: owner.home[1] });
  setAgent("reviewer", { status: "idle", x: agentById("reviewer").home[0], y: agentById("reviewer").home[1] });
  addLog(`任务完成：${task.title}`, owner.name);
  renderTasks();
  updateMetrics();
}

function taskDeliveryKey(task) {
  return String(task?.backendId || task?.localWorkflowId || task?.id || task?.title || "").trim();
}

function codeStreamDedupeKey({ repoId, fileName, taskId = "", taskTitle = "" }) {
  return [repoId, fileName, taskId || taskTitle].map((item) => String(item || "").trim()).join("::");
}

function streamCodeLines({ repoId, fileName, lines, agentName = "Agent", taskTitle = "代码生成", replace = false, taskId = "" }) {
  const dedupeKey = codeStreamDedupeKey({ repoId, fileName, taskId, taskTitle });
  if (queuedCodeStreamKeys.has(dedupeKey) || completedCodeStreamKeys.has(dedupeKey)) {
    return false;
  }
  queuedCodeStreamKeys.add(dedupeKey);
  streamingCodeQueue.push({ repoId, fileName, lines, agentName, taskTitle, replace, taskId, dedupeKey });
  processCodeStreamQueue();
  return true;
}

function processCodeStreamQueue() {
  if (streamingCodeActive) return;
  const next = streamingCodeQueue.shift();
  if (!next) return;
  streamingCodeActive = true;
  runCodeStream(next);
}

function runCodeStream({ repoId, fileName, lines, agentName = "Agent", taskTitle = "代码生成", replace = false, dedupeKey = "" }) {
  const repo = openWorldRepos.find((item) => item.id === repoId);
  if (!repo || !lines?.length) {
    if (dedupeKey) {
      queuedCodeStreamKeys.delete(dedupeKey);
      completedCodeStreamKeys.add(dedupeKey);
    }
    streamingCodeActive = false;
    processCodeStreamQueue();
    return;
  }
  if (!repo.files[fileName]) repo.files[fileName] = [`// ${fileName}`, "// Created by QuantumFlow Agent."];
  const key = codeKey(repoId, fileName);
  if (streamingCodeTimers.has(key)) {
    window.clearInterval(streamingCodeTimers.get(key));
    streamingCodeTimers.delete(key);
  }
  const base = replace ? [] : [...(generatedCodeOverrides[key] || repo.files[fileName] || [])];
  generatedCodeOverrides[key] = base;
  activeRepoId = repoId;
  activeFileName = fileName;
  streamingCodeKey = key;
  streamingCodeLineIndex = Math.max(0, base.length - 1);
  renderCommunity();
  pushComment(agentName, `开始流式写入 ${repo.name}/${fileName}：${taskTitle}`, "streaming", key);

  if (lines.length > 180 || lines.join("\n").length > 12000) {
    generatedCodeOverrides[key] = [...lines];
    repo.files[fileName] = [...lines];
    repo.custom = true;
    saveCustomInternalRepos();
    streamingCodeLineIndex = -1;
    streamingCodeKey = "";
    renderCommunity();
    pushComment(agentName, `已完整写入 ${lines.length} 行代码：${taskTitle}`, "suggestion", key);
    if (dedupeKey) {
      queuedCodeStreamKeys.delete(dedupeKey);
      completedCodeStreamKeys.add(dedupeKey);
    }
    streamingCodeActive = false;
    processCodeStreamQueue();
    return;
  }

  let lineIndex = 0;
  let charIndex = 0;
  let currentLineStarted = false;
  const timer = window.setInterval(() => {
    const current = generatedCodeOverrides[key] || [];
    const sourceLine = String(lines[lineIndex] ?? "");
    if (!currentLineStarted) {
      current.push("");
      currentLineStarted = true;
    }
    const chunkSize = streamChunkSize(sourceLine, charIndex);
    current[current.length - 1] += sourceLine.slice(charIndex, charIndex + chunkSize);
    generatedCodeOverrides[key] = current;
    streamingCodeLineIndex = current.length - 1;
    renderCommunity();
    charIndex += chunkSize;
    if (charIndex >= sourceLine.length) {
      lineIndex += 1;
      charIndex = 0;
      currentLineStarted = false;
    }
    if (lineIndex >= lines.length) {
      window.clearInterval(timer);
      streamingCodeTimers.delete(key);
      repo.files[fileName] = [...(generatedCodeOverrides[key] || lines)];
      repo.custom = true;
      saveCustomInternalRepos();
      streamingCodeLineIndex = -1;
      streamingCodeKey = "";
      renderCommunity();
      pushComment(agentName, `任务需求代码写入完成，本次执行结束：${taskTitle}`, "suggestion", key);
      if (dedupeKey) {
        queuedCodeStreamKeys.delete(dedupeKey);
        completedCodeStreamKeys.add(dedupeKey);
      }
      streamingCodeActive = false;
      processCodeStreamQueue();
    }
  }, 42);
  streamingCodeTimers.set(key, timer);
}

function streamChunkSize(line, offset) {
  if (!line) return 1;
  const remaining = line.length - offset;
  if (remaining <= 4) return remaining;
  if (/^\s*$/.test(line.slice(offset))) return Math.min(remaining, 12);
  const char = line[offset] || "";
  if (/[{}()[\],.;:]/.test(char)) return 1;
  if (/\s/.test(char)) return Math.min(remaining, 4);
  return Math.min(remaining, line.length > 100 ? 14 : 8);
}

window.quantumflowStreamCodeLines = streamCodeLines;
globalThis.quantumflowStreamCodeLines = streamCodeLines;
restoreAuthSession();

function collaborativeProjectPlan(task) {
  const spec = inferBusinessSpec(task.title || "");
  const items = isVue3FrontendSpec(spec)
    ? [
        { agentId: "frontend", repoId: "project", fileName: "src/App.vue" },
        { agentId: "frontend", repoId: "project", fileName: "src/main.js" },
        { agentId: "frontend", repoId: "project", fileName: "src/style.css" },
        { agentId: "frontend", repoId: "project", fileName: "package.json" },
        { agentId: "frontend", repoId: "project", fileName: "index.html" },
        { agentId: "tester", repoId: "project", fileName: "tests/book.spec.js" },
        { agentId: "reviewer", repoId: "project", fileName: "docs/review-checklist.md" },
        { agentId: "master", repoId: "project", fileName: "README.md" },
      ]
    : [
    { agentId: "frontend", repoId: "project", fileName: "app/static/app.js" },
    { agentId: "backend", repoId: "project", fileName: "app/main.py" },
    { agentId: "tester", repoId: "project", fileName: "tests/test_smoke.py" },
    { agentId: "reviewer", repoId: "project", fileName: "docs/review-checklist.md" },
    { agentId: "master", repoId: "project", fileName: "README.md" },
  ];
  return items.map((item) => {
    const agent = agentById(item.agentId) || agentById("master");
    return {
      ...item,
      agent,
      lines: buildAgentArtifactLines(item.agentId, task, item.fileName),
    };
  });
}

function writeCollaborativeProjectCode(task) {
  const deliveryKey = `collab:${taskDeliveryKey(task)}`;
  if (codedTaskKeys.has(deliveryKey)) return;
  codedTaskKeys.add(deliveryKey);
  const basePlan = collaborativeProjectPlan(task);
  const deliveryRepo = ensureAgentDeliveryRepo(task, basePlan);
  const plan = basePlan.map((item) => ({
    ...item,
    repoId: deliveryRepo.id,
  }));
  const firstItem = plan[0];
  if (firstItem) {
    openAutoCodeWorkspace(firstItem.repoId, firstItem.fileName);
  }
  plan.forEach((item) => {
    ensureAgentDeliveryFile(deliveryRepo, item.fileName, item.agent?.id || item.agentId || "master");
    streamCodeLines({
      repoId: item.repoId,
      fileName: item.fileName,
      agentName: item.agent.name,
      taskTitle: `${task.title} / ${item.fileName}`,
      taskId: taskDeliveryKey(task),
      lines: item.lines,
      replace: true,
    });
  });
  const compatibility = runCompatibilityGate(task, plan);
  pushComment("测试 Agent", compatibility.ok ? compatibility.summary : `${compatibility.summary} 已退回 ${compatibility.ownerName} 免费重构。`, compatibility.ok ? "suggestion" : "issue", codeKey(deliveryRepo.id, "tests/compatibility"));
  if (!compatibility.ok && compatibility.reworkItem) {
    window.setTimeout(() => {
      ensureAgentDeliveryFile(deliveryRepo, compatibility.reworkItem.fileName, compatibility.reworkItem.agent?.id || compatibility.reworkItem.agentId || "master");
      streamCodeLines({
        repoId: compatibility.reworkItem.repoId,
        fileName: compatibility.reworkItem.fileName,
        agentName: compatibility.reworkItem.agent.name,
        taskTitle: `${task.title} / 兼容性免费重构`,
        taskId: `${taskDeliveryKey(task)}:compat:${compatibility.reworkItem.fileName}`,
        lines: compatibility.reworkItem.lines,
        replace: true,
      });
      pushComment(compatibility.reworkItem.agent.name, `已根据 Tester 兼容性门禁免费重构 ${compatibility.reworkItem.fileName}，本次不计 token 消耗。`, "suggestion", codeKey(compatibility.reworkItem.repoId, compatibility.reworkItem.fileName));
    }, plan.length * 180 + 400);
  }
}

function runCompatibilityGate(task, plan) {
  const byFile = Object.fromEntries(plan.map((item) => [item.fileName, item]));
  const joined = Object.fromEntries(plan.map((item) => [item.fileName, item.lines.join("\n")]));
  const spec = inferBusinessSpec(task.title || "");
  const checks = isVue3FrontendSpec(spec)
    ? [
        ["package.json", /"scripts"\s*:\s*\{[\s\S]*"test"/],
        ["src/main.js", /createApp|mount/],
        ["src/App.vue", /<template>|books|filtered/i],
        ["tests/book.spec.js", /package\.json|src\/App\.vue|compat/i],
        ["docs/review-checklist.md", /兼容|运行|Vue3|Vite/],
      ]
    : [
        ["app/main.py", /@app\.get\("\/api\/health"\)[\s\S]*@app\.get\("\/api\/tasks"\)[\s\S]*@app\.post\("\/api\/tasks"\)/],
        ["app/static/app.js", /fetch\("\/api\/tasks"\)|fetch\('\/api\/tasks'\)|api\("\/api\/tasks"\)/],
        ["tests/test_smoke.py", /\/api\/health[\s\S]*\/api\/tasks[\s\S]*compat/i],
        ["docs/review-checklist.md", /跨语言|兼容|接口契约|编码/],
      ];
  const failed = checks.find(([fileName, pattern]) => !byFile[fileName] || !pattern.test(joined[fileName] || ""));
  if (!failed) {
    return { ok: true, summary: "兼容性门禁通过：功能、接口契约、运行脚本、编码格式和测试入口一致。" };
  }
  const reworkItem = byFile[failed[0]] || plan.find((item) => item.agentId !== "tester") || plan[0];
  const refund = Math.ceil((reworkItem?.lines.join("\n").length || 0) / 3.8);
  if (reworkItem) agentTokenRefunds[reworkItem.agentId] = (agentTokenRefunds[reworkItem.agentId] || 0) + refund;
  return {
    ok: false,
    reworkItem,
    ownerName: reworkItem?.agent.name || "原负责 Agent",
    summary: `兼容性门禁未通过：${failed[0]} 与项目运行/测试契约不一致。返还 ${formatTokenCount(refund)} token 后重构。`,
  };
}

function writeSingleAgentProjectCode(task) {
  const deliveryKey = `single-agent:${taskDeliveryKey(task)}:${task.owner}`;
  if (codedTaskKeys.has(deliveryKey)) return;
  codedTaskKeys.add(deliveryKey);
  const owner = agentById(task.owner) || agentById("frontend");
  const [, fileName] = codeTargetForAgent(owner.id, task.title || "");
  const plan = [
    {
      agentId: owner.id,
      agent: owner,
      fileName,
      lines: prependRequirementContext(buildAgentArtifactLines(owner.id, task, fileName), task, owner.name, fileName),
    },
  ];
  const deliveryRepo = ensureAgentDeliveryRepo(task, plan);
  const repoId = deliveryRepo.id;
  openAutoCodeWorkspace(repoId, fileName);
  ensureAgentDeliveryFile(deliveryRepo, fileName, owner.id);
  streamCodeLines({
    repoId,
    fileName,
    agentName: owner.name,
    taskTitle: `${task.title} / ${owner.name} 定向产物`,
    taskId: taskDeliveryKey(task),
    lines: plan[0].lines,
    replace: true,
  });
}

function writeTaskCompletionCode(task, owner) {
  const deliveryKey = `completion:${taskDeliveryKey(task)}:${owner.id}`;
  if (codedTaskKeys.has(deliveryKey)) return;
  codedTaskKeys.add(deliveryKey);
  const target = codeTargetForAgent(owner.id, task.workflowTitle || task.title || "");
  const repo = openWorldRepos.find((item) => item.id === target[0]);
  if (!repo) return;
  const fileName = target[1];
  streamCodeLines({
    repoId: target[0],
    fileName,
    agentName: owner.name,
    taskTitle: task.title,
    taskId: taskDeliveryKey(task),
    lines: prependRequirementContext(buildAgentArtifactLines(owner.id, task, fileName), task, owner.name, fileName),
    replace: true,
  });
}

function renderAutoAgentMonitor() {
  if (!els.autoAgentMonitor) return;
  const selected = els.autoCodeOwner?.value || "frontend";
  const monitorAgents = ["frontend", "backend", "tester", "reviewer"];
  els.autoAgentMonitor.innerHTML = monitorAgents
    .map((id) => {
      const agent = agentById(id);
      if (!agent) return "";
      const ownedTasks = tasks.filter((task) => task.owner === id && !["done", "delivery", "packaged", "delivered"].includes(task.status));
      const current = ownedTasks.find((task) => ["active", "blocked", "review"].includes(task.status)) || ownedTasks[0];
      const busy = isAgentBusy(id);
      return `
        <button class="auto-agent-load ${selected === id ? "selected" : ""} ${busy ? "busy" : "free"}" type="button" data-auto-agent-monitor="${id}">
          <span class="load-dot" style="--agent-color:${escapeHtml(agent.color)}"></span>
          <strong>${escapeHtml(agent.name)}</strong>
          <em>${escapeHtml(statusLabel(agent.status))} / ${ownedTasks.length} 个任务</em>
          <small>${escapeHtml(current?.workflowTitle || current?.title || "暂无当前任务")}</small>
        </button>
      `;
    })
    .join("");
  document.querySelectorAll("[data-auto-agent-monitor]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.autoAgentMonitor;
      selectAutoAgent(id);
    });
  });
}

function resetAll() {
  if (backendConnected && socket) {
    socket.send(JSON.stringify({ command: "reset" }));
    return;
  }
  stopAuto();
  suppressNonEmptyTaskSnapshotUntil = Date.now() + 2500;
  currentTaskIndex = -1;
  selectedAgentId = "master";
  tasks.forEach((task) => {
    task.status = "pending";
  });
  agents.forEach((agent) => {
    agent.status = "idle";
    agent.x = agent.home[0];
    agent.y = agent.home[1];
  });
  els.log.innerHTML = "";
  addLog("系统已重置，等待 Master 分发第一条任务。", "System");
  renderAll();
}

async function clearTaskQueue() {
  const localCount = tasks.length;
  const localDeliveryCount = projectDeliveries.length;
  if (els.clearTasksBtn) {
    els.clearTasksBtn.disabled = true;
    els.clearTasksBtn.textContent = "清空中";
  }
  stopAuto();
  suppressNonEmptyTaskSnapshotUntil = Date.now() + 2500;
  currentTaskIndex = -1;
  tasks = [];
  projectDeliveries = [];
  activeRuntimeDeliveryId = "";
  localStorage.removeItem("qfActiveRuntimeDeliveryId");
  Object.keys(deliveryTestStates).forEach((key) => delete deliveryTestStates[key]);
  backendQueueStats = { ...backendQueueStats, pending: 0, active: 0, blocked: 0, running_total: 0 };
  agents.forEach((agent) => {
    agent.status = "idle";
    agent.x = agent.home[0];
    agent.y = agent.home[1];
    agent.currentTaskId = null;
  });
  renderAll();
  addLog(`已清空任务队列 ${localCount} 条，项目交付 ${localDeliveryCount} 个。`, "System");

  if (!backendConnected) {
    if (els.clearTasksBtn) {
      els.clearTasksBtn.disabled = false;
      els.clearTasksBtn.textContent = "清空";
    }
    return;
  }
  try {
    const [taskResponse, deliveryResponse] = await Promise.all([
      fetch("/api/tasks/clear", { method: "POST" }),
      fetch("/api/project-deliveries/clear", { method: "POST" }),
    ]);
    if (!taskResponse.ok) throw new Error(`tasks HTTP ${taskResponse.status}`);
    if (!deliveryResponse.ok) throw new Error(`deliveries HTTP ${deliveryResponse.status}`);
    const taskData = await taskResponse.json();
    const deliveryData = await deliveryResponse.json();
    if (deliveryData.snapshot) applySnapshot(deliveryData.snapshot);
    else if (taskData.snapshot) applySnapshot(taskData.snapshot);
    projectDeliveries = [];
    renderAll();
    addLog(`后端已同步清空：任务 ${taskData.cleared ?? localCount} 条，项目 ${deliveryData.cleared ?? localDeliveryCount} 个。`, "System");
  } catch (error) {
    addLog(`后端清空失败，已保留本地清空结果：${error.message}`, "System");
  } finally {
    if (els.clearTasksBtn) {
      els.clearTasksBtn.disabled = false;
      els.clearTasksBtn.textContent = "清空";
    }
  }
}

async function createTask(title, ownerId, options = {}) {
  if (!title.trim()) return;

  if (backendConnected) {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, owner_id: ownerId, source: options.source || "desktop" }),
    });
    if (!paused && socket) {
      socket.send(JSON.stringify({ command: "dispatch_next" }));
    }
    return;
  }

  const fallbackStation = {
    master: [520, 160],
    frontend: [560, 240],
    backend: [995, 255],
    tester: [1185, 160],
    reviewer: [1110, 345],
  }[ownerId];
  tasks.push({
    id: tasks.length + 1,
    title,
    owner: ownerId,
    station: fallbackStation,
    status: "pending",
    source: options.source || "local",
    requiresReview: Boolean(options.singleAgent),
  });
  addLog(`新增本地任务：${title}`, agentById(ownerId).name);
  renderAll();
  if (!paused && tasks.every((task) => task.status !== "active" && task.status !== "blocked")) {
    const pendingIndex = tasks.findIndex((task) => task.status === "pending");
    if (pendingIndex >= 0) {
      window.setTimeout(() => runTask(pendingIndex), 120);
    }
  }
}

function isAgentBusy(agentId) {
  const agent = agentById(agentId);
  const busyAgentState = ["walking", "working", "blocked"].includes(agent?.status);
  const busyTaskState = tasks.some((task) => task.owner === agentId && ["active", "blocked", "assigned", "pending", "review"].includes(task.status));
  return busyAgentState || busyTaskState;
}

function agentLoadCount(agentId) {
  return tasks.filter((task) => task.owner === agentId && !["done", "delivery", "packaged"].includes(task.status)).length;
}

function masterHandoffSnapshot(preferredOwner = "master") {
  const coreOwners = ["frontend", "backend", "tester"];
  const rows = coreOwners.map((id) => {
    const agent = agentById(id);
    const busy = isAgentBusy(id);
    return {
      id,
      name: agent?.name || id,
      role: agent?.role || "Agent",
      status: agent?.status || "idle",
      busy,
      load: agentLoadCount(id),
    };
  });
  const freeRows = rows.filter((item) => !item.busy);
  const requestedOwners = coreOwners.includes(preferredOwner) ? [preferredOwner] : coreOwners;
  const targetRows = rows.filter((item) => requestedOwners.includes(item.id) && !item.busy);
  const reviewerBusy = isAgentBusy("reviewer");
  return {
    rows,
    freeRows,
    reviewerBusy,
    requestedOwners,
    targetRows,
    canAccept: targetRows.length > 0 && !reviewerBusy,
    targetOwners: targetRows.map((item) => item.id),
    targetOwner: "reviewer",
  };
}

function requestMasterTaskHandoff(title, preferredOwner = "master") {
  const cleanTitle = title.trim();
  if (!cleanTitle) return;
  const snapshot = masterHandoffSnapshot(preferredOwner);
  pendingMasterHandoff = {
    id: `handoff-${Date.now().toString(36)}`,
    title: cleanTitle,
    preferredOwner,
    targetOwner: "reviewer",
    targetOwners: snapshot.targetOwners,
    canAccept: snapshot.canAccept,
  };
  renderMasterHandoffDialog();
}

function currentMasterHandoffSnapshot() {
  const snapshot = masterHandoffSnapshot(pendingMasterHandoff?.preferredOwner || "master");
  if (!pendingMasterHandoff) return snapshot;
  const selectedOwners = Array.isArray(pendingMasterHandoff.targetOwners) && pendingMasterHandoff.targetOwners.length
    ? pendingMasterHandoff.targetOwners.filter((id) => snapshot.freeRows.some((item) => item.id === id))
    : snapshot.targetOwners;
  snapshot.selectedOwners = selectedOwners;
  snapshot.selectedRows = snapshot.rows.filter((item) => selectedOwners.includes(item.id));
  snapshot.canAcceptSelection = selectedOwners.length > 0 && !snapshot.reviewerBusy;
  return snapshot;
}

function renderMasterHandoffDialog(snapshot = currentMasterHandoffSnapshot()) {
  let dialog = document.getElementById("masterHandoffDialog");
  if (!dialog) {
    dialog = document.createElement("section");
    dialog.id = "masterHandoffDialog";
    dialog.className = "master-handoff-dialog";
    dialog.setAttribute("aria-hidden", "true");
    document.body.appendChild(dialog);
  }
  const handoff = pendingMasterHandoff;
  if (!handoff) return;
  pendingMasterHandoff.targetOwner = "reviewer";
  pendingMasterHandoff.targetOwners = snapshot.selectedOwners || snapshot.targetOwners;
  const canSubmit = snapshot.canAcceptSelection ?? snapshot.canAccept;
  const targetName = canSubmit ? "代码审查者" : snapshot.reviewerBusy ? "代码审查者忙碌" : "定向 Agent 忙碌";
  const availableCount = snapshot.freeRows.length;
  const busyCount = snapshot.rows.length - availableCount;
  const selectedIds = new Set(snapshot.selectedOwners || snapshot.targetOwners);
  const selectedNames = (snapshot.selectedRows || snapshot.freeRows).map((item) => item.name).join("、") || "无";
  const commandPreview = canSubmit
    ? `任务交接：${handoff.title}；团队负责人接收后生成需求书/技术书，交给代码负责人按定向目标启动：${selectedNames}。`
    : `任务交接：${handoff.title}；${snapshot.reviewerBusy ? "代码审查者正在处理任务" : "定向执行 Agent 正忙"}，暂不接收。`;
  dialog.innerHTML = `
    <div class="master-handoff-card" role="dialog" aria-modal="true" aria-label="团队负责人任务接收确认">
      <header class="master-handoff-head">
        <div><span>Master 权限确认</span><h3>是否允许团队负责人接收任务、生成技术书，并交给代码负责人？</h3></div>
        <button type="button" data-master-handoff-close title="关闭">×</button>
      </header>
      <div class="master-handoff-body">
        <main class="master-handoff-main">
          <div class="master-command-preview">
            <code>${escapeHtml(commandPreview)}</code>
            <button type="button" title="展开任务详情">展开</button>
          </div>
          <section class="master-load-grid">
            ${snapshot.rows
              .map(
                (item) => {
                  const selected = selectedIds.has(item.id);
                  return `
              <button type="button" class="${item.busy ? "busy" : `free ${selected ? "selected" : ""}`}" data-master-handoff-worker="${escapeHtml(item.id)}" ${item.busy ? "disabled" : ""} aria-pressed="${selected ? "true" : "false"}">
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(item.role)} / ${escapeHtml(statusLabel(item.status))}</span>
                <em>${item.busy ? `忙碌 · ${item.load} 个任务` : selected ? "已选中" : "点击选择"}</em>
              </button>
            `;
                },
              )
              .join("")}
          </section>
          <div class="master-handoff-all">
            <strong>定向执行范围</strong>
            <span>${escapeHtml(selectedNames)}</span>
            <em>可单选、复选或一键全选；代码负责人按当前选择启动执行。</em>
          </div>
          <div class="master-permission-options">
            <button class="selected" type="button" data-master-handoff-accept ${canSubmit ? "" : "disabled"}>
              <span>1.</span><strong>是，团队负责人接收并交给 ${escapeHtml(targetName)}</strong><b>↑↓</b>
            </button>
            <button type="button" data-master-handoff-select-all ${availableCount ? "" : "disabled"}>
              <span>2.</span><strong>全选可用 Agent（${availableCount} 个可用 / ${busyCount} 个忙碌）</strong>
            </button>
            <button type="button" data-master-handoff-close>
              <span>3.</span><strong>否，暂不接收这条任务</strong>
            </button>
          </div>
        </main>
      </div>
      <footer class="master-handoff-actions">
        <button type="button" data-master-handoff-close>跳过</button>
        <button type="button" data-master-handoff-accept ${canSubmit ? "" : "disabled"}>${canSubmit ? "提交" : "请选择 Agent"}</button>
      </footer>
    </div>
  `;
  dialog.classList.add("active");
  dialog.setAttribute("aria-hidden", "false");
}

function renderHandoffPortrait(agent, options = {}) {
  if (!agent) return "";
  const stateText = options.stateText || statusLabel(agent.status) || "待命";
  const classes = ["handoff-portrait", options.featured ? "featured" : "", options.busy ? "busy" : "free"].join(" ");
  return `
    <figure class="${classes}">
      <div class="handoff-avatar" style="--agent-color:${escapeHtml(agent.color)}">
        ${agent.crown ? '<i class="handoff-crown"></i>' : ""}
        <i class="handoff-hair"></i>
        <i class="handoff-head"></i>
        <i class="handoff-eye left"></i>
        <i class="handoff-eye right"></i>
        <i class="handoff-body"></i>
        <i class="handoff-arm left"></i>
        <i class="handoff-arm right"></i>
        <i class="handoff-leg left"></i>
        <i class="handoff-leg right"></i>
      </div>
      <figcaption>
        <strong>${escapeHtml(agent.name)}</strong>
        <span>${escapeHtml(stateText)}</span>
      </figcaption>
    </figure>
  `;
}

function closeMasterHandoffDialog() {
  const dialog = document.getElementById("masterHandoffDialog");
  dialog?.classList.remove("active");
  dialog?.setAttribute("aria-hidden", "true");
  pendingMasterHandoff = null;
}

function selectMasterHandoffOwner(ownerId) {
  if (!pendingMasterHandoff) return;
  const snapshot = masterHandoffSnapshot(pendingMasterHandoff.preferredOwner || "master");
  pendingMasterHandoff.targetOwner = "reviewer";
  const row = snapshot.freeRows.find((item) => item.id === ownerId);
  if (!row) {
    renderMasterHandoffDialog(currentMasterHandoffSnapshot());
    return;
  }
  pendingMasterHandoff.targetOwners = [ownerId];
  renderMasterHandoffDialog();
}

function toggleMasterHandoffWorker(workerId) {
  if (!pendingMasterHandoff) return;
  const snapshot = masterHandoffSnapshot(pendingMasterHandoff.preferredOwner || "master");
  if (!snapshot.freeRows.some((item) => item.id === workerId)) return;
  const current = new Set((pendingMasterHandoff.targetOwners || []).filter((id) => snapshot.freeRows.some((item) => item.id === id)));
  if (current.has(workerId) && current.size > 1) current.delete(workerId);
  else if (current.has(workerId) && current.size === 1) current.clear();
  else current.add(workerId);
  pendingMasterHandoff.targetOwners = [...current];
  renderMasterHandoffDialog();
}

function selectAllMasterHandoffWorkers() {
  if (!pendingMasterHandoff) return;
  const snapshot = masterHandoffSnapshot(pendingMasterHandoff.preferredOwner || "master");
  pendingMasterHandoff.targetOwners = snapshot.freeRows.map((item) => item.id);
  renderMasterHandoffDialog();
}

async function acceptMasterHandoff() {
  if (!pendingMasterHandoff) return;
  const snapshot = currentMasterHandoffSnapshot();
  if (!snapshot.canAcceptSelection) {
    renderMasterHandoffDialog(snapshot);
    return;
  }
  const title = pendingMasterHandoff.title;
  const selectedOwners = snapshot.selectedOwners;
  const requirementDoc = generateMasterRequirementDoc(title, selectedOwners);
  tasks.push({
    id: `local-${localWorkflowTaskSeq++}`,
    localWorkflowId: `reviewer-intake-${Date.now().toString(36)}`,
    workflowId: `wf-${Date.now().toString(36)}`,
    workflowTitle: title,
    title,
    owner: "reviewer",
    station: stationForOwner("reviewer"),
    status: "pending",
    source: "master_handoff",
    reviewerIntake: true,
    suggestedOwners: selectedOwners,
    requirementDoc,
  });
  setAgent("master", { status: "done" });
  setAgent("reviewer", { status: "idle" });
  const ownerNames = selectedOwners.map((id) => agentById(id)?.name || id).join("、");
  recordMasterTaskHistory("生成技术书并转交", title, `${requirementDoc.id} 已交给代码负责人；定向执行 Agent：${ownerNames}`);
  addLog(`团队负责人已生成技术书 ${requirementDoc.id} 并通知代码负责人：${title}`, "团队负责人");
  pushComment("团队负责人", `已生成需求书/技术书 ${requirementDoc.id}，交给代码负责人；定向 Agent：${ownerNames}`);
  closeMasterHandoffDialog();
  renderAll();
}

function startAuto() {
  if (autoTimer || backendAutoTimer) {
    stopAuto();
    return;
  }
  els.autoBtn.textContent = "停止演示";
  addLog("自动演示已启动。", "System");
  if (backendConnected && socket) {
    socket.send(JSON.stringify({ command: "dispatch_next" }));
    backendAutoTimer = window.setInterval(() => {
      if (!paused) socket.send(JSON.stringify({ command: "dispatch_next" }));
    }, 4200);
    return;
  }
  runTask();
  autoTimer = window.setInterval(() => {
    if (!paused && tasks.every((task) => task.status !== "active")) {
      runTask();
    }
  }, 3600);
}

function stopAuto() {
  if (backendAutoTimer) {
    window.clearInterval(backendAutoTimer);
    backendAutoTimer = null;
    els.autoBtn.textContent = "自动演示";
  }
  if (!autoTimer) return;
  window.clearInterval(autoTimer);
  autoTimer = null;
  els.autoBtn.textContent = "自动演示";
}

function connectBackend() {
  if (location.protocol === "file:") {
    els.connectionState.textContent = "local demo";
    return;
  }

  if (socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) {
    socket.close();
  }

  const wsUrl = collaborationSocketUrl();
  if (els.remoteRelayInput) els.remoteRelayInput.value = remoteRelayUrl;
  if (els.remoteRelayStatus) els.remoteRelayStatus.textContent = remoteRelayUrl ? "连接中" : "本机";
  const remoteMode = Boolean(remoteRelayUrl);
  socket = new WebSocket(wsUrl);

  socket.addEventListener("open", () => {
    backendConnected = true;
    els.connectionState.textContent = remoteMode ? "remote relay connected" : "backend connected";
    if (els.remoteRelayStatus) els.remoteRelayStatus.textContent = remoteMode ? "远程已连接" : "本机";
    addLog(remoteMode ? "已连接公网协作 Relay。" : "已连接 QuantumFlow Runtime。", "System");
    sendHello();
    socket.send(JSON.stringify({ command: "snapshot" }));
  });

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (payload.kind === "snapshot") applySnapshot(payload.data);
    if (payload.kind === "online") renderOnlineCollaborators(payload.data || []);
    if (payload.kind === "chat_cleared") handleRealtimeChatCleared(payload.data || {});
    if (payload.kind === "collaboration_comment") appendCollaborationComment(payload.data);
    if (payload.kind === "collaboration_comments") {
      (payload.data || []).forEach(appendCollaborationComment);
    }
    if (payload.kind === "chat_history") applyChatHistory(payload.data || {});
    if (payload.kind === "chat_message") appendCollaborationComment(payload.data);
    if (payload.kind === "project_room_message" && activeProjectRoom && String(payload.room_id) === String(activeProjectRoom.id)) {
      appendProjectRoomRealtimeMessage(payload.data);
    }
    if (payload.kind === "admin_members") loadAdminMembers();
    if (payload.kind === "admin_apis") loadAdminApis();
  });

  socket.addEventListener("close", () => {
    backendConnected = false;
    els.connectionState.textContent = "local demo";
    if (els.remoteRelayStatus) els.remoteRelayStatus.textContent = remoteMode ? "远程断开" : "本机";
    addLog(remoteMode ? "公网协作 Relay 已断开，请检查网络或地址。" : "后端连接已断开，切回本地演示模式。", "System");
  });

  socket.addEventListener("error", () => {
    if (els.remoteRelayStatus) els.remoteRelayStatus.textContent = remoteMode ? "连接失败" : "本机异常";
  });
}

function collaborationSocketUrl() {
  if (!remoteRelayUrl) {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${location.host}/ws`;
  }
  const raw = remoteRelayUrl.trim().replace(/\/$/, "");
  if (raw.startsWith("ws://") || raw.startsWith("wss://")) return raw.endsWith("/ws") ? raw : `${raw}/ws`;
  if (raw.startsWith("https://")) return `wss://${raw.slice("https://".length)}${raw.endsWith("/ws") ? "" : "/ws"}`;
  if (raw.startsWith("http://")) return `ws://${raw.slice("http://".length)}${raw.endsWith("/ws") ? "" : "/ws"}`;
  return `wss://${raw}${raw.endsWith("/ws") ? "" : "/ws"}`;
}

function saveRemoteRelay(event) {
  event.preventDefault();
  const value = els.remoteRelayInput?.value.trim() || "";
  remoteRelayUrl = value;
  if (value) localStorage.setItem("qfRemoteRelayUrl", value);
  else localStorage.removeItem("qfRemoteRelayUrl");
  if (els.remoteRelayStatus) els.remoteRelayStatus.textContent = value ? "连接中" : "本机";
  connectBackend();
}

async function loadRealtimeServiceStatus() {
  if (location.protocol === "file:") return;
  try {
    const response = await fetch(`/api/realtime/status?t=${Date.now()}`);
    const data = await response.json();
    if (Array.isArray(data.online)) renderOnlineCollaborators(data.online);
    const virtual = data.virtual_network || {};
    if (els.networkFacts) {
      els.networkFacts.innerHTML = `
        <div><span>本机 WebSocket</span><code>${escapeHtml(data.local_ws || "-")}</code></div>
        <div><span>局域网 WebSocket</span><code>${escapeHtml(data.lan_ws || "-")}</code></div>
        <div><span>虚拟网络 ID</span><code>${escapeHtml(virtual.network_id || "-")}</code></div>
        <div><span>虚拟网络状态</span><code>${escapeHtml(virtual.status || "offline")}${virtual.assigned_ips?.length ? ` / ${escapeHtml(virtual.assigned_ips.join(", "))}` : ""}</code></div>
        <div><span>实时频道</span><code>${escapeHtml((data.channels || []).join(" / "))}</code></div>
        <div><span>在线连接</span><code>${escapeHtml(String(data.online_count || 0))} online</code></div>
      `;
    }
    renderPublicTunnelStatus(data.public_tunnel);
  } catch {
    if (els.networkFacts) els.networkFacts.innerHTML = '<div><span>联网服务</span><code>读取失败，请确认后端服务运行中</code></div>';
    renderPublicTunnelStatus(null);
  }
}

function renderPublicTunnelStatus(tunnel) {
  if (!els.adminPublicEntry && !els.adminPublicTunnelState) return;
  if (tunnel?.public_url) {
    if (els.adminPublicTunnelState) els.adminPublicTunnelState.textContent = "已启动";
    if (els.adminPublicEntry) {
      els.adminPublicEntry.innerHTML = `
        <strong>公网入口已就绪</strong>
        <code>${escapeHtml(tunnel.public_url)}</code>
        <p>把这个地址发给朋友，登录后即可实时协作。</p>
      `;
    }
    return;
  }
  if (els.adminPublicTunnelState) els.adminPublicTunnelState.textContent = "未启动";
  if (els.adminPublicEntry) {
    els.adminPublicEntry.innerHTML = `
      <strong>等待公网入口</strong>
      <p>运行 start_public_tunnel.ps1 后，这里会显示可分享给朋友的公网地址。</p>
    `;
  }
}

function renderAll() {
  renderAgents();
  renderAgentStrip();
  renderTasks();
  renderAutoAgentMonitor();
  if (document.body.classList.contains("profile-mode")) renderProfile();
  updateMetrics();
  renderRuntimeEnvironment();
  renderCommunity();
}

els.nextBtn.addEventListener("click", () => runTask());
els.autoBtn.addEventListener("click", startAuto);
els.resetBtn.addEventListener("click", resetAll);
els.pauseBtn.addEventListener("click", () => {
  paused = !paused;
  els.pauseBtn.textContent = paused ? "▶" : "⏸";
  addLog(paused ? "调度已暂停。" : "调度已继续。", "System");
});
els.runtimeProjectTestBtn?.addEventListener("click", () => testProjectDelivery(getActiveRuntimeDelivery()?.id));
els.runtimeProjectOpenBtn?.addEventListener("click", () => openProjectDeliveryRuntime(getActiveRuntimeDelivery()?.id));
els.runtimeProjectFixBtn?.addEventListener("click", () => requestProjectDeliveryFix(getActiveRuntimeDelivery()?.id));
els.runtimeRepoSelect?.addEventListener("change", () => {
  setActiveRuntimeRepo(els.runtimeRepoSelect.value);
  renderRuntimeRepoTester();
});
els.runtimeRepoTestBtn?.addEventListener("click", () => testRuntimeRepo(els.runtimeRepoSelect?.value));
els.runtimeRepoPreviewBtn?.addEventListener("click", () => previewRuntimeRepo(els.runtimeRepoSelect?.value));
els.runtimeRepoOpenCodeBtn?.addEventListener("click", openRuntimeRepoInCode);
els.runtimePreviewRefreshBtn?.addEventListener("click", () => {
  const url = els.runtimeProjectFrame?.src || "";
  if (!url) return;
  els.runtimeProjectFrame.src = url;
});
els.runtimeProjectFrame?.addEventListener("load", () => {
  try {
    const doc = els.runtimeProjectFrame.contentDocument;
    const labels = { pending: "等待", active: "进行中", blocked: "阻塞", done: "完成", normal: "普通", high: "高", urgent: "紧急" };
    doc?.querySelectorAll("button, small").forEach((node) => {
      Object.entries(labels).forEach(([from, to]) => {
        node.textContent = String(node.textContent || "").replace(new RegExp(`\\b${from}\\b`, "g"), to);
      });
    });
  } catch {
    // Cross-origin previews cannot be patched; generated local projects are same-origin.
  }
});
els.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  requestMasterTaskHandoff(els.taskInput.value, els.ownerSelect.value);
});
els.clearTasksBtn?.addEventListener("click", clearTaskQueue);
els.commentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = els.commentInput.value.trim();
  if (!text) return;
  const kind = els.commentKind?.value || "建议";
  pushComment("你", `${kind}：${text}`);
  els.commentInput.value = "";
});
els.autoCodeForm?.addEventListener("submit", submitAutoCodeTask);
els.autoCodeInput?.addEventListener("input", () => {
  window.clearTimeout(arbitrationTimer);
  arbitrationTimer = window.setTimeout(arbitrateAutoAgent, 450);
});
els.issueDescribeBtn?.addEventListener("click", describeIssueFromKeywords);
els.issueCreateForm?.addEventListener("submit", submitManualIssue);
function openInternalRepoCreateForm() {
  if (!els.repoCreateForm) return;
  switchOpenWorldPanel("repoCreatePanel");
  els.repoCreateName?.focus();
}

function syncRepoCreateTypeDefaults() {
  const type = els.repoCreateType?.value || "fullstack";
  if (type === "frontend" && els.repoCreateBackendLang) els.repoCreateBackendLang.value = "None";
  if (type === "backend" && els.repoCreateFrontendLang) els.repoCreateFrontendLang.value = "None";
  if (type === "connector" && els.repoCreateFrontendLang) els.repoCreateFrontendLang.value = "None";
  if (["fullstack", "plugin"].includes(type) && els.repoCreateFrontendLang?.value === "None") els.repoCreateFrontendLang.value = "Vue 3";
  if (["fullstack", "plugin", "connector"].includes(type) && els.repoCreateBackendLang?.value === "None") els.repoCreateBackendLang.value = "Python / FastAPI";
}

function openInternalRepoFileCreateForm(repoId = activeRepoId) {
  const repo = openWorldRepos.find((item) => item.id === repoId) || openWorldRepos.find((item) => item.id === activeRepoId) || openWorldRepos[0];
  if (!repo || !els.repoFileCreateForm) return;
  activeRepoId = repo.id;
  if (els.repoFileCreateCrumb) els.repoFileCreateCrumb.textContent = `内部仓库 / ${repo.name} / 新建文件`;
  if (els.repoFileCreateRepoName) els.repoFileCreateRepoName.textContent = repo.name;
  if (els.repoFileCreateAgent) els.repoFileCreateAgent.value = selectedAgentId || "frontend";
  switchOpenWorldPanel("repoFileCreatePanel");
  els.repoFileCreateName?.focus();
}
els.repoQuickCreateBtn?.addEventListener("click", openInternalRepoCreateForm);
els.repoCreateToggleBtn?.addEventListener("click", openInternalRepoCreateForm);
els.repoCreateType?.addEventListener("change", syncRepoCreateTypeDefaults);
els.repoCreateForm?.addEventListener("submit", createInternalRepo);
els.repoFileCreateForm?.addEventListener("submit", createInternalRepoFile);
document.querySelectorAll(".repo-search").forEach((input) => {
  input.addEventListener("input", () => {
    repoInlineQuery = input.value || "";
    document.querySelectorAll(".repo-search").forEach((peer) => {
      if (peer !== input) peer.value = repoInlineQuery;
    });
    renderCommunity();
  });
});
els.connectorConfigForm?.addEventListener("submit", saveConnectorConfig);
els.flushOutboxBtn?.addEventListener("click", flushOutboxQueue);
els.testFeishuBtn?.addEventListener("click", sendFeishuTest);
els.manualFeishuForm?.addEventListener("submit", sendManualFeishu);
els.gitSyncForm?.addEventListener("submit", syncGitRepository);
els.botChatForm?.addEventListener("submit", sendBotChat);
els.botInlineForm?.addEventListener("submit", sendBotChat);
els.adminChatForm?.addEventListener("submit", sendAdminChat);
els.publicChatForm?.addEventListener("submit", sendPublicChat);
els.publicChatDockForm?.addEventListener("submit", sendPublicChat);
els.publicWorldChatForm?.addEventListener("submit", sendPublicChat);
els.oswNewRepoForm?.addEventListener("submit", createPublicRepo);
els.adminApiForm?.addEventListener("submit", addAdminApi);
els.adminMemberForm?.addEventListener("submit", addAdminMember);
els.adminMemberUserId?.addEventListener("input", scheduleAdminUserLookup);
els.adminMemberRole?.addEventListener("change", () => syncPermissionPicker());
document.querySelectorAll("[data-admin-permission-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const active = button.getAttribute("aria-pressed") === "true";
    button.setAttribute("aria-pressed", String(!active));
  });
});
els.projectRoomForm?.addEventListener("submit", createProjectRoom);
els.projectJoinForm?.addEventListener("submit", joinProjectRoom);
els.oswProjectRoomForm?.addEventListener("submit", createOpenSourceProjectRoom);
els.oswJoinProjectForm?.addEventListener("submit", joinOpenSourceProject);
els.remoteRelayForm?.addEventListener("submit", saveRemoteRelay);
els.roomMessageForm?.addEventListener("submit", submitRoomMessage);
els.roomDocSaveBtn?.addEventListener("click", saveRoomDoc);
els.roomBackBtn?.addEventListener("click", () => switchView("developerAdmin"));
els.roomInviteCopyBtn?.addEventListener("click", () => copyInviteCode(els.roomInviteCopyBtn));
document.addEventListener("click", (event) => {
  const handoffAccept = event.target.closest?.("[data-master-handoff-accept]");
  if (handoffAccept) {
    acceptMasterHandoff();
    if (els.taskInput) els.taskInput.value = "";
    return;
  }
  const handoffWorker = event.target.closest?.("[data-master-handoff-worker]");
  if (handoffWorker) {
    toggleMasterHandoffWorker(handoffWorker.dataset.masterHandoffWorker);
    return;
  }
  const handoffSelectAll = event.target.closest?.("[data-master-handoff-select-all]");
  if (handoffSelectAll) {
    selectAllMasterHandoffWorkers();
    return;
  }
  const handoffClose = event.target.closest?.("[data-master-handoff-close]");
  if (handoffClose) {
    closeMasterHandoffDialog();
    return;
  }
  const openRoomButton = event.target.closest?.("[data-open-room]");
  if (openRoomButton) openProjectRoom(openRoomButton.dataset.openRoom);
  const reviewerChoice = event.target.closest?.("[data-reviewer-task]");
  if (reviewerChoice) {
    const task = findWorkflowTask(reviewerChoice.dataset.reviewerTask);
    if (task?.reviewerIntake) {
      selectedReviewerIntakeKey = String(task.localWorkflowId || task.id);
      openReviewerDispatchPanel(agentById("reviewer"));
    }
  }
  const reviewerDispatchSubmit = event.target.closest?.("[data-reviewer-dispatch-submit]");
  if (reviewerDispatchSubmit) {
    dispatchReviewerTask(reviewerDispatchSubmit.dataset.reviewerDispatchSubmit);
  }
  const reviewerReviewSubmit = event.target.closest?.("[data-reviewer-review-submit]");
  if (reviewerReviewSubmit) {
    approveReviewerPackage();
  }
  const masterDeliver = event.target.closest?.("[data-master-deliver-task]");
  if (masterDeliver) {
    deliverMasterTask(masterDeliver.dataset.masterDeliverTask);
  }
  const reviewerDispatch = event.target.closest?.("[data-reviewer-dispatch-owner]");
  if (reviewerDispatch) {
    dispatchReviewerTask(reviewerDispatch.dataset.reviewerDispatchOwner);
  }
});
els.workspaceTaskForm?.addEventListener("submit", submitWorkspaceTask);
els.workspaceChatForm?.addEventListener("submit", submitWorkspaceChat);
els.botChatOpen?.addEventListener("click", openBotChatWindow);
els.botChatClose?.addEventListener("click", closeBotChatWindow);
els.agentQuickClose?.addEventListener("click", closeAgentQuickPanel);
els.agentQuickEditorBtn?.addEventListener("click", openSelectedAgentEditor);
els.authUserBtn?.addEventListener("click", () => (currentUser ? switchView("profile") : showAuthView("login")));
els.loginForm?.addEventListener("submit", submitLogin);
els.registerForm?.addEventListener("submit", submitRegister);
els.forgotForm?.addEventListener("submit", submitForgotPassword);
els.profileForm?.addEventListener("submit", submitProfile);
els.profileEditBtn?.addEventListener("click", openProfileEditor);
els.sendRegisterCodeBtn?.addEventListener("click", () => sendAuthCode(els.registerTarget, "register", els.sendRegisterCodeBtn, els.registerCode));
els.sendForgotCodeBtn?.addEventListener("click", () => sendAuthCode(els.forgotTarget, "reset_password", els.sendForgotCodeBtn, els.forgotCode));
els.logoutBtn?.addEventListener("click", logout);
document.querySelectorAll("[data-auth-view]").forEach((button) => {
  button.addEventListener("click", () => showAuthView(button.dataset.authView));
});
document.querySelectorAll("[data-profile-tab]").forEach((button) => {
  button.addEventListener("click", () => switchProfileTab(button.dataset.profileTab));
});
document.querySelectorAll("[data-world-panel-target]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    switchOpenWorldPanel(button.dataset.worldPanelTarget);
  });
});
els.communityView?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-world-panel-target]");
  if (!button || !els.communityView.contains(button)) return;
  switchOpenWorldPanel(button.dataset.worldPanelTarget);
});
document.querySelectorAll("[data-runtime-open-view]").forEach((button) => {
  button.addEventListener("click", () => openRuntimeFeature(button));
});
els.openSourceWorldView?.addEventListener("click", handleOpenSourceClick);
document.querySelectorAll("[data-osw-action]").forEach((button) => {
  button.addEventListener("click", () => handleOpenSourceAction(button.dataset.oswAction));
});
document.querySelectorAll("[data-window]").forEach((button) => {
  button.addEventListener("click", () => openToolWindow(button.dataset.window));
});
document.querySelectorAll("[data-close-window]").forEach((button) => {
  button.addEventListener("click", () => closeToolWindow(button.dataset.closeWindow));
});
els.adoptSuggestionBtn.addEventListener("click", adoptLatestSuggestion);
els.manualEditBtn?.addEventListener("click", () => setManualEditMode(true));
els.manualCompleteBtn?.addEventListener("click", completeManualCode);
els.manualCancelBtn?.addEventListener("click", () => setManualEditMode(false));
els.manualSaveBtn?.addEventListener("click", saveManualCodeEdit);
els.llmPluginSaveBtn?.addEventListener("click", saveLlmPluginConfig);
els.llmPluginGenerateBtn?.addEventListener("click", generateWithLlmPlugin);
els.llmPluginInsertBtn?.addEventListener("click", insertLlmPluginResult);
els.llmPluginReviewBtn?.addEventListener("click", sendLlmPluginResultToReview);
document.querySelectorAll("[data-coding-mode]").forEach((button) => {
  button.addEventListener("click", () => switchCodingMode(button.dataset.codingMode));
});
document.querySelectorAll("[data-auto-agent]").forEach((button) => {
  button.addEventListener("click", () => {
    const id = button.dataset.autoAgent;
    selectAutoAgent(id);
  });
});
els.studioClose.addEventListener("click", closeCoderStudio);
document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    switchView(button.dataset.view);
  });
});
document.querySelectorAll("[data-admin-panel-target]").forEach((button) => {
  button.addEventListener("click", () => switchAdminPanel(button.dataset.adminPanelTarget));
});

const adminPanelRoutes = {
  adminOverviewPanel: "overview",
  adminApiPanel: "apis",
  adminPermissionPanel: "permissions",
  adminChatPanel: "chat",
};

function adminPanelFromPath() {
  const slug = location.pathname.split("/").filter(Boolean)[1];
  const entry = Object.entries(adminPanelRoutes).find(([, value]) => value === slug);
  return entry?.[0] || "adminOverviewPanel";
}

function switchAdminPanel(panelId) {
  const target = panelId || "adminOverviewPanel";
  document.querySelectorAll(".admin-subpanel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === target);
  });
  document.querySelectorAll("[data-admin-panel-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminPanelTarget === target);
  });
  if (document.body.classList.contains("admin-mode") && location.protocol !== "file:") {
    history.replaceState(null, "", `/admin/${adminPanelRoutes[target] || adminPanelRoutes.adminOverviewPanel}`);
  }
  if (target === "adminChatPanel") {
    renderAdminChat();
    renderOnlineCollaborators();
  } else {
    stopAdminChatPreview();
  }
  if (target === "adminApiPanel") loadAdminApis();
  if (target === "adminPermissionPanel") {
    loadAdminMembers();
    loadProjectRooms();
  }
  if (target === "adminOverviewPanel") {
    loadAdminApis();
    loadAdminMembers();
    renderAdminOverviewCharts();
  }
}

function renderAdminChat() {
  if (!els.adminChatList) return;
  els.adminChatList.innerHTML = adminChatMessages.length
    ? adminChatMessages
        .map((item) => {
          const own = isOwnAdminMessage(item);
          const assistant = isCodexAssistant(item.name);
          return `
      <div class="admin-chat-item ${own ? "own" : "other"} ${assistant ? "assistant" : ""}">
        <div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.role)}</span></div>
        <p>${escapeHtml(item.text)}</p>
      </div>`;
        })
        .join("")
    : '<div class="admin-chat-empty">暂无真实开发者消息。登录后的成员发言会显示在这里。</div>';
  els.adminChatList.scrollTop = els.adminChatList.scrollHeight;
}

function isOwnAdminMessage(item) {
  const selfNames = new Set(
    [
      collaboratorName,
      currentUser?.display_name,
      currentUser?.username,
      "你",
    ]
      .filter(Boolean)
      .map((value) => String(value).trim()),
  );
  return selfNames.has(String(item?.name || "").trim());
}

function isCodexAssistant(name) {
  return String(name || "").trim().toLowerCase() === "codex";
}

function renderWorkspace() {
  if (els.workspaceTaskList) {
    els.workspaceTaskList.innerHTML = workspaceTasks
      .slice()
      .reverse()
      .map(
        (item) => `
        <div class="workspace-task-item ${escapeHtml(item.status)}">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(agentById(item.owner)?.name || item.owner)} 路 ${escapeHtml(item.status)}</span>
        </div>
      `,
      )
      .join("");
  }
  if (els.workspaceDiscussionList) {
    els.workspaceDiscussionList.innerHTML = workspaceMessages
      .map(
        (item) => `
        <div class="workspace-message ${item.name === "Codex" ? "codex" : ""}">
          <strong>${escapeHtml(item.name)} <span>${escapeHtml(item.role)}</span></strong>
          <p>${escapeHtml(item.text)}</p>
        </div>
      `,
      )
      .join("");
    els.workspaceDiscussionList.scrollTop = els.workspaceDiscussionList.scrollHeight;
  }
  if (els.workspaceCodeStream) {
    els.workspaceCodeStream.innerHTML = workspaceCodeEvents
      .slice(-9)
      .map((line, index) => `<code><b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(line)}</code>`)
      .join("");
    els.workspaceCodeStream.scrollTop = els.workspaceCodeStream.scrollHeight;
  }
  renderWorkspaceOnline();
}

function renderWorkspaceOnline() {
  if (!els.workspaceOnlineMini) return;
  const peers = publicWorldOnlinePeers.length
    ? publicWorldOnlinePeers
    : [{ id: collaboratorClientId, name: collaboratorName, role: "Developer" }];
  const rows = peers.map((peer) => ({ name: peer.name || "Developer", role: peer.role || "Developer", color: "#21d6e7" }));
  els.workspaceOnlineMini.innerHTML = rows
    .map(
      (item) => `
      <div>
        <i style="--avatar:${item.color}">${escapeHtml(avatarInitial(item.name))}</i>
        <span><strong>${escapeHtml(item.name)}</strong><em>${escapeHtml(item.role)}</em></span>
      </div>
    `,
    )
    .join("");
}

async function submitWorkspaceTask(event) {
  event.preventDefault();
  if (!requireDeveloperLogin()) return;
  const title = els.workspaceTaskInput?.value.trim() || "";
  const owner = els.workspaceTaskOwner?.value || "master";
  if (!title) return;
  workspaceTasks.push({ title, owner, status: "queued" });
  workspaceMessages.push({
    name: currentUser?.display_name || collaboratorName,
    role: currentUser?.role || "Developer",
    text: `提交开发任务：${title}`,
  });
  workspaceMessages.push({
    name: "Codex",
    role: "Pair Agent",
    text: `我会参与讨论，并把任务交给 ${agentById(owner)?.name || owner}。建议先确认验收标准，再让调度中枢自动编码。`,
  });
  workspaceCodeEvents.push(`dispatch/${owner} :: ${title}`);
  els.workspaceTaskInput.value = "";
  renderWorkspace();
  if (backendConnected) {
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ title, owner_id: owner }),
      });
      workspaceCodeEvents.push(`runtime/tasks :: queued -> ${owner}`);
      renderWorkspace();
    } catch {
      workspaceCodeEvents.push("runtime/tasks :: backend dispatch failed");
      renderWorkspace();
    }
  }
}

function submitWorkspaceChat(event) {
  event.preventDefault();
  if (!requireDeveloperLogin()) return;
  const text = els.workspaceChatInput?.value.trim() || "";
  if (!text) return;
  workspaceMessages.push({
    name: currentUser?.display_name || collaboratorName,
    role: currentUser?.role || "Developer",
    text,
  });
  workspaceMessages.push({
    name: "Codex",
    role: "Pair Agent",
    text: `收到，我会把这条建议纳入当前实现讨论：${text.slice(0, 80)}`,
  });
  workspaceCodeEvents.push(`codex/discuss :: ${text.slice(0, 72)}`);
  els.workspaceChatInput.value = "";
  renderWorkspace();
}

function avatarInitial(name) {
  const clean = String(name || "U").trim();
  return clean.slice(0, 1).toUpperCase();
}

function normalizeOnlinePeer(peer = {}, index = 0) {
  return {
    ...peer,
    id: peer.id || `online-${index}`,
    name: repairMojibake(peer.name || ""),
    role: repairMojibake(peer.role || "Developer"),
    kind: peer.kind || "developer",
    color: peer.color || (peer.kind === "assistant" ? "#2fe098" : "#21d6e7"),
    ip: repairMojibake(peer.ip || ""),
    host: repairMojibake(peer.host || ""),
    source: repairMojibake(peer.source || peer.ip || peer.host || "LAN / WebSocket"),
    status: repairMojibake(peer.status || "online"),
  };
}

function isUsableOnlinePeer(peer = {}) {
  const name = String(peer.name || "").trim();
  if (!name) return false;
  if (/^[?\uFFFD\s]+$/.test(name)) return false;
  if (name.includes("????")) return false;
  return true;
}

function realOnlineCollaboratorRows() {
  const source = publicWorldOnlinePeers.length
    ? publicWorldOnlinePeers
    : [{ id: collaboratorClientId, name: currentUser?.display_name || collaboratorName, role: currentUser?.role || "Developer", status: "online" }];
  const merged = source.some((peer) => String(peer.id || "").toLowerCase() === codexAssistantPeer.id)
    ? source
    : [codexAssistantPeer, ...source];
  return merged
    .filter((peer) => peer.kind !== "virtual_network")
    .map(normalizeOnlinePeer)
    .filter(isUsableOnlinePeer);
}

function renderSourceOnlineCollaborators(rows = realOnlineCollaboratorRows()) {
  if (!els.peopleList) return;
  if (els.onlineCount) els.onlineCount.textContent = String(rows.length);
  if (els.onlineMiniCount) els.onlineMiniCount.textContent = String(rows.length);
  els.peopleList.innerHTML = rows.length
    ? rows
        .map(
          (item) => `
      <div class="person-item ${escapeHtml(statusClass(item.status))}">
        <i style="background:${escapeHtml(item.color)}">${escapeHtml(avatarInitial(item.name))}</i>
        <span><strong>${escapeHtml(item.name)}</strong><em>${escapeHtml(item.role)} / ${escapeHtml(item.source)}</em></span>
        <b>${escapeHtml(item.status || "online")}</b>
      </div>
    `,
        )
        .join("")
    : '<div class="history-empty">暂无真实在线协作者</div>';
}

function renderOnlineCollaborators(peers = []) {
  const memberPeers = peers.filter((peer) => peer.kind !== "virtual_network");
  const sourcePeers = memberPeers.length ? memberPeers : [{ id: collaboratorClientId, name: collaboratorName, role: "Developer" }];
  const mergedPeers = sourcePeers.some((peer) => String(peer.id || "").toLowerCase() === codexAssistantPeer.id)
    ? sourcePeers
    : [codexAssistantPeer, ...sourcePeers];
  const onlinePeers = mergedPeers.map(normalizeOnlinePeer).filter(isUsableOnlinePeer);
  publicWorldOnlinePeers = onlinePeers;
  if (els.adminChatOnline) els.adminChatOnline.textContent = `${onlinePeers.length} online`;
  if (els.onlineCount) els.onlineCount.textContent = String(onlinePeers.length);
  if (els.onlineMiniCount) els.onlineMiniCount.textContent = String(onlinePeers.length);
  renderSourceOnlineCollaborators(onlinePeers);
  renderAdminOnlineDevelopers();
  renderPublicWorldOnline();
  renderWorkspaceOnline();
  if (document.body.classList.contains("profile-mode")) renderProfile();
  if (document.body.classList.contains("admin-mode")) loadAdminMembers();
}

function renderAdminOnlineDevelopers() {
  if (!els.adminOnlineList) return;
  const peers = publicWorldOnlinePeers.length
    ? publicWorldOnlinePeers
    : [{ id: collaboratorClientId, name: collaboratorName, role: "Developer" }];
  const developerRows = peers.map((peer, index) => ({
    id: peer.id || `peer-${index}`,
    name: peer.name || "Developer",
    role: peer.role || "Developer",
    kind: peer.kind || "developer",
    color: peer.color || (peer.kind === "assistant" ? "#2fe098" : "#21d6e7"),
    source: peer.source || peer.ip || peer.host || "LAN / WebSocket",
    status: peer.status || "online",
  }));
  const rows = developerRows;
  if (els.adminOnlineTotal) els.adminOnlineTotal.textContent = String(rows.length);
  if (els.adminChatOnline) els.adminChatOnline.textContent = `${developerRows.length} online`;
  els.adminOnlineList.innerHTML = rows
    .map(
      (item) => `
      <div class="admin-online-person ${escapeHtml(statusClass(item.status))}">
        <i style="--avatar:${item.color}">${escapeHtml(avatarInitial(item.name))}</i>
        <span>
          <strong>${escapeHtml(item.name)}</strong>
          <em>${escapeHtml(item.role)} / ${escapeHtml(item.source)}</em>
        </span>
        <b>${escapeHtml(item.status || "online")}</b>
      </div>
    `,
    )
    .join("");
  renderAdminOverviewRealtime(rows);
}

function renderAdminOverviewRealtime(rows = []) {
  if (els.adminOverviewOnline) els.adminOverviewOnline.textContent = `${rows.length} online`;
  if (els.adminOverviewOnlineList) {
    els.adminOverviewOnlineList.innerHTML = rows.length
      ? rows
          .slice(0, 6)
          .map(
            (item) => `
              <div class="admin-online-person ${escapeHtml(statusClass(item.status))}">
                <i style="--avatar:${item.color}">${escapeHtml(avatarInitial(item.name))}</i>
                <span><strong>${escapeHtml(item.name)}</strong><em>${escapeHtml(item.role)} / ${escapeHtml(item.source)}</em></span>
                <b>${escapeHtml(item.status || "online")}</b>
              </div>
            `,
          )
          .join("")
      : '<div class="history-empty">暂无在线开发者。</div>';
  }
  if (els.adminPublicMessageCount) els.adminPublicMessageCount.textContent = String(publicChatMessages.length);
  if (els.adminOverviewFeed) {
    els.adminOverviewFeed.innerHTML = publicChatMessages.length
      ? publicChatMessages
          .slice(-5)
          .reverse()
          .map((item) => `<div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.text)}</span></div>`)
          .join("")
      : '<div class="history-empty">暂无公开消息。</div>';
  }
}

function renderPublicWorldOnline() {
  if (!els.publicWorldOnlineList) return;
  const peers = publicWorldOnlinePeers.length
    ? publicWorldOnlinePeers
    : [{ id: collaboratorClientId, name: collaboratorName, role: "Developer" }];
  const rows = peers;
  const onlineTotal = rows.filter((item) => String(item.status || "online").toLowerCase() === "online").length;
  if (els.publicWorldOnlineCount) els.publicWorldOnlineCount.textContent = `${onlineTotal}/${rows.length} online`;
  if (els.publicWorldOnlineTotal) els.publicWorldOnlineTotal.textContent = String(onlineTotal);
  els.publicWorldOnlineList.innerHTML = rows
    .map((item) => {
      const color = item.color || "#21d6e7";
      return `
        <div class="osw-online-person ${escapeHtml(statusClass(item.status))}">
          <i style="--avatar:${color}">${escapeHtml(avatarInitial(item.name))}</i>
          <span><strong>${escapeHtml(item.name)}</strong><em>${escapeHtml(item.role || "Developer")} / ${escapeHtml(item.source || item.ip || "WebSocket")}</em></span>
          <b>${escapeHtml(item.status || "online")}</b>
        </div>
      `;
    })
    .join("");
}

function statusClass(status) {
  const value = String(status || "online").toLowerCase();
  if (value.includes("offline") || value.includes("离线")) return "is-offline";
  if (value.includes("denied") || value.includes("待授权")) return "is-pending";
  return "is-online";
}

function sendAdminChat(event) {
  event.preventDefault();
  if (!requireDeveloperLogin()) return;
  const text = els.adminChatInput?.value.trim();
  if (!text) return;
  if (handleCodexPageOperation(text)) {
    els.adminChatInput.value = "";
    return;
  }
  const cleanedCodexText = stripCodexAddressing(text);
  if (isCodexAddressed(text) && isProjectLearningRequest(cleanedCodexText)) {
    appendCollaborationComment({
      id: `local-user-learning-${Date.now()}`,
      name: currentUser?.display_name || collaboratorName,
      text,
      kind: "admin_chat",
      target_key: currentUser?.role || "Developer",
      votes: 1,
      status: "open",
    });
    els.adminChatInput.value = "";
    startCodexProjectLearning(cleanedCodexText);
    return;
  }
  pushRealtimeChat(currentUser?.display_name || collaboratorName, text, "admin_chat", currentUser?.role || "Developer");
  els.adminChatInput.value = "";
}

function renderPublicChat() {
  const markup = publicChatMessages.length
    ? publicChatMessages
        .map((item) => {
          const own = isOwnMessageName(item.name);
          return `
          <div class="bot-chat-item public-message ${own ? "own" : "other"}">
            <strong>${escapeHtml(item.name)} 路 ${escapeHtml(item.role)}</strong>
            <p>${escapeHtml(item.text)}</p>
          </div>`;
        })
        .join("")
    : '<div class="history-empty">暂无公开消息，所有用户都可以在这里交流项目建议。</div>';
  if (els.publicChatList) {
    els.publicChatList.innerHTML = markup;
    els.publicChatList.scrollTop = els.publicChatList.scrollHeight;
  }
  if (els.publicChatDockList) {
    els.publicChatDockList.innerHTML = markup;
    els.publicChatDockList.scrollTop = els.publicChatDockList.scrollHeight;
  }
  if (els.publicWorldChatList) {
    els.publicWorldChatList.innerHTML = markup;
    els.publicWorldChatList.scrollTop = els.publicWorldChatList.scrollHeight;
  }
}

function isOwnMessageName(name) {
  const selfNames = [
    collaboratorName,
    currentUser?.display_name,
    currentUser?.username,
    "你",
  ]
    .filter(Boolean)
    .map((value) => String(value).trim());
  return selfNames.includes(String(name || "").trim());
}

function repairMojibake(value) {
  const text = String(value ?? "");
  if (!/[\u0080-\u00ff]/.test(text)) return text;
  try {
    const bytes = Uint8Array.from(Array.from(text, (char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const decodedCjk = (decoded.match(/[\u4e00-\u9fff]/g) || []).length;
    const textCjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const replacementCount = (decoded.match(/\uFFFD/g) || []).length;
    if (decodedCjk > textCjk && replacementCount <= 1) return decoded;
  } catch {
    return text;
  }
  return text;
}

function sendPublicChat(event) {
  event.preventDefault();
  if (!requireDeveloperLogin()) return;
  const input =
    event.currentTarget === els.publicChatDockForm
      ? els.publicChatDockInput
      : event.currentTarget === els.publicWorldChatForm
        ? els.publicWorldChatInput
        : els.publicChatInput;
  const text = input?.value.trim();
  if (!text) return;
  pushRealtimeChat(currentUser?.display_name || collaboratorName, text, "public_chat", "开源世界");
  input.value = "";
}

async function loadAdminApis() {
  if (!els.adminApiList) return;
  try {
    const response = await fetch("/api/admin/apis");
    const apis = await response.json();
    els.adminApiList.innerHTML = apis
      .map(
        (item) => `
        <div class="admin-row-item">
          <span><strong>${escapeHtml(item.method)} ${escapeHtml(item.path)}</strong><em>${escapeHtml(item.description || item.status)}</em></span>
          <button type="button" data-delete-api="${item.id}">删除</button>
        </div>
      `,
      )
      .join("");
    document.querySelectorAll("[data-delete-api]").forEach((button) => {
      button.addEventListener("click", () => deleteAdminApi(button.dataset.deleteApi));
    });
    renderAdminOverviewCharts();
  } catch {
    els.adminApiList.innerHTML = '<div class="history-empty">接口列表读取失败</div>';
  }
}

async function addAdminApi(event) {
  event.preventDefault();
  const path = els.adminApiPath?.value.trim();
  if (!path) return;
  const response = await fetch("/api/admin/apis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: els.adminApiMethod?.value || "GET",
      path,
      description: els.adminApiDesc?.value.trim() || "",
    }),
  });
  if (response.ok) {
    els.adminApiPath.value = "";
    els.adminApiDesc.value = "";
    loadAdminApis();
  }
}

async function deleteAdminApi(id) {
  await fetch(`/api/admin/apis/${id}`, { method: "DELETE" });
  loadAdminApis();
}

function setAdminLookupState(message, tone = "") {
  if (!els.adminMemberLookupState) return;
  els.adminMemberLookupState.textContent = message;
  els.adminMemberLookupState.dataset.tone = tone;
}

function scheduleAdminUserLookup() {
  window.clearTimeout(adminLookupTimer);
  selectedAdminUser = null;
  if (els.adminMemberName) els.adminMemberName.value = "";
  const userId = els.adminMemberUserId?.value.trim() || "";
  if (!userId) {
    setAdminLookupState("输入 ID 后自动匹配姓名");
    return;
  }
  setAdminLookupState("正在匹配用户...", "pending");
  adminLookupTimer = window.setTimeout(() => lookupAdminUserById(userId), 350);
}

async function lookupAdminUserById(userId) {
  if (!/^\d+$/.test(String(userId || ""))) {
    setAdminLookupState("用户 ID 只能是数字", "warn");
    return;
  }
  try {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { headers: authHeaders() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "未找到该用户");
    selectedAdminUser = data.user;
    const displayName = selectedAdminUser.display_name || selectedAdminUser.username || `User ${selectedAdminUser.id}`;
    if (els.adminMemberName) els.adminMemberName.value = displayName;
    if (els.adminMemberRole && selectedAdminUser.role) {
      els.adminMemberRole.value = selectedAdminUser.role;
      syncPermissionPicker(selectedAdminUser.role);
    }
    setAdminLookupState(`已匹配：${displayName} / ${selectedAdminUser.username || "-"} / ${selectedAdminUser.role || "Developer"}`, "ok");
  } catch (error) {
    selectedAdminUser = null;
    if (els.adminMemberName) els.adminMemberName.value = "";
    setAdminLookupState(error.message || "未找到该用户", "warn");
  }
}

async function loadAdminMembers() {
  if (!els.adminMemberList) return;
  try {
    const response = await fetch("/api/admin/members");
    const members = await response.json();
    els.adminMemberList.innerHTML = members.length
      ? members
          .map(
            (item) => {
              const displayStatus = isNameOnline(item.name) ? "online" : item.status;
              const displayRole = onlineRoleForName(item.name) || item.role;
              const accountLine = item.user_id
                ? `用户 #${item.user_id} · ${item.username || item.display_name || item.name}`
                : "未绑定系统用户";
              return `
            <div class="admin-row-item">
              <span>
                <strong>${escapeHtml(item.name)}</strong>
                <em>${escapeHtml(accountLine)} / ${escapeHtml(displayRole)} / ${escapeHtml(displayStatus)} / ${escapeHtml(item.project_scope || "QuantumFlow Core")}</em>
                <small>${renderPermissionBadges(item.permissions || {})}</small>
              </span>
              <button type="button" data-delete-member="${item.id}">删除</button>
            </div>
          `;
            },
          )
          .join("")
      : '<div class="history-empty">暂无成员，先添加一个开发者。</div>';
    document.querySelectorAll("[data-delete-member]").forEach((button) => {
      button.addEventListener("click", () => deleteAdminMember(button.dataset.deleteMember));
    });
    renderAdminOverviewCharts();
  } catch {
    els.adminMemberList.innerHTML = '<div class="history-empty">成员列表读取失败</div>';
  }
}

function normalizedPersonName(value) {
  return repairMojibake(value || "").trim().toLowerCase();
}

function isNameOnline(name) {
  const target = normalizedPersonName(name);
  if (!target) return false;
  return publicWorldOnlinePeers.some((peer) => {
    const names = [peer.name, peer.display_name, peer.username].map(normalizedPersonName);
    return names.includes(target);
  });
}

function onlineRoleForName(name) {
  const target = normalizedPersonName(name);
  const peer = publicWorldOnlinePeers.find((item) => [item.name, item.display_name, item.username].map(normalizedPersonName).includes(target));
  return peer?.role ? repairMojibake(peer.role) : "";
}

function defaultPermissionsForRole(role) {
  const normalized = String(role || "Developer").toLowerCase();
  if (normalized === "founder" || normalized === "owner") {
    return { war_room: true, source_world: true, workspace: true, api_registry: true, member_admin: true, founder_override: true, system_owner: true };
  }
  if (normalized === "admin") {
    return { war_room: true, source_world: true, workspace: true, api_registry: true, member_admin: true };
  }
  if (normalized === "reviewer") {
    return { war_room: true, source_world: true, workspace: true, api_registry: false, member_admin: false };
  }
  if (normalized === "guest") {
    return { war_room: false, source_world: true, workspace: false, api_registry: false, member_admin: false };
  }
  return { war_room: true, source_world: true, workspace: true, api_registry: false, member_admin: false };
}

function permissionLabels() {
  return {
    war_room: "调度中枢",
    source_world: "开源世界",
    workspace: "项目房间",
    api_registry: "接口",
    member_admin: "成员管理",
    founder_override: "创始人覆盖权",
    system_owner: "系统 Owner",
  };
}

function currentAdminPermissions() {
  const permissions = {};
  document.querySelectorAll("[data-admin-permission-toggle]").forEach((button) => {
    permissions[button.dataset.adminPermissionToggle] = button.getAttribute("aria-pressed") === "true";
  });
  return permissions;
}

function syncPermissionPicker(role = els.adminMemberRole?.value) {
  const defaults = defaultPermissionsForRole(role);
  document.querySelectorAll("[data-admin-permission-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(Boolean(defaults[button.dataset.adminPermissionToggle])));
  });
}

function renderPermissionBadges(permissions) {
  const labels = permissionLabels();
  return Object.entries(labels)
    .filter(([key]) => Boolean(permissions[key]))
    .map(([, label]) => `<i>${escapeHtml(label)}</i>`)
    .join("") || "<i>只读</i>";
}

async function addAdminMember(event) {
  event.preventDefault();
  const userId = els.adminMemberUserId?.value.trim() || "";
  let name = els.adminMemberName?.value.trim();
  if (!userId) {
    setAdminLookupState("请先输入用户 ID，再进行授权。", "warn");
    return;
  }
  if (!selectedAdminUser || String(selectedAdminUser.id) !== userId || !name) {
    await lookupAdminUserById(userId);
    name = els.adminMemberName?.value.trim();
  }
  if (!selectedAdminUser || !name) {
    setAdminLookupState("没有匹配到用户，不能授权。", "warn");
    return;
  }
  const role = els.adminMemberRole?.value || "Developer";
  const permissions = role === "Founder" ? defaultPermissionsForRole("Founder") : currentAdminPermissions();
  const response = await fetch("/api/admin/members", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      user_id: Number(userId),
      name,
      role,
      project_scope: els.adminMemberProject?.value.trim() || "QuantumFlow Core",
      permissions,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (response.ok) {
    if (currentUser && Number(currentUser.id) === Number(userId)) {
      currentUser = { ...currentUser, ...(result.user || {}), role: result.user?.role || role };
      storeAuthSession(authToken, currentUser);
      renderProfile();
    }
    if (els.adminMemberUserId) els.adminMemberUserId.value = "";
    els.adminMemberName.value = "";
    if (els.adminMemberProject) els.adminMemberProject.value = "";
    selectedAdminUser = null;
    setAdminLookupState("已授权并同步到用户账号。", "ok");
    syncPermissionPicker(role);
    loadAdminMembers();
  } else {
    setAdminLookupState(result.detail || "授权失败", "warn");
  }
}

async function deleteAdminMember(id) {
  await fetch(`/api/admin/members/${id}`, { method: "DELETE" });
  loadAdminMembers();
}

function renderProjectRooms() {
  renderProjectRoomResult();
  const createdRoomMarkup = projectRooms.length
    ? projectRooms
        .map(
          (room) => `
            <article class="project-room-item">
              <div>
                <strong>${escapeHtml(room.name)}</strong>
                <span>${escapeHtml(room.description || "暂无说明")}</span>
              </div>
              <button type="button" data-copy-invite="${escapeHtml(room.invite_code)}">${escapeHtml(room.invite_code)}</button>
              <button type="button" data-open-room="${escapeHtml(room.id)}">进入房间</button>
              <em>${room.member_count || 0} 人</em>
            </article>
          `,
        )
        .join("")
    : '<div class="history-empty">还没有项目房间，先创建一个给朋友加入。</div>';
  const joinedRoomMarkup = myProjectRooms.length
    ? myProjectRooms
        .map(
          (room) => `
            <article class="project-room-item joined">
              <div>
                <strong>${escapeHtml(room.name)}</strong>
                <span>${escapeHtml(room.role || "Developer")} / ${escapeHtml(room.joined_at || "")}</span>
              </div>
              <button type="button" data-open-room="${escapeHtml(room.id)}">进入房间</button>
              <em>已加入</em>
            </article>
          `,
        )
        .join("")
    : '<div class="history-empty">你还没有加入项目房间。</div>';
  if (els.projectRoomList) {
    els.projectRoomList.innerHTML = createdRoomMarkup;
  }
  if (els.myProjectRoomList) {
    els.myProjectRoomList.innerHTML = joinedRoomMarkup;
  }
  if (els.oswMyProjectRoomList) {
    els.oswMyProjectRoomList.innerHTML = joinedRoomMarkup;
  }
  if (els.workspaceRoomSelect) {
    const activeValue = els.workspaceRoomSelect.value;
    const roomSource = myProjectRooms.length ? myProjectRooms : projectRooms;
    els.workspaceRoomSelect.innerHTML = [
      '<option value="">默认协作房间</option>',
      ...roomSource.map((room) => `<option value="${room.id}">${escapeHtml(room.name)}</option>`),
    ].join("");
    els.workspaceRoomSelect.value = activeValue;
  }
  bindInviteCopyButtons();
  bindOpenRoomButtons();
}

function renderProjectRoomResult() {
  if (!els.projectRoomResult) return;
  if (!lastCreatedProjectRoom) {
    els.projectRoomResult.hidden = true;
    els.projectRoomResult.innerHTML = "";
    return;
  }
  els.projectRoomResult.hidden = false;
  els.projectRoomResult.innerHTML = `
    <div>
      <strong>${escapeHtml(lastCreatedProjectRoom.name)}</strong>
      <span>邀请码已生成，可以直接发给朋友加入项目房间。</span>
    </div>
    <button type="button" data-copy-invite="${escapeHtml(lastCreatedProjectRoom.invite_code)}">${escapeHtml(lastCreatedProjectRoom.invite_code)}</button>
  `;
  bindInviteCopyButtons();
}

function bindInviteCopyButtons() {
  document.querySelectorAll("[data-copy-invite]").forEach((button) => {
    if (button.dataset.boundCopy === "1") return;
    button.dataset.boundCopy = "1";
    button.addEventListener("click", () => copyInviteCode(button));
  });
}

function bindOpenRoomButtons() {
  document.querySelectorAll("[data-open-room]").forEach((button) => {
    if (button.dataset.boundOpenRoom === "1") return;
    button.dataset.boundOpenRoom = "1";
    button.addEventListener("click", () => openProjectRoom(button.dataset.openRoom));
  });
}

async function openProjectRoom(roomId) {
  const room = [...myProjectRooms, ...projectRooms].find((item) => String(item.id) === String(roomId)) || lastCreatedProjectRoom;
  if (!room) return;
  activeProjectRoom = room;
  if (!activeProjectRoomMessages.length) {
    activeProjectRoomMessages = [
      { name: "Codex", role: "Pair Agent", kind: "chat", text: `已进入《${room.name}》，可以在这里交流想法、写文档并提交 Agent 任务。` },
    ];
  }
  renderProjectRoomPage();
  switchView("projectRoom");
  if (backendConnected || location.protocol !== "file:") {
    try {
      const detailResponse = await fetch(`/api/projects/rooms/${room.id}`);
      if (detailResponse.ok) {
        activeProjectRoom = await detailResponse.json();
        renderProjectRoomPage();
      }
      const messagesResponse = await fetch(`/api/projects/rooms/${room.id}/messages?limit=100`);
      if (messagesResponse.ok) {
        const messages = await messagesResponse.json();
        activeProjectRoomMessages = messages.map((item) => ({
          name: item.author || "Developer",
          role: item.kind || "chat",
          kind: item.kind || "chat",
          text: item.file_name ? `${item.text} (${item.file_name})` : item.text,
        }));
        if (!activeProjectRoomMessages.length) {
          activeProjectRoomMessages = [
            { name: "Codex", role: "Pair Agent", kind: "chat", text: `已进入《${activeProjectRoom.name}》，可以在这里交流想法、写文档并提交 Agent 任务。` },
          ];
        }
        renderRoomMessages();
      }
    } catch {
      renderProjectRoomPage();
    }
  }
}

function renderProjectRoomPage() {
  if (!activeProjectRoom) return;
  if (els.roomPageTitle) els.roomPageTitle.textContent = activeProjectRoom.name || "项目房间";
  if (els.roomPageDesc) els.roomPageDesc.textContent = activeProjectRoom.description || "小组交流、文档沉淀和多人协同合作空间。";
  if (els.roomInviteCopyBtn) {
    els.roomInviteCopyBtn.textContent = activeProjectRoom.invite_code || "邀请码";
    els.roomInviteCopyBtn.dataset.copyInvite = activeProjectRoom.invite_code || "";
  }
  if (els.roomFacts) {
    els.roomFacts.innerHTML = `
      <div><span>房间 ID</span><strong>${escapeHtml(activeProjectRoom.id || "-")}</strong></div>
      <div><span>邀请码</span><strong>${escapeHtml(activeProjectRoom.invite_code || "-")}</strong></div>
      <div><span>成员</span><strong>${activeProjectRoom.member_count || myProjectRooms.length || 1} 人</strong></div>
      <div><span>状态</span><strong>LAN beta</strong></div>
    `;
  }
  renderRoomMessages();
  renderRoomOnline();
  renderRoomDoc();
  renderWorkspace();
  bindInviteCopyButtons();
}

function renderRoomMessages() {
  if (!els.roomMessageList) return;
  els.roomMessageList.innerHTML = activeProjectRoomMessages.length
    ? activeProjectRoomMessages
        .map((item) => {
          const own = isOwnMessageName(item.name);
          return `
          <div class="room-message ${own ? "own" : "other"}">
            <strong>${escapeHtml(item.name)} <span>${escapeHtml(item.role || item.kind || "Developer")}</span></strong>
            <p>${escapeHtml(item.text)}</p>
          </div>`;
        })
        .join("")
    : '<div class="history-empty">还没有消息，先发一个想法。</div>';
  els.roomMessageList.scrollTop = els.roomMessageList.scrollHeight;
}

function appendProjectRoomRealtimeMessage(message) {
  if (!message) return;
  const exists = activeProjectRoomMessages.some((item) => String(item.id || "") === String(message.id || ""));
  if (exists) return;
  activeProjectRoomMessages.push({
    id: message.id,
    name: message.author || "Developer",
    role: message.kind || "chat",
    kind: message.kind || "chat",
    text: message.file_name ? `${message.text} (${message.file_name})` : message.text,
  });
  activeProjectRoomMessages.splice(0, Math.max(0, activeProjectRoomMessages.length - 160));
  renderRoomMessages();
}

function renderRoomOnline() {
  if (!els.roomOnlineList) return;
  const peers = publicWorldOnlinePeers.length ? publicWorldOnlinePeers : [{ name: currentUser?.display_name || collaboratorName, role: "Developer" }];
  els.roomOnlineList.innerHTML = peers
    .map((item) => `<div><i style="--avatar:#21d6e7">${escapeHtml(avatarInitial(item.name))}</i><span><strong>${escapeHtml(item.name)}</strong><em>${escapeHtml(item.role || "Developer")}</em></span></div>`)
    .join("");
}

function renderRoomDoc() {
  const key = activeProjectRoom?.id || "default";
  const doc = projectRoomDocs[key] || { title: `${activeProjectRoom?.name || "项目"} 文档`, content: "" };
  if (els.roomDocTitle) els.roomDocTitle.value = doc.title;
  if (els.roomDocContent) els.roomDocContent.value = doc.content;
  if (els.roomDocState) els.roomDocState.textContent = "本地草稿";
}

function saveRoomDoc() {
  if (!activeProjectRoom) return;
  const key = activeProjectRoom.id || "default";
  projectRoomDocs[key] = {
    title: els.roomDocTitle?.value.trim() || `${activeProjectRoom.name} 文档`,
    content: els.roomDocContent?.value || "",
    updatedAt: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
  };
  if (els.roomDocState) els.roomDocState.textContent = `已保存 ${projectRoomDocs[key].updatedAt}`;
}

async function submitRoomMessage(event) {
  event.preventDefault();
  if (!requireDeveloperLogin()) return;
  const text = els.roomMessageInput?.value.trim() || "";
  if (!text) return;
  const kind = els.roomMessageKind?.value || "chat";
  const fileName = els.roomFileInput?.files?.[0]?.name || "";
  activeProjectRoomMessages.push({
    name: currentUser?.display_name || collaboratorName,
    role: currentUser?.role || "Developer",
    kind,
    text,
  });
  if (fileName) {
    activeProjectRoomMessages.push({
      name: currentUser?.display_name || collaboratorName,
      role: "File",
      kind: "file",
      text: `上传文件记录：${fileName}`,
    });
    els.roomFileInput.value = "";
  }
  els.roomMessageInput.value = "";
  renderRoomMessages();
  if (activeProjectRoom?.id && (backendConnected || location.protocol !== "file:")) {
    await fetch(`/api/projects/rooms/${activeProjectRoom.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ kind, text, file_name: fileName }),
    }).catch(() => {});
  }
}

async function copyInviteCode(button) {
  const code = button.dataset.copyInvite || "";
  if (!code) return;
  try {
    await navigator.clipboard?.writeText(code);
    button.textContent = "已复制";
  } catch {
    button.textContent = code;
  }
  window.setTimeout(() => (button.textContent = code), 1000);
}

async function loadProjectRooms() {
  if (!els.projectRoomList && !els.myProjectRoomList && !els.workspaceRoomSelect) return;
  try {
    const response = await fetch("/api/projects/rooms");
    projectRooms = await response.json();
  } catch {
    projectRooms = [];
  }
  if (authToken) {
    try {
      const response = await fetch("/api/projects/my", { headers: authHeaders() });
      myProjectRooms = response.ok ? await response.json() : [];
    } catch {
      myProjectRooms = [];
    }
  }
  renderProjectRooms();
  if (currentUser && document.body.classList.contains("profile-mode")) {
    renderProfile();
  }
}

async function createProjectRoom(event) {
  event.preventDefault();
  if (!requireDeveloperLogin()) return;
  const name = els.projectRoomName?.value.trim() || "";
  if (!name) return;
  await createProjectRoomFromValues(name, els.projectRoomDesc?.value.trim() || "", {
    nameInput: els.projectRoomName,
    descInput: els.projectRoomDesc,
  });
}

async function createOpenSourceProjectRoom(event) {
  event.preventDefault();
  if (!requireDeveloperLogin()) return;
  const name = els.oswProjectRoomName?.value.trim() || "";
  if (!name) return;
  await createProjectRoomFromValues(name, els.oswProjectRoomDesc?.value.trim() || "", {
    nameInput: els.oswProjectRoomName,
    descInput: els.oswProjectRoomDesc,
  });
}

async function createProjectRoomFromValues(name, description, options = {}) {
  const response = await fetch("/api/projects/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      name,
      description,
    }),
  });
  if (response.ok) {
    lastCreatedProjectRoom = await response.json();
    activeProjectRoom = lastCreatedProjectRoom;
    navigator.clipboard?.writeText(lastCreatedProjectRoom.invite_code || "").catch(() => {});
    if (options.nameInput) options.nameInput.value = "";
    if (options.descInput) options.descInput.value = "";
    await loadProjectRooms();
    openProjectRoom(lastCreatedProjectRoom.id);
  }
}

async function joinProjectRoom(event) {
  event.preventDefault();
  if (!requireDeveloperLogin()) return;
  const inviteCode = els.projectInviteInput?.value.trim() || "";
  await joinProjectByInvite(inviteCode, {
    input: els.projectInviteInput,
    status: null,
    source: "开发者管理中心",
  });
}

async function joinOpenSourceProject(event) {
  event.preventDefault();
  if (!requireDeveloperLogin()) return;
  const inviteCode = els.oswInviteInput?.value.trim() || "";
  await joinProjectByInvite(inviteCode, {
    input: els.oswInviteInput,
    status: els.oswJoinResult,
    source: "开源世界",
  });
}

async function joinProjectByInvite(inviteCode, options = {}) {
  if (!inviteCode) return;
  const status = options.status;
  if (status) status.textContent = "正在验证邀请码...";
  try {
    const response = await fetch("/api/projects/join", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ invite_code: inviteCode }),
    });
    if (!response.ok) {
      if (status) status.textContent = "邀请码无效或后端暂时不可用。";
      addLog(`加入项目失败：${inviteCode}`, options.source || "Project");
      return;
    }
    const data = await response.json();
    workspaceMessages.push({
      name: "Codex",
      role: "Pair Agent",
      text: `你已加入项目房间《${data.room?.name || inviteCode}》，现在可以在项目房间交流、写文档并提交 Agent 任务。`,
    });
    if (options.input) options.input.value = "";
    if (status) status.textContent = `已加入《${data.room?.name || inviteCode}》，正在进入项目房间。`;
    await loadProjectRooms();
    renderWorkspace();
    openProjectRoom(data.room?.id);
  } catch {
    if (status) status.textContent = "网络不稳定，加入项目请求没有成功。";
    addLog("加入项目请求失败，请检查后端或远程 Relay。", options.source || "Project");
  }
}

function renderAdminOverviewCharts() {
  if (!els.adminOverviewCharts) return;
  const data = [
    ["运行任务", Math.max(tasks.length, backendQueueStats.running_total || 0), "#21d6e7"],
    ["接口数量", els.adminApiList?.children?.length || 5, "#7ee7ff"],
    ["成员数量", els.adminMemberList?.children?.length || 0, "#2fe098"],
    ["公开消息", publicChatMessages.length, "#ffc44d"],
  ];
  const max = Math.max(...data.map((item) => item[1]), 1);
  els.adminOverviewCharts.innerHTML = data
    .map(
      ([label, value, color]) => `
      <div class="admin-chart-card">
        <div><strong>${escapeHtml(label)}</strong><span>${value}</span></div>
        <i><b style="--bar:${color}; width:${Math.max(8, (value / max) * 100)}%"></b></i>
      </div>
    `,
    )
    .join("");
}

function startAdminChatPreview() {
  return;
}

function stopAdminChatPreview() {
  if (!adminChatTimer) return;
  window.clearInterval(adminChatTimer);
  adminChatTimer = null;
}

function switchView(view) {
  if (!currentUser && !isAuthRoute()) {
    enforceLoginGate();
    return;
  }
  closeAllToolWindows();
  closeBotChatWindow();
  closeAgentQuickPanel();
  const targetView = ["warRoom", "runtimeEnvironment", "community", "openSourceWorld", "developerAdmin", "profile", "projectRoom"].includes(view) ? view : "warRoom";
  currentView = targetView;
  const runtimeEnvironmentMode = targetView === "runtimeEnvironment";
  const platformMode = targetView === "community";
  const openSourceMode = targetView === "openSourceWorld";
  const adminMode = targetView === "developerAdmin";
  const profileMode = targetView === "profile";
  const projectRoomMode = targetView === "projectRoom";
  document.body.classList.toggle("runtime-environment-mode", runtimeEnvironmentMode);
  document.body.classList.toggle("platform-mode", platformMode);
  document.body.classList.toggle("open-source-mode", openSourceMode);
  document.body.classList.toggle("admin-mode", adminMode);
  document.body.classList.toggle("profile-mode", profileMode);
  document.body.classList.toggle("project-room-mode", projectRoomMode);
  document.querySelectorAll(".tab-button").forEach((item) => item.classList.toggle("active", item.dataset.view === targetView));
  els.warRoomView.classList.toggle("active", targetView === "warRoom");
  els.runtimeEnvironmentView?.classList.toggle("active", runtimeEnvironmentMode);
  els.communityView.classList.toggle("active", platformMode);
  els.openSourceWorldView?.classList.toggle("active", openSourceMode);
  els.profileView?.classList.toggle("active", profileMode);
  els.developerAdminView?.classList.toggle("active", adminMode);
  els.projectRoomView?.classList.toggle("active", projectRoomMode);
  els.warRoomView.hidden = targetView !== "warRoom";
  if (els.runtimeEnvironmentView) els.runtimeEnvironmentView.hidden = !runtimeEnvironmentMode;
  els.communityView.hidden = !platformMode;
  if (els.openSourceWorldView) els.openSourceWorldView.hidden = !openSourceMode;
  if (els.profileView) els.profileView.hidden = !profileMode;
  if (els.developerAdminView) els.developerAdminView.hidden = !adminMode;
  if (els.projectRoomView) els.projectRoomView.hidden = !projectRoomMode;
  els.pageTitle.textContent = adminMode
    ? "开发者管理中心"
    : openSourceMode
      ? "开源世界"
      : platformMode
        ? "源文明"
        : runtimeEnvironmentMode
          ? "运行环境"
          : "QuantumFlow 调度中枢";
  if (profileMode) els.pageTitle.textContent = "用户信息中心";
  if (projectRoomMode) els.pageTitle.textContent = "项目房间";
  syncLoginSystemName();
  if (els.taskInput) {
    els.taskInput.placeholder = runtimeEnvironmentMode ? "添加运行环境测试 / 页面报错" : "添加开发任务 / 外部消息";
  }
  if (els.taskForm) {
    const submitButton = els.taskForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.textContent = runtimeEnvironmentMode ? "记录" : "添加";
  }
  if (runtimeEnvironmentMode && els.runtimeQueueMetric) {
    els.runtimeQueueMetric.textContent = `${backendQueueStats.pending || 0}/${backendQueueStats.active || 0}`;
    renderRuntimeEnvironment();
  }
  if (platformMode) {
    if (location.protocol !== "file:") history.replaceState(null, "", "/platform");
    stopAdminChatPreview();
    switchOpenWorldPanel("repositoriesPanel");
    renderCommunity();
    loadPatchHistory();
    loadIssues();
    loadTaskLogs();
    loadCodeArtifacts();
    loadOutbox();
    loadConnectorConfig();
    loadBotMessages();
  } else if (openSourceMode) {
    if (location.protocol !== "file:") history.replaceState(null, "", "/open-source");
    stopAdminChatPreview();
    switchOpenSourcePanel("oswDashboardPanel");
    renderPublicChat();
    loadRealtimeChatHistory();
    loadRealtimeServiceStatus();
  } else if (adminMode) {
    switchAdminPanel(adminPanelFromPath());
    loadRealtimeChatHistory();
    loadRealtimeServiceStatus();
  } else if (profileMode) {
    if (location.protocol !== "file:") history.replaceState(null, "", "/profile");
    stopAdminChatPreview();
    loadProjectRooms();
    renderProfile();
    switchProfileTab("overview");
  } else if (projectRoomMode) {
    if (location.protocol !== "file:") history.replaceState(null, "", "/project-room");
    stopAdminChatPreview();
    renderProjectRoomPage();
  } else if (runtimeEnvironmentMode) {
    if (location.protocol !== "file:") history.replaceState(null, "", "/runtime-environment");
    stopAdminChatPreview();
  } else {
    if (location.protocol !== "file:" && !isAuthRoute()) history.replaceState(null, "", "/war-room");
    stopAdminChatPreview();
  }
}

async function loadPatchHistory() {
  if (!backendConnected) {
    const empty = '<div class="history-empty">暂无真实采纳记录</div>';
    if (els.patchHistoryList) els.patchHistoryList.innerHTML = empty;
    if (els.patchHistoryInlineList) els.patchHistoryInlineList.innerHTML = empty;
    return;
  }
  try {
    const response = await fetch("/api/adoptions?limit=5");
    const history = await response.json();
    const markup = history.length
      ? history
          .map(
            (item) => `
            <div class="patch-history-item">
              <strong>${item.target_key || item.task_id}</strong>
              <span>${item.adopted_at} / ${item.reviewer_id} / ${item.vote_count} votes</span>
            </div>
          `,
          )
          .join("")
      : '<div class="history-empty">暂无真实采纳记录</div>';
    if (els.patchHistoryList) els.patchHistoryList.innerHTML = markup;
    if (els.patchHistoryInlineList) els.patchHistoryInlineList.innerHTML = markup;
  } catch {
    const failed = '<div class="history-empty">采纳记录读取失败</div>';
    if (els.patchHistoryList) els.patchHistoryList.innerHTML = failed;
    if (els.patchHistoryInlineList) els.patchHistoryInlineList.innerHTML = failed;
  }
}

async function loadIssues() {
  if (!backendConnected) return;
  try {
    const response = await fetch("/api/issues?limit=12");
    externalIssues = await response.json();
    renderCommunity();
  } catch {
    externalIssues = [];
  }
}

async function executeIssue(issueId, button = null) {
  if (!issueId) return;
  const originalText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "执行中";
  }
  try {
    const response = await fetch(`/api/issues/${issueId}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ rerun: true }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : JSON.stringify(result.detail || result));
    addLog(`Issue #${issueId} 已重新进入任务队列：${result.task?.id || "new task"}`, "Master");
    await loadIssues();
    switchView("warRoom");
  } catch (error) {
    addLog(`Issue #${issueId} 执行失败：${error.message}`, "System");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText || "再次执行";
    }
  }
}

async function rejectIssue(issueId) {
  if (!backendConnected || !issueId) return;
  try {
    const response = await fetch(`/api/issues/${issueId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Human rejected from Issues panel." }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "reject issue failed");
    addLog(`Issue #${issueId} 已驳回。`, "Master");
    await loadIssues();
  } catch (error) {
    addLog(`Issue #${issueId} 驳回失败：${error.message}`, "System");
  }
}

async function loadTaskLogs() {
  if (!els.taskLogInlineList) return;
  if (!backendConnected) {
    els.taskLogInlineList.innerHTML = '<div class="history-empty">后端未连接，暂无执行日志</div>';
    return;
  }
  try {
    const response = await fetch("/api/task-logs?limit=40");
    const logs = await response.json();
    els.taskLogInlineList.innerHTML = logs.length
      ? logs
          .map((item) => {
            const agent = agentById(item.agent_id);
            const actor = agent?.name || item.role || item.agent_id || "System";
            const status = item.status || "ok";
            return `
              <details class="task-log-item ${status}">
                <summary>
                  <div class="task-log-top">
                    <strong>${escapeHtml(item.action || "action")}</strong>
                    <span>${escapeHtml(item.created_at || "")}</span>
                  </div>
                  <div class="task-log-meta">
                    <span>${escapeHtml(actor)}</span>
                    <span>${escapeHtml(item.task_id || "system")}</span>
                    <span>${escapeHtml(status)}</span>
                  </div>
                </summary>
                <div class="task-log-detail">
                  <section><b>输入</b><p>${escapeHtml(item.input_text || "无输入摘要")}</p></section>
                  <section><b>输出</b><small>${escapeHtml(item.output_text || "无输出摘要")}</small></section>
                  <section class="task-log-json"><b>复盘</b><code>${escapeHtml(JSON.stringify({ action: item.action, agent_id: item.agent_id, role: item.role, task_id: item.task_id, status }, null, 2))}</code></section>
                </div>
              </details>
            `;
          })
          .join("")
      : '<div class="history-empty">暂无执行日志</div>';
  } catch {
    els.taskLogInlineList.innerHTML = '<div class="history-empty">执行日志读取失败</div>';
  }
}

async function loadCodeArtifacts() {
  if (!backendConnected) return;
  try {
    const response = await fetch("/api/code-artifacts?limit=30");
    const artifacts = await response.json();
    artifacts
      .slice()
      .reverse()
      .forEach((artifact) => {
        if (codeArtifactKeys.has(artifact.id)) return;
        const targetKey = String(artifact.target_key || "");
        const codeText = String(artifact.code_text || "");
        if (isLegacyStubArtifact(codeText, targetKey)) {
          codeArtifactKeys.add(artifact.id);
          return;
        }
        const slashIndex = targetKey.indexOf("/");
        if (slashIndex <= 0) return;
        const repoId = targetKey.slice(0, slashIndex);
        const fileName = targetKey.slice(slashIndex + 1);
        const repo = openWorldRepos.find((item) => item.id === repoId);
        if (!repo || !repo.files[fileName]) return;
        const key = codeKey(repoId, fileName);
        const artifactLines = codeText.split("\n");
        codeArtifactMeta[key] = artifact;
        codeArtifactKeys.add(artifact.id);
        if (artifact.status === "manual_edit") {
          generatedCodeOverrides[key] = artifactLines;
        } else {
          streamCodeLines({
            repoId,
            fileName,
            lines: artifactLines,
            agentName: agentById(artifact.agent_id)?.name || artifact.agent_id || "Agent",
            taskTitle: artifact.task_id || "后端代码产物",
            taskId: artifact.id || artifact.task_id || "",
            replace: true,
          });
        }
      });
    renderCommunity();
  } catch {
    // Code artifacts are supplemental; keep the current view responsive.
  }
}

async function loadOutbox() {
  if (!backendConnected) {
    const empty = '<div class="history-empty">暂无通知队列</div>';
    if (els.outboxList) els.outboxList.innerHTML = empty;
    if (els.outboxInlineList) els.outboxInlineList.innerHTML = empty;
    return;
  }
  try {
    const response = await fetch("/api/outbox?limit=5");
    const items = await response.json();
    const markup = items.length
      ? items
          .map(
            (item) => `
            <div class="patch-history-item">
              <strong>${item.connector} 路 ${item.event_type}</strong>
              <span>${item.status} 路 ${deliveryProof(item)}</span>
            </div>
          `,
          )
          .join("")
      : '<div class="history-empty">暂无通知队列</div>';
    if (els.outboxList) els.outboxList.innerHTML = markup;
    if (els.outboxInlineList) els.outboxInlineList.innerHTML = markup;
  } catch {
    const failed = '<div class="history-empty">通知队列读取失败</div>';
    if (els.outboxList) els.outboxList.innerHTML = failed;
    if (els.outboxInlineList) els.outboxInlineList.innerHTML = failed;
  }
}

async function loadBotMessages() {
  if (!backendConnected) return;
  try {
    const response = await fetch("/api/bot/messages?limit=8");
    const messages = await response.json();
    const markup = messages
      .slice()
      .reverse()
          .map(
            (item) => `
        <div class="bot-chat-item ${item.direction}">
          <strong>${item.direction === "inbound" ? "你 / 飞书" : "QuantumFlow Bot"}</strong>
          <span>${escapeHtml(item.text)}</span>
        </div>
      `,
      )
      .join("");
    if (els.botChatList) els.botChatList.innerHTML = markup;
    if (els.botInlineList) els.botInlineList.innerHTML = markup;
    scrollBotChatToBottom();
  } catch {
    const failed = '<div class="history-empty">Bot 会话读取失败</div>';
    if (els.botChatList) els.botChatList.innerHTML = failed;
    if (els.botInlineList) els.botInlineList.innerHTML = failed;
  }
}

function openBotChatWindow() {
  els.feishuChatWindow?.classList.add("active");
  els.feishuChatWindow?.setAttribute("aria-hidden", "false");
  loadBotMessages();
  window.setTimeout(() => els.botChatInput?.focus(), 80);
}

function closeBotChatWindow() {
  els.feishuChatWindow?.classList.remove("active");
  els.feishuChatWindow?.setAttribute("aria-hidden", "true");
}

function openToolWindow(id) {
  const panelMap = {
    governanceWindow: "governancePanel",
    recordsWindow: "recordsPanel",
    notificationWindow: "notificationsPanel",
    repositoriesWindow: "repositoriesPanel",
    issuesWindow: "issuesPanel",
    connectorsWindow: "connectorsPanel",
  };
  if (panelMap[id]) {
    closeAllToolWindows();
    switchOpenWorldPanel(panelMap[id]);
    return;
  }
  const target = document.getElementById(id);
  if (!target) return;
  target.classList.add("active");
  target.setAttribute("aria-hidden", "false");
  if (id === "governanceWindow") renderCaptainVotes();
  if (id === "recordsWindow") loadPatchHistory();
  if (id === "notificationWindow") {
    loadConnectorConfig();
    loadOutbox();
  }
}

function closeAllToolWindows() {
  document.querySelectorAll(".floating-tool-window.active").forEach((item) => {
    item.classList.remove("active");
    item.setAttribute("aria-hidden", "true");
  });
}

function closeToolWindow(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.classList.remove("active");
  target.setAttribute("aria-hidden", "true");
}

function deliveryProof(item) {
  const result = item.result || {};
  if (item.status === "dry_run") return "模拟发送，未触达飞书";
  if (item.status === "sent") {
    const code = result.json?.code;
    const msg = result.json?.msg || result.json?.message || result.proof || "飞书服务器已接收";
    return `HTTP ${result.status || 200} 路 code ${code ?? "ok"} 路 ${msg}`;
  }
  if (item.status === "failed") return result.reason || result.response || "发送失败";
  return item.created_at;
}

async function loadConnectorConfig() {
  if (!els.connectorConfigState || !backendConnected) return;
  try {
    const response = await fetch("/api/connectors/config");
    const config = await response.json();
    els.connectorConfigState.textContent = config.feishu_configured ? "飞书已配置" : "未配置";
    els.connectorConfigState.classList.toggle("configured", Boolean(config.feishu_configured));
    if (config.feishu_configured && els.feishuWebhookInput) {
      els.feishuWebhookInput.placeholder = "已保存飞书 Webhook，可直接发送测试";
    }
  } catch {
    els.connectorConfigState.textContent = "配置读取失败";
  }
}

async function saveConnectorConfig(event) {
  event.preventDefault();
  if (!backendConnected) {
    addLog("后端未连接，无法保存飞书配置。", "System");
    return;
  }
  const webhook = els.feishuWebhookInput?.value.trim() || "";
  if (!webhook.startsWith("https://")) {
    els.connectorConfigState.textContent = "请粘贴 https Webhook";
    addLog("飞书 Webhook 格式不正确。", "System");
    return;
  }
  const response = await fetch("/api/connectors/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feishu_webhook_url: webhook }),
  });
  if (!response.ok) {
    els.connectorConfigState.textContent = "保存失败";
    addLog("飞书 Webhook 保存失败。", "System");
    return;
  }
  els.feishuWebhookInput.value = "";
  els.feishuWebhookInput.placeholder = "已保存飞书 Webhook，可直接发送测试";
  els.connectorConfigState.textContent = "飞书已配置";
  els.connectorConfigState.classList.add("configured");
  addLog("飞书 Webhook 已保存。", "System");
}

async function flushOutboxQueue() {
  if (!backendConnected) {
    addLog("后端未连接，无法发送通知队列。", "System");
    return;
  }
  els.flushOutboxBtn.disabled = true;
  els.flushOutboxBtn.textContent = "发送中";
  try {
    const response = await fetch("/api/connectors/flush-outbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 20 }),
    });
    const data = await response.json();
    const sent = (data.results || []).filter((item) => item.status === "sent").length;
    const dryRun = (data.results || []).filter((item) => item.status === "dry_run").length;
    const failed = (data.results || []).filter((item) => item.status === "failed").length;
    addLog(`通知队列已处理：sent ${sent} / dry-run ${dryRun} / failed ${failed}`, "System");
    if ((data.processed || 0) === 0) addLog("通知队列为空。可以先点“发送测试”验证飞书。", "System");
    if (sent > 0) addLog("飞书服务器已返回接收成功。", "System");
    if (dryRun > 0) addLog("当前是 dry-run，没有真正发到飞书。", "System");
    if (failed > 0) addLog("有通知发送失败，请查看通知队列的失败原因。", "System");
    loadOutbox();
  } catch {
    addLog("通知队列发送失败。", "System");
  } finally {
    els.flushOutboxBtn.disabled = false;
    els.flushOutboxBtn.textContent = "发送队列";
  }
}

async function sendFeishuTest() {
  if (!backendConnected) {
    addLog("后端未连接，无法发送飞书测试。", "System");
    return;
  }
  els.testFeishuBtn.disabled = true;
  els.testFeishuBtn.textContent = "测试中";
  try {
    const response = await fetch("/api/connectors/test-feishu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "QuantumFlow 飞书连接测试：如果你看到这条消息，说明机器人已收到。" }),
    });
    const result = await response.json();
    if (result.status === "sent") {
      addLog("飞书测试消息已发送，飞书服务器已接收。", "System");
    } else if (result.status === "dry_run") {
      addLog("飞书测试仍是 dry-run：请先保存真实 Webhook。", "System");
    } else {
      addLog(`飞书测试失败：${result.result?.reason || result.result?.response || "未知错误"}`, "System");
    }
    loadOutbox();
  } catch {
    addLog("飞书测试发送失败。", "System");
  } finally {
    els.testFeishuBtn.disabled = false;
    els.testFeishuBtn.textContent = "发送测试";
  }
}

async function sendManualFeishu(event) {
  event.preventDefault();
  if (!backendConnected) {
    addLog("后端未连接，无法手动发送飞书消息。", "System");
    return;
  }
  const text = els.manualFeishuInput?.value.trim() || "";
  if (!text) {
    addLog("请输入要发送到飞书的内容。", "System");
    return;
  }
  const button = els.manualFeishuForm.querySelector("button");
  button.disabled = true;
  button.textContent = "发送中";
  try {
    const response = await fetch("/api/connectors/send-feishu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const result = await response.json();
    if (result.status === "sent") {
      addLog("手动飞书消息已发送，飞书服务器已接收。", "System");
      els.manualFeishuInput.value = "";
    } else if (result.status === "dry_run") {
      addLog("手动飞书消息是 dry-run：请先保存真实 Webhook。", "System");
    } else {
      addLog(`手动飞书消息失败：${result.result?.reason || result.result?.response || "未知错误"}`, "System");
    }
    loadOutbox();
  } catch {
    addLog("手动飞书消息发送失败。", "System");
  } finally {
    button.disabled = false;
    button.textContent = "发送";
  }
}

async function sendBotChat(event) {
  event.preventDefault();
  if (!backendConnected) {
    addLog("后端未连接，无法进行 Bot 对话。", "System");
    return;
  }
  const form = event.currentTarget || els.botChatForm;
  const input = form === els.botInlineForm ? els.botInlineInput : els.botChatInput;
  const text = input?.value.trim() || "";
  if (!text) return;
  const button = form.querySelector("button");
  button.disabled = true;
  button.textContent = "处理中";
  appendBotChatItem("inbound", "你 / 飞书", text);
  input.value = "";
  try {
    const response = await fetch("/api/bot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, conversation_id: "desktop-chat", sender_id: "desktop-user" }),
    });
    const result = await response.json();
    if (response.ok) {
      addLog(`Bot 命令已处理：/${result.command}`, "System");
      const replyText = result.reply?.payload?.text || result.reply?.result?.response || "已处理。";
      const proof = result.reply?.status ? `\n\n[${result.reply.status}] ${deliveryProof(result.reply)}` : "";
      appendBotChatItem("outbound", "QuantumFlow Bot", `${replyText}${proof}`);
      await loadBotMessages();
      loadIssues();
      loadCodeArtifacts();
      loadOutbox();
      renderCommunity();
    } else {
      addLog(`Bot 对话失败：${result.detail || "未知错误"}`, "System");
      appendBotChatItem("outbound", "QuantumFlow Bot", `发送失败：${result.detail || "未知错误"}`);
    }
  } catch {
    addLog("Bot 对话请求失败。", "System");
    appendBotChatItem("outbound", "QuantumFlow Bot", "请求失败：后端暂时没有响应。");
  } finally {
    button.disabled = false;
    button.textContent = "发送";
  }
}

function appendBotChatItem(direction, name, text) {
  const node = document.createElement("div");
  node.className = `bot-chat-item ${direction}`;
  const title = document.createElement("strong");
  title.textContent = name;
  const body = document.createElement("span");
  body.textContent = text;
  node.append(title, body);
  if (els.botChatList) els.botChatList.appendChild(node.cloneNode(true));
  if (els.botInlineList) els.botInlineList.appendChild(node);
  scrollBotChatToBottom();
}

function scrollBotChatToBottom() {
  if (els.botChatList) els.botChatList.scrollTop = els.botChatList.scrollHeight;
  if (els.botInlineList) els.botInlineList.scrollTop = els.botInlineList.scrollHeight;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setupDesktopChrome() {
  const isDesktop = Boolean(window.quantumflowDesktop) || new URLSearchParams(location.search).get("desktop") === "1";
  if (!isDesktop) return;
  document.body.classList.add("desktop-app");
  document.getElementById("desktopMinimizeBtn")?.addEventListener("click", () => window.quantumflowDesktop?.minimize());
  document.getElementById("desktopMaximizeBtn")?.addEventListener("click", () => window.quantumflowDesktop?.toggleMaximize());
  document.getElementById("desktopCloseBtn")?.addEventListener("click", () => window.quantumflowDesktop?.close());
  setupDesktopZoomControl();
  setupRoomAutoFit();
}

async function setupDesktopZoomControl() {
  const valueNode = document.getElementById("desktopZoomValue");
  const zoomOut = document.getElementById("desktopZoomOutBtn");
  const zoomIn = document.getElementById("desktopZoomInBtn");
  if (!valueNode || !window.quantumflowDesktop?.getZoom || !window.quantumflowDesktop?.setZoom) return;
  const zoomStorageKey = "qfDesktopZoomFactor";

  const render = (factor) => {
    valueNode.textContent = `${Math.round(Number(factor || 1) * 100)}%`;
  };
  let currentZoom = await window.quantumflowDesktop.getZoom();
  const savedZoom = Number(localStorage.getItem(zoomStorageKey) || "");
  if (Number.isFinite(savedZoom) && savedZoom >= 0.6 && savedZoom <= 1.4) {
    currentZoom = await window.quantumflowDesktop.setZoom(savedZoom);
  }
  render(currentZoom);
  window.quantumflowDesktop.onZoomChanged?.((factor) => {
    currentZoom = factor;
    localStorage.setItem(zoomStorageKey, String(currentZoom));
    render(currentZoom);
  });

  const setZoom = async (delta) => {
    currentZoom = await window.quantumflowDesktop.setZoom(Number(currentZoom || 1) + delta);
    localStorage.setItem(zoomStorageKey, String(currentZoom));
    render(currentZoom);
    addLog(`桌面缩放已固定为 ${Math.round(currentZoom * 100)}%。`, "System");
  };

  zoomOut?.addEventListener("click", () => setZoom(-0.05));
  zoomIn?.addEventListener("click", () => setZoom(0.05));
}

function setupRoomAutoFit() {
  const room = document.getElementById("room");
  const stage = document.querySelector(".room-stage");
  if (!room || !stage) return;

  const fitRoom = () => {
    const rect = room.getBoundingClientRect();
    const widthScale = Math.max(0.45, (rect.width - 24) / 1680);
    const scale = Math.min(1.08, Math.max(0.62, widthScale));
    stage.style.setProperty("--room-scene-scale", scale.toFixed(3));
    room.style.setProperty("--room-scene-scale", scale.toFixed(3));
  };

  fitRoom();
  window.addEventListener("resize", fitRoom);
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(fitRoom);
    observer.observe(room);
  }
}

window.setInterval(() => {
  els.clock.textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
}, 1000);

let appVersion = null;
let appVersionNoticeShown = false;

async function watchAppVersion() {
  if (location.protocol === "file:") return;
  try {
    const response = await fetch(`/api/app-version?t=${Date.now()}`);
    const data = await response.json();
    if (!appVersion) {
      appVersion = data.version;
      return;
    }
    if (data.version && data.version !== appVersion) {
      appVersion = data.version;
      if (!appVersionNoticeShown) {
        appVersionNoticeShown = true;
        addLog("检测到代码更新，已停止自动刷新，避免页面闪退。需要时手动刷新即可。", "System");
      }
    }
  } catch {
    // Backend may be reloading. Keep the current page alive and retry.
  }
}

setupDesktopChrome();
renderAll();
loadWorkspaceInternalRepos();
ensureCodexAdminPresence();
renderAdminChat();
renderOnlineCollaborators();
window.quantumflowStreamCodeLines = streamCodeLines;
globalThis.quantumflowStreamCodeLines = streamCodeLines;
addLog("QuantumFlow 桌面调度中枢 MVP 已启动。", "System");
const initialDesktopView = new URLSearchParams(location.search).has("desktop") && location.pathname.includes("platform") ? "warRoom" : "";
switchView(
  initialDesktopView ||
  (location.pathname.includes("admin")
    ? "developerAdmin"
    : location.pathname.includes("open-source")
      ? "openSourceWorld"
      : location.pathname.includes("platform")
        ? "community"
        : location.pathname.includes("runtime-environment")
          ? "runtimeEnvironment"
          : location.pathname.includes("profile")
            ? "profile"
            : "warRoom"),
);
if (location.pathname.includes("register")) showAuthView("register", false);
else if (location.pathname.includes("forgot-password")) showAuthView("forgot", false);
else if (location.pathname.includes("login")) showAuthView("login", false);
connectBackend();
watchAppVersion();
window.setInterval(watchAppVersion, 2500);

