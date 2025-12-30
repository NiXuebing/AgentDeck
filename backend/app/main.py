import asyncio
import json
import logging
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool
from dotenv import load_dotenv

from .docker_mgr import AgentRecord, DockerManager


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="AgentDeck API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


docker_mgr = DockerManager()


class SpawnAgentRequest(BaseModel):
    api_key: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    mcp_env: Optional[Dict[str, Dict[str, str]]] = None


class QueryAgentRequest(BaseModel):
    query: str
    history: List[Dict[str, Any]] = Field(default_factory=list)


class AgentInfo(BaseModel):
    agent_id: str
    config_id: str
    container_id: str
    container_name: str
    status: str
    host_port: Optional[int] = None
    created_at: datetime


def record_to_info(record: AgentRecord) -> AgentInfo:
    return AgentInfo(
        agent_id=record.agent_id,
        config_id=record.config_id,
        container_id=record.container_id,
        container_name=record.container_name,
        status=record.status,
        host_port=record.host_port,
        created_at=record.created_at,
    )


def resolve_api_key(request: SpawnAgentRequest, authorization: Optional[str]) -> Optional[str]:
    if request.api_key:
        return request.api_key

    if authorization:
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1].strip()

    return os.environ.get("ANTHROPIC_API_KEY")


@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/agents", response_model=AgentInfo)
async def spawn_agent(request: SpawnAgentRequest, authorization: Optional[str] = Header(default=None)):
    api_key = resolve_api_key(request, authorization)
    if not api_key:
        raise HTTPException(status_code=400, detail="api_key is required")

    try:
        record = await run_in_threadpool(
            docker_mgr.spawn_agent, api_key, request.config, request.mcp_env
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return record_to_info(record)


@app.get("/api/agents", response_model=List[AgentInfo])
async def list_agents():
    records = await run_in_threadpool(docker_mgr.list_agents)
    return [record_to_info(record) for record in records.values()]


@app.delete("/api/agents/{agent_id}")
async def stop_agent(agent_id: str):
    try:
        await run_in_threadpool(docker_mgr.stop_agent, agent_id, True)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {"status": "stopped", "agent_id": agent_id}


@app.post("/api/agents/{agent_id}/query")
async def query_agent(agent_id: str, payload: QueryAgentRequest):
    endpoint = await run_in_threadpool(docker_mgr.get_agent_endpoint, agent_id)
    if not endpoint:
        raise HTTPException(status_code=404, detail="agent not found or no endpoint")

    url = f"{endpoint}/query"
    request_body = payload.model_dump()

    async def event_stream():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                url,
                json=request_body,
                headers={"Accept": "text/event-stream"},
            ) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    message = body.decode(errors="ignore").strip()
                    error_payload = {"type": "error", "message": message or "agent query failed"}
                    yield f"data: {json.dumps(error_payload)}\n\n".encode()
                    return

                async for chunk in resp.aiter_raw():
                    yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.websocket("/ws/agents/{agent_id}/logs")
async def stream_logs(websocket: WebSocket, agent_id: str):
    await websocket.accept()
    container = await run_in_threadpool(docker_mgr.get_container, agent_id)
    if container is None:
        await websocket.send_text("agent not found")
        await websocket.close(code=1008)
        return

    queue: asyncio.Queue[Any] = asyncio.Queue()
    stop_event = threading.Event()
    loop = asyncio.get_running_loop()

    def log_reader():
        try:
            for line in container.logs(stream=True, follow=True, tail=0):
                if stop_event.is_set():
                    break
                loop.call_soon_threadsafe(queue.put_nowait, line)
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, exc)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)

    thread = threading.Thread(target=log_reader, daemon=True)
    thread.start()

    try:
        while True:
            item = await queue.get()
            if item is None:
                break
            if isinstance(item, Exception):
                await websocket.send_text(f"[error] {item}")
                break
            text = item.decode("utf-8", errors="replace").rstrip()
            if text:
                await websocket.send_text(text)
    except WebSocketDisconnect:
        stop_event.set()
    finally:
        stop_event.set()
