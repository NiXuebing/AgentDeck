function RunView({
  selectedAgentId,
  selectedAgent,
  isAgentRunning,
  onStopAgent,
  onStartAgent,
  onConfigure,
  messages,
  messageInput,
  onMessageInput,
  onSendMessage,
  isStreaming,
  messagesEndRef,
  terminalHostRef,
  onClearLogs,
  wsBase,
}) {
  const statusLabel = selectedAgent?.status || 'idle'
  const statusStyle =
    statusLabel === 'running'
      ? { badge: 'status-running', dot: 'bg-emerald-600' }
      : statusLabel === 'stopped'
        ? { badge: 'status-stopped', dot: 'bg-orange-500' }
        : { badge: 'status-missing', dot: 'bg-neutral-500' }

  return (
    <>
      <section className="glass reveal flex flex-col gap-4 p-6" style={{ '--delay': '140ms' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Runtime Overview</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Monitor the live agent and jump back to configuration when needed.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-black/20"
              onClick={onConfigure}
            >
              Configure
            </button>
            <span className={`badge ${statusStyle.badge}`}>
              <span className={`badge-dot ${statusStyle.dot}`} /> {statusLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1">
            Agent: {selectedAgentId || 'none'}
          </span>
          <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1">
            Port: {selectedAgent?.host_port || 'n/a'}
          </span>
          {selectedAgentId ? (
            isAgentRunning ? (
              <button
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-neutral-700 transition hover:border-black/20"
                onClick={() => onStopAgent(selectedAgentId)}
              >
                Stop
              </button>
            ) : (
              <button
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-neutral-700 transition hover:border-black/20"
                onClick={() => onStartAgent(selectedAgentId)}
              >
                Start
              </button>
            )
          ) : null}
        </div>
      </section>

      <div className="flex flex-col gap-6">
        <section className="glass reveal flex flex-col gap-4 p-5" style={{ '--delay': '200ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Conversation</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Send a prompt to the selected agent and watch the stream.
              </p>
            </div>
            <span className="badge status-running">
              <span className="badge-dot bg-emerald-600" /> {selectedAgentId || 'no agent'}
            </span>
          </div>
          <div className="glass-strong flex h-[260px] flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 px-4 py-6 text-sm text-neutral-500">
                Select an agent and send a message to start chatting.
              </div>
            ) : (
              messages.map((message, index) => {
                const isUser = message.role === 'user'
                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? 'bg-neutral-900 text-white'
                          : 'border border-black/5 bg-white/90 text-neutral-900'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content || '...'}</p>
                      {message.streaming ? (
                        <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-neutral-400">
                          streaming
                        </p>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex items-center gap-3">
            <textarea
              className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-2 text-sm text-neutral-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/40 min-h-[48px]"
              placeholder={
                selectedAgentId
                  ? isAgentRunning
                    ? 'Ask the agent something...'
                    : 'Start the agent to begin chatting.'
                  : 'Select an agent to start chatting.'
              }
              value={messageInput}
              onChange={(event) => onMessageInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  onSendMessage()
                }
              }}
              disabled={!selectedAgentId || !isAgentRunning || isStreaming}
            />
            <button
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
              onClick={onSendMessage}
              disabled={!selectedAgentId || !isAgentRunning || isStreaming || !messageInput.trim()}
            >
              {isStreaming ? 'Sending...' : 'Send'}
            </button>
          </div>
        </section>

        <section className="glass reveal flex flex-col gap-4 p-5" style={{ '--delay': '240ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Live Logs</h2>
              <p className="mt-1 text-xs text-neutral-500">
                WebSocket stream from the container runtime.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-black/20"
                onClick={onClearLogs}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex-1 rounded-2xl bg-[#0b1216] p-3">
            <div ref={terminalHostRef} className="h-[220px] w-full sm:h-[260px] lg:h-[300px]" />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-xs text-neutral-500">
            <span>Streaming: {selectedAgentId || 'none'}</span>
            <span>{wsBase.replace(/^wss?:\/\//, '')}</span>
          </div>
        </section>
      </div>
    </>
  )
}

export default RunView
