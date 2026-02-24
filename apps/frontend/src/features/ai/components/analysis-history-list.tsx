import { useState } from 'react'
import { CheckCircle2, Clock, FileText, XCircle } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useAnalysisHistory, type AnalysisJob } from '@/features/ai/hooks/use-analysis-history'
import { AnalysisResultModal } from './analysis-result-modal'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'

interface AnalysisHistoryListProps {
  functionality?: string
  clientId?: string | null
  title?: string
}

export function AnalysisHistoryList({ functionality, clientId, title = 'Histórico de Análises' }: AnalysisHistoryListProps) {
  const { jobs, isLoading, error } = useAnalysisHistory(functionality, clientId)
  const [selectedJob, setSelectedJob] = useState<AnalysisJob | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleJobClick = async (job: AnalysisJob) => {
    if (job.status !== 'completed') return

    // Se tiver document_id, buscar URL fresca
    if (job.result?.document_id) {
      try {
        const response = await fetchWithCredentials(`${API_URL}/ai/documents/${job.result.document_id}/download`)
        if (response.ok) {
          const data = await response.json()
          const freshUrl = data.download_url
          
          setSelectedJob({
            ...job,
            result: {
              ...job.result,
              download_url: freshUrl,
              pdf_url: freshUrl
            }
          })
          setIsModalOpen(true)
          return
        }
      } catch (error) {
        console.error('Failed to refresh download URL', error)
      }
    }

    // Fallback para URL antiga
    setSelectedJob(job)
    setIsModalOpen(true)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'processing': return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  // O filtro já é feito no backend pelo hook useAnalysisHistory
  const displayJobs = jobs

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500 bg-red-50 rounded-lg">
        Erro ao carregar histórico: {error}
      </div>
    )
  }

  if (displayJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <FileText className="h-12 w-12 mb-4 opacity-20" />
        <p>Nenhuma análise encontrada.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {title}
          </h3>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {displayJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => handleJobClick(job)}
                className={`
                  relative group flex items-start gap-3 p-3 rounded-lg border border-border bg-background transition-all
                  ${job.status === 'completed' ? 'cursor-pointer hover:border-primary/50 hover:shadow-sm hover:bg-muted/50' : 'opacity-70 cursor-default'}
                `}
              >
                <div className="mt-1 flex-shrink-0">
                  {getStatusIcon(job.status)}
                </div>
                
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-foreground truncate">
                      {job.metadata?.file_name || `Análise #${job.id.slice(0, 8)}`}
                    </h4>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(job.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  
                  {/* Se não estiver filtrando por cliente, mostra o nome do cliente */}
                  {!clientId && job.metadata?.client_name && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate max-w-[150px]">{job.metadata.client_name}</span>
                    </div>
                  )}

                  {job.status === 'failed' && (
                    <p className="text-xs text-red-500 mt-1">Falha no processamento</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {selectedJob && (
        <AnalysisResultModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Resultado: ${selectedJob.metadata?.file_name || 'Análise'}`}
          pdfUrl={selectedJob.result?.download_url || selectedJob.result?.pdf_url}
          htmlContent={selectedJob.result?.content || selectedJob.result?.text}
          onDownload={() => {
             const url = selectedJob.result?.download_url || selectedJob.result?.pdf_url
             if (url) {
               window.open(url, '_blank')
             }
          }}
        />
      )}
    </>
  )
}
