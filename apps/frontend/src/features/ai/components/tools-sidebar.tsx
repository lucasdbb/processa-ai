import { Lock, Loader2 } from 'lucide-react'

import type { AiTool, ToolTemplate } from '../types'

type ToolsSidebarProps = {
  tools: AiTool[]
  selectedTool: string
  onSelectTool: (tool: AiTool) => void
  templates: ToolTemplate[]
  showTemplates: boolean
  onSelectTemplate: (prompt: string) => void
  isLoading?: boolean
}

export function ToolsSidebar({
  tools,
  selectedTool,
  onSelectTool,
  templates,
  showTemplates,
  onSelectTemplate,
  isLoading,
}: ToolsSidebarProps) {
  return (
    <div className="lg:col-span-1">
      <h2 id="tools-heading" className="text-lg font-bold text-foreground tracking-tight mb-4">
        Ferramentas
      </h2>

      <div className="space-y-2" role="radiogroup" aria-labelledby="tools-heading">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : tools.length ? (
          tools.map((tool) => {
            const ToolIcon = tool.icon

            return (
              <button
                key={tool.slug}
                onClick={() => onSelectTool(tool)}
                role="radio"
                aria-checked={selectedTool === tool.slug}
                aria-disabled={tool.locked}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 group ${
                  tool.locked
                    ? 'border-border bg-card opacity-60 cursor-not-allowed'
                    : selectedTool === tool.slug
                      ? 'border-primary bg-slate-900 shadow-md'
                      : 'border-border bg-card hover:border-muted-foreground/50 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-1.5 rounded-lg transition-colors ${
                      selectedTool === tool.slug && !tool.locked
                        ? 'bg-white/10 text-white'
                        : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
                    }`}
                    aria-hidden="true"
                  >
                    <ToolIcon className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h3
                      className={`font-semibold text-[13px] leading-tight ${
                        selectedTool === tool.slug && !tool.locked ? 'text-white' : 'text-foreground'
                      }`}
                    >
                      <span className="inline-flex items-center">
                        {tool.name}
                        {tool.locked ? (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-px text-[9px] font-bold text-muted-foreground">
                            <Lock className="h-2.5 w-2.5" />
                            Bloqueado
                          </span>
                        ) : null}
                      </span>
                    </h3>
                    <p
                      className={`text-[11px] mt-0.5 line-clamp-1 ${
                        selectedTool === tool.slug && !tool.locked ? 'text-white/70' : 'text-muted-foreground'
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
          <div className="py-4 text-sm text-muted-foreground">Nenhuma ferramenta disponível.</div>
        )}
      </div>

      {showTemplates && templates.length ? (
        <div className="mt-6">
          <h3 id="templates-heading" className="text-sm font-bold text-foreground mb-3 tracking-tight">
            Templates
          </h3>
          <div className="space-y-1.5" role="list" aria-labelledby="templates-heading">
            {templates.map((template, index) => (
              <button
                key={index}
                onClick={() => onSelectTemplate(template.prompt)}
                role="listitem"
                aria-label={`Usar template: ${template.label}`}
                className="w-full text-left px-3 py-2 text-xs bg-card border border-border rounded-lg hover:border-muted-foreground/50 hover:shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 text-foreground font-medium"
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
