import { render, screen, waitFor } from '@testing-library/react'
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

it('renders skills rack add button', async () => {
  const fetchMock = vi.fn((url) => {
    const urlString = asUrl(url)
    if (urlString.includes('/api/agents')) {
      return Promise.resolve(
        createResponse({
          json: async () => [{ agent_id: 'agent-1', status: 'running', session_id: 's1' }],
        })
      )
    }
    return Promise.resolve(createResponse({}))
  })
  vi.stubGlobal('fetch', fetchMock)

  render(<App />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  expect(await screen.findByRole('button', { name: /Add/i })).toBeInTheDocument()
})
