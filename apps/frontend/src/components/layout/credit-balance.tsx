import { useEffect } from 'react'
import { useCreditsStore } from '@/stores/credits-store'
import { Coins, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/stores/sidebar-store'

export function CreditBalance() {
  const { credits, fetchCredits, isLoading } = useCreditsStore()
  const { isExpanded } = useSidebarStore()

  useEffect(() => {
    fetchCredits()
  }, [fetchCredits])

  if (!credits) return null

  return (
    <div className={cn("px-3 mb-2", !isExpanded && "px-2")}>
      <Link 
        to="/app/creditos" 
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 transition-colors group",
          !isExpanded && "justify-center p-2"
        )}
        title={!isExpanded ? `Créditos: ${credits.total_available}` : undefined}
      >
        <div className="relative">
          <Coins className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
          {isLoading && (
            <div className="absolute -top-1 -right-1">
               <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
            </div>
          )}
        </div>
        
        {isExpanded && (
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Seu Saldo
            </p>
            <p className="text-sm font-bold text-foreground flex items-center gap-1">
              {isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                credits.total_available
              )}
              <span className="text-xs font-normal text-muted-foreground">créditos</span>
            </p>
          </div>
        )}
      </Link>
    </div>
  )
}
