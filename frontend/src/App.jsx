import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const WS_BASE = API_BASE
  ? API_BASE.replace(/^http/, 'ws')
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`

const DEFAULT_TOOLS = 'Bash,Read,Write,Edit,Grep'
const SESSION_STORE_KEY = 'agentdeck.sessions'

const inputClass =
  'w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-2 text-sm text-neutral-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/40'

const labelClass = 'text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500'

const parseList = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const parseJsonField = (value) => {
  if (!value.trim()) {
    return { data: null, error: null }
  }
  try {
    return { data: JSON.parse(value), error: null }
  } catch (error) {
    return { data: null, error: error.message }
  }
}

const formatTime = (value) => {
  if (!value) return 'n/a'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'n/a'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const readSessionStore = () => {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_STORE_KEY) || '{}')
  } catch (error) {
    return {}
  }
}

const writeSessionStore = (value) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(value))
}

function App() {
  const [agents, setAgents] = useState([])
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [chatByAgent, setChatByAgent] = useState({})
  const [sessionByAgent, setSessionByAgent] = useState(() => readSessionStore())
  const [messageInput, setMessageInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [form, setForm] = useState({
    apiKey: '',
    configId: '',
    name: '',
    systemPrompt: '',
    allowedTools: DEFAULT_TOOLS,
    permissionMode: 'acceptEdits',
    maxTurns: '40',
    mcpServersJson: '',
    mcpEnvJson: '',
  })

  const termRef = useRef(null)
  const fitRef = useRef(null)
  const terminalHostRef = useRef(null)
  const wsRef = useRef(null)
  const messagesEndRef = useRef(null)

  const mcpServersParsed = useMemo(
    () => parseJsonField(form.mcpServersJson),
    [form.mcpServersJson]
  )
  const mcpEnvParsed = useMemo(() => parseJsonField(form.mcpEnvJson), [form.mcpEnvJson])

  const configPreview = useMemo(() => {
    const config = {
      id: form.configId.trim() || undefined,
      name: form.name.trim() || undefined,
      system_prompt: form.systemPrompt.trim() || undefined,
      permission_mode: form.permissionMode || undefined,
      max_turns: form.maxTurns ? Number(form.maxTurns) : undefined,
      allowed_tools: parseList(form.allowedTools || ''),
    }

    if (mcpServersParsed.data) {
      config.mcp_servers = mcpServersParsed.data
    }

    Object.keys(config).forEach((key) => {
      if (config[key] === undefined || Number.isNaN(config[key])) {
        delete config[key]
      }
    })

    return JSON.stringify(config, null, 2)
  }, [form, mcpServersParsed.data])

  const messages = useMemo(
    () => (selectedAgentId ? chatByAgent[selectedAgentId] || [] : []),
    [chatByAgent, selectedAgentId]
  )

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      const response = await fetch(`${API_BASE}/api/agents`)
      if (!response.ok) {
        throw new Error(`Failed to load agents (${response.status})`)
      }
      const data = await response.json()
      setAgents(data)
      setSessionByAgent((prev) => {
        const next = { ...prev }
        let changed = false
        data.forEach((agent) => {
          if (!agent.session_id) return
          const current = next[agent.agent_id] || {}
          if (current.sessionId !== agent.session_id) {
            next[agent.agent_id] = { ...current, sessionId: agent.session_id }
            changed = true
          }
        })
        return changed ? next : prev
      })
      if (data.length && !selectedAgentId) {
        setSelectedAgentId(data[0].agent_id)
      }
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }, [selectedAgentId])

  useEffect(() => {
    fetchAgents()
    const interval = setInterval(fetchAgents, 6000)
    return () => clearInterval(interval)
  }, [fetchAgents])

  useEffect(() => {
    writeSessionStore(sessionByAgent)
  }, [sessionByAgent])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedAgentId])

  useEffect(() => {
    if (!terminalHostRef.current || termRef.current) return
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
    term.writeln('AgentDeck log stream ready. Select an agent to attach logs.')
    termRef.current = term
    fitRef.current = fitAddon

    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!termRef.current) return
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    if (!selectedAgentId) {
      termRef.current.writeln('No agent selected.')
      return
    }

    termRef.current.writeln(`\r\n--- streaming logs for ${selectedAgentId} ---`)
    const ws = new WebSocket(`${WS_BASE}/ws/agents/${selectedAgentId}/logs`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      termRef.current?.writeln(event.data)
    }

    ws.onerror = () => {
      termRef.current?.writeln('[error] log stream error')
    }

    ws.onclose = () => {
      termRef.current?.writeln('--- log stream closed ---')
    }

    return () => {
      ws.close()
    }
  }, [selectedAgentId])

  const handleFieldChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const updateMessages = (agentId, updater) => {
    setChatByAgent((prev) => {
      const next = { ...prev }
      const current = prev[agentId] || []
      next[agentId] = updater(current)
      return next
    })
  }

  const finalizeAssistant = (agentId) => {
    updateMessages(agentId, (current) => {
      if (!current.length) return current
      const next = current.slice()
      const last = next[next.length - 1]
      if (last.role === 'assistant') {
        next[next.length - 1] = { ...last, streaming: false }
      }
      return next
    })
  }

  const streamChat = async (agentId, sessionId, sessionToken, messages) => {
    const headers = { 'Content-Type': 'application/json' }
    if (sessionToken) {
      headers['X-Session-Token'] = sessionToken
    }

    const response = await fetch(`${API_BASE}/api/agents/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId, messages }),
    })

    if (!response.ok || !response.body) {
      const detail = await response.text()
      throw new Error(detail || `Failed to query agent (${response.status})`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''

      for (const part of parts) {
        const lines = part.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          let event
          try {
            event = JSON.parse(payload)
          } catch (error) {
            continue
          }

          if (event.type === 'message' && event.data?.type === 'content') {
            const chunk = event.data.content || ''
            if (!chunk) continue
            updateMessages(agentId, (current) => {
              const next = current.slice()
              const last = next[next.length - 1]
              if (!last || last.role !== 'assistant') {
                next.push({ role: 'assistant', content: chunk, streaming: true })
                return next
              }
              next[next.length - 1] = {
                ...last,
                content: `${last.content}${chunk}`,
                streaming: true,
              }
              return next
            })
          }

          if (event.type === 'error') {
            updateMessages(agentId, (current) => [
              ...current,
              { role: 'assistant', content: `[error] ${event.message || 'Unknown error'}` },
            ])
          }
        }
      }
    }
  }

  const handleSendMessage = async () => {
    if (!selectedAgentId) {
      setErrorMessage('Select an agent before sending a message.')
      return
    }
    const session = sessionByAgent[selectedAgentId]
    if (!session?.sessionId || !session?.sessionToken) {
      setErrorMessage('Selected agent is missing a session token. Relaunch to create one.')
      return
    }
    if (!messageInput.trim()) return
    if (isStreaming) return

    const query = messageInput.trim()
    const history = (chatByAgent[selectedAgentId] || [])
      .filter((message) => (message.role === 'user' || message.role === 'assistant') && !message.streaming)
      .map((message) => ({ role: message.role, content: message.content }))
    const outgoingMessages = [...history, { role: 'user', content: query }]
    setMessageInput('')
    setErrorMessage('')
    setIsStreaming(true)

    updateMessages(selectedAgentId, (current) => [
      ...current,
      { role: 'user', content: query },
      { role: 'assistant', content: '', streaming: true },
    ])

    try {
      await streamChat(selectedAgentId, session.sessionId, session.sessionToken, outgoingMessages)
    } catch (error) {
      updateMessages(selectedAgentId, (current) => [
        ...current,
        { role: 'assistant', content: `[error] ${error.message}` },
      ])
    } finally {
      finalizeAssistant(selectedAgentId)
      setIsStreaming(false)
    }
  }

  const handleLaunch = async () => {
    setErrorMessage('')
    if (mcpServersParsed.error) {
      setErrorMessage(`MCP servers JSON error: ${mcpServersParsed.error}`)
      return
    }
    if (mcpEnvParsed.error) {
      setErrorMessage(`MCP env JSON error: ${mcpEnvParsed.error}`)
      return
    }

    const parsedConfig = JSON.parse(configPreview)
    const payload = { config: parsedConfig }
    if (parsedConfig.id) {
      payload.config_id = parsedConfig.id
    }
    if (form.apiKey.trim()) {
      payload.api_key = form.apiKey.trim()
    }
    if (mcpEnvParsed.data) {
      payload.mcp_env = mcpEnvParsed.data
    }

    setLaunching(true)
    try {
      const response = await fetch(`${API_BASE}/api/agents/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || `Failed to launch agent (${response.status})`)
      }
      const created = await response.json()
      setForm((prev) => ({ ...prev, apiKey: '' }))
      setSessionByAgent((prev) => ({
        ...prev,
        [created.agent_id]: {
          sessionId: created.session_id,
          sessionToken: created.session_token,
        },
      }))
      await fetchAgents()
      setSelectedAgentId(created.agent_id)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLaunching(false)
    }
  }

  const handleStop = async (agentId) => {
    setErrorMessage('')
    const session = sessionByAgent[agentId]
    const headers = {}
    let url = `${API_BASE}/api/agents/${agentId}`
    if (session?.sessionId && session.sessionToken) {
      url = `${API_BASE}/api/agents/sessions/${session.sessionId}`
      headers['X-Session-Token'] = session.sessionToken
    }
    try {
      const response = await fetch(url, { method: 'DELETE', headers })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || `Failed to stop agent (${response.status})`)
      }
      setSessionByAgent((prev) => {
        if (!prev[agentId]) return prev
        const next = { ...prev }
        delete next[agentId]
        return next
      })
      await fetchAgents()
      if (selectedAgentId === agentId) {
        setSelectedAgentId('')
      }
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const handleClearLogs = () => {
    if (!termRef.current) return
    termRef.current.clear()
    termRef.current.writeln('Logs cleared.')
  }

  return (
    <div className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="glass grid-dots reveal flex flex-col gap-4 p-6" style={{ '--delay': '0ms' }}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">
                AgentDeck Control Plane
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-neutral-900 md:text-4xl">
                Orchestrate Claude agents with clear sightlines.
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                Deploy AgCluster containers, shape their runtime config, and tail live logs in one place.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge status-running">
                <span className="badge-dot bg-emerald-600" /> Docker ready
              </span>
              <button
                className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:-translate-y-0.5 hover:shadow-glow"
                onClick={fetchAgents}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </header>

        <main className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_360px] xl:grid-cols-[300px_minmax(0,1fr)_420px]">
          <aside className="glass reveal flex flex-col gap-4 p-5" style={{ '--delay': '80ms' }}>
            <div className="flex items-center justify-between">
              <h2 className="section-title">Running Agents</h2>
              <span className="text-xs text-neutral-500">{agents.length}</span>
            </div>
            <div className="flex flex-col gap-3">
              {agents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-6 text-sm text-neutral-500">
                  No live agents yet. Launch one from the center panel.
                </div>
              ) : (
                agents.map((agent) => {
                  const isSelected = selectedAgentId === agent.agent_id
                  const statusStyle =
                    agent.status === 'running'
                      ? { badge: 'status-running', dot: 'bg-emerald-600' }
                      : agent.status === 'stopped'
                        ? { badge: 'status-stopped', dot: 'bg-orange-500' }
                        : { badge: 'status-missing', dot: 'bg-neutral-500' }
                  return (
                    <div
                      key={agent.agent_id}
                      className={`rounded-2xl border border-black/10 bg-white/80 p-4 transition ${
                        isSelected ? 'ring-2 ring-emerald-500/40' : 'hover:-translate-y-0.5'
                      }`}
                    >
                      <button
                        type="button"
                        className="flex w-full items-start justify-between text-left"
                        onClick={() => setSelectedAgentId(agent.agent_id)}
                      >
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">
                            {agent.config_id || agent.agent_id}
                          </p>
                          <p className="text-xs text-neutral-500">{agent.agent_id}</p>
                          <p className="mt-2 text-xs text-neutral-500">
                            {agent.host_port ? `Port ${agent.host_port}` : 'No port yet'} - {formatTime(agent.created_at)}
                          </p>
                        </div>
                        <span className={`badge ${statusStyle.badge}`}>
                          <span className={`badge-dot ${statusStyle.dot}`} /> {agent.status}
                        </span>
                      </button>
                      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
                        <span>container</span>
                        <button
                          className="rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-neutral-700 transition hover:border-black/20"
                          onClick={() => handleStop(agent.agent_id)}
                        >
                          Stop
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </aside>

          <section className="glass reveal flex flex-col gap-5 p-6" style={{ '--delay': '140ms' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="section-title">Agent Configuration</h2>
                <p className="mt-2 text-sm text-neutral-500">
                  Shape allowed tools, prompts, MCP servers, and permissions for each run.
                </p>
              </div>
              <button
                className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-neutral-800"
                onClick={handleLaunch}
                disabled={launching}
              >
                {launching ? 'Launching...' : 'Launch Agent'}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Config ID</label>
                <input
                  className={inputClass}
                  placeholder="code-assistant"
                  value={form.configId}
                  onChange={handleFieldChange('configId')}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Display Name</label>
                <input
                  className={inputClass}
                  placeholder="Agent Deck Builder"
                  value={form.name}
                  onChange={handleFieldChange('name')}
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className={labelClass}>System Prompt</label>
                <textarea
                  className={`${inputClass} min-h-[88px]`}
                  placeholder="Describe the mission for this agent..."
                  value={form.systemPrompt}
                  onChange={handleFieldChange('systemPrompt')}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Allowed Tools</label>
                <input
                  className={inputClass}
                  value={form.allowedTools}
                  onChange={handleFieldChange('allowedTools')}
                />
                <p className="text-xs text-neutral-500">Comma separated, MCP tools auto-appended.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className={labelClass}>Permission Mode</label>
                  <select
                    className={inputClass}
                    value={form.permissionMode}
                    onChange={handleFieldChange('permissionMode')}
                  >
                    <option value="default">default</option>
                    <option value="acceptEdits">acceptEdits</option>
                    <option value="plan">plan</option>
                    <option value="bypassPermissions">bypassPermissions</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className={labelClass}>Max Turns</label>
                  <input
                    className={inputClass}
                    type="number"
                    min="1"
                    value={form.maxTurns}
                    onChange={handleFieldChange('maxTurns')}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className={labelClass}>MCP Servers (JSON)</label>
                <textarea
                  className={`${inputClass} mono min-h-[92px] text-xs`}
                  placeholder='{"github": {"type": "http", "url": "http://localhost:9999"}}'
                  value={form.mcpServersJson}
                  onChange={handleFieldChange('mcpServersJson')}
                />
                {mcpServersParsed.error ? (
                  <p className="text-xs text-red-600">{mcpServersParsed.error}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className={labelClass}>MCP Runtime Env (JSON)</label>
                <textarea
                  className={`${inputClass} mono min-h-[92px] text-xs`}
                  placeholder='{"github": {"GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."}}'
                  value={form.mcpEnvJson}
                  onChange={handleFieldChange('mcpEnvJson')}
                />
                {mcpEnvParsed.error ? (
                  <p className="text-xs text-red-600">{mcpEnvParsed.error}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className={labelClass}>Anthropic API Key (optional)</label>
                <input
                  className={inputClass}
                  type="password"
                  placeholder="sk-ant-..."
                  value={form.apiKey}
                  onChange={handleFieldChange('apiKey')}
                />
                <p className="text-xs text-neutral-500">
                  Leave empty if the backend is configured with ANTHROPIC_API_KEY.
                </p>
              </div>
            </div>

            <div className="glass-strong grid-dots rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <h3 className="section-title">Config Preview</h3>
                <span className="text-xs text-neutral-500">agent-config.json</span>
              </div>
              <pre className="mono mt-3 max-h-64 overflow-auto rounded-xl bg-neutral-900/90 p-4 text-xs text-emerald-100">
                {configPreview}
              </pre>
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
                  className={`${inputClass} min-h-[48px]`}
                  placeholder={
                    selectedAgentId ? 'Ask the agent something...' : 'Select an agent to start chatting.'
                  }
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  disabled={!selectedAgentId || isStreaming}
                />
                <button
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
                  onClick={handleSendMessage}
                  disabled={!selectedAgentId || isStreaming || !messageInput.trim()}
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
                    onClick={handleClearLogs}
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
                <span>{WS_BASE.replace(/^wss?:\/\//, '')}</span>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
