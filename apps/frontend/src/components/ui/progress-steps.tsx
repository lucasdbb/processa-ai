import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

interface Step {
  id: string
  title: string
  description?: string
  status: 'completed' | 'current' | 'upcoming'
}

interface ProgressStepsProps {
  steps: Step[]
  className?: string
}

export function ProgressSteps({ steps, className }: ProgressStepsProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1

        return (
          <div key={step.id} className="relative">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="relative shrink-0">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors',
                    step.status === 'completed' && 'bg-green-600 dark:bg-green-500 border-green-600 dark:border-green-500',
                    step.status === 'current' && 'bg-primary border-primary',
                    step.status === 'upcoming' && 'bg-muted border-border'
                  )}
                >
                  {step.status === 'completed' && (
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  )}
                  {step.status === 'current' && (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  )}
                  {step.status === 'upcoming' && (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Connecting line */}
                {!isLast && (
                  <div
                    className={cn(
                      'absolute left-5 top-10 w-0.5 h-full -ml-px',
                      step.status === 'completed' ? 'bg-green-600 dark:bg-green-500' : 'bg-border'
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-8">
                <h4
                  className={cn(
                    'text-sm font-medium mb-1',
                    step.status === 'completed' && 'text-foreground',
                    step.status === 'current' && 'text-foreground',
                    step.status === 'upcoming' && 'text-muted-foreground'
                  )}
                >
                  {step.title}
                </h4>
                {step.description && (
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
