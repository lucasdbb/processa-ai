import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Brain, MessageSquare, FileText, FileSearch, Edit3, ArrowRight, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { cn, normalizeMarkdown } from '@/lib/utils'

import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { AI_TOOLS } from '@/features/ai/ai-tools'
import { ToolsSidebar } from '@/features/ai/components/tools-sidebar'
import type { AiTool, ChatMessage } from '@/features/ai/types'
import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

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

const TOOL_ROUTE_TO_SLUG: Record<string, string> = {
  chat: 'chat',
  peticao: 'initial-petition',
  cnis: 'cnis-analysis',
}

const TOOL_SLUG_TO_ROUTE: Record<string, string> = {
  chat: 'chat',
  'initial-petition': 'peticao',
  'cnis-analysis': 'cnis',
  defense: 'defesa',
}

export default function IAHubPage() {
  const { toolId } = useParams<{ toolId?: string }>()
  const navigate = useNavigate()
  const { isLoading: isAuthLoading } = useUser()

  const allTools = useMemo(() => [...AI_TOOLS].sort((a, b) => a.order - b.order), [])

  const resolvedToolSlug = useMemo(() => {
    if (!toolId) return null
    return TOOL_ROUTE_TO_SLUG[toolId] ?? toolId
  }, [toolId])

  const initialSlug = useMemo(() => {
    if (resolvedToolSlug && allTools.some((t) => t.slug === resolvedToolSlug)) return resolvedToolSlug
    return allTools.find((t) => !t.locked)?.slug || allTools[0]?.slug || ''
  }, [allTools, resolvedToolSlug])

  const [selectedTool, setSelectedTool] = useState(() => initialSlug)

  const [prompt, setPrompt] = useState('')
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [cnisFile, setCnisFile] = useState<File | null>(null)
  const [cnisFileInputKey, setCnisFileInputKey] = useState(0)

  const [generatedText, setGeneratedText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)

  const currentTool = allTools.find((t) => t.slug === selectedTool) || null
  const templates = currentTool?.templates || []

  const isCnisAnalysis = currentTool?.variant === 'cnis'
  const aiEndpoint = isCnisAnalysis ? `${API_URL}/ai/cnis-analysis` : `${API_URL}/ai/chat`
  const markdownToRender = normalizeMarkdown(generatedText)

  const previewHtml = useMemo(() => {
    if (!markdownToRender) return ''
    return DOMPurify.sanitize(marked.parse(markdownToRender) as string)
  }, [markdownToRender])

  const resetToolState = useCallback(() => {
    setPrompt('')
    setCnisFile(null)
    setCnisFileInputKey((k) => k + 1)
    setGeneratedText('')
    setChatMessages([])
    setChatInput('')
  }, [])

  useLayoutEffect(() => {
    if (!resolvedToolSlug) return
    if (!allTools.some((t) => t.slug === resolvedToolSlug)) return
    setSelectedTool(resolvedToolSlug)
    resetToolState()
  }, [allTools, resetToolState, resolvedToolSlug])

  const handleSelectTool = useCallback(
    (tool: AiTool) => {
      if (tool.locked) {
        toast.info('Em breve')
        return
      }

      setSelectedTool(tool.slug)
      resetToolState()

      const route = TOOL_SLUG_TO_ROUTE[tool.slug] ?? tool.slug
      navigate(`/app/ia/${route}`, { replace: false })
    },
    [navigate, resetToolState]
  )

  const resizePromptTextarea = useCallback(() => {
    const el = promptTextareaRef.current
    if (!el) return

    const minHeight = 100
    const maxHeight = 300

    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${Math.max(next, minHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  useLayoutEffect(() => {
    if (!toolId) return
    if (isCnisAnalysis || currentTool?.variant === 'chat') return
    resizePromptTextarea()
  }, [currentTool?.variant, isCnisAnalysis, prompt, resizePromptTextarea, toolId])

  const handleCnisFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      toast.error('Envie um arquivo PDF')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 10MB')
      return
    }

    setCnisFile(file)
    setGeneratedText('')
  }, [])

  const clearCnisFile = useCallback(() => {
    setCnisFile(null)
    setCnisFileInputKey((k) => k + 1)
    setGeneratedText('')
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!selectedTool) {
      toast.error('Selecione uma ferramenta')
      return
    }

    if (isCnisAnalysis) {
      if (!cnisFile) {
        toast.error('Por favor, envie o CNIS em PDF')
        return
      }
    } else {
      if (!prompt.trim()) {
        toast.error('Por favor, forneça uma descrição do documento')
        return
      }

      if (prompt.trim().length < 10) {
        toast.error('Por favor, forneça mais detalhes (mínimo 10 caracteres)')
        return
      }
    }

    setIsGenerating(true)

    try {
      if (isCnisAnalysis) {
        const formData = new FormData()
        formData.append('file', cnisFile as File)

        const response = await fetchWithCredentials(aiEndpoint, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          let message = 'Erro ao analisar CNIS. Tente novamente.'
          try {
            const data = (await response.json()) as { detail?: string }
            if (data?.detail) message = data.detail
          } catch {
            void 0
          }
          throw new Error(message)
        }

        const data = (await response.json()) as { text?: string }
        setGeneratedText(data.text || '')
        toast.success('CNIS analisado com sucesso!')
        return
      }

      const response = await fetchWithCredentials(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: prompt,
        }),
      })

      if (!response.ok) {
        let message = 'Erro ao gerar documento. Tente novamente.'
        try {
          const data = (await response.json()) as { detail?: string }
          if (data?.detail) message = data.detail
        } catch {
          void 0
        }
        throw new Error(message)
      }

      const data = (await response.json()) as { response?: string }
      setGeneratedText(data.response || '')
      toast.success('Documento gerado com sucesso!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar documento. Tente novamente.')
    } finally {
      setIsGenerating(false)
    }
  }, [aiEndpoint, cnisFile, isCnisAnalysis, prompt, selectedTool])

  const handleDownload = useCallback(() => {
    if (!generatedText) return

    void (async () => {
      try {
        const response = await fetchWithCredentials(`${API_URL}/ai/cnis-analysis/pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            markdown: markdownToRender,
            filename: (currentTool?.name || 'documento').toLowerCase().replaceAll(' ', '_'),
          }),
        })

        if (!response.ok) {
          let message = 'Erro ao gerar PDF. Tente novamente.'
          try {
            const data = (await response.json()) as { detail?: string }
            if (data?.detail) message = data.detail
          } catch {
            void 0
          }
          throw new Error(message)
        }

        const payload = (await response.json()) as {
          download_url?: string
        }

        if (!payload.download_url) {
          throw new Error('URL de download inválida')
        }

        const signedRes = await fetch(payload.download_url)
        if (!signedRes.ok) {
          throw new Error('Erro ao baixar PDF')
        }

        const blob = await signedRes.blob()
        const url = URL.createObjectURL(blob)
        const element = document.createElement('a')
        const baseName = (currentTool?.name || 'documento').toLowerCase().replaceAll(' ', '_')

        element.href = url
        element.download = `${baseName}_${Date.now()}.pdf`
        document.body.appendChild(element)
        element.click()
        document.body.removeChild(element)
        URL.revokeObjectURL(url)

        toast.success('PDF gerado com sucesso!')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao gerar PDF')
      }
    })()
  }, [currentTool?.name, generatedText, markdownToRender])

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput.trim(),
    }

    setChatMessages((prev) => [...prev, userMessage])
    setChatInput('')
    setIsChatLoading(true)

    try {
      const response = await fetchWithCredentials(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content }),
      })

      if (!response.ok) {
        throw new Error('Erro ao processar sua mensagem. Tente novamente.')
      }

      const data = (await response.json()) as { response?: string }
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Desculpe, não consegui processar sua mensagem.',
      }
      setChatMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro. Tente novamente mais tarde.',
      }
      setChatMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsChatLoading(false)
    }
  }, [chatInput, isChatLoading])

  if (isAuthLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  if (toolId) {
    if (!currentTool) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ferramenta não encontrada</h1>
            <p className="text-muted-foreground mt-1">Volte para a lista de ferramentas e selecione uma opção.</p>
          </div>
          <Link
            to="/app/ia"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Voltar
          </Link>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              IA Juridica
              <Sparkles className="h-5 w-5 text-yellow-500" />
            </h1>
            <p className="text-muted-foreground mt-1">Selecione uma ferramenta e comece a usar.</p>
          </div>
          <Link
            to="/app/ia"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Ver todas
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <ToolsSidebar
            tools={allTools}
            selectedTool={selectedTool}
            onSelectTool={handleSelectTool}
            templates={templates}
            showTemplates={currentTool?.variant === 'prompt'}
            onSelectTemplate={setPrompt}
          />

          <div className="lg:col-span-3">
            <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="bg-slate-900 p-4 rounded-2xl shadow-lg">
                  <Brain className="h-7 w-7 text-white" strokeWidth={1.5} />
                </div>
                <div>
                  {currentTool?.name ? (
                    <h2 className="text-xl font-bold text-foreground tracking-tight">{currentTool.name}</h2>
                  ) : null}
                  {currentTool?.description ? <p className="text-muted-foreground mt-1">{currentTool.description}</p> : null}
                </div>
              </div>

              <currentTool.Component
                prompt={prompt}
                setPrompt={setPrompt}
                promptTextareaRef={promptTextareaRef}
                resizePromptTextarea={resizePromptTextarea}
                isGenerating={isGenerating}
                onGenerate={handleGenerate}
                cnisFile={cnisFile}
                cnisFileInputKey={cnisFileInputKey}
                onCnisFileChange={handleCnisFileChange}
                onClearCnisFile={clearCnisFile}
                generatedText={generatedText}
                previewHtml={previewHtml}
                onDownload={handleDownload}
                chatMessages={chatMessages}
                chatInput={chatInput}
                setChatInput={setChatInput}
                isChatLoading={isChatLoading}
                onSendChatMessage={sendChatMessage}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

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
