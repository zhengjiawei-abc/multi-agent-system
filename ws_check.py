from __future__ import annotations

import asyncio
import json

import websockets


async def main() -> None:
    async with websockets.connect("ws://127.0.0.1:8765/ws") as websocket:
        message = await asyncio.wait_for(websocket.recv(), timeout=5)
        payload = json.loads(message)
        data = payload.get("data", {})
        print(payload.get("kind"), len(data.get("agents", [])), len(data.get("tasks", [])))


if __name__ == "__main__":
    asyncio.run(main())
