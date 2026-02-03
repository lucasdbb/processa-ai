import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchAiTools } from './api'
import type { AiTool } from './types'

interface AiToolsContextValue {
  tools: AiTool[]
  isLoading: boolean
  getToolBySlug: (slug: string) => AiTool | undefined
}

const AiToolsContext = createContext<AiToolsContextValue | undefined>(undefined)

export function AiToolsProvider({ children }: { children: ReactNode }) {
  const [tools, setTools] = useState<AiTool[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAiTools()
      .then((tools) => setTools(tools))
      .finally(() => setIsLoading(false))
  }, [])

  const getToolBySlug = (slug: string) => {
    return tools.find((tool) => tool.slug === slug)
  }

  return (
    <AiToolsContext.Provider value={{ tools, isLoading, getToolBySlug }}>
      {children}
    </AiToolsContext.Provider>
  )
}

export function useAiTools() {
  const context = useContext(AiToolsContext)
  if (!context) {
    throw new Error('useAiTools must be used within AiToolsProvider')
  }
  return context
}
