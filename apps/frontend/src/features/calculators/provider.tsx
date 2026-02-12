import { useEffect, useState, type ReactNode } from 'react'
import { fetchCalculators } from './api'
import type { CalculatorItem } from './api'
import { CalculatorsContext } from './context'

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
