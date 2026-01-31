import { cn } from '@/lib/utils'
import type { EventProps } from 'react-big-calendar'
import type { CalendarEvent } from './prazos-calendar'

const EVENT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  audiencia: { bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-500' },
  prazo: { bg: 'bg-red-500/15', text: 'text-red-700 dark:text-red-400', border: 'border-red-500' },
  reuniao: { bg: 'bg-green-500/15', text: 'text-green-700 dark:text-green-400', border: 'border-green-500' },
  other: { bg: 'bg-slate-500/15', text: 'text-slate-700 dark:text-slate-400', border: 'border-slate-500' },
}

// eslint-disable-next-line react-refresh/only-export-components
export function getEventColor(eventType: string) {
  return EVENT_TYPE_COLORS[eventType] ?? EVENT_TYPE_COLORS.other
}

export function CalendarEventComponent({ event, title }: EventProps<CalendarEvent>) {
  const colors = getEventColor(event.eventType)

  return (
    <div
      className={cn('truncate', colors.text)}
      title={`${title}${event.description ? `\n${event.description}` : ''}`}
    >
      <span className="font-medium">{title}</span>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function eventStyleGetter(event: CalendarEvent) {
  const colorMap: Record<string, string> = {
    audiencia: '#3b82f6',
    prazo: '#ef4444',
    reuniao: '#22c55e',
    other: '#64748b',
  }

  const color = event.color ?? colorMap[event.eventType] ?? colorMap.other

  return {
    style: {
      backgroundColor: `${color}20`,
      color: color,
      borderLeft: `3px solid ${color}`,
    },
  }
}
