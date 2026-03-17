import { useQuery } from '@tanstack/react-query'
import { calendarService, type EventType, type DeadlinePriority, type DeadlineStatus } from '@/services/calendar-service'
import { useUser } from '@/features/auth/hooks/use-user'

export interface CalendarListParams {
  start: string;
  end: string;
  calendar_id?: string;
  event_type?: EventType;
  priority?: DeadlinePriority;
  deadline_status?: DeadlineStatus;
}

export function useCalendarEvents(params: CalendarListParams) {
  const { user } = useUser()
  // Só fazemos fetch se tiver um user E se o start/end existirem
  const enabled = !!user && !!params.start && !!params.end

  return useQuery({
    queryKey: ['calendar', 'events', params],
    queryFn: () => calendarService.listEvents(params.start, params.end, {
      calendar_id: params.calendar_id,
      event_type: params.event_type,
      priority: params.priority,
      deadline_status: params.deadline_status,
    }),
    enabled,
    placeholderData: (previousData) => previousData,
  })
}

export function useGoogleSyncStatus() {
  const { user } = useUser()
  const enabled = !!user

  return useQuery({
    queryKey: ['calendar', 'google', 'status'],
    queryFn: () => calendarService.getGoogleStatus(),
    enabled,
  })
}
