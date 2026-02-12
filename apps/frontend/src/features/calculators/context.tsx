import { createContext, useContext } from 'react'
import type { CalculatorItem } from './api'

interface CalculatorsContextValue {
  calculators: CalculatorItem[]
  isLoading: boolean
  getCalculatorBySlug: (slug: string) => CalculatorItem | undefined
}

export const CalculatorsContext = createContext<CalculatorsContextValue | undefined>(undefined)

export function useCalculators() {
  const context = useContext(CalculatorsContext)
  if (!context) {
    throw new Error('useCalculators must be used within CalculatorsProvider')
  }
  return context
}
