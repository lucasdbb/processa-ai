import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, MessageSquarePlus, Bug, HelpCircle, Star, CheckCircle2, ArrowLeft, History, RefreshCw, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { feedbackService, type FeedbackCategory, type FeedbackResponse } from '@/services/feedback-service'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface FeedbackFormDialogProps {
  isOpen: boolean
  onClose: () => void
}

type FeedbackType = 'suggestion' | 'bug' | 'other'
type FeedbackMode = 'quick_rating' | 'bug' | 'feature_request' | 'other' | 'share_experience'

const MODE_OPTIONS: Array<{ value: FeedbackMode; label: string; description: string; icon: typeof Star }> = [
  {
    value: 'quick_rating',
    label: 'Avaliação rápida',
    description: 'Dê uma nota de 1 a 5 em poucos segundos.',
    icon: Star,
  },
  {
    value: 'bug',
    label: 'Algo não funcionou',
    description: 'Relate erro, falha ou lentidão no sistema.',
    icon: Bug,
  },
  {
    value: 'feature_request',
    label: 'Quero uma melhoria',
    description: 'Sugira uma nova funcionalidade para seu fluxo.',
    icon: MessageSquarePlus,
  },
  {
    value: 'other',
    label: 'Outro assunto',
    description: 'Compartilhe um ponto que não se encaixa acima.',
    icon: HelpCircle,
  },
  {
    value: 'share_experience',
    label: 'Minha experiência',
    description: 'Conte de forma livre como foi seu uso hoje.',
    icon: MessageSquarePlus,
  },
]

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  ux: 'Facilidade de uso',
  bug_report: 'Erro no sistema',
  performance: 'Lentidão',
  feature_request: 'Nova funcionalidade',
  content: 'Conteúdo e comunicação',
}

const CATEGORY_OPTIONS_BY_MODE: Partial<Record<FeedbackMode, Array<{ value: FeedbackCategory; label: string }>>> = {
  bug: [
    { value: 'bug_report', label: 'Erro no sistema' },
    { value: 'performance', label: 'Lentidão' },
  ],
  other: [
    { value: 'content', label: 'Conteúdo e comunicação' },
    { value: 'ux', label: 'Facilidade de uso' },
  ],
}

const getAdaptivePrompt = (rating: number | null) => {
  if (!rating) return ''
  if (rating <= 2) return 'O que mais te frustrou nessa experiência?'
  if (rating === 3) return 'O que faltou para sua experiência ser melhor?'
  return 'O que devemos manter e ampliar no produto?'
}

const getModeLabel = (mode: FeedbackMode | null, fallbackType: FeedbackType) => {
  if (mode === 'quick_rating') return 'Avaliação rápida'
  if (mode === 'bug') return 'Algo não funcionou'
  if (mode === 'feature_request') return 'Quero uma melhoria'
  if (mode === 'share_experience') return 'Minha experiência'
  if (mode === 'other') return 'Outro assunto'

  if (fallbackType === 'suggestion') return 'Quero uma melhoria'
  if (fallbackType === 'bug') return 'Algo não funcionou'
  return 'Outro assunto'
}

const getApiTypeFromMode = (mode: FeedbackMode): FeedbackType => {
  if (mode === 'bug') return 'bug'
  if (mode === 'feature_request') return 'suggestion'
  return 'other'
}

const getDefaultCategoryFromMode = (mode: FeedbackMode): FeedbackCategory | null => {
  if (mode === 'feature_request') return 'feature_request'
  if (mode === 'share_experience') return 'content'
  return null
}

const modeNeedsCategorySelection = (mode: FeedbackMode) => mode === 'bug' || mode === 'other'

const modeNeedsContent = (mode: FeedbackMode) => mode !== 'quick_rating'

const modeNeedsRating = (mode: FeedbackMode) => mode === 'quick_rating'

const getModePlaceholder = (mode: FeedbackMode) => {
  if (mode === 'bug') return 'Descreva o problema e em qual tela ele aconteceu.'
  if (mode === 'feature_request') return 'Que melhoria você gostaria de ver e como isso ajudaria no seu dia a dia?'
  if (mode === 'share_experience') return 'Como foi sua experiência usando o produto hoje?'
  return 'Compartilhe sua observação para ajudarmos melhor.'
}

const getStatusLabel = (status: FeedbackResponse['status']) => {
  if (status === 'new') return 'Recebido'
  if (status === 'in_progress') return 'Em análise'
  if (status === 'done') return 'Concluído'
  return 'Arquivado'
}

const getStatusBadgeClass = (status: FeedbackResponse['status']) => {
  if (status === 'new') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300'
  if (status === 'in_progress') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300'
  }
  if (status === 'done') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300'
  }
  return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300'
}

const getCategoryLabel = (category?: FeedbackCategory | null) => {
  if (!category) return 'Não informado'
  return CATEGORY_LABELS[category] ?? 'Não informado'
}

const getModeDescription = (mode: FeedbackMode) => {
  const option = MODE_OPTIONS.find((item) => item.value === mode)
  return option?.description ?? ''
}

export function FeedbackFormDialog({ isOpen, onClose }: FeedbackFormDialogProps) {
  const [mode, setMode] = useState<FeedbackMode>('quick_rating')
  const [content, setContent] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [category, setCategory] = useState<FeedbackCategory | null>(null)
  const [adaptiveAnswer, setAdaptiveAnswer] = useState('')
  const [submittedFeedback, setSubmittedFeedback] = useState<FeedbackResponse | null>(null)
  const [submittedMode, setSubmittedMode] = useState<FeedbackMode | null>(null)
  const [isHistoryView, setIsHistoryView] = useState(false)
  const [historyItems, setHistoryItems] = useState<FeedbackResponse[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false)
  const [withdrawingFeedbackId, setWithdrawingFeedbackId] = useState<string | null>(null)
  const [confirmWithdrawFeedbackId, setConfirmWithdrawFeedbackId] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedType = getApiTypeFromMode(mode)
  const availableCategories = CATEGORY_OPTIONS_BY_MODE[mode] ?? []
  const adaptivePrompt = getAdaptivePrompt(rating)

  const resetForm = () => {
    setMode('quick_rating')
    setContent('')
    setRating(null)
    setCategory(null)
    setAdaptiveAnswer('')
    setSubmittedFeedback(null)
    setSubmittedMode(null)
    setIsHistoryView(false)
    setHistoryError(null)
  }

  const loadMyFeedbacks = async (showInitialLoader = false) => {
    if (showInitialLoader) {
      setIsHistoryLoading(true)
    } else {
      setIsRefreshingHistory(true)
    }

    setHistoryError(null)

    try {
      const response = await feedbackService.getMine(20, 0, 'desc')
      setHistoryItems(response.items)
      setHistoryTotal(response.total)
    } catch {
      setHistoryError('Nao foi possivel carregar seus envios agora.')
    } finally {
      if (showInitialLoader) {
        setIsHistoryLoading(false)
      }
      setIsRefreshingHistory(false)
    }
  }

  const openHistoryView = () => {
    setIsHistoryView(true)
    void loadMyFeedbacks(true)
  }

  const handleWithdrawFeedback = async (id: string) => {
    setWithdrawingFeedbackId(id)

    try {
      await feedbackService.withdrawMine(id)
      toast.success('Envio retirado com sucesso.')
      setConfirmWithdrawFeedbackId(null)
      await loadMyFeedbacks(false)
    } catch {
      toast.error('Nao foi possivel retirar este envio agora.')
    } finally {
      setWithdrawingFeedbackId(null)
    }
  }

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleDateString('pt-BR')
    } catch {
      return '-'
    }
  }

  const handleDialogOpenChange = (open: boolean) => {
    if (open) return
    if (!isSubmitting) {
      resetForm()
      setConfirmWithdrawFeedbackId(null)
    }
    onClose()
  }

  const handleModeChange = (nextMode: FeedbackMode) => {
    setMode(nextMode)

    const fixedCategory = getDefaultCategoryFromMode(nextMode)
    if (fixedCategory) {
      setCategory(fixedCategory)
    } else if (modeNeedsCategorySelection(nextMode)) {
      const options = CATEGORY_OPTIONS_BY_MODE[nextMode] ?? []
      const stillValid = category && options.some((item) => item.value === category)
      setCategory(stillValid ? category : options[0]?.value ?? null)
    } else {
      setCategory(null)
    }

    if (nextMode !== 'quick_rating') {
      setRating(null)
      setAdaptiveAnswer('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (modeNeedsRating(mode) && !rating) {
      toast.error('Escolha uma nota de 1 a 5 estrelas.')
      return
    }

    if (modeNeedsCategorySelection(mode) && !category) {
      toast.error('Escolha uma categoria para seu feedback.')
      return
    }

    if (modeNeedsContent(mode) && !content.trim()) {
      toast.error('Descreva seu feedback para continuarmos.')
      return
    }

    setIsSubmitting(true)

    try {
      const quickRatingContent =
        content.trim() ||
        (rating ? `Avaliação relâmpago: ${rating}/5` : '') ||
        'Avaliação relâmpago enviada sem contexto adicional.'

      const fixedCategory = getDefaultCategoryFromMode(mode)

      const response = await feedbackService.create({
        type: selectedType,
        content: mode === 'quick_rating' ? quickRatingContent : content.trim(),
        rating: modeNeedsRating(mode) ? rating ?? undefined : undefined,
        category: fixedCategory ?? category ?? undefined,
        adaptive_answer: mode === 'quick_rating' ? adaptiveAnswer.trim() || undefined : undefined,
        path: window.location.pathname,
        user_agent: navigator.userAgent,
      })

      toast.success('Feedback enviado com sucesso!')
      setSubmittedFeedback(response)
      setSubmittedMode(mode)
    } catch {
      toast.error('Erro ao enviar feedback. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-lg border-border/70 shadow-xl">
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="text-lg tracking-tight">
            {submittedFeedback ? 'Feedback recebido' : 'Feedback'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {submittedFeedback
              ? 'Obrigado por compartilhar. Sua mensagem já foi registrada.'
              : 'Escolha um canal e envie sua percepção em poucos segundos.'}
          </p>
        </DialogHeader>

        {isHistoryView ? (
          <div className="space-y-4">
            {/** Keep this view height stable while refreshing list data */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Meus envios</h3>
                <p className="text-xs text-muted-foreground">Acompanhe protocolo e status dos feedbacks enviados.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsHistoryView(false)
                  setHistoryError(null)
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </button>
            </div>

            {isHistoryLoading ? (
              <div className="rounded-lg border border-border p-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando envios...
              </div>
            ) : historyError && historyItems.length === 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                <p className="text-sm text-destructive">{historyError}</p>
                <button
                  type="button"
                  onClick={() => void loadMyFeedbacks(true)}
                  className="text-xs font-medium text-foreground hover:text-primary transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
            ) : historyItems.length === 0 ? (
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                Voce ainda nao enviou feedback.
              </div>
            ) : (
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {historyItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/80 bg-background p-3.5 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Protocolo</p>
                        <p className="text-xs font-mono font-medium text-foreground">{item.reference_code}</p>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
                          getStatusBadgeClass(item.status)
                        )}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </div>

                    <p className="text-sm leading-relaxed text-foreground line-clamp-3">{item.content}</p>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center rounded-full border border-border bg-muted/30 px-2 py-0.5 text-muted-foreground">
                        {getModeLabel(null, item.type)}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-muted-foreground">
                        {formatDate(item.created_at)}
                      </span>
                    </div>

                    {item.status === 'new' && (
                      <div className="pt-1 border-t border-border/60">
                        {confirmWithdrawFeedbackId === item.id ? (
                          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 space-y-2">
                            <div className="flex items-start gap-2 text-xs text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <p>
                                Confirmar retirada deste envio? Essa ação remove o item da sua lista.
                              </p>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmWithdrawFeedbackId(null)}
                                disabled={withdrawingFeedbackId === item.id}
                                className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleWithdrawFeedback(item.id)}
                                disabled={withdrawingFeedbackId === item.id || isHistoryLoading || isRefreshingHistory}
                                className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/15 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {withdrawingFeedbackId === item.id ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Retirando...
                                  </span>
                                ) : (
                                  'Retirar'
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => setConfirmWithdrawFeedbackId(item.id)}
                              disabled={Boolean(withdrawingFeedbackId) || isHistoryLoading || isRefreshingHistory}
                              className="px-0.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:underline underline-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Retirar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {historyError && historyItems.length > 0 && (
              <p className="text-xs text-destructive">{historyError}</p>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Total de envios: {historyTotal}</span>
              <button
                type="button"
                onClick={() => void loadMyFeedbacks(false)}
                disabled={isRefreshingHistory || isHistoryLoading}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 font-medium hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isRefreshingHistory ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Atualizar
                  </>
                )}
              </button>
            </div>
          </div>
        ) : submittedFeedback ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-green-200 bg-green-50/60 dark:bg-green-950/20 dark:border-green-900/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-semibold">Sua mensagem entrou para análise</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Protocolo</p>
                  <p className="font-semibold text-foreground">{submittedFeedback.reference_code}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status inicial</p>
                  <p className="font-semibold text-foreground">{getStatusLabel(submittedFeedback.status)}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Primeira análise prevista em até 3 dias úteis.</p>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Resumo enviado</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Nota</p>
                  <p className="font-medium text-foreground">{submittedFeedback.rating ?? '-'} / 5</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Categoria</p>
                  <p className="font-medium text-foreground">{getCategoryLabel(submittedFeedback.category)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Canal</p>
                  <p className="font-medium text-foreground">{getModeLabel(submittedMode, submittedFeedback.type)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={openHistoryView}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted/60 transition-colors"
              >
                <History className="h-4 w-4" />
                Meus envios
              </button>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedFeedback(null)
                    setSubmittedMode(null)
                    setContent('')
                    setAdaptiveAnswer('')
                    if (mode === 'quick_rating') {
                      setRating(null)
                    }
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Enviar outro
                </button>
                <button
                  type="button"
                  onClick={() => handleDialogOpenChange(false)}
                  className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Escolha o canal</label>
              <Select value={mode} onValueChange={(value) => handleModeChange(value as FeedbackMode)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione o tipo de feedback" />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{getModeDescription(mode)}</p>
            </div>

            {mode === 'quick_rating' ? (
              <>
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-5 space-y-4 text-center">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-foreground">Avaliação relâmpago</label>
                    <p className="text-xs text-muted-foreground">Como foi sua experiência agora?</p>
                  </div>
                  <div className="flex items-center justify-center gap-2" role="radiogroup" aria-label="Avaliação de 1 a 5 estrelas">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={rating === star}
                        aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
                        onClick={() => setRating(star)}
                        className={cn(
                          'rounded-full p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
                          rating === star ? 'bg-primary/10' : 'hover:bg-muted'
                        )}
                      >
                        <Star
                          className={cn(
                            'h-6 w-6 transition-colors',
                            rating && star <= rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-muted-foreground'
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {adaptivePrompt && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{adaptivePrompt}</label>
                    <textarea
                      value={adaptiveAnswer}
                      onChange={(e) => setAdaptiveAnswer(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                      placeholder="Opcional, mas ajuda muito nossa equipe a agir com mais rapidez."
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {modeNeedsCategorySelection(mode) && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">Categoria</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {availableCategories.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setCategory(item.value)}
                          aria-pressed={category === item.value}
                          className={cn(
                            'px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors',
                            category === item.value
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border hover:bg-muted/50 text-muted-foreground'
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      As categorias foram filtradas para combinar com o tipo selecionado.
                    </p>
                  </div>
                )}

                {mode === 'feature_request' && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                    Classificação automática: Nova funcionalidade.
                  </div>
                )}

                {mode === 'share_experience' && (
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Esse canal prioriza seu relato sobre a experiência geral de uso.
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Descrição</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={getModePlaceholder(mode)}
                    rows={5}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={openHistoryView}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
              >
                <History className="h-4 w-4" />
                Meus envios
              </button>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleDialogOpenChange(false)}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (modeNeedsRating(mode) && !rating) ||
                    (modeNeedsCategorySelection(mode) && !category) ||
                    (modeNeedsContent(mode) && !content.trim())
                  }
                  className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar
                </button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
