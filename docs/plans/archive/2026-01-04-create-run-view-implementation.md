# Create/Run View Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the UI into Create View and Run View with a clear quick-create path and optional modules area.

**Architecture:** Keep App.jsx as the state owner, extract CreateView/RunView presentational components, and pass down handlers and derived view state. Introduce a simple `activeView` state in App to switch between creation and runtime, and centralize layout styling in existing Tailwind + CSS tokens.

**Tech Stack:** React 19, Vite, Tailwind CSS, custom CSS variables in `frontend/src/index.css`.

---

### Task 1: Add baseline UI tokens (if missing) for create/run split

**Files:**
- Modify: `frontend/src/index.css`

**Step 1: Write the failing test**

Add a basic visual regression placeholder test plan in comments (no runtime yet). This plan is executed after adding test tooling in Task 2.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL (no test runner configured)

**Step 3: Write minimal implementation**

Add CSS variables from the UX doc to `:root` if they are missing or adjust existing ones to align with `surface`/`text`/`accent` naming.

```css
:root {
  --surface-base: #F7F3EC;
  --surface-panel: #EEE7DD;
  --surface-raised: #FFFFFF;
  --text-primary: #2B2A29;
  --text-secondary: #6B645C;
  --accent-primary: #2E3A4A;
  --accent-hover: #394859;
  --border-subtle: #D8CFC2;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: FAIL (still no test runner; resolved in Task 2)

**Step 5: Commit**

```bash
git add frontend/src/index.css
git commit -m "style: add base tokens for create/run views"
```

---

### Task 2: Add minimal frontend test harness (Vitest + RTL)

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vite.config.js` (if not already)
- Create: `frontend/src/__tests__/view-split.test.jsx`

**Step 1: Write the failing test**

```jsx
import { render, screen } from '@testing-library/react'
import App from '../App'

test('renders quick create entry', () => {
  render(<App />)
  expect(screen.getByText(/Create Agent/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL (vitest not installed / test script missing)

**Step 3: Write minimal implementation**

- Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`.
- Add `test` script to `frontend/package.json`.
- Configure `vite.config.js` with `test: { environment: 'jsdom' }`.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS 1 test

**Step 5: Commit**

```bash
git add frontend/package.json frontend/vite.config.js frontend/src/__tests__/view-split.test.jsx
git commit -m "test: add vitest harness for UI split"
```

---

### Task 3: Extract CreateView and RunView components

**Files:**
- Create: `frontend/src/components/views/CreateView.jsx`
- Create: `frontend/src/components/views/RunView.jsx`
- Modify: `frontend/src/App.jsx`

**Step 1: Write the failing test**

Extend test to assert Create View layout:

```jsx
test('create view shows quick create card and wizard entry', () => {
  render(<App />)
  expect(screen.getByText(/快速创建/i)).toBeInTheDocument()
  expect(screen.getByText(/向导创建/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL (labels not present yet)

**Step 3: Write minimal implementation**

- Move the creation UI into `CreateView` (quick create + wizard entry + optional modules section + advanced config fold).
- Move run UI into `RunView` (status bar + conversation + logs).
- Keep state in App and pass handlers/props down.
- Add `activeView` state in `App.jsx` with default `create`.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/views/CreateView.jsx frontend/src/components/views/RunView.jsx frontend/src/App.jsx
git commit -m "feat: split create/run views"
```

---

### Task 4: Add view switching behavior

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Write the failing test**

```jsx
test('switches to run view after create', async () => {
  render(<App />)
  // simulate create action by clicking create button
  const createButton = screen.getByRole('button', { name: /创建并启动/i })
  createButton.click()
  expect(await screen.findByText(/Conversation/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL (no view switching yet)

**Step 3: Write minimal implementation**

- On successful create/launch, set `activeView` to `run`.
- Add a “Configure” button in Run View that sets `activeView` to `create`.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add create/run view switching"
```

---

### Task 5: Manual UX verification

**Files:**
- None (manual)

**Step 1: Run the app**

Run: `npm run dev`
Expected: app loads

**Step 2: Verify Create View**

- Quick create card visible
- Wizard entry visible
- Optional modules collapsed by default

**Step 3: Verify Run View**

- Create action switches to Run View
- Configure button returns to Create View

**Step 4: Commit (docs note)**

```bash
git add docs/plans/2026-01-04-create-run-view-implementation.md
git commit -m "docs: add create/run view implementation plan"
```

