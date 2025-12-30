from __future__ import annotations

import hashlib
import logging
import secrets
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
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
    def __init__(self, docker_mgr: DockerManager, idle_minutes: int = 60):
        self.docker_mgr = docker_mgr
        self.idle_timeout = timedelta(minutes=max(idle_minutes, 0))
        self._lock = threading.Lock()
        self._sessions: Dict[str, SessionRecord] = {}
        self._agent_index: Dict[str, str] = {}
        self.logger = logging.getLogger(__name__)

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

    def cleanup_session(self, session_id: str) -> None:
        try:
            record = self.get_session(session_id)
        except KeyError:
            return

        try:
            self.docker_mgr.stop_agent(record.agent_id, True)
        except Exception as exc:
            self.logger.debug("Failed to stop agent for session %s: %s", session_id, exc)
        finally:
            with self._lock:
                self._sessions.pop(session_id, None)
                self._agent_index.pop(record.agent_id, None)

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
