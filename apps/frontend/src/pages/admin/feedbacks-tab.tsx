import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { feedbackService, type FeedbackResponse } from '@/services/feedback-service'

const CATEGORY_LABELS: Record<string, string> = {
  ux: 'Facilidade de uso',
  bug_report: 'Erro no sistema',
  performance: 'Performance',
  feature_request: 'Nova funcionalidade',
  content: 'Conteudo e comunicacao',
}

const TYPE_LABELS: Record<FeedbackResponse['type'], string> = {
  suggestion: 'Sugestao',
  bug: 'Problema',
  other: 'Outro',
}

const getCategoryLabel = (category?: string) => {
  if (!category) return 'Nao informado'
  return CATEGORY_LABELS[category] ?? category
}

const STATUS_LABELS: Record<FeedbackResponse['status'], string> = {
  new: 'Recebido',
  in_progress: 'Em análise',
  done: 'Concluído',
  archived: 'Arquivado',
}

const STATUS_OPTIONS: FeedbackResponse['status'][] = ['new', 'in_progress', 'done', 'archived']

const getStatusLabel = (status: FeedbackResponse['status']) => STATUS_LABELS[status]

const getTypeBadgeClass = (type: FeedbackResponse['type']) => {
  if (type === 'bug') {
    return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900/50'
  }

  if (type === 'suggestion') {
    return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50'
  }

  return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800'
}

const getStatusBadgeClass = (status: FeedbackResponse['status']) => {
  if (status === 'new') return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50'
  if (status === 'in_progress') {
    return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/50'
  }
  if (status === 'done') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-900/50'
  }
  return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800'
}

const getRatingBadgeClass = (rating: number | undefined) => {
  if (!rating) {
    return 'bg-muted text-muted-foreground border-border'
  }

  if (rating <= 2) {
    return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900/50'
  }

  if (rating === 3) {
    return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/50'
  }

  return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-900/50'
}

const formatDateTime = (value: string) => {
  try {
    return new Date(value).toLocaleString('pt-BR')
  } catch {
    return '-'
  }
}

const truncateText = (value: string | undefined, max = 160) => {
  if (!value) return '-'
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

export default function FeedbacksTab() {
  const [feedbacks, setFeedbacks] = useState<FeedbackResponse[]>([])
  const [isFeedbacksLoading, setIsFeedbacksLoading] = useState(true)
  const [feedbacksPage, setFeedbacksPage] = useState(1)
  const [feedbacksPageSize, setFeedbacksPageSize] = useState(10)
  const [feedbacksTotal, setFeedbacksTotal] = useState(0)
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<'all' | FeedbackResponse['status']>('all')
  const [feedbackSortOrder, setFeedbackSortOrder] = useState<'asc' | 'desc'>('desc')
  const [feedbackSearch, setFeedbackSearch] = useState('')
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackResponse | null>(null)
  const [isEditStatusDialogOpen, setIsEditStatusDialogOpen] = useState(false)
  const [isViewFeedbackDialogOpen, setIsViewFeedbackDialogOpen] = useState(false)
  const [isUpdatingFeedback, setIsUpdatingFeedback] = useState(false)
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackResponse['status']>('new')
  const [error, setError] = useState<string | null>(null)

  const loadFeedbacks = useCallback(async (page = 1, pageSize = feedbacksPageSize) => {
    setIsFeedbacksLoading(true)
    setError(null)
    try {
      const offset = (page - 1) * pageSize
      const data = await feedbackService.getAll(pageSize, offset, feedbackStatusFilter, feedbackSortOrder)
      const items = data.items || (Array.isArray(data) ? data : [])
      const total = typeof data.total === 'number' ? data.total : items.length
      setFeedbacks(items)
      setFeedbacksTotal(total)
      setFeedbacksPage(page)
      setFeedbacksPageSize(pageSize)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar feedbacks'
      setFeedbacks([])
      setFeedbacksTotal(0)
      setError(message)
      toast.error(message)
    } finally {
      setIsFeedbacksLoading(false)
    }
  }, [feedbackStatusFilter, feedbackSortOrder, feedbacksPageSize])

  useEffect(() => {
    void loadFeedbacks(1, feedbacksPageSize)
  }, [loadFeedbacks, feedbacksPageSize])

  const totalPages = Math.max(1, Math.ceil(feedbacksTotal / feedbacksPageSize))

  const filteredFeedbacks = useMemo(() => {
    const query = feedbackSearch.trim().toLowerCase()
    if (!query) return feedbacks

    return feedbacks.filter((item) => {
      return [
        item.user_name,
        item.user_email,
        item.reference_code,
        item.content,
        item.path,
        item.user_agent,
        item.adaptive_answer,
        getCategoryLabel(item.category),
        TYPE_LABELS[item.type],
        getStatusLabel(item.status),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [feedbackSearch, feedbacks])

  const statusOverview = useMemo(() => {
    return feedbacks.reduce(
      (acc, item) => {
        acc[item.status] += 1
        return acc
      },
      {
        new: 0,
        in_progress: 0,
        done: 0,
        archived: 0,
      } as Record<FeedbackResponse['status'], number>
    )
  }, [feedbacks])

  const averageRating = useMemo(() => {
    const ratings = feedbacks.map((item) => item.rating).filter((value): value is number => typeof value === 'number')
    if (ratings.length === 0) {
      return { value: '-', count: 0 }
    }

    const avg = ratings.reduce((sum, value) => sum + value, 0) / ratings.length
    return { value: avg.toFixed(1), count: ratings.length }
  }, [feedbacks])

  const visibleRangeStart = feedbacksTotal === 0 ? 0 : (feedbacksPage - 1) * feedbacksPageSize + 1
  const visibleRangeEnd = Math.min(feedbacksPage * feedbacksPageSize, feedbacksTotal)

  const handleUpdateFeedbackStatus = async () => {
    if (!selectedFeedback) return

    if (selectedFeedback.status === 'archived') {
      toast.error('Feedback arquivado não permite alteração de status.')
      return
    }

    setIsUpdatingFeedback(true)
    try {
      await feedbackService.update(selectedFeedback.id, { status: feedbackStatus })
      toast.success('Status do feedback atualizado!')
      await loadFeedbacks(feedbacksPage, feedbacksPageSize)
      setIsEditStatusDialogOpen(false)
      setSelectedFeedback(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status')
    } finally {
      setIsUpdatingFeedback(false)
    }
  }

  const openEditStatusDialog = (feedback: FeedbackResponse, e?: MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault()
    e?.stopPropagation()

    if (feedback.status === 'archived') {
      toast.info('Feedback arquivado está finalizado e não pode ser alterado.')
      return
    }

    setFeedbackStatus(feedback.status)
    setSelectedFeedback(feedback)
    setIsEditStatusDialogOpen(true)
  }

  const openViewFeedbackDialog = (feedback: FeedbackResponse) => {
    setSelectedFeedback(feedback)
    setIsViewFeedbackDialogOpen(true)
  }

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Gerenciar Feedbacks</h2>
          <p className="text-sm text-muted-foreground">
            Triagem dos envios mais recentes com contexto, prioridade e controle de status.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="border-blue-200/70 bg-blue-50/40 dark:border-blue-900/50 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Recebidos</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{statusOverview.new}</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200/70 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Em análise</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{statusOverview.in_progress}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Concluídos</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{statusOverview.done}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200/80 bg-slate-100/50 dark:border-slate-800 dark:bg-slate-900/30">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Arquivados</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{statusOverview.archived}</p>
            </CardContent>
          </Card>
          <Card className="border-violet-200/70 bg-violet-50/50 dark:border-violet-900/50 dark:bg-violet-950/20">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Nota média</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{averageRating.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{averageRating.count} com nota</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4 md:p-5">
            <div className="grid gap-3 xl:grid-cols-12 xl:items-center">
              <div className="relative w-full xl:col-span-5">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={feedbackSearch}
                  onChange={(event) => setFeedbackSearch(event.target.value)}
                  placeholder="Buscar por usuário, protocolo, conteúdo, categoria ou contexto"
                  className="pl-9"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:col-span-7 xl:grid-cols-4">
                <Select
                  value={feedbackStatusFilter}
                  onValueChange={(value) => setFeedbackStatusFilter(value as 'all' | FeedbackResponse['status'])}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>{getStatusLabel(status)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={String(feedbacksPageSize)}
                  onValueChange={(value) => setFeedbacksPageSize(Number(value))}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Linhas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 por página</SelectItem>
                    <SelectItem value="20">20 por página</SelectItem>
                    <SelectItem value="50">50 por página</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => setFeedbackSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                >
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  {feedbackSortOrder === 'desc' ? 'Mais recentes' : 'Mais antigos'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => loadFeedbacks(feedbacksPage, feedbacksPageSize)}
                  disabled={isFeedbacksLoading}
                >
                  <RefreshCw className={cn('mr-2 h-4 w-4', isFeedbacksLoading && 'animate-spin')} />
                  Atualizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <h3 className="font-medium text-red-900">Erro ao carregar dados</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        ) : null}

        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardContent className="p-0">
            {isFeedbacksLoading ? (
              <div className="flex items-center justify-center py-16">
                <LoadingSpinner size="lg" text="Carregando feedbacks..." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Usuário</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Tipo</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Resumo</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Nota</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Data</th>
                      <th className="px-6 py-3 text-right font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredFeedbacks.map((f) => (
                      <tr
                        key={f.id}
                        className="cursor-pointer transition-colors hover:bg-muted/30"
                        onClick={() => openViewFeedbackDialog(f)}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-foreground">{f.user_name || 'Usuário'}</p>
                            <p className="text-xs text-muted-foreground">{f.user_email || '-'}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <span className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                              getTypeBadgeClass(f.type)
                            )}>
                              {TYPE_LABELS[f.type]}
                            </span>
                            <p className="text-xs text-muted-foreground">{getCategoryLabel(f.category)}</p>
                          </div>
                        </td>
                        <td className="max-w-md px-6 py-4 text-sm text-foreground" title={f.content}>
                          {truncateText(f.content, 120)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                            getRatingBadgeClass(f.rating)
                          )}>
                            {f.rating ? `${f.rating}/5` : 'Sem nota'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                            getStatusBadgeClass(f.status)
                          )}>
                            {getStatusLabel(f.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {formatDateTime(f.created_at)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                openViewFeedbackDialog(f)
                              }}
                            >
                              Ver
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={(e) => openEditStatusDialog(f, e)}
                              disabled={f.status === 'archived'}
                              title={f.status === 'archived' ? 'Feedback arquivado não pode ser alterado' : 'Alterar status'}
                            >
                              Status
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredFeedbacks.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    {feedbackSearch.trim() ? 'Nenhum feedback encontrado para este filtro local.' : 'Nenhum feedback encontrado.'}
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
          {feedbacksTotal > 0 && !isFeedbacksLoading ? (
            <div className="flex flex-col gap-3 border-t border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando {visibleRangeStart} a {visibleRangeEnd} de {feedbacksTotal} resultados
                {feedbackSearch.trim() ? ` (${filteredFeedbacks.length} após filtro local)` : ''}
              </div>
              <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadFeedbacks(feedbacksPage - 1, feedbacksPageSize)}
                  disabled={feedbacksPage === 1 || isFeedbacksLoading}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>
                <div className="text-sm font-medium">
                  Página {feedbacksPage} de {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadFeedbacks(feedbacksPage + 1, feedbacksPageSize)}
                  disabled={feedbacksPage >= totalPages || isFeedbacksLoading}
                >
                  Próximo
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      {/* Edit Status Dialog */}
      <Dialog
        open={isEditStatusDialogOpen}
        onOpenChange={(open) => {
          setIsEditStatusDialogOpen(open)
          if (!open) setSelectedFeedback(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Status</DialogTitle>
            <DialogDescription>
              Alterar o status do feedback de {selectedFeedback?.user_name || 'Usuário'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={feedbackStatus}
                onValueChange={(v) => setFeedbackStatus(v as FeedbackResponse['status'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>{getStatusLabel(status)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedFeedback && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="mb-1 font-medium">Resumo do conteúdo:</p>
                <p className="text-muted-foreground">{truncateText(selectedFeedback.content, 200)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditStatusDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleUpdateFeedbackStatus}
              disabled={isUpdatingFeedback || selectedFeedback?.status === 'archived'}
            >
              {isUpdatingFeedback ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Feedback Modal */}
      <Dialog
        open={isViewFeedbackDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsViewFeedbackDialogOpen(false)
            setSelectedFeedback(null)
          } else {
            setIsViewFeedbackDialogOpen(true)
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Feedback</DialogTitle>
            <DialogDescription>
              Informações completas do envio selecionado.
            </DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Usuário</p>
                    <p className="text-base font-semibold text-foreground">{selectedFeedback.user_name || 'Usuário'}</p>
                    <p className="text-sm text-muted-foreground">{selectedFeedback.user_email || '-'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      getTypeBadgeClass(selectedFeedback.type)
                    )}>
                      {TYPE_LABELS[selectedFeedback.type]}
                    </span>
                    <span className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      getRatingBadgeClass(selectedFeedback.rating)
                    )}>
                      {selectedFeedback.rating ? `${selectedFeedback.rating}/5` : 'Sem nota'}
                    </span>
                    <span className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      getStatusBadgeClass(selectedFeedback.status)
                    )}>
                      {getStatusLabel(selectedFeedback.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Protocolo</p>
                  <p className="mt-1 rounded bg-muted px-2 py-1 font-mono text-sm">{selectedFeedback.reference_code || '-'}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Categoria</p>
                  <p className="mt-1 text-sm text-foreground">{getCategoryLabel(selectedFeedback.category)}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">ID do feedback</p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{selectedFeedback.id}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Enviado em</p>
                  <p className="mt-1 text-sm text-foreground">{formatDateTime(selectedFeedback.created_at)}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Atualizado em</p>
                  <p className="mt-1 text-sm text-foreground">{formatDateTime(selectedFeedback.updated_at)}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Origem</p>
                  <p className="mt-1 break-all rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">{selectedFeedback.path || '-'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Conteúdo principal</label>
                <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted p-4 text-sm text-foreground">
                  {selectedFeedback.content}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Resposta complementar</label>
                <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
                  {selectedFeedback.adaptive_answer || 'Não informada.'}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">User Agent</label>
                <div className="break-all rounded-lg border border-border bg-muted p-4 text-xs text-muted-foreground">
                  {selectedFeedback.user_agent || 'Não informado.'}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedFeedback && selectedFeedback.status !== 'archived' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsViewFeedbackDialogOpen(false)
                  openEditStatusDialog(selectedFeedback)
                }}
              >
                Alterar status
              </Button>
            )}
            <Button onClick={() => setIsViewFeedbackDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
