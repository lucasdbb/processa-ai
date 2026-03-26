import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Brain, BookOpen, ChevronDown, ChevronRight, Coins, FileText, Globe, GraduationCap, Info, Layers, Type } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { useAiTools } from '@/features/ai/context'
import { useCreditsStore } from '@/stores/credits-store'
import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useOutletContext } from 'react-router-dom'
import { useTheme } from 'next-themes'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'
import { ClientSelector } from '@/components/forms/client-selector'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { cn } from '@/lib/utils'

// ── Knowledge base types ────────────────────────────────

interface KbDocument {
  id: string
  filename: string
  original_filename: string
  document_type: string
  status: string
  total_chunks: number
  area_id: string | null
  area_name: string | null
  topic_id: string | null
  topic_name: string | null
}

interface KbDocumentsResponse {
  documents: KbDocument[]
  total: number
}

interface KnowledgeArea {
  name: string
  documents: { name: string; chunks: number; type: string }[]
}

const DOC_TYPE_CONFIG: Record<string, { icon: typeof FileText; label: string }> = {
  pdf: { icon: FileText, label: 'PDF' },
  url: { icon: Globe, label: 'Web' },
  texto: { icon: Type, label: 'Texto' },
}

// ── Knowledge dropdown ──────────────────────────────────

function KnowledgeDropdown() {
  const [open, setOpen] = useState(false)
  const [expandedArea, setExpandedArea] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery<KbDocumentsResponse>({
    queryKey: ['knowledge-base-documents'],
    queryFn: async () => {
      const res = await fetchWithCredentials(`${API_URL}/ai/knowledge-base/documents?status=ready`)
      if (!res.ok) throw new Error('Erro ao carregar competências')
      return res.json()
    },
    staleTime: 10 * 60 * 1000,
  })

  // Group documents by area_name
  const areas = useMemo<KnowledgeArea[]>(() => {
    if (!data) return []
    const map = new Map<string, { name: string; chunks: number; type: string }[]>()
    for (const doc of data.documents) {
      const areaName = doc.area_name || 'Geral'
      const list = map.get(areaName) || []
      list.push({ name: doc.filename, chunks: doc.total_chunks, type: doc.document_type })
      map.set(areaName, list)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, documents]) => ({ name, documents }))
  }, [data])

  // Stats (Accomplishment drive)
  const stats = useMemo(() => {
    if (!data) return { totalDocs: 0, totalChunks: 0 }
    const totalDocs = data.documents.length
    const totalChunks = data.documents.reduce((sum, d) => sum + d.total_chunks, 0)
    return { totalDocs, totalChunks }
  }, [data])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const areaCount = areas.length

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
          open
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'bg-muted/50 border-input text-foreground hover:bg-muted',
        )}
      >
        <GraduationCap className="h-4 w-4" />
        <span className="hidden sm:inline">Meu conhecimento</span>
        {areaCount > 0 && (
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-primary/15 text-primary text-[11px] font-bold">
            {areaCount}
          </span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[400px] overflow-y-auto rounded-xl border border-border bg-popover shadow-xl z-50">
          {/* Header com stats — Accomplishment + Ownership */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Meu conhecimento</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Áreas e tópicos que domino para te ajudar.
            </p>
            {stats.totalDocs > 0 && (
              <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-primary/60" />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{areaCount}</span> área{areaCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary/60" />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{stats.totalDocs}</span> fonte{stats.totalDocs !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary/60" />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{stats.totalChunks.toLocaleString('pt-BR')}</span> trecho{stats.totalChunks !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          {areas.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma competência cadastrada.
            </div>
          ) : (
            <div className="p-1.5">
              {areas.map((area) => {
                const isExpanded = expandedArea === area.name
                const areaChunks = area.documents.reduce((sum, d) => sum + d.chunks, 0)

                return (
                  <div key={area.name}>
                    <button
                      type="button"
                      onClick={() => setExpandedArea(isExpanded ? null : area.name)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-left',
                        isExpanded
                          ? 'bg-primary/10 text-foreground'
                          : 'text-foreground hover:bg-muted/60',
                      )}
                    >
                      <ChevronRight className={cn(
                        'h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0',
                        isExpanded && 'rotate-90',
                      )} />
                      <span className="font-medium flex-1">{area.name}</span>
                      <span className="text-[11px] text-muted-foreground/60">
                        {area.documents.length} fonte{area.documents.length !== 1 ? 's' : ''} · {areaChunks.toLocaleString('pt-BR')} trecho{areaChunks !== 1 ? 's' : ''}
                      </span>
                    </button>

                    {isExpanded && (
                      <ul className="ml-9 mr-3 mb-2 space-y-0.5">
                        {area.documents.map((doc) => {
                          const typeConfig = DOC_TYPE_CONFIG[doc.type] || DOC_TYPE_CONFIG.texto
                          const DocIcon = typeConfig.icon

                          return (
                            <li
                              key={doc.name}
                              className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground"
                            >
                              <DocIcon className="h-3 w-3 text-primary/50 flex-shrink-0" />
                              <span className="flex-1 truncate">{doc.name}</span>
                              <span className="text-[10px] text-muted-foreground/40 tabular-nums flex-shrink-0">
                                {doc.chunks.toLocaleString('pt-BR')}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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

            {currentTool?.variant === 'chat' ? (
              <div className="hidden lg:block lg:ml-auto">
                <KnowledgeDropdown />
              </div>
            ) : (
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

          {/* Linha 2: Cliente ou Conhecimento (mobile) */}
          {currentTool?.variant === 'chat' ? (
            <div className="flex items-center gap-2 pl-0 sm:pl-[60px] lg:hidden">
              <KnowledgeDropdown />
            </div>
          ) : (
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
