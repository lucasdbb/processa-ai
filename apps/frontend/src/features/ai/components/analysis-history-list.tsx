import { useState } from 'react'
import { CheckCircle2, Clock, FileText, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAnalysisHistory, type AnalysisJob } from '@/features/ai/hooks/use-analysis-history'
import { AnalysisResultModal } from './analysis-result-modal'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'

interface AnalysisHistoryListProps {
  functionality?: string
  clientId?: string | null
  title?: string
  refreshKey?: number
}

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr)
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return { day, time }
}

export function AnalysisHistoryList({ functionality, clientId, title = 'Histórico de Análises', refreshKey }: AnalysisHistoryListProps) {
  const { data: jobsData, isLoading, error, refetch } = useAnalysisHistory(functionality, clientId, refreshKey)
  const jobs = jobsData ?? []
  
  const [selectedJob, setSelectedJob] = useState<AnalysisJob | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [jobToDelete, setJobToDelete] = useState<AnalysisJob | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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
      }
    }

    // Fallback para URL antiga
    setSelectedJob(job)
    setIsModalOpen(true)
  }

  const handleDeleteClick = (e: React.MouseEvent, job: AnalysisJob) => {
    e.stopPropagation()
    setJobToDelete(job)
  }

  const handleConfirmDelete = async () => {
    if (!jobToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetchWithCredentials(`${API_URL}/ai/jobs/${encodeURIComponent(jobToDelete.id)}`, {
        method: 'DELETE',
      })

      if (!response.ok && response.status !== 204) {
        throw new Error('Falha ao deletar análise')
      }

      toast.success('Análise removida com sucesso')
      setJobToDelete(null)
      refetch()
    } catch (err) {
      toast.error('Erro ao remover análise')
    } finally {
      setIsDeleting(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'processing': return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluído'
      case 'processing': return 'Processando...'
      case 'failed': return 'Falhou'
      default: return 'Pendente'
    }
  }

  const displayJobs = jobs

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-[72px] w-full rounded-lg" />
        <Skeleton className="h-[72px] w-full rounded-lg" />
        <Skeleton className="h-[72px] w-full rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg">
        Erro ao carregar histórico: {error.message}
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
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-primary" />
            {title}
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {displayJobs.length} {displayJobs.length === 1 ? 'item' : 'itens'}
            </span>
          </h3>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {displayJobs.map((job) => {
              const { day, time } = formatDateTime(job.created_at)
              return (
                <div
                  key={job.id}
                  onClick={() => handleJobClick(job)}
                  className={`
                    relative group rounded-lg border bg-background transition-all
                    ${job.status === 'completed'
                      ? 'cursor-pointer border-border hover:border-primary/40 hover:shadow-sm'
                      : 'opacity-60 cursor-default border-border/50'
                    }
                  `}
                >
                  <div className="p-3 flex items-start gap-3">
                    {/* Status icon */}
                    <div className="mt-0.5 flex-shrink-0">
                      {getStatusIcon(job.status)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* File name */}
                      <h4 className="text-sm font-medium text-foreground truncate leading-tight">
                        {job.metadata?.file_name || `Análise #${job.id.slice(0, 8)}`}
                      </h4>

                      {/* Meta info row: date · time · client */}
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                        {day} &middot; {time}
                        {!clientId && job.metadata?.client_name && (
                          <> &middot; {job.metadata.client_name}</>
                        )}
                        {job.status !== 'completed' && (
                          <> &middot; <span className={
                            job.status === 'processing' ? 'text-yellow-600 dark:text-yellow-400' :
                            job.status === 'failed' ? 'text-red-500' : ''
                          }>{getStatusLabel(job.status)}</span></>
                        )}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, job)}
                      className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"
                      title="Remover análise"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
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

      <ConfirmDialog
        isOpen={!!jobToDelete}
        onClose={() => setJobToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Remover análise"
        description={`Tem certeza que deseja remover "${jobToDelete?.metadata?.file_name || 'esta análise'}"? Esta ação não pode ser desfeita.`}
        confirmText="Remover"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />
    </>
  )
}
