import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { SubAgentEditor } from './components/SubAgentEditor'
import CreateView from './components/views/CreateView'
import RunView from './components/views/RunView'
import { DEFAULT_TOOLS } from './constants/tools'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const WS_BASE = API_BASE
  ? API_BASE.replace(/^http/, 'ws')
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`

const SESSION_STORE_KEY = 'agentdeck.sessions'

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
  } catch (e) {
    return { data: null, error: e.message }
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
  } catch {
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
    configId: '',
    name: '',
    description: '',
    systemPrompt: '',
    useCustomPrompt: false,
    allowedTools: DEFAULT_TOOLS,
    permissionMode: 'bypassPermissions',
    maxTurns: '40',
    model: '',
    bashMode: 'all',
    bashPatterns: [],
  })
  const [mcpServersJson, setMcpServersJson] = useState('')
  const [mcpEnvJson] = useState('')
  const [subAgents, setSubAgents] = useState({})
  const [skills, setSkills] = useState({})
  const [commands, setCommands] = useState({})
  const [activeConfigTab, setActiveConfigTab] = useState('profile')
  const [activeView, setActiveView] = useState('create')
  const [editingSubAgent, setEditingSubAgent] = useState(null)
  const [isAddingSubAgent, setIsAddingSubAgent] = useState(false)

  const messagesEndRef = useRef(null)

  const mcpServersParsed = useMemo(
    () => parseJsonField(mcpServersJson),
    [mcpServersJson]
  )
  const mcpEnvParsed = useMemo(() => parseJsonField(mcpEnvJson), [mcpEnvJson])

  const configPreview = useMemo(() => {
    const config = {
      id: form.configId.trim() || undefined,
      name: form.name.trim() || undefined,
      description: form.description?.trim() || undefined,
      system_prompt: form.useCustomPrompt ? (form.systemPrompt.trim() || undefined) : undefined,
      permission_mode: form.permissionMode || undefined,
      max_turns: form.maxTurns ? Number(form.maxTurns) : undefined,
      model: form.model || undefined,
      allowed_tools: Array.isArray(form.allowedTools) ? form.allowedTools : parseList(form.allowedTools || ''),
    }

    if (mcpServersParsed.data) {
      config.mcp_servers = mcpServersParsed.data
    }

    if (Object.keys(subAgents).length > 0) {
      config.agents = subAgents
    }

    if (Object.keys(skills).length > 0) {
      config.skills = skills
    }

    if (Object.keys(commands).length > 0) {
      config.commands = commands
    }

    Object.keys(config).forEach((key) => {
      if (config[key] === undefined || Number.isNaN(config[key])) {
        delete config[key]
      }
    })

    return JSON.stringify(config, null, 2)
  }, [form, mcpServersParsed.data, subAgents, skills, commands])
  const previewConfig = useMemo(() => JSON.parse(configPreview), [configPreview])

  const messages = useMemo(
    () => (selectedAgentId ? chatByAgent[selectedAgentId] || [] : []),
    [chatByAgent, selectedAgentId]
  )
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.agent_id === selectedAgentId),
    [agents, selectedAgentId]
  )
  const isAgentRunning = selectedAgent?.status === 'running'

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


  const handleAddSubAgent = () => {
    setEditingSubAgent(null)
    setIsAddingSubAgent(true)
  }

  const handleEditSubAgent = (name, agent) => {
    setEditingSubAgent({ name, ...agent })
    setIsAddingSubAgent(false)
  }

  const handleSaveSubAgent = (agent) => {
    const { name, ...rest } = agent
    setSubAgents((prev) => ({ ...prev, [name]: rest }))
    setEditingSubAgent(null)
    setIsAddingSubAgent(false)
  }

  const handleDeleteSubAgent = (name) => {
    if (!window.confirm(`Delete sub-agent "${name}"?`)) return
    setSubAgents((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
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
          } catch {
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
    if (!selectedAgent || selectedAgent.status !== 'running') {
      setErrorMessage('Agent is not running. Start the agent before chatting.')
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
      setSessionByAgent((prev) => ({
        ...prev,
        [created.agent_id]: {
          sessionId: created.session_id,
          sessionToken: created.session_token,
        },
      }))
      await fetchAgents()
      setSelectedAgentId(created.agent_id)
      setActiveView('run')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLaunching(false)
    }
  }

  const handleStop = async (agentId) => {
    setErrorMessage('')
    const session = sessionByAgent[agentId]
    if (!session?.sessionToken) {
      setErrorMessage('Missing session token for stop.')
      return
    }
    try {
      const response = await fetch(`${API_BASE}/api/agents/${agentId}/stop`, {
        method: 'POST',
        headers: { 'X-Session-Token': session.sessionToken },
      })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || `Failed to stop agent (${response.status})`)
      }
      await fetchAgents()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const handleStart = async (agentId) => {
    setErrorMessage('')
    const session = sessionByAgent[agentId]
    if (!session?.sessionToken) {
      setErrorMessage('Missing session token for start.')
      return
    }
    try {
      const response = await fetch(`${API_BASE}/api/agents/${agentId}/start`, {
        method: 'POST',
        headers: { 'X-Session-Token': session.sessionToken },
      })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || `Failed to start agent (${response.status})`)
      }
      await fetchAgents()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  const handleDelete = async (agentId) => {
    setErrorMessage('')
    const session = sessionByAgent[agentId]
    if (!session?.sessionToken) {
      setErrorMessage('Missing session token for delete.')
      return
    }
    if (!window.confirm('Delete this agent and its workspace volume?')) {
      return
    }
    try {
      const response = await fetch(`${API_BASE}/api/agents/${agentId}`, {
        method: 'DELETE',
        headers: { 'X-Session-Token': session.sessionToken },
      })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || `Failed to delete agent (${response.status})`)
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
                  const normalizedStatus =
                    agent.status === 'running'
                      ? 'running'
                      : ['stopped', 'exited', 'created'].includes(agent.status)
                        ? 'stopped'
                        : 'missing'
                  const statusStyle =
                    normalizedStatus === 'running'
                      ? { badge: 'status-running', dot: 'bg-emerald-600' }
                      : normalizedStatus === 'stopped'
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
                        <div className="flex items-center gap-2">
                          {normalizedStatus === 'running' ? (
                            <button
                              className="rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-neutral-700 transition hover:border-black/20"
                              onClick={() => handleStop(agent.agent_id)}
                            >
                              Stop
                            </button>
                          ) : (
                            <button
                              className="rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-neutral-700 transition hover:border-black/20"
                              onClick={() => handleStart(agent.agent_id)}
                            >
                              Start
                            </button>
                          )}
                          <button
                            className="rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-neutral-700 transition hover:border-black/20"
                            onClick={() => handleDelete(agent.agent_id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </aside>

          {activeView === 'create' ? (
            <CreateView
              launching={launching}
              onLaunch={handleLaunch}
              activeConfigTab={activeConfigTab}
              onChangeConfigTab={setActiveConfigTab}
              form={form}
              onChangeForm={setForm}
              mcpServersJson={mcpServersJson}
              onMcpServersChange={setMcpServersJson}
              subAgents={subAgents}
              onAddSubAgent={handleAddSubAgent}
              onEditSubAgent={handleEditSubAgent}
              onDeleteSubAgent={handleDeleteSubAgent}
              skills={skills}
              onChangeSkills={setSkills}
              commands={commands}
              onChangeCommands={setCommands}
              previewConfig={previewConfig}
            />
          ) : (
            <RunView
              selectedAgentId={selectedAgentId}
              selectedAgent={selectedAgent}
              isAgentRunning={isAgentRunning}
              onStopAgent={handleStop}
              onStartAgent={handleStart}
              onConfigure={() => setActiveView('create')}
              messages={messages}
              messageInput={messageInput}
              onMessageInput={setMessageInput}
              onSendMessage={handleSendMessage}
              isStreaming={isStreaming}
              messagesEndRef={messagesEndRef}
              wsBase={WS_BASE}
            />
          )}
        </main>

        {activeView === 'create' && (editingSubAgent || isAddingSubAgent) && (
          <SubAgentEditor
            agent={editingSubAgent}
            isNew={isAddingSubAgent}
            onSave={handleSaveSubAgent}
            onCancel={() => {
              setEditingSubAgent(null)
              setIsAddingSubAgent(false)
            }}
          />
        )}
      </div>
    </div>
  )
}

export default App
