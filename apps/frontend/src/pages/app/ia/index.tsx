import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Brain, ChevronDown, Coins, Info } from 'lucide-react'

import { useAiTools } from '@/features/ai/context'
import { useCreditsStore } from '@/stores/credits-store'
import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useOutletContext } from 'react-router-dom'
import { useTheme } from 'next-themes'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'
import { ClientSelector } from '@/components/forms/client-selector'
import { cn } from '@/lib/utils'

export default function IAHubPage() {
  const { toolId } = useParams<{ toolId?: string }>()
  const navigate = useNavigate()
  const { isLoading: isAuthLoading } = useUser()
  const { tools: aiTools, isLoading: isLoadingTools } = useAiTools()
  const { costs, fetchCosts } = useCreditsStore()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const outletContext = useOutletContext<RootLayoutOutletContext | null>()
  const openRegisterModal = outletContext?.openRegisterModal || (() => {})

  const allTools = useMemo(() => [...aiTools].sort((a, b) => a.order - b.order), [aiTools])

  // Load costs
  useEffect(() => {
    fetchCosts()
  }, [fetchCosts])

  // toolId is the URL slug, which matches the database 'key' column exactly
  const resolvedToolSlug = toolId || null

  const defaultSlug = useMemo(() => {
    return allTools.find((t) => !t.locked)?.slug || allTools[0]?.slug || ''
  }, [allTools])

  const activeSlug = resolvedToolSlug ?? defaultSlug

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  const currentTool = useMemo(() => {
    if (!activeSlug) return null
    return allTools.find((t) => t.slug === activeSlug) || null
  }, [activeSlug, allTools])

  // Reset client when changing tool if needed (optional)
  // useEffect(() => setSelectedClientId(null), [activeSlug])

  const costDisplay = useMemo(() => {
    if (!currentTool) return null

    // Map variant to feature_key used in FEATURE_COSTS
    const variantToFeatureKey: Record<string, string> = {
      chat: 'ai_chat_session',
      cnis: 'cnis_analysis',
      process_summary: 'process_summary',
      labor_claim: 'labor_claim',
      scanner: 'brief_scanner',
      prompt: 'ai_chat_session',
    }

    const featureKey = variantToFeatureKey[currentTool.variant] || 'ai_chat_session'

    const costItem = costs.find(c => c.feature_key === featureKey)
    if (costItem) return String(costItem.cost)

    // Fallbacks
    const fallbacks: Record<string, string> = {
      ai_chat_session: '3',
      cnis_analysis: '5',
      process_summary: '5',
      labor_claim: '5',
      brief_scanner: '3',
    }
    return fallbacks[featureKey] || null
  }, [currentTool, costs])

  const handleToolChange = (slug: string) => {
    navigate(`/app/ia/${slug}`, { replace: true })
  }

  const tipsButton = (
    <details className="relative">
      <summary className="cursor-pointer list-none inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background [&::-webkit-details-marker]:hidden">
        <Info className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">Dicas para melhores resultados</span>
      </summary>
      <div className="absolute right-0 sm:left-0 sm:right-auto mt-3 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-border bg-background/95 backdrop-blur-md shadow-xl p-4 z-50">
        <div className="text-sm font-bold text-foreground mb-3">Dicas para melhores resultados</div>
        <ul className="grid gap-2 text-sm text-muted-foreground">
          <li className="flex items-start">
            <span className="mr-2 text-muted-foreground/60">•</span>
            Seja específico sobre os fatos do caso, incluindo datas e valores
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-muted-foreground/60">•</span>
            Identifique claramente as partes envolvidas (requerente e requerido)
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-muted-foreground/60">•</span>
            Mencione a legislação aplicável ou jurisprudência se souber
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-muted-foreground/60">•</span>
            Use os templates sugeridos para estruturar melhor seu pedido
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-muted-foreground/60">•</span>
            Sempre revise o texto gerado por um profissional qualificado
          </li>
        </ul>
      </div>
    </details>
  )

  // Memoize the header content so it doesn't re-render on navigation
  const headerContent = useMemo(() => (
    <div className="flex items-start justify-between gap-4 flex-shrink-0">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">IA Juridica</h1>
          {tipsButton}
        </div>
        <p className="text-muted-foreground mt-1">Escolha uma ferramenta no menu lateral e comece a usar.</p>
      </div>
    </div>
  ), [tipsButton])

  if (isAuthLoading || isLoadingTools) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (toolId && !currentTool) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ferramenta não encontrada</h1>
          <p className="text-muted-foreground mt-1">Selecione uma opção no menu lateral e tente novamente.</p>
        </div>
        <button
          onClick={() => navigate('/app/ia', { replace: true })}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Voltar para IA Jurídica
        </button>
      </div>
    )
  }

  return (
    <div className="h-[calc(100dvh-220px)] lg:h-[calc(100dvh-160px)] flex flex-col gap-4">
      {headerContent}

      <div className="bg-card rounded-2xl border border-border shadow-sm p-3 sm:p-4 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 mb-4 sm:mb-5 flex-shrink-0">
          {/* Linha 1: Ícone + Seletor + Créditos + Controles */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 dark:bg-slate-800 p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-sm shrink-0 border border-slate-200 dark:border-slate-700">
              <Brain className={cn("h-5 w-5 sm:h-7 sm:w-7", isDark ? "text-slate-100" : "!text-[#0d1c34]")} strokeWidth={1.5} />
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-2.5">
              <div className="relative inline-block">
                <select
                  value={activeSlug}
                  onChange={(e) => handleToolChange(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-1.5 bg-muted border border-border rounded-lg text-base font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer max-w-[220px] sm:max-w-none truncate"
                >
                  {allTools.filter((t) => !t.locked).map((t) => (
                    <option key={t.slug} value={t.slug}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>

              {costDisplay && currentTool?.variant !== 'chat' && (
                <div className="flex items-center gap-1 px-2 py-0.5 sm:gap-1.5 sm:px-3 sm:py-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 dark:from-amber-500/25 dark:to-yellow-500/25 border border-amber-400/30 dark:border-amber-400/20 rounded-full shrink-0 shadow-sm shadow-amber-500/10">
                  <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 dark:text-amber-400 drop-shadow-sm" />
                  <span className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-300">{costDisplay}</span>
                </div>
              )}
            </div>

            {currentTool?.variant !== 'chat' && (
              <ClientSelector
                value={selectedClientId}
                onChange={(id) => setSelectedClientId(id)}
                className="hidden lg:block lg:w-60 lg:ml-auto"
                label="Cliente"
              />
            )}

          </div>

          {/* Descrição da ferramenta */}
          {currentTool?.description && (
            <p className="text-muted-foreground text-sm pl-[44px] sm:pl-[60px] mt-0.5">
              {currentTool.description}
            </p>
          )}

          {/* Linha 2: Cliente + Layout toggle mobile */}
          {currentTool?.variant !== 'chat' && (
            <div className="flex items-center gap-2 pl-0 sm:pl-[60px] lg:hidden">
              <ClientSelector
                value={selectedClientId}
                onChange={(id) => setSelectedClientId(id)}
                className="flex-1 sm:flex-none sm:w-60"
                label="Cliente"
              />

            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 relative">
          {currentTool ? (
            <currentTool.Component
              key={activeSlug}
              selectedClientId={selectedClientId}
              onOpenRegisterModal={openRegisterModal}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
