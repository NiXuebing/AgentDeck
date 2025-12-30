from __future__ import annotations

import json
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import docker
from docker.errors import NotFound


RESERVED_ENV_KEYS = {
    "ANTHROPIC_API_KEY",
    "AGENT_CONFIG_JSON",
    "AGENT_ID",
    "SESSION_ID",
    "CONVERSATION_ID",
    "CONFIG_PATH",
}

PASSTHROUGH_ENV_KEYS = {
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_MODEL",
}


@dataclass
class AgentRecord:
    agent_id: str
    config_id: str
    container_id: str
    container_name: str
    status: str
    created_at: datetime
    config_path: Path
    workspace_volume: str
    host_port: Optional[int] = None


class DockerManager:
    def __init__(self, image_name: str = "agent-deck-worker:latest", state_dir: Optional[Path] = None):
        self.image_name = image_name
        self.state_dir = Path(state_dir or Path(__file__).resolve().parent.parent / "runtime_state")
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.client = docker.from_env()
        self.logger = logging.getLogger(__name__)
        self.agents: Dict[str, AgentRecord] = {}

    def _normalize_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        normalized = dict(config)
        allowed_tools = normalized.get("allowed_tools")
        if allowed_tools is None:
            allowed_tools = []
        if not isinstance(allowed_tools, list):
            raise ValueError("allowed_tools must be a list when provided")

        mcp_servers = normalized.get("mcp_servers") or {}
        if mcp_servers:
            base_tools = ["ListMcpResources", "ReadMcpResource"]
            for tool in base_tools:
                if tool not in allowed_tools:
                    allowed_tools.append(tool)
            for server_name in mcp_servers.keys():
                wildcard_tool = f"mcp__{server_name}__*"
                if wildcard_tool not in allowed_tools:
                    allowed_tools.append(wildcard_tool)

        if allowed_tools:
            normalized["allowed_tools"] = allowed_tools

        return normalized

    def _write_config(self, agent_id: str, config: Dict[str, Any]) -> Path:
        agent_dir = self.state_dir / agent_id
        agent_dir.mkdir(parents=True, exist_ok=True)
        config_path = agent_dir / "agent-config.json"
        with config_path.open("w", encoding="utf-8") as handle:
            json.dump(config, handle, indent=2)
        return config_path

    def _build_env(
        self, agent_id: str, api_key: str, mcp_env: Optional[Dict[str, Dict[str, str]]]
    ) -> Dict[str, str]:
        env: Dict[str, str] = {
            "AGENT_ID": agent_id,
            "ANTHROPIC_API_KEY": api_key,
            "CONFIG_PATH": "/config/agent-config.json",
        }

        for key in PASSTHROUGH_ENV_KEYS:
            value = os.environ.get(key)
            if value and key not in env:
                env[key] = value

        if mcp_env:
            for server_name, server_env in mcp_env.items():
                if not isinstance(server_env, dict):
                    raise ValueError(f"mcp_env for {server_name} must be an object")
                for key, value in server_env.items():
                    if key in RESERVED_ENV_KEYS:
                        raise ValueError(f"mcp_env key '{key}' is reserved")
                    env[key] = value

        return env

    def spawn_agent(
        self, api_key: str, config: Optional[Dict[str, Any]] = None, mcp_env: Optional[Dict[str, Dict[str, str]]] = None
    ) -> AgentRecord:
        if not api_key:
            raise ValueError("api_key is required")

        raw_config = dict(config or {})
        config_id = raw_config.get("id")
        agent_id = f"agent-{uuid.uuid4().hex[:12]}"

        if not config_id:
            config_id = agent_id
            raw_config["id"] = config_id

        raw_config.setdefault("name", f"Agent {agent_id}")
        raw_config.setdefault("permission_mode", "acceptEdits")

        normalized_config = self._normalize_config(raw_config)
        config_path = self._write_config(agent_id, normalized_config)
        workspace_volume = f"agentdeck-workspace-{agent_id}"

        env = self._build_env(agent_id, api_key, mcp_env)

        container = self.client.containers.run(
            image=self.image_name,
            name=f"agentdeck-{agent_id}",
            detach=True,
            environment=env,
            volumes={
                str(config_path.resolve()): {"bind": "/config/agent-config.json", "mode": "ro"},
                workspace_volume: {"bind": "/workspace", "mode": "rw"},
            },
            ports={"3000/tcp": None},
            labels={
                "agentdeck": "true",
                "agentdeck.agent_id": agent_id,
                "agentdeck.config_id": config_id,
            },
        )

        container.reload()
        host_port = None
        try:
            ports = container.attrs.get("NetworkSettings", {}).get("Ports", {})
            bindings = ports.get("3000/tcp")
            if bindings and isinstance(bindings, list):
                host_port = int(bindings[0].get("HostPort"))
        except Exception:
            self.logger.debug("Failed to resolve host port for agent %s", agent_id)

        record = AgentRecord(
            agent_id=agent_id,
            config_id=config_id,
            container_id=container.id,
            container_name=container.name,
            status=container.status,
            created_at=datetime.now(timezone.utc),
            config_path=config_path,
            workspace_volume=workspace_volume,
            host_port=host_port,
        )

        self.agents[agent_id] = record
        return record

    def list_agents(self, refresh: bool = True) -> Dict[str, AgentRecord]:
        if not refresh:
            return dict(self.agents)

        for agent_id, record in list(self.agents.items()):
            try:
                container = self.client.containers.get(record.container_id)
                container.reload()
                record.status = container.status
            except NotFound:
                record.status = "missing"

        return dict(self.agents)

    def get_container(self, agent_id: str):
        record = self.agents.get(agent_id)
        if not record:
            return None
        try:
            return self.client.containers.get(record.container_id)
        except NotFound:
            return None

    def get_agent_endpoint(self, agent_id: str) -> Optional[str]:
        record = self.agents.get(agent_id)
        if not record:
            return None

        if record.host_port is None:
            try:
                container = self.client.containers.get(record.container_id)
                container.reload()
                ports = container.attrs.get("NetworkSettings", {}).get("Ports", {})
                bindings = ports.get("3000/tcp")
                if bindings and isinstance(bindings, list):
                    record.host_port = int(bindings[0].get("HostPort"))
            except NotFound:
                return None
            except Exception:
                self.logger.debug("Failed to refresh host port for agent %s", agent_id)

        if not record.host_port:
            return None

        return f"http://localhost:{record.host_port}"

    def stop_agent(self, agent_id: str, cleanup: bool = True) -> None:
        record = self.agents.get(agent_id)
        if not record:
            raise KeyError(f"Unknown agent: {agent_id}")

        try:
            container = self.client.containers.get(record.container_id)
            container.stop(timeout=10)
            container.remove()
        except NotFound:
            pass

        if cleanup:
            try:
                volume = self.client.volumes.get(record.workspace_volume)
                volume.remove(force=True)
            except NotFound:
                pass

            if record.config_path.exists():
                record.config_path.unlink()
            if record.config_path.parent.exists():
                try:
                    record.config_path.parent.rmdir()
                except OSError:
                    pass

        self.agents.pop(agent_id, None)
