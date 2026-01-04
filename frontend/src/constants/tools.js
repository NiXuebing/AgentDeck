// frontend/src/constants/tools.js

export const TOOL_GROUPS = {
  file: {
    label: '文件操作',
    tools: [
      { name: 'Read', description: '读取文件内容', default: true },
      { name: 'Write', description: '创建/覆盖文件', default: true },
      { name: 'Edit', description: '编辑文件片段', default: true },
      { name: 'Grep', description: '搜索文件内容', default: true },
      { name: 'Glob', description: '按模式查找文件', default: true },
    ],
  },
  execution: {
    label: '执行',
    tools: [
      { name: 'Bash', description: '执行 shell 命令', default: true, hasPatterns: true },
    ],
  },
  web: {
    label: '网络',
    tools: [
      { name: 'WebSearch', description: '搜索互联网', default: true },
      { name: 'WebFetch', description: '抓取 URL 内容', default: true },
    ],
  },
  task: {
    label: '任务管理',
    tools: [
      { name: 'TodoWrite', description: '管理任务列表', default: true },
      { name: 'NotebookEdit', description: '编辑 Jupyter notebooks', default: false },
    ],
  },
  agent: {
    label: 'Agent 委派',
    tools: [
      { name: 'Task', description: '委派给子 Agent', default: true },
      { name: 'Skill', description: '调用技能', default: true },
    ],
  },
  mcp: {
    label: 'MCP',
    tools: [
      { name: 'ListMcpResources', description: '列出 MCP 资源', default: false },
      { name: 'ReadMcpResource', description: '读取 MCP 资源', default: false },
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
  { value: 'inherit', label: '继承父级' },
  { value: 'sonnet', label: 'Sonnet（均衡）' },
  { value: 'opus', label: 'Opus（最强）' },
  { value: 'haiku', label: 'Haiku（快速）' },
]

export const PERMISSION_MODES = [
  { value: 'default', label: '默认（全部询问）' },
  { value: 'acceptEdits', label: '接受编辑（自动批准文件变更）' },
  { value: 'plan', label: '计划（不执行）' },
  { value: 'bypassPermissions', label: '跳过权限（自动全部允许）' },
]

export const SUBAGENT_TEMPLATES = [
  {
    id: 'frontend',
    icon: '🎨',
    name: '前端',
    description: 'React、Next.js、TypeScript、CSS',
    defaultTools: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'TodoWrite'],
    model: 'sonnet',
    prompt: `你是一位资深前端工程师，擅长：

- React 18+（hooks 与现代模式）
- Next.js 14+（App Router、Server Components）
- TypeScript 严格模式
- Tailwind CSS 与 CSS-in-JS
- 状态管理（Zustand、React Query）

最佳实践：
- 组件组合优于继承
- 可访问性（WCAG 2.1 AA）
- 性能优化`,
  },
  {
    id: 'backend',
    icon: '⚙️',
    name: '后端',
    description: 'Python、Node.js、API、数据库',
    defaultTools: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'Bash', 'TodoWrite'],
    model: 'sonnet',
    prompt: `你是一位资深后端工程师，擅长：

- Python（FastAPI、Django）
- Node.js（Express、NestJS）
- 数据库设计（PostgreSQL、MongoDB）
- API 设计（REST、GraphQL）
- 认证与安全`,
  },
  {
    id: 'devops',
    icon: '🚀',
    name: 'DevOps',
    description: 'Docker、Kubernetes、CI/CD',
    defaultTools: ['Read', 'Write', 'Bash', 'TodoWrite'],
    model: 'haiku',
    prompt: `你是一位 DevOps 工程师，擅长：

- Docker 容器化
- Kubernetes 编排
- CI/CD 流水线（GitHub Actions、GitLab CI）
- 云平台（AWS、GCP、Azure）
- 基础设施即代码（Terraform）`,
  },
  {
    id: 'researcher',
    icon: '🔍',
    name: '研究',
    description: '网络调研、数据收集',
    defaultTools: ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'TodoWrite'],
    model: 'haiku',
    prompt: `你是一位研究助理，擅长：

- 网络调研与数据收集
- 技术文档总结
- 查找相关代码示例
- 对比库与框架`,
  },
  {
    id: 'writer',
    icon: '📝',
    name: '写作',
    description: '文档、内容',
    defaultTools: ['Read', 'Write', 'Edit', 'Grep', 'TodoWrite'],
    model: 'opus',
    prompt: `你是一位技术写作者，擅长：

- 清晰简洁的文档
- API 文档
- README 与使用指南
- 代码注释与 JSDoc`,
  },
  {
    id: 'tester',
    icon: '🧪',
    name: '测试',
    description: '单元测试、E2E、覆盖率',
    defaultTools: ['Read', 'Write', 'Edit', 'Bash', 'TodoWrite'],
    model: 'sonnet',
    prompt: `你是一位 QA 工程师，擅长：

- 单元测试（Jest、Pytest、Vitest）
- 集成测试
- E2E 测试（Playwright、Cypress）
- 测试覆盖率与质量`,
  },
]
