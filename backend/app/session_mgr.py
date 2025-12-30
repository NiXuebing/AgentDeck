from __future__ import annotations

import hashlib
import json
import logging
import secrets
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from .docker_mgr import AgentRecord, DockerManager


def _hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


@dataclass
class SessionRecord:
    session_id: str
    session_token: str
    agent_id: str
    config_id: str
    created_at: datetime
    last_active: datetime
    api_key_hash: str


class SessionManager:
    def __init__(
        self,
        docker_mgr: DockerManager,
        idle_minutes: int = 60,
        state_file: Optional[Path] = None,
    ):
        self.docker_mgr = docker_mgr
        self.idle_timeout = timedelta(minutes=max(idle_minutes, 0))
        self._lock = threading.Lock()
        self._state_lock = threading.Lock()
        self._sessions: Dict[str, SessionRecord] = {}
        self._agent_index: Dict[str, str] = {}
        self.logger = logging.getLogger(__name__)
        self.state_file = Path(state_file or self.docker_mgr.state_dir / "registry.json")
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self._load_state()

    def _load_state(self) -> None:
        if not self.state_file.exists():
            return

        try:
            payload = json.loads(self.state_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            self.logger.warning("Failed to load registry state: %s", exc)
            return

        agents_payload = payload.get("agents", {})
        restored_agents: Dict[str, AgentRecord] = {}
        for agent_id, data in agents_payload.items():
            try:
                restored_agents[agent_id] = self._agent_from_dict(data)
            except Exception as exc:
                self.logger.warning("Skipping agent %s from registry: %s", agent_id, exc)

        if restored_agents:
            self.docker_mgr.restore_agents(restored_agents)

        sessions_payload = payload.get("sessions", {})
        for session_id, data in sessions_payload.items():
            try:
                record = self._session_from_dict(data)
            except Exception as exc:
                self.logger.warning("Skipping session %s from registry: %s", session_id, exc)
                continue

            self._sessions[session_id] = record
            self._agent_index[record.agent_id] = session_id
            agent_record = self.docker_mgr.agents.get(record.agent_id)
            if agent_record and not agent_record.session_id:
                agent_record.session_id = session_id

    def _persist_state(self) -> None:
        with self._lock:
            sessions_snapshot = dict(self._sessions)

        agents_snapshot = dict(self.docker_mgr.list_agents(refresh=False))

        data = {
            "agents": {agent_id: self._agent_to_dict(record) for agent_id, record in agents_snapshot.items()},
            "sessions": {
                session_id: self._session_to_dict(record) for session_id, record in sessions_snapshot.items()
            },
        }

        tmp_path = self.state_file.with_suffix(".tmp")
        with self._state_lock:
            tmp_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
            tmp_path.replace(self.state_file)

    def _agent_to_dict(self, record: AgentRecord) -> Dict[str, Any]:
        return {
            "agent_id": record.agent_id,
            "config_id": record.config_id,
            "container_id": record.container_id,
            "container_name": record.container_name,
            "status": record.status,
            "created_at": record.created_at.isoformat(),
            "config_path": str(record.config_path),
            "workspace_volume": record.workspace_volume,
            "session_id": record.session_id,
            "host_port": record.host_port,
        }

    def _agent_from_dict(self, data: Dict[str, Any]) -> AgentRecord:
        created_at = self._parse_datetime(data.get("created_at"))
        return AgentRecord(
            agent_id=data["agent_id"],
            config_id=data.get("config_id") or data["agent_id"],
            container_id=data["container_id"],
            container_name=data.get("container_name", f"agentdeck-{data['agent_id']}"),
            status=data.get("status", "unknown"),
            created_at=created_at,
            config_path=Path(data["config_path"]),
            workspace_volume=data["workspace_volume"],
            session_id=data.get("session_id"),
            host_port=data.get("host_port"),
        )

    def _session_to_dict(self, record: SessionRecord) -> Dict[str, Any]:
        return {
            "session_id": record.session_id,
            "session_token": record.session_token,
            "agent_id": record.agent_id,
            "config_id": record.config_id,
            "created_at": record.created_at.isoformat(),
            "last_active": record.last_active.isoformat(),
            "api_key_hash": record.api_key_hash,
        }

    def _session_from_dict(self, data: Dict[str, Any]) -> SessionRecord:
        return SessionRecord(
            session_id=data["session_id"],
            session_token=data["session_token"],
            agent_id=data["agent_id"],
            config_id=data.get("config_id") or data["agent_id"],
            created_at=self._parse_datetime(data.get("created_at")),
            last_active=self._parse_datetime(data.get("last_active")),
            api_key_hash=data["api_key_hash"],
        )

    def _parse_datetime(self, value: Optional[str]) -> datetime:
        if not value:
            return datetime.now(timezone.utc)
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return datetime.now(timezone.utc)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed

    def launch_session(
        self,
        api_key: str,
        config: Optional[Dict[str, Any]] = None,
        mcp_env: Optional[Dict[str, Dict[str, str]]] = None,
    ) -> Tuple[SessionRecord, AgentRecord]:
        session_id = uuid.uuid4().hex
        session_token = secrets.token_urlsafe(24)
        agent_record = self.docker_mgr.spawn_agent(
            api_key,
            config,
            mcp_env,
            session_id=session_id,
        )
        now = datetime.now(timezone.utc)
        record = SessionRecord(
            session_id=session_id,
            session_token=session_token,
            agent_id=agent_record.agent_id,
            config_id=agent_record.config_id,
            created_at=now,
            last_active=now,
            api_key_hash=_hash_api_key(api_key),
        )
        with self._lock:
            self._sessions[session_id] = record
            self._agent_index[agent_record.agent_id] = session_id
        self._persist_state()
        return record, agent_record

    def list_sessions(self) -> Dict[str, SessionRecord]:
        with self._lock:
            return dict(self._sessions)

    def get_session(self, session_id: str) -> SessionRecord:
        with self._lock:
            record = self._sessions.get(session_id)
            if record is None:
                raise KeyError(f"Unknown session: {session_id}")
            return record

    def get_session_for_agent(self, agent_id: str) -> Optional[str]:
        with self._lock:
            return self._agent_index.get(agent_id)

    def touch(self, session_id: str) -> None:
        with self._lock:
            record = self._sessions.get(session_id)
            if record:
                record.last_active = datetime.now(timezone.utc)
        self._persist_state()

    def authorize(
        self,
        session_id: str,
        session_token: Optional[str],
        authorization: Optional[str],
    ) -> bool:
        record = self.get_session(session_id)
        if session_token and secrets.compare_digest(session_token, record.session_token):
            return True

        if authorization:
            parts = authorization.split(" ", 1)
            if len(parts) == 2 and parts[0].lower() == "bearer":
                candidate_hash = _hash_api_key(parts[1].strip())
                return secrets.compare_digest(candidate_hash, record.api_key_hash)

        return False

    def stop_session(self, session_id: str) -> None:
        try:
            record = self.get_session(session_id)
        except KeyError:
            return

        try:
            self.docker_mgr.stop_agent(record.agent_id)
        except Exception as exc:
            self.logger.debug("Failed to stop agent for session %s: %s", session_id, exc)
        finally:
            self._persist_state()

    def start_session(
        self,
        session_id: str,
        api_key: Optional[str] = None,
        mcp_env: Optional[Dict[str, Dict[str, str]]] = None,
    ) -> AgentRecord:
        record = self.get_session(session_id)
        agent_record, recreated = self.docker_mgr.start_agent(
            record.agent_id,
            api_key=api_key,
            mcp_env=mcp_env,
            session_id=session_id,
        )
        if recreated and api_key:
            with self._lock:
                session_record = self._sessions.get(session_id)
                if session_record:
                    session_record.api_key_hash = _hash_api_key(api_key)
        self.touch(session_id)
        return agent_record

    def delete_session(self, session_id: str) -> None:
        try:
            record = self.get_session(session_id)
        except KeyError:
            return

        try:
            self.docker_mgr.delete_agent(record.agent_id)
        except Exception as exc:
            self.logger.debug("Failed to stop agent for session %s: %s", session_id, exc)
        finally:
            with self._lock:
                self._sessions.pop(session_id, None)
                self._agent_index.pop(record.agent_id, None)
            self._persist_state()

    def get_idle_sessions(self) -> list[str]:
        if self.idle_timeout.total_seconds() <= 0:
            return []

        cutoff = datetime.now(timezone.utc) - self.idle_timeout
        with self._lock:
            return [
                session_id
                for session_id, record in self._sessions.items()
                if record.last_active < cutoff
            ]

    def rotate_token(self, session_id: str) -> str:
        with self._lock:
            record = self._sessions.get(session_id)
            if record is None:
                raise KeyError(f"Unknown session: {session_id}")
            record.session_token = secrets.token_urlsafe(24)
            new_token = record.session_token
        self._persist_state()
        return new_token
