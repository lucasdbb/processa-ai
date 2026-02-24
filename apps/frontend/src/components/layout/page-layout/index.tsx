import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LayoutGrid, List } from 'lucide-react'

export type ViewMode = 'list' | 'kanban'

interface PageLayoutProps {
  title: string
  description?: string
  actions?: ReactNode
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
  filters,
  children,
  className,
  viewMode,
  onViewModeChange,
  isLoading,
}: PageLayoutProps) {
  return (
    <div className={cn('space-y-8', className)}>
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

      {/* Filters */}
      {filters && (
        <div className="flex flex-col sm:flex-row gap-3">
          {filters}
        </div>
      )}

      {/* Content */}
      <div className={cn('min-h-[200px]', isLoading && 'opacity-50 pointer-events-none')}>
        {children}
      </div>
    </div>
  )
}
