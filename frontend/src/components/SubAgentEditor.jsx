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
            {isNew ? '添加子 Agent' : `编辑：${agent?.name}`}
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
            <h3 className="mb-3 text-sm font-medium text-neutral-600">从模板开始</h3>
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
                <p className="mt-2 font-medium text-neutral-800">空白</p>
                <p className="text-xs text-neutral-500">从零开始</p>
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
                <label className={labelClass}>图标</label>
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
                  Agent 名称 <span className="text-red-500">*</span>
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
                描述（适用场景） <span className="text-red-500">*</span>
              </label>
              <textarea
                className={`${inputClass} min-h-[80px]`}
                placeholder="前端开发任务，包括 React 组件、Next.js 页面..."
                value={form.description}
                onChange={handleChange('description')}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelClass}>
                系统提示词 <span className="text-red-500">*</span>
              </label>
              <textarea
                className={`${inputClass} min-h-[160px] font-mono text-xs`}
                placeholder="你是一位资深前端工程师，擅长..."
                value={form.prompt}
                onChange={handleChange('prompt')}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelClass}>模型</label>
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
              <label className={labelClass}>允许的工具</label>
              <div className="mb-2 flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={form.inheritTools}
                    onChange={() => setForm({ ...form, inheritTools: true })}
                  />
                  继承主 Agent
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={!form.inheritTools}
                    onChange={() => setForm({ ...form, inheritTools: false })}
                  />
                  选择指定工具
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
                子 Agent 不能再委派给其他子 Agent（无 Task 工具）。
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-black/10 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!form.name || !form.description || !form.prompt}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300"
              >
                保存子 Agent
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
