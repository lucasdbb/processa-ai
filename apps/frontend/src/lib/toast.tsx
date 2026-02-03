import { toast as sonnerToast } from 'sonner'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastOptions {
  description?: string
  action?: ToastAction
  duration?: number
}

export const toast = {
  success: (message: string, options?: ToastOptions) => {
    return sonnerToast.custom(
      (t) => (
        <div className="flex items-start gap-3 p-4 bg-background border border-border rounded-lg shadow-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-foreground">{message}</p>
            {options?.description && (
              <p className="text-sm text-muted-foreground">{options.description}</p>
            )}
            {options?.action && (
              <button
                onClick={() => {
                  options.action?.onClick()
                  sonnerToast.dismiss(t)
                }}
                className="text-sm font-medium text-green-600 dark:text-green-500 hover:underline"
              >
                {options.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => sonnerToast.dismiss(t)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ),
      { duration: options?.duration || 4000 }
    )
  },

  error: (message: string, options?: ToastOptions) => {
    return sonnerToast.custom(
      (t) => (
        <div className="flex items-start gap-3 p-4 bg-background border border-border rounded-lg shadow-lg">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-foreground">{message}</p>
            {options?.description && (
              <p className="text-sm text-muted-foreground">{options.description}</p>
            )}
            {options?.action && (
              <button
                onClick={() => {
                  options.action?.onClick()
                  sonnerToast.dismiss(t)
                }}
                className="text-sm font-medium text-red-600 dark:text-red-500 hover:underline"
              >
                {options.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => sonnerToast.dismiss(t)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ),
      { duration: options?.duration || 5000 }
    )
  },

  warning: (message: string, options?: ToastOptions) => {
    return sonnerToast.custom(
      (t) => (
        <div className="flex items-start gap-3 p-4 bg-background border border-border rounded-lg shadow-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-foreground">{message}</p>
            {options?.description && (
              <p className="text-sm text-muted-foreground">{options.description}</p>
            )}
            {options?.action && (
              <button
                onClick={() => {
                  options.action?.onClick()
                  sonnerToast.dismiss(t)
                }}
                className="text-sm font-medium text-amber-600 dark:text-amber-500 hover:underline"
              >
                {options.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => sonnerToast.dismiss(t)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ),
      { duration: options?.duration || 4500 }
    )
  },

  info: (message: string, options?: ToastOptions) => {
    return sonnerToast.custom(
      (t) => (
        <div className="flex items-start gap-3 p-4 bg-background border border-border rounded-lg shadow-lg">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-500 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-foreground">{message}</p>
            {options?.description && (
              <p className="text-sm text-muted-foreground">{options.description}</p>
            )}
            {options?.action && (
              <button
                onClick={() => {
                  options.action?.onClick()
                  sonnerToast.dismiss(t)
                }}
                className="text-sm font-medium text-blue-600 dark:text-blue-500 hover:underline"
              >
                {options.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => sonnerToast.dismiss(t)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ),
      { duration: options?.duration || 4000 }
    )
  },

  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
}
