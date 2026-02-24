
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Calculator, ArrowRight, Loader2, Coins, ChevronDown, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCalculators } from '@/features/calculators/context'
import { useCreditsStore } from '@/stores/credits-store'
import { ClientSelector } from '@/components/forms/client-selector'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from 'next-themes'

import { RescisaoCalculator } from '@/features/calculators/components/rescisao-calculator'
import { AposentadoriaCalculator } from '@/features/calculators/components/aposentadoria-calculator'

// Category mapping based on calculator slugs
const getCategoryForCalculator = (slug: string): string => {
  const categoryMap: Record<string, string> = {
    rescisao: 'trabalhista',
    aposentadoria: 'previdenciario',
    correcao_monetaria: 'civel',
    honorarios: 'civel',
    juros: 'civel',
  }
  return categoryMap[slug] || 'civel'
}

const categories = [
  { id: 'all', name: 'Todas' },
  { id: 'trabalhista', name: 'Trabalhista' },
  { id: 'previdenciario', name: 'Previdenciário' },
  { id: 'civel', name: 'Cível' },
]

interface CalculatorConfig {
  id: string
  name: string
  description: string
  icon: LucideIcon
  href: string
  category: string
  available: boolean
}

export default function CalculadorasHubPage() {
  const { calculatorId } = useParams<{ calculatorId?: string }>()
  const navigate = useNavigate()
  const { calculators: calculatorsFromContext, isLoading: isLoadingCalcs, error: calcsError } = useCalculators()
  const { costs, fetchCosts } = useCreditsStore()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    fetchCosts()
  }, [fetchCosts])

  // Build calculators array from context
  const calculators = useMemo<CalculatorConfig[]>(() => {
    return calculatorsFromContext.map((calc) => ({
      id: calc.slug,
      name: calc.name,
      description: calc.description,
      icon: calc.icon,
      href: calc.path,
      category: getCategoryForCalculator(calc.slug),
      available: !calc.locked,
    }))
  }, [calculatorsFromContext])

  const selectedCalculator = useMemo(() => {
    if (!calculatorId) return null
    if (calculatorId === 'rescisao' || calculatorId === 'aposentadoria') return calculatorId
    return null
  }, [calculatorId])

  const costDisplay = useMemo(() => {
    if (!selectedCalculator) return null

    const featureKey = `calculator_${selectedCalculator}`

    const costItem = costs.find(c => c.feature_key === featureKey)
    if (costItem) return costItem.cost === 1 ? '1 crédito' : `${costItem.cost} créditos`

    // Fallback
    return '1 crédito'
  }, [selectedCalculator, costs])

  const current = useMemo(() => {
    if (!selectedCalculator) return null
    return calculators.find((c) => c.id === selectedCalculator) || null
  }, [calculators, selectedCalculator])

  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  const CalculatorComponent = useMemo(() => {
    if (selectedCalculator === 'rescisao') return RescisaoCalculator
    if (selectedCalculator === 'aposentadoria') return AposentadoriaCalculator
    return null
  }, [selectedCalculator])

  const tipsButton = (
    <details className="relative z-[60]">
      <summary className="cursor-pointer list-none inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background [&::-webkit-details-marker]:hidden">
        <Info className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">Dicas para melhores resultados</span>
      </summary>
      <div className="absolute left-0 mt-3 w-[320px] rounded-2xl border border-border bg-background/95 backdrop-blur-md shadow-xl p-4 z-[70]">
        <div className="text-sm font-bold text-foreground mb-3">Dicas para cálculos precisos</div>
        <ul className="grid gap-2 text-sm text-muted-foreground">
          <li className="flex items-start">
            <span className="mr-2 text-muted-foreground/60">•</span>
            Verifique sempre os dados informados com atenção
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-muted-foreground/60">•</span>
            Utilize o seletor de cliente para vincular o cálculo
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-muted-foreground/60">•</span>
            Considere as particularidades de cada convenção coletiva
          </li>
          <li className="flex items-start">
            <span className="mr-2 text-muted-foreground/60">•</span>
            Os cálculos são estimativos e devem ser conferidos
          </li>
        </ul>
      </div>
    </details>
  )

  if (calculatorId && !selectedCalculator) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calculadora não encontrada</h1>
          <p className="text-muted-foreground mt-1">Volte para a lista e selecione uma calculadora disponível.</p>
        </div>
        <Link
          to="/app/calculadoras"
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Voltar
        </Link>
      </div>
    )
  }

  // Se uma calculadora estiver selecionada, usa o layout "Frame" estilo IA
  if (selectedCalculator && current) {
    return (
      <div className="min-h-[calc(100vh-160px)] h-auto flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">Calculadoras Jurídicas</h1>
              {tipsButton}
            </div>
            <p className="text-muted-foreground mt-1">Ferramentas de cálculo para auxiliar no seu trabalho jurídico.</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 flex-1 flex flex-col">
          <div className="flex items-center justify-between gap-4 mb-4 flex-shrink-0">
            <div className="flex items-center space-x-4 min-w-0">
              <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl shadow-sm shrink-0 border border-slate-200 dark:border-slate-700">
                <Calculator className={`h-7 w-7 ${isDark ? "text-slate-100" : "!text-[#0d1c34]"}`} strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <select
                      value={selectedCalculator}
                      onChange={(e) => {
                        const calc = calculators.find((c) => c.id === e.target.value)
                        if (calc) navigate(calc.href)
                      }}
                      className="appearance-none pl-3 pr-8 py-1.5 bg-muted border border-border rounded-lg text-base font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                    >
                      {calculators.filter((c) => c.available).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
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
                <p className="text-muted-foreground mt-1 text-sm">{current.description}</p>
              </div>
            </div>

            <div className="flex items-end gap-3">
              <ClientSelector
                value={selectedClientId}
                onChange={(id) => setSelectedClientId(id)}
                className="w-60"
                label="Cliente"
              />
            </div>
          </div>

          <div className="flex-1 relative">
            {CalculatorComponent ? (
              <CalculatorComponent selectedClientId={selectedClientId} />
            ) : (
              <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
                <Calculator className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Calculadora em desenvolvimento</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Layout Grid padrão para quando nenhuma calculadora está selecionada
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calculadoras</h1>
        <p className="text-muted-foreground mt-1">
          Ferramentas de cálculo para auxiliar no seu trabalho jurídico.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              category.id === selectedCategory
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Calculator Grid */}
      {isLoadingCalcs ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : calcsError ? (
        <div className="text-center py-12">
          <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Erro ao carregar calculadoras</h3>
          <p className="text-muted-foreground">Não foi possível carregar as calculadoras. Tente novamente mais tarde.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {calculators.filter((calc) => selectedCategory === 'all' || calc.category === selectedCategory).map((calc) => {
          const Icon = calc.icon

          return (
            <div
              key={calc.id}
              className={cn(
                'group relative bg-card border border-border rounded-xl p-4 transition-all duration-200',
                calc.available
                  ? 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-0.5 cursor-pointer'
                  : 'opacity-60'
              )}
            >
              {!calc.available && (
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-500 text-[11px] font-semibold rounded-full border border-amber-500/20">
                  Em breve
                </div>
              )}

              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                    calc.available
                      ? 'bg-muted group-hover:bg-primary group-hover:text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground mb-0.5">{calc.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {calc.description}
                  </p>
                </div>
              </div>

              {calc.available && (
                <Link
                  to={calc.href}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground mt-3 pt-3 border-t border-border transition-colors"
                >
                  Acessar
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
            </div>
          )
        })}
      </div>
      )}

      {/* Recent Calculations */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Cálculos Recentes</h2>
        </div>
        <div className="p-5">
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Seus cálculos recentes aparecerão aqui.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
