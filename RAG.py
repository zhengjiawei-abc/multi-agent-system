from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass
class MemoryChunk:
    id: str
    text: str
    tags: List[str]


class LocalMemory:
    def __init__(self) -> None:
        self._chunks: List[MemoryChunk] = []

    def add(self, text: str, *tags: str) -> MemoryChunk:
        chunk = MemoryChunk(f"mem-{len(self._chunks) + 1:04d}", text, list(tags))
        self._chunks.append(chunk)
        return chunk

    def search(self, query: str, limit: int = 5) -> List[MemoryChunk]:
        terms = {item.lower() for item in query.split() if item.strip()}
        scored = []
        for chunk in self._chunks:
            haystack = f"{chunk.text} {' '.join(chunk.tags)}".lower()
            score = sum(1 for term in terms if term in haystack)
            if score:
                scored.append((score, chunk))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [chunk for _, chunk in scored[:limit]]


def default_memory() -> LocalMemory:
    memory = LocalMemory()
    memory.add("QuantumFlow 是多智能体版 OpenClaw，核心是桌面战情室、任务调度、Agent 状态流。", "vision", "desktop")
    memory.add("第一阶段使用 SQLite/WebSocket/本地文件系统，后续再替换 Redis、Pulsar、K8s。", "architecture", "mvp")
    memory.add("卡通 Agent 的移动应绑定真实任务事件，而不是纯装饰动画。", "frontend", "animation")
    return memory
