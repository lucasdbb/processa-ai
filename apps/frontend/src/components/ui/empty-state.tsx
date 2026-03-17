import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('bg-card border border-border rounded-xl p-12 text-center flex flex-col items-center justify-center', className)}>
      {/* Icon */}
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>

      {/* Description */}
      <p className="text-muted-foreground text-sm mb-6 max-w-md">
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {action && (
            <Button onClick={action.onClick} variant="default">
              {action.label}
            </Button>
          )}

          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="secondary">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
