import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchCalculators } from './api'
import type { CalculatorItem } from './api'

interface CalculatorsContextValue {
  calculators: CalculatorItem[]
  isLoading: boolean
  getCalculatorBySlug: (slug: string) => CalculatorItem | undefined
}

const CalculatorsContext = createContext<CalculatorsContextValue | undefined>(undefined)

export function CalculatorsProvider({ children }: { children: ReactNode }) {
  const [calculators, setCalculators] = useState<CalculatorItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchCalculators()
      .then((calculators) => setCalculators(calculators))
      .finally(() => setIsLoading(false))
  }, [])

  const getCalculatorBySlug = (slug: string) => {
    return calculators.find((calc) => calc.slug === slug)
  }

  return (
    <CalculatorsContext.Provider value={{ calculators, isLoading, getCalculatorBySlug }}>
      {children}
    </CalculatorsContext.Provider>
  )
}

export function useCalculators() {
  const context = useContext(CalculatorsContext)
  if (!context) {
    throw new Error('useCalculators must be used within CalculatorsProvider')
  }
  return context
}
