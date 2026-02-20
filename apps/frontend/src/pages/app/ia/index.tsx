import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Brain, Coins, ChevronDown, Info } from 'lucide-react'

import { useAiTools } from '@/features/ai/context'
import { useCreditsStore } from '@/stores/credits-store'
import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ClientSelector } from '@/components/forms/client-selector'
import { useOutletContext } from 'react-router-dom'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'

export default function IAHubPage() {
  const { toolId } = useParams<{ toolId?: string }>()
  const navigate = useNavigate()
  const { isLoading: isAuthLoading } = useUser()
  const { tools: aiTools, isLoading: isLoadingTools } = useAiTools()
  const { costs, fetchCosts } = useCreditsStore()
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

  const costDisplay = useMemo(() => {
    if (!currentTool) return null

    // Map variant to feature_key used in FEATURE_COSTS
    const variantToFeatureKey: Record<string, string> = {
      chat: 'ai_chat',
      cnis: 'cnis_analysis',
      process_summary: 'process_summary',
      labor_claim: 'labor_claim',
      scanner: 'brief_scanner',
      prompt: 'ai_chat',
    }

    const featureKey = variantToFeatureKey[currentTool.variant] || 'ai_chat'

    const costItem = costs.find(c => c.feature_key === featureKey)
    if (costItem) return costItem.cost === 1 ? '1 crédito' : `${costItem.cost} créditos`

    // Fallbacks
    const fallbacks: Record<string, string> = {
      ai_chat: '1 crédito',
      cnis_analysis: '5 créditos',
      process_summary: '5 créditos',
      labor_claim: '5 créditos',
      brief_scanner: '3 créditos',
    }
    return fallbacks[featureKey] || null
  }, [currentTool, costs])

  if (isAuthLoading || isLoadingTools) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  const tipsButton = (
    <details className="relative z-[60]">
      <summary className="cursor-pointer list-none inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background [&::-webkit-details-marker]:hidden">
        <Info className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">Dicas para melhores resultados</span>
      </summary>
      <div className="absolute left-0 mt-3 w-[320px] rounded-2xl border border-border bg-background/95 backdrop-blur-md shadow-xl p-4 z-[70]">
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

  if (toolId && !currentTool) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ferramenta não encontrada</h1>
          <p className="text-muted-foreground mt-1">Selecione uma opção no menu lateral e tente novamente.</p>
        </div>
        <button
          onClick={() => navigate('/app/ia')}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Voltar para IA Jurídica
        </button>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">IA Juridica</h1>
            {tipsButton}
          </div>
          <p className="text-muted-foreground mt-1">Escolha uma ferramenta no menu lateral e comece a usar.</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm p-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-4 mb-4 flex-shrink-0">
          <div className="flex items-center space-x-4 min-w-0">
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl shadow-sm shrink-0 border border-slate-200 dark:border-slate-700">
              <Brain className="h-6 w-6 text-slate-900 dark:text-slate-100" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <select
                    value={activeSlug}
                    onChange={(e) => navigate(`/app/ia/${e.target.value}`)}
                    className="appearance-none pl-3 pr-8 py-1.5 bg-muted border border-border rounded-lg text-base font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    {allTools.filter((t) => !t.locked).map((t) => (
                      <option key={t.slug} value={t.slug}>{t.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                {costDisplay && (
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-xs font-medium text-yellow-600 dark:text-yellow-500">
                    <Coins className="w-3.5 h-3.5" />
                    <span>{costDisplay}</span>
                  </div>
                )}
              </div>
              {currentTool?.description ? <p className="text-muted-foreground mt-1 text-sm">{currentTool.description}</p> : null}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative">
          {currentTool ? (
            <currentTool.Component
              key={activeSlug}
              selectedClientId={selectedClientId}
              onClientChange={setSelectedClientId}
              onOpenRegisterModal={openRegisterModal}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
