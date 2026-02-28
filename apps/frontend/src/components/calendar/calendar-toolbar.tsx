import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
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
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex items-center gap-1 mb-4">
      {/* Navegação */}
      <button
        onClick={() => onNavigate('PREV')}
        className="p-1.5 hover:bg-muted rounded-md transition-colors"
        aria-label="Anterior"
      >
        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
      </button>
      <button
        onClick={() => onNavigate('TODAY')}
        className="px-2.5 py-1 text-xs font-medium text-foreground border border-border rounded-md hover:bg-muted transition-colors"
      >
        Hoje
      </button>
      <button
        onClick={() => onNavigate('NEXT')}
        className="p-1.5 hover:bg-muted rounded-md transition-colors"
        aria-label="Próximo"
      >
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Label */}
      <h2 className="ml-1 text-sm font-semibold text-foreground capitalize truncate flex-1">{label}</h2>

      {/* Seletor de visualização — botões em desktop, dropdown em mobile */}
      <div className="hidden sm:flex rounded-md border border-border overflow-hidden">
        {AVAILABLE_VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => onView(v)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              view === v
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      {/* Dropdown — apenas mobile */}
      <div className="relative sm:hidden" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-border rounded-md bg-background text-foreground hover:bg-muted transition-colors"
        >
          {VIEW_LABELS[view]}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1 w-32 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
            {AVAILABLE_VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => { onView(v); setDropdownOpen(false) }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm transition-colors',
                  view === v
                    ? 'text-primary font-semibold bg-primary/5'
                    : 'text-foreground hover:bg-accent'
                )}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
