import { useEffect, useState, type ReactNode } from 'react'
import type { AiTool } from '@/features/ai/types'
import type { CalculatorItem } from '@/features/calculators/api'
import { AiToolsContext } from '@/features/ai/context'
import { CalculatorsContext } from '@/features/calculators/context'
import { fetchToolsCatalog } from './tools-catalog-utils'

export function ToolsCatalogProvider({ children }: { children: ReactNode }) {
  const [aiTools, setAiTools] = useState<AiTool[]>([])
  const [calculators, setCalculators] = useState<CalculatorItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchToolsCatalog()
      .then(({ aiTools, calculators }) => {
        setAiTools(aiTools)
        setCalculators(calculators)
      })
      .catch(() => setError(true))
      .finally(() => setIsLoading(false))
  }, [])

  const getToolBySlug = (slug: string) => aiTools.find((t) => t.slug === slug)
  const getCalculatorBySlug = (slug: string) => calculators.find((c) => c.slug === slug)

  return (
    <AiToolsContext.Provider value={{ tools: aiTools, isLoading, error, getToolBySlug }}>
      <CalculatorsContext.Provider
        value={{ calculators, isLoading, error, getCalculatorBySlug }}
      >
        {children}
      </CalculatorsContext.Provider>
    </AiToolsContext.Provider>
  )
}
