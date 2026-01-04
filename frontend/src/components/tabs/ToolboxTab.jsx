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
              全选
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
                  允许所有命令
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
                  限定为特定模式
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
                      添加
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
          <h3 className="text-sm font-semibold text-neutral-700">MCP 服务器</h3>
          <button
            type="button"
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
          >
            + 添加服务器
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <label className={labelClass}>MCP 服务器（JSON）</label>
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
