export function LogsDrawer({ open, onClose, children }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/20 p-4">
      <div
        className="w-full max-w-4xl rounded-2xl border border-black/10 bg-white/95 p-4 shadow-xl"
        data-testid="logs-drawer"
      >
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Logs</div>
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-neutral-600"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-3 max-h-[40vh] overflow-y-auto rounded-xl border border-black/5 bg-white/70 p-3">
          {children}
        </div>
      </div>
    </div>
  )
}
