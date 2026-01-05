import { ChatMessage } from './ChatMessage'

export function StagePanel({
  messages,
  onSend,
  input,
  onInput,
  logsOpen,
  onToggleLogs,
  renderLogs,
  isReloading,
  showArchitect,
  architectPrompt,
  onArchitectPrompt,
  onArchitectSubmit,
  showKeyPrompt,
  architectApiKey,
  onArchitectApiKey,
  architectError,
  onAddSuggestedTools,
  onRetry,
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      {isReloading ? (
        <div
          className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700"
          data-testid="stage-reloading"
        >
          Reloading
        </div>
      ) : null}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Stage</h2>
          <p className="text-xs text-neutral-500">Live agent interaction.</p>
        </div>
        <button className="btn-ghost" onClick={onToggleLogs} type="button">
          Logs
        </button>
      </header>
      {showArchitect ? (
        <section className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Architect
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                Describe the agent you want to build and let the blueprint generator draft it.
              </p>
            </div>
            <button
              className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white"
              onClick={onArchitectSubmit}
              type="button"
            >
              Generate
            </button>
          </div>
          <textarea
            className="mt-3 min-h-[120px] w-full rounded-xl border border-black/10 bg-white/80 px-4 py-2.5 text-xs text-neutral-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            placeholder="Describe the agent mission, tone, and tools..."
            value={architectPrompt}
            onChange={(event) => onArchitectPrompt?.(event.target.value)}
          />
          {showKeyPrompt ? (
            <div className="mt-3 rounded-xl border border-black/10 bg-white/80 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                API Key
              </p>
              <input
                className="mt-2 w-full rounded-lg border border-black/10 bg-white/90 px-3 py-2 text-xs text-neutral-900"
                placeholder="Paste ANTHROPIC_API_KEY for this session"
                value={architectApiKey}
                onChange={(event) => onArchitectApiKey?.(event.target.value)}
              />
            </div>
          ) : null}
          {architectError ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-700">
              Blueprint generation failed: {architectError}
            </div>
          ) : null}
        </section>
      ) : null}
      <div className="glass-strong flex min-h-[240px] flex-col gap-3 overflow-y-auto p-4">
        {messages?.length ? (
          messages.map((message, index) => (
            <ChatMessage
              key={`${message.role}-${index}`}
              message={message}
              onAddSuggestedTools={onAddSuggestedTools}
              onRetry={onRetry}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 px-4 py-6 text-sm text-neutral-500">
            Send a message to start.
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          className="w-full rounded-xl border border-black/10 bg-white/80 px-4 py-2 text-sm text-neutral-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          placeholder="Message"
          value={input}
          onChange={(event) => onInput(event.target.value)}
        />
        <button className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white" onClick={onSend}>
          Send
        </button>
      </div>
      {logsOpen ? <div className="rounded-2xl border border-black/10 bg-white/80 p-3">{renderLogs?.()}</div> : null}
    </div>
  )
}
