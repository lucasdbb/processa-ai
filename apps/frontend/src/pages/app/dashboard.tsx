import { Link } from 'react-router-dom'
import {
  Users,
  FolderKanban,
  CalendarClock,
  Calculator,
  AlertTriangle,
  FileText,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { useUser } from '@/features/auth/hooks/use-user'

interface StatCard {
  name: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: typeof Users
  href: string
}

const stats: StatCard[] = [
  {
    name: 'Clientes',
    value: '47',
    change: '+3 este mes',
    changeType: 'positive',
    icon: Users,
    href: '/app/clientes',
  },
  {
    name: 'Processos Ativos',
    value: '23',
    change: '5 novos',
    changeType: 'neutral',
    icon: FolderKanban,
    href: '/app/processos',
  },
  {
    name: 'Prazos Hoje',
    value: '5',
    change: '2 urgentes',
    changeType: 'negative',
    icon: CalendarClock,
    href: '/app/prazos',
  },
  {
    name: 'Calculos Este Mes',
    value: '128',
    change: '+12% vs anterior',
    changeType: 'positive',
    icon: Calculator,
    href: '/app/calculadoras',
  },
]

const upcomingDeadlines = [
  {
    id: '1',
    type: 'Contestacao',
    process: '0001234-12.2025.5.02.0001',
    client: 'Joao Silva',
    daysLeft: 0,
    urgent: true,
  },
  {
    id: '2',
    type: 'Recurso Ordinario',
    process: '0005678-34.2025.5.02.0002',
    client: 'Maria Oliveira',
    daysLeft: 2,
    urgent: false,
  },
  {
    id: '3',
    type: 'Manifestacao',
    process: '0009012-56.2025.8.26.0100',
    client: 'Pedro Santos',
    daysLeft: 5,
    urgent: false,
  },
]

const recentActivity = [
  {
    id: '1',
    type: 'calculation',
    description: 'Calculo de rescisao',
    client: 'Joao Silva',
    time: 'ha 2 horas',
  },
  {
    id: '2',
    type: 'document',
    description: 'Peticao inicial gerada',
    client: 'Maria Oliveira',
    time: 'ha 5 horas',
  },
  {
    id: '3',
    type: 'client',
    description: 'Novo cliente cadastrado',
    client: 'Pedro Santos',
    time: 'ontem',
  },
]

export default function DashboardPage() {
  const { user } = useUser()
  const firstName = user?.name?.split(' ')[0] || 'Usuario'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ola, {firstName}!</h1>
        <p className="text-muted-foreground mt-1">
          Aqui esta um resumo da sua atividade.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
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
                      className={`text-xs mt-2 flex items-center gap-1 ${
                        stat.changeType === 'positive'
                          ? 'text-green-600'
                          : stat.changeType === 'negative'
                            ? 'text-red-600'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {stat.changeType === 'positive' && <TrendingUp className="h-3 w-3" />}
                      {stat.change}
                    </p>
                  )}
                </div>
                <div className="p-2.5 bg-muted rounded-lg group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prazos Proximos */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Prazos Proximos</h2>
            <Link
              to="/app/prazos"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {upcomingDeadlines.map((deadline) => (
              <div key={deadline.id} className="px-5 py-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      deadline.urgent
                        ? 'bg-red-500/10 text-red-600'
                        : deadline.daysLeft <= 2
                          ? 'bg-yellow-500/10 text-yellow-600'
                          : 'bg-green-500/10 text-green-600'
                    }`}
                  >
                    {deadline.urgent ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <CalendarClock className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{deadline.type}</span>
                      {deadline.urgent && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-red-500/10 text-red-600 rounded">
                          HOJE
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {deadline.process} - {deadline.client}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {deadline.daysLeft === 0
                      ? 'Hoje'
                      : deadline.daysLeft === 1
                        ? 'Amanha'
                        : `${deadline.daysLeft} dias`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Atividade Recente */}
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Atividade Recente</h2>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="px-5 py-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    {activity.type === 'calculation' ? (
                      <Calculator className="h-4 w-4 text-muted-foreground" />
                    ) : activity.type === 'document' ? (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{activity.description}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{activity.client}</p>
                  </div>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {activity.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-4">Acoes Rapidas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/app/clientes?new=true"
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-muted-foreground/50 hover:bg-muted/50 transition-all text-center"
          >
            <div className="p-3 bg-muted rounded-xl">
              <Users className="h-5 w-5 text-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">Novo Cliente</span>
          </Link>
          <Link
            to="/app/processos?new=true"
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-muted-foreground/50 hover:bg-muted/50 transition-all text-center"
          >
            <div className="p-3 bg-muted rounded-xl">
              <FolderKanban className="h-5 w-5 text-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">Novo Processo</span>
          </Link>
          <Link
            to="/app/calculadoras/rescisao"
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-muted-foreground/50 hover:bg-muted/50 transition-all text-center"
          >
            <div className="p-3 bg-muted rounded-xl">
              <Calculator className="h-5 w-5 text-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">Calcular Rescisao</span>
          </Link>
          <Link
            to="/app/ia/chat"
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-muted-foreground/50 hover:bg-muted/50 transition-all text-center"
          >
            <div className="p-3 bg-muted rounded-xl">
              <FileText className="h-5 w-5 text-foreground" />
            </div>
            <span className="text-sm font-medium text-foreground">Chat IA</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
