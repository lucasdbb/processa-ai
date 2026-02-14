import { Outlet } from 'react-router-dom'
import { useBillingStore } from '@/stores/billing-store'
import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function RequirePlan() {
  const { isLoading, isPro } = useBillingStore()

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isPro()) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6 max-w-lg mx-auto px-4">
        <div className="bg-slate-900/10 dark:bg-slate-100/10 p-4 rounded-full">
          <Lock className="w-12 h-12 text-slate-900 dark:text-slate-100" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Funcionalidade Exclusiva</h2>
          <p className="text-muted-foreground">
            Esta funcionalidade está disponível apenas para assinantes dos planos Autônomo ou Escritório.
          </p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => window.history.back()}>
            Voltar
          </Button>
          <Button asChild>
            <a href="/planos">Ver Planos</a>
          </Button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
