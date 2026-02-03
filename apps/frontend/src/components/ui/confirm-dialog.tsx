import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info' | 'success'
  isLoading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const icons = {
    danger: XCircle,
    warning: AlertTriangle,
    info: Info,
    success: CheckCircle2,
  }

  const Icon = icons[variant]

  const colors = {
    danger: 'text-red-600 dark:text-red-500',
    warning: 'text-amber-600 dark:text-amber-500',
    info: 'text-blue-600 dark:text-blue-500',
    success: 'text-green-600 dark:text-green-500',
  }

  const buttonColors = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    info: 'bg-blue-600 hover:bg-blue-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Dialog */}
      <div className="relative bg-background border border-border rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4">
        {/* Icon */}
        <div className={cn('w-12 h-12 rounded-full bg-muted flex items-center justify-center', colors[variant])}>
          <Icon className="h-6 w-6" />
        </div>

        {/* Content */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed',
              buttonColors[variant]
            )}
          >
            {isLoading ? 'Processando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
