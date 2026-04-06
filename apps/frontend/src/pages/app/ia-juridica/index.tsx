import { useMemo } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SEO } from '@/components/seo'
import { Brain, Lock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAiTools } from '@/features/ai/context'

const categories = [
  { id: 'all', name: 'Todas' },
  { id: 'analysis', name: 'Análise' },
  { id: 'generation', name: 'Geração de Documentos' },
  { id: 'consultation', name: 'Consulta' },
]

const getCategoryForTool = (slug: string) => {
  if (slug === 'cnis_analysis' || slug === 'process_summary' || slug === 'brief_scanner') return 'analysis'
  if (slug === 'chat') return 'consultation'
  if (slug === 'labor_claim' || slug === 'defense') return 'generation'
  return 'all'
}

export default function IAJuridicaHubPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const { tools: aiTools, isLoading, error } = useAiTools()

  const tools = useMemo(() => {
    return aiTools.map((tool) => ({
      id: tool.slug,
      name: tool.name,
      description: tool.description,
      icon: tool.icon,
      href: `/app/ia/${tool.slug}`,
      category: getCategoryForTool(tool.slug),
      available: !tool.locked,
      locked: tool.locked,
    }))
  }, [aiTools])

  const filteredTools = useMemo(() => {
    if (selectedCategory === 'all') return tools
    return tools.filter((tool) => tool.category === selectedCategory)
  }, [tools, selectedCategory])

  return (
    <div className="space-y-6">
      <SEO title="IA Jurídica" noindex />
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ferramentas de IA Jurídica</h1>
        <p className="text-muted-foreground mt-1">
          Utilize inteligência artificial para análise de documentos, geração de peças processuais e consultas jurídicas.
        </p>
      </div>

      {/* Filtros de categoria */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedCategory === category.id
                ? 'bg-slate-900 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Grid de ferramentas */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Erro ao carregar ferramentas</h3>
          <p className="text-muted-foreground">Não foi possível carregar as ferramentas. Tente novamente mais tarde.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredTools.map((tool) => {
          const Icon = tool.icon
          const inner = (
            <div
              className={cn(
                'group relative bg-card border border-border rounded-xl p-5 transition-all duration-200 h-full',
                tool.available
                  ? 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-0.5 cursor-pointer'
                  : 'opacity-60 cursor-default'
              )}
            >
              {tool.locked && (
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-500 text-[11px] font-semibold rounded-full border border-amber-500/20">
                  <Lock className="h-2.5 w-2.5" />
                  Em breve
                </div>
              )}

              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                    tool.available
                      ? 'bg-muted group-hover:bg-primary group-hover:text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground mb-1">{tool.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-3">{tool.description}</p>
                </div>
              </div>
            </div>
          )

          return tool.available ? (
            <Link key={tool.id} to={tool.href}>{inner}</Link>
          ) : (
            <div key={tool.id}>{inner}</div>
          )
        })}

        {/* Mensagem quando não há ferramentas na categoria */}
        {filteredTools.length === 0 && (
          <div className="col-span-full text-center py-10">
            <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-base font-semibold text-foreground mb-1">Nenhuma ferramenta encontrada</h3>
            <p className="text-sm text-muted-foreground">Tente selecionar outra categoria.</p>
          </div>
        )}
      </div>
      )}

      {/* Informação adicional */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
        <div className="flex gap-3">
          <Brain className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-blue-900 dark:text-blue-100 text-sm mb-1">Sobre as Ferramentas de IA</h3>
            <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
              Nossas ferramentas utilizam modelos de linguagem avançados para auxiliar em tarefas jurídicas. Os
              resultados devem sempre ser revisados por um profissional qualificado antes de serem utilizados.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
