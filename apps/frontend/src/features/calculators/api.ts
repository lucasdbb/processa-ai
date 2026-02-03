import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import {
  Calculator as CalculatorIcon,
  CalendarClock,
  TrendingUp,
  DollarSign,
  Percent,
  type LucideIcon,
} from 'lucide-react'

export interface CalculatorItem {
  slug: string
  name: string
  description: string
  icon: LucideIcon
  path: string
  locked: boolean
  order: number
}

// Map icon name to lucide-react component
const ICON_MAP: Record<string, LucideIcon> = {
  Calculator: CalculatorIcon,
  CalendarClock,
  TrendingUp,
  DollarSign,
  Percent,
}

interface CalculatorResponse {
  slug: string
  name: string
  description: string
  icon: string
  path: string
  locked: boolean
  order: number
}

interface CalculatorsListResponse {
  calculators: CalculatorResponse[]
}

export async function fetchCalculators(): Promise<CalculatorItem[]> {
  try {
    const response = await fetchWithCredentials(`${API_URL}/calculators/list`)

    if (!response.ok) {
      console.error('Failed to fetch calculators from backend')
      return []
    }

    const data = (await response.json()) as CalculatorsListResponse

    return data.calculators.map((calc) => ({
      slug: calc.slug,
      name: calc.name,
      description: calc.description,
      icon: ICON_MAP[calc.icon] || CalculatorIcon,
      path: calc.path,
      locked: calc.locked,
      order: calc.order,
    }))
  } catch (error) {
    console.error('Error fetching calculators:', error)
    return []
  }
}
