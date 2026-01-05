import { useMemo, useState } from 'react'

export const WORKBENCH_STATES = {
  DRAFT: 'DRAFT',
  LAUNCHING: 'LAUNCHING',
  RUNNING: 'RUNNING',
  RELOADING: 'RELOADING',
}

export function useWorkbenchController({
  apiBase,
  onHydrateConfig,
  onLaunch,
  configPreview,
  selectedAgentId,
  sessionByAgent,
  onSessionUpdate,
}) {
  const [state, setState] = useState(WORKBENCH_STATES.DRAFT)
  const [architectPrompt, setArchitectPrompt] = useState('')
  const [architectApiKey, setArchitectApiKey] = useState('')
  const [showKeyPrompt, setShowKeyPrompt] = useState(false)
  const [architectError, setArchitectError] = useState(null)
  const [lastGoodConfig, setLastGoodConfig] = useState(null)
  const [reloadError, setReloadError] = useState(null)
  const [pollingPaused, setPollingPaused] = useState(false)
  const [toolSuggestion, setToolSuggestion] = useState(null)

  const handleArchitectSubmit = async () => {
    if (!architectPrompt.trim()) return
    setArchitectError(null)
    setState(WORKBENCH_STATES.LAUNCHING)
    const headers = { 'Content-Type': 'application/json' }
    if (architectApiKey) {
      headers['X-Api-Key'] = architectApiKey
    }

    try {
      const response = await fetch(`${apiBase}/api/blueprints/preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: architectPrompt }),
      })

      if (response.status === 400) {
        setShowKeyPrompt(true)
        setState(WORKBENCH_STATES.DRAFT)
        return
      }

      if (!response.ok) {
        const detail = await response.text()
        setArchitectError(detail || 'Blueprint generation failed')
        setState(WORKBENCH_STATES.DRAFT)
        return
      }

      const { config } = await response.json()
      onHydrateConfig?.(config)
      await onLaunch?.()
      setState(WORKBENCH_STATES.RUNNING)
    } catch (error) {
      setArchitectError(error.message || 'Blueprint generation failed')
      setState(WORKBENCH_STATES.DRAFT)
    }
  }

  const handleApplyConfig = async (overrideConfig = null) => {
    if (!selectedAgentId) return
    setReloadError(null)
    setState(WORKBENCH_STATES.RELOADING)
    setPollingPaused(true)

    const nextConfig = overrideConfig || JSON.parse(configPreview || '{}')
    const session = sessionByAgent?.[selectedAgentId]
    const headers = { 'Content-Type': 'application/json' }
    if (session?.sessionToken) {
      headers['X-Session-Token'] = session.sessionToken
    }

    try {
      const response = await fetch(`${apiBase}/api/agents/${selectedAgentId}/config`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ config: nextConfig }),
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      const payload = await response.json()
      onSessionUpdate?.(selectedAgentId, payload.session_id, payload.session_token)
      setLastGoodConfig(nextConfig)
      setState(WORKBENCH_STATES.RUNNING)
    } catch (error) {
      setReloadError(error.message)
      setState(WORKBENCH_STATES.DRAFT)
    } finally {
      setPollingPaused(false)
    }
  }

  const handleRollback = async () => {
    if (!lastGoodConfig || !selectedAgentId) return
    const session = sessionByAgent?.[selectedAgentId]
    const headers = { 'Content-Type': 'application/json' }
    if (session?.sessionToken) {
      headers['X-Session-Token'] = session.sessionToken
    }
    await fetch(`${apiBase}/api/agents/${selectedAgentId}/config`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ config: lastGoodConfig }),
    })
  }

  const requestToolSuggestion = async ({ userText, assistantText }) => {
    if (!userText || !assistantText) return
    setToolSuggestion(null)
    const headers = { 'Content-Type': 'application/json' }
    if (architectApiKey) {
      headers['X-Api-Key'] = architectApiKey
    }
    try {
      const response = await fetch(`${apiBase}/api/agents/intent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_text: userText, assistant_text: assistantText }),
      })
      if (response.status === 400) {
        return
      }
      if (!response.ok) {
        throw new Error(await response.text())
      }
      const payload = await response.json()
      if (Array.isArray(payload.suggested_tools) && payload.suggested_tools.length > 0) {
        setToolSuggestion(payload)
      }
    } catch {
      setToolSuggestion(null)
    }
  }

  const clearToolSuggestion = () => {
    setToolSuggestion(null)
  }

  const value = useMemo(
    () => ({
      state,
      setState,
      architectPrompt,
      setArchitectPrompt,
      architectApiKey,
      setArchitectApiKey,
      showKeyPrompt,
      setShowKeyPrompt,
      handleArchitectSubmit,
      handleApplyConfig,
      handleRollback,
      requestToolSuggestion,
      clearToolSuggestion,
      architectError,
      reloadError,
      toolSuggestion,
      pollingPaused,
      canRollback: Boolean(lastGoodConfig),
    }),
    [
      state,
      architectPrompt,
      architectApiKey,
      showKeyPrompt,
      handleArchitectSubmit,
      handleApplyConfig,
      handleRollback,
      requestToolSuggestion,
      clearToolSuggestion,
      architectError,
      reloadError,
      toolSuggestion,
      pollingPaused,
      lastGoodConfig,
    ]
  )
  return value
}
