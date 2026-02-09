import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { EventProps } from 'react-big-calendar'
import type { CalendarEvent } from './prazos-calendar'

const EVENT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  audiencia: { bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-500', hex: '#3b82f6' },
  prazo: { bg: 'bg-red-500/15', text: 'text-red-700 dark:text-red-300', border: 'border-red-500', hex: '#ef4444' },
  reuniao: { bg: 'bg-green-500/15', text: 'text-green-700 dark:text-green-300', border: 'border-green-500', hex: '#22c55e' },
  other: { bg: 'bg-slate-500/15', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-500', hex: '#64748b' },
}

// eslint-disable-next-line react-refresh/only-export-components
export function getEventColor(eventType: string) {
  return EVENT_TYPE_COLORS[eventType] ?? EVENT_TYPE_COLORS.other
}

export function CalendarEventComponent({ event, title }: EventProps<CalendarEvent>) {
  const colors = getEventColor(event.eventType)
  const timeStr = !event.allDay ? format(event.start, 'HH:mm') : null

  return (
    <div
      className={cn('truncate text-xs leading-tight', colors.text)}
      title={`${timeStr ? `${timeStr} – ` : ''}${title}${event.description ? `\n${event.description}` : ''}`}
    >
      {timeStr && <span className="opacity-60 mr-1">{timeStr}</span>}
      <span className="font-medium">{title}</span>
    </div>
  )
}

/**
 * Converts a hex color to an rgba string with the given alpha.
 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// eslint-disable-next-line react-refresh/only-export-components
export function eventStyleGetter(event: CalendarEvent) {
  const colors = getEventColor(event.eventType)
  const hex = event.color ?? colors.hex

  return {
    style: {
      backgroundColor: hexToRgba(hex, 0.15),
      color: hex,
      borderLeft: `3px solid ${hex}`,
      borderRadius: '4px',
    },
  }
}
