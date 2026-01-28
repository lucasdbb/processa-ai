import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { CalendarClock, AlertTriangle, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { DeadlineFormDialog } from '@/components/forms/deadline-form-dialog'

type Deadline = {
  id: string
  type: string
  process_id: string
  process_number: string
  client_name: string
  date: string
  description: string | null
  status: 'pending' | 'completed' | 'overdue'
  days_until: number
}

type DeadlineListResponse = {
  deadlines: Deadline[]
  total: number
  today_count: number
  week_count: number
  overdue_count: number
}

export default function PrazosPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)

  type EditingDeadline = ComponentProps<typeof DeadlineFormDialog>['deadline']
  type SaveDeadlinePayload = Parameters<ComponentProps<typeof DeadlineFormDialog>['onSave']>[0]

  const [editingDeadline, setEditingDeadline] = useState<EditingDeadline>(undefined)

  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [todayCount, setTodayCount] = useState(0)
  const [weekCount, setWeekCount] = useState(0)
  const [overdueCount, setOverdueCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  const fetchDeadlines = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetchWithCredentials(`${API_URL}/office/deadlines`)
      if (!res.ok) throw new Error('Erro ao carregar prazos')

      const data = (await res.json()) as DeadlineListResponse
      setDeadlines(data.deadlines)
      setTodayCount(data.today_count)
      setWeekCount(data.week_count)
      setOverdueCount(data.overdue_count)
      setTotalCount(data.total)
    } catch {
      setDeadlines([])
      setTodayCount(0)
      setWeekCount(0)
      setOverdueCount(0)
      setTotalCount(0)
      toast.error('Erro ao carregar prazos')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDeadlines()
  }, [fetchDeadlines])

  const handleSaveDeadline = (deadlineData: SaveDeadlinePayload) => {
    console.log('Salvando prazo:', deadlineData)
    // Aqui você implementaria a lógica de salvar no backend
  }

  const handleNewDeadline = () => {
    setEditingDeadline(undefined)
    setIsFormOpen(true)
  }

  const getUrgencyLevel = (daysUntil: number) => {
    if (daysUntil <= 0) return 'critical'
    if (daysUntil <= 2) return 'urgent'
    if (daysUntil <= 5) return 'warning'
    return 'normal'
  }

  const formatDeadlineDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    })
  }

  const formatDaysUntil = (daysUntil: number) => {
    if (daysUntil === 0) return 'Hoje'
    if (daysUntil === 1) return 'Amanha'
    if (daysUntil < 0) return `${Math.abs(daysUntil)} dias atras`
    return `em ${daysUntil} dias`
  }

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
        <button
          onClick={handleNewDeadline}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Prazo
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">Hoje / Atrasados</span>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-2">{todayCount + overdueCount}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-600">
            <CalendarClock className="h-5 w-5" />
            <span className="font-semibold">Proximos 3 dias</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600 mt-2">
            {deadlines.filter((d) => d.days_until > 0 && d.days_until <= 3).length}
          </p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-600">
            <CalendarClock className="h-5 w-5" />
            <span className="font-semibold">Esta semana</span>
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-2">{weekCount}</p>
        </div>
        <div className="bg-muted border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarClock className="h-5 w-5" />
            <span className="font-semibold">Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{totalCount}</p>
        </div>
      </div>

      {/* Calendar Header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Prazos</h2>
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

        {/* List View */}
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : deadlines.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum prazo encontrado.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {deadlines.map((deadline) => {
              const urgency = getUrgencyLevel(deadline.days_until)

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
                      {deadline.process_number} - {deadline.client_name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium text-foreground">
                      {formatDeadlineDate(deadline.date)}
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
                      {formatDaysUntil(deadline.days_until)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Deadline Form Dialog */}
      <DeadlineFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        deadline={editingDeadline}
        onSave={handleSaveDeadline}
      />
    </div>
  )
}
