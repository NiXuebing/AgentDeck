import { createContext, useContext } from 'react'

export const WorkbenchContext = createContext(null)

export function useWorkbench() {
  const ctx = useContext(WorkbenchContext)
  if (!ctx) {
    throw new Error('useWorkbench must be used within WorkbenchContext.Provider')
  }
  return ctx
}
