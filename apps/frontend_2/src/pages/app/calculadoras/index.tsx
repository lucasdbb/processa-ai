import { Link } from 'react-router-dom'
import { Calculator, DollarSign, Calendar, TrendingUp, Clock, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const calculators = [
  {
    id: 'rescisao',
    name: 'Rescisao Trabalhista',
    description: 'Calcule todas as verbas rescisórias: saldo de salário, aviso prévio, férias, 13°, FGTS e multa.',
    icon: DollarSign,
    href: '/app/calculadoras/rescisao',
    category: 'trabalhista',
    available: true,
  },
  {
    id: 'aposentadoria',
    name: 'Simulacao de Aposentadoria',
    description: 'Simule tempo de contribuição, idade mínima e valor do benefício com as regras de transição.',
    icon: Calendar,
    href: '/app/calculadoras/aposentadoria',
    category: 'previdenciario',
    available: true,
  },
  {
    id: 'correcao',
    name: 'Correcao Monetaria',
    description: 'Atualize valores com IPCA-E, INPC, Taxa Selic, TR ou IGP-M de forma automática.',
    icon: TrendingUp,
    href: '/app/calculadoras/correcao',
    category: 'civel',
    available: false,
  },
  {
    id: 'juros',
    name: 'Juros de Mora',
    description: 'Calcule juros de mora sobre valores com diferentes taxas e períodos.',
    icon: Clock,
    href: '/app/calculadoras/juros',
    category: 'civel',
    available: false,
  },
]

const categories = [
  { id: 'all', name: 'Todas' },
  { id: 'trabalhista', name: 'Trabalhista' },
  { id: 'previdenciario', name: 'Previdenciário' },
  { id: 'civel', name: 'Cível' },
]

export default function CalculadorasHubPage() {
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
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              category.id === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Calculator Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {calculators.map((calc) => {
          const Icon = calc.icon

          return (
            <div
              key={calc.id}
              className={cn(
                'group relative bg-card border border-border rounded-xl p-6 transition-all',
                calc.available
                  ? 'hover:border-muted-foreground/50 hover:shadow-md cursor-pointer'
                  : 'opacity-60'
              )}
            >
              {!calc.available && (
                <div className="absolute top-4 right-4">
                  <span className="px-2 py-1 text-[10px] font-bold uppercase bg-muted text-muted-foreground rounded">
                    Em breve
                  </span>
                </div>
              )}

              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'p-3 rounded-xl transition-colors',
                    calc.available
                      ? 'bg-muted group-hover:bg-slate-900 group-hover:text-white'
                      : 'bg-muted'
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">{calc.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {calc.description}
                  </p>
                </div>
              </div>

              {calc.available && (
                <Link
                  to={calc.href}
                  className="mt-4 flex items-center gap-1 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors"
                >
                  Acessar
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
            </div>
          )
        })}
      </div>

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
