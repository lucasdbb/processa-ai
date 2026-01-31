import { useCallback, useMemo, useState, useEffect } from 'react'
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek as startOfWeekFn, endOfWeek, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { CalendarToolbar } from './calendar-toolbar'
import { CalendarEventComponent, eventStyleGetter } from './calendar-event'
import { useCalendarSettingsStore } from '@/stores/calendar-settings-store'
import { cn } from '@/lib/utils'

import 'react-big-calendar/lib/css/react-big-calendar.css'
import './calendar-styles.css'

export type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  eventType: string
  color?: string
  processId?: string
  clientId?: string
  description?: string
}

type EventResponse = {
  id: string
  title: string
  description: string | null
  start_at: string
  end_at: string
  all_day: boolean
  event_type: string
  color: string | null
  processo_id: string | null
  cliente_id: string | null
}

type EventListResponse = {
  events: EventResponse[]
  total: number
}

const locales = { 'pt-BR': ptBR }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }),
  getDay,
  locales,
})

const messages = {
  allDay: 'Dia inteiro',
  previous: 'Anterior',
  next: 'Próximo',
  today: 'Hoje',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
  date: 'Data',
  time: 'Horário',
  event: 'Evento',
  noEventsInRange: 'Nenhum evento neste período.',
  showMore: (total: number) => `+${total} mais`,
}

function mapEventResponse(event: EventResponse): CalendarEvent {
  return {
    id: event.id,
    title: event.title,
    start: new Date(event.start_at),
    end: new Date(event.end_at),
    allDay: event.all_day,
    eventType: event.event_type,
    color: event.color ?? undefined,
    processId: event.processo_id ?? undefined,
    clientId: event.cliente_id ?? undefined,
    description: event.description ?? undefined,
  }
}

interface PrazosCalendarProps {
  onSelectSlot?: (date: Date) => void
  onSelectEvent?: (event: CalendarEvent) => void
}

export function PrazosCalendar({ onSelectSlot, onSelectEvent }: PrazosCalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState<View>('month')
  const [loadedRange, setLoadedRange] = useState<{ start: string; end: string } | null>(null)
  
  const { colorScheme, defaultView } = useCalendarSettingsStore()

  // Set default view on mount
  useEffect(() => {
    setCurrentView(defaultView)
  }, [defaultView])

  const fetchEvents = useCallback(async (date: Date, view: View) => {
    let start: Date
    let end: Date

    // Define range based on view
    switch (view) {
      case 'month':
        start = startOfMonth(subMonths(date, 1))
        end = endOfMonth(addMonths(date, 1))
        break
      case 'week':
        start = startOfWeekFn(subMonths(date, 1), { locale: ptBR })
        end = endOfWeek(addMonths(date, 1), { locale: ptBR })
        break
      case 'day':
        start = startOfDay(date)
        end = endOfDay(date)
        break
      case 'agenda':
        start = startOfDay(date)
        end = endOfDay(addMonths(date, 1))
        break
      default:
        start = startOfMonth(date)
        end = endOfMonth(date)
    }

    const startISO = start.toISOString()
    const endISO = end.toISOString()

    // Avoid refetching the same range
    if (loadedRange && loadedRange.start === startISO && loadedRange.end === endISO) {
      return
    }

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        start: startISO,
        end: endISO,
      })
      const res = await fetchWithCredentials(`${API_URL}/office/calendar/events?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar eventos')

      const data = (await res.json()) as EventListResponse
      setEvents(data.events.map(mapEventResponse))
      setLoadedRange({ start: startISO, end: endISO })
    } catch {
      toast.error('Erro ao carregar eventos do calendário')
    } finally {
      setIsLoading(false)
    }
  }, [loadedRange])

  // Initial fetch
  useEffect(() => {
    void fetchEvents(currentDate, currentView)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch events when date or view changes
  const handleNavigate = useCallback(
    (date: Date, view: View) => {
      setCurrentDate(date)
      void fetchEvents(date, view)
    },
    [fetchEvents]
  )

  const handleViewChange = useCallback(
    (view: View) => {
      setCurrentView(view)
      void fetchEvents(currentDate, view)
    },
    [currentDate, fetchEvents]
  )

  const handleSelectSlot = useCallback(
    (slotInfo: { start: Date }) => {
      onSelectSlot?.(slotInfo.start)
    },
    [onSelectSlot]
  )

  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      onSelectEvent?.(event)
    },
    [onSelectEvent]
  )

  const components = useMemo(
    () => ({
      toolbar: CalendarToolbar,
      event: CalendarEventComponent,
    }),
    []
  )

  if (isLoading && events.length === 0) {
    return (
      <div className="py-12 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className={cn('bg-card border border-border rounded-xl p-4', `calendar-${colorScheme}`)}>
      <div style={{ minHeight: 600 }}>
        <Calendar<CalendarEvent>
          localizer={localizer}
          events={events}
          date={currentDate}
          view={currentView}
          onNavigate={handleNavigate}
          onView={handleViewChange}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable
          popup
          messages={messages}
          components={components}
          eventPropGetter={eventStyleGetter}
          views={['month', 'week', 'day', 'agenda']}
          culture="pt-BR"
          step={30}
          timeslots={2}
          formats={{
            monthHeaderFormat: (date: Date) => format(date, 'MMMM yyyy', { locale: ptBR }),
            weekdayFormat: (date: Date) => format(date, 'EEE', { locale: ptBR }),
            dayHeaderFormat: (date: Date) => format(date, "EEEE, d 'de' MMMM", { locale: ptBR }),
            dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
              `${format(start, 'd MMM', { locale: ptBR })} – ${format(end, 'd MMM yyyy', { locale: ptBR })}`,
            agendaDateFormat: (date: Date) => format(date, "EEE, d 'de' MMM", { locale: ptBR }),
            agendaTimeFormat: (date: Date) => format(date, 'HH:mm', { locale: ptBR }),
            agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
              `${format(start, 'HH:mm', { locale: ptBR })} – ${format(end, 'HH:mm', { locale: ptBR })}`,
          }}
        />
      </div>
    </div>
  )
}
