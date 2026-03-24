import { TourProvider as ReactourProvider, useTour } from '@reactour/tour'
import { useOnboardingStore } from './store'
import { TOURS } from './tours'
import { useEffect } from 'react'
import { useSidebarStore } from '@/stores/sidebar-store'

interface TourWrapperProps {
  children: React.ReactNode
}

let previousSidebarExpanded: boolean | null = null

const ensureSidebarExpandedForTour = (tourId: string) => {
  if (tourId !== 'dashboard' && tourId !== 'calculators' && tourId !== 'ai-tools') {
    return
  }

  const sidebarStore = useSidebarStore.getState()
  if (previousSidebarExpanded === null) {
    previousSidebarExpanded = sidebarStore.isExpanded
  }

  if (!sidebarStore.isExpanded) {
    sidebarStore.setExpanded(true)
  }
}

const restoreSidebarState = () => {
  if (previousSidebarExpanded === null) {
    return
  }

  useSidebarStore.getState().setExpanded(previousSidebarExpanded)
  previousSidebarExpanded = null
}

function TourContent({ children }: TourWrapperProps) {
  const { currentTour, isOpen } = useOnboardingStore()
  const { setIsOpen, setSteps, setCurrentStep } = useTour()

  const getSafeSteps = (tourId: string) => {
    const tour = TOURS[tourId]
    if (!tour) return []

    return tour.steps.map((step) => {
      if (step.selector === 'body') {
        return step
      }

      const exists = typeof document !== 'undefined' && document.querySelector(step.selector)
      return exists ? step : { ...step, selector: 'body' }
    })
  }

  useEffect(() => {
    let timeoutId: number | undefined

    if (currentTour && isOpen) {
      ensureSidebarExpandedForTour(currentTour)

      timeoutId = window.setTimeout(() => {
        const steps = getSafeSteps(currentTour)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSteps?.(steps as any)
        setCurrentStep(0)
        setIsOpen(true)
      }, 120)
    } else {
      setIsOpen(false)
      restoreSidebarState()
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [currentTour, isOpen, setIsOpen, setSteps, setCurrentStep])

  return <>{children}</>
}

export function TourProvider({ children }: TourWrapperProps) {
  return (
    <ReactourProvider
      steps={[]}
      styles={{
        popover: (base) => ({
          ...base,
          backgroundColor: 'hsl(var(--card))',
          color: 'hsl(var(--foreground))',
          borderRadius: '0.75rem',
          border: '1px solid hsl(var(--border))',
          padding: '1.5rem',
          maxWidth: '400px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }),
        maskWrapper: (base) => ({
          ...base,
          zIndex: 9998,
        }),
        maskArea: (base) => ({
          ...base,
          rx: 8,
        }),
        badge: (base) => ({
          ...base,
          backgroundColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
        }),
        controls: (base) => ({
          ...base,
          marginTop: '1rem',
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'flex-end',
        }),
        close: (base) => ({
          ...base,
          color: 'hsl(var(--muted-foreground))',
          right: '0.75rem',
          top: '0.75rem',
          width: '1.25rem',
          height: '1.25rem',
        }),
      }}
      padding={{ mask: 10, popover: [10, 10] }}
      onClickMask={({ setIsOpen }) => {
        const { closeTour } = useOnboardingStore.getState()
        closeTour()
        restoreSidebarState()
        setIsOpen(false)
      }}
      beforeClose={() => {
        const { closeTour } = useOnboardingStore.getState()
        closeTour()
        restoreSidebarState()
      }}
      showNavigation={true}
      showBadge={true}
      showCloseButton={true}
      prevButton={({ currentStep, setCurrentStep }) =>
        currentStep > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setCurrentStep(currentStep - 1)
            }}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Anterior
          </button>
        ) : null
      }
      nextButton={({ currentStep, setCurrentStep, steps, setIsOpen }) => {
        const isLast = currentStep === (steps?.length || 0) - 1
        const { currentTour, completeTour, closeTour } = useOnboardingStore.getState()

        return (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (isLast) {
                if (currentTour) {
                  completeTour(currentTour)
                }
                closeTour()
                restoreSidebarState()
                setIsOpen(false)
              } else {
                setCurrentStep(currentStep + 1)
              }
            }}
            className="px-4 py-2 text-sm font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            {isLast ? 'Concluir' : 'Próximo'}
          </button>
        )
      }}
    >
      <TourContent>{children}</TourContent>
    </ReactourProvider>
  )
}
