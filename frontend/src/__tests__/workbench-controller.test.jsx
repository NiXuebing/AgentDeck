import { renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { useWorkbenchController } from '../hooks/useWorkbenchController'

it('initializes workbench state machine in DRAFT', () => {
  const { result } = renderHook(() =>
    useWorkbenchController({
      apiBase: '',
      onHydrateConfig: vi.fn(),
      onLaunch: vi.fn(),
      configPreview: '{}',
      selectedAgentId: '',
      sessionByAgent: {},
      onSessionUpdate: vi.fn(),
    })
  )
  expect(result.current.state).toBe('DRAFT')
})
