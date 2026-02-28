import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import { LayoutGrid, List, SlidersHorizontal } from 'lucide-react'

export type ViewMode = 'list' | 'kanban'

interface PageLayoutProps {
  title: string
  description?: string
  actions?: ReactNode
  /** Campo de busca — sempre visível em linha inteira (ao lado do botão Filtros em mobile) */
  primaryFilter?: ReactNode
  /** Controles secundários. Em desktop ficam inline; em mobile ficam num painel expansível */
  filters?: ReactNode
  children: ReactNode
  className?: string
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  isLoading?: boolean
}

export function PageLayout({
  title,
  description,
  actions,
  primaryFilter,
  filters,
  children,
  className,
  viewMode,
  onViewModeChange,
  isLoading,
}: PageLayoutProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          {viewMode && onViewModeChange && (
            <div className="flex items-center rounded-md border border-border overflow-hidden bg-background">
              <button
                onClick={() => onViewModeChange('list')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
                title="List"
              >
                <List className="h-4 w-4" />
              </button>
              <div className="w-px h-4 bg-border" />
              <button
                onClick={() => onViewModeChange('kanban')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'kanban'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
                title="Kanban"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          )}

          {actions}
        </div>
      </div>

      {/* Search + filter toggle (mobile) / search only (desktop) */}
      {(primaryFilter || filters) && (
        <div className="space-y-2">
          {/* Linha de busca */}
          {primaryFilter && (
            <div className="flex items-center gap-2">
              <div className="flex-1">{primaryFilter}</div>
              {/* Botão Filtros */}
              {filters && (
                <button
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium transition-colors shrink-0',
                    filtersOpen
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros
                </button>
              )}
            </div>
          )}

          {/* Filtros secundários — painel colapsável */}
          {filters && (
            <div
              className={cn(
                'rounded-lg border border-border bg-card p-3 space-y-3',
                filtersOpen ? 'block' : 'hidden'
              )}
            >
              {filters}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className={cn('min-h-[200px]', isLoading && 'opacity-50 pointer-events-none')}>
        {children}
      </div>
    </div>
  )
}
