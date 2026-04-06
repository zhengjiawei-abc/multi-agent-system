Multi-Agent 多智能体系统协作系统设计文档（含 API 规范）

LLM 核心基础知识库

一、大模型运行本质（How LLM Works）

大模型（LLM）的本质是基于统计概率的文本生成引擎。

LLM：大语言模型回答问题时，会通过模型内部运算预测出现概率最高的词，然后逐词预测下一个词，直到回答完毕并输出结束标识符。其核心流程为：逐词预测 + 概率采样 + 结束标识符。

Token：大语言模型中最基本的单元。通过分词器把输入文本切分成一块块词语，每个词语对应一个 Token 及其 ID。模型内部通过 Transformer 架构预测概率最高的下一个 Token，并循环此过程直到输出结束标识符。这就是大模型的运行流程和底层逻辑。

Context：上下文，大模型每次处理任务时接收到的信息总和。

Context Window（上下文窗口）：模型能处理的最大 Token 容量上限。

二、Transformer 架构

大模型内部通过Transformer架构处理输入序列。它是目前主流 LLM 的基石，实现了并行计算，取代了以往的顺序处理方式。

三、Attention 机制（自注意力机制）

Attention 机制让当前的 Token 找到相关的其他 Token 进行加权求和，再结合 Context，通过 Transformer 架构进行矩阵运算来预测下一轮 Token。其核心是给不同 Token 分配不同的“权重”。

解决的问题：让模型能够有效联系上下文。例如在“苹果很好吃，因为它很新鲜”这句话中，Attention 会让模型知道“它”指代的是“苹果”。

多智能体（Multi-Agent）项目设计与流程图

1. 系统架构设计

核心目标：通过多智能体协作实现“降本增效”，人类负责提供创造性想法，AI 团队负责逻辑规划与工程落地。

系统采用“总司令 - 执行者”的层级结构，结合中间件保障并发安全与记忆连续性。

决策层：
Manager（Claude Code）：负责全局任务拆解、逻辑仲裁及投票发起。
投票机制：针对复杂决策，由四个 Agent 共同投票产生最终执行方案。

中间件层：
RabbitMQ（消息队列）：所有待处理任务进入队列排队，解决 Agent 并发竞争问题，保证消息同步处理。
Redis（共享记忆）：缓存各 Agent 的 Token 状态、变量名及文件路径，实现长短期记忆持久化。

执行层：
Codex（后端） / Gemini（前端）：并行生成代码 Token。
OpenCode（环境）：负责 WSL 终端交互、代码写入及测试运行。

2. 完整业务流程图（End-to-End Workflow）


3. API 接口文档（各 Agent 的调用规范）

设计原则：所有 Agent 必须遵循统一的请求/响应格式，确保在 RabbitMQ 消息队列中能够被正确解析与路由。指令集保持极简。

指令 (命令)	发起方	目标接收方 (Target)	功能描述	输入参数
/ask	Claude	Codex/Gemini	委派代码生成任务（后端或前端）	{task_id, prompt, context_ref}
/pend	Claude	Codex/Gemini	异步回收执行结果（等待 Token 生成完毕）	{task_id}
/exec	Claude	OpenCode	要求在本地执行命令或写入文件	{command, file_path, content}
/vote	Claude	所有代理	发起集体投票，选出当前阶段的“总司令”	{topic, options}

4. 多智能体投票与仲裁机制（Voting & Arbitration）

设计背景：在处理复杂业务逻辑时，单一 Agent 可能存在逻辑盲点。通过投票机制从多个维度评估方案鲁棒性。

投票工作流：
1.Manager 提出 2-3 个备选方案。
2.各 Agent 根据擅长领域拥有不同权重（Codex 1.5x、Gemini 1.5x、OpenCode 1.2x）。
3.进行匿名评价并通过 RabbitMQ 传递。
4.系统汇总权重得分，选出最高分方案作为“执行总司令”。

人类仲裁：投票平局时，桌面端软件会邀请用户进行最终裁决。
一票否决权：Manager 可对存在明显安全漏洞的方案执行否决。

5. 测试与质量保障方案（QA 与 Error Correction）

基于误差反馈的闭环纠错逻辑：

误差定义：e = 满分答案 - 当前输出
反馈循环：OpenCode 运行测试（如npm test），捕获报错信息并反馈给 Manager。
指令微调：Manager 根据误差调整 Prompt，重新生成更有针对性的指令，直到测试全部通过。


系统稳定性保障：
RabbitMQ 实现指令排队，避免“插队”。
Redis 记录文件状态，避免代码被互相覆盖。
