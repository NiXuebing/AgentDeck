# AgentDeck

AgentDeck is a lightweight control plane that wraps the AgCluster container runtime with a FastAPI backend and a React dashboard. It spins up Claude agent containers using the upstream `agcluster-container` runtime and streams logs back to the UI.

## Stack

- Backend: FastAPI + Docker SDK
- Frontend: React + Vite + Tailwind + xterm.js
- Runtime: Docker image derived from `whiteboardmonk/agcluster-container`

## Layout

```
/agent-deck
├── /agcluster-source          # upstream repo (cloned locally)
├── /backend
│   ├── /app                   # FastAPI API + Docker manager
│   ├── /runtime_base          # worker image sources (Dockerfile + agent server)
│   └── requirements.txt
├── /frontend                  # Vite React UI
└── README.md
```

## Prerequisites

- Docker Desktop running locally
- Python 3.10+ (backend)
- Node.js 20.19+ recommended (Vite warns on earlier 20.x)

## Setup

### 1) Clone the AgCluster base

```bash
git clone https://github.com/whiteboardmonk/agcluster-container agcluster-source
```

### 2) Build the worker image

```bash
docker build -t agent-deck-worker:latest ./backend/runtime_base
```

### 3) Backend

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
backend/.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

Set `ANTHROPIC_API_KEY` in your shell (or `.env`), or pass `api_key` per request.

To use a custom Anthropic-compatible endpoint, copy `.env.example` to `.env` and update the `ANTHROPIC_*` values. The backend will load `.env` and pass the supported keys into each container.

### 4) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

`.env` uses `VITE_API_BASE=http://localhost:8000` by default.

## API

- `GET /health`
- `GET /api/agents`
- `POST /api/agents`
- `DELETE /api/agents/{agent_id}`
- `WS /ws/agents/{agent_id}/logs`

### Create an agent

```bash
curl -X POST http://localhost:8000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "sk-ant-...",
    "config": {
      "id": "code-assistant",
      "name": "Code Assistant",
      "allowed_tools": ["Read", "Write", "Bash"],
      "permission_mode": "acceptEdits",
      "max_turns": 40
    }
  }'
```

### Stop an agent

```bash
curl -X DELETE http://localhost:8000/api/agents/{agent_id}
```

## Notes

- Agent config is serialized to `agent-config.json` and mounted at `/config/agent-config.json` inside the container.
- MCP credentials should be supplied in the `mcp_env` object; the backend prevents reserved env overrides.
- The worker image uses `backend/runtime_base/container/agent_server.py` and `backend/runtime_base/container/requirements.txt`.
- Env passthrough to containers: `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_DEFAULT_*`, `ANTHROPIC_MODEL`.
