import { useState } from 'react'
import { CheckCircle2, Clock, FileText, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AnalysisResultModal } from '@/features/ai/components/analysis-result-modal'
import { useCalculationHistory, type CalculationItem } from '../hooks/use-calculation-history'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'

interface CalculationHistoryListProps {
  calculatorKey?: string
  clientId?: string | null
  title?: string
  refreshKey?: number
}

const TIPO_LABELS: Record<string, string> = {
  sem_justa_causa: 'Sem Justa Causa',
  por_pedido: 'Pedido de Demissão',
  com_justa_causa: 'Justa Causa',
  acordo: 'Acordo Mútuo',
  termino_contrato: 'Término de Contrato',
}

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr)
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return { day, time }
}

function formatMoney(value: unknown): string {
  const n = Number(value)
  if (isNaN(n)) return '-'
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getCalcSummary(calc: CalculationItem): { title: string; subtitle: string } {
  const input = calc.input_payload || {}
  const output = calc.output_payload || {}
  const detalhes = (output.detalhes || {}) as Record<string, unknown>
  const tipo = String(input.tipo_rescisao || '')

  const tipoLabel = TIPO_LABELS[tipo] || tipo
  const total = detalhes.total

  return {
    title: tipoLabel || `Cálculo #${calc.id.slice(0, 8)}`,
    subtitle: total !== undefined ? formatMoney(total) : 'Processando...',
  }
}

export function CalculationHistoryList({
  calculatorKey,
  clientId,
  title = 'Histórico de Cálculos',
  refreshKey,
}: CalculationHistoryListProps) {
  const { user } = useUser()
  const { calculations, isLoading, error, refetch } = useCalculationHistory(calculatorKey, clientId, refreshKey)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | undefined>()
  const [modalTitle, setModalTitle] = useState('')
  const [calcToDelete, setCalcToDelete] = useState<CalculationItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleCalcClick = async (calc: CalculationItem) => {
    if (calc.status !== 'completed' || !user) return

    if (!calc.document_id) {
      toast.error('PDF não disponível para este cálculo')
      return
    }

    try {
      const res = await fetchWithCredentials(
        `${API_URL}/documents/${encodeURIComponent(calc.document_id)}/download`
      )

      if (res.ok) {
        const data = (await res.json()) as { download_url: string; filename: string }
        setPdfUrl(data.download_url)
        const summary = getCalcSummary(calc)
        setModalTitle(`Rescisão Trabalhista — ${summary.title}`)
        setIsModalOpen(true)
        return
      }

      if (res.status === 404) {
        toast.error('PDF não disponível para este cálculo')
        return
      }

      throw new Error('Falha ao buscar documento')
    } catch (err) {
      console.error('Failed to fetch download URL', err)
      toast.error('Erro ao abrir documento')
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, calc: CalculationItem) => {
    e.stopPropagation()
    setCalcToDelete(calc)
  }

  const handleConfirmDelete = async () => {
    if (!calcToDelete || !user) return

    setIsDeleting(true)
    try {
      const res = await fetchWithCredentials(
        `${API_URL}/calculators/${encodeURIComponent(calcToDelete.id)}?user_id=${user.id}`,
        { method: 'DELETE' }
      )

      if (!res.ok && res.status !== 204) {
        throw new Error('Falha ao deletar cálculo')
      }

      toast.success('Cálculo removido com sucesso')
      setCalcToDelete(null)
      refetch()
    } catch (err) {
      console.error('Failed to delete calculation', err)
      toast.error('Erro ao remover cálculo')
    } finally {
      setIsDeleting(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Concluído'
      case 'processing':
        return 'Processando...'
      case 'failed':
        return 'Falhou'
      default:
        return 'Pendente'
    }
  }

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
        Erro ao carregar histórico: {error}
      </div>
    )
  }

  if (calculations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <FileText className="h-12 w-12 mb-4 opacity-20" />
        <p>Nenhum cálculo encontrado.</p>
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
              {calculations.length} {calculations.length === 1 ? 'item' : 'itens'}
            </span>
          </h3>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {calculations.map((calc) => {
              const { day, time } = formatDateTime(calc.created_at)
              const summary = getCalcSummary(calc)
              return (
                <div
                  key={calc.id}
                  onClick={() => handleCalcClick(calc)}
                  className={`
                    relative group rounded-lg border bg-background transition-all
                    ${
                      calc.status === 'completed'
                        ? 'cursor-pointer border-border hover:border-primary/40 hover:shadow-sm'
                        : 'opacity-60 cursor-default border-border/50'
                    }
                  `}
                >
                  <div className="p-3 flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">{getStatusIcon(calc.status)}</div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate leading-tight">
                        {summary.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                        {day} &middot; {time}
                        {calc.status === 'completed' && (
                          <> &middot; <span className="font-medium text-foreground">{summary.subtitle}</span></>
                        )}
                        {calc.status !== 'completed' && (
                          <>
                            {' '}
                            &middot;{' '}
                            <span
                              className={
                                calc.status === 'processing'
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : calc.status === 'failed'
                                    ? 'text-red-500'
                                    : ''
                              }
                            >
                              {getStatusLabel(calc.status)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, calc)}
                      className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"
                      title="Remover cálculo"
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

      <AnalysisResultModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
        pdfUrl={pdfUrl}
        onDownload={
          pdfUrl
            ? () => {
                window.open(pdfUrl, '_blank')
              }
            : undefined
        }
      />

      <ConfirmDialog
        isOpen={!!calcToDelete}
        onClose={() => setCalcToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Remover cálculo"
        description={`Tem certeza que deseja remover "${calcToDelete ? getCalcSummary(calcToDelete).title : 'este cálculo'}"? Esta ação não pode ser desfeita.`}
        confirmText="Remover"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />
    </>
  )
}
