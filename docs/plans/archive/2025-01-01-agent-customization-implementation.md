# Agent Customization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add frontend UI for configuring sub-agents, skills, and slash commands with backend support for generating and injecting `.claude/` directory into Docker containers.

**Architecture:** The frontend will use React components with a tab-based configuration interface. The backend will generate `.claude/` directory files from the config and mount them into containers. The SDK loads these files via `setting_sources: ["project"]`.

**Tech Stack:** React + Vite (frontend), FastAPI + Docker (backend), Claude Agent SDK (container runtime)

**Reference:** See `docs/plans/2025-01-01-agent-customization-design.md` for detailed UI mockups and SDK format specifications.

---

## Task 1: Backend - Add setting_sources to SDK

**Files:**
- Modify: `backend/runtime_base/container/agent_server.py:154-158`

**Step 1: Locate the SDK initialization code**

Open and read lines 150-165 of agent_server.py to find `options_dict`.

**Step 2: Add setting_sources to options_dict**

```python
# In initialize_sdk method, modify options_dict (around line 154)
options_dict = {
    "cwd": "/workspace",
    "setting_sources": ["project"],  # NEW: Load .claude/ directory
    "allowed_tools": self.config.get("allowed_tools", ["Bash", "Read", "Write"]),
    "permission_mode": self.config.get("permission_mode", "acceptEdits"),
}
```

**Step 3: Verify the change compiles**

Run: `cd /Users/nxb/Documents/AIAssistant/AgentDeck/agent-deck/backend && python -c "from runtime_base.container.agent_server import AgentServer; print('OK')"`
Expected: OK (or import error if dependencies missing, which is fine)

**Step 4: Commit**

```bash
git add backend/runtime_base/container/agent_server.py
git commit -m "feat(backend): add setting_sources to SDK initialization

Enable loading of .claude/ directory for agents, skills, and commands"
```

---

## Task 2: Backend - Add claude directory generator utility

**Files:**
- Create: `backend/app/claude_generator.py`

**Step 1: Create the generator module**

```python
"""Generate .claude/ directory structure for agent configurations."""

import os
import json
from pathlib import Path
from typing import Dict, Any, List, Optional


def generate_agent_md(name: str, agent: Dict[str, Any]) -> str:
    """Generate markdown content for a sub-agent file."""
    lines = ["---"]
    lines.append(f"name: {name}")

    description = agent.get("description", "")
    if "\n" in description or len(description) > 60:
        lines.append("description: >-")
        for line in description.split("\n"):
            lines.append(f"  {line.strip()}")
    else:
        lines.append(f"description: {description}")

    tools = agent.get("allowed_tools") or agent.get("tools")
    if tools:
        lines.append("tools:")
        for tool in tools:
            lines.append(f"  - {tool}")

    model = agent.get("model")
    if model:
        lines.append(f"model: {model}")

    lines.append("---")
    lines.append("")
    lines.append(agent.get("prompt", ""))

    return "\n".join(lines)


def generate_skill_md(skill: Dict[str, Any]) -> str:
    """Generate SKILL.md content for a skill."""
    lines = ["---"]

    description = skill.get("description", "")
    if "\n" in description or len(description) > 60:
        lines.append("description: >-")
        for line in description.split("\n"):
            lines.append(f"  {line.strip()}")
    else:
        lines.append(f"description: {description}")

    lines.append("---")
    lines.append("")
    lines.append(skill.get("content", ""))

    return "\n".join(lines)


def generate_command_md(command: Dict[str, Any]) -> str:
    """Generate markdown content for a slash command."""
    lines = ["---"]

    if command.get("description"):
        lines.append(f"description: {command['description']}")

    if command.get("allowedTools"):
        lines.append(f"allowed-tools: {command['allowedTools']}")

    if command.get("argumentHint"):
        lines.append(f"argument-hint: {command['argumentHint']}")

    if command.get("model"):
        lines.append(f"model: {command['model']}")

    lines.append("---")
    lines.append("")
    lines.append(command.get("prompt", ""))

    return "\n".join(lines)


def generate_claude_directory(
    base_path: Path,
    config: Dict[str, Any],
    agents: Optional[Dict[str, Any]] = None,
    skills: Optional[Dict[str, Any]] = None,
    commands: Optional[Dict[str, Any]] = None,
) -> List[str]:
    """
    Generate .claude/ directory structure.

    Returns list of generated file paths (relative to base_path).
    """
    claude_dir = base_path / ".claude"
    generated_files = []

    # Create directories
    (claude_dir / "agents").mkdir(parents=True, exist_ok=True)
    (claude_dir / "skills").mkdir(parents=True, exist_ok=True)
    (claude_dir / "commands").mkdir(parents=True, exist_ok=True)

    # Write agent-config.json
    config_path = claude_dir / "agent-config.json"
    config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
    generated_files.append(".claude/agent-config.json")

    # Generate sub-agent files
    if agents:
        for name, agent in agents.items():
            agent_path = claude_dir / "agents" / f"{name}.md"
            agent_path.write_text(generate_agent_md(name, agent), encoding="utf-8")
            generated_files.append(f".claude/agents/{name}.md")

    # Generate skill directories and files
    if skills:
        for name, skill in skills.items():
            skill_dir = claude_dir / "skills" / name
            skill_dir.mkdir(parents=True, exist_ok=True)

            skill_md_path = skill_dir / "SKILL.md"
            skill_md_path.write_text(generate_skill_md(skill), encoding="utf-8")
            generated_files.append(f".claude/skills/{name}/SKILL.md")

            # Write resource files
            for resource in skill.get("resources", []):
                resource_path = skill_dir / resource["path"]
                resource_path.parent.mkdir(parents=True, exist_ok=True)
                resource_path.write_text(resource["content"], encoding="utf-8")
                generated_files.append(f".claude/skills/{name}/{resource['path']}")

    # Generate command files
    if commands:
        for name, command in commands.items():
            cmd_path = claude_dir / "commands" / f"{name}.md"
            cmd_path.write_text(generate_command_md(command), encoding="utf-8")
            generated_files.append(f".claude/commands/{name}.md")

    return generated_files
```

**Step 2: Verify syntax**

Run: `cd /Users/nxb/Documents/AIAssistant/AgentDeck/agent-deck/backend && python -c "from app.claude_generator import generate_claude_directory; print('OK')"`
Expected: OK

**Step 3: Commit**

```bash
git add backend/app/claude_generator.py
git commit -m "feat(backend): add claude directory generator utility

Generates .claude/ directory structure with agents, skills, and commands"
```

---

## Task 3: Backend - Integrate generator into docker_mgr

**Files:**
- Modify: `backend/app/docker_mgr.py`

**Step 1: Read docker_mgr.py to understand spawn_agent**

Read the file to find where agent configuration is written.

**Step 2: Import the generator at top of file**

```python
from app.claude_generator import generate_claude_directory
```

**Step 3: Add claude directory generation in spawn_agent**

Find where config is written and add after it:

```python
# After writing agent-config.json, generate .claude/ structure
agents_config = config.get("agents")
skills_config = config.get("skills")
commands_config = config.get("commands")

if agents_config or skills_config or commands_config:
    from app.claude_generator import generate_claude_directory
    generate_claude_directory(
        base_path=agent_dir,
        config=config,
        agents=agents_config,
        skills=skills_config,
        commands=commands_config,
    )
```

**Step 4: Commit**

```bash
git add backend/app/docker_mgr.py
git commit -m "feat(backend): integrate claude directory generator

Generate .claude/ structure when launching agents with custom configs"
```

---

## Task 4: Frontend - Create components directory structure

**Files:**
- Create: `frontend/src/components/tabs/ProfileTab.jsx`
- Create: `frontend/src/components/tabs/ToolboxTab.jsx`
- Create: `frontend/src/components/tabs/SkillsTab.jsx`
- Create: `frontend/src/components/tabs/CommandsTab.jsx`
- Create: `frontend/src/components/SubAgentCard.jsx`
- Create: `frontend/src/components/SubAgentEditor.jsx`
- Create: `frontend/src/components/PreviewPanel.jsx`

**Step 1: Create directories**

```bash
mkdir -p frontend/src/components/tabs
mkdir -p frontend/src/components/editors
```

**Step 2: Create placeholder ProfileTab.jsx**

```jsx
// frontend/src/components/tabs/ProfileTab.jsx
export function ProfileTab({ form, onChange }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">Profile Tab - TODO</p>
    </div>
  )
}
```

**Step 3: Create placeholder files for other tabs**

Create similar placeholder files for ToolboxTab.jsx, SkillsTab.jsx, CommandsTab.jsx.

**Step 4: Commit**

```bash
git add frontend/src/components/
git commit -m "feat(frontend): create component directory structure

Add placeholder files for tabs and editors"
```

---

## Task 5: Frontend - Extract constants and types

**Files:**
- Create: `frontend/src/constants/tools.js`

**Step 1: Create tools constants file**

```javascript
// frontend/src/constants/tools.js

export const TOOL_GROUPS = {
  file: {
    label: 'File Operations',
    tools: [
      { name: 'Read', description: 'Read file contents', default: true },
      { name: 'Write', description: 'Create/overwrite files', default: true },
      { name: 'Edit', description: 'Edit file sections', default: true },
      { name: 'Grep', description: 'Search file contents', default: true },
      { name: 'Glob', description: 'Find files by pattern', default: true },
    ],
  },
  execution: {
    label: 'Execution',
    tools: [
      { name: 'Bash', description: 'Execute shell commands', default: true, hasPatterns: true },
    ],
  },
  web: {
    label: 'Web',
    tools: [
      { name: 'WebSearch', description: 'Search the internet', default: true },
      { name: 'WebFetch', description: 'Fetch URL content', default: true },
    ],
  },
  task: {
    label: 'Task Management',
    tools: [
      { name: 'TodoWrite', description: 'Manage task lists', default: true },
      { name: 'NotebookEdit', description: 'Edit Jupyter notebooks', default: false },
    ],
  },
  agent: {
    label: 'Agent Delegation',
    tools: [
      { name: 'Task', description: 'Delegate to sub-agents', default: true },
      { name: 'Skill', description: 'Invoke skills', default: true },
    ],
  },
  mcp: {
    label: 'MCP',
    tools: [
      { name: 'ListMcpResources', description: 'List MCP resources', default: false },
      { name: 'ReadMcpResource', description: 'Read MCP resource', default: false },
    ],
  },
}

export const DEFAULT_TOOLS = Object.values(TOOL_GROUPS)
  .flatMap((group) => group.tools)
  .filter((tool) => tool.default)
  .map((tool) => tool.name)

export const ALL_TOOLS = Object.values(TOOL_GROUPS)
  .flatMap((group) => group.tools)
  .map((tool) => tool.name)

export const MODELS = [
  { value: 'inherit', label: 'Inherit from parent' },
  { value: 'sonnet', label: 'Sonnet (Balanced)' },
  { value: 'opus', label: 'Opus (Most Capable)' },
  { value: 'haiku', label: 'Haiku (Fast)' },
]

export const PERMISSION_MODES = [
  { value: 'default', label: 'Default (ask for all)' },
  { value: 'acceptEdits', label: 'Accept Edits (auto-approve file changes)' },
  { value: 'plan', label: 'Plan (no execution)' },
  { value: 'bypassPermissions', label: 'Bypass Permissions (auto all)' },
]

export const SUBAGENT_TEMPLATES = [
  {
    id: 'frontend',
    icon: '🎨',
    name: 'Frontend',
    description: 'React, Next.js, TypeScript, CSS',
    defaultTools: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'TodoWrite'],
    model: 'sonnet',
    prompt: `You are a senior frontend engineer specializing in:

- React 18+ with hooks and modern patterns
- Next.js 14+ (App Router, Server Components)
- TypeScript with strict mode
- Tailwind CSS and CSS-in-JS
- State management (Zustand, React Query)

Best practices:
- Component composition over inheritance
- Accessibility (WCAG 2.1 AA)
- Performance optimization`,
  },
  {
    id: 'backend',
    icon: '⚙️',
    name: 'Backend',
    description: 'Python, Node.js, APIs, Database',
    defaultTools: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'Bash', 'TodoWrite'],
    model: 'sonnet',
    prompt: `You are a senior backend engineer specializing in:

- Python with FastAPI, Django
- Node.js with Express, NestJS
- Database design (PostgreSQL, MongoDB)
- API design (REST, GraphQL)
- Authentication and security`,
  },
  {
    id: 'devops',
    icon: '🚀',
    name: 'DevOps',
    description: 'Docker, Kubernetes, CI/CD',
    defaultTools: ['Read', 'Write', 'Bash', 'TodoWrite'],
    model: 'haiku',
    prompt: `You are a DevOps engineer specializing in:

- Docker containerization
- Kubernetes orchestration
- CI/CD pipelines (GitHub Actions, GitLab CI)
- Cloud platforms (AWS, GCP, Azure)
- Infrastructure as Code (Terraform)`,
  },
  {
    id: 'researcher',
    icon: '🔍',
    name: 'Researcher',
    description: 'Web research, data gathering',
    defaultTools: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'TodoWrite'],
    model: 'haiku',
    prompt: `You are a research assistant specializing in:

- Web research and data gathering
- Summarizing technical documentation
- Finding relevant code examples
- Comparing libraries and frameworks`,
  },
  {
    id: 'writer',
    icon: '📝',
    name: 'Writer',
    description: 'Documentation, content',
    defaultTools: ['Read', 'Write', 'Edit', 'Grep', 'TodoWrite'],
    model: 'opus',
    prompt: `You are a technical writer specializing in:

- Clear, concise documentation
- API documentation
- README files and guides
- Code comments and JSDoc`,
  },
  {
    id: 'tester',
    icon: '🧪',
    name: 'Tester',
    description: 'Unit tests, E2E, coverage',
    defaultTools: ['Read', 'Write', 'Edit', 'Bash', 'TodoWrite'],
    model: 'sonnet',
    prompt: `You are a QA engineer specializing in:

- Unit testing (Jest, Pytest, Vitest)
- Integration testing
- E2E testing (Playwright, Cypress)
- Test coverage and quality`,
  },
]
```

**Step 2: Commit**

```bash
git add frontend/src/constants/
git commit -m "feat(frontend): add tool constants and subagent templates

Define tool groups, models, permission modes, and subagent templates"
```

---

## Task 6: Frontend - Implement ProfileTab component

**Files:**
- Modify: `frontend/src/components/tabs/ProfileTab.jsx`

**Step 1: Implement ProfileTab**

```jsx
// frontend/src/components/tabs/ProfileTab.jsx
import { PERMISSION_MODES } from '../../constants/tools'

const inputClass =
  'w-full rounded-xl border border-black/10 bg-white/80 px-4 py-2.5 text-sm text-neutral-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/40'

const labelClass = 'text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500'

export function ProfileTab({ form, onChange }) {
  const handleChange = (key) => (e) => {
    onChange({ ...form, [key]: e.target.value })
  }

  return (
    <div className="space-y-5">
      {/* Basic Info */}
      <div className="rounded-2xl border border-black/5 bg-white/50 p-5">
        <h3 className="mb-4 text-sm font-semibold text-neutral-700">Basic Info</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className={labelClass}>
              Config ID <span className="text-red-500">*</span>
            </label>
            <input
              className={inputClass}
              placeholder="my-code-assistant"
              value={form.configId}
              onChange={handleChange('configId')}
              pattern="[a-z0-9-]+"
            />
            <p className="text-xs text-neutral-400">Lowercase letters, numbers, hyphens only</p>
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelClass}>
              Display Name <span className="text-red-500">*</span>
            </label>
            <input
              className={inputClass}
              placeholder="Code Assistant"
              value={form.name}
              onChange={handleChange('name')}
            />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <label className={labelClass}>Description</label>
            <input
              className={inputClass}
              placeholder="Full-stack development helper"
              value={form.description || ''}
              onChange={handleChange('description')}
            />
          </div>
        </div>
      </div>

      {/* System Prompt */}
      <div className="rounded-2xl border border-black/5 bg-white/50 p-5">
        <h3 className="mb-4 text-sm font-semibold text-neutral-700">System Prompt</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="promptType"
                checked={!form.useCustomPrompt}
                onChange={() => onChange({ ...form, useCustomPrompt: false })}
                className="text-emerald-600"
              />
              Use Default (Claude Code base prompt)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="promptType"
                checked={form.useCustomPrompt}
                onChange={() => onChange({ ...form, useCustomPrompt: true })}
                className="text-emerald-600"
              />
              Custom Prompt
            </label>
          </div>
          {form.useCustomPrompt && (
            <textarea
              className={`${inputClass} min-h-[160px] font-mono text-xs`}
              placeholder="You are an expert software engineer..."
              value={form.systemPrompt}
              onChange={handleChange('systemPrompt')}
            />
          )}
        </div>
      </div>

      {/* Behavior Settings */}
      <div className="rounded-2xl border border-black/5 bg-white/50 p-5">
        <h3 className="mb-4 text-sm font-semibold text-neutral-700">Behavior Settings</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Permission Mode</label>
            <select
              className={inputClass}
              value={form.permissionMode}
              onChange={handleChange('permissionMode')}
            >
              {PERMISSION_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Max Turns</label>
            <input
              className={inputClass}
              type="number"
              min="1"
              max="1000"
              value={form.maxTurns}
              onChange={handleChange('maxTurns')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Model</label>
            <select
              className={inputClass}
              value={form.model || ''}
              onChange={handleChange('model')}
            >
              <option value="">Default</option>
              <option value="claude-sonnet-4-5-20250514">Sonnet 4.5</option>
              <option value="claude-opus-4-5">Opus 4.5</option>
              <option value="claude-haiku-4-5">Haiku 4.5</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/tabs/ProfileTab.jsx
git commit -m "feat(frontend): implement ProfileTab component

Add form fields for config ID, name, description, system prompt, and behavior settings"
```

---

## Task 7: Frontend - Implement ToolboxTab component

**Files:**
- Modify: `frontend/src/components/tabs/ToolboxTab.jsx`

**Step 1: Implement ToolboxTab**

```jsx
// frontend/src/components/tabs/ToolboxTab.jsx
import { useState } from 'react'
import { TOOL_GROUPS } from '../../constants/tools'

const inputClass =
  'w-full rounded-xl border border-black/10 bg-white/80 px-4 py-2.5 text-sm text-neutral-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/40'

const labelClass = 'text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500'

export function ToolboxTab({ form, onChange, mcpServers, onMcpServersChange }) {
  const [bashPatterns, setBashPatterns] = useState(form.bashPatterns || [])
  const [bashMode, setBashMode] = useState(form.bashMode || 'all')
  const [newPattern, setNewPattern] = useState('')

  const selectedTools = new Set(form.allowedTools || [])

  const toggleTool = (toolName) => {
    const newTools = new Set(selectedTools)
    if (newTools.has(toolName)) {
      newTools.delete(toolName)
    } else {
      newTools.add(toolName)
    }
    onChange({ ...form, allowedTools: Array.from(newTools) })
  }

  const selectAllInGroup = (groupKey) => {
    const group = TOOL_GROUPS[groupKey]
    const newTools = new Set(selectedTools)
    group.tools.forEach((tool) => newTools.add(tool.name))
    onChange({ ...form, allowedTools: Array.from(newTools) })
  }

  const addBashPattern = () => {
    if (newPattern.trim() && !bashPatterns.includes(newPattern.trim())) {
      const updated = [...bashPatterns, newPattern.trim()]
      setBashPatterns(updated)
      onChange({ ...form, bashPatterns: updated })
      setNewPattern('')
    }
  }

  const removeBashPattern = (pattern) => {
    const updated = bashPatterns.filter((p) => p !== pattern)
    setBashPatterns(updated)
    onChange({ ...form, bashPatterns: updated })
  }

  return (
    <div className="space-y-5">
      {/* Tool Groups */}
      {Object.entries(TOOL_GROUPS).map(([groupKey, group]) => (
        <div key={groupKey} className="rounded-2xl border border-black/5 bg-white/50 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-700">{group.label}</h3>
            <button
              type="button"
              onClick={() => selectAllInGroup(groupKey)}
              className="text-xs text-emerald-600 hover:text-emerald-700"
            >
              Select All
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {group.tools.map((tool) => (
              <label
                key={tool.name}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition ${
                  selectedTools.has(tool.name)
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-black/10 bg-white/80 text-neutral-600 hover:border-black/20'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTools.has(tool.name)}
                  onChange={() => toggleTool(tool.name)}
                  className="sr-only"
                />
                <span className="font-medium">{tool.name}</span>
                <span className="text-xs text-neutral-400">{tool.description}</span>
              </label>
            ))}
          </div>

          {/* Bash patterns */}
          {groupKey === 'execution' && selectedTools.has('Bash') && (
            <div className="mt-4 rounded-xl border border-black/5 bg-white/30 p-4">
              <div className="mb-3 flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="bashMode"
                    checked={bashMode === 'all'}
                    onChange={() => {
                      setBashMode('all')
                      onChange({ ...form, bashMode: 'all' })
                    }}
                    className="text-emerald-600"
                  />
                  Allow all commands
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="bashMode"
                    checked={bashMode === 'patterns'}
                    onChange={() => {
                      setBashMode('patterns')
                      onChange({ ...form, bashMode: 'patterns' })
                    }}
                    className="text-emerald-600"
                  />
                  Restrict to patterns
                </label>
              </div>
              {bashMode === 'patterns' && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {bashPatterns.map((pattern) => (
                      <span
                        key={pattern}
                        className="flex items-center gap-1 rounded-lg bg-neutral-100 px-3 py-1 text-sm"
                      >
                        {pattern}
                        <button
                          type="button"
                          onClick={() => removeBashPattern(pattern)}
                          className="ml-1 text-neutral-400 hover:text-red-500"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className={`${inputClass} flex-1`}
                      placeholder="git:*, npm:*, python:*"
                      value={newPattern}
                      onChange={(e) => setNewPattern(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBashPattern())}
                    />
                    <button
                      type="button"
                      onClick={addBashPattern}
                      className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* MCP Servers */}
      <div className="rounded-2xl border border-black/5 bg-white/50 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-700">MCP Servers</h3>
          <button
            type="button"
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
          >
            + Add Server
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <label className={labelClass}>MCP Servers (JSON)</label>
          <textarea
            className={`${inputClass} min-h-[100px] font-mono text-xs`}
            placeholder='{"github": {"type": "http", "url": "http://localhost:9999"}}'
            value={mcpServers}
            onChange={(e) => onMcpServersChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/tabs/ToolboxTab.jsx
git commit -m "feat(frontend): implement ToolboxTab component

Add tool selection with groups, Bash patterns, and MCP servers"
```

---

## Task 8: Frontend - Implement SkillsTab component

**Files:**
- Modify: `frontend/src/components/tabs/SkillsTab.jsx`

**Step 1: Implement SkillsTab**

```jsx
// frontend/src/components/tabs/SkillsTab.jsx
import { useState } from 'react'

const inputClass =
  'w-full rounded-xl border border-black/10 bg-white/80 px-4 py-2.5 text-sm text-neutral-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/40'

const labelClass = 'text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500'

export function SkillsTab({ skills, onChange }) {
  const [editingSkill, setEditingSkill] = useState(null)
  const [isAdding, setIsAdding] = useState(false)

  const skillList = Object.entries(skills || {})

  const handleAdd = () => {
    setEditingSkill({
      name: '',
      description: '',
      content: '',
      resources: [],
    })
    setIsAdding(true)
  }

  const handleSave = (skill) => {
    const newSkills = { ...skills }
    newSkills[skill.name] = {
      description: skill.description,
      content: skill.content,
      resources: skill.resources,
    }
    onChange(newSkills)
    setEditingSkill(null)
    setIsAdding(false)
  }

  const handleDelete = (name) => {
    if (!window.confirm(`Delete skill "${name}"?`)) return
    const newSkills = { ...skills }
    delete newSkills[name]
    onChange(newSkills)
  }

  const handleEdit = (name, skill) => {
    setEditingSkill({ name, ...skill })
    setIsAdding(false)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-black/5 bg-white/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-700">Skills</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Skills are automatically triggered by Claude based on their descriptions.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Add Skill
          </button>
        </div>
      </div>

      {/* Skill List */}
      {skillList.length === 0 && !editingSkill ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-8 text-center">
          <p className="text-sm text-neutral-500">No skills defined yet.</p>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-3 text-sm font-medium text-emerald-600 hover:text-emerald-700"
          >
            + Create your first skill
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {skillList.map(([name, skill]) => (
            <div
              key={name}
              className="rounded-2xl border border-black/5 bg-white/50 p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📘</span>
                    <h4 className="font-semibold text-neutral-800">{name}</h4>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">{skill.description}</p>
                  <p className="mt-2 text-xs text-neutral-400">
                    📄 SKILL.md ({skill.content?.split('\n').length || 0} lines)
                    {skill.resources?.length > 0 && ` + ${skill.resources.length} resources`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(name, skill)}
                    className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(name)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Panel */}
      {editingSkill && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
          <h3 className="mb-4 text-sm font-semibold text-emerald-800">
            {isAdding ? 'Add Skill' : `Edit: ${editingSkill.name}`}
          </h3>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className={labelClass}>
                Skill Name <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                placeholder="code-reviewer"
                value={editingSkill.name}
                onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                disabled={!isAdding}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                className={`${inputClass} min-h-[80px]`}
                placeholder="Review code for bugs, security vulnerabilities, and performance issues..."
                value={editingSkill.description}
                onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
              />
              <p className="text-xs text-neutral-400">
                Be specific! Claude uses this to decide when to trigger the skill.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>
                Instructions (SKILL.md) <span className="text-red-500">*</span>
              </label>
              <textarea
                className={`${inputClass} min-h-[200px] font-mono text-xs`}
                placeholder="# Code Review Guidelines&#10;&#10;## Process&#10;1. Read through the entire file first..."
                value={editingSkill.content}
                onChange={(e) => setEditingSkill({ ...editingSkill, content: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingSkill(null)
                  setIsAdding(false)
                }}
                className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave(editingSkill)}
                disabled={!editingSkill.name || !editingSkill.description || !editingSkill.content}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300"
              >
                Save Skill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/tabs/SkillsTab.jsx
git commit -m "feat(frontend): implement SkillsTab component

Add skill list view and inline editor for SKILL.md content"
```

---

## Task 9: Frontend - Implement CommandsTab component

**Files:**
- Modify: `frontend/src/components/tabs/CommandsTab.jsx`

**Step 1: Implement CommandsTab**

```jsx
// frontend/src/components/tabs/CommandsTab.jsx
import { useState } from 'react'
import { MODELS } from '../../constants/tools'

const inputClass =
  'w-full rounded-xl border border-black/10 bg-white/80 px-4 py-2.5 text-sm text-neutral-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/40'

const labelClass = 'text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500'

export function CommandsTab({ commands, onChange }) {
  const [editingCommand, setEditingCommand] = useState(null)
  const [isAdding, setIsAdding] = useState(false)

  const commandList = Object.entries(commands || {})

  const handleAdd = () => {
    setEditingCommand({
      name: '',
      description: '',
      argumentHint: '',
      allowedTools: '',
      model: '',
      prompt: '',
    })
    setIsAdding(true)
  }

  const handleSave = (command) => {
    const newCommands = { ...commands }
    newCommands[command.name] = {
      description: command.description,
      argumentHint: command.argumentHint,
      allowedTools: command.allowedTools,
      model: command.model,
      prompt: command.prompt,
    }
    onChange(newCommands)
    setEditingCommand(null)
    setIsAdding(false)
  }

  const handleDelete = (name) => {
    if (!window.confirm(`Delete command "/${name}"?`)) return
    const newCommands = { ...commands }
    delete newCommands[name]
    onChange(newCommands)
  }

  const handleEdit = (name, command) => {
    setEditingCommand({ name, ...command })
    setIsAdding(false)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-black/5 bg-white/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-700">Slash Commands</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Commands are triggered manually by typing /{'{name}'} in chat.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Add Command
          </button>
        </div>
      </div>

      {/* Command List */}
      {commandList.length === 0 && !editingCommand ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-8 text-center">
          <p className="text-sm text-neutral-500">No commands defined yet.</p>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-3 text-sm font-medium text-emerald-600 hover:text-emerald-700"
          >
            + Create your first command
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {commandList.map(([name, command]) => (
            <div
              key={name}
              className="rounded-2xl border border-black/5 bg-white/50 p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <h4 className="font-semibold text-neutral-800">/{name}</h4>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">{command.description || 'No description'}</p>
                  <div className="mt-2 flex gap-3 text-xs text-neutral-400">
                    {command.argumentHint && <span>Args: {command.argumentHint}</span>}
                    {command.model && <span>Model: {command.model}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(name, command)}
                    className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(name)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Panel */}
      {editingCommand && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
          <h3 className="mb-4 text-sm font-semibold text-emerald-800">
            {isAdding ? 'Add Command' : `Edit: /${editingCommand.name}`}
          </h3>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  Command Name <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400">/</span>
                  <input
                    className={inputClass}
                    placeholder="review"
                    value={editingCommand.name}
                    onChange={(e) => setEditingCommand({ ...editingCommand, name: e.target.value })}
                    disabled={!isAdding}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Description</label>
                <input
                  className={inputClass}
                  placeholder="Review code changes"
                  value={editingCommand.description}
                  onChange={(e) => setEditingCommand({ ...editingCommand, description: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Argument Hint</label>
                <input
                  className={inputClass}
                  placeholder="[pr-number] [--verbose]"
                  value={editingCommand.argumentHint}
                  onChange={(e) => setEditingCommand({ ...editingCommand, argumentHint: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Model</label>
                <select
                  className={inputClass}
                  value={editingCommand.model}
                  onChange={(e) => setEditingCommand({ ...editingCommand, model: e.target.value })}
                >
                  <option value="">Inherit from agent</option>
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Allowed Tools</label>
              <input
                className={inputClass}
                placeholder="Read, Grep, Glob, Bash(git diff:*)"
                value={editingCommand.allowedTools}
                onChange={(e) => setEditingCommand({ ...editingCommand, allowedTools: e.target.value })}
              />
              <p className="text-xs text-neutral-400">Comma-separated. Leave empty to inherit from agent.</p>
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>
                Prompt Template <span className="text-red-500">*</span>
              </label>
              <textarea
                className={`${inputClass} min-h-[160px] font-mono text-xs`}
                placeholder="Review the code changes for PR #$1&#10;&#10;Focus on:&#10;1. Security vulnerabilities&#10;2. Performance issues"
                value={editingCommand.prompt}
                onChange={(e) => setEditingCommand({ ...editingCommand, prompt: e.target.value })}
              />
              <p className="text-xs text-neutral-400">
                Use $1, $2 for positional args, $ARGUMENTS for all args.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingCommand(null)
                  setIsAdding(false)
                }}
                className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave(editingCommand)}
                disabled={!editingCommand.name || !editingCommand.prompt}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300"
              >
                Save Command
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/tabs/CommandsTab.jsx
git commit -m "feat(frontend): implement CommandsTab component

Add command list view and editor with argument hints and model selection"
```

---

## Task 10: Frontend - Implement SubAgentCard and SubAgentEditor

**Files:**
- Modify: `frontend/src/components/SubAgentCard.jsx`
- Modify: `frontend/src/components/SubAgentEditor.jsx`

**Step 1: Implement SubAgentCard.jsx**

```jsx
// frontend/src/components/SubAgentCard.jsx

export function SubAgentCard({ name, agent, onEdit, onDelete }) {
  const toolCount = agent.allowed_tools?.length || agent.tools?.length || 0

  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{agent.icon || '🤖'}</span>
          <div>
            <h4 className="font-semibold text-neutral-800">{name}</h4>
            <p className="text-xs text-neutral-500 line-clamp-2">
              {agent.description?.slice(0, 60)}
              {agent.description?.length > 60 ? '...' : ''}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
        <div className="flex gap-3">
          <span>Model: {agent.model || 'inherit'}</span>
          <span>Tools: {toolCount || 'inherit'}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEdit(name, agent)}
            className="rounded-lg border border-black/10 px-2.5 py-1 font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(name)}
            className="rounded-lg border border-red-200 px-2.5 py-1 font-medium text-red-500 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Implement SubAgentEditor.jsx**

```jsx
// frontend/src/components/SubAgentEditor.jsx
import { useState } from 'react'
import { TOOL_GROUPS, MODELS, SUBAGENT_TEMPLATES } from '../constants/tools'

const inputClass =
  'w-full rounded-xl border border-black/10 bg-white/80 px-4 py-2.5 text-sm text-neutral-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/40'

const labelClass = 'text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500'

const ICONS = ['🤖', '🎨', '⚙️', '🚀', '🔍', '📝', '🧪', '🛡️', '📊', '💡']

export function SubAgentEditor({ agent, isNew, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: agent?.name || '',
    icon: agent?.icon || '🤖',
    description: agent?.description || '',
    prompt: agent?.prompt || '',
    model: agent?.model || 'sonnet',
    inheritTools: !agent?.allowed_tools && !agent?.tools,
    tools: agent?.allowed_tools || agent?.tools || [],
  })

  const [showTemplates, setShowTemplates] = useState(isNew)

  const handleChange = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value })
  }

  const applyTemplate = (template) => {
    setForm({
      ...form,
      name: template.id,
      icon: template.icon,
      description: template.description,
      prompt: template.prompt,
      model: template.model,
      inheritTools: false,
      tools: template.defaultTools,
    })
    setShowTemplates(false)
  }

  const toggleTool = (toolName) => {
    const newTools = form.tools.includes(toolName)
      ? form.tools.filter((t) => t !== toolName)
      : [...form.tools, toolName]
    setForm({ ...form, tools: newTools })
  }

  const handleSave = () => {
    onSave({
      name: form.name,
      icon: form.icon,
      description: form.description,
      prompt: form.prompt,
      model: form.model,
      allowed_tools: form.inheritTools ? undefined : form.tools,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-800">
            {isNew ? 'Add Sub-Agent' : `Edit: ${agent?.name}`}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-neutral-400 hover:text-neutral-600"
          >
            ✕
          </button>
        </div>

        {/* Templates */}
        {showTemplates && (
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-neutral-600">Start from template</h3>
            <div className="grid grid-cols-3 gap-3">
              {SUBAGENT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="rounded-xl border border-black/10 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                >
                  <span className="text-2xl">{template.icon}</span>
                  <p className="mt-2 font-medium text-neutral-800">{template.name}</p>
                  <p className="text-xs text-neutral-500">{template.description}</p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                className="rounded-xl border border-dashed border-black/10 p-4 text-left transition hover:border-neutral-300"
              >
                <span className="text-2xl">📄</span>
                <p className="mt-2 font-medium text-neutral-800">Blank</p>
                <p className="text-xs text-neutral-500">Start from scratch</p>
              </button>
            </div>
          </div>
        )}

        {/* Form */}
        {!showTemplates && (
          <div className="space-y-5">
            {/* Identity */}
            <div className="grid gap-4 md:grid-cols-[auto_1fr]">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Icon</label>
                <div className="flex gap-1">
                  {ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setForm({ ...form, icon })}
                      className={`rounded-lg p-2 text-xl transition ${
                        form.icon === icon
                          ? 'bg-emerald-100 ring-2 ring-emerald-400'
                          : 'hover:bg-neutral-100'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  Agent Name <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputClass}
                  placeholder="frontend"
                  value={form.name}
                  onChange={handleChange('name')}
                  disabled={!isNew}
                  pattern="[a-z][a-z0-9-]*"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelClass}>
                Description (When to use) <span className="text-red-500">*</span>
              </label>
              <textarea
                className={`${inputClass} min-h-[80px]`}
                placeholder="Frontend development tasks including React components, Next.js pages..."
                value={form.description}
                onChange={handleChange('description')}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelClass}>
                System Prompt <span className="text-red-500">*</span>
              </label>
              <textarea
                className={`${inputClass} min-h-[160px] font-mono text-xs`}
                placeholder="You are a senior frontend engineer specializing in..."
                value={form.prompt}
                onChange={handleChange('prompt')}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelClass}>Model</label>
              <div className="flex gap-2">
                {MODELS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setForm({ ...form, model: m.value })}
                    className={`rounded-xl border px-4 py-2 text-sm transition ${
                      form.model === m.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-black/10 text-neutral-600 hover:border-black/20'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tools */}
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Allowed Tools</label>
              <div className="mb-2 flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={form.inheritTools}
                    onChange={() => setForm({ ...form, inheritTools: true })}
                  />
                  Inherit from main agent
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={!form.inheritTools}
                    onChange={() => setForm({ ...form, inheritTools: false })}
                  />
                  Select specific tools
                </label>
              </div>
              {!form.inheritTools && (
                <div className="flex flex-wrap gap-2">
                  {Object.values(TOOL_GROUPS)
                    .flatMap((g) => g.tools)
                    .filter((t) => t.name !== 'Task') // Sub-agents can't delegate
                    .map((tool) => (
                      <button
                        key={tool.name}
                        type="button"
                        onClick={() => toggleTool(tool.name)}
                        className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                          form.tools.includes(tool.name)
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-black/10 text-neutral-600 hover:border-black/20'
                        }`}
                      >
                        {tool.name}
                      </button>
                    ))}
                </div>
              )}
              <p className="text-xs text-neutral-400">
                Sub-agents cannot delegate to other sub-agents (no Task tool).
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-black/10 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!form.name || !form.description || !form.prompt}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300"
              >
                Save Sub-Agent
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/SubAgentCard.jsx frontend/src/components/SubAgentEditor.jsx
git commit -m "feat(frontend): implement SubAgentCard and SubAgentEditor

Add card view for sub-agents with template selection and tool configuration"
```

---

## Task 11: Frontend - Implement PreviewPanel

**Files:**
- Modify: `frontend/src/components/PreviewPanel.jsx`

**Step 1: Implement PreviewPanel.jsx**

```jsx
// frontend/src/components/PreviewPanel.jsx
import { useState, useMemo } from 'react'

export function PreviewPanel({ config, agents, skills, commands }) {
  const [activeTab, setActiveTab] = useState('files')
  const [viewingFile, setViewingFile] = useState(null)

  const files = useMemo(() => {
    const result = [{ path: '.claude/agent-config.json', type: 'config' }]

    Object.keys(agents || {}).forEach((name) => {
      result.push({ path: `.claude/agents/${name}.md`, type: 'agent', name })
    })

    Object.keys(skills || {}).forEach((name) => {
      result.push({ path: `.claude/skills/${name}/SKILL.md`, type: 'skill', name })
      const skill = skills[name]
      skill.resources?.forEach((r) => {
        result.push({ path: `.claude/skills/${name}/${r.path}`, type: 'resource', name })
      })
    })

    Object.keys(commands || {}).forEach((name) => {
      result.push({ path: `.claude/commands/${name}.md`, type: 'command', name })
    })

    return result
  }, [agents, skills, commands])

  const validation = useMemo(() => {
    const errors = []
    const warnings = []

    if (!config.id) errors.push('Config ID is required')
    if (!config.name) errors.push('Display Name is required')
    if (!config.allowed_tools?.length) errors.push('At least one tool must be enabled')

    Object.entries(agents || {}).forEach(([name, agent]) => {
      if (!agent.description) errors.push(`Sub-agent "${name}" missing description`)
      if (!agent.prompt) errors.push(`Sub-agent "${name}" missing system prompt`)
    })

    if (Object.keys(agents || {}).length > 0 && !config.allowed_tools?.includes('Task')) {
      warnings.push('Task tool not enabled - sub-agents won\'t work')
    }

    Object.entries(skills || {}).forEach(([name, skill]) => {
      if (!skill.description) errors.push(`Skill "${name}" missing description`)
      if (!skill.content) errors.push(`Skill "${name}" missing SKILL.md content`)
    })

    if (Object.keys(skills || {}).length > 0 && !config.allowed_tools?.includes('Skill')) {
      warnings.push('Skill tool not enabled - skills won\'t work')
    }

    Object.entries(commands || {}).forEach(([name, cmd]) => {
      if (!cmd.prompt) errors.push(`Command "/${name}" missing prompt`)
    })

    return { errors, warnings, passed: errors.length === 0 }
  }, [config, agents, skills, commands])

  const configJson = useMemo(() => {
    return JSON.stringify(config, null, 2)
  }, [config])

  const tabs = [
    { id: 'files', label: '📁 Files' },
    { id: 'config', label: '📄 Config' },
    { id: 'validate', label: validation.passed ? '✅ Validate' : '❌ Validate' },
  ]

  return (
    <div className="flex h-full flex-col rounded-2xl border border-black/5 bg-white/50">
      {/* Tabs */}
      <div className="flex border-b border-black/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'border-b-2 border-emerald-500 text-emerald-700'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'files' && (
          <div className="space-y-1 font-mono text-sm">
            <div className="text-neutral-500">📂 .claude/</div>
            {files.map((file) => (
              <div
                key={file.path}
                className="flex items-center justify-between py-1 pl-4"
              >
                <span className="text-neutral-700">
                  {file.path.replace('.claude/', '')}
                </span>
                <button
                  type="button"
                  onClick={() => setViewingFile(file)}
                  className="text-xs text-emerald-600 hover:text-emerald-700"
                >
                  👁 View
                </button>
              </div>
            ))}
            <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-500">
              <strong>Summary:</strong> {files.length} files |{' '}
              {Object.keys(agents || {}).length} sub-agents |{' '}
              {Object.keys(skills || {}).length} skills |{' '}
              {Object.keys(commands || {}).length} commands
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-neutral-500">agent-config.json</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(configJson)}
                className="text-xs text-emerald-600 hover:text-emerald-700"
              >
                Copy
              </button>
            </div>
            <pre className="overflow-auto rounded-xl bg-neutral-900 p-4 text-xs text-emerald-100">
              {configJson}
            </pre>
          </div>
        )}

        {activeTab === 'validate' && (
          <div className="space-y-4">
            <div
              className={`rounded-xl p-4 ${
                validation.passed
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              <strong>{validation.passed ? '✅ PASSED' : '❌ FAILED'}</strong>
              <span className="ml-2 text-sm">
                {validation.errors.length} errors, {validation.warnings.length} warnings
              </span>
            </div>

            {validation.errors.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-red-700">Errors</h4>
                {validation.errors.map((err, i) => (
                  <div key={i} className="text-sm text-red-600">
                    ❌ {err}
                  </div>
                ))}
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-orange-700">Warnings</h4>
                {validation.warnings.map((warn, i) => (
                  <div key={i} className="text-sm text-orange-600">
                    ⚠️ {warn}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* File Viewer Modal */}
      {viewingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
              <span className="font-mono text-sm text-neutral-700">{viewingFile.path}</span>
              <button
                type="button"
                onClick={() => setViewingFile(null)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>
            <pre className="max-h-[60vh] overflow-auto bg-neutral-50 p-4 font-mono text-xs text-neutral-800">
              {viewingFile.type === 'config' && configJson}
              {viewingFile.type === 'agent' &&
                `---\nname: ${viewingFile.name}\ndescription: ${agents[viewingFile.name]?.description}\n...\n---\n\n${agents[viewingFile.name]?.prompt}`}
              {viewingFile.type === 'skill' &&
                `---\ndescription: ${skills[viewingFile.name]?.description}\n---\n\n${skills[viewingFile.name]?.content}`}
              {viewingFile.type === 'command' &&
                `---\ndescription: ${commands[viewingFile.name]?.description}\nallowed-tools: ${commands[viewingFile.name]?.allowedTools || ''}\nargument-hint: ${commands[viewingFile.name]?.argumentHint || ''}\n---\n\n${commands[viewingFile.name]?.prompt}`}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/PreviewPanel.jsx
git commit -m "feat(frontend): implement PreviewPanel component

Add file tree, config preview, validation status, and file viewer modal"
```

---

## Task 12: Frontend - Integrate components into App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Add imports at top of App.jsx**

```jsx
import { ProfileTab } from './components/tabs/ProfileTab'
import { ToolboxTab } from './components/tabs/ToolboxTab'
import { SkillsTab } from './components/tabs/SkillsTab'
import { CommandsTab } from './components/tabs/CommandsTab'
import { SubAgentCard } from './components/SubAgentCard'
import { SubAgentEditor } from './components/SubAgentEditor'
import { PreviewPanel } from './components/PreviewPanel'
import { DEFAULT_TOOLS } from './constants/tools'
```

**Step 2: Add new state variables after existing useState calls (around line 66)**

```jsx
const [activeTab, setActiveTab] = useState('profile')
const [subAgents, setSubAgents] = useState({})
const [skills, setSkills] = useState({})
const [commands, setCommands] = useState({})
const [editingAgent, setEditingAgent] = useState(null)
const [isAddingAgent, setIsAddingAgent] = useState(false)
```

**Step 3: Update form initial state to use DEFAULT_TOOLS**

```jsx
const [form, setForm] = useState({
  configId: '',
  name: '',
  description: '',
  systemPrompt: '',
  useCustomPrompt: false,
  allowedTools: DEFAULT_TOOLS,
  permissionMode: 'bypassPermissions',
  maxTurns: '100',
  model: '',
  mcpServersJson: '',
  mcpEnvJson: '',
  bashMode: 'all',
  bashPatterns: [],
})
```

**Step 4: Update configPreview to include new fields**

```jsx
const configPreview = useMemo(() => {
  const config = {
    id: form.configId.trim() || undefined,
    name: form.name.trim() || undefined,
    description: form.description?.trim() || undefined,
    system_prompt: form.useCustomPrompt ? form.systemPrompt.trim() : undefined,
    permission_mode: form.permissionMode || undefined,
    max_turns: form.maxTurns ? Number(form.maxTurns) : undefined,
    model: form.model || undefined,
    allowed_tools: Array.isArray(form.allowedTools)
      ? form.allowedTools
      : parseList(form.allowedTools || ''),
  }

  if (mcpServersParsed.data) {
    config.mcp_servers = mcpServersParsed.data
  }

  if (Object.keys(subAgents).length > 0) {
    config.agents = subAgents
  }

  if (Object.keys(skills).length > 0) {
    config.skills = skills
  }

  if (Object.keys(commands).length > 0) {
    config.commands = commands
  }

  Object.keys(config).forEach((key) => {
    if (config[key] === undefined || Number.isNaN(config[key])) {
      delete config[key]
    }
  })

  return JSON.stringify(config, null, 2)
}, [form, mcpServersParsed.data, subAgents, skills, commands])
```

**Step 5: Replace the Agent Configuration section (around line 625-739) with new tabbed UI**

Replace the entire `<section className="glass reveal flex flex-col gap-5 p-6"...>` block with the new implementation that includes tabs and the PreviewPanel.

Due to the complexity, this will be done in a separate integration step.

**Step 6: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(frontend): integrate new components into App.jsx

Add tab navigation, sub-agents state, and preview panel integration"
```

---

## Task 13: End-to-end test

**Step 1: Start backend**

```bash
cd /Users/nxb/Documents/AIAssistant/AgentDeck/agent-deck/backend
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

**Step 2: Start frontend**

```bash
cd /Users/nxb/Documents/AIAssistant/AgentDeck/agent-deck/frontend
npm run dev
```

**Step 3: Test the new UI**

1. Open http://localhost:5173
2. Navigate through Profile, Toolbox, Skills, Commands tabs
3. Add a sub-agent using the template
4. Add a skill
5. Add a command
6. Verify Preview Panel shows correct file structure
7. Launch an agent and verify it works

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete agent customization feature

- Add setting_sources to SDK initialization
- Add claude directory generator
- Implement all UI tabs (Profile, Toolbox, Skills, Commands)
- Implement SubAgent cards and editor with templates
- Implement Preview Panel with validation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add setting_sources to SDK | `agent_server.py` |
| 2 | Create claude generator | `claude_generator.py` |
| 3 | Integrate generator | `docker_mgr.py` |
| 4 | Create component structure | `components/` |
| 5 | Extract constants | `constants/tools.js` |
| 6 | Implement ProfileTab | `ProfileTab.jsx` |
| 7 | Implement ToolboxTab | `ToolboxTab.jsx` |
| 8 | Implement SkillsTab | `SkillsTab.jsx` |
| 9 | Implement CommandsTab | `CommandsTab.jsx` |
| 10 | Implement SubAgent components | `SubAgentCard.jsx`, `SubAgentEditor.jsx` |
| 11 | Implement PreviewPanel | `PreviewPanel.jsx` |
| 12 | Integrate into App.jsx | `App.jsx` |
| 13 | End-to-end test | - |
