import { useEffect, useMemo, useState } from 'react'
import { TOOL_LABELS } from '../../constants/tools'

export function CommandPalette({ open, options, onClose, onSelect }) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) {
      setQuery('')
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => option.toLowerCase().includes(q))
  }, [options, query])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 p-4">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white/95 p-4 shadow-xl">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Add</div>
        <input
          className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          placeholder="Search tools..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="mt-3 max-h-64 overflow-y-auto">
          {filtered.length ? (
            filtered.map((option) => (
              <button
                key={option}
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100"
                onClick={() => {
                  onSelect?.(option)
                  onClose?.(true)
                }}
              >
                <span>{TOOL_LABELS[option] || option}</span>
                <span className="text-xs text-neutral-400">{option}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-neutral-500">No matches</div>
          )}
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-600"
          onClick={() => onClose?.(true)}
        >
          Close
        </button>
      </div>
    </div>
  )
}
