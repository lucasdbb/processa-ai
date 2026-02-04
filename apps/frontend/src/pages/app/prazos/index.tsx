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
      
      // Calculate counts from deadlines
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekFromNow = new Date(today)
      weekFromNow.setDate(weekFromNow.getDate() + 7)
      
      let todayCountCalc = 0
      let weekCountCalc = 0
      let overdueCountCalc = 0
      
      data.deadlines.forEach((d) => {
        const dueDate = new Date(d.due_date)
        if (dueDate < today) overdueCountCalc++
        if (dueDate.toDateString() === today.toDateString()) todayCountCalc++
        if (dueDate >= today && dueDate <= weekFromNow) weekCountCalc++
      })
      
      setTodayCount(todayCountCalc)
      setWeekCount(weekCountCalc)
      setOverdueCount(overdueCountCalc)
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
          title: deadlineData.title,
          due_date: deadlineData.date,
          description: deadlineData.description,
        })
        toast.success('Prazo atualizado com sucesso!')
      } else {
        // Create new deadline
        await deadlinesService.create({
          title: deadlineData.title,
          process_id: deadlineData.processId || '1', // Mock process ID
          due_date: deadlineData.date,
          description: deadlineData.description,
          reminder_days_before: deadlineData.notifyBefore || 3,
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

  const handleEditDeadline = (deadline: Deadline) => {
    // Transform API Deadline to form shape
    const formDeadline: EditingDeadline = {
      id: deadline.id || '',
      title: deadline.title || '',
      processNumber: deadline.process_id || '',
      processId: deadline.process_id,
      date: deadline.due_date || '',
      type: 'outros' as const,
      priority: (deadline.priority as 'alta' | 'media' | 'baixa') || 'media',
      description: deadline.description || undefined,
      notifyBefore: deadline.reminder_days_before || 3,
    }
    setEditingDeadline(formDeadline)
    setDefaultFormDate(deadline.due_date)
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

  const getDaysUntil = (dateStr: string) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dueDate = new Date(dateStr)
    const diffMs = dueDate.getTime() - today.getTime()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Prazos e Eventos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie prazos processuais, audiências e compromissos.
          </p>
        </div>
        <button
          onClick={handleNewDeadline}
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-md text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Evento
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-500">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-semibold text-xs">Urgente</span>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-500 mt-1.5">{todayCount + overdueCount}</p>
          <p className="text-[11px] text-red-600/70 dark:text-red-500/70 mt-0.5">Hoje/Atrasados</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
            <CalendarClock className="h-4 w-4" />
            <span className="font-semibold text-xs">Próximos 3 dias</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500 mt-1.5">
            {deadlines.filter((d) => {
              const daysUntil = getDaysUntil(d.due_date)
              return daysUntil > 0 && daysUntil <= 3
            }).length}
          </p>
          <p className="text-[11px] text-yellow-600/70 dark:text-yellow-500/70 mt-0.5">Atenção necessária</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500">
            <CalendarClock className="h-4 w-4" />
            <span className="font-semibold text-xs">Esta semana</span>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-500 mt-1.5">{weekCount}</p>
          <p className="text-[11px] text-blue-600/70 dark:text-blue-500/70 mt-0.5">Próximos 7 dias</p>
        </div>
        <div className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span className="font-semibold text-xs">Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-1.5">{totalCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Todos os eventos</p>
        </div>
      </div>

      {/* Tabs: Lista / Calendário */}
      <Tabs defaultValue="lista" className="space-y-3">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="lista" className="gap-1.5 text-xs">
            <List className="h-4 w-4" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1.5 text-xs">
            <CalendarDays className="h-4 w-4" />
            Calendário
          </TabsTrigger>
        </TabsList>

        {/* List Tab */}
        <TabsContent value="lista" className="mt-3">
          <div className="bg-card border border-border rounded-lg p-4">
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
              <div className="space-y-2">
                {deadlines.map((deadline) => {
                  const daysUntil = getDaysUntil(deadline.due_date)
                  const urgency = getUrgencyLevel(daysUntil)

                  return (
                    <div
                      key={deadline.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer group',
                        urgency === 'critical' && 'bg-red-500/5 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50',
                        urgency === 'urgent' && 'bg-yellow-500/5 border-yellow-500/30 hover:bg-yellow-500/10 hover:border-yellow-500/50',
                        urgency === 'warning' && 'bg-yellow-500/5 border-yellow-500/30 hover:bg-yellow-500/10 hover:border-yellow-500/50',
                        urgency === 'normal' && 'bg-card border-border hover:bg-muted/50 hover:border-muted-foreground/30'
                      )}
                      onClick={() => handleEditDeadline(deadline)}
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
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-foreground truncate">{deadline.title}</span>
                          {urgency === 'critical' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-red-500 text-white rounded-full">
                              URGENTE
                            </span>
                          )}
                          {urgency === 'urgent' && daysUntil === 1 && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-yellow-500 text-white rounded-full">
                              AMANHÃ
                            </span>
                          )}
                        </div>
                        {deadline.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                            {deadline.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm text-foreground">
                          {formatDeadlineDate(deadline.due_date)}
                        </p>
                        <p
                          className={cn(
                            'text-[11px] font-medium mt-0.5',
                            urgency === 'critical' && 'text-red-600 dark:text-red-500',
                            urgency === 'urgent' && 'text-yellow-600 dark:text-yellow-500',
                            urgency === 'warning' && 'text-yellow-600 dark:text-yellow-500',
                            urgency === 'normal' && 'text-muted-foreground'
                          )}
                        >
                          {formatDaysUntil(daysUntil)}
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
