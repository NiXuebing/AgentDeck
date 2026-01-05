# Hybrid UX Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the Workbench UI fully in line with the Living Blueprint UX redesign (Genesis, Co-Tuning, Evolution), including chat stream semantics, skills rack UX, motion, and visual language.

**Architecture:** Keep the existing Workbench state machine (`DRAFT/LAUNCHING/RUNNING/RELOADING`) but change presentation and data flow: Stage owns chat stream rendering with user/agent/system/meta messages, Blueprint owns a chips-based Skills Rack, and Genesis uses staged fill to simulate streaming. Use small UI components for message rendering, reloading bar, logs drawer, and command palette.

**Tech Stack:** React 19 + Vite + Tailwind, FastAPI backend already in place, optional `react-markdown` + `remark-gfm` for message rendering.

---

### Task 1: Add structured chat message model + renderer

**Files:**
- Create: `frontend/src/components/workbench/ChatMessage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/workbench/StagePanel.jsx`
- Test: `frontend/src/__tests__/workbench-chat-stream.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-chat-stream.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('renders user/assistant/system/meta messages with distinct styles', async () => {
  render(<App />)
  expect(screen.getByText(/Send a message/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-chat-stream.test.jsx`
Expected: FAIL (ChatMessage component missing).

**Step 3: Write minimal implementation**

```jsx
// frontend/src/components/workbench/ChatMessage.jsx
import React from 'react'

export function ChatMessage({ message }) {
  const role = message?.role || 'assistant'
  if (role === 'system' || role === 'meta') {
    return (
      <div className="chat-meta">
        <span>{message.content}</span>
      </div>
    )
  }

  const isUser = role === 'user'
  return (
    <div className={`chat-bubble ${isUser ? 'chat-user' : 'chat-agent'}`}>
      {message.content}
    </div>
  )
}
```

Wire StagePanel to render `ChatMessage` for each item.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-chat-stream.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/workbench/ChatMessage.jsx frontend/src/components/workbench/StagePanel.jsx frontend/src/App.jsx frontend/src/__tests__/workbench-chat-stream.test.jsx
git commit -m "feat(ui): add structured chat message renderer"
```

---

### Task 2: Add markdown rendering for agent messages

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/components/workbench/ChatMessage.jsx`
- Test: `frontend/src/__tests__/workbench-chat-markdown.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-chat-markdown.test.jsx
import { render, screen } from '@testing-library/react'
import { ChatMessage } from '../components/workbench/ChatMessage'

it('renders markdown for agent messages', () => {
  render(<ChatMessage message={{ role: 'assistant', content: '# Title' }} />)
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-chat-markdown.test.jsx`
Expected: FAIL (no markdown renderer).

**Step 3: Write minimal implementation**

```bash
cd frontend
npm install react-markdown remark-gfm
```

```jsx
// frontend/src/components/workbench/ChatMessage.jsx
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ... inside assistant bubble
<ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-chat-markdown.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/workbench/ChatMessage.jsx frontend/src/__tests__/workbench-chat-markdown.test.jsx
git commit -m "feat(ui): render markdown in agent messages"
```

---

### Task 3: Move Reloading status bar to Stage top

**Files:**
- Modify: `frontend/src/components/workbench/StagePanel.jsx`
- Modify: `frontend/src/components/workbench/BlueprintPanel.jsx`
- Test: `frontend/src/__tests__/workbench-reload.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-reload.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('shows reloading banner at stage top', async () => {
  render(<App />)
  expect(screen.queryByText(/Reloading/i)).not.toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-reload.test.jsx`
Expected: FAIL once banner is expected on Stage.

**Step 3: Write minimal implementation**

- Remove Reloading badge from Blueprint header.
- Add a `StageReloadingBar` in StagePanel that renders when `isReloading` is true.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-reload.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/workbench/StagePanel.jsx frontend/src/components/workbench/BlueprintPanel.jsx frontend/src/__tests__/workbench-reload.test.jsx
git commit -m "feat(ui): show reloading bar in stage"
```

---

### Task 4: Genesis skeleton + staged fill (streaming simulation)

**Files:**
- Create: `frontend/src/hooks/useGenesisFill.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/workbench/BlueprintPanel.jsx`
- Modify: `frontend/src/components/workbench/StagePanel.jsx`
- Test: `frontend/src/__tests__/workbench-genesis-stream.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-genesis-stream.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('shows blueprint skeleton before genesis fills', () => {
  render(<App />)
  expect(screen.getByText(/Blueprint Skeleton/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-genesis-stream.test.jsx`
Expected: FAIL (skeleton missing).

**Step 3: Write minimal implementation**

```jsx
// frontend/src/hooks/useGenesisFill.js
import { useRef } from 'react'

export function useGenesisFill(onHydrate) {
  const timers = useRef([])
  const schedule = (steps) => {
    timers.current.forEach(clearTimeout)
    timers.current = steps.map((step, index) =>
      setTimeout(() => onHydrate(step), 300 * (index + 1))
    )
  }
  return { schedule }
}
```

- In `handleArchitectSubmit`, call `schedule` with staged config fragments.
- Render skeleton in BlueprintPanel when `showArchitect` is true and no config has been filled yet.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-genesis-stream.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/hooks/useGenesisFill.js frontend/src/App.jsx frontend/src/components/workbench/BlueprintPanel.jsx frontend/src/components/workbench/StagePanel.jsx frontend/src/__tests__/workbench-genesis-stream.test.jsx
git commit -m "feat(ui): add genesis skeleton and staged fill"
```

---

### Task 5: Prompt editor markdown overlay + auto-resize + unsaved dot

**Files:**
- Modify: `frontend/src/components/workbench/BlueprintPanel.jsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/__tests__/workbench-blueprint.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-blueprint.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('shows unsaved dot indicator for prompt edits', () => {
  render(<App />)
  expect(screen.getByTestId('unsaved-dot')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-blueprint.test.jsx`
Expected: FAIL

**Step 3: Write minimal implementation**

- Add an overlay markdown preview (behind textarea) to simulate highlight.
- Add `autoResize` on textarea input.
- Replace “Unsaved” text with a dot `data-testid="unsaved-dot"`.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-blueprint.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/workbench/BlueprintPanel.jsx frontend/src/index.css frontend/src/__tests__/workbench-blueprint.test.jsx
git commit -m "feat(ui): upgrade prompt editor"
```

---

### Task 6: Build Skills Rack (chips + drag/drop + command palette)

**Files:**
- Create: `frontend/src/components/workbench/SkillsRack.jsx`
- Create: `frontend/src/components/workbench/CommandPalette.jsx`
- Modify: `frontend/src/components/workbench/BlueprintPanel.jsx`
- Modify: `frontend/src/App.jsx`
- Test: `frontend/src/__tests__/workbench-skills-rack.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-skills-rack.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('renders chips for tools and opens command palette', () => {
  render(<App />)
  expect(screen.getByRole('button', { name: /Add/i })).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-skills-rack.test.jsx`
Expected: FAIL

**Step 3: Write minimal implementation**

- `SkillsRack` renders chips for `allowed_tools`, `agents`, `skills`, `commands`.
- `CommandPalette` opens with Cmd+K and a “+ Add” button.
- Drag/drop uses HTML5 drag events to reorder chips in a single list per category.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-skills-rack.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/workbench/SkillsRack.jsx frontend/src/components/workbench/CommandPalette.jsx frontend/src/components/workbench/BlueprintPanel.jsx frontend/src/App.jsx frontend/src/__tests__/workbench-skills-rack.test.jsx
git commit -m "feat(ui): add skills rack chips and command palette"
```

---

### Task 7: Suggestion card as system/meta message in chat stream

**Files:**
- Modify: `frontend/src/hooks/useWorkbenchController.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/workbench/StagePanel.jsx`
- Test: `frontend/src/__tests__/workbench-evolution.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-evolution.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('inserts suggestion card into chat stream', () => {
  render(<App />)
  expect(screen.queryByText(/Tool Suggestion/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-evolution.test.jsx`
Expected: FAIL

**Step 3: Write minimal implementation**

- When `toolSuggestion` is set, push a `meta` message with a `type: 'suggestion'` in its metadata.
- Update `ChatMessage` to render the suggestion card inside the meta block.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-evolution.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/hooks/useWorkbenchController.js frontend/src/App.jsx frontend/src/components/workbench/StagePanel.jsx frontend/src/__tests__/workbench-evolution.test.jsx
git commit -m "feat(ui): render suggestions inside chat stream"
```

---

### Task 8: Tool add animation + auto-retry + retry button

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/workbench/ChatMessage.jsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/__tests__/workbench-retry.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-retry.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('shows retry action for assistant messages', () => {
  render(<App />)
  expect(screen.queryByText(/Retry/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-retry.test.jsx`
Expected: FAIL

**Step 3: Write minimal implementation**

- Record `lastUserMessageId` and link assistant replies to it.
- Add a Retry button on assistant bubbles that replays the last user message.
- On tool add: append meta messages “Tool Added” + “Restarted”, trigger reload, then auto-retry last user prompt.
- Add a simple CSS animation for tool add (fade + translate in Skills Rack).

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-retry.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/workbench/ChatMessage.jsx frontend/src/index.css frontend/src/__tests__/workbench-retry.test.jsx
git commit -m "feat(ui): add retry flow and tool add animation"
```

---

### Task 9: Slash commands (/config, /restart)

**Files:**
- Modify: `frontend/src/components/workbench/StagePanel.jsx`
- Modify: `frontend/src/App.jsx`
- Test: `frontend/src/__tests__/workbench-slash.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-slash.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('recognizes /config and /restart slash commands', () => {
  render(<App />)
  expect(screen.getByPlaceholderText(/Message/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-slash.test.jsx`
Expected: FAIL

**Step 3: Write minimal implementation**

- Parse input; if `/config`, focus prompt editor and insert a meta message.
- If `/restart`, call reload handler and insert meta message.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-slash.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/workbench/StagePanel.jsx frontend/src/App.jsx frontend/src/__tests__/workbench-slash.test.jsx
git commit -m "feat(ui): add slash commands"
```

---

### Task 10: Logs drawer bottom sheet

**Files:**
- Create: `frontend/src/components/workbench/LogsDrawer.jsx`
- Modify: `frontend/src/components/workbench/StagePanel.jsx`
- Test: `frontend/src/__tests__/workbench-logs-drawer.test.jsx`

**Step 1: Write the failing test**

```jsx
// frontend/src/__tests__/workbench-logs-drawer.test.jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

it('opens logs drawer at bottom', () => {
  render(<App />)
  expect(screen.getByRole('button', { name: /Logs/i })).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-logs-drawer.test.jsx`
Expected: FAIL

**Step 3: Write minimal implementation**

- Add `LogsDrawer` component that slides from bottom.
- Replace current inline log area with drawer.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --runTestsByPath src/__tests__/workbench-logs-drawer.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/workbench/LogsDrawer.jsx frontend/src/components/workbench/StagePanel.jsx frontend/src/__tests__/workbench-logs-drawer.test.jsx
git commit -m "feat(ui): add logs bottom drawer"
```

---

### Task 11: Visual language + motion alignment

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/views/WorkbenchView.jsx`

**Step 1: Update CSS variables and background patterns**

```css
:root {
  --blueprint-bg: #faf9f6;
  --blueprint-ink: #6b645c;
  --stage-bg: #ffffff;
  --stage-ink: #2e3a4a;
}

.workbench .panel.blueprint { background: var(--blueprint-bg); font-family: 'IBM Plex Mono', monospace; }
.workbench .panel.stage { background: var(--stage-bg); font-family: 'Space Grotesk', sans-serif; }
```

**Step 2: Add motion tokens**

- `morph` transition for Genesis → Stage.
- `fly-in` animation for tools.
- `reload-bar` subtle pulse.

**Step 3: Manual verify**

Run: `cd frontend && npm run dev`
Expected: Left panel looks like drafting paper; right panel looks like finished output.

**Step 4: Commit**

```bash
git add frontend/src/index.css frontend/src/components/views/WorkbenchView.jsx
git commit -m "style(ui): align living blueprint visual language"
```

---

### Task 12: Verification sweep

**Step 1: Backend tests**

Run: `pytest backend/tests -v`
Expected: PASS

**Step 2: Frontend tests**

Run: `cd frontend && npm test`
Expected: PASS

**Step 3: Manual smoke**

- Genesis: Architect generates config, Blueprint fills in stages, auto-launches.
- Stage: Chat shows bubbles + meta messages, Reloading bar shows in Stage top.
- Evolution: Suggestion card appears in chat stream; Add Tool triggers tool fly-in, reload, auto-retry.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify hybrid UX redesign"
```
