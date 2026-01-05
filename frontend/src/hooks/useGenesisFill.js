import { useEffect, useRef } from 'react'

const STEP_DELAY_MS = 300

export function useGenesisFill(onHydrate) {
  const timersRef = useRef([])

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer))
      timersRef.current = []
    }
  }, [])

  const schedule = (steps) => {
    timersRef.current.forEach((timer) => clearTimeout(timer))
    timersRef.current = []

    if (!steps || steps.length === 0) {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      steps.forEach((step, index) => {
        const timer = setTimeout(() => {
          onHydrate?.(step)
          if (index === steps.length - 1) {
            resolve()
          }
        }, STEP_DELAY_MS * (index + 1))
        timersRef.current.push(timer)
      })
    })
  }

  return { schedule }
}
