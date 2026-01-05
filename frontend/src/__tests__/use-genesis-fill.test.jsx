import { act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { useGenesisFill } from '../hooks/useGenesisFill'

it('schedules staged hydration steps and resolves after final step', async () => {
  vi.useFakeTimers()
  const updates = []
  const { result } = renderHook(() => useGenesisFill((step) => updates.push(step)))

  let done = false
  await act(async () => {
    const promise = result.current.schedule([{ id: 'one' }, { id: 'two' }])
    promise.then(() => {
      done = true
    })
    vi.runAllTimers()
    await promise
  })

  expect(updates).toEqual([{ id: 'one' }, { id: 'two' }])
  expect(done).toBe(true)
  vi.useRealTimers()
})
