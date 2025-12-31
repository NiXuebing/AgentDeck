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
