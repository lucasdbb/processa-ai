import { Sparkles, ArrowRight, X } from 'lucide-react'
import { useState } from 'react'
import { useUser } from '@/features/auth/hooks/use-user'
import { useOnboardingStore } from '@/features/onboarding/store'
import { Button } from '@/components/ui/button'

export function WelcomeCard() {
  const { user } = useUser()
  const { openWelcomeModal } = useOnboardingStore()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || !user || user.welcome_credits_claimed !== false) return null

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-orange-500/5 p-5 sm:p-6">
      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 shrink-0">
          <Sparkles className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            Bem-vindo ao Processa AI!
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Complete seu perfil para liberar{' '}
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              10 créditos gratuitos
            </span>{' '}
            de inteligência artificial.
          </p>
        </div>

        {/* CTA */}
        <Button
          onClick={openWelcomeModal}
          className="shrink-0 gap-2"
        >
          Completar perfil
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
