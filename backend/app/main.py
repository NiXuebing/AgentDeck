import asyncio
import json
import logging
import os
import threading
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import Body, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from starlette.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool
from dotenv import load_dotenv

from .blueprint_generator import BlueprintGenerator
from .docker_mgr import AgentRecord, DockerManager
from .intent_router import IntentRouter
from .session_mgr import SessionManager


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


docker_mgr = DockerManager()
SESSION_IDLE_MINUTES = int(os.environ.get("AGENTDECK_SESSION_IDLE_MINUTES", "60"))
SESSION_SWEEP_SECONDS = int(os.environ.get("AGENTDECK_SESSION_SWEEP_SECONDS", "60"))
session_mgr = SessionManager(docker_mgr, idle_minutes=SESSION_IDLE_MINUTES)
cleanup_task: Optional[asyncio.Task] = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global cleanup_task
    if SESSION_IDLE_MINUTES > 0:
        async def cleanup_loop():
            while True:
                try:
                    idle_sessions = session_mgr.get_idle_sessions()
                    for session_id in idle_sessions:
                        await asyncio.to_thread(session_mgr.stop_session, session_id)
                except Exception as exc:
                    logger.warning("Session cleanup loop failed: %s", exc)
                await asyncio.sleep(max(SESSION_SWEEP_SECONDS, 10))

        cleanup_task = asyncio.create_task(cleanup_loop())

    try:
        yield
    finally:
        if cleanup_task is None:
            return
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass
        cleanup_task = None


app = FastAPI(title="AgentDeck API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SpawnAgentRequest(BaseModel):
    config: Dict[str, Any] = Field(default_factory=dict)
    mcp_env: Optional[Dict[str, Dict[str, str]]] = None


class QueryAgentRequest(BaseModel):
    query: str
    history: List[Dict[str, Any]] = Field(default_factory=list)


class LaunchRequest(BaseModel):
    config_id: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    mcp_env: Optional[Dict[str, Dict[str, str]]] = None


class LaunchResponse(BaseModel):
    session_id: str
    session_token: str
    agent_id: str
    config_id: str
    status: str
    created_at: datetime


class SessionInfo(BaseModel):
    session_id: str
    agent_id: str
    config_id: str
    status: str
    created_at: datetime
    last_active: datetime


class SessionListResponse(BaseModel):
    sessions: List[SessionInfo]
    total: int


class ChatMessage(BaseModel):
    role: str
    content: str


class AgentChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    messages: List[ChatMessage]
    session_id: Optional[str] = Field(default=None, alias="sessionId")


class ResumeRequest(BaseModel):
    mcp_env: Optional[Dict[str, Dict[str, str]]] = None


class ConfigReloadRequest(BaseModel):
    config: Dict[str, Any]
    mcp_env: Optional[Dict[str, Dict[str, str]]] = None


class ConfigReloadResponse(BaseModel):
    agent: "AgentInfo"
    session_id: str
    session_token: str


class BlueprintRequest(BaseModel):
    prompt: str


class BlueprintResponse(BaseModel):
    config: Dict[str, Any]


class IntentRequest(BaseModel):
    user_text: str
    assistant_text: Optional[str] = None


class IntentResponse(BaseModel):
    suggested_tools: List[str]
    reason: Optional[str] = None


class AgentInfo(BaseModel):
    agent_id: str
    config_id: str
    container_id: str
    container_name: str
    status: str
    session_id: Optional[str] = None
    host_port: Optional[int] = None
    created_at: datetime


ConfigReloadResponse.model_rebuild()


def record_to_info(record: AgentRecord) -> AgentInfo:
    session_id = record.session_id or session_mgr.get_session_for_agent(record.agent_id)
    return AgentInfo(
        agent_id=record.agent_id,
        config_id=record.config_id,
        container_id=record.container_id,
        container_name=record.container_name,
        status=record.status,
        session_id=session_id,
        host_port=record.host_port,
        created_at=record.created_at,
    )


def require_env_api_key() -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is required")
    return api_key


def resolve_session_id(requested: Optional[str], header_session_id: Optional[str]) -> Optional[str]:
    return requested or header_session_id


def extract_user_message(messages: List[ChatMessage]) -> Optional[str]:
    for message in reversed(messages):
        if message.role == "user":
            return message.content
    return None


def require_session(agent_id: str) -> str:
    session_id = session_mgr.get_session_for_agent(agent_id)
    if not session_id:
        raise HTTPException(status_code=404, detail="session not found for agent")
    return session_id


@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/blueprints/preview", response_model=BlueprintResponse)
async def preview_blueprint(
    request: BlueprintRequest,
    x_api_key: Optional[str] = Header(default=None, alias="X-Api-Key"),
):
    api_key = x_api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="ANTHROPIC_API_KEY is required")
    generator = BlueprintGenerator(api_key=api_key)
    try:
        result = await generator.generate(request.prompt)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return BlueprintResponse(config=result.get("config", {}))


@app.post("/api/agents/intent", response_model=IntentResponse)
async def suggest_tools(
    request: IntentRequest,
    x_api_key: Optional[str] = Header(default=None, alias="X-Api-Key"),
):
    api_key = x_api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="ANTHROPIC_API_KEY is required")
    router = IntentRouter(api_key=api_key)
    try:
        result = await router.suggest_tools(request.user_text, request.assistant_text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return IntentResponse(**result)


@app.post("/api/agents", response_model=AgentInfo)
async def spawn_agent(request: SpawnAgentRequest):
    api_key = require_env_api_key()

    try:
        _session_record, agent_record = await run_in_threadpool(
            session_mgr.launch_session, api_key, request.config, request.mcp_env
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return record_to_info(agent_record)


@app.get("/api/agents", response_model=List[AgentInfo])
async def list_agents():
    records = await run_in_threadpool(docker_mgr.list_agents)
    return [record_to_info(record) for record in records.values()]


@app.post("/api/agents/launch", response_model=LaunchResponse)
async def launch_agent(request: LaunchRequest):
    api_key = require_env_api_key()

    if not request.config_id and not request.config:
        raise HTTPException(status_code=400, detail="config_id or config is required")

    config = dict(request.config or {})
    if request.config_id:
        config["id"] = request.config_id

    try:
        session_record, agent_record = await run_in_threadpool(
            session_mgr.launch_session, api_key, config, request.mcp_env
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return LaunchResponse(
        session_id=session_record.session_id,
        session_token=session_record.session_token,
        agent_id=agent_record.agent_id,
        config_id=agent_record.config_id,
        status=agent_record.status,
        created_at=session_record.created_at,
    )


@app.get("/api/agents/sessions", response_model=SessionListResponse)
async def list_sessions():
    sessions = session_mgr.list_sessions()
    agents = await run_in_threadpool(docker_mgr.list_agents)
    items: List[SessionInfo] = []
    for session_id, record in sessions.items():
        agent_record = agents.get(record.agent_id)
        status = agent_record.status if agent_record else "missing"
        items.append(
            SessionInfo(
                session_id=session_id,
                agent_id=record.agent_id,
                config_id=record.config_id,
                status=status,
                created_at=record.created_at,
                last_active=record.last_active,
            )
        )
    return SessionListResponse(sessions=items, total=len(items))


@app.get("/api/agents/sessions/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str):
    try:
        record = session_mgr.get_session(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    agents = await run_in_threadpool(docker_mgr.list_agents)
    agent_record = agents.get(record.agent_id)
    status = agent_record.status if agent_record else "missing"
    return SessionInfo(
        session_id=session_id,
        agent_id=record.agent_id,
        config_id=record.config_id,
        status=status,
        created_at=record.created_at,
        last_active=record.last_active,
    )


@app.delete("/api/agents/sessions/{session_id}")
async def stop_session(
    session_id: str,
    authorization: Optional[str] = Header(default=None),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    try:
        session_mgr.get_session(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if not session_mgr.authorize(session_id, x_session_token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    await run_in_threadpool(session_mgr.delete_session, session_id)
    return {"status": "deleted", "session_id": session_id}


@app.post("/api/agents/sessions/{session_id}/stop")
async def stop_session_container(
    session_id: str,
    authorization: Optional[str] = Header(default=None),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    try:
        session_mgr.get_session(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if not session_mgr.authorize(session_id, x_session_token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    await run_in_threadpool(session_mgr.stop_session, session_id)
    return {"status": "stopped", "session_id": session_id}


@app.post("/api/agents/sessions/{session_id}/start")
async def start_session_container(
    session_id: str,
    payload: Optional[ResumeRequest] = Body(default=None),
    authorization: Optional[str] = Header(default=None),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    try:
        session_mgr.get_session(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if not session_mgr.authorize(session_id, x_session_token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    mcp_env = payload.mcp_env if payload else None
    try:
        agent_record = await run_in_threadpool(session_mgr.start_session, session_id, None, mcp_env)
    except KeyError as exc:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=409,
                detail="Agent container missing; ANTHROPIC_API_KEY is required to recreate it",
            ) from exc
        agent_record = await run_in_threadpool(session_mgr.start_session, session_id, api_key, mcp_env)

    return record_to_info(agent_record)


@app.post("/api/agents/sessions/{session_id}/rotate-token")
async def rotate_session_token(
    session_id: str,
    authorization: Optional[str] = Header(default=None),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    try:
        session_mgr.get_session(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if not session_mgr.authorize(session_id, x_session_token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    new_token = await run_in_threadpool(session_mgr.rotate_token, session_id)
    return {"session_id": session_id, "session_token": new_token}


@app.post("/api/agents/sessions/{session_id}/interrupt")
async def interrupt_session(
    session_id: str,
    authorization: Optional[str] = Header(default=None),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    try:
        record = session_mgr.get_session(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if not session_mgr.authorize(session_id, x_session_token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    endpoint = await run_in_threadpool(docker_mgr.get_agent_endpoint, record.agent_id)
    if not endpoint:
        raise HTTPException(status_code=404, detail="agent not found or no endpoint")

    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(f"{endpoint}/interrupt")
        response.raise_for_status()

    session_mgr.touch(session_id)
    return {"status": "interrupted", "session_id": session_id}


@app.post("/api/agents/{agent_id}/stop")
async def stop_agent_container(
    agent_id: str,
    authorization: Optional[str] = Header(default=None),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    session_id = require_session(agent_id)

    if not session_mgr.authorize(session_id, x_session_token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    await run_in_threadpool(session_mgr.stop_session, session_id)
    return {"status": "stopped", "agent_id": agent_id}


@app.post("/api/agents/{agent_id}/start")
async def start_agent_container(
    agent_id: str,
    payload: Optional[ResumeRequest] = Body(default=None),
    authorization: Optional[str] = Header(default=None),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    session_id = require_session(agent_id)

    if not session_mgr.authorize(session_id, x_session_token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    mcp_env = payload.mcp_env if payload else None
    try:
        agent_record = await run_in_threadpool(session_mgr.start_session, session_id, None, mcp_env)
    except KeyError as exc:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=409,
                detail="Agent container missing; ANTHROPIC_API_KEY is required to recreate it",
            ) from exc
        agent_record = await run_in_threadpool(session_mgr.start_session, session_id, api_key, mcp_env)

    return record_to_info(agent_record)


@app.post("/api/agents/{agent_id}/rotate-token")
async def rotate_agent_token(
    agent_id: str,
    authorization: Optional[str] = Header(default=None),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    session_id = require_session(agent_id)

    if not session_mgr.authorize(session_id, x_session_token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    new_token = await run_in_threadpool(session_mgr.rotate_token, session_id)
    return {"session_id": session_id, "session_token": new_token}


@app.patch("/api/agents/{agent_id}/config", response_model=ConfigReloadResponse)
async def reload_agent_config(
    agent_id: str,
    request: ConfigReloadRequest,
    session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
    authorization: Optional[str] = Header(default=None),
):
    session_id = require_session(agent_id)
    if not session_mgr.authorize(session_id, session_token, authorization):
        raise HTTPException(status_code=403, detail="invalid session token")

    agent_record = docker_mgr.get_agent_record(agent_id)
    prior_config = None
    if agent_record and agent_record.config_path.exists():
        try:
            prior_config = json.loads(agent_record.config_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            prior_config = None

    async def start_with_fallback() -> AgentRecord:
        try:
            return await run_in_threadpool(session_mgr.start_session, session_id, None, request.mcp_env)
        except KeyError as exc:
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if not api_key:
                raise HTTPException(
                    status_code=409,
                    detail="Agent container missing; ANTHROPIC_API_KEY is required to recreate it",
                ) from exc
            return await run_in_threadpool(session_mgr.start_session, session_id, api_key, request.mcp_env)

    await run_in_threadpool(session_mgr.stop_session, session_id)
    try:
        await run_in_threadpool(docker_mgr.update_agent_config, agent_id, request.config)
    except Exception as exc:
        if prior_config:
            try:
                await run_in_threadpool(docker_mgr.update_agent_config, agent_id, prior_config)
            except Exception:
                pass
        await start_with_fallback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    record = await start_with_fallback()
    new_token = await run_in_threadpool(session_mgr.rotate_token, session_id)
    return ConfigReloadResponse(
        agent=record_to_info(record),
        session_id=session_id,
        session_token=new_token,
    )


@app.post("/api/agents/chat")
async def agent_chat(
    request: AgentChatRequest,
    authorization: Optional[str] = Header(default=None),
    x_session_id: Optional[str] = Header(default=None, alias="X-Session-ID"),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    session_id = resolve_session_id(request.session_id, x_session_id)
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    try:
        record = session_mgr.get_session(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if not session_mgr.authorize(session_id, x_session_token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    user_message = extract_user_message(request.messages)
    if not user_message:
        raise HTTPException(status_code=400, detail="No user message found")

    endpoint = await run_in_threadpool(docker_mgr.get_agent_endpoint, record.agent_id)
    if not endpoint:
        raise HTTPException(status_code=404, detail="agent not found or no endpoint")

    session_mgr.touch(session_id)
    request_body = {
        "query": user_message,
        "history": [message.model_dump() for message in request.messages],
    }

    async def event_stream():
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{endpoint}/query",
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


@app.delete("/api/agents/{agent_id}")
async def delete_agent(
    agent_id: str,
    authorization: Optional[str] = Header(default=None),
    x_session_token: Optional[str] = Header(default=None, alias="X-Session-Token"),
):
    try:
        session_id = require_session(agent_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if not session_mgr.authorize(session_id, x_session_token, authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    await run_in_threadpool(session_mgr.delete_session, session_id)
    return {"status": "deleted", "agent_id": agent_id}


@app.post("/api/agents/{agent_id}/query")
async def query_agent(agent_id: str, payload: QueryAgentRequest):
    endpoint = await run_in_threadpool(docker_mgr.get_agent_endpoint, agent_id)
    if not endpoint:
        raise HTTPException(status_code=404, detail="agent not found or no endpoint")

    session_id = session_mgr.get_session_for_agent(agent_id)
    if session_id:
        session_mgr.touch(session_id)

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
