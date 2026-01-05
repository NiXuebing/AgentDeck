from datetime import datetime, timezone
from pathlib import Path
import sys
import types

import pytest
from fastapi import HTTPException

docker_stub = types.SimpleNamespace(
    from_env=lambda: None,
    errors=types.SimpleNamespace(NotFound=Exception),
)
sys.modules.setdefault("docker", docker_stub)
sys.modules.setdefault("docker.errors", types.SimpleNamespace(NotFound=Exception))

from app import main
from app.docker_mgr import AgentRecord


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_reload_restarts_on_update_failure(monkeypatch, tmp_path):
    config_path = tmp_path / "agent-config.json"
    config_path.write_text("{}", encoding="utf-8")
    record = AgentRecord(
        agent_id="agent-1",
        config_id="demo",
        container_id="container",
        container_name="agentdeck-agent-1",
        status="running",
        created_at=datetime.now(timezone.utc),
        config_path=Path(config_path),
        workspace_volume="agentdeck-workspace-agent-1",
    )

    class DummyDockerMgr:
        def __init__(self):
            self.record = record
            self.update_calls = 0

        def update_agent_config(self, agent_id, config):
            self.update_calls += 1
            raise ValueError("bad config")

        def get_agent_record(self, agent_id):
            return self.record

    class DummySessionMgr:
        def __init__(self):
            self.start_calls = 0
            self.stop_calls = 0

        def get_session_for_agent(self, agent_id):
            return "session-1"

        def authorize(self, session_id, session_token, authorization):
            return True

        def stop_session(self, session_id):
            self.stop_calls += 1

        def start_session(self, session_id, api_key, mcp_env):
            self.start_calls += 1
            return record

        def rotate_token(self, session_id):
            return "token-2"

    async def fake_threadpool(func, *args, **kwargs):
        return func(*args, **kwargs)

    dummy_docker = DummyDockerMgr()
    dummy_sessions = DummySessionMgr()

    monkeypatch.setattr(main, "docker_mgr", dummy_docker)
    monkeypatch.setattr(main, "session_mgr", dummy_sessions)
    monkeypatch.setattr(main, "run_in_threadpool", fake_threadpool)

    with pytest.raises(HTTPException):
        await main.reload_agent_config(
            agent_id="agent-1",
            request=main.ConfigReloadRequest(config={"id": "demo"}),
            session_token="token-1",
            authorization=None,
        )

    assert dummy_sessions.start_calls >= 1
