import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import App from '../App'

const createResponse = ({ ok = true, status = 200, json, text, body }) => ({
  ok,
  status,
  json: json || (async () => ({})),
  text: text || (async () => ''),
  body,
})

const asUrl = (value) => {
  if (typeof value === 'string') return value
  if (value?.url) return value.url
  return value?.toString?.() || ''
}

const createChatStream = (message) => {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      const payload = `data: ${JSON.stringify({
        type: 'message',
        data: { type: 'content', content: message },
      })}\n\n`
      controller.enqueue(encoder.encode(payload))
      controller.close()
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

it('shows retry action for assistant messages', async () => {
  window.localStorage.setItem(
    'agentdeck.sessions',
    JSON.stringify({
      'agent-1': { sessionId: 'session-1', sessionToken: 'token-1' },
    })
  )

  const fetchMock = vi.fn((url) => {
    const urlString = asUrl(url)
    if (urlString.includes('/api/agents/chat')) {
      return Promise.resolve(
        createResponse({
          body: createChatStream('Here is the answer.'),
        })
      )
    }
    if (urlString.includes('/api/agents')) {
      return Promise.resolve(
        createResponse({
          json: async () => [
            {
              agent_id: 'agent-1',
              config_id: 'demo',
              status: 'running',
              host_port: null,
              created_at: new Date().toISOString(),
              container_id: 'container-1',
              container_name: 'agent-demo',
            },
          ],
        })
      )
    }
    return Promise.resolve(createResponse({}))
  })

  vi.stubGlobal('fetch', fetchMock)

  render(<App />)

  const input = await screen.findByPlaceholderText('Message')
  fireEvent.change(input, { target: { value: 'Find the latest news' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })
})
