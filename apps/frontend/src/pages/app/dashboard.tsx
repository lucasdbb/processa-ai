import { Link } from 'react-router-dom'
import {
  Users,
  FolderKanban,
  CalendarClock,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  DollarSign,
  FileText,
  Clock,
  Banknote,
  Briefcase,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUser } from '@/features/auth/hooks/use-user'
import { WelcomeCard } from '@/components/onboarding/WelcomeCard'
import { RevenueChart } from '@/components/charts/revenue-chart'
import { ProcessesChart } from '@/components/charts/processes-chart'
import { AgingChart } from '@/components/charts/aging-chart'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { DailyBriefingCard } from '@/components/dashboard/daily-briefing-card'

interface StatCard {
  name: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: typeof Users
  href: string
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

const ACTIVITY_ICONS: Record<string, typeof Clock> = {
  timeline: Clock,
  note: FileText,
  payment: Banknote,
}

function WidgetLoadingCard({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="space-y-3 mt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  )
}

function WidgetErrorCard({
  title,
  onRetry,
}: {
  title: string
  onRetry: () => void
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-2">
        Nao foi possivel carregar este bloco.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Tentar novamente
      </Button>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useUser()
  const firstName = user?.name?.split(' ')[0] || 'Usuario'

  const {
    stats,
    deadlines,
    financial,
    processesSummary,
    activity,
    briefing,
    loading,
    errors,
    refetch,
  } = useDashboardData()

  const statCards: StatCard[] = stats
    ? [
        {
          name: 'Clientes',
          value: stats.total_clients.toString(),
          change:
            stats.new_clients_this_month > 0
              ? `+${stats.new_clients_this_month} este mes`
              : undefined,
          changeType: stats.new_clients_this_month > 0 ? 'positive' : 'neutral',
          icon: Users,
          href: '/app/clientes',
        },
        {
          name: 'Processos Ativos',
          value: stats.active_processes.toString(),
          change:
            stats.new_processes_this_month > 0
              ? `${stats.new_processes_this_month} novos`
              : undefined,
          changeType: 'neutral',
          icon: FolderKanban,
          href: '/app/processos',
        },
        {
          name: 'Serviços Ativos',
          value: (stats.active_services ?? 0).toString(),
          change: undefined,
          changeType: 'neutral',
          icon: Briefcase,
          href: '/app/servicos',
        },
        {
          name: 'Prazos Hoje',
          value: stats.deadlines_today.toString(),
          change:
            stats.urgent_deadlines_today > 0
              ? `${stats.urgent_deadlines_today} urgentes`
              : undefined,
          changeType: stats.urgent_deadlines_today > 0 ? 'negative' : 'neutral',
          icon: CalendarClock,
          href: '/app/calendario',
        },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <WelcomeCard />

      {/* Daily Briefing */}
      {loading.briefing ? (
        <WidgetLoadingCard title="Resumo do Dia" subtitle="Carregando briefing..." />
      ) : errors.briefing ? (
        <WidgetErrorCard title="Resumo do Dia" onRetry={() => void refetch.briefing()} />
      ) : (
        briefing && <DailyBriefingCard briefing={briefing} />
      )}

      {/* Header */}
      <div data-tour="welcome">
        <h1 className="text-2xl font-bold text-foreground">Olá, {firstName}!</h1>
        <p className="text-muted-foreground mt-1">
          Aqui está um resumo da sua atividade.
        </p>
      </div>

      {/* Stats Grid */}
      <div
        data-tour="stats"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {loading.stats ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="bg-card border border-border rounded-xl p-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))
        ) : errors.stats ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <WidgetErrorCard
              title="Indicadores"
              onRetry={() => {
                void refetch.stats()
              }}
            />
          </div>
        ) : (
          statCards.map((stat) => {
            const Icon = stat.icon
            return (
              <Link
                key={stat.name}
                to={stat.href}
                className="group bg-card border border-border rounded-xl p-5 hover:border-muted-foreground/50 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.name}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                    {stat.change && (
                      <p
                        className={cn(
                          'text-xs mt-2 flex items-center gap-1',
                          stat.changeType === 'positive' && 'text-green-600',
                          stat.changeType === 'negative' && 'text-red-600',
                          stat.changeType === 'neutral' && 'text-muted-foreground'
                        )}
                      >
                        {stat.changeType === 'positive' && (
                          <TrendingUp className="h-3 w-3" />
                        )}
                        {stat.change}
                      </p>
                    )}
                  </div>
                  <div className="p-2.5 bg-muted rounded-lg group-hover:bg-slate-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-slate-900 transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* Financial Summary Bar */}
      {loading.financial ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="bg-card border border-border rounded-lg p-3 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
      ) : errors.financial ? (
        <WidgetErrorCard title="Resumo Financeiro" onRetry={() => void refetch.financial()} />
      ) : financial ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-semibold">Recebido</span>
            </div>
            <p className="text-lg font-bold text-green-600 dark:text-green-500 mt-1">
              {formatCurrency(financial.total_received)}
            </p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-semibold">Pendente</span>
            </div>
            <p className="text-lg font-bold text-yellow-600 dark:text-yellow-500 mt-1">
              {formatCurrency(financial.total_pending)}
            </p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-500">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-semibold">Em atraso</span>
            </div>
            <p className="text-lg font-bold text-red-600 dark:text-red-500 mt-1">
              {formatCurrency(financial.total_overdue)}
            </p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500">
              <Banknote className="h-4 w-4" />
              <span className="text-xs font-semibold">Total Honorários</span>
            </div>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-500 mt-1">
              {formatCurrency(financial.total_fees)}
            </p>
          </div>
        </div>
      ) : null}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        {loading.financial ? (
          <WidgetLoadingCard title="Receita Mensal" subtitle="Carregando serie historica..." />
        ) : errors.financial ? (
          <WidgetErrorCard title="Receita Mensal" onRetry={() => void refetch.financial()} />
        ) : financial && financial.monthly_revenue.length > 0 ? (
          <div className="bg-card border border-border rounded-xl">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Receita Mensal</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Últimos 6 meses - Recebido vs Pendente
              </p>
            </div>
            <div className="p-4">
              <RevenueChart data={financial.monthly_revenue} />
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground">Receita Mensal</h2>
            <p className="text-sm text-muted-foreground mt-2">Sem dados suficientes ainda.</p>
          </div>
        )}

        {/* Processes Chart */}
        {loading.processesSummary ? (
          <WidgetLoadingCard title="Processos por Status" subtitle="Carregando distribuicao..." />
        ) : errors.processesSummary ? (
          <WidgetErrorCard
            title="Processos por Status"
            onRetry={() => void refetch.processesSummary()}
          />
        ) : (
          <div className="bg-card border border-border rounded-xl">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Processos por Status</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Distribuição dos seus processos
              </p>
            </div>
            <div className="p-4">
              <ProcessesChart
                data={processesSummary?.by_status ?? []}
                total={processesSummary?.total ?? 0}
              />
            </div>
          </div>
        )}
      </div>

      {/* Deadlines + Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prazos Próximos */}
        {loading.deadlines ? (
          <WidgetLoadingCard title="Prazos Próximos" subtitle="Carregando prazos..." />
        ) : errors.deadlines ? (
          <WidgetErrorCard title="Prazos Próximos" onRetry={() => void refetch.deadlines()} />
        ) : (
        <div data-tour="deadlines" className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Prazos Próximos</h2>
            <Link
              to="/app/calendario"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {deadlines.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CalendarClock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhum prazo próximo</p>
              </div>
            ) : (
              deadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className="px-5 py-3.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        deadline.urgent
                          ? 'bg-red-500/10 text-red-600'
                          : deadline.days_left <= 2
                            ? 'bg-yellow-500/10 text-yellow-600'
                            : 'bg-green-500/10 text-green-600'
                      )}
                    >
                      {deadline.urgent ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <CalendarClock className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm truncate">
                          {deadline.title || deadline.type}
                        </span>
                        {deadline.urgent && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-red-500/10 text-red-600 rounded shrink-0">
                            HOJE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {deadline.process} - {deadline.client}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {deadline.days_left === 0
                        ? 'Hoje'
                        : deadline.days_left === 1
                          ? 'Amanha'
                          : `${deadline.days_left} dias`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}

        {/* Atividade Recente */}
        {loading.activity ? (
          <WidgetLoadingCard title="Atividade Recente" subtitle="Carregando atualizacoes..." />
        ) : errors.activity ? (
          <WidgetErrorCard title="Atividade Recente" onRetry={() => void refetch.activity()} />
        ) : (
          <div className="bg-card border border-border rounded-xl">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Atividade Recente</h2>
            </div>
            <div className="divide-y divide-border">
              {activity.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
                </div>
              ) : (
                activity.map((item, idx) => {
                  const Icon = ACTIVITY_ICONS[item.type] || Clock
                  return (
                    <div
                      key={idx}
                      className="px-5 py-3.5 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'p-2 rounded-lg',
                            item.type === 'payment'
                              ? 'bg-green-500/10 text-green-600'
                              : item.type === 'timeline'
                                ? 'bg-blue-500/10 text-blue-600'
                                : 'bg-muted text-muted-foreground'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">
                            {item.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.detail}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {item.time_relative}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Aging Report */}
      {loading.financial ? (
        <WidgetLoadingCard title="Honorários em Atraso (Aging Report)" subtitle="Carregando aging..." />
      ) : errors.financial ? (
        <WidgetErrorCard
          title="Honorários em Atraso (Aging Report)"
          onRetry={() => void refetch.financial()}
        />
      ) : financial ? (
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">
              Honorários em Atraso (Aging Report)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Distribuição dos honorários vencidos por faixa de dias
            </p>
          </div>
          <div className="p-5">
            <AgingChart data={financial.aging} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
