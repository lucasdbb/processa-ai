import { useEffect, useState, type ReactNode } from 'react'
import { fetchAiTools } from './api'
import type { AiTool } from './types'
import { AiToolsContext } from './context'

export function AiToolsProvider({ children }: { children: ReactNode }) {
  const [tools, setTools] = useState<AiTool[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchAiTools()
      .then((tools) => setTools(tools))
      .catch(() => setError(true))
      .finally(() => setIsLoading(false))
  }, [])

  const getToolBySlug = (slug: string) => {
    return tools.find((tool) => tool.slug === slug)
  }

  return (
    <AiToolsContext.Provider value={{ tools, isLoading, error, getToolBySlug }}>
      {children}
    </AiToolsContext.Provider>
  )
}
