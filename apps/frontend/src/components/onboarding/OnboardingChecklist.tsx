import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Circle,
  Lock,
  Rocket,
  UserPlus,
  Users,
  FolderKanban,
  CalendarClock,
  Brain,
  Calculator,
  ArrowRight,
  Gift,
} from 'lucide-react'
import { toast } from 'sonner'
import { useUser } from '@/features/auth/hooks/use-user'
import { useOnboardingStore } from '@/features/onboarding/store'
import { useBillingStore } from '@/stores/billing-store'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { useCreditsStore } from '@/stores/credits-store'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { creditsService } from '@/services/credits-service'

interface ChecklistItem {
  id: string
  label: string
  completed: boolean
  locked: boolean
  href: string
  icon: typeof Circle
}

const CHECKLIST_ITEM_LABELS: Record<string, string> = {
  account: 'Criar conta',
  profile: 'Completar perfil',
  client: 'Cadastrar primeiro cliente',
  process: 'Adicionar primeiro processo',
  deadline: 'Criar primeiro prazo',
  ai: 'Experimentar ferramenta de IA',
  calculator: 'Experimentar calculadora',
}

function useChecklistItems() {
  const { user } = useUser()
  const { hasUsedAiTool, hasUsedCalculator } = useOnboardingStore()
  const { isPro } = useBillingStore()
  const { stats } = useDashboardData()

  const isProUser = isPro()

  const items: ChecklistItem[] = [
    {
      id: 'account',
      label: 'Criar conta',
      completed: true,
      locked: false,
      href: '#',
      icon: UserPlus,
    },
    {
      id: 'profile',
      label: 'Completar perfil',
      completed: !!user?.welcome_credits_claimed,
      locked: false,
      href: '#open-welcome-modal',
      icon: UserPlus,
    },
    {
      id: 'client',
      label: 'Cadastrar primeiro cliente',
      completed: isProUser && (stats?.total_clients ?? 0) > 0,
      locked: !isProUser,
      href: isProUser ? '/app/clientes' : '/planos',
      icon: Users,
    },
    {
      id: 'process',
      label: 'Adicionar primeiro processo',
      completed: isProUser && (stats?.active_processes ?? 0) > 0,
      locked: !isProUser,
      href: isProUser ? '/app/processos' : '/planos',
      icon: FolderKanban,
    },
    {
      id: 'deadline',
      label: 'Criar primeiro prazo',
      completed: isProUser && (stats?.total_deadlines ?? 0) > 0,
      locked: !isProUser,
      href: isProUser ? '/app/calendario' : '/planos',
      icon: CalendarClock,
    },
    {
      id: 'ai',
      label: 'Experimentar ferramenta de IA',
      completed: hasUsedAiTool,
      locked: false,
      href: '/app/ia',
      icon: Brain,
    },
    {
      id: 'calculator',
      label: 'Experimentar calculadora',
      completed: hasUsedCalculator,
      locked: false,
      href: '/app/calculadoras',
      icon: Calculator,
    },
  ]

  const applicableItems = items.filter((i) => !i.locked)
  const completedCount = applicableItems.filter((i) => i.completed).length
  const totalApplicable = applicableItems.length
  const progressPercent = totalApplicable > 0 ? Math.round((completedCount / totalApplicable) * 100) : 0

  return { items, completedCount, totalApplicable, progressPercent }
}

export function OnboardingProgress() {
  const [isOpen, setIsOpen] = useState(false)
  const { isChecklistDismissed, dismissChecklist, hasClaimedChecklistBonus, claimChecklistBonus, openWelcomeModal } = useOnboardingStore()
  const { fetchCredits } = useCreditsStore()
  const { items, completedCount, totalApplicable, progressPercent } = useChecklistItems()
  const prevCompletedRef = useRef<Set<string>>(new Set())
  const [isClaimingBonus, setIsClaimingBonus] = useState(false)

  // Track completed items and show toast on new completions
  useEffect(() => {
    const currentCompleted = new Set(
      items.filter((i) => i.completed && !i.locked).map((i) => i.id)
    )

    // Only show toasts after initial load (prevRef is populated)
    if (prevCompletedRef.current.size > 0) {
      for (const id of currentCompleted) {
        if (!prevCompletedRef.current.has(id)) {
          const label = CHECKLIST_ITEM_LABELS[id]
          if (label) {
            toast.success(`${label}`, {
              description: 'Item do checklist concluído!',
              duration: 3000,
            })
          }
        }
      }
    }

    prevCompletedRef.current = currentCompleted
  }, [items])

  // Check if all items complete → offer bonus
  const allComplete = completedCount === totalApplicable && totalApplicable > 0
  const showBonusOffer = allComplete && !hasClaimedChecklistBonus && !isChecklistDismissed

  const handleClaimBonus = async () => {
    setIsClaimingBonus(true)
    try {
      const result = await creditsService.claimChecklistBonus()
      if (result.success) {
        claimChecklistBonus()
        fetchCredits()
        toast.success('Parabéns! Você ganhou 5 créditos bônus!', {
          description: 'Todos os itens do checklist foram concluídos.',
          duration: 5000,
        })
        setIsOpen(false)
      }
    } catch {
      toast.error('Erro ao resgatar bônus. Tente novamente.')
    } finally {
      setIsClaimingBonus(false)
    }
  }

  if (isChecklistDismissed || (allComplete && hasClaimedChecklistBonus)) {
    return null
  }

  const handleItemClick = (item: ChecklistItem) => {
    if (item.href === '#open-welcome-modal') {
      setIsOpen(false)
      openWelcomeModal()
      return
    }
    setIsOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-2.5 px-4 py-2 border border-border rounded-lg text-sm font-medium transition-colors group",
          showBonusOffer
            ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20"
            : "bg-muted hover:bg-muted/80"
        )}
      >
        {showBonusOffer ? (
          <Gift className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        ) : (
          <Rocket className="h-4 w-4 text-foreground" />
        )}
        <span className="hidden sm:inline text-foreground">
          {showBonusOffer ? 'Resgatar bônus!' : 'Primeiros Passos'}
        </span>
        <span className="text-xs text-muted-foreground">{completedCount}/{totalApplicable}</span>
        <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              showBonusOffer ? "bg-amber-500" : "bg-slate-900 dark:bg-slate-100"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Primeiros Passos
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {completedCount}/{totalApplicable}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Progress bar */}
          <div className="px-5 pt-3">
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  allComplete ? "bg-green-500" : "bg-slate-900 dark:bg-slate-100"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {allComplete ? 'Concluído!' : `${progressPercent}% completo`}
            </p>
          </div>

          {/* Bonus banner */}
          {showBonusOffer && (
            <div className="mx-5 mt-3 p-3 rounded-xl border-2 border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 shrink-0">
                  <Gift className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Parabéns! Checklist completo!</p>
                  <p className="text-xs text-muted-foreground">Resgate 5 créditos bônus como recompensa.</p>
                </div>
              </div>
              <button
                onClick={handleClaimBonus}
                disabled={isClaimingBonus}
                className="mt-3 w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isClaimingBonus ? 'Resgatando...' : 'Resgatar 5 créditos bônus'}
              </button>
            </div>
          )}

          {/* Items */}
          <div className="px-3 py-3 space-y-0.5">
            {items.map((item) => {
              const Icon = item.icon

              if (item.locked) {
                return (
                  <Link
                    key={item.id}
                    to="/planos"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors group"
                  >
                    <Lock className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    <span className="text-sm flex-1">{item.label}</span>
                    <span className="text-xs text-muted-foreground/70 hidden sm:inline">
                      Plano Aut.
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                )
              }

              if (item.completed) {
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-lg"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
                    <Icon className="h-4 w-4 shrink-0 text-green-600/60 dark:text-green-500/60" />
                    <span className="text-sm text-muted-foreground line-through">{item.label}</span>
                  </div>
                )
              }

              if (item.href === '#open-welcome-modal') {
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors group hover:bg-muted/50 text-foreground w-full text-left"
                  >
                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm flex-1">{item.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                )
              }

              return (
                <Link
                  key={item.id}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors group',
                    'hover:bg-muted/50 text-foreground'
                  )}
                >
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm flex-1">{item.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-5 pb-4 pt-1">
            <button
              onClick={() => {
                dismissChecklist()
                setIsOpen(false)
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Dispensar checklist
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
