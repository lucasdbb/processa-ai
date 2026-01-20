import { useState } from 'react'
import { CalendarClock, AlertTriangle, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Dados mockados
const mockDeadlines = [
  {
    id: '1',
    type: 'Contestacao',
    process: '0001234-12.2025.5.02.0001',
    client: 'Joao Silva',
    date: new Date(2026, 0, 20),
    status: 'pending',
  },
  {
    id: '2',
    type: 'Recurso Ordinario',
    process: '0005678-34.2025.5.02.0002',
    client: 'Maria Oliveira',
    date: new Date(2026, 0, 22),
    status: 'pending',
  },
  {
    id: '3',
    type: 'Manifestacao',
    process: '0009012-56.2025.8.26.0100',
    client: 'Pedro Santos',
    date: new Date(2026, 0, 25),
    status: 'pending',
  },
  {
    id: '4',
    type: 'Audiencia',
    process: '0003456-78.2025.5.02.0003',
    client: 'Ana Costa',
    date: new Date(2026, 0, 28),
    status: 'pending',
  },
]

export default function PrazosPage() {
  const [currentDate] = useState(new Date(2026, 0, 20))

  const getDaysUntil = (date: Date) => {
    const diff = date.getTime() - currentDate.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const getUrgencyLevel = (daysUntil: number) => {
    if (daysUntil <= 0) return 'critical'
    if (daysUntil <= 2) return 'urgent'
    if (daysUntil <= 5) return 'warning'
    return 'normal'
  }

  const sortedDeadlines = [...mockDeadlines].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prazos</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe seus prazos processuais e audiencias.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors">
          <Plus className="h-4 w-4" />
          Novo Prazo
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">Hoje</span>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {sortedDeadlines.filter((d) => getDaysUntil(d.date) === 0).length}
          </p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-600">
            <CalendarClock className="h-5 w-5" />
            <span className="font-semibold">Proximos 3 dias</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600 mt-2">
            {sortedDeadlines.filter((d) => getDaysUntil(d.date) > 0 && getDaysUntil(d.date) <= 3).length}
          </p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-600">
            <CalendarClock className="h-5 w-5" />
            <span className="font-semibold">Esta semana</span>
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {sortedDeadlines.filter((d) => getDaysUntil(d.date) > 0 && getDaysUntil(d.date) <= 7).length}
          </p>
        </div>
        <div className="bg-muted border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarClock className="h-5 w-5" />
            <span className="font-semibold">Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{sortedDeadlines.length}</p>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Janeiro 2026</h2>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-muted rounded-lg transition-colors">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="px-3 py-1 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">
              Hoje
            </button>
            <button className="p-2 hover:bg-muted rounded-lg transition-colors">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Simple List View */}
        <div className="space-y-2">
          {sortedDeadlines.map((deadline) => {
            const daysUntil = getDaysUntil(deadline.date)
            const urgency = getUrgencyLevel(daysUntil)

            return (
              <div
                key={deadline.id}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-xl border transition-colors cursor-pointer',
                  urgency === 'critical' && 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10',
                  urgency === 'urgent' && 'bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10',
                  urgency === 'warning' && 'bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10',
                  urgency === 'normal' && 'bg-muted/30 border-border hover:bg-muted/50'
                )}
              >
                <div
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    urgency === 'critical' && 'bg-red-500',
                    urgency === 'urgent' && 'bg-yellow-500',
                    urgency === 'warning' && 'bg-yellow-500',
                    urgency === 'normal' && 'bg-green-500'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{deadline.type}</span>
                    {urgency === 'critical' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-red-500/10 text-red-600 rounded">
                        HOJE
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {deadline.process} - {deadline.client}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-medium text-foreground">
                    {deadline.date.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </p>
                  <p
                    className={cn(
                      'text-xs',
                      urgency === 'critical' && 'text-red-600',
                      urgency === 'urgent' && 'text-yellow-600',
                      urgency === 'warning' && 'text-yellow-600',
                      urgency === 'normal' && 'text-muted-foreground'
                    )}
                  >
                    {daysUntil === 0
                      ? 'Hoje'
                      : daysUntil === 1
                        ? 'Amanha'
                        : `em ${daysUntil} dias`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
