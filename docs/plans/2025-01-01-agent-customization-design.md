# Agent Customization Feature Design

> 设计日期：2025-01-01
> 状态：待实现

## 1. 项目概述

### 1.1 目标

在 AgentDeck 前端新增可视化配置界面，支持用户定制：
- **Sub-agents**：专门化的子代理
- **Skills**：自动触发的能力模块
- **Slash Commands**：手动触发的快捷命令

配置完成后，这些文件会被注入到 Docker 容器的 `.claude/` 目录，SDK 自动加载并使用。

### 1.2 技术栈

- **前端**：React + Vite（现有 `frontend/src/App.jsx`）
- **后端**：FastAPI + Docker（现有 `backend/app/`）
- **容器运行时**：Claude Agent SDK（`backend/runtime_base/container/agent_server.py`）

---

## 2. 当前状态分析

### 2.1 已实现功能

| 功能 | 状态 | 位置 |
|------|------|------|
| Agent 基本配置 | ✅ 已实现 | `App.jsx` 表单 |
| System Prompt | ✅ 已实现 | textarea |
| Allowed Tools | ✅ 已实现 | 逗号分隔输入 |
| Permission Mode | ✅ 已实现 | select |
| Max Turns | ✅ 已实现 | number input |
| MCP Servers | ✅ 已实现 | JSON textarea |
| MCP Environment | ✅ 已实现 | JSON textarea |

### 2.2 待实现功能

| 功能 | 状态 | 说明 |
|------|------|------|
| Sub-agents UI | ❌ 未实现 | 需要卡片式编辑器 |
| Skills UI | ❌ 未实现 | 需要目录结构编辑器 |
| Commands UI | ❌ 未实现 | 需要 Markdown 编辑器 |
| Toolbox 分组 | ❌ 未实现 | 当前是简单输入框 |
| Preview Panel | ❌ 未实现 | 需要文件树预览 |

### 2.3 后端关键问题

**`agent_server.py` 缺失 `setting_sources` 配置！**

当前代码（第 154-158 行）：
```python
options_dict = {
    "cwd": "/workspace",
    "allowed_tools": self.config.get("allowed_tools", ["Bash", "Read", "Write"]),
    "permission_mode": self.config.get("permission_mode", "acceptEdits"),
}
```

需要添加：
```python
options_dict = {
    "cwd": "/workspace",
    "setting_sources": ["project"],  # 新增
    "allowed_tools": ...,
    "permission_mode": ...,
}
```

---

## 3. SDK 配置规范

### 3.1 Sub-agents (AgentDefinition)

**文件位置**：`.claude/agents/{name}.md`

**格式**：
```markdown
---
name: frontend
description: >-
  Frontend development tasks including React components,
  Next.js pages, CSS styling, TypeScript interfaces.
tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - TodoWrite
model: sonnet
---

You are a senior frontend engineer specializing in:
- React 18+ with hooks and modern patterns
- Next.js 14+ (App Router, Server Components)
- TypeScript with strict mode
```

**字段说明**：

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| name | ✅ | string | 代理标识符，小写字母+数字+连字符 |
| description | ✅ | string | 告诉主代理何时委派任务 |
| tools | ❌ | string[] | 允许的工具，空则继承主代理 |
| model | ❌ | enum | sonnet / opus / haiku / inherit |
| (body) | ✅ | string | 子代理的系统提示 |

### 3.2 Skills

**文件位置**：`.claude/skills/{name}/SKILL.md`

**格式**：
```markdown
---
description: >-
  Review code for bugs, security vulnerabilities, and
  performance issues. Use when asked to review, audit, or
  check code quality.
---

# Code Review Guidelines

## Process
1. Read through the entire file first
2. Check for security vulnerabilities
3. Review for performance issues

## References
- See [security-checklist.md](security-checklist.md)
```

**字段说明**：

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| description | ✅ | string | 决定何时自动触发 |
| (body) | ✅ | string | 技能指令内容 |

**注意**：`allowed-tools` 在 SDK 中无效，仅 CLI 支持。

### 3.3 Slash Commands

**文件位置**：`.claude/commands/{name}.md`

**格式**：
```markdown
---
description: Review code changes and provide feedback
allowed-tools: Read, Grep, Glob, Bash(git diff:*)
argument-hint: [pr-number]
model: sonnet
---

Review the code changes for PR #$1

Focus on:
1. Security vulnerabilities
2. Performance issues
3. Code style and best practices
```

**字段说明**：

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| description | ❌ | string | 命令描述 |
| allowed-tools | ❌ | string | 逗号分隔的工具列表 |
| argument-hint | ❌ | string | 参数提示 |
| model | ❌ | string | 模型选择 |
| (body) | ✅ | string | 命令提示词模板 |

**占位符**：
- `$1`, `$2` - 位置参数
- `$ARGUMENTS` - 所有参数

---

## 4. UI 设计方案

### 4.1 整体架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Navigation Bar                                         [Launch] [Save]  │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐  ┌────────────────────────┐ │
│  │         CONFIGURATION PANEL            │  │     PREVIEW PANEL      │ │
│  │              (60%)                      │  │        (40%)           │ │
│  │                                        │  │                        │ │
│  │  ┌──────────────────────────────────┐ │  │  - Files Tab           │ │
│  │  │  MAIN AGENT                       │ │  │  - Config Tab          │ │
│  │  │  [Profile][Toolbox][Skills][Cmds] │ │  │  - Validate Tab        │ │
│  │  │                                   │ │  │                        │ │
│  │  │  [Tab Content Area]               │ │  │                        │ │
│  │  │                                   │ │  │                        │ │
│  │  └──────────────────────────────────┘ │  │                        │ │
│  │                                        │  │                        │ │
│  │  ┌──────────────────────────────────┐ │  │                        │ │
│  │  │  TEAM (Sub-agents)       [+Add]  │ │  │                        │ │
│  │  │  [Card] [Card] [Card]             │ │  │                        │ │
│  │  └──────────────────────────────────┘ │  │                        │ │
│  └────────────────────────────────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Profile Tab

**字段**：
- Config ID* (string, `^[a-z0-9-]+$`)
- Display Name* (string)
- Description (string)
- System Prompt (string | preset)
- Permission Mode (enum: default, acceptEdits, plan, bypassPermissions)
- Max Turns (number, 1-1000)
- Model (string)

### 4.3 Toolbox Tab

**工具分组**：

| 分组 | 工具 | 默认 |
|------|------|------|
| File Operations | Read, Write, Edit, Grep, Glob | ✅ |
| Execution | Bash (支持模式限制) | ✅ |
| Web | WebSearch, WebFetch | ✅ |
| Task Management | TodoWrite, NotebookEdit | TodoWrite ✅ |
| Agent Delegation | Task, Skill | ✅ |
| MCP | ListMcpResources, ReadMcpResource, mcp__*__* | 自动 |

**Bash 模式限制**：
```
○ Allow all commands
● Restrict to patterns:
  [git:*] [npm:*] [python:*]
  [+ Add Pattern]
```

**MCP Servers 配置**：
- 服务器名称
- 类型 (stdio / http / sse)
- Command / URL
- Arguments / Headers
- Environment Variables

### 4.4 Skills Tab

**列表视图**：
```
┌─────────────────────────────────────────────────────┐
│ 📘 code-reviewer                         [Edit][Del]│
│    "Review code for bugs, security..."              │
│    📄 SKILL.md (245 lines)                         │
├─────────────────────────────────────────────────────┤
│ 📘 tdd-workflow                          [Edit][Del]│
│    "Guide test-driven development..."               │
│    📄 SKILL.md (180 lines) + 2 resources           │
└─────────────────────────────────────────────────────┘
```

**编辑器（侧滑面板）**：
- Skill Name* (目录名)
- Description* (触发条件)
- Instructions (SKILL.md 内容，Markdown 编辑器)
- Resource Files (可添加多个辅助文件)

### 4.5 Commands Tab

**列表视图**：
```
┌─────────────────────────────────────────────────────┐
│ ⚡ /review                               [Edit][Del]│
│    "Review code changes and provide feedback"       │
│    Args: [pr-number]  │  Model: inherit            │
├─────────────────────────────────────────────────────┤
│ ⚡ /commit                               [Edit][Del]│
│    "Create a conventional commit message"           │
│    Args: [type] [message]  │  Model: haiku         │
└─────────────────────────────────────────────────────┘
```

**编辑器（侧滑面板）**：
- Command Name* (文件名，无 `/` 前缀)
- Description
- Argument Hint
- Allowed Tools (逗号分隔，支持 Bash 模式)
- Model (inherit / sonnet / opus / haiku)
- Prompt Template* (Markdown，支持 $1, $ARGUMENTS 占位符)

### 4.6 Sub-agents (Team)

**卡片视图**：
```
┌─────────────────────┐ ┌─────────────────────┐
│ 🎨 frontend         │ │ ⚙️ backend          │
│                     │ │                     │
│ React, Next.js,     │ │ Python, FastAPI,    │
│ TypeScript expert   │ │ Database expert     │
│                     │ │                     │
│ Model: sonnet       │ │ Model: sonnet       │
│ Tools: 5 enabled    │ │ Tools: 6 enabled    │
│                     │ │                     │
│ [Edit]    [Delete]  │ │ [Edit]    [Delete]  │
└─────────────────────┘ └─────────────────────┘
```

**编辑器（侧滑面板）**：
- Agent Name* (key，小写)
- Icon (emoji 选择器)
- Description* (何时使用)
- System Prompt* (行为定义)
- Model (inherit / sonnet / opus / haiku)
- Allowed Tools (复选框，或继承主代理)

**预设模板**：
| 模板 | Icon | 描述 | 默认工具 |
|------|------|------|----------|
| Frontend | 🎨 | React, Next.js, CSS | Read, Write, Edit, Grep, Glob, TodoWrite |
| Backend | ⚙️ | Python, Node.js, APIs | Read, Write, Edit, Grep, Glob, Bash, TodoWrite |
| DevOps | 🚀 | Docker, K8s, CI/CD | Read, Write, Bash(docker:\*, kubectl:\*), TodoWrite |
| Researcher | 🔍 | Web research | Read, Grep, WebSearch, WebFetch, TodoWrite |
| Writer | 📝 | Documentation | Read, Write, Edit, Grep, TodoWrite |
| Tester | 🧪 | Unit tests, E2E | Read, Write, Edit, Bash(npm test:\*, pytest:\*), TodoWrite |
| Security | 🛡️ | Security audit | Read, Grep, Glob, Bash(npm audit:\*), TodoWrite |
| Data | 📊 | Analysis | Read, Write, Grep, Bash(python:\*), NotebookEdit, TodoWrite |

### 4.7 Preview Panel

**三个 Tab**：

1. **Files Tab** - 文件结构树
```
📂 .claude/
├── 📄 agent-config.json
├── 📂 agents/
│   ├── 📄 frontend.md    [👁 View]
│   └── 📄 backend.md     [👁 View]
├── 📂 skills/
│   └── 📂 code-reviewer/
│       └── 📄 SKILL.md   [👁 View]
└── 📂 commands/
    └── 📄 review.md      [👁 View]
```

2. **Config Tab** - JSON 配置预览（agent-config.json 内容）

3. **Validate Tab** - 验证状态
   - Required Fields 检查
   - Sub-agents 检查（description, prompt, Task tool）
   - Skills 检查（description, SKILL.md, Skill tool）
   - Commands 检查（prompt content, name format）
   - MCP Servers 检查

---

## 5. 文件结构输出

### 5.1 目录结构

```
.claude/
├── agent-config.json          # 主配置（AgentDeck）
├── agents/                    # Sub-agents
│   ├── frontend.md
│   ├── backend.md
│   └── devops.md
├── skills/                    # Skills
│   ├── code-reviewer/
│   │   ├── SKILL.md
│   │   └── security-checklist.md
│   └── tdd-workflow/
│       ├── SKILL.md
│       └── examples.md
└── commands/                  # Slash Commands
    ├── review.md
    ├── commit.md
    └── test.md
```

### 5.2 注入流程

```
Frontend UI          Backend API           Docker Container
     │                    │                       │
     │  POST /configs     │                       │
     │  { config }        │                       │
     │───────────────────>│                       │
     │                    │                       │
     │                    │  1. Generate .claude/ │
     │                    │     files             │
     │                    │                       │
     │                    │  2. Write to          │
     │                    │     runtime_state/    │
     │                    │                       │
     │  POST /agents/     │                       │
     │  launch            │                       │
     │───────────────────>│                       │
     │                    │                       │
     │                    │  3. Start container   │
     │                    │     with .claude/     │
     │                    │────────────────────────>
     │                    │                       │
     │                    │     SDK Options:      │
     │                    │     - cwd=/workspace  │
     │                    │     - setting_sources │
     │                    │       =["project"]    │
```

---

## 6. 后端修改要求

### 6.1 agent_server.py 修改

**位置**：`backend/runtime_base/container/agent_server.py`

**修改内容**（第 154-158 行）：

```python
# Before
options_dict = {
    "cwd": "/workspace",
    "allowed_tools": self.config.get("allowed_tools", ["Bash", "Read", "Write"]),
    "permission_mode": self.config.get("permission_mode", "acceptEdits"),
}

# After
options_dict = {
    "cwd": "/workspace",
    "setting_sources": ["project"],  # 新增：加载 .claude/ 目录
    "allowed_tools": self.config.get("allowed_tools", ["Bash", "Read", "Write"]),
    "permission_mode": self.config.get("permission_mode", "acceptEdits"),
}
```

### 6.2 docker_mgr.py 修改

需要在容器启动时将 `.claude/` 目录挂载或写入到 `/workspace/.claude/`。

### 6.3 API 端点

**新增/修改**：

```
POST /api/configs/custom
Body: {
  config: AgentConfig,
  agents: { [name]: AgentDefinition },
  skills: { [name]: SkillDefinition },
  commands: { [name]: CommandDefinition }
}
Response: {
  config_id: string,
  files_generated: string[]
}
```

---

## 7. 实现计划

### Phase 1: 后端基础（优先）
- [ ] 修改 `agent_server.py` 添加 `setting_sources`
- [ ] 修改 `docker_mgr.py` 支持 `.claude/` 目录写入
- [ ] 新增 API 端点生成 `.claude/` 文件

### Phase 2: 前端重构
- [ ] 重构 `App.jsx` 为组件化结构
- [ ] 实现 Tab 导航系统
- [ ] 实现 Profile Tab
- [ ] 实现 Toolbox Tab（工具分组 + MCP 编辑器）

### Phase 3: 高级配置
- [ ] 实现 Skills Tab（列表 + 编辑器）
- [ ] 实现 Commands Tab（列表 + 编辑器）
- [ ] 实现 Sub-agents 卡片 + 编辑器
- [ ] 实现预设模板

### Phase 4: Preview & 验证
- [ ] 实现 Preview Panel（Files/Config/Validate）
- [ ] 实现文件内容预览弹窗
- [ ] 实现配置验证逻辑
- [ ] 端到端测试

---

## 8. 附录

### 8.1 完整工具列表

| 分类 | 工具 | 描述 |
|------|------|------|
| File | Read | 读取文件内容 |
| File | Write | 创建/覆盖文件 |
| File | Edit | 编辑文件特定部分 |
| File | Grep | 正则搜索文件内容 |
| File | Glob | 文件模式匹配 |
| Execution | Bash | 执行 shell 命令 |
| Web | WebSearch | 搜索互联网 |
| Web | WebFetch | 获取 URL 内容 |
| Task | TodoWrite | 任务列表管理 |
| Task | NotebookEdit | Jupyter Notebook 编辑 |
| Agent | Task | 委派任务给子代理 |
| Agent | Skill | 调用已定义的技能 |
| MCP | ListMcpResources | 列出 MCP 资源 |
| MCP | ReadMcpResource | 读取 MCP 资源 |
| MCP | mcp__{server}__{tool} | 动态 MCP 工具 |

### 8.2 Bash 模式示例

```
Bash                # 允许所有命令
Bash(git:*)         # 只允许 git 命令
Bash(git add:*)     # 只允许 git add
Bash(npm:*)         # 只允许 npm 命令
Bash(git:*, npm:*)  # 允许 git 和 npm
```

### 8.3 TypeScript 类型定义

```typescript
// Sub-agent
interface AgentDefinition {
  description: string;      // 必填
  prompt: string;           // 必填
  allowed_tools?: string[];
  model?: 'inherit' | 'sonnet' | 'opus' | 'haiku';
}

// Skill
interface SkillDefinition {
  name: string;             // 目录名
  description: string;      // 必填
  content: string;          // SKILL.md 内容
  resources?: {             // 辅助文件
    path: string;
    content: string;
  }[];
}

// Command
interface CommandDefinition {
  name: string;             // 文件名
  description?: string;
  allowedTools?: string;
  argumentHint?: string;
  model?: string;
  prompt: string;           // 必填
}

// Main config
interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  allowed_tools: string[];
  system_prompt?: string;
  permission_mode?: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';
  max_turns?: number;
  model?: string;
  mcp_servers?: Record<string, McpServerConfig>;
  agents?: Record<string, AgentDefinition>;
  skills?: Record<string, SkillDefinition>;
  commands?: Record<string, CommandDefinition>;
}
```
