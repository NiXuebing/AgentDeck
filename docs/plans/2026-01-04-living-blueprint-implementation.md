# Living Blueprint Workbench Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Create/Run split with a unified Workbench that supports Blueprint + Stage workflows, live config reloads, meta-builder bootstrapping, and tool-evolution suggestions.

**Architecture:** Introduce a new Workbench view that owns a small state machine (DRAFT -> LAUNCHING -> RUNNING -> RELOADING). Backend adds blueprint preview generation and config reload endpoints that stop/update/restart containers while preserving session identity. UI binds left-panel config to agent runtime and stages system/meta messages in the chat stream.

**Tech Stack:** React + Vite + Tailwind; FastAPI + Docker SDK; Anthropic Messages API via `httpx`.

---

### Task 1: Archive completed plans

**Files:**
- Create: `docs/plans/archive/.gitkeep`
- Move: `docs/plans/2026-01-04-create-run-view-implementation.md` -> `docs/plans/archive/2026-01-04-create-run-view-implementation.md`
- Move: `docs/plans/2026-01-04-agent-creation-ux-redesign.md` -> `docs/plans/archive/2026-01-04-agent-creation-ux-redesign.md`
- Move: `docs/plans/2025-01-01-agent-customization-implementation.md` -> `docs/plans/archive/2025-01-01-agent-customization-implementation.md`
- Modify (if referenced): `README.md`

**Step 1: Create archive folder + placeholder**

```bash
mkdir -p docs/plans/archive
printf '%s\n' "(archived plans)" > docs/plans/archive/.gitkeep
```

**Step 2: Move completed plans**

```bash
mv docs/plans/2026-01-04-create-run-view-implementation.md docs/plans/archive/
mv docs/plans/2026-01-04-agent-creation-ux-redesign.md docs/plans/archive/
mv docs/plans/2025-01-01-agent-customization-implementation.md docs/plans/archive/
```

**Step 3: Update references if needed**

Run: `rg "create-run-view-implementation|agent-creation-ux-redesign|agent-customization-implementation" -n`
Expected: no remaining references, or update `README.md` links if found.

**Step 4: Commit**

```bash
git add docs/plans README.md
git commit -m "docs: archive completed plans"
```

---

### Task 2: Add blueprint preview generator service (backend)

**Files:**
- Create: `backend/app/blueprint_generator.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_blueprint_generator.py`
- Modify: `backend/requirements.txt`

**Step 1: Write the failing test**

```python
# backend/tests/test_blueprint_generator.py
import json
import pytest
from app.blueprint_generator import BlueprintGenerator


def test_blueprint_generator_parses_json_text():
    generator = BlueprintGenerator()
    payload = json.dumps({
        "config": {
            "id": "hn-digest",
            "name": "HN Digest",
            "system_prompt": "You are a tech editor",
            "allowed_tools": ["WebSearch", "WebFetch"],
        }
    })
    result = generator._parse_json_text(payload)
    assert result["config"]["id"] == "hn-digest"
    assert "WebSearch" in result["config"]["allowed_tools"]
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_blueprint_generator.py -v`
Expected: FAIL with `ModuleNotFoundError` or missing class.

**Step 3: Write minimal implementation**

```python
# backend/app/blueprint_generator.py
import json
import os
from typing import Any, Dict, Optional

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    TextBlock,
    query,
)


class BlueprintGenerator:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.options = ClaudeAgentOptions(
            allowed_tools=[],
            permission_mode="plan",
        )

    def _parse_json_text(self, text: str) -> Dict[str, Any]:
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError("No JSON content in response") from exc

    async def generate(self, prompt: str) -> Dict[str, Any]:
        system_prompt = (
            "You are an architect that outputs JSON only. "
            "Return {\"config\": {...}} with id, name, system_prompt, allowed_tools, "
            "optional skills/agents/commands. No markdown."
        )
        full_prompt = f"{system_prompt}\n\n{prompt}"

        prior_key = None
        if self.api_key:
            prior_key = os.environ.get("ANTHROPIC_API_KEY")
            os.environ["ANTHROPIC_API_KEY"] = self.api_key

        try:
            chunks = []
            async for message in query(prompt=full_prompt, options=self.options):
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            chunks.append(block.text)
        finally:
            if self.api_key:
                if prior_key is None:
                    os.environ.pop("ANTHROPIC_API_KEY", None)
                else:
                    os.environ["ANTHROPIC_API_KEY"] = prior_key

        return self._parse_json_text("".join(chunks))
```


Also update `backend/requirements.txt`:

```
claude-agent-sdk
```

If the API key is missing, return a 400 with a clear message and have the frontend show a one-time key prompt before retrying with `X-Api-Key`.

**Step 4: Wire endpoint in FastAPI**

```python
# backend/app/main.py
class BlueprintRequest(BaseModel):
    prompt: str


class BlueprintResponse(BaseModel):
    config: Dict[str, Any]


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
```

**Step 5: Run tests**

Run: `pytest backend/tests/test_blueprint_generator.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/blueprint_generator.py backend/app/main.py backend/tests/test_blueprint_generator.py backend/requirements.txt
git commit -m "feat(api): add blueprint preview generator"
```

---

### Task 3: Add config reload endpoint (backend)

**Files:**
- Modify: `backend/app/docker_mgr.py`
- Modify: `backend/app/session_mgr.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_config_reload.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_config_reload.py
from app.session_mgr import SessionManager
from app.docker_mgr import DockerManager


def test_update_config_updates_record(tmp_path):
    docker_mgr = DockerManager(state_dir=tmp_path)
    session_mgr = SessionManager(docker_mgr, state_file=tmp_path / "registry.json")

    # seed a fake agent record
    record = docker_mgr.spawn_agent(api_key="test", config={"id": "demo"})
    session, _ = session_mgr.launch_session(api_key="test", config={"id": "demo"})

    new_config = {"id": "demo", "name": "Updated", "allowed_tools": ["Read"]}
    docker_mgr.update_agent_config(record.agent_id, new_config)

    updated = docker_mgr.agents[record.agent_id]
    assert updated.config_id == "demo"
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_config_reload.py -v`
Expected: FAIL with missing `update_agent_config`.

**Step 3: Implement config update + restart flow**

```python
# backend/app/docker_mgr.py
    def update_agent_config(self, agent_id: str, config: Dict[str, Any]) -> AgentRecord:
        with self._lock:
            record = self.agents.get(agent_id)
        if not record:
            raise KeyError(f"Unknown agent: {agent_id}")

        normalized = self._normalize_config(config)
        record.config_id = normalized.get("id", record.config_id)
        record.config_path = self._write_config(agent_id, normalized)

        agents_config = normalized.get("agents")
        skills_config = normalized.get("skills")
        commands_config = normalized.get("commands")
        if agents_config or skills_config or commands_config:
            agent_dir = self.state_dir / agent_id
            generate_claude_directory(
                base_path=agent_dir,
                config=normalized,
                agents=agents_config,
                skills=skills_config,
                commands=commands_config,
            )
        return record
```

```python
# backend/app/main.py
class ConfigReloadRequest(BaseModel):
    config: Dict[str, Any]
    mcp_env: Optional[Dict[str, Dict[str, str]]] = None


class ConfigReloadResponse(BaseModel):
    agent: AgentInfo
    session_id: str
    session_token: str


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

    await run_in_threadpool(session_mgr.stop_session, session_id)
    await run_in_threadpool(docker_mgr.update_agent_config, agent_id, request.config)
    record = await run_in_threadpool(session_mgr.start_session, session_id, None, request.mcp_env)
    new_token = await run_in_threadpool(session_mgr.rotate_token, session_id)
    return ConfigReloadResponse(
        agent=record_to_info(record),
        session_id=session_id,
        session_token=new_token,
    )
```

Front-end must update its session store with the returned `session_id` and `session_token` before resuming polling or sending chat messages.




**Step 4: Run tests**

Run: `pytest backend/tests/test_config_reload.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/docker_mgr.py backend/app/main.py backend/tests/test_config_reload.py
 git commit -m "feat(api): add config reload endpoint"
```

---

### Task 4: Extract Workbench controller (frontend)

**Files:**
- Create: `frontend/src/hooks/useWorkbenchController.js`
- Create: `frontend/src/context/WorkbenchContext.jsx`
- Modify: `frontend/src/App.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-controller.test.jsx
import { renderHook } from '@testing-library/react'
import { useWorkbenchController } from '../hooks/useWorkbenchController'

it('initializes workbench state machine in DRAFT', () => {
  const { result } = renderHook(() => useWorkbenchController())
  expect(result.current.state).toBe('DRAFT')
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-controller.test.jsx`
Expected: FAIL (hook not found).

**Step 3: Write minimal implementation**

```jsx
// frontend/src/hooks/useWorkbenchController.js
import { useCallback, useMemo, useState } from 'react'

export const WORKBENCH_STATES = {
  DRAFT: 'DRAFT',
  LAUNCHING: 'LAUNCHING',
  RUNNING: 'RUNNING',
  RELOADING: 'RELOADING',
}

export function useWorkbenchController() {
  const [state, setState] = useState(WORKBENCH_STATES.DRAFT)
  const value = useMemo(() => ({ state, setState }), [state])
  return value
}
```

```jsx
// frontend/src/context/WorkbenchContext.jsx
import { createContext, useContext } from 'react'

export const WorkbenchContext = createContext(null)

export function useWorkbench() {
  const ctx = useContext(WorkbenchContext)
  if (!ctx) {
    throw new Error('useWorkbench must be used within WorkbenchContext.Provider')
  }
  return ctx
}
```

**Step 4: Wire into App.jsx**

Wrap the Workbench view with `WorkbenchContext.Provider` and remove direct Workbench state in `App.jsx`.

**Step 5: Run tests**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-controller.test.jsx`
Expected: PASS

**Step 6: Commit**

```bash
git add frontend/src/hooks/useWorkbenchController.js frontend/src/context/WorkbenchContext.jsx frontend/src/App.jsx frontend/src/__tests__/workbench-controller.test.jsx
git commit -m "feat(ui): extract workbench controller hook"
```

---

### Task 5: Build Workbench skeleton + state machine (frontend)

**Files:**
- Create: `frontend/src/components/views/WorkbenchView.jsx`
- Create: `frontend/src/components/workbench/BlueprintPanel.jsx`
- Create: `frontend/src/components/workbench/StagePanel.jsx`
- Modify: `frontend/src/App.jsx`
- Test: `frontend/src/__tests__/workbench.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('renders the Workbench split layout', () => {
  render(<App />)
  expect(screen.getByText(/Blueprint/i)).toBeInTheDocument()
  expect(screen.getByText(/Stage/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench.test.jsx`
Expected: FAIL because labels not present.

**Step 3: Implement Workbench view**

```jsx
// frontend/src/components/views/WorkbenchView.jsx
export default function WorkbenchView({
  blueprint,
  stage,
  state,
  onApply,
  onLaunch,
  onReload,
}) {
  return (
    <section className="workbench grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="panel blueprint">{blueprint}</div>
      <div className="panel stage">{stage}</div>
    </section>
  )
}
```

```jsx
// frontend/src/App.jsx (replace Create/Run view switch)
<main className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
  <aside>...</aside>
  <WorkbenchView
    blueprint={<BlueprintPanel ... />}
    stage={<StagePanel ... />}
    state={workbenchState}
    onApply={handleApplyConfig}
    onLaunch={handleLaunch}
    onReload={handleReload}
  />
</main>
```

**Step 4: Run tests**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/views/WorkbenchView.jsx frontend/src/components/workbench frontend/src/__tests__/workbench.test.jsx
git commit -m "feat(ui): add workbench layout skeleton"
```

---

### Task 6: Blueprint panel wiring (frontend)

**Files:**
- Modify: `frontend/src/components/workbench/BlueprintPanel.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/tabs/*.jsx`
- Test: `frontend/src/__tests__/workbench-blueprint.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-blueprint.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('shows prompt editor with unsaved indicator', () => {
  render(<App />)
  expect(screen.getByLabelText(/System Prompt/i)).toBeInTheDocument()
  expect(screen.getByText(/Unsaved/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-blueprint.test.jsx`
Expected: FAIL because prompt editor/indicator not yet wired.

**Step 3: Implement BlueprintPanel using existing tabs**

```jsx
// frontend/src/components/workbench/BlueprintPanel.jsx
export function BlueprintPanel({
  form,
  onChangeForm,
  activeTab,
  onChangeTab,
  subAgents,
  skills,
  commands,
  onAddSubAgent,
  onEditSubAgent,
  onDeleteSubAgent,
  onChangeSkills,
  onChangeCommands,
  onApply,
  hasDraftChanges,
}) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Blueprint</h2>
          <p className="text-xs text-neutral-500">Drafting the agent configuration.</p>
        </div>
        <button onClick={onApply} className="btn-primary">Apply</button>
      </header>
      <div className="prompt-editor">
        <label className="text-xs font-semibold" htmlFor="systemPrompt">System Prompt</label>
        {hasDraftChanges ? <span className="text-xs text-amber-600">Unsaved</span> : null}
        <textarea
          id="systemPrompt"
          value={form.systemPrompt}
          onChange={(event) => onChangeForm({ ...form, systemPrompt: event.target.value, useCustomPrompt: true })}
        />
      </div>
      {/* tabs block reusing ProfileTab/ToolboxTab/etc */}
    </div>
  )
}
```

**Step 4: Run tests**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-blueprint.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/workbench/BlueprintPanel.jsx frontend/src/App.jsx frontend/src/components/tabs frontend/src/__tests__/workbench-blueprint.test.jsx
git commit -m "feat(ui): wire blueprint panel"
```

---

### Task 7: Stage panel, chat stream, and log drawer (frontend)

**Files:**
- Modify: `frontend/src/components/workbench/StagePanel.jsx`
- Modify: `frontend/src/components/views/RunView.jsx` (extract log drawer if needed)
- Modify: `frontend/src/App.jsx`
- Test: `frontend/src/__tests__/workbench-stage.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-stage.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('shows chat input and live logs toggle', () => {
  render(<App />)
  expect(screen.getByPlaceholderText(/Message/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Logs/i })).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-stage.test.jsx`
Expected: FAIL.

**Step 3: Implement StagePanel**

```jsx
// frontend/src/components/workbench/StagePanel.jsx
export function StagePanel({
  messages,
  onSend,
  input,
  onInput,
  logsOpen,
  onToggleLogs,
  renderLogs,
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="section-title">Stage</h2>
        <button className="btn-ghost" onClick={onToggleLogs}>Logs</button>
      </header>
      <div className="chat-stream">{messages}</div>
      <div className="chat-input">
        <input
          placeholder="Message"
          value={input}
          onChange={(event) => onInput(event.target.value)}
        />
        <button onClick={onSend}>Send</button>
      </div>
      {logsOpen ? <div className="log-drawer">{renderLogs()}</div> : null}
    </div>
  )
}
```

**Step 4: Run tests**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-stage.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/workbench/StagePanel.jsx frontend/src/components/views/RunView.jsx frontend/src/App.jsx frontend/src/__tests__/workbench-stage.test.jsx
git commit -m "feat(ui): add stage panel chat + logs"
```

---

### Task 8: Meta-Builder (Genesis) flow

**Files:**
- Modify: `frontend/src/hooks/useWorkbenchController.js`
- Modify: `frontend/src/components/workbench/StagePanel.jsx`
- Modify: `backend/app/main.py`
- Test: `frontend/src/__tests__/workbench-genesis.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-genesis.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('shows architect prompt when no agent is selected', () => {
  render(<App />)
  expect(screen.getByText(/Architect/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-genesis.test.jsx`
Expected: FAIL.

**Step 3: Implement architect mode with key prompt**

```jsx
// frontend/src/hooks/useWorkbenchController.js
const [architectPrompt, setArchitectPrompt] = useState('')
const [architectApiKey, setArchitectApiKey] = useState('')
const [showKeyPrompt, setShowKeyPrompt] = useState(false)

const handleArchitectSubmit = async () => {
  setWorkbenchState('LAUNCHING')
  const headers = { 'Content-Type': 'application/json' }
  if (architectApiKey) headers['X-Api-Key'] = architectApiKey

  const response = await fetch(`${API_BASE}/api/blueprints/preview`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt: architectPrompt }),
  })

  if (response.status === 400) {
    setShowKeyPrompt(true)
    setWorkbenchState('DRAFT')
    return
  }

  const { config } = await response.json()
  hydrateFormFromConfig(config)
  await handleLaunch()
  setWorkbenchState('RUNNING')
}
```

Render the key prompt in `StagePanel` and keep the key in memory only (do not persist).

**Step 4: Run tests**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-genesis.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/hooks/useWorkbenchController.js frontend/src/components/workbench/StagePanel.jsx frontend/src/__tests__/workbench-genesis.test.jsx
git commit -m "feat(ui): add genesis architect flow"
```

---


### Task 9: Config apply + reload + rollback flow

**Files:**
- Modify: `frontend/src/hooks/useWorkbenchController.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/workbench/BlueprintPanel.jsx`
- Modify: `backend/app/main.py`
- Test: `frontend/src/__tests__/workbench-reload.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-reload.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('shows reloading banner when applying config', async () => {
  render(<App />)
  expect(screen.queryByText(/Reloading/i)).not.toBeInTheDocument()
})

it('shows rollback action when reload fails', async () => {
  render(<App />)
  expect(screen.queryByText(/Rollback/i)).not.toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-reload.test.jsx`
Expected: FAIL once you add banner and rollback expectations.

**Step 3: Implement apply + reload + rollback**

```jsx
// frontend/src/hooks/useWorkbenchController.js
const [lastGoodConfig, setLastGoodConfig] = useState(null)
const [reloadError, setReloadError] = useState(null)
const [pollingPaused, setPollingPaused] = useState(false)

const handleApplyConfig = async () => {
  if (!selectedAgentId) return
  setReloadError(null)
  setWorkbenchState('RELOADING')
  setPollingPaused(true)

  const nextConfig = JSON.parse(configPreview)
  const snapshot = lastGoodConfig || nextConfig

  try {
    const response = await fetch(`${API_BASE}/api/agents/${selectedAgentId}/config`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionByAgent[selectedAgentId]?.sessionToken,
      },
      body: JSON.stringify({ config: nextConfig }),
    })
    if (!response.ok) {
      throw new Error(await response.text())
    }
    const payload = await response.json()
    setSessionByAgent((prev) => ({
      ...prev,
      [selectedAgentId]: {
        sessionId: payload.session_id,
        sessionToken: payload.session_token,
      },
    }))
    setLastGoodConfig(nextConfig)
    setWorkbenchState('RUNNING')
  } catch (error) {
    setReloadError(error.message)
    setWorkbenchState('DRAFT')
    setLastGoodConfig(snapshot)
  } finally {
    setPollingPaused(false)
  }
}

const handleRollback = async () => {
  if (!lastGoodConfig || !selectedAgentId) return
  await fetch(`${API_BASE}/api/agents/${selectedAgentId}/config`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': sessionByAgent[selectedAgentId]?.sessionToken,
    },
    body: JSON.stringify({ config: lastGoodConfig }),
  })
}
```

Render the rollback button and error state in `BlueprintPanel` when `reloadError` is set.

**Step 4: Pause polling while reload is in-flight**

Gate `fetchAgents` scheduling on `pollingPaused` so no concurrent refresh overwrites session tokens mid-reload.

**Step 5: Run tests**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-reload.test.jsx`
Expected: PASS

**Step 6: Commit**

```bash
git add frontend/src/hooks/useWorkbenchController.js frontend/src/App.jsx frontend/src/components/workbench/BlueprintPanel.jsx frontend/src/__tests__/workbench-reload.test.jsx
git commit -m "feat(ui): apply config with reload + rollback"
```

---


### Task 10: Evolution suggestions (LLM intent router)

**Files:**
- Create: `backend/app/intent_router.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_intent_router.py`
- Modify: `frontend/src/hooks/useWorkbenchController.js`
- Modify: `frontend/src/components/workbench/StagePanel.jsx`
- Modify: `frontend/src/constants/tools.js`
- Test: `frontend/src/__tests__/workbench-evolution.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-evolution.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('renders suggestion card when router suggests a tool', () => {
  render(<App />)
  expect(screen.getByText(/Add tool/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-evolution.test.jsx`
Expected: FAIL.

**Step 3: Implement backend intent router**

```python
# backend/app/intent_router.py
import json
from typing import Dict, List, Optional

from claude_agent_sdk import ClaudeAgentOptions, AssistantMessage, TextBlock, query


class IntentRouter:
    def __init__(self):
        self.options = ClaudeAgentOptions(allowed_tools=[], permission_mode="plan")

    async def suggest_tools(self, user_text: str, assistant_text: Optional[str]) -> Dict[str, List[str]]:
        prompt = (
            "You are a router. Return JSON only with {\"suggested_tools\": [..], \"reason\": \"...\"}. "
            "If no tool needed, return {\"suggested_tools\": []}. "
            f"User: {user_text} Assistant: {assistant_text or ''}"
        )
        chunks = []
        async for message in query(prompt=prompt, options=self.options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        chunks.append(block.text)
        return json.loads("".join(chunks))
```

```python
# backend/app/main.py
class IntentRequest(BaseModel):
    user_text: str
    assistant_text: Optional[str] = None


class IntentResponse(BaseModel):
    suggested_tools: List[str]
    reason: Optional[str] = None


@app.post("/api/agents/intent", response_model=IntentResponse)
async def suggest_tools(request: IntentRequest):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=400, detail="ANTHROPIC_API_KEY is required")
    router = IntentRouter()
    try:
        result = await router.suggest_tools(request.user_text, request.assistant_text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return IntentResponse(**result)
```

**Step 4: Use router in frontend**

Call `/api/agents/intent` after a full assistant response, and only show the suggestion card when `suggested_tools` is non-empty. If you already have an in-memory key from Genesis, pass it via `X-Api-Key`. If the router endpoint returns 400, fall back to a manual tool picker (no auto-suggestion).

**Step 5: Run tests**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-evolution.test.jsx`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/app/intent_router.py backend/app/main.py backend/tests/test_intent_router.py frontend/src/hooks/useWorkbenchController.js frontend/src/components/workbench/StagePanel.jsx frontend/src/constants/tools.js frontend/src/__tests__/workbench-evolution.test.jsx
git commit -m "feat(ui): add intent-based tool suggestions"
```

---


### Task 11: Visual language + motion updates

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/index.html`

**Step 1: Add font imports**

```html
<!-- frontend/index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet" />
```

**Step 2: Add CSS variables and animations**

```css
:root {
  --blueprint-bg: #faf9f6;
  --blueprint-ink: #6b645c;
  --stage-bg: #ffffff;
  --stage-ink: #2e3a4a;
}

.workbench .blueprint {
  background: var(--blueprint-bg);
  font-family: 'IBM Plex Mono', monospace;
}

.workbench .stage {
  background: var(--stage-bg);
  font-family: 'Space Grotesk', sans-serif;
}

@keyframes panel-reveal {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Step 3: Commit**

```bash
git add frontend/src/index.css frontend/index.html
git commit -m "style(ui): apply living blueprint visual language"
```

---

### Task 12: Update API docs

**Files:**
- Modify: `README.md`

**Step 1: Add new endpoints to README**

Add:
- `POST /api/blueprints/preview`
- `POST /api/agents/intent`
- `PATCH /api/agents/{agent_id}/config`
Document `X-Api-Key` for blueprint preview.

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document blueprint and config reload endpoints"
```

---

### Task 13: Verification sweep

**Step 1: Backend tests**

Run: `pytest backend/tests -v`
Expected: PASS

**Step 2: Frontend tests**

Run: `cd frontend && npm test`
Expected: PASS

**Step 3: Manual smoke**

Run backend + frontend; verify:
- Architect prompt generates config
- Apply triggers reload banner and keeps chat history
- Suggestion card adds tool and restarts

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify living blueprint workbench"
```
