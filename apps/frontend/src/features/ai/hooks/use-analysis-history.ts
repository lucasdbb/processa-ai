import { useState, useEffect, useCallback } from 'react'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'

export interface AnalysisJob {
  id: string
  created_at: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
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

export function useAnalysisHistory(functionality?: string, clientId?: string | null) {
  const { user } = useUser()
  const [jobs, setJobs] = useState<AnalysisJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    if (!user) return

    try {
      setIsLoading(true)
      let url = `${API_URL}/ai/jobs?user_id=${user.id}`
      
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
      // O backend já retorna ordenado
      setJobs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [user, functionality, clientId])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  return { jobs, isLoading, error, refetch: fetchJobs }
}
