import { createContext, useContext } from 'react'
import type { AiTool } from './types'

interface AiToolsContextValue {
  tools: AiTool[]
  isLoading: boolean
  getToolBySlug: (slug: string) => AiTool | undefined
}

export const AiToolsContext = createContext<AiToolsContextValue | undefined>(undefined)

export function useAiTools() {
  const context = useContext(AiToolsContext)
  if (!context) {
    throw new Error('useAiTools must be used within AiToolsProvider')
  }
  return context
}
