import { Dialog, DialogContent } from '@/components/ui/dialog'
import { CheckCircle2, ArrowRight, Plus, Eye } from 'lucide-react'

interface SuccessAction {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  variant?: 'primary' | 'secondary'
}

interface SuccessActionDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  actions: SuccessAction[]
}

export function SuccessActionDialog({
  isOpen,
  onClose,
  title,
  description,
  actions,
}: SuccessActionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col items-center text-center py-4">
          {/* Success Icon */}
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>

          {/* Description */}
          {description && (
            <p className="text-sm text-muted-foreground mb-6">{description}</p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 w-full">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  action.onClick()
                  onClose()
                }}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  action.variant === 'primary' || index === 0
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {action.icon}
                {action.label}
                {(action.variant === 'primary' || index === 0) && (
                  <ArrowRight className="h-4 w-4 ml-1" />
                )}
              </button>
            ))}

            {/* Close button */}
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Helper components for common use cases
export function ClientCreatedDialog({
  isOpen,
  onClose,
  clientName,
  onViewClient,
  onCreateProcess,
}: {
  isOpen: boolean
  onClose: () => void
  clientName: string
  onViewClient: () => void
  onCreateProcess: () => void
}) {
  return (
    <SuccessActionDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Cliente cadastrado!"
      description={`${clientName} foi adicionado com sucesso.`}
      actions={[
        {
          label: 'Cadastrar processo',
          onClick: onCreateProcess,
          icon: <Plus className="h-4 w-4" />,
          variant: 'primary',
        },
        {
          label: 'Ver cliente',
          onClick: onViewClient,
          icon: <Eye className="h-4 w-4" />,
          variant: 'secondary',
        },
      ]}
    />
  )
}

export function ProcessCreatedDialog({
  isOpen,
  onClose,
  processNumber,
  onViewProcess,
  onCreateDeadline,
}: {
  isOpen: boolean
  onClose: () => void
  processNumber: string
  onViewProcess: () => void
  onCreateDeadline: () => void
}) {
  return (
    <SuccessActionDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Processo cadastrado!"
      description={`Processo ${processNumber} foi adicionado com sucesso.`}
      actions={[
        {
          label: 'Cadastrar prazo',
          onClick: onCreateDeadline,
          icon: <Plus className="h-4 w-4" />,
          variant: 'primary',
        },
        {
          label: 'Ver processo',
          onClick: onViewProcess,
          icon: <Eye className="h-4 w-4" />,
          variant: 'secondary',
        },
      ]}
    />
  )
}
