import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SEO } from '@/components/seo'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { AlertTriangle, CalendarClock, CalendarDays, ChevronDown, List, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PrazosCalendar, type CalendarEvent as PrazosCalendarEvent } from '@/components/calendar/prazos-calendar'
import { CalendarEventFormDialog } from '@/components/forms/calendar-event-form-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { calendarService, type CalendarEvent } from '@/services/calendar-service'
import { useCalendarEvents, useGoogleSyncStatus } from '@/hooks/use-calendar'
import { useQueryClient } from '@tanstack/react-query'

// Sync overlay steps
type SyncStep = 'connecting' | 'syncing' | 'done' | 'error'

export default function CalendarioPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [defaultDate, setDefaultDate] = useState<string | undefined>()
  const [showGoogleDropdown, setShowGoogleDropdown] = useState(false)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const summaryDropdownRef = useRef<HTMLDivElement>(null)
  const [summaryDropdownOpen, setSummaryDropdownOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const { data: googleStatus } = useGoogleSyncStatus()

  // Quick Stats sidebar
  const [summaryPeriod, setSummaryPeriod] = useState<'today' | 'month' | 'year'>('today')

  const now = new Date()
  const todayStr = format(now, 'yyyy-MM-dd')
  
  const summaryDates = useMemo(() => {
    if (summaryPeriod === 'today') return { start: todayStr, end: todayStr }
    if (summaryPeriod === 'month') {
      return {
        start: format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'),
        end: format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd')
      }
    }
    return {
      start: format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd'),
      end: format(new Date(now.getFullYear(), 11, 31), 'yyyy-MM-dd')
    }
  }, [summaryPeriod, todayStr])

  const { data: todayEventsResponse } = useCalendarEvents({ start: todayStr, end: todayStr })
  const todayEvents = todayEventsResponse?.events ?? []

  const { data: summaryEventsResponse } = useCalendarEvents({ start: summaryDates.start, end: summaryDates.end })
  const summaryEvents = summaryEventsResponse?.events ?? []

  const prazosStart = format(addDays(now, -60), 'yyyy-MM-dd')
  const prazosEnd = format(addDays(now, 90), 'yyyy-MM-dd')
  const { data: prazoEventsResponse, isLoading: isPrazosLoading } = useCalendarEvents({
    start: prazosStart,
    end: prazosEnd,
    event_type: 'prazo',
    deadline_status: 'pending',
  })
  const prazoEvents = prazoEventsResponse?.events ?? []

  // Sync overlay state
  const [syncOverlay, setSyncOverlay] = useState<{
    visible: boolean
    step: SyncStep
    message: string
    detail?: string
    progress: number
  }>({ visible: false, step: 'connecting', message: '', progress: 0 })

  const callbackHandled = useRef(false)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowGoogleDropdown(false)
      }
      if (summaryDropdownRef.current && !summaryDropdownRef.current.contains(e.target as Node)) {
        setSummaryDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle OAuth callback redirect
  useEffect(() => {
    if (callbackHandled.current) return

    const connected = searchParams.get('google_connected')
    const error = searchParams.get('error')

    if (connected === 'true') {
      callbackHandled.current = true
      // Clean URL
      setSearchParams({}, { replace: true })

      // Start the sync overlay animation
      const runPostConnectSync = async () => {
        setSyncOverlay({
          visible: true,
          step: 'connecting',
          message: 'Conectado ao Google Calendar!',
          detail: 'Verificando conta...',
          progress: 20,
        })

        // Load status to get email
        await queryClient.invalidateQueries({ queryKey: ['calendar', 'google', 'status'] })

        setSyncOverlay({
          visible: true,
          step: 'syncing',
          message: 'Enviando eventos para o Google Calendar...',
          detail: 'Sincronizando seus compromissos',
          progress: 50,
        })

        try {
          const result = await calendarService.syncToGoogle()

          const parts = []
          if (result.events_added > 0) parts.push(`${result.events_added} adicionados`)
          if (result.events_updated > 0) parts.push(`${result.events_updated} atualizados`)
          const total = result.events_added + result.events_updated

          setSyncOverlay({
            visible: true,
            step: 'done',
            message: 'Sincronização concluída!',
            detail: total > 0
              ? `${parts.join(', ')} no Google Calendar`
              : 'Todos os eventos já estavam sincronizados',
            progress: 100,
          })
        } catch {
          setSyncOverlay({
            visible: true,
            step: 'done',
            message: 'Google Calendar conectado!',
            detail: 'Você pode sincronizar manualmente a qualquer momento',
            progress: 100,
          })
        }

        // Auto-close after 3 seconds
        setTimeout(() => {
          setSyncOverlay((prev) => ({ ...prev, visible: false }))
        }, 3000)
      }

      void runPostConnectSync()
    } else if (connected === 'false') {
      callbackHandled.current = true
      setSearchParams({}, { replace: true })
      toast.error(error ? `Erro ao conectar: ${error}` : 'Falha ao conectar com Google Calendar')
    }
  }, [searchParams, setSearchParams, queryClient])

  const handleConnectGoogle = async () => {
    try {
      const { auth_url } = await calendarService.connectGoogle()
      // Redirect in the same window - Google will redirect back to /app/calendario
      window.location.href = auth_url
    } catch {
      toast.error('Erro ao conectar com Google Calendar')
    }
  }

  const handleSyncGoogle = async () => {
    setIsSyncing(true)
    setSyncOverlay({
      visible: true,
      step: 'syncing',
      message: 'Enviando eventos para o Google Calendar...',
      detail: 'Sincronizando seus compromissos',
      progress: 50,
    })

    try {
      const result = await calendarService.syncToGoogle()

      const parts = []
      if (result.events_added > 0) parts.push(`${result.events_added} adicionados`)
      if (result.events_updated > 0) parts.push(`${result.events_updated} atualizados`)
      const total = result.events_added + result.events_updated

      setSyncOverlay({
        visible: true,
        step: 'done',
        message: 'Sincronização concluída!',
        detail: total > 0
          ? `${parts.join(', ')} no Google Calendar`
          : 'Todos os eventos já estavam sincronizados',
        progress: 100,
      })

      setTimeout(() => {
        setSyncOverlay((prev) => ({ ...prev, visible: false }))
      }, 3000)
    } catch {
      setSyncOverlay({
        visible: true,
        step: 'error',
        message: 'Erro na sincronização',
        detail: 'Tente novamente mais tarde',
        progress: 100,
      })

      setTimeout(() => {
        setSyncOverlay((prev) => ({ ...prev, visible: false }))
      }, 3000)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDisconnectGoogle = async () => {
    try {
      await calendarService.disconnectGoogle()
      await queryClient.invalidateQueries({ queryKey: ['calendar', 'google', 'status'] })
      setShowGoogleDropdown(false)
      setShowDisconnectModal(false)
      toast.success('Google Calendar desconectado')
    } catch {
      toast.error('Erro ao desconectar')
    }
  }

  const handleSelectSlot = (date: Date) => {
    setEditingEvent(null)
    setDefaultDate(format(date, 'yyyy-MM-dd'))
    setShowEventDialog(true)
  }

  const handleSelectEvent = async (event: PrazosCalendarEvent) => {
    try {
      const fullEvent = await calendarService.getEvent(event.id)
      setEditingEvent(fullEvent)
      setDefaultDate(undefined)
      setShowEventDialog(true)
    } catch {
      toast.error('Erro ao carregar evento')
    }
  }

  const handleEditPrazoEvent = async (event: CalendarEvent) => {
    try {
      const fullEvent = await calendarService.getEvent(event.id)
      setEditingEvent(fullEvent)
      setDefaultDate(undefined)
      setShowEventDialog(true)
    } catch {
      toast.error('Erro ao carregar evento')
    }
  }

  const handleNewEvent = () => {
    setEditingEvent(null)
    setDefaultDate(undefined)
    setShowEventDialog(true)
  }

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      audiencia: 'Audiência',
      prazo: 'Prazo',
      reuniao: 'Reunião',
      other: 'Outros',
    }
    return labels[type] || type
  }

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      audiencia: 'bg-red-500',
      prazo: 'bg-yellow-500',
      reuniao: 'bg-blue-500',
      other: 'bg-gray-400',
    }
    return colors[type] || 'bg-gray-400'
  }

  // --- Prazo summary helpers ---
  const getDaysUntil = (dateStr: string) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dueDate = new Date(dateStr)
    const diffMs = dueDate.getTime() - today.getTime()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }

  const prazoStats = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekFromNow = addDays(today, 7)

    let todayCount = 0
    let overdueCount = 0
    let next3Days = 0
    let weekCount = 0

    prazoEvents.forEach((e) => {
      const dueDate = new Date(e.start_at)
      const daysUntil = getDaysUntil(e.start_at)
      if (dueDate < today) overdueCount++
      if (dueDate.toDateString() === today.toDateString()) todayCount++
      if (daysUntil > 0 && daysUntil <= 3) next3Days++
      if (dueDate >= today && dueDate <= weekFromNow) weekCount++
    })

    return { todayCount, overdueCount, next3Days, weekCount, total: prazoEvents.length }
  }, [prazoEvents])

  const getUrgencyLevel = (daysUntil: number) => {
    if (daysUntil <= 0) return 'critical'
    if (daysUntil <= 2) return 'urgent'
    if (daysUntil <= 5) return 'warning'
    return 'normal'
  }

  const formatDeadlineDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  const formatDaysUntil = (daysUntil: number) => {
    if (daysUntil === 0) return 'Hoje'
    if (daysUntil === 1) return 'Amanhã'
    if (daysUntil < 0) return `${Math.abs(daysUntil)} dias atrás`
    return `em ${daysUntil} dias`
  }

  // Sort prazo events by start_at ascending
  const sortedPrazoEvents = useMemo(
    () => [...prazoEvents].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [prazoEvents]
  )

  return (
    <div className="space-y-4">
      <SEO title="Calendário" noindex />
      {/* Sync Overlay */}
      {syncOverlay.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-300">
            {/* Google Logo */}
            <div className="flex justify-center mb-5">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center',
                syncOverlay.step === 'error' ? 'bg-red-500/10' : 'bg-green-500/10'
              )}>
                {syncOverlay.step === 'error' ? (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ) : syncOverlay.step === 'done' ? (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
              </div>
            </div>

            {/* Message */}
            <h3 className="text-lg font-semibold text-foreground text-center">
              {syncOverlay.message}
            </h3>
            {syncOverlay.detail && (
              <p className="text-sm text-muted-foreground text-center mt-1.5">
                {syncOverlay.detail}
              </p>
            )}
            {googleStatus?.email && syncOverlay.step !== 'error' && (
              <p className="text-xs text-muted-foreground text-center mt-1">
                {googleStatus.email}
              </p>
            )}

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-1000 ease-out',
                    syncOverlay.step === 'error' ? 'bg-red-500' : 'bg-green-500'
                  )}
                  style={{ width: `${syncOverlay.progress}%` }}
                />
              </div>
              {syncOverlay.step === 'syncing' && (
                <div className="flex justify-between mt-2">
                  <span className="text-[11px] text-muted-foreground">Enviando eventos...</span>
                  <span className="text-[11px] text-muted-foreground animate-pulse">
                    <svg className="inline h-3 w-3 animate-spin mr-1" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Em andamento
                  </span>
                </div>
              )}
            </div>

            {/* Close button when done */}
            {(syncOverlay.step === 'done' || syncOverlay.step === 'error') && (
              <button
                onClick={() => setSyncOverlay((prev) => ({ ...prev, visible: false }))}
                className="w-full mt-5 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="hsl(var(--destructive))" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <h3 className="text-base font-semibold text-foreground text-center">
              Desconectar Google Calendar?
            </h3>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Seus eventos locais não serão afetados. Você pode reconectar a qualquer momento.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowDisconnectModal(false)}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDisconnectGoogle}
                className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors"
              >
                Desconectar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Calendário</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie audiências, prazos e compromissos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Google Calendar Button + Dropdown */}
          <div className="relative" ref={dropdownRef}>
            {googleStatus?.connected ? (
              <button
                onClick={() => setShowGoogleDropdown(!showGoogleDropdown)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-green-500/30 text-green-700 dark:text-green-400 hover:bg-green-500/10 transition-colors"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Conectado
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-50">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ) : (
              <button
                onClick={handleConnectGoogle}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google Calendar
              </button>
            )}

            {/* Dropdown */}
            {showGoogleDropdown && googleStatus?.connected && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-xl shadow-lg z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Profile section */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Google Calendar</p>
                      <p className="text-xs text-muted-foreground truncate">{googleStatus.email}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-1.5">
                  <button
                    onClick={() => { setShowGoogleDropdown(false); void handleSyncGoogle() }}
                    disabled={isSyncing}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-muted-foreground">
                      <path d="M2.5 8A5.5 5.5 0 0112.95 4.5M13.5 8A5.5 5.5 0 013.05 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M10.5 4.5H13V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5.5 11.5H3V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Sincronizar agora
                  </button>
                  <button
                    onClick={() => { setShowGoogleDropdown(false); setShowDisconnectModal(true) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                      <path d="M6 2H10M2 4H14M12.667 4L12.111 12.533C12.048 13.413 11.308 14 10.426 14H5.574C4.692 14 3.952 13.413 3.889 12.533L3.333 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Desconectar
                  </button>
                </div>

                {/* Footer note */}
                <div className="px-4 py-2.5 border-t border-border">
                  <p className="text-[11px] text-muted-foreground">
                    Sincronização unidirecional: eventos locais → Google.
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleNewEvent}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-md text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Novo Evento
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-500">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-semibold text-xs">Urgente</span>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-500 mt-1.5">{prazoStats.todayCount + prazoStats.overdueCount}</p>
          <p className="text-[11px] text-red-600/70 dark:text-red-500/70 mt-0.5">Hoje/Atrasados</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
            <CalendarClock className="h-4 w-4" />
            <span className="font-semibold text-xs">Próximos 3 dias</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500 mt-1.5">{prazoStats.next3Days}</p>
          <p className="text-[11px] text-yellow-600/70 dark:text-yellow-500/70 mt-0.5">Atenção necessária</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500">
            <CalendarClock className="h-4 w-4" />
            <span className="font-semibold text-xs">Esta semana</span>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-500 mt-1.5">{prazoStats.weekCount}</p>
          <p className="text-[11px] text-blue-600/70 dark:text-blue-500/70 mt-0.5">Próximos 7 dias</p>
        </div>
        <div className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span className="font-semibold text-xs">Total Prazos</span>
          </div>
          <p className="text-2xl font-bold text-foreground mt-1.5">{prazoStats.total}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Pendentes</p>
        </div>
      </div>

      {/* Tabs: Calendário / Lista */}
      <Tabs defaultValue="calendario" className="space-y-3">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="calendario" className="gap-1.5 text-xs">
            <CalendarDays className="h-4 w-4" />
            Calendário
          </TabsTrigger>
          <TabsTrigger value="lista" className="gap-1.5 text-xs">
            <List className="h-4 w-4" />
            Lista de Prazos
          </TabsTrigger>
        </TabsList>

        {/* Calendar Tab */}
        <TabsContent value="calendario" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            {/* Calendar */}
            <div>
              <PrazosCalendar
                key={refreshKey}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Today's Events */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Hoje · {format(new Date(), "d 'de' MMMM", { locale: ptBR })}
                </h3>
                {todayEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Nenhum evento hoje
                  </p>
                ) : (
                  <div className="space-y-2">
                    {todayEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={async () => {
                          setEditingEvent(event)
                          setShowEventDialog(true)
                        }}
                        className="w-full text-left p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', getEventTypeColor(event.event_type))} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-muted-foreground">
                                {event.all_day
                                  ? 'Dia inteiro'
                                  : `${format(new Date(event.start_at), 'HH:mm')} - ${format(new Date(event.end_at), 'HH:mm')}`}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {getEventTypeLabel(event.event_type)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Resumo</h3>

                  {/* Desktop: botões */}
                  <div className="hidden sm:flex rounded-md border border-border overflow-hidden">
                    {([
                      { value: 'today', label: 'Hoje' },
                      { value: 'month', label: 'Mês' },
                      { value: 'year', label: 'Ano' },
                    ] as const).map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setSummaryPeriod(p.value)}
                        className={cn(
                          'px-2 py-0.5 text-[11px] font-medium transition-colors',
                          summaryPeriod === p.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Mobile: dropdown */}
                  <div className="relative sm:hidden" ref={summaryDropdownRef}>
                    <button
                      onClick={() => setSummaryDropdownOpen((v) => !v)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-border rounded-md bg-background text-foreground hover:bg-muted transition-colors"
                    >
                      {summaryPeriod === 'today' ? 'Hoje' : summaryPeriod === 'month' ? 'Mês' : 'Ano'}
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                    {summaryDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1 w-24 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
                        {([
                          { value: 'today', label: 'Hoje' },
                          { value: 'month', label: 'Mês' },
                          { value: 'year', label: 'Ano' },
                        ] as const).map((p) => (
                          <button
                            key={p.value}
                            onClick={() => { setSummaryPeriod(p.value); setSummaryDropdownOpen(false) }}
                            className={cn(
                              'w-full px-3 py-2 text-left text-sm transition-colors',
                              summaryPeriod === p.value
                                ? 'text-primary font-semibold bg-primary/5'
                                : 'text-foreground hover:bg-accent'
                            )}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {(['audiencia', 'prazo', 'reuniao'] as const).map((type) => {
                    const source = summaryPeriod === 'today' ? todayEvents : summaryEvents
                    return (
                      <div key={type} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2 h-2 rounded-full', getEventTypeColor(type))} />
                          <span className="text-muted-foreground">{getEventTypeLabel(type)}</span>
                        </div>
                        <span className="font-medium text-foreground">
                          {source.filter((e) => e.event_type === type).length}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* List Tab */}
        <TabsContent value="lista" className="mt-3">
          <div className="bg-card border border-border rounded-lg p-4">
            {isPrazosLoading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <LoadingSpinner size="lg" />
                <p className="text-sm text-muted-foreground">Carregando prazos...</p>
              </div>
            ) : sortedPrazoEvents.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-base font-medium mb-1">Nenhum prazo pendente</p>
                <p className="text-sm">Crie um evento do tipo "Prazo" para acompanhar seus prazos</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedPrazoEvents.map((event) => {
                  const daysUntil = getDaysUntil(event.start_at)
                  const urgency = getUrgencyLevel(daysUntil)

                  return (
                    <div
                      key={event.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer group',
                        urgency === 'critical' && 'bg-red-500/5 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50',
                        urgency === 'urgent' && 'bg-yellow-500/5 border-yellow-500/30 hover:bg-yellow-500/10 hover:border-yellow-500/50',
                        urgency === 'warning' && 'bg-yellow-500/5 border-yellow-500/30 hover:bg-yellow-500/10 hover:border-yellow-500/50',
                        urgency === 'normal' && 'bg-card border-border hover:bg-muted/50 hover:border-muted-foreground/30'
                      )}
                      onClick={() => void handleEditPrazoEvent(event)}
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
                          <span className="text-sm font-semibold text-foreground truncate">{event.title}</span>
                          {urgency === 'critical' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-red-500 text-white rounded-full">
                              URGENTE
                            </span>
                          )}
                          {urgency === 'urgent' && daysUntil === 1 && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-yellow-500 text-white rounded-full">
                              AMANHA
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                            {event.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm text-foreground">
                          {formatDeadlineDate(event.start_at)}
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
      </Tabs>

      {/* Floating Action Button — apenas mobile */}
      <div className="fixed bottom-22 right-4 z-50 sm:hidden">
        <button
          onClick={handleNewEvent}
          className="flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Event Form Dialog */}
      <CalendarEventFormDialog
        isOpen={showEventDialog}
        onClose={() => {
          setShowEventDialog(false)
          setEditingEvent(null)
          setDefaultDate(undefined)
        }}
        onSave={() => {
          setShowEventDialog(false)
          setEditingEvent(null)
          setDefaultDate(undefined)
          void queryClient.invalidateQueries({ queryKey: ['calendar'] })
          // Force calendar redraw
          setRefreshKey((k) => k + 1)
        }}
        event={editingEvent || undefined}
        defaultDate={defaultDate}
      />
    </div>
  )
}
