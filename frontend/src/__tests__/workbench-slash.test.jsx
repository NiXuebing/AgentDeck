import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import App from '../App'

const createResponse = ({ ok = true, json }) => ({
  ok,
  json: json || (async () => ({})),
})

const asUrl = (value) => {
  if (typeof value === 'string') return value
  if (value?.url) return value.url
  return value?.toString?.() || ''
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('handles /config and /restart slash commands', async () => {
  window.localStorage.setItem(
    'agentdeck.sessions',
    JSON.stringify({
      'agent-1': { sessionId: 'session-1', sessionToken: 'token-1' },
    })
  )

  const fetchMock = vi.fn((url) => {
    const urlString = asUrl(url)
    if (urlString.includes('/api/agents')) {
      return Promise.resolve(
        createResponse({
          json: async () => [{ agent_id: 'agent-1', status: 'running', session_id: 's1' }],
        })
      )
    }
    if (urlString.includes('/config')) {
      return Promise.resolve(createResponse({ json: async () => ({ session_id: 's2', session_token: 't2' }) }))
    }
    return Promise.resolve(createResponse({}))
  })
  vi.stubGlobal('fetch', fetchMock)

  render(<App />)

  const input = await screen.findByPlaceholderText('Message')
  fireEvent.change(input, { target: { value: '/config' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  await waitFor(() => {
    expect(screen.getByText(/Blueprint focused/i)).toBeInTheDocument()
  })

  fireEvent.change(input, { target: { value: '/restart' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  await waitFor(() => {
    expect(screen.getByText(/Restart requested/i)).toBeInTheDocument()
  })
})
