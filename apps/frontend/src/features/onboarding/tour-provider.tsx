import {
  ACTIONS,
  EVENTS,
  Joyride,
  STATUS,
  type EventData,
  type Step,
  type TooltipRenderProps,
} from 'react-joyride'
import { useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useSidebarStore } from '@/stores/sidebar-store'
import { useOnboardingStore } from './store'
import { TOURS } from '@/features/onboarding/tours'
import type { TourId } from './types'

interface TourWrapperProps {
  children: React.ReactNode
}

const TOUR_STEP_EVENT = 'processa:onboarding-step'
const TARGET_RETRY_MAX = 3
const TARGET_RETRY_DELAY_MS = 180

let previousSidebarExpanded: boolean | null = null

const toursThatNeedSidebarExpanded = new Set<TourId>(['dashboard', 'calculators', 'ai-tools'])

const ensureSidebarExpandedForTour = (tourId: TourId) => {
  if (!toursThatNeedSidebarExpanded.has(tourId)) {
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

const getSafeSteps = (tourId: TourId): Step[] => {
  const tour = TOURS[tourId]
  if (!tour) {
    return []
  }

  return tour.steps.map((step) => {
    const target = step.selector === 'body' ? 'body' : step.selector

    return {
      target,
      content: step.content,
      placement: step.placement ?? (target === 'body' ? 'center' : 'auto'),
      disableBeacon: true,
      spotlightPadding: step.spotlightPadding ?? 8,
      offset: step.offset ?? 12,
    }
  })
}

const emitTourStep = (selector: string | null) => {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<{ selector: string | null }>(TOUR_STEP_EVENT, {
      detail: { selector },
    }),
  )
}

function TourTooltip({
  backProps,
  closeProps,
  index,
  isLastStep,
  primaryProps,
  size,
  skipProps,
  step,
  tooltipProps,
}: TooltipRenderProps) {
  const showBack = step.buttons.includes('back') && index > 0
  const showSkip = step.buttons.includes('skip') && !isLastStep
  const showPrimary = step.buttons.includes('primary')
  const primaryLabel = isLastStep ? 'Concluir' : 'Próximo'

  return (
    <div
      {...tooltipProps}
      className="w-[min(92vw,30rem)] overflow-hidden rounded-2xl border border-border/90 bg-card text-foreground shadow-[0_28px_70px_rgba(2,6,23,0.28)]"
    >
      <div className="border-b border-border/80 bg-gradient-to-r from-muted/50 to-muted/15 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            Missão guiada
          </span>
          <button
            type="button"
            {...closeProps}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm font-medium text-foreground/90">
          Passo {index + 1} de {size}
        </p>
      </div>

      <div className="px-5 py-4 text-[0.97rem] leading-7 text-muted-foreground [&_h3]:mb-2 [&_h3]:text-[1.08rem] [&_h3]:font-semibold [&_h3]:leading-6 [&_h3]:text-foreground [&_p]:m-0 [&_p]:text-[0.96rem] [&_p]:leading-7 [&_p]:text-muted-foreground [&_p+p]:mt-2">
        {step.content}
      </div>

      <div className="flex items-center gap-2 border-t border-border/80 bg-muted/25 px-4 py-3">
        <div className="mr-auto">
          {showSkip ? (
            <button
              type="button"
              {...skipProps}
              className="rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Pular
            </button>
          ) : null}
        </div>

        {showBack ? (
          <button
            type="button"
            {...backProps}
            className="rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Anterior
          </button>
        ) : null}

        {showPrimary ? (
          <button
            type="button"
            {...primaryProps}
            className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {primaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function TourProvider({ children }: TourWrapperProps) {
  const { currentTour, isOpen, completeTour, closeTour } = useOnboardingStore()
  const [run, setRun] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const targetRetriesRef = useRef<Record<number, number>>({})

  const stopTour = () => {
    setRun(false)
    setStepIndex(0)
    setSteps([])
    targetRetriesRef.current = {}
    emitTourStep(null)
    closeTour()
    restoreSidebarState()
  }

  useEffect(() => {
    let timeoutId: number | undefined

    if (currentTour && isOpen) {
      ensureSidebarExpandedForTour(currentTour)

      timeoutId = window.setTimeout(() => {
        targetRetriesRef.current = {}
        setSteps(getSafeSteps(currentTour))
        setStepIndex(0)
        setRun(true)
      }, 120)
    } else {
      setRun(false)
      setStepIndex(0)
      setSteps([])
      emitTourStep(null)
      restoreSidebarState()
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [currentTour, isOpen])

  const handleJoyrideCallback = (data: EventData) => {
    const { action, index, status, type } = data

    if (currentTour && type === EVENTS.STEP_BEFORE) {
      targetRetriesRef.current[index] = 0
      const step = TOURS[currentTour]?.steps[index]
      emitTourStep(step?.selector ?? null)
      step?.action?.()
    }

    if (type === EVENTS.TARGET_NOT_FOUND) {
      if (currentTour) {
        TOURS[currentTour]?.steps[index]?.action?.()
      }

      const retries = targetRetriesRef.current[index] ?? 0
      if (retries < TARGET_RETRY_MAX) {
        targetRetriesRef.current[index] = retries + 1
        window.setTimeout(() => {
          setStepIndex(index)
        }, TARGET_RETRY_DELAY_MS)
        return
      }

      targetRetriesRef.current[index] = 0
      if (index >= steps.length - 1) {
        if (currentTour) {
          completeTour(currentTour)
        }
        stopTour()
      } else {
        setStepIndex(index + 1)
      }
      return
    }

    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.PREV) {
        setStepIndex(Math.max(index - 1, 0))
      } else {
        setStepIndex(index + 1)
      }
      return
    }

    if (status === STATUS.FINISHED) {
      if (currentTour) {
        completeTour(currentTour)
      }
      stopTour()
      return
    }

    if (status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
      if (currentTour) {
        completeTour(currentTour)
      }
      stopTour()
    }
  }

  return (
    <>
      <Joyride
        run={run}
        stepIndex={stepIndex}
        steps={steps}
        onEvent={handleJoyrideCallback}
        tooltipComponent={TourTooltip}
        continuous
        scrollToFirstStep
        options={{
          zIndex: 9999,
          backgroundColor: 'hsl(var(--popover))',
          textColor: 'hsl(var(--foreground))',
          primaryColor: 'hsl(var(--primary))',
          arrowColor: 'hsl(var(--popover))',
          overlayColor: 'rgba(2, 6, 23, 0.78)',
          buttons: ['back', 'close', 'primary', 'skip'],
          showProgress: true,
          overlayClickAction: false,
          dismissKeyAction: 'close',
        }}
        locale={{
          back: 'Anterior',
          close: 'Fechar',
          last: 'Concluir',
          next: 'Próximo',
          skip: 'Pular',
        }}
        styles={{
          floater: {
            filter: 'drop-shadow(0 10px 25px rgba(2, 6, 23, 0.25))',
          },
          overlay: {
            backgroundColor: 'rgba(2, 6, 23, 0.78)',
          },
          spotlight: {
            stroke: 'hsl(var(--primary) / 0.55)',
            strokeWidth: 2,
          },
          tooltip: {
            padding: 0,
          },
          tooltipContainer: {
            maxWidth: 460,
          },
          tooltipContent: {
            padding: 0,
          },
          tooltipFooter: {
            padding: 0,
          },
        }}
      />
      {children}
    </>
  )
}
