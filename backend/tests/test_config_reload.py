from datetime import datetime, timezone
from pathlib import Path
import sys
import types

docker_stub = types.SimpleNamespace(
    from_env=lambda: None,
    errors=types.SimpleNamespace(NotFound=Exception),
)
sys.modules.setdefault("docker", docker_stub)
sys.modules.setdefault("docker.errors", types.SimpleNamespace(NotFound=Exception))

from app.docker_mgr import AgentRecord, DockerManager


def test_update_config_updates_record(tmp_path):
    docker_mgr = DockerManager(state_dir=tmp_path)
    agent_id = "agent-test"
    config_dir = tmp_path / agent_id
    config_dir.mkdir(parents=True, exist_ok=True)
    config_path = config_dir / "agent-config.json"
    config_path.write_text("{}", encoding="utf-8")

    record = AgentRecord(
        agent_id=agent_id,
        config_id="demo",
        container_id="container",
        container_name="agentdeck-agent-test",
        status="running",
        created_at=datetime.now(timezone.utc),
        config_path=config_path,
        workspace_volume="agentdeck-workspace-agent-test",
    )
    docker_mgr.agents[agent_id] = record

    new_config = {"id": "demo", "name": "Updated", "allowed_tools": ["Read"]}
    docker_mgr.update_agent_config(agent_id, new_config)

    updated = docker_mgr.agents[agent_id]
    assert updated.config_id == "demo"
    assert Path(updated.config_path).read_text(encoding="utf-8").find("Updated") != -1
