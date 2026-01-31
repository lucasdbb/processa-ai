import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { CalendarClock, AlertTriangle, Plus, CalendarDays, List } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { DeadlineFormDialog } from '@/components/forms/deadline-form-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PrazosCalendar } from '@/components/calendar/prazos-calendar'
import type { CalendarEvent } from '@/components/calendar/prazos-calendar'
import { deadlinesService, type Deadline } from '@/services/deadlines-service'

export default function PrazosPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [defaultFormDate, setDefaultFormDate] = useState<string | undefined>(undefined)

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
      const data = await deadlinesService.list()
      setDeadlines(data.deadlines)
      setTodayCount(data.today_count)
      setWeekCount(data.week_count)
      setOverdueCount(data.overdue_count)
      setTotalCount(data.total)
    } catch (error) {
      setDeadlines([])
      setTodayCount(0)
      setWeekCount(0)
      setOverdueCount(0)
      setTotalCount(0)
      toast.error('Erro ao carregar prazos')
      console.error('Error fetching deadlines:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDeadlines()
  }, [fetchDeadlines])

  const handleSaveDeadline = async (deadlineData: SaveDeadlinePayload) => {
    try {
      if ('id' in deadlineData && deadlineData.id) {
        // Update existing deadline
        await deadlinesService.update(deadlineData.id, {
          type: deadlineData.type,
          date: deadlineData.date,
          description: deadlineData.description,
        })
        toast.success('Prazo atualizado com sucesso!')
      } else {
        // Create new deadline
        await deadlinesService.create({
          type: deadlineData.title,
          process_id: deadlineData.processId || '1', // Mock process ID
          date: new Date(deadlineData.date + (deadlineData.time ? `T${deadlineData.time}` : 'T23:59:59')).toISOString(),
          description: deadlineData.description,
          reminder_days: [deadlineData.notifyBefore || 3],
        })
        toast.success('Prazo criado com sucesso!')
      }
      
      // Reload deadlines
      await fetchDeadlines()
      setIsFormOpen(false)
    } catch (error) {
      console.error('Error saving deadline:', error)
      toast.error('Erro ao salvar prazo. Tente novamente.')
    }
  }

  const handleNewDeadline = () => {
    setEditingDeadline(undefined)
    setDefaultFormDate(undefined)
    setIsFormOpen(true)
  }

  const handleSelectSlot = (date: Date) => {
    setEditingDeadline(undefined)
    setDefaultFormDate(format(date, 'yyyy-MM-dd'))
    setIsFormOpen(true)
  }

  const handleSelectEvent = (event: CalendarEvent) => {
    toast.info(`Evento: ${event.title}${event.description ? ` — ${event.description}` : ''}`)
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
          <h1 className="text-2xl font-bold text-foreground">Prazos e Eventos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie prazos processuais, audiências e compromissos.
          </p>
        </div>
        <button
          onClick={handleNewDeadline}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Novo Evento
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-500">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold text-sm">Urgente</span>
          </div>
          <p className="text-3xl font-bold text-red-600 dark:text-red-500 mt-2">{todayCount + overdueCount}</p>
          <p className="text-xs text-red-600/70 dark:text-red-500/70 mt-1">Hoje/Atrasados</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
            <CalendarClock className="h-5 w-5" />
            <span className="font-semibold text-sm">Próximos 3 dias</span>
          </div>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-500 mt-2">
            {deadlines.filter((d) => d.days_until > 0 && d.days_until <= 3).length}
          </p>
          <p className="text-xs text-yellow-600/70 dark:text-yellow-500/70 mt-1">Atenção necessária</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500">
            <CalendarClock className="h-5 w-5" />
            <span className="font-semibold text-sm">Esta semana</span>
          </div>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-500 mt-2">{weekCount}</p>
          <p className="text-xs text-blue-600/70 dark:text-blue-500/70 mt-1">Próximos 7 dias</p>
        </div>
        <div className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-5 w-5" />
            <span className="font-semibold text-sm">Total</span>
          </div>
          <p className="text-3xl font-bold text-foreground mt-2">{totalCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Todos os eventos</p>
        </div>
      </div>

      {/* Tabs: Lista / Calendário */}
      <Tabs defaultValue="lista" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="lista" className="gap-1.5">
            <List className="h-4 w-4" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Calendário
          </TabsTrigger>
        </TabsList>

        {/* List Tab */}
        <TabsContent value="lista" className="mt-4">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <LoadingSpinner size="lg" />
                <p className="text-sm text-muted-foreground">Carregando prazos...</p>
              </div>
            ) : deadlines.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-base font-medium mb-1">Nenhum prazo encontrado</p>
                <p className="text-sm">Clique em "Novo Evento" para adicionar um prazo</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deadlines.map((deadline) => {
                  const urgency = getUrgencyLevel(deadline.days_until)

                  return (
                    <div
                      key={deadline.id}
                      className={cn(
                        'flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer group',
                        urgency === 'critical' && 'bg-red-500/5 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 hover:shadow-md',
                        urgency === 'urgent' && 'bg-yellow-500/5 border-yellow-500/30 hover:bg-yellow-500/10 hover:border-yellow-500/50 hover:shadow-md',
                        urgency === 'warning' && 'bg-yellow-500/5 border-yellow-500/30 hover:bg-yellow-500/10 hover:border-yellow-500/50 hover:shadow-md',
                        urgency === 'normal' && 'bg-card border-border hover:bg-muted/50 hover:border-muted-foreground/30 hover:shadow-md'
                      )}
                    >
                      <div
                        className={cn(
                          'w-3 h-3 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-background',
                          urgency === 'critical' && 'bg-red-500 ring-red-500/30',
                          urgency === 'urgent' && 'bg-yellow-500 ring-yellow-500/30',
                          urgency === 'warning' && 'bg-yellow-500 ring-yellow-500/30',
                          urgency === 'normal' && 'bg-green-500 ring-green-500/30'
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-foreground">{deadline.type}</span>
                          {urgency === 'critical' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-red-500 text-white rounded-full">
                              URGENTE
                            </span>
                          )}
                          {urgency === 'urgent' && deadline.days_until === 1 && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-yellow-500 text-white rounded-full">
                              AMANHÃ
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {deadline.process_number} • {deadline.client_name}
                        </p>
                        {deadline.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{deadline.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-base text-foreground">
                          {formatDeadlineDate(deadline.date)}
                        </p>
                        <p
                          className={cn(
                            'text-xs font-medium mt-0.5',
                            urgency === 'critical' && 'text-red-600 dark:text-red-500',
                            urgency === 'urgent' && 'text-yellow-600 dark:text-yellow-500',
                            urgency === 'warning' && 'text-yellow-600 dark:text-yellow-500',
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
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendario" className="mt-4">
          <PrazosCalendar
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
          />
        </TabsContent>
      </Tabs>

      {/* Deadline Form Dialog */}
      <DeadlineFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        deadline={editingDeadline}
        defaultDate={defaultFormDate}
        onSave={handleSaveDeadline}
      />
    </div>
  )
}
