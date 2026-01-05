import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import App from '../App'

const createResponse = ({ ok = true, json, text }) => ({
  ok,
  json: json || (async () => ({})),
  text: text || (async () => ''),
})

const asUrl = (value) => {
  if (typeof value === 'string') return value
  if (value?.url) return value.url
  return value?.toString?.() || ''
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('keeps sub-agent editor available after genesis launch', async () => {
  const agentResponse = {
    agent_id: 'agent-1',
    session_id: 's1',
    session_token: 't1',
    config_id: 'demo',
    status: 'running',
    created_at: new Date().toISOString(),
  }

  const fetchMock = vi.fn((url) => {
    const urlString = asUrl(url)
    if (urlString.includes('/api/blueprints/preview')) {
      return Promise.resolve(
        createResponse({
          json: async () => ({
            config: { id: 'demo', name: 'Demo', system_prompt: 'hello', allowed_tools: [] },
          }),
        })
      )
    }
    if (urlString.includes('/api/agents/launch')) {
      return Promise.resolve(createResponse({ json: async () => agentResponse }))
    }
    if (urlString.includes('/api/agents')) {
      return Promise.resolve(
        createResponse({
          json: async () => [
            {
              agent_id: 'agent-1',
              config_id: 'demo',
              status: 'running',
              created_at: agentResponse.created_at,
            },
          ],
        })
      )
    }
    return Promise.resolve(createResponse({}))
  })
  vi.stubGlobal('fetch', fetchMock)

  render(<App />)
  fireEvent.change(screen.getByPlaceholderText(/Describe the agent mission/i), {
    target: { value: 'Build an ops agent' },
  })
  fireEvent.click(screen.getByRole('button', { name: /Generate/i }))

  await waitFor(() => expect(fetchMock).toHaveBeenCalled())

  fireEvent.click(screen.getByRole('button', { name: /Sub-agents/i }))
  fireEvent.click(screen.getByRole('button', { name: /\+ Add sub-agent/i }))
  expect(await screen.findByText(/添加子 Agent/i)).toBeInTheDocument()
})
