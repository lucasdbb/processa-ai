import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  success?: string
  hint?: string
  required?: boolean
}

export function FormField({
  label,
  error,
  success,
  hint,
  required,
  className,
  ...props
}: FormFieldProps) {
  const hasError = !!error
  const hasSuccess = !!success && !error

  return (
    <div className="space-y-2">
      {/* Label */}
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Input wrapper */}
      <div className="relative">
        <input
          className={cn(
            'w-full px-4 py-2.5 bg-background border rounded-lg text-sm transition-all',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            hasError && 'border-red-500 focus:ring-red-500 pr-10',
            hasSuccess && 'border-green-500 focus:ring-green-500 pr-10',
            !hasError && !hasSuccess && 'border-border focus:ring-primary focus:border-transparent',
            className
          )}
          {...props}
        />

        {/* Status icon */}
        {(hasError || hasSuccess) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {hasError && <AlertCircle className="h-5 w-5 text-red-500" />}
            {hasSuccess && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          </div>
        )}
      </div>

      {/* Error message */}
      {hasError && (
        <p className="text-sm text-red-600 dark:text-red-500 flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Success message */}
      {hasSuccess && (
        <p className="text-sm text-green-600 dark:text-green-500 flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </p>
      )}

      {/* Hint */}
      {hint && !hasError && !hasSuccess && (
        <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  success?: string
  hint?: string
  required?: boolean
}

export function FormTextarea({
  label,
  error,
  success,
  hint,
  required,
  className,
  ...props
}: FormTextareaProps) {
  const hasError = !!error
  const hasSuccess = !!success && !error

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <textarea
        className={cn(
          'w-full px-4 py-2.5 bg-background border rounded-lg text-sm transition-all resize-y',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          hasError && 'border-red-500 focus:ring-red-500',
          hasSuccess && 'border-green-500 focus:ring-green-500',
          !hasError && !hasSuccess && 'border-border focus:ring-primary focus:border-transparent',
          className
        )}
        {...props}
      />

      {hasError && (
        <p className="text-sm text-red-600 dark:text-red-500 flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {hasSuccess && (
        <p className="text-sm text-green-600 dark:text-green-500 flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </p>
      )}

      {hint && !hasError && !hasSuccess && (
        <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
