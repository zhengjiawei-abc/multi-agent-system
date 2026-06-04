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
];

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
const generatedCodeOverrides = {};
const streamingCodeTimers = new Map();
let streamingCodeKey = "";
let streamingCodeLineIndex = -1;
let activePatchCandidate = null;
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
let codeArtifactKeys = new Set();
const codeArtifactMeta = {};

let currentTaskIndex = -1;
let paused = false;
let autoTimer = null;
let selectedAgentId = "master";
let socket = null;
let backendConnected = false;
let backendAutoTimer = null;
let arbitrationTimer = null;
let backendQueueStats = { pending: 0, active: 0, blocked: 0, running_total: 0, completed_total: 0 };
let projectDeliveries = [];
let activeRuntimeDeliveryId = localStorage.getItem("qfActiveRuntimeDeliveryId") || "";
const deliveryTestStates = {};
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
  repoWindowList: document.getElementById("repoWindowList"),
  repoInlineList: document.getElementById("repoInlineList"),
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
  profileDisplayName: document.getElementById("profileDisplayName"),
  profileSaveState: document.getElementById("profileSaveState"),
  profileAvatar: document.getElementById("profileAvatar"),
  profileName: document.getElementById("profileName"),
  profileMeta: document.getElementById("profileMeta"),
  profileFacts: document.getElementById("profileFacts"),
  profileSideMetrics: document.getElementById("profileSideMetrics"),
  profileOverviewGrid: document.getElementById("profileOverviewGrid"),
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
    switchView("warRoom");
  }
}

function enterDefaultAfterAuth() {
  if (location.protocol !== "file:") history.replaceState(null, "", "/war-room");
  hideAuthShell();
  switchView("warRoom");
}

function isAuthRoute(pathname = location.pathname) {
  return pathname.includes("login") || pathname.includes("register") || pathname.includes("forgot-password");
}

function enforceLoginGate() {
  if (currentUser) return false;
  showAuthView(location.pathname.includes("register") ? "register" : location.pathname.includes("forgot-password") ? "forgot" : "login", false);
  return true;
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

function renderProfile() {
  if (!currentUser) {
    setAuthStatus("请先登录后查看用户页。", "warn");
    showAuthView("login", false);
    return;
  }
  const name = currentUser.display_name || currentUser.username || "Developer";
  const syncedRole = currentUser.role || onlineRoleForName(name) || "Developer";
  const syncedStatus = isNameOnline(name) ? "online" : currentUser.status || "active";
  if (els.profileAvatar) els.profileAvatar.textContent = name.slice(0, 2).toUpperCase();
  if (els.profileName) els.profileName.textContent = name;
  if (els.profileMeta) els.profileMeta.textContent = `${syncedRole} / ${syncedStatus}`;
  if (els.profileDisplayName) els.profileDisplayName.value = currentUser.display_name || "";
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
    `;
  }
  if (els.profileFacts) {
    els.profileFacts.innerHTML = `
      <div><span>用户 ID</span><strong>${escapeHtml(currentUser.id || "-")}</strong></div>
      <div><span>用户名</span><strong>${escapeHtml(currentUser.username || "-")}</strong></div>
      <div><span>显示名称</span><strong>${escapeHtml(currentUser.display_name || "-")}</strong></div>
      <div><span>邮箱</span><strong>${escapeHtml(currentUser.email || "未绑定")}</strong></div>
      <div><span>手机</span><strong>${escapeHtml(currentUser.phone || "未绑定")}</strong></div>
      <div><span>账号角色</span><strong>${escapeHtml(syncedRole)}</strong></div>
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

function switchProfileTab(tab = "overview") {
  const next = ["overview", "repositories", "projects", "activity"].includes(tab) ? tab : "overview";
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
  const displayName = els.profileDisplayName?.value.trim() || currentUser.username || "Developer";
  const previousUser = { ...currentUser };
  currentUser = { ...currentUser, display_name: displayName };
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
      body: JSON.stringify({ display_name: displayName }),
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
    currentUser = { ...previousUser, display_name: displayName };
    storeAuthSession(authToken, currentUser);
    renderProfile();
    updateAuthChrome();
    setAuthStatus(error.message || "同步失败，本地资料已更新。", "warn");
    if (els.profileSaveState) {
      els.profileSaveState.textContent = "后端同步失败，本地已更新";
      els.profileSaveState.dataset.tone = "warn";
    }
  }
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
      ${agent.crown ? '<div class="crown"></div>' : ""}
      <div class="hair"></div>
      <div class="head"></div>
      <div class="eye-left"></div>
      <div class="eye-right"></div>
      <div class="body" style="background:${agent.color}"></div>
      <div class="arm-left"></div>
      <div class="arm-right"></div>
      <div class="leg-left"></div>
      <div class="leg-right"></div>
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
  const task = tasks.find((item) => item.owner === agent.id && ["active", "blocked", "pending"].includes(item.status));
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

function closeAgentQuickPanel() {
  els.agentQuickPanel?.classList.remove("active");
  els.agentQuickPanel?.setAttribute("aria-hidden", "true");
}

function openSelectedAgentEditor() {
  const agent = agentById(selectedAgentId);
  closeAgentQuickPanel();
  jumpAgentToCodeArea(agent);
}

function jumpAgentToCodeArea(agent) {
  if (!agent) return;
  const map = {
    master: ["runtime", "Agent.py"],
    frontend: ["desktop", "app.js"],
    backend: ["runtime", "server.py"],
    reviewer: ["runtime", "Agent.py"],
    tester: ["connectors", "feishu.md"],
  };
  const target = map[agent.id] || ["runtime", "server.py"];
  activeRepoId = target[0];
  activeFileName = target[1];
  switchView("community");
  switchOpenWorldPanel?.("codePanel");
  renderCommunity();
  window.setTimeout(() => {
    document.querySelector("#codePanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);
  pushComment(agent.name, `我正在查看 ${activeFileName}，会根据这里的建议决定是否采纳并整合。`);
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
      ${renderProjectDeliveryCards()}
    `;
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
      </div>
    `,
    )
    .join("") + renderProjectDeliveryCards();
  document.querySelectorAll(".task-item").forEach((node) => {
    node.addEventListener("click", () => runTask(Number(node.dataset.task)));
  });
  document.querySelectorAll("[data-test-delivery]").forEach((button) => {
    button.addEventListener("click", () => openDeliveryRuntimeEnvironment(button.dataset.testDelivery));
  });
  document.querySelectorAll("[data-open-delivery]").forEach((button) => {
    button.addEventListener("click", () => openProjectDeliveryRuntime(button.dataset.openDelivery));
  });
  renderRuntimeEnvironment();
  renderCommunity();
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
            const testText = "运行环境";
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
}

async function testProjectDelivery(deliveryId) {
  if (!deliveryId) return;
  setActiveRuntimeDelivery(deliveryId);
  deliveryTestStates[deliveryId] = "testing";
  deliveryTestStates[`${deliveryId}:output`] = "正在启动测试环境并执行烟测...";
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
    addLog(data.ok ? "项目运行环境测试通过。" : "项目运行环境测试失败。", "Tester");
  } catch (error) {
    deliveryTestStates[deliveryId] = "failed";
    deliveryTestStates[`${deliveryId}:output`] = error.message || "测试失败";
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

async function openProjectDeliveryRuntime(deliveryId) {
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
    if (runtimeUrl) {
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

  const onlineRows = realOnlineCollaboratorRows();
  els.onlineCount.textContent = String(onlineRows.length);
  els.onlineMiniCount.textContent = String(onlineRows.length);
  els.worldTaskCount.textContent = String(tasks.filter((task) => task.status !== "done").length);

  els.repoList.innerHTML = openWorldRepos
    .map(
      (repo) => `
      <button class="repo-list-item ${repo.id === activeRepoId ? "active" : ""}" data-repo="${repo.id}">
        <strong>${repo.name}</strong>
        <span>${repo.desc}</span>
        <em>${repo.lang} / ${repo.stars} stars</em>
      </button>
    `,
    )
    .join("");

  if (els.repoWindowList) {
    els.repoWindowList.innerHTML = openWorldRepos
      .map(
        (repo) => `
        <button class="repo-list-item ${repo.id === activeRepoId ? "active" : ""}" data-repo="${repo.id}">
          <strong>${repo.name}</strong>
          <span>${repo.desc}</span>
          <em>${repo.lang} / ${repo.stars} stars</em>
        </button>
      `,
      )
      .join("");
  }
  if (els.repoInlineList) {
    els.repoInlineList.innerHTML = openWorldRepos
      .map(
        (repo) => `
        <button class="repo-list-item ${repo.id === activeRepoId ? "active" : ""}" data-repo="${repo.id}">
          <strong>${repo.name}</strong>
          <span>${repo.desc}</span>
          <em>${repo.lang} / ${repo.stars} stars</em>
        </button>
      `,
      )
      .join("");
  }

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
  if (els.manualCodeEditor && !els.manualCodeEditor.classList.contains("active")) {
    els.manualCodeEditor.value = codeLines.join("\n");
  }

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
      switchOpenWorldPanel("codePanel");
      renderCommunity();
    });
  });

  document.querySelectorAll(".file-item").forEach((button) => {
    button.addEventListener("click", () => {
      activeFileName = button.dataset.file;
      renderCommunity();
    });
  });
  bindIssueActions();
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
  const agentName = agentById(owner)?.name || "Master 自动分配";
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
  return lines
    .map((line, index) => {
      const lineNumber = String(index + 1).padStart(2, "0");
      const streaming = streamingCodeKey === activeKey && streamingCodeLineIndex === index;
      return `<div class="code-line ${streaming ? "streaming" : ""}"><span class="code-line-number">${lineNumber}</span><span class="code-line-source">${highlightCode(line, language)}</span></div>`;
    })
    .join("");
}

function highlightCode(line, language) {
  let code = escapeHtml(line);
  const comments = [];
  code = code.replace(/(\/\/.*|#.*)$/g, (match) => {
    const token = `__COMMENT_${comments.length}__`;
    comments.push(`<span class="tok-comment">${match}</span>`);
    return token;
  });
  code = code.replace(/(&quot;.*?&quot;|&#039;.*?&#039;)/g, '<span class="tok-string">$1</span>');
  code = code.replace(/\b(\d+)\b/g, '<span class="tok-number">$1</span>');
  const keywordPattern =
    language === "python"
      ? /\b(from|import|class|def|return|with|as|if|else|elif|for|while|try|except|None|True|False|async|await)\b/g
      : /\b(const|let|var|function|return|if|else|for|while|await|async|import|from|export|class|new|true|false|null)\b/g;
  code = code.replace(keywordPattern, '<span class="tok-keyword">$1</span>');
  code = code.replace(/\b([A-Za-z_][\w]*)\s*(?=\()/g, '<span class="tok-function">$1</span>');
  code = code.replace(/\b(self|app|runtime|task|owner|status|title|source)\b/g, '<span class="tok-symbol">$1</span>');
  comments.forEach((comment, index) => {
    code = code.replace(`__COMMENT_${index}__`, comment);
  });
  return code || "&nbsp;";
}

function renderCaptainVotes() {
  const sorted = Object.entries(captainVotes).sort((a, b) => b[1] - a[1]);
  const leader = agentById(sorted[0][0]);
  const leaderText = leader ? `${leader.name} 领先` : "未选出";
  if (els.captainName) els.captainName.textContent = leaderText;
  if (els.captainInlineName) els.captainInlineName.textContent = leaderText;
  const voteMarkup = agents
    .map(
      (agent) => `
      <button class="captain-vote" data-agent="${agent.id}">
        <span><strong>${agent.name}</strong><em>${agent.role}</em></span>
        <b>${captainVotes[agent.id] || 0}</b>
      </button>
    `,
    )
    .join("");
  if (els.captainVoteList) els.captainVoteList.innerHTML = voteMarkup;
  if (els.captainVoteInlineList) els.captainVoteInlineList.innerHTML = voteMarkup;
  document.querySelectorAll(".captain-vote").forEach((button) => {
    button.addEventListener("click", () => {
      captainVotes[button.dataset.agent] = (captainVotes[button.dataset.agent] || 0) + 1;
      renderCaptainVotes();
      pushComment("投票系统", `${agentById(button.dataset.agent).name} 获得一票，队长将负责代码整合。`);
    });
  });
}

function switchOpenWorldPanel(panelId) {
  closeAllToolWindows();
  document.querySelectorAll(".open-world-content-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
  document.querySelectorAll("[data-world-panel-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.worldPanelTarget === panelId);
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
    pushPublicFeed("你", `编写代码：${shortTitle}`, "已切换到源文明手动编码，可以直接修改代码或使用补全代码。", "Code / manual");
    switchView("community");
    switchOpenWorldPanel("codePanel");
    if (els.autoCodeInput) els.autoCodeInput.value = text;
    switchCodingMode("manual");
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
  return [
    {
      agentId: "frontend",
      repoId: "desktop",
      fileName: "app.js",
      summary: "实现交互入口、状态渲染和项目 URL 展示",
      lines: buildAgentArtifactLines("frontend", pull, "app.js"),
    },
    {
      agentId: "backend",
      repoId: "runtime",
      fileName: "server.py",
      summary: "补齐任务接收、状态流转和结果记录接口",
      lines: buildAgentArtifactLines("backend", pull, "server.py"),
    },
    {
      agentId: "tester",
      repoId: "connectors",
      fileName: "feishu.md",
      summary: "生成冒烟测试清单和外部任务回传校验",
      lines: buildAgentArtifactLines("tester", pull, "feishu.md"),
    },
    {
      agentId: "reviewer",
      repoId: "runtime",
      fileName: "Agent.py",
      summary: `Review ${branch} 的可运行性与合并风险`,
      lines: buildAgentArtifactLines("reviewer", pull, "Agent.py"),
    },
  ];
}

function dispatchPulledRequestToAgents(pull) {
  const plan = pullAgentPlan(pull);
  pull.status = "dispatching";
  pull.repoId = pull.branch?.includes("feishu") ? "runtime" : "desktop";
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
  addLog(`PR ${pull.id} 已拉取，负责人开始分配 Agent 任务。`, "Git Bridge");
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
    pushPublicFeed(agent.name, `${pull.title}：分工完成`, `${planItem.fileName} 已产出可运行片段，等待负责人汇总。`, "Agent done / now");
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
      pull.leaderSummary = "Reviewer 已通过：代码片段语法结构可用，项目 URL 已生成，可以打开检查运行效果。";
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
      `# LLM plugin candidate generated locally at ${now}`,
      "def quantumflow_llm_plugin_candidate():",
      `    return {"task": ${JSON.stringify(task)}, "file": ${JSON.stringify(context.file)}, "status": "ready_for_review"}`,
    ].join("\n");
  }
  return [
    "",
    `// LLM plugin candidate generated locally at ${now}`,
    "function quantumflowLlmPluginCandidate() {",
    `  return { task: ${JSON.stringify(task)}, file: ${JSON.stringify(context.file)}, status: "ready_for_review" };`,
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
  event.preventDefault();
  const title = els.autoCodeInput?.value.trim() || "";
  if (!title) return;
  const owner = els.autoCodeOwner?.value || "frontend";
  const ownerAgent = agentById(owner) || agentById("frontend");
  const command = `/code ${owner} ${title}`;
  const button = els.autoCodeForm.querySelector("button");
  button.disabled = true;
  button.textContent = "Agent 编码中";
  pushComment("你", `自动编码：交给 ${ownerAgent.name} 处理《${title}》。`);
  try {
    if (!backendConnected) {
      writeTaskCompletionCode({ id: Date.now(), title, backendId: `local-${Date.now()}` }, ownerAgent);
      addLog("后端未连接，已先在本地代码区生成自动编码预览。", "System");
      return;
    }
    const response = await fetch("/api/bot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: command, conversation_id: "desktop-chat", sender_id: "desktop-user" }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "auto code failed");
    pushComment("QuantumFlow Bot", result.reply?.payload?.text || "已创建自动编码任务，Agent 正在执行。");
    els.autoCodeInput.value = "";
    loadIssues();
    loadCodeArtifacts();
  } catch {
    pushComment("QuantumFlow Bot", "自动编码请求失败，请检查后端连接或稍后重试。");
  } finally {
    button.disabled = false;
    button.textContent = "启动 Agent";
  }
}

function selectAutoAgent(agentId, reason = "") {
  document.querySelectorAll("[data-auto-agent]").forEach((button) => {
    button.classList.toggle("active", button.dataset.autoAgent === agentId);
  });
  if (els.autoCodeOwner) els.autoCodeOwner.value = agentId;
  if (reason && els.agentArbitrationNote) els.agentArbitrationNote.textContent = reason;
}

async function arbitrateAutoAgent() {
  const title = els.autoCodeInput?.value.trim() || "";
  if (!title) {
    if (els.agentArbitrationNote) els.agentArbitrationNote.textContent = "Master 会根据需求自动推荐最合适的 Agent。";
    return;
  }
  if (!backendConnected) {
    const localOwner = localAgentRecommendation(title);
    selectAutoAgent(localOwner, `本地仲裁推荐：${agentById(localOwner)?.name || localOwner}`);
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
    selectAutoAgent(recommended, `Master 推荐：${top?.label || recommended} 路 score ${top?.score ?? "-"}`);
  } catch {
    const localOwner = localAgentRecommendation(title);
    selectAutoAgent(localOwner, `本地仲裁推荐：${agentById(localOwner)?.name || localOwner}`);
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
    .replace(/\r?\n/g, " ")
    .slice(0, 180);
}

function buildAgentArtifactLines(agentId, taskLike = {}, fileName = "") {
  const agent = agentById(agentId) || { id: agentId, role: "Agent", name: agentId };
  const taskId = sanitizeCodeText(taskLike.id || taskLike.backendId || `local-${Date.now().toString(36)}`);
  const title = sanitizeCodeText(taskLike.title || "QuantumFlow 自动任务");
  const branch = sanitizeCodeText(taskLike.branch || "main");

  if (fileName.endsWith(".py")) {
    return [
      "",
      `# generated by ${agent.role}: ${title}`,
      "def quantumflow_generated_result():",
      "    return {",
      `        "task_id": "${taskId}",`,
      `        "title": "${title}",`,
      `        "branch": "${branch}",`,
      `        "agent": "${agent.id}",`,
      '        "status": "ready_for_review",',
      '        "checks": ["syntax", "ownership", "runtime_context"],',
      "    }",
    ];
  }

  if (fileName.endsWith(".md")) {
    return [
      "",
      `## ${agent.name} 交付记录`,
      "",
      `- 任务：${title}`,
      `- 分支：${branch}`,
      `- Agent：${agent.role}`,
      "- 状态：ready_for_review",
      "- 验收：语法结构、任务归属、外部消息回传路径均已记录。",
    ];
  }

  return [
    "",
    `// generated by ${agent.role}: ${title}`,
    "const quantumflowGeneratedResult = {",
    `  taskId: "${taskId}",`,
    `  title: "${title}",`,
    `  branch: "${branch}",`,
    `  agent: "${agent.id}",`,
    '  status: "ready_for_review",',
    '  checks: ["syntax", "ownership", "runtime_context"],',
    "};",
    "window.quantumflowGeneratedResults = window.quantumflowGeneratedResults || [];",
    "window.quantumflowGeneratedResults.push(quantumflowGeneratedResult);",
  ];
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
        writeTaskCompletionCode(
          {
            id: task.id,
            backendId: task.id,
            title: task.title,
            owner: task.owner_id,
            station: [task.station_x, task.station_y],
            status: task.status,
            source: task.source || "quantumflow",
          },
          owner,
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

function runTask(index = currentTaskIndex + 1) {
  if (backendConnected && socket) {
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
  const owner = agentById(task.owner);
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
  task.status = "done";
  writeTaskCompletionCode(task, owner);
  setAgent(owner.id, { status: "done", x: owner.home[0], y: owner.home[1] });
  setAgent("reviewer", { status: "idle", x: agentById("reviewer").home[0], y: agentById("reviewer").home[1] });
  addLog(`任务完成：${task.title}`, owner.name);
  renderTasks();
  updateMetrics();
}

function streamCodeLines({ repoId, fileName, lines, agentName = "Agent", taskTitle = "代码生成", replace = false }) {
  const repo = openWorldRepos.find((item) => item.id === repoId);
  if (!repo || !repo.files[fileName] || !lines?.length) return;
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
  const shouldRevealCode = !document.body.classList.contains("admin-mode") && !document.body.classList.contains("open-source-mode");
  if (shouldRevealCode) {
    switchView("community");
    switchOpenWorldPanel("codePanel");
  }
  renderCommunity();
  pushComment(agentName, `开始流式写入 ${repo.name}/${fileName}：${taskTitle}`, "streaming", key);

  let index = 0;
  const timer = window.setInterval(() => {
    const current = generatedCodeOverrides[key] || [];
    current.push(lines[index]);
    generatedCodeOverrides[key] = current;
    streamingCodeLineIndex = current.length - 1;
    renderCommunity();
    els.repoCodeView?.scrollTo({ top: els.repoCodeView.scrollHeight, behavior: "smooth" });
    if (index === 0 || index === lines.length - 1 || index % 2 === 0) {
      pushComment(agentName, `正在写入第 ${index + 1}/${lines.length} 行：${lines[index].slice(0, 54)}`, "streaming", key);
    }
    index += 1;
    if (index >= lines.length) {
      window.clearInterval(timer);
      streamingCodeTimers.delete(key);
      streamingCodeLineIndex = -1;
      renderCommunity();
      pushComment(agentName, `流式写入完成，等待 Review：${taskTitle}`, "suggestion", key);
    }
  }, 260);
  streamingCodeTimers.set(key, timer);
}

window.quantumflowStreamCodeLines = streamCodeLines;
globalThis.quantumflowStreamCodeLines = streamCodeLines;
restoreAuthSession();

function writeTaskCompletionCode(task, owner) {
  const map = {
    master: ["runtime", "Agent.py"],
    frontend: ["desktop", "app.js"],
    backend: ["runtime", "server.py"],
    reviewer: ["runtime", "Agent.py"],
    tester: ["connectors", "feishu.md"],
  };
  const target = map[owner.id] || ["runtime", "server.py"];
  const repo = openWorldRepos.find((item) => item.id === target[0]);
  if (!repo) return;
  const fileName = target[1];
  streamCodeLines({
    repoId: target[0],
    fileName,
    agentName: owner.name,
    taskTitle: task.title,
    lines: buildAgentArtifactLines(owner.id, task, fileName),
  });
}

function resetAll() {
  if (backendConnected && socket) {
    socket.send(JSON.stringify({ command: "reset" }));
    return;
  }
  stopAuto();
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

async function createTask(title, ownerId) {
  if (!title.trim()) return;

  if (backendConnected) {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, owner_id: ownerId }),
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
els.runtimePreviewRefreshBtn?.addEventListener("click", () => {
  const url = els.runtimeProjectFrame?.src || "";
  if (!url) return;
  els.runtimeProjectFrame.src = url;
});
els.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createTask(els.taskInput.value, els.ownerSelect.value);
  els.taskInput.value = "";
});
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
  const openRoomButton = event.target.closest?.("[data-open-room]");
  if (openRoomButton) openProjectRoom(openRoomButton.dataset.openRoom);
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
  button.addEventListener("click", () => switchOpenWorldPanel(button.dataset.worldPanelTarget));
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
    selectAutoAgent(button.dataset.autoAgent, `手动指定：${agentById(button.dataset.autoAgent)?.name || button.dataset.autoAgent}`);
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

function realOnlineCollaboratorRows() {
  const source = publicWorldOnlinePeers.length
    ? publicWorldOnlinePeers
    : [{ id: collaboratorClientId, name: currentUser?.display_name || collaboratorName, role: currentUser?.role || "Developer", status: "online" }];
  const merged = source.some((peer) => String(peer.id || "").toLowerCase() === codexAssistantPeer.id)
    ? source
    : [codexAssistantPeer, ...source];
  return merged
    .filter((peer) => peer.kind !== "virtual_network")
    .map((peer, index) => ({
      id: peer.id || `online-${index}`,
      name: repairMojibake(peer.name || "Developer"),
      role: repairMojibake(peer.role || "Developer"),
      kind: peer.kind || "developer",
      color: peer.color || (peer.kind === "assistant" ? "#2fe098" : "#21d6e7"),
      source: repairMojibake(peer.source || peer.ip || peer.host || "LAN / WebSocket"),
      status: repairMojibake(peer.status || "online"),
    }));
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
  const onlinePeers = mergedPeers.map((peer) => ({
    ...peer,
    name: repairMojibake(peer.name || "Developer"),
    role: repairMojibake(peer.role || "Developer"),
    ip: repairMojibake(peer.ip || ""),
    host: repairMojibake(peer.host || ""),
    source: repairMojibake(peer.source || ""),
    status: repairMojibake(peer.status || "online"),
  }));
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
  const response = await fetch("/api/admin/members", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      user_id: Number(userId),
      name,
      role,
      project_scope: els.adminMemberProject?.value.trim() || "QuantumFlow Core",
      permissions: currentAdminPermissions(),
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
              <article class="task-log-item ${status}">
                <div class="task-log-top">
                  <strong>${escapeHtml(item.action || "action")}</strong>
                  <span>${escapeHtml(item.created_at || "")}</span>
                </div>
                <div class="task-log-meta">
                  <span>${escapeHtml(actor)}</span>
                  <span>${escapeHtml(item.task_id || "system")}</span>
                  <span>${escapeHtml(status)}</span>
                </div>
                <p>${escapeHtml(item.input_text || "无输入摘要")}</p>
                <small>${escapeHtml(item.output_text || "无输出摘要")}</small>
              </article>
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
        const [repoId, fileName] = String(artifact.target_key || "").split("/");
        const repo = openWorldRepos.find((item) => item.id === repoId);
        if (!repo || !repo.files[fileName]) return;
        const key = codeKey(repoId, fileName);
        const artifactLines = String(artifact.code_text || "").split("\n");
        codeArtifactMeta[key] = artifact;
        codeArtifactKeys.add(artifact.id);
        if (artifact.status === "manual_edit") {
          generatedCodeOverrides[key] = artifactLines;
        } else {
          streamCodeLines({
            repoId,
            fileName,
            lines: ["", ...artifactLines],
            agentName: agentById(artifact.agent_id)?.name || artifact.agent_id || "Agent",
            taskTitle: artifact.task_id || "后端代码产物",
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

