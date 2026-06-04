from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, List


@dataclass
class MemoryChunk:
    id: str
    text: str
    tags: List[str]
    pinned: bool = False


class LocalMemory:
    def __init__(self) -> None:
        self._chunks: List[MemoryChunk] = []

    def add(self, text: str, *tags: str, pinned: bool = False) -> MemoryChunk:
        chunk = MemoryChunk(f"mem-{len(self._chunks) + 1:04d}", text.strip(), list(tags), pinned)
        self._chunks.append(chunk)
        return chunk

    def extend(self, chunks: Iterable[MemoryChunk]) -> None:
        self._chunks.extend(chunks)

    def search(self, query: str, limit: int = 5) -> List[MemoryChunk]:
        terms = rag_terms(query)
        scored = []
        for chunk in self._chunks:
            haystack = f"{chunk.text} {' '.join(chunk.tags)}".lower()
            score = 8 if chunk.pinned else 0
            score += sum(2 for term in terms if term in haystack)
            score += sum(1 for tag in chunk.tags if tag.lower() in terms)
            if chunk.pinned or score:
                scored.append((score, chunk))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [chunk for _, chunk in scored[:limit]]


def rag_terms(text: str) -> set[str]:
    lowered = text.lower()
    terms = {part for part in re.split(r"[\s,，。.!?！？:：/\\-]+", lowered) if len(part) >= 2}
    terms.update(re.findall(r"[\u4e00-\u9fff]{2,}", lowered))
    return terms


def default_memory() -> LocalMemory:
    memory = LocalMemory()
    memory.add(
        "QuantumFlow 是多智能体协作开发系统，核心是桌面调度中枢、任务队列、Agent 状态流、代码治理和项目交付。",
        "foundation",
        "vision",
        "desktop",
        pinned=True,
    )
    memory.add(
        "基础知识来自系统设计文档，属于不可遗忘记忆；外部 Agent 的回答只作为补充经验，不能覆盖设计文档。",
        "foundation",
        "design-doc",
        "rag",
        pinned=True,
    )
    memory.add(
        "外部 Agent 经验进入 RAG 后，Codex 回答时应检索相关片段，再结合 QuantumFlow 原始架构、质量门禁和交付流程给出建议。",
        "external-agent",
        "retrieval",
        "codex",
    )
    return memory


def format_memory_context(chunks: Iterable[MemoryChunk], limit: int = 6) -> str:
    lines = []
    for index, chunk in enumerate(list(chunks)[:limit], start=1):
        tags = ",".join(chunk.tags)
        lines.append(f"{index}. [{tags}] {chunk.text}")
    return "\n".join(lines)
