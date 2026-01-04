import { act } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

test('renders quick create entry', async () => {
  await renderApp()
  await waitFor(() => {
    expect(screen.getByText(/启动 Agent/i)).toBeInTheDocument()
  })
})

test('create view shows quick create card and wizard entry', async () => {
  await renderApp()
  expect(screen.getByText(/快速创建/i)).toBeInTheDocument()
  expect(screen.getByText(/向导创建/i)).toBeInTheDocument()
})

test('switches to run view after create', async () => {
  await renderApp()
  const createButton = await screen.findByRole('button', { name: /创建并启动/i })
  fireEvent.click(createButton)
  expect(await screen.findByText(/对话/i)).toBeInTheDocument()
})
