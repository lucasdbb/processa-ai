import { Info, Lock } from 'lucide-react'

import type { AiTool, ToolTemplate } from '../types'

type ToolsSidebarProps = {
  tools: AiTool[]
  selectedTool: string
  onSelectTool: (tool: AiTool) => void
  templates: ToolTemplate[]
  showTemplates: boolean
  onSelectTemplate: (prompt: string) => void
}

export function ToolsSidebar({
  tools,
  selectedTool,
  onSelectTool,
  templates,
  showTemplates,
  onSelectTemplate,
}: ToolsSidebarProps) {
  return (
    <div className="lg:col-span-1">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 id="tools-heading" className="text-xl font-bold text-foreground tracking-tight">
          Ferramentas
        </h2>

        <details className="relative">
          <summary className="cursor-pointer list-none inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background [&::-webkit-details-marker]:hidden">
            <Info className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Dicas para melhores resultados</span>
          </summary>
          <div className="absolute right-0 mt-3 w-[320px] rounded-2xl border border-border bg-background/95 backdrop-blur-md shadow-xl p-4 z-20">
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
      </div>

      <div className="space-y-4" role="radiogroup" aria-labelledby="tools-heading">
        {tools.length ? (
          tools.map((tool) => {
            const ToolIcon = tool.icon

            return (
              <button
                key={tool.slug}
                onClick={() => onSelectTool(tool)}
                role="radio"
                aria-checked={selectedTool === tool.slug}
                aria-disabled={tool.locked}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 group ${
                  tool.locked
                    ? 'border-border bg-card opacity-60 cursor-not-allowed'
                    : selectedTool === tool.slug
                      ? 'border-primary bg-slate-900 shadow-lg scale-[1.02]'
                      : 'border-border bg-card hover:border-muted-foreground/50 hover:shadow-md'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-2.5 rounded-xl transition-colors ${
                      selectedTool === tool.slug && !tool.locked
                        ? 'bg-white/10 text-white'
                        : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
                    }`}
                    aria-hidden="true"
                  >
                    <ToolIcon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div>
                    <h3
                      className={`font-bold text-sm ${
                        selectedTool === tool.slug && !tool.locked ? 'text-white' : 'text-foreground'
                      }`}
                    >
                      <span className="inline-flex items-center">
                        {tool.name}
                        {tool.locked ? (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            <Lock className="h-3 w-3" />
                            Bloqueado
                          </span>
                        ) : null}
                      </span>
                    </h3>
                    <p
                      className={`text-xs mt-1 ${
                        selectedTool === tool.slug && !tool.locked ? 'text-white/80' : 'text-muted-foreground'
                      }`}
                    >
                      {tool.description}
                    </p>
                  </div>
                </div>
              </button>
            )
          })
        ) : (
          <div className="py-6 text-sm text-muted-foreground">Nenhuma ferramenta disponível.</div>
        )}
      </div>

      {showTemplates && templates.length ? (
        <div className="mt-8">
          <h3 id="templates-heading" className="text-lg font-bold text-foreground mb-4 tracking-tight">
            Templates
          </h3>
          <div className="space-y-2" role="list" aria-labelledby="templates-heading">
            {templates.map((template, index) => (
              <button
                key={index}
                onClick={() => onSelectTemplate(template.prompt)}
                role="listitem"
                aria-label={`Usar template: ${template.label}`}
                className="w-full text-left px-4 py-3 text-sm bg-card border border-border rounded-xl hover:border-muted-foreground/50 hover:shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-foreground font-medium"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
