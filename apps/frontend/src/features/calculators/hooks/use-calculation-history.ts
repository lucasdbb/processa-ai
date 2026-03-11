import { useState, useEffect, useCallback } from 'react'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'

export interface CalculationItem {
  id: string
  calculator_key: string
  status: 'processing' | 'completed' | 'failed'
  client_id: string | null
  input_payload: Record<string, unknown> | null
  output_payload: Record<string, unknown> | null
  error: string | null
  created_at: string
  finished_at: string | null
}

export function useCalculationHistory(
  calculatorKey?: string,
  clientId?: string | null,
  refreshKey?: number
) {
  const { user } = useUser()
  const [calculations, setCalculations] = useState<CalculationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!user) return

    try {
      setIsLoading(true)
      let url = `${API_URL}/calculators/history?user_id=${user.id}`

      if (calculatorKey) {
        url += `&calculator_key=${encodeURIComponent(calculatorKey)}`
      }
      if (clientId) {
        url += `&client_id=${encodeURIComponent(clientId)}`
      }

      const response = await fetchWithCredentials(url)

      if (!response.ok) {
        throw new Error('Falha ao carregar histórico')
      }

      const data = (await response.json()) as { calculations: CalculationItem[] }
      setCalculations(data.calculations)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [user, calculatorKey, clientId])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory, refreshKey])

  return { calculations, isLoading, error, refetch: fetchHistory }
}
