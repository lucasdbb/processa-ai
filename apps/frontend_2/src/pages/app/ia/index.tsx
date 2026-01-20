import { Link } from 'react-router-dom'
import { MessageSquare, FileText, FileSearch, Edit3, ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const tools = [
  {
    id: 'chat',
    name: 'Chat Juridico',
    description: 'Converse com a IA para tirar dúvidas, estruturar ideias e receber orientações sobre questões jurídicas.',
    icon: MessageSquare,
    href: '/app/ia/chat',
    available: true,
    featured: true,
  },
  {
    id: 'peticao',
    name: 'Gerador de Peticoes',
    description: 'Gere petições iniciais, recursos e outras peças processuais com auxílio da inteligência artificial.',
    icon: FileText,
    href: '/app/ia/peticao',
    available: true,
    featured: false,
  },
  {
    id: 'cnis',
    name: 'Analise de CNIS',
    description: 'Envie seu CNIS em PDF e receba uma análise estruturada para casos previdenciários.',
    icon: FileSearch,
    href: '/app/ia/cnis',
    available: true,
    featured: false,
  },
  {
    id: 'contrato',
    name: 'Gerador de Contratos',
    description: 'Crie minutas de contratos com cláusulas essenciais de forma rápida e personalizada.',
    icon: Edit3,
    href: '/app/ia/contrato',
    available: false,
    featured: false,
  },
]

export default function IAHubPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          IA Juridica
          <Sparkles className="h-5 w-5 text-yellow-500" />
        </h1>
        <p className="text-muted-foreground mt-1">
          Ferramentas de inteligência artificial para potencializar seu trabalho.
        </p>
      </div>

      {/* Featured Tool */}
      {tools
        .filter((t) => t.featured)
        .map((tool) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.id}
              to={tool.href}
              className="group block bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white hover:shadow-xl transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/10 rounded-xl">
                  <Icon className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">{tool.name}</h3>
                  <p className="text-slate-300 leading-relaxed">{tool.description}</p>
                  <div className="mt-4 flex items-center gap-1 text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                    Iniciar conversa
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}

      {/* Other Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools
          .filter((t) => !t.featured)
          .map((tool) => {
            const Icon = tool.icon

            return (
              <div
                key={tool.id}
                className={cn(
                  'group relative bg-card border border-border rounded-xl p-5 transition-all',
                  tool.available
                    ? 'hover:border-muted-foreground/50 hover:shadow-md cursor-pointer'
                    : 'opacity-60'
                )}
              >
                {!tool.available && (
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-1 text-[10px] font-bold uppercase bg-muted text-muted-foreground rounded">
                      Em breve
                    </span>
                  </div>
                )}

                <div className="p-2.5 bg-muted rounded-xl w-fit mb-4 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <Icon className="h-5 w-5" />
                </div>

                <h3 className="font-semibold text-foreground mb-1">{tool.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{tool.description}</p>

                {tool.available && (
                  <Link
                    to={tool.href}
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

      {/* Tips */}
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
          <span className="text-lg">💡</span>
          Dicas para melhores resultados
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-muted-foreground/60">•</span>
            Seja específico sobre os fatos do caso, incluindo datas e valores.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-foreground/60">•</span>
            Identifique claramente as partes envolvidas (requerente e requerido).
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-foreground/60">•</span>
            Mencione a legislação aplicável ou jurisprudência se souber.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-muted-foreground/60">•</span>
            Sempre revise o texto gerado por um profissional qualificado.
          </li>
        </ul>
      </div>
    </div>
  )
}
