import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { SubAgentEditor } from './components/SubAgentEditor'
import WorkbenchView from './components/views/WorkbenchView'
import { BlueprintPanel } from './components/workbench/BlueprintPanel'
import { StagePanel } from './components/workbench/StagePanel'
import { DEFAULT_TOOLS } from './constants/tools'
import { WorkbenchContext } from './context/WorkbenchContext'
import { WORKBENCH_STATES, useWorkbenchController } from './hooks/useWorkbenchController'
import { useGenesisFill } from './hooks/useGenesisFill'
import { buildGenesisSteps } from './utils/genesisSteps'

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
  if (!value) return '暂无'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无'
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
  const [logsOpen, setLogsOpen] = useState(false)
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
  const hasDraftChanges = true
  const [hasGenesisDraft, setHasGenesisDraft] = useState(false)

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
  const toolsList = useMemo(
    () => (Array.isArray(form.allowedTools) ? form.allowedTools : parseList(form.allowedTools || '')),
    [form.allowedTools]
  )

  const hydrateFormFromConfig = (config) => {
    if (!config) return
    setForm((prev) => ({
      ...prev,
      configId: config.id || '',
      name: config.name || '',
      description: config.description || '',
      systemPrompt: config.system_prompt || '',
      useCustomPrompt: Boolean(config.system_prompt),
      allowedTools: Array.isArray(config.allowed_tools) ? config.allowed_tools : prev.allowedTools,
      permissionMode: config.permission_mode || prev.permissionMode,
      maxTurns: config.max_turns ? String(config.max_turns) : prev.maxTurns,
      model: config.model || prev.model,
    }))

    if (config.mcp_servers) {
      setMcpServersJson(JSON.stringify(config.mcp_servers, null, 2))
    }
    if (config.agents) {
      setSubAgents(config.agents)
    }
    if (config.skills) {
      setSkills(config.skills)
    }
    if (config.commands) {
      setCommands(config.commands)
    }
  }

  const genesisFill = useGenesisFill((fragment) => {
    setHasGenesisDraft(true)
    hydrateFormFromConfig(fragment)
  })

  const messages = useMemo(
    () => (selectedAgentId ? chatByAgent[selectedAgentId] || [] : []),
    [chatByAgent, selectedAgentId]
  )
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.agent_id === selectedAgentId),
    [agents, selectedAgentId]
  )
  const isAgentRunning = selectedAgent?.status === 'running'
  const handleToggleLogs = useCallback(() => {
    setLogsOpen((prev) => !prev)
  }, [])
  const handleSessionUpdate = useCallback((agentId, sessionId, sessionToken) => {
    setSessionByAgent((prev) => ({
      ...prev,
      [agentId]: { sessionId, sessionToken },
    }))
  }, [])
  const statusTextMap = {
    running: '运行中',
    stopped: '已停止',
    exited: '已退出',
    created: '已创建',
    missing: '未知',
  }

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      const response = await fetch(`${API_BASE}/api/agents`)
      if (!response.ok) {
        throw new Error(`加载 Agent 失败 (${response.status})`)
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
    if (!window.confirm(`删除子 Agent "${name}"？`)) return
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
      throw new Error(detail || `请求 Agent 失败 (${response.status})`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let assistantText = ''

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
            assistantText += chunk
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
              { role: 'assistant', content: `[错误] ${event.message || '未知错误'}` },
            ])
          }
        }
      }
    }

    return assistantText
  }

  const handleSendMessage = async () => {
    if (!selectedAgentId) {
      setErrorMessage('发送消息前请先选择一个 Agent。')
      return
    }
    if (!selectedAgent || selectedAgent.status !== 'running') {
      setErrorMessage('Agent 未在运行。请先启动再聊天。')
      return
    }
    const session = sessionByAgent[selectedAgentId]
    if (!session?.sessionId || !session?.sessionToken) {
      setErrorMessage('所选 Agent 缺少 session token。请重新启动以创建。')
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
      const assistantText = await streamChat(
        selectedAgentId,
        session.sessionId,
        session.sessionToken,
        outgoingMessages
      )
      if (assistantText) {
        await workbenchController.requestToolSuggestion({ userText: query, assistantText })
      }
    } catch (error) {
      updateMessages(selectedAgentId, (current) => [
        ...current,
        { role: 'assistant', content: `[错误] ${error.message}` },
      ])
    } finally {
      finalizeAssistant(selectedAgentId)
      setIsStreaming(false)
    }
  }

  const handleAddSuggestedTools = async (tools) => {
    if (!Array.isArray(tools) || tools.length === 0) return
    const existing = Array.isArray(form.allowedTools)
      ? form.allowedTools
      : parseList(form.allowedTools || '')
    const nextAllowed = Array.from(new Set([...existing, ...tools]))
    setForm((prev) => ({ ...prev, allowedTools: nextAllowed }))
    const nextConfig = { ...previewConfig, allowed_tools: nextAllowed }
    await workbenchController.handleApplyConfig(nextConfig)
    workbenchController.clearToolSuggestion()
  }

  const handleLaunch = async () => {
    setErrorMessage('')
    if (mcpServersParsed.error) {
      setErrorMessage(`MCP Servers JSON 错误：${mcpServersParsed.error}`)
      return
    }
    if (mcpEnvParsed.error) {
      setErrorMessage(`MCP 环境变量 JSON 错误：${mcpEnvParsed.error}`)
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
        throw new Error(detail || `启动 Agent 失败 (${response.status})`)
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
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLaunching(false)
    }
  }

  const workbenchController = useWorkbenchController({
    apiBase: API_BASE,
    onHydrateConfig: hydrateFormFromConfig,
    onGenesisFill: (config) => {
      setHasGenesisDraft(true)
      return genesisFill.schedule(buildGenesisSteps(config))
    },
    onLaunch: handleLaunch,
    configPreview,
    selectedAgentId,
    sessionByAgent,
    onSessionUpdate: handleSessionUpdate,
  })

  useEffect(() => {
    if (workbenchController.pollingPaused) return undefined
    fetchAgents()
    const interval = setInterval(fetchAgents, 6000)
    return () => clearInterval(interval)
  }, [fetchAgents, workbenchController.pollingPaused])

  useEffect(() => {
    writeSessionStore(sessionByAgent)
  }, [sessionByAgent])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedAgentId])

  const handleStop = async (agentId) => {
    setErrorMessage('')
    const session = sessionByAgent[agentId]
    if (!session?.sessionToken) {
      setErrorMessage('缺少用于停止的 session token。')
      return
    }
    try {
      const response = await fetch(`${API_BASE}/api/agents/${agentId}/stop`, {
        method: 'POST',
        headers: { 'X-Session-Token': session.sessionToken },
      })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || `停止 Agent 失败 (${response.status})`)
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
      setErrorMessage('缺少用于启动的 session token。')
      return
    }
    try {
      const response = await fetch(`${API_BASE}/api/agents/${agentId}/start`, {
        method: 'POST',
        headers: { 'X-Session-Token': session.sessionToken },
      })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || `启动 Agent 失败 (${response.status})`)
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
      setErrorMessage('缺少用于删除的 session token。')
      return
    }
    if (!window.confirm('删除此 Agent 及其 workspace volume？')) {
      return
    }
    try {
      const response = await fetch(`${API_BASE}/api/agents/${agentId}`, {
        method: 'DELETE',
        headers: { 'X-Session-Token': session.sessionToken },
      })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || `删除 Agent 失败 (${response.status})`)
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
    <WorkbenchContext.Provider value={workbenchController}>
      <div className="min-h-screen px-6 py-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="glass grid-dots reveal flex flex-col gap-4 p-6" style={{ '--delay': '0ms' }}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">
                AgentDeck 控制面板
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-neutral-900 md:text-4xl">
                清晰编排 Claude Agent。
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                在一处部署 AgCluster 容器、配置运行时参数，并查看实时日志。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge status-running">
                <span className="badge-dot bg-emerald-600" /> Docker 就绪
              </span>
              <button
                className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold text-neutral-800 transition hover:-translate-y-0.5 hover:shadow-glow"
                onClick={fetchAgents}
                disabled={loading}
              >
                {loading ? '刷新中...' : '刷新'}
              </button>
            </div>
          </div>
          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </header>

        <main className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="glass reveal flex flex-col gap-4 p-5" style={{ '--delay': '80ms' }}>
            <div className="flex items-center justify-between">
              <h2 className="section-title">运行中的 Agent</h2>
              <span className="text-xs text-neutral-500">{agents.length}</span>
            </div>
            <div className="flex flex-col gap-3">
              {agents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-6 text-sm text-neutral-500">
                  暂无在线 Agent。请在中间面板启动一个。
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
                  const statusDisplay = statusTextMap[agent.status] || agent.status
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
                            {agent.host_port ? `端口 ${agent.host_port}` : '暂无端口'} - {formatTime(agent.created_at)}
                          </p>
                        </div>
                        <span className={`badge ${statusStyle.badge}`}>
                          <span className={`badge-dot ${statusStyle.dot}`} /> {statusDisplay}
                        </span>
                      </button>
                      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
                        <span>容器</span>
                        <div className="flex items-center gap-2">
                          {normalizedStatus === 'running' ? (
                            <button
                              className="rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-neutral-700 transition hover:border-black/20"
                              onClick={() => handleStop(agent.agent_id)}
                            >
                              停止
                            </button>
                          ) : (
                            <button
                              className="rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-neutral-700 transition hover:border-black/20"
                              onClick={() => handleStart(agent.agent_id)}
                            >
                              启动
                            </button>
                          )}
                          <button
                            className="rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-neutral-700 transition hover:border-black/20"
                            onClick={() => handleDelete(agent.agent_id)}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </aside>

          <WorkbenchView
            blueprint={(
              <BlueprintPanel
                form={form}
                onChangeForm={setForm}
                showSkeleton={!selectedAgentId && !hasGenesisDraft}
                tools={toolsList}
                onChangeTools={(nextTools) => setForm((prev) => ({ ...prev, allowedTools: nextTools }))}
                activeTab={activeConfigTab}
                onChangeTab={setActiveConfigTab}
                subAgents={subAgents}
                onChangeSubAgents={setSubAgents}
                skills={skills}
                commands={commands}
                onAddSubAgent={handleAddSubAgent}
                onEditSubAgent={handleEditSubAgent}
                onDeleteSubAgent={handleDeleteSubAgent}
                onChangeSkills={setSkills}
                onChangeCommands={setCommands}
                onApply={workbenchController.handleApplyConfig}
                hasDraftChanges={hasDraftChanges}
                mcpServersJson={mcpServersJson}
                onMcpServersChange={setMcpServersJson}
                isReloading={workbenchController.state === WORKBENCH_STATES.RELOADING}
                reloadError={workbenchController.reloadError}
                canRollback={workbenchController.canRollback}
                onRollback={workbenchController.handleRollback}
              />
            )}
            stage={(
              <StagePanel
                messages={messages}
                onSend={handleSendMessage}
                input={messageInput}
                onInput={setMessageInput}
                logsOpen={logsOpen}
                onToggleLogs={handleToggleLogs}
                renderLogs={() => (
                  <div className="text-xs text-neutral-600">Live logs</div>
                )}
                isReloading={workbenchController.state === WORKBENCH_STATES.RELOADING}
                showArchitect={!selectedAgentId}
                architectPrompt={workbenchController.architectPrompt}
                onArchitectPrompt={workbenchController.setArchitectPrompt}
                onArchitectSubmit={workbenchController.handleArchitectSubmit}
                showKeyPrompt={workbenchController.showKeyPrompt}
                architectApiKey={workbenchController.architectApiKey}
                onArchitectApiKey={workbenchController.setArchitectApiKey}
                architectError={workbenchController.architectError}
                toolSuggestion={workbenchController.toolSuggestion}
                onAddSuggestedTools={handleAddSuggestedTools}
              />
            )}
          />
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
    </WorkbenchContext.Provider>
  )
}

export default App
