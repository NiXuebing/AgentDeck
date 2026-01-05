import { act } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import App from '../App'

const mockFetch = () =>
  vi.fn((url) => {
    if (url.includes('/api/agents/launch')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          agent_id: 'agent-1',
          session_id: 'session-1',
          session_token: 'token-1',
        }),
      })
    }
    if (url.includes('/api/agents')) {
      return Promise.resolve({
        ok: true,
        json: async () => [],
      })
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    })
  })

const renderApp = async () => {
  await act(async () => {
    render(<App />)
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch())
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('renders the workbench layout', async () => {
  await renderApp()
  await waitFor(() => {
    expect(screen.getByTestId('blueprint-skeleton')).toBeInTheDocument()
  })
  expect(screen.getByRole('heading', { name: 'Stage' })).toBeInTheDocument()
})

test('shows the architect panel before any agent is selected', async () => {
  await renderApp()
  expect(screen.getByText(/Architect/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument()
})

test('stage panel exposes message input and send button', async () => {
  await renderApp()
  expect(screen.getByPlaceholderText('Message')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
})
