import { Play } from 'lucide-react'
import { useOnboardingStore } from './store'
import type { TourId } from './types'

interface TourButtonProps {
  tourId: TourId
  label?: string
  className?: string
  forceShow?: boolean
}

export function TourButton({ tourId, label = 'Iniciar Tour', className, forceShow }: TourButtonProps) {
  const { startTour, hasCompletedTour } = useOnboardingStore()

  // Don't show if tour is already completed, unless forced
  if (hasCompletedTour(tourId) && !forceShow) {
    return null
  }

  return (
    <button
      onClick={() => startTour(tourId, { force: !!forceShow })}
      className={
        className ||
        'flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-sm font-medium transition-colors'
      }
    >
      <Play className="h-4 w-4" />
      {label}
    </button>
  )
}
