import { useQuery } from '@tanstack/react-query'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'

export interface AnalysisJob {
  id: string
  created_at: string
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed'
  functionality: string
  metadata?: {
    file_name?: string
    client_name?: string
    client_id?: string
    prompt_preview?: string
  }
  result?: {
    download_url?: string
    pdf_url?: string // Algumas ferramentas usam pdf_url
    content?: string // Base64 ou texto
    text?: string // Texto gerado
    document_id?: string
  }
}

const POLL_INTERVAL = 5000 // 5s when there are processing jobs

export function useAnalysisHistory(functionality?: string, clientId?: string | null, refreshKey?: number) {
  const { user } = useUser()

  return useQuery({
    queryKey: ['ai', 'jobs', functionality, clientId, refreshKey],
    queryFn: async () => {
      let url = `${API_URL}/ai/jobs?limit=50`

      if (functionality) {
        url += `&functionality=${functionality}`
      }

      if (clientId) {
        url += `&client_id=${clientId}`
      }

      const response = await fetchWithCredentials(url)

      if (!response.ok) {
        throw new Error('Falha ao carregar histórico')
      }

      const data = await response.json()
      return data as AnalysisJob[]
    },
    enabled: !!user,
    // Polling is configured directly via react-query refetchInterval
    refetchInterval: (query) => {
      const data = query.state.data
      const hasActive = data?.some((j: AnalysisJob) =>
        j.status === 'pending' || j.status === 'queued' || j.status === 'processing'
      )
      return hasActive ? POLL_INTERVAL : false
    },
  })
}
