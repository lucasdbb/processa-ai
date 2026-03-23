import { useQuery } from '@tanstack/react-query'
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
  document_id: string | null
}

export function useCalculationHistory(
  calculatorKey?: string,
  clientId?: string | null,
  refreshKey?: number // Mantemos por retrocompatibilidade temporária ou re-fetches forçados
) {
  const { user } = useUser()

  return useQuery({
    queryKey: ['calculations', 'history', calculatorKey, clientId, refreshKey],
    queryFn: async () => {
      let url = `${API_URL}/calculators/history?limit=50`

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
      return data.calculations
    },
    enabled: !!user,
  })
}
