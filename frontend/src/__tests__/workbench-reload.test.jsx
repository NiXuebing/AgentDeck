import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

it('shows reloading banner when applying config', async () => {
  let resolveConfig
  const configPromise = new Promise((resolve) => {
    resolveConfig = resolve
  })
  const fetchMock = vi.fn((url, options) => {
    const urlString = asUrl(url)
    const method = options?.method || url?.method
    if (urlString.includes('/api/agents') && !urlString.includes('/config')) {
      return Promise.resolve(
        createResponse({
          json: async () => [{ agent_id: 'agent-1', status: 'running', session_id: 's1' }],
        })
      )
    }
    if (urlString.includes('/api/agents/agent-1/config') && method === 'PATCH') {
      return Promise.resolve(
        createResponse({
          json: async () => configPromise,
        })
      )
    }
    return Promise.resolve(createResponse({}))
  })
  vi.stubGlobal('fetch', fetchMock)

  render(<App />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  await screen.findAllByText('agent-1')

  fireEvent.click(screen.getByRole('button', { name: /agent-1/i }))
  await waitFor(() => expect(screen.queryByText(/Architect/i)).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /Apply/i }))
  expect(await screen.findByText(/Reloading/i)).toBeInTheDocument()
  await act(async () => {
    resolveConfig({ session_id: 's2', session_token: 't2' })
  })
})

it('shows rollback action after a failed reload following a success', async () => {
  let applyCount = 0
  const fetchMock = vi.fn((url, options) => {
    const urlString = asUrl(url)
    const method = options?.method || url?.method
    if (urlString.includes('/api/agents') && !urlString.includes('/config')) {
      return Promise.resolve(
        createResponse({
          json: async () => [{ agent_id: 'agent-1', status: 'running', session_id: 's1' }],
        })
      )
    }
    if (urlString.includes('/api/agents/agent-1/config') && method === 'PATCH') {
      applyCount += 1
      if (applyCount === 1) {
        return Promise.resolve(
          createResponse({
            json: async () => ({ session_id: 's2', session_token: 't2' }),
          })
        )
      }
      return Promise.resolve(
        createResponse({
          ok: false,
          text: async () => 'boom',
        })
      )
    }
    return Promise.resolve(createResponse({}))
  })
  vi.stubGlobal('fetch', fetchMock)

  render(<App />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  await screen.findAllByText('agent-1')

  fireEvent.click(screen.getByRole('button', { name: /agent-1/i }))
  await waitFor(() => expect(screen.queryByText(/Architect/i)).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /Apply/i }))
  await waitFor(() => expect(applyCount).toBe(1))

  fireEvent.click(screen.getByRole('button', { name: /Apply/i }))
  expect(await screen.findByRole('button', { name: /Rollback/i })).toBeInTheDocument()
})
