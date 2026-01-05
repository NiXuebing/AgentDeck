import { act, renderHook } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { useWorkbenchController } from '../hooks/useWorkbenchController'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('prefers staged genesis fill callback when provided', async () => {
  const onGenesisFill = vi.fn()
  const onLaunch = vi.fn()

  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ config: { id: 'demo' } }),
    })
  ))

  const { result } = renderHook(() =>
    useWorkbenchController({
      apiBase: '',
      onHydrateConfig: vi.fn(),
      onGenesisFill,
      onLaunch,
      configPreview: '{}',
      selectedAgentId: '',
      sessionByAgent: {},
      onSessionUpdate: vi.fn(),
    })
  )

  act(() => {
    result.current.setArchitectPrompt('build me')
  })

  await act(async () => {
    await result.current.handleArchitectSubmit()
  })

  expect(onGenesisFill).toHaveBeenCalledWith({ id: 'demo' })
})
