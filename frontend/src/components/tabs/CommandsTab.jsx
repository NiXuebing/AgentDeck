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
    if (!window.confirm(`删除命令 "/${name}"？`)) return
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
            <h3 className="text-sm font-semibold text-neutral-700">Slash 命令</h3>
            <p className="mt-1 text-xs text-neutral-500">
              在聊天中输入 /{'{name}'} 可手动触发命令。
            </p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + 添加命令
          </button>
        </div>
      </div>

      {/* Command List */}
      {commandList.length === 0 && !editingCommand ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-8 text-center">
          <p className="text-sm text-neutral-500">尚未定义命令。</p>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-3 text-sm font-medium text-emerald-600 hover:text-emerald-700"
          >
            + 创建第一个命令
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
                  <p className="mt-1 text-sm text-neutral-500">{command.description || '无描述'}</p>
                  <div className="mt-2 flex gap-3 text-xs text-neutral-400">
                    {command.argumentHint && <span>参数：{command.argumentHint}</span>}
                    {command.model && <span>模型：{command.model}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(name, command)}
                    className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(name)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    删除
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
            {isAdding ? '添加命令' : `编辑：/${editingCommand.name}`}
          </h3>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  命令名称 <span className="text-red-500">*</span>
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
                <label className={labelClass}>描述</label>
                <input
                  className={inputClass}
                  placeholder="审查代码变更"
                  value={editingCommand.description}
                  onChange={(e) => setEditingCommand({ ...editingCommand, description: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>参数提示</label>
                <input
                  className={inputClass}
                  placeholder="[pr-number] [--verbose]"
                  value={editingCommand.argumentHint}
                  onChange={(e) => setEditingCommand({ ...editingCommand, argumentHint: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>模型</label>
                <select
                  className={inputClass}
                  value={editingCommand.model}
                  onChange={(e) => setEditingCommand({ ...editingCommand, model: e.target.value })}
                >
                  <option value="">继承 Agent</option>
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>允许的工具</label>
              <input
                className={inputClass}
                placeholder="Read, Grep, Glob, Bash(git diff:*)"
                value={editingCommand.allowedTools}
                onChange={(e) => setEditingCommand({ ...editingCommand, allowedTools: e.target.value })}
              />
              <p className="text-xs text-neutral-400">逗号分隔。留空则继承 Agent。</p>
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}>
                提示词模板 <span className="text-red-500">*</span>
              </label>
              <textarea
                className={`${inputClass} min-h-[160px] font-mono text-xs`}
                placeholder="审查 PR #$1 的代码变更&#10;&#10;重点关注：&#10;1. 安全漏洞&#10;2. 性能问题"
                value={editingCommand.prompt}
                onChange={(e) => setEditingCommand({ ...editingCommand, prompt: e.target.value })}
              />
              <p className="text-xs text-neutral-400">
                使用 $1、$2 表示位置参数，$ARGUMENTS 表示所有参数。
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
                取消
              </button>
              <button
                type="button"
                onClick={() => handleSave(editingCommand)}
                disabled={!editingCommand.name || !editingCommand.prompt}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300"
              >
                保存命令
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
