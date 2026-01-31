import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToolbarProps, View } from 'react-big-calendar'
import type { CalendarEvent } from './prazos-calendar'

const VIEW_LABELS: Record<View, string> = {
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
  work_week: 'Semana útil',
}

const AVAILABLE_VIEWS: View[] = ['month', 'week', 'day', 'agenda']

export function CalendarToolbar({ label, onNavigate, onView, view }: ToolbarProps<CalendarEvent, object>) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onNavigate('PREV')}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => onNavigate('TODAY')}
          className="px-3 py-1 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
        >
          Hoje
        </button>
        <button
          onClick={() => onNavigate('NEXT')}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <h2 className="ml-2 font-semibold text-foreground capitalize">{label}</h2>
      </div>

      <div className="flex rounded-lg border border-border overflow-hidden">
        {AVAILABLE_VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => onView(v)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              view === v
                ? 'bg-slate-900 text-white'
                : 'bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>
    </div>
  )
}
