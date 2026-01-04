import { fireEvent, render, screen } from '@testing-library/react'
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

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch())
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('renders quick create entry', () => {
  render(<App />)
  expect(screen.getByText(/Launch Agent/i)).toBeInTheDocument()
})

test('create view shows quick create card and wizard entry', () => {
  render(<App />)
  expect(screen.getByText(/快速创建/i)).toBeInTheDocument()
  expect(screen.getByText(/向导创建/i)).toBeInTheDocument()
})

test('switches to run view after create', async () => {
  render(<App />)
  const createButton = await screen.findByRole('button', { name: /创建并启动/i })
  fireEvent.click(createButton)
  expect(await screen.findByText(/Conversation/i)).toBeInTheDocument()
})
