import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  AlertTriangle,
  DollarSign,
  Gavel,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DailyBriefing } from '@/services/dashboard-service'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)

const formatTime = (isoString: string | null) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

interface DailyBriefingCardProps {
  briefing: DailyBriefing
}

export function DailyBriefingCard({ briefing }: DailyBriefingCardProps) {
  const { summary } = briefing
  const firstName = briefing.user_name?.split(' ')[0] || 'Doutor(a)'
  const greeting = getGreeting()

  const [isExpanded, setIsExpanded] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined)

  const hasAnything =
    summary.deadlines_count > 0 ||
    summary.events_count > 0 ||
    summary.overdue_fees_count > 0

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [briefing])

  if (!hasAnything) return null

  // Build summary chips
  const chips: { label: string; color: string; icon: typeof Clock }[] = []
  if (summary.deadlines_count > 0) {
    chips.push({
      label: `${summary.deadlines_count} prazo${summary.deadlines_count > 1 ? 's' : ''}`,
      color: summary.urgent_deadlines_count > 0
        ? 'text-red-600 dark:text-red-400 bg-red-500/10'
        : 'text-orange-600 dark:text-orange-400 bg-orange-500/10',
      icon: CalendarClock,
    })
  }
  if (summary.events_count > 0) {
    chips.push({
      label: `${summary.events_count} compromisso${summary.events_count > 1 ? 's' : ''}`,
      color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
      icon: Gavel,
    })
  }
  if (summary.overdue_fees_count > 0) {
    chips.push({
      label: `${summary.overdue_fees_count} em atraso`,
      color: 'text-red-600 dark:text-red-400 bg-red-500/10',
      icon: DollarSign,
    })
  }

  // Build full greeting parts
  const parts: string[] = []
  if (summary.deadlines_count > 0) {
    parts.push(
      `${summary.deadlines_count} prazo${summary.deadlines_count > 1 ? 's' : ''} vence${summary.deadlines_count > 1 ? 'm' : ''} hoje`
    )
  }
  if (summary.events_count > 0) {
    const audiencias = briefing.events_today.filter(e => e.event_type === 'audiencia').length
    const reunioes = briefing.events_today.filter(e => e.event_type === 'reuniao').length
    const eventParts: string[] = []
    if (audiencias > 0)
      eventParts.push(`${audiencias} audiência${audiencias > 1 ? 's' : ''}`)
    if (reunioes > 0)
      eventParts.push(`${reunioes} ${reunioes > 1 ? 'reuniões' : 'reunião'}`)
    if (eventParts.length === 0)
      eventParts.push(`${summary.events_count} evento${summary.events_count > 1 ? 's' : ''}`)
    parts.push(eventParts.join(', '))
  }
  if (summary.overdue_fees_count > 0) {
    parts.push(
      `${summary.overdue_fees_count} pagamento${summary.overdue_fees_count > 1 ? 's' : ''} em atraso`
    )
  }

  return (
    <div
      className={cn(
        'border rounded-xl transition-all duration-300 ease-in-out overflow-hidden',
        isExpanded
          ? 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border-blue-500/20'
          : 'bg-card border-border hover:border-muted-foreground/30'
      )}
    >
      {/* Collapsed bar — always visible, acts as header when expanded */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className={cn(
          'w-full flex items-center gap-3 transition-all duration-200',
          isExpanded ? 'px-5 pt-5 pb-0' : 'px-4 py-3'
        )}
      >
        <div
          className={cn(
            'rounded-lg shrink-0 transition-all duration-200',
            isExpanded ? 'p-2 bg-blue-500/20' : 'p-1.5 bg-blue-500/10'
          )}
        >
          <Sparkles
            className={cn(
              'text-blue-600 dark:text-blue-400 transition-all duration-200',
              isExpanded ? 'h-5 w-5' : 'h-4 w-4'
            )}
          />
        </div>

        {isExpanded ? (
          /* Expanded header */
          <div className="flex-1 text-left">
            <h2 className="font-semibold text-foreground">
              {greeting}, Dr(a). {firstName}!
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Hoje: {parts.join(' · ')}
            </p>
          </div>
        ) : (
          /* Collapsed: chips summary */
          <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-sm font-medium text-foreground whitespace-nowrap">
              {greeting}, Dr(a). {firstName}!
            </span>
            <span className="text-muted-foreground/40">|</span>
            {chips.map((chip) => {
              const Icon = chip.icon
              return (
                <span
                  key={chip.label}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
                    chip.color
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {chip.label}
                </span>
              )
            })}
          </div>
        )}

        {/* Toggle action */}
        <div
          className={cn(
            'shrink-0 flex items-center gap-1.5 rounded-lg transition-all duration-200',
            isExpanded
              ? 'px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card/60'
              : 'p-1.5 text-muted-foreground hover:text-foreground'
          )}
        >
          {isExpanded ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Entendido</span>
              <ChevronUp className="h-3.5 w-3.5 sm:hidden" />
            </>
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Expandable content */}
      <div
        ref={contentRef}
        style={{
          maxHeight: isExpanded ? contentHeight ?? 500 : 0,
          opacity: isExpanded ? 1 : 0,
        }}
        className="transition-all duration-300 ease-in-out overflow-hidden"
      >
        <div className="px-5 pt-4 pb-5">
          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Deadlines */}
            {summary.deadlines_count > 0 && (
              <Link
                to="/app/calendario"
                className="bg-card/80 backdrop-blur-sm border border-border rounded-lg p-3 hover:border-muted-foreground/50 transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <CalendarClock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Prazos Hoje
                  </span>
                </div>
                <div className="space-y-1.5">
                  {briefing.deadlines_today.slice(0, 3).map((d) => (
                    <div key={d.id} className="flex items-center gap-1.5">
                      {d.urgent && (
                        <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                      )}
                      <span
                        className={cn(
                          'text-sm truncate',
                          d.urgent
                            ? 'text-red-600 dark:text-red-400 font-medium'
                            : 'text-foreground'
                        )}
                      >
                        {d.title}
                      </span>
                    </div>
                  ))}
                  {summary.deadlines_count > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{summary.deadlines_count - 3} mais
                    </p>
                  )}
                </div>
              </Link>
            )}

            {/* Events */}
            {summary.events_count > 0 && (
              <Link
                to="/app/calendario"
                className="bg-card/80 backdrop-blur-sm border border-border rounded-lg p-3 hover:border-muted-foreground/50 transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Gavel className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Compromissos
                  </span>
                </div>
                <div className="space-y-1.5">
                  {briefing.events_today.slice(0, 3).map((e) => (
                    <div key={e.id} className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground truncate">
                        {e.start_at ? `${formatTime(e.start_at)} — ` : ''}
                        {e.title}
                      </span>
                    </div>
                  ))}
                  {summary.events_count > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{summary.events_count - 3} mais
                    </p>
                  )}
                </div>
              </Link>
            )}

            {/* Overdue fees */}
            {summary.overdue_fees_count > 0 && (
              <div className="bg-card/80 backdrop-blur-sm border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Pagamentos em Atraso
                  </span>
                </div>
                <div className="space-y-1.5">
                  {briefing.overdue_fees.slice(0, 3).map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground truncate">
                        {f.client_name}
                      </span>
                      <span className="text-sm font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
                        {formatCurrency(f.amount)}
                      </span>
                    </div>
                  ))}
                  {summary.overdue_fees_count > 3 && (
                    <p className="text-xs text-muted-foreground">
                      Total: {formatCurrency(summary.overdue_fees_total)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
