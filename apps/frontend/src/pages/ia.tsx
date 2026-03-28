import { useState, useEffect, useMemo, useCallback } from 'react'
import { Brain } from 'lucide-react'
import { toast } from 'sonner'

import { fetchToolsCatalog } from '@/components/layout/tools-catalog-utils'
import { ToolsSidebar } from '@/features/ai/components/tools-sidebar'
import type { AiTool } from '@/features/ai/types'
import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

import { useOutletContext } from 'react-router-dom'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'

export default function IAPage() {
  const { isLoading: isAuthLoading } = useUser()
  const { openRegisterModal } = useOutletContext<RootLayoutOutletContext>()
  
  const [aiTools, setAiTools] = useState<AiTool[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(true)

  // Fetch AI tools from backend on mount
  useEffect(() => {
    fetchToolsCatalog()
      .then(({ aiTools }) => setAiTools(aiTools))
      .finally(() => setIsLoadingTools(false))
  }, [])

  const tools = useMemo(() => [...aiTools].sort((a, b) => a.order - b.order), [aiTools])
  const [selectedTool, setSelectedTool] = useState(() => tools.find((t) => !t.locked)?.slug || tools[0]?.slug || '')

  const [prompt, setPrompt] = useState('')

  const currentTool = tools.find((t) => t.slug === selectedTool) || null
  const templates = currentTool?.templates || []

  const handleSelectTool = useCallback(
    (tool: AiTool) => {
      if (tool.locked) {
        toast.info('Em breve')
        return
      }

      setSelectedTool(tool.slug)
      setPrompt('')
    },
    []
  )

  if (isAuthLoading || isLoadingTools) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  return (
    <div className="pt-24">
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-[var(--hero-glow-opacity)]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-4">IA Jurídica</h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Crie documentos jurídicos profissionais com auxílio da inteligência artificial. Economize tempo e melhore a qualidade das suas peças processuais.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <ToolsSidebar
            tools={tools}
            selectedTool={selectedTool}
            onSelectTool={handleSelectTool}
            templates={templates}
            showTemplates={currentTool?.variant === 'prompt'}
            onSelectTemplate={setPrompt}
            isLoading={isLoadingTools}
          />

          <div className="lg:col-span-3">
            <div className="bg-card rounded-[2rem] border border-border shadow-xl p-8">
              <div className="flex items-center space-x-4 mb-8">
                <div className="bg-slate-900 p-4 rounded-2xl shadow-lg">
                  <Brain className="h-8 w-8 text-white" strokeWidth={1.5} />
                </div>
                <div>
                  {currentTool?.name ? <h2 className="text-2xl font-bold text-foreground tracking-tight">{currentTool.name}</h2> : null}
                  {currentTool?.description ? <p className="text-muted-foreground mt-1">{currentTool.description}</p> : null}
                </div>
              </div>

              {currentTool ? (
                <currentTool.Component
                  externalPrompt={prompt}
                  onPromptChange={setPrompt}
                  onOpenRegisterModal={openRegisterModal}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
