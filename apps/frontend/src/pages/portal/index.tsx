import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  FolderKanban,
  CalendarDays,
  FileText,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Download,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Scale,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import {
  portalService,
  type PortalMe,
  type PortalProcess,
  type PortalEvent,
  type PortalDocument,
  type PortalFee,
  type PortalFinancesSummary,
  type PortalTimelineEvent,
  type PortalTimelineTranslation,
} from '@/services/portal-service'

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

type Tab = 'processos' | 'agenda' | 'documentos' | 'financeiro'

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

const EVENT_TYPE_LABEL: Record<string, string> = {
  audiencia: 'Audiência',
  prazo: 'Prazo',
  reuniao: 'Reunião',
  other: 'Evento',
}

const FEE_STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending:  { label: 'Pendente',  icon: <Clock className="h-3.5 w-3.5" />,        className: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  overdue:  { label: 'Vencido',   icon: <AlertCircle className="h-3.5 w-3.5" />,  className: 'text-red-600 bg-red-50 border-red-200' },
  paid:     { label: 'Pago',      icon: <CheckCircle2 className="h-3.5 w-3.5" />, className: 'text-green-600 bg-green-50 border-green-200' },
  cancelled:{ label: 'Cancelado', icon: <XCircle className="h-3.5 w-3.5" />,      className: 'text-gray-500 bg-gray-50 border-gray-200' },
}

const PROCESS_COLOR_MAP: Record<string, string> = {
  blue:   'bg-blue-100 text-blue-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  orange: 'bg-orange-100 text-orange-700',
  green:  'bg-green-100 text-green-700',
  red:    'bg-red-100 text-red-700',
  gray:   'bg-gray-100 text-gray-600',
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string | null | undefined, showTime = false): string {
  if (!dateStr) return '-'
  try {
    const d = parseISO(dateStr)
    return format(d, showTime ? "dd/MM/yyyy 'às' HH:mm" : 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return '-'
  }
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'border-green-200 bg-green-50/40',
  negative: 'border-red-200 bg-red-50/40',
  urgent:   'border-orange-300 bg-orange-50/50',
  neutral:  'border-border bg-muted/20',
}

function TranslatedEvent({ event }: { event: PortalTimelineEvent }) {
  const { translation } = event

  if (!translation) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground font-mono leading-relaxed">
          {event.title}{event.description ? ` — ${event.description}` : ''}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5">
          {formatDate(event.event_date, true)}
        </p>
      </div>
    )
  }

  const hasAction = translation.action_required
    && !translation.action_required.toLowerCase().includes('nenhuma ação')
    && !translation.action_required.toLowerCase().includes('nenhuma acao')

  return (
    <div className={cn('rounded-lg border p-3', SENTIMENT_STYLES[translation.sentiment] ?? SENTIMENT_STYLES.neutral)}>
      {/* Texto jurídico original + data */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground font-mono leading-relaxed">
          {event.title}{event.description ? ` — ${event.description}` : ''}
        </p>
        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {formatDate(event.event_date, true)}
        </span>
      </div>

      {/* Separador */}
      <div className="border-t border-border/40 mt-2.5 pt-2.5">
        <p className="text-sm font-medium leading-snug">{translation.summary}</p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{translation.explanation}</p>

        {hasAction && (
          <div className={cn(
            'mt-2 flex items-start gap-1.5 text-xs font-medium',
            translation.sentiment === 'urgent' ? 'text-orange-700' : 'text-foreground/80',
          )}>
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {translation.action_required}
          </div>
        )}

        {translation.next_step && (
          <p className="text-xs text-muted-foreground mt-1.5">
            Próximo passo: {translation.next_step}
          </p>
        )}

        <p className="text-xs text-muted-foreground/50 mt-2 text-right">
          Simplificado pelo Processa AI
        </p>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------

// --- PROCESSES TAB ---

function ProcessDocumentItem({ doc }: { doc: { id: string; name: string; file_size: number | null; created_at?: string } }) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const { url } = await portalService.getDocumentDownloadUrl(doc.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('Não foi possível baixar o documento.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{doc.name}</p>
        {(doc.created_at || doc.file_size) && (
          <p className="text-xs text-muted-foreground">
            {doc.created_at ? formatDate(doc.created_at) : ''}
            {doc.file_size ? `${doc.created_at ? ' · ' : ''}${formatFileSize(doc.file_size)}` : ''}
          </p>
        )}
      </div>
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
        title="Baixar documento"
      >
        {isDownloading
          ? <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          : <Download className="h-3.5 w-3.5 text-muted-foreground" />
        }
      </button>
    </li>
  )
}

function ProcessCard({ process }: { process: PortalProcess }) {
  const [expanded, setExpanded] = useState(false)
  const colorClass = PROCESS_COLOR_MAP[process.status.color] ?? PROCESS_COLOR_MAP.gray

  return (
    <div className="border rounded-xl overflow-hidden bg-card transition-shadow hover:shadow-sm">
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="mt-0.5 shrink-0 w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center">
          <Scale className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{process.process_number}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {process.type}
                {process.court ? ` · ${process.court}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', colorClass)}>
                {process.status.label}
              </span>
              {expanded
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
              }
            </div>
          </div>
          {process.next_deadline && (
            <p className="text-xs text-orange-600 mt-1.5 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Próximo prazo: {formatDate(process.next_deadline)}
            </p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-2.5">
          {process.value != null && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Valor da causa:</span>{' '}
              {formatCurrency(process.value)}
            </p>
          )}

          {process.recent_events.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Andamentos recentes
              </p>
              <div className="space-y-2">
                {process.recent_events.map((evt) => (
                  <div key={evt.id}>
                    <TranslatedEvent event={evt} />
                    {evt.documents.length > 0 && (
                      <ul className="mt-1.5 space-y-1 pl-1">
                        {evt.documents.map((doc) => (
                          <ProcessDocumentItem key={doc.id} doc={doc} />
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum andamento registrado ainda.</p>
          )}
        </div>
      )}
    </div>
  )
}

function ProcessesTab({ processes }: { processes: PortalProcess[] }) {
  if (processes.length === 0) {
    return (
      <EmptyState
        icon={<FolderKanban className="h-8 w-8 text-muted-foreground/50" />}
        title="Nenhum processo"
        description="Seus processos aparecerão aqui quando forem cadastrados."
      />
    )
  }

  return (
    <div className="space-y-3">
      {processes.map((p) => (
        <ProcessCard key={p.id} process={p} />
      ))}
    </div>
  )
}

// --- AGENDA TAB ---

function EventItem({ event }: { event: PortalEvent }) {
  const isPast = new Date(event.start_at) < new Date()
  const typeLabel = EVENT_TYPE_LABEL[event.event_type] ?? 'Evento'

  return (
    <div className={cn('flex gap-3 py-3', isPast && 'opacity-50')}>
      {/* Date column */}
      <div className="shrink-0 w-12 text-center">
        <p className="text-lg font-bold leading-none">
          {format(parseISO(event.start_at), 'dd')}
        </p>
        <p className="text-xs text-muted-foreground uppercase">
          {format(parseISO(event.start_at), 'MMM', { locale: ptBR })}
        </p>
      </div>

      {/* Divider */}
      <div className="shrink-0 w-px bg-border" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{event.title}</p>
          {event.is_urgent && !isPast && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
              Urgente
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <Badge variant="outline" className="text-xs py-0 h-5">
            {typeLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {format(parseISO(event.start_at), "HH:mm")}h
          </span>
          {event.process_number && (
            <span className="text-xs text-muted-foreground truncate">
              · {event.process_number}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function AgendaTab({
  upcoming,
  past,
}: {
  upcoming: PortalEvent[]
  past: PortalEvent[]
}) {
  const [showPast, setShowPast] = useState(false)

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-8 w-8 text-muted-foreground/50" />}
        title="Nenhum evento"
        description="Audiências, prazos e reuniões aparecerão aqui."
      />
    )
  }

  return (
    <div className="space-y-4">
      {upcoming.length > 0 ? (
        <div className="border rounded-xl divide-y overflow-hidden">
          {upcoming.map((evt) => (
            <div key={evt.id} className="px-4">
              <EventItem event={evt} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum evento próximo.
        </p>
      )}

      {past.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            {showPast
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />
            }
            {showPast ? 'Ocultar' : 'Ver'} eventos passados ({past.length})
          </button>
          {showPast && (
            <div className="border rounded-xl divide-y overflow-hidden opacity-60">
              {past.map((evt) => (
                <div key={evt.id} className="px-4">
                  <EventItem event={evt} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- DOCUMENTS TAB ---

function DocumentItem({
  doc,
  onDownload,
}: {
  doc: PortalDocument
  onDownload: (id: string) => Promise<void>
}) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      await onDownload(doc.id)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
        <FileText className="h-4.5 w-4.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(doc.created_at)}
          {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}
          {doc.process_number ? ` · ${doc.process_number}` : ''}
        </p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0 h-8 w-8"
        onClick={handleDownload}
        disabled={isDownloading}
        title="Baixar documento"
      >
        {isDownloading
          ? <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          : <Download className="h-4 w-4" />
        }
      </Button>
    </div>
  )
}

function DocumentsTab({ documents }: { documents: PortalDocument[] }) {
  const handleDownload = useCallback(async (id: string) => {
    try {
      const { url } = await portalService.getDocumentDownloadUrl(id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('Não foi possível baixar o documento. Tente novamente.')
    }
  }, [])

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-8 w-8 text-muted-foreground/50" />}
        title="Nenhum documento"
        description="Documentos compartilhados pelo seu advogado aparecerão aqui."
      />
    )
  }

  return (
    <div className="border rounded-xl divide-y overflow-hidden">
      {documents.map((doc) => (
        <div key={doc.id} className="px-4">
          <DocumentItem doc={doc} onDownload={handleDownload} />
        </div>
      ))}
    </div>
  )
}

// --- FINANCES TAB ---

function FinanceSummaryCard({ summary }: { summary: PortalFinancesSummary }) {
  const items = [
    { label: 'Total', value: summary.total_amount, className: 'text-foreground' },
    { label: 'Pago', value: summary.total_paid, className: 'text-green-600' },
    { label: 'Pendente', value: summary.total_pending, className: 'text-yellow-600' },
    { label: 'Vencido', value: summary.total_overdue, className: 'text-red-600' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {items.map((item) => (
        <div key={item.label} className="border rounded-xl p-3 bg-card">
          <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
          <p className={cn('text-base font-semibold', item.className)}>
            {formatCurrency(item.value)}
          </p>
        </div>
      ))}
    </div>
  )
}

function FeeItem({ fee }: { fee: PortalFee }) {
  const config = FEE_STATUS_CONFIG[fee.status] ?? FEE_STATUS_CONFIG.pending
  const progress = fee.amount > 0 ? Math.min((fee.paid_amount / fee.amount) * 100, 100) : 0

  return (
    <div className="py-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fee.description}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {fee.process_number && (
              <span className="text-xs text-muted-foreground">{fee.process_number}</span>
            )}
            {fee.due_date && (
              <span className="text-xs text-muted-foreground">
                · Vence em {formatDate(fee.due_date)}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold">{formatCurrency(fee.amount)}</p>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border font-medium',
              config.className,
            )}
          >
            {config.icon}
            {config.label}
          </span>
        </div>
      </div>

      {fee.status !== 'paid' && fee.paid_amount > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Pago: {formatCurrency(fee.paid_amount)}</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function FinancesTab({
  summary,
  fees,
}: {
  summary: PortalFinancesSummary
  fees: PortalFee[]
}) {
  if (fees.length === 0) {
    return (
      <EmptyState
        icon={<DollarSign className="h-8 w-8 text-muted-foreground/50" />}
        title="Nenhum honorário"
        description="Informações financeiras aparecerão aqui quando disponíveis."
      />
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Summary cards — always visible, never scroll away */}
      <div className="shrink-0">
        <FinanceSummaryCard summary={summary} />
      </div>

      {/* Fee list — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border divide-y">
        {fees.map((fee) => (
          <div key={fee.id} className="px-4">
            <FeeItem fee={fee} />
          </div>
        ))}
      </div>
    </div>
  )
}

// --- EMPTY STATE ---

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {icon}
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------
// Main page
// -----------------------------------------------------------------------

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'processos',   label: 'Processos',  icon: <FolderKanban className="h-4 w-4" /> },
  { id: 'agenda',      label: 'Agenda',     icon: <CalendarDays className="h-4 w-4" /> },
  { id: 'documentos',  label: 'Documentos', icon: <FileText className="h-4 w-4" /> },
  { id: 'financeiro',  label: 'Financeiro', icon: <DollarSign className="h-4 w-4" /> },
]

export default function PortalPage() {
  const [activeTab, setActiveTab] = useState<Tab>('processos')
  const [me, setMe] = useState<PortalMe | null>(null)

  const [processes, setProcesses] = useState<PortalProcess[]>([])
  const [upcoming, setUpcoming] = useState<PortalEvent[]>([])
  const [past, setPast] = useState<PortalEvent[]>([])
  const [documents, setDocuments] = useState<PortalDocument[]>([])
  const [fees, setFees] = useState<PortalFee[]>([])
  const [summary, setSummary] = useState<PortalFinancesSummary>({
    total_amount: 0, total_paid: 0, total_pending: 0, total_overdue: 0,
  })

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAll() {
      setIsLoading(true)
      setError(null)
      try {
        const [meData, processesData, eventsData, docsData, financesData] = await Promise.all([
          portalService.getMe(),
          portalService.getProcesses(),
          portalService.getEvents(),
          portalService.getDocuments(),
          portalService.getFinances(),
        ])
        setMe(meData)
        setProcesses(processesData.processes)
        setUpcoming(eventsData.upcoming)
        setPast(eventsData.past)
        setDocuments(docsData.documents)
        setFees(financesData.fees)
        setSummary(financesData.summary)
      } catch {
        setError('Não foi possível carregar os dados. Tente novamente.')
      } finally {
        setIsLoading(false)
      }
    }
    loadAll()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-5">
      {/* Greeting — static, never scrolls */}
      <div className="shrink-0">
        <h1 className="text-xl font-semibold">
          Olá, {me?.client_name?.split(' ')[0] ?? 'bem-vindo'} 👋
        </h1>
        <br></br>
        <p className="text-lg text-muted-foreground mt-0.5">
          Aqui você acompanha tudo sobre o seu caso.<br></br>
          {me?.lawyer_name && (
            <> Seu advogado: <span className="font-medium text-foreground">{me.lawyer_name}</span>.</>
          )}
        </p>
      </div>

      {/* Tabs — static, never scrolls */}
      <div className="shrink-0 border-b">
        <nav className="-mb-px flex gap-0" aria-label="Abas do portal">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
              aria-selected={activeTab === tab.id}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content — each tab manages its own scroll */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'processos' && (
          <div className="flex-1 min-h-0 overflow-y-auto pb-4">
            <ProcessesTab processes={processes} />
          </div>
        )}
        {activeTab === 'agenda' && (
          <div className="flex-1 min-h-0 overflow-y-auto pb-4">
            <AgendaTab upcoming={upcoming} past={past} />
          </div>
        )}
        {activeTab === 'documentos' && (
          <div className="flex-1 min-h-0 overflow-y-auto pb-4">
            <DocumentsTab documents={documents} />
          </div>
        )}
        {activeTab === 'financeiro' && (
          <FinancesTab summary={summary} fees={fees} />
        )}
      </div>
    </div>
  )
}
