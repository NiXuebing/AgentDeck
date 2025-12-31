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
