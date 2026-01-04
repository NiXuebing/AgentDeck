import { useEffect, useRef, useState } from 'react'

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
  wsBase,
}) {
  const terminalHostRef = useRef(null)
  const termRef = useRef(null)
  const fitRef = useRef(null)
  const wsRef = useRef(null)
  const [terminalReady, setTerminalReady] = useState(false)

  const statusLabel = selectedAgent?.status || 'idle'
  const statusTextMap = {
    running: '运行中',
    stopped: '已停止',
    exited: '已退出',
    created: '已创建',
    missing: '未知',
    idle: '空闲',
  }
  const statusDisplay = statusTextMap[statusLabel] || statusLabel
  const statusStyle =
    statusLabel === 'running'
      ? { badge: 'status-running', dot: 'bg-emerald-600' }
      : statusLabel === 'stopped'
        ? { badge: 'status-stopped', dot: 'bg-orange-500' }
        : { badge: 'status-missing', dot: 'bg-neutral-500' }

  useEffect(() => {
    let cancelled = false
    if (!terminalHostRef.current || termRef.current) return undefined

    const initTerminal = async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
      ])
      if (cancelled || !terminalHostRef.current) return

      const term = new Terminal({
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 12,
        theme: {
          background: '#0b1216',
          foreground: '#f2f2f2',
          cursor: '#f08a4b',
          selectionBackground: 'rgba(240, 138, 75, 0.2)',
        },
      })
      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(terminalHostRef.current)
      fitAddon.fit()
      term.writeln('AgentDeck 日志流已就绪。请选择一个 Agent 来接入日志。')
      termRef.current = term
      fitRef.current = fitAddon
      setTerminalReady(true)

      const handleResize = () => fitAddon.fit()
      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
        term.dispose()
        termRef.current = null
        fitRef.current = null
      }
    }

    let cleanup
    initTerminal().then((teardown) => {
      cleanup = teardown
    })

    return () => {
      cancelled = true
      if (cleanup) cleanup()
    }
  }, [])

  useEffect(() => {
    if (!terminalReady || !termRef.current) return undefined
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    if (!selectedAgentId) {
      termRef.current.writeln('未选择 Agent。')
      return undefined
    }

    termRef.current.writeln(`\r\n--- 正在流式输出 ${selectedAgentId} 的日志 ---`)
    const ws = new WebSocket(`${wsBase}/ws/agents/${selectedAgentId}/logs`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      termRef.current?.writeln(event.data)
    }

    ws.onerror = () => {
      termRef.current?.writeln('[错误] 日志流出错')
    }

    ws.onclose = () => {
      termRef.current?.writeln('--- 日志流已关闭 ---')
    }

    return () => {
      ws.close()
    }
  }, [selectedAgentId, terminalReady, wsBase])

  return (
    <div className="flex flex-col gap-6">
      <section className="glass reveal flex flex-col gap-4 p-5" style={{ '--delay': '140ms' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">运行时概览</h2>
            <p className="mt-1 text-xs text-neutral-500">
              监控运行中的 Agent，必要时返回配置。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-black/20"
              onClick={onConfigure}
            >
              配置
            </button>
            <span className={`badge ${statusStyle.badge}`}>
              <span className={`badge-dot ${statusStyle.dot}`} /> {statusDisplay}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1">
            Agent：{selectedAgentId || '无'}
          </span>
          <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1">
            端口：{selectedAgent?.host_port || '暂无'}
          </span>
          {selectedAgentId ? (
            isAgentRunning ? (
              <button
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-neutral-700 transition hover:border-black/20"
                onClick={() => onStopAgent(selectedAgentId)}
              >
                停止
              </button>
            ) : (
              <button
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-neutral-700 transition hover:border-black/20"
                onClick={() => onStartAgent(selectedAgentId)}
              >
                启动
              </button>
            )
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="glass reveal flex flex-col gap-4 p-5" style={{ '--delay': '200ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">对话</h2>
              <p className="mt-1 text-xs text-neutral-500">
                向所选 Agent 发送提示并观看流式输出。
              </p>
            </div>
            <span className="badge status-running">
              <span className="badge-dot bg-emerald-600" /> {selectedAgentId || '无 Agent'}
            </span>
          </div>
          <div className="glass-strong flex min-h-[320px] flex-col gap-3 overflow-y-auto p-4 lg:min-h-[420px]">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 px-4 py-6 text-sm text-neutral-500">
                选择一个 Agent 并发送消息开始对话。
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
                          流式中
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
                    ? '问 Agent 一个问题...'
                    : '请先启动 Agent 再聊天。'
                  : '选择一个 Agent 开始聊天。'
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
              {isStreaming ? '发送中...' : '发送'}
            </button>
          </div>
        </section>

        <section className="glass reveal flex flex-col gap-4 p-5" style={{ '--delay': '240ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">实时日志</h2>
              <p className="mt-1 text-xs text-neutral-500">
                来自容器运行时的 WebSocket 流。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-black/20"
                onClick={() => {
                  if (!termRef.current) return
                  termRef.current.clear()
                  termRef.current.writeln('日志已清空。')
                }}
              >
                清空
              </button>
            </div>
          </div>
          <div className="flex-1 rounded-2xl bg-[#0b1216] p-3">
            <div ref={terminalHostRef} className="h-[260px] w-full sm:h-[320px] lg:h-[420px]" />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-xs text-neutral-500">
            <span>流式：{selectedAgentId || '无'}</span>
            <span>{wsBase.replace(/^wss?:\/\//, '')}</span>
          </div>
        </section>
      </div>
    </div>
  )
}

export default RunView
