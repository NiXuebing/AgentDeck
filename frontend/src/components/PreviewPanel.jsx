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

    if (!config.id) errors.push('需要配置 ID')
    if (!config.name) errors.push('需要显示名称')
    if (!config.allowed_tools?.length) errors.push('至少启用一个工具')

    Object.entries(agents || {}).forEach(([name, agent]) => {
      if (!agent.description) errors.push(`子 Agent "${name}" 缺少描述`)
      if (!agent.prompt) errors.push(`子 Agent "${name}" 缺少系统提示词`)
    })

    if (Object.keys(agents || {}).length > 0 && !config.allowed_tools?.includes('Task')) {
      warnings.push('未启用 Task 工具，子 Agent 将无法工作')
    }

    Object.entries(skills || {}).forEach(([name, skill]) => {
      if (!skill.description) errors.push(`Skill "${name}" 缺少描述`)
      if (!skill.content) errors.push(`Skill "${name}" 缺少 SKILL.md 内容`)
    })

    if (Object.keys(skills || {}).length > 0 && !config.allowed_tools?.includes('Skill')) {
      warnings.push('未启用 Skill 工具，技能将无法工作')
    }

    Object.entries(commands || {}).forEach(([name, cmd]) => {
      if (!cmd.prompt) errors.push(`命令 "/${name}" 缺少提示词`)
    })

    return { errors, warnings, passed: errors.length === 0 }
  }, [config, agents, skills, commands])

  const configJson = useMemo(() => {
    return JSON.stringify(config, null, 2)
  }, [config])

  const tabs = [
    { id: 'files', label: '📁 文件' },
    { id: 'config', label: '📄 配置' },
    { id: 'validate', label: validation.passed ? '✅ 校验' : '❌ 校验' },
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
                  👁 查看
                </button>
              </div>
            ))}
            <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-500">
              <strong>汇总：</strong> {files.length} 个文件 |{' '}
              {Object.keys(agents || {}).length} 个子 Agent |{' '}
              {Object.keys(skills || {}).length} 个技能 |{' '}
              {Object.keys(commands || {}).length} 个命令
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
                复制
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
              <strong>{validation.passed ? '✅ 通过' : '❌ 未通过'}</strong>
              <span className="ml-2 text-sm">
                {validation.errors.length} 个错误，{validation.warnings.length} 个警告
              </span>
            </div>

            {validation.errors.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-red-700">错误</h4>
                {validation.errors.map((err, i) => (
                  <div key={i} className="text-sm text-red-600">
                    ❌ {err}
                  </div>
                ))}
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-orange-700">警告</h4>
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
