# QuantumFlow 多智能体协作系统设计文档（v2，OpenClaw 对齐版）

> 本文档描述 QuantumFlow 当前**真实运行**的架构。早期版本曾规划 RabbitMQ + Redis +
> 四智能体加权投票，但在单机桌面形态下这些组件是冗余的，已被移除。本版借鉴
> [OpenClaw 多智能体架构](https://markaicode.com/architecture/openclaw-multi-agent-architecture/)
> 的核心思想——**无状态编排器 + 专精智能体 + 异步队列 + 弹性容错**，但按本项目的实际规模做了裁剪。

## 0. 为什么做这次优化

旧设计与代码严重脱节，且存在明显冗余：

| 旧设计文档声称 | 代码实际情况 | 处置 |
| --- | --- | --- |
| RabbitMQ 消息队列保证并发 | 进程内 `asyncio.Lock` + `drain_pending_tasks` | 删除 RabbitMQ，承认 asyncio 队列 |
| Redis 共享记忆 | SQLite（`storage.py`） | 删除 Redis，承认 SQLite |
| 四智能体加权投票选总司令 | 关键词静态打分，无投票 | 删除投票机制，改为路由打分 |
| 智能体用 codex/gpt5.5 生成代码 | `asyncio.sleep` + 模板拼接，从不调用 LLM | **接入真实 LLM**（本版核心改动） |
| 误差闭环纠错 | 未实现 | 用校验失败回退 + 断路器替代 |

**核心原则**：文档只描述真实存在的东西；冗余的中间件不写进设计；规模不需要的机制（如投票）不强加。

## 1. 系统架构

QuantumFlow 是单进程的多智能体协作开发系统，分两个平面：

- **控制平面（Control Plane）**：负责人（master）拆解需求、路由任务、整合交付。无状态——所有状态落在 SQLite，进程重启可恢复。
- **执行平面（Execution Plane）**：frontend / backend / tester / reviewer 四个专精智能体，共享同一基础模型（默认 `gpt-5.5`），通过角色 Prompt 与温度区分职责。

```
用户/飞书/Issue/项目房间
        │
        ▼
   入站归一化 (connectors.py)  ──►  任务队列 (asyncio, run_lock)
        │
        ▼
   编排器 (server.execute_collaborative_dev_task)
        │  路由打分 (score_agent_candidates + orchestrator.route_score)
        ├──► frontend ┐
        ├──► backend  │  并行执行 (asyncio.gather)
        ├──► tester   │  每个 agent → orchestrator.generate_agent_code
        └──► reviewer ┘        │ 重试/退避/断路器/幂等/模板兜底
                               ▼
                         LLM.invoke_agent → 真实模型
                               │
                               ▼
   校验门禁 → 打包交付 (build_project_delivery) → SQLite + 可下载 zip
```

## 2. 弹性执行层（本版核心，对齐 OpenClaw）

所有智能体的真实工作都经过 `orchestrator.generate_agent_code`，它在 `LLM.invoke_agent`
外面包了一层 OpenClaw 风格的容错：

- **重试 + 指数退避**：失败按 `1s → 4s → 15s` 退避重试（`BACKOFF_SCHEDULE`）。
- **快速失败**：缺少 API Key、缺依赖、401/认证类错误不重试，直接兜底（`_is_non_transient`）。
- **断路器**：单个 agent 在 600s 窗口内失败 5 次即熔断，冷却 120s 后半开探测（`CircuitBreaker`）。
- **幂等键**：`correlation_id = sha1(task_id|agent_id|step)`，重复调用直接返回缓存，避免重复生成。
- **模板兜底**：LLM 不可用或输出未通过校验时，回退到确定性模板（`generated_code_text`），保证流程必定完成。

产物来源在审计日志中标注为 `llm` / `cache` / `fallback`，前端可见。

## 3. 任务路由（替代旧投票机制）

旧的"四智能体加权投票选总司令"对单机单领域任务是冗余的（OpenClaw 明确指出：
单领域任务不要上多智能体，单体延迟更低）。改为**两段式路由打分**：

1. **关键词亲和度**（`score_agent_candidates`）：按角色关键词命中数 × 角色权重得到基础分。
2. **健康度调整**（`orchestrator.route_score`）：

   ```
   effective = base × (0.5 + 0.5 × 成功率) × 1/(1+在途负载) × 断路器惩罚
   ```

   即"按负载与历史成功率选最优 agent"——这正是 OpenClaw 的路由原则，但不需要多模型投票。

实时健康度通过 `GET /api/agents/health` 暴露：成功/失败次数、在途负载、成功率、断路器状态。

## 4. 中间件层（务实裁剪）

| 能力 | OpenClaw（多 Pod 横向扩展） | QuantumFlow（单机） |
| --- | --- | --- |
| 任务队列 | Redis Streams + 消费组 | `asyncio` + `run_lock`（`drain_pending_tasks`） |
| 短期记忆/上下文 | Redis + Lua 原子写 | 进程内 runtime + 幂等缓存 |
| 持久化/审计 | PostgreSQL | SQLite（`storage.py`：task_log / code_artifact / adoption / delivery） |
| 服务发现 | etcd Skill Registry | 静态 agent 表（`default_runtime`） |

**结论**：在单进程桌面形态下，asyncio + SQLite 就是合适的规模。引入 RabbitMQ/Redis/etcd
只会增加部署负担而不带来收益，故不纳入设计。若未来需要多机横向扩展，可按上表右→左升级。

## 5. API 接口（对内 HTTP，非旧版 /ask /pend /exec /vote）

旧版四指令（`/ask`、`/pend`、`/exec`、`/vote`）是为 RabbitMQ 消息总线设计的，
实际系统是 FastAPI HTTP 接口。真实关键接口：

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| POST | `/api/tasks` | 创建任务并自动入队调度 |
| POST | `/api/dispatch-next` | 手动触发一次队列调度 |
| GET | `/api/snapshot` | 智能体/任务/事件/队列快照 |
| GET | `/api/agents/health` | 编排器健康度（成功率/负载/断路器） |
| POST | `/api/agents/arbitrate` | 任务路由打分与推荐 agent |
| GET | `/api/code-artifacts` | 各 agent 产出的代码产物 |
| GET | `/api/project-deliveries` | 可下载的项目交付包 |

完整接口以 `server.py` 中的 FastAPI 路由为准。

## 6. 质量门禁与闭环

代替旧的"误差 e = 满分答案 − 当前输出"抽象描述，真实闭环是：

1. **生成**：agent 经弹性层产出代码（LLM 优先，模板兜底）。
2. **校验**：`validate_generated_code` 做语法/兼容性门禁；LLM 产物未过校验则回退模板再校验。
3. **集成测试**：交付包通过 `POST /api/project-deliveries/{id}/test`（前端跑 spec、后端跑 smoke）。
4. **修复回流**：测试失败时 `POST /api/project-deliveries/{id}/fix` 重新入队给对应 agent。
5. **审计**：每步写入 `task_log`，产物来源（llm/cache/fallback）与校验结论全程可追溯。

## 7. 后续可演进项

- 路由历史成功率持久化到 SQLite（当前在内存，重启清零）。
- 任务级 DAG 拆解：让 master 用 LLM 把复杂需求拆成子任务图，而非固定四角色并行。
- 多 Provider 模型回退（如 429 时降级到本地模型），`Model.py` 已支持按 agent 配置 provider。
