import { useMemo } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, Lock, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAiTools } from '@/features/ai/context'

const categories = [
  { id: 'all', name: 'Todas' },
  { id: 'analysis', name: 'Análise' },
  { id: 'generation', name: 'Geração de Documentos' },
  { id: 'consultation', name: 'Consulta' },
]

const getCategoryForTool = (slug: string) => {
  if (slug === 'cnis_analysis' || slug === 'process_summary') return 'analysis'
  if (slug === 'chat') return 'consultation'
  if (slug === 'initial_petition' || slug === 'defense') return 'generation'
  return 'all'
}

export default function IAJuridicaHubPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const { tools: aiTools } = useAiTools()

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTools.map((tool) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.id}
              to={tool.available ? tool.href : '#'}
              className={cn(
                'group relative bg-card border border-border rounded-2xl p-6 transition-all duration-200',
                tool.available
                  ? 'hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-1'
                  : 'opacity-60 cursor-not-allowed'
              )}
              onClick={(e) => {
                if (!tool.available) e.preventDefault()
              }}
            >
              {/* Badge de bloqueio */}
              {tool.locked && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-500 text-xs font-semibold rounded-full border border-amber-500/20">
                  <Lock className="h-3 w-3" />
                  Em breve
                </div>
              )}

              {/* Ícone */}
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors',
                  tool.available
                    ? 'bg-slate-900 text-white group-hover:bg-slate-800'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-6 w-6" />
              </div>

              {/* Conteúdo */}
              <h3 className="text-lg font-bold text-foreground mb-2">{tool.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{tool.description}</p>

              {/* Call to action */}
              {tool.available && (
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:gap-3 transition-all">
                  Usar ferramenta
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Link>
          )
        })}
      </div>

      {/* Mensagem quando não há ferramentas */}
      {filteredTools.length === 0 && (
        <div className="text-center py-12">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma ferramenta encontrada</h3>
          <p className="text-muted-foreground">Tente selecionar outra categoria.</p>
        </div>
      )}

      {/* Informação adicional */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <div className="flex gap-4">
          <Brain className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">Sobre as Ferramentas de IA</h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Nossas ferramentas utilizam modelos de linguagem avançados para auxiliar em tarefas jurídicas. Os
              resultados devem sempre ser revisados por um profissional qualificado antes de serem utilizados.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
