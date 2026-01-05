import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import App from '../App'

const createResponse = ({ ok = true, status = 200, json, text }) => ({
  ok,
  status,
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

it('shows architect prompt when no agent is selected', () => {
  render(<App />)
  expect(screen.getByText(/Architect/i)).toBeInTheDocument()
})

it('shows an error when blueprint generation fails', async () => {
  const fetchMock = vi.fn((url) => {
    const urlString = asUrl(url)
    if (urlString.includes('/api/blueprints/preview')) {
      return Promise.resolve(
        createResponse({
          ok: false,
          status: 502,
          text: async () => 'bad gateway',
        })
      )
    }
    if (urlString.includes('/api/agents')) {
      return Promise.resolve(createResponse({ json: async () => [] }))
    }
    return Promise.resolve(createResponse({}))
  })
  vi.stubGlobal('fetch', fetchMock)

  render(<App />)
  fireEvent.change(screen.getByPlaceholderText(/Describe the agent mission/i), {
    target: { value: 'Make a research agent' },
  })
  fireEvent.click(screen.getByRole('button', { name: /Generate/i }))

  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  expect(await screen.findByText(/Blueprint generation failed/i)).toBeInTheDocument()
})
