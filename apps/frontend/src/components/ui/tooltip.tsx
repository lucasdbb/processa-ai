import { HelpCircle } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  children?: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-900 dark:border-t-slate-100',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-900 dark:border-b-slate-100',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-900 dark:border-l-slate-100',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-900 dark:border-r-slate-100',
  }

  return (
    <div className="relative inline-flex items-center">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children || <HelpCircle className="h-4 w-4 text-muted-foreground" />}
      </div>

      {isVisible && (
        <div
          className={cn(
            'absolute z-50 px-3 py-2 text-sm text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 rounded-lg shadow-lg whitespace-nowrap',
            positionClasses[position]
          )}
        >
          {content}
          <div
            className={cn(
              'absolute w-0 h-0 border-4',
              arrowClasses[position]
            )}
          />
        </div>
      )}
    </div>
  )
}

interface InfoTooltipProps {
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function InfoTooltip({ content, position = 'top' }: InfoTooltipProps) {
  return (
    <Tooltip content={content} position={position}>
      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
    </Tooltip>
  )
}
