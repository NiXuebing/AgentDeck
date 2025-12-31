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
