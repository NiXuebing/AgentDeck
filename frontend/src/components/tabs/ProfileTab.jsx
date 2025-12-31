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
