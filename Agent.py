from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, Iterable, List, Optional


class AgentStatus(str, Enum):
    IDLE = "idle"
    WALKING = "walking"
    WORKING = "working"
    BLOCKED = "blocked"
    DONE = "done"


class TaskStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    BLOCKED = "blocked"
    DONE = "done"


@dataclass
class Agent:
    id: str
    name: str
    role: str
    color: str
    x: int
    y: int
    status: AgentStatus = AgentStatus.IDLE
    current_task_id: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "color": self.color,
            "x": self.x,
            "y": self.y,
            "status": self.status.value,
            "current_task_id": self.current_task_id,
        }


@dataclass
class Task:
    id: str
    title: str
    owner_id: str
    station_x: int
    station_y: int
    status: TaskStatus = TaskStatus.PENDING
    source: str = "quantumflow"
    conversation_id: Optional[str] = None
    sender_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "owner_id": self.owner_id,
            "station_x": self.station_x,
            "station_y": self.station_y,
            "status": self.status.value,
            "source": self.source,
            "conversation_id": self.conversation_id,
            "sender_id": self.sender_id,
            "created_at": self.created_at.isoformat(timespec="seconds"),
        }


@dataclass
class AgentEvent:
    type: str
    agent_id: str
    message: str
    task_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "agent_id": self.agent_id,
            "task_id": self.task_id,
            "message": self.message,
            "created_at": self.created_at.isoformat(timespec="seconds"),
        }


class QuantumFlowRuntime:
    def __init__(self, agents: Iterable[Agent], tasks: Iterable[Task]):
        self.agents: Dict[str, Agent] = {agent.id: agent for agent in agents}
        self.tasks: Dict[str, Task] = {task.id: task for task in tasks}
        self.events: List[AgentEvent] = []
        self.completed_total = 0
        self.archived_tasks: List[Task] = []
        self._task_sequence = len(self.tasks)

    def add_task(
        self,
        title: str,
        owner_id: str,
        station_x: int,
        station_y: int,
        source: str = "quantumflow",
        conversation_id: Optional[str] = None,
        sender_id: Optional[str] = None,
    ) -> Task:
        if owner_id not in self.agents:
            raise ValueError(f"Unknown agent id: {owner_id}")
        self._task_sequence += 1
        task = Task(
            f"task-{self._task_sequence:03d}",
            title,
            owner_id,
            station_x,
            station_y,
            source=source,
            conversation_id=conversation_id,
            sender_id=sender_id,
        )
        self.tasks[task.id] = task
        self.record("task_created", owner_id, f"新增任务[{source}]：{title}", task.id)
        return task

    def dispatch_next(self) -> Optional[Task]:
        task = next((item for item in self.tasks.values() if item.status == TaskStatus.PENDING), None)
        if not task:
            self.record("system", "master", "全部任务已完成，等待新的用户目标。")
            return None

        agent = self.agents[task.owner_id]
        task.status = TaskStatus.ACTIVE
        agent.status = AgentStatus.WALKING
        agent.current_task_id = task.id
        agent.x = task.station_x
        agent.y = task.station_y
        self.record("dispatch", agent.id, f"收到任务：{task.title}", task.id)
        return task

    def start_work(self, task_id: str) -> None:
        task = self.tasks[task_id]
        agent = self.agents[task.owner_id]
        agent.status = AgentStatus.WORKING
        self.record("work_started", agent.id, "开始执行任务并写入状态事件。", task.id)

    def block_task(self, task_id: str, reason: str) -> None:
        task = self.tasks[task_id]
        agent = self.agents[task.owner_id]
        task.status = TaskStatus.BLOCKED
        agent.status = AgentStatus.BLOCKED
        self.record("blocked", agent.id, reason, task.id)

    def complete_task(self, task_id: str) -> None:
        task = self.tasks[task_id]
        agent = self.agents[task.owner_id]
        task.status = TaskStatus.DONE
        agent.status = AgentStatus.DONE
        agent.current_task_id = None
        self.record("done", agent.id, f"任务完成：{task.title}", task.id)

    def archive_completed_task(self, task_id: str) -> Optional[Task]:
        task = self.tasks.get(task_id)
        if not task or task.status != TaskStatus.DONE:
            return None
        self.completed_total += 1
        self.archived_tasks.append(task)
        self.archived_tasks = self.archived_tasks[-30:]
        del self.tasks[task_id]
        self.record("task_archived", "master", f"已清理运行队列：{task.title}", task.id)
        return task

    def clear_tasks(self) -> int:
        cleared = len(self.tasks)
        self.tasks.clear()
        for agent in self.agents.values():
            agent.status = AgentStatus.IDLE
            agent.current_task_id = None
        self.record("tasks_cleared", "master", f"已清空任务队列：{cleared} 条")
        return cleared

    def record(self, event_type: str, agent_id: str, message: str, task_id: Optional[str] = None) -> None:
        self.events.append(AgentEvent(event_type, agent_id, message, task_id))

    def snapshot(self) -> dict:
        pending = sum(1 for task in self.tasks.values() if task.status == TaskStatus.PENDING)
        active = sum(1 for task in self.tasks.values() if task.status == TaskStatus.ACTIVE)
        blocked = sum(1 for task in self.tasks.values() if task.status == TaskStatus.BLOCKED)
        return {
            "agents": [agent.to_dict() for agent in self.agents.values()],
            "tasks": [task.to_dict() for task in self.tasks.values()],
            "events": [event.to_dict() for event in self.events[-50:]],
            "queue": {
                "pending": pending,
                "active": active,
                "blocked": blocked,
                "running_total": pending + active + blocked,
                "completed_total": self.completed_total,
                "archived_recent": [task.to_dict() for task in self.archived_tasks[-5:]],
            },
        }


def default_runtime() -> QuantumFlowRuntime:
    agents = [
        Agent("master", "团队负责人", "Master", "#ffc44d", 330, 228),
        Agent("frontend", "前端开发", "UI Agent", "#7c5cff", 545, 228),
        Agent("backend", "后端开发", "API Agent", "#22c7d8", 1110, 204),
        Agent("reviewer", "代码审查者", "Reviewer", "#ff515f", 1120, 360),
        Agent("tester", "全栈测试", "QA Agent", "#2fe098", 1220, 162),
    ]
    tasks = []
    return QuantumFlowRuntime(agents, tasks)


if __name__ == "__main__":
    runtime = default_runtime()
    while True:
        task = runtime.dispatch_next()
        if task is None:
            break
        runtime.start_work(task.id)
        runtime.complete_task(task.id)

    for event in runtime.events:
        print(f"[{event.created_at:%H:%M:%S}] {event.agent_id}: {event.message}")

# QuantumFlow accepted review suggestion
# 采纳建议前必须先跑校验，不能让代码区出现明显语法错误。
def quantumflow_review_note():
    return '采纳建议前必须先跑校验，不能让代码区出现明显语法错误。'
