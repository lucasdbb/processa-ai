'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useLayoutEffect, useRef, useState, useCallback, type ChangeEvent } from 'react'
import {
  Brain,
  FileSearch,
  FileText,
  Edit3,
  Download,
  Sparkles,
  Lock,
  Upload,
  Trash2,
  MessageSquare,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { ProtectedFeaturePreview } from '@/components/auth/protected-feature-preview'
import { toast } from 'sonner'
import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { MarkdownPreview } from '@/components/markdown/markdown-preview'
import { ChatInterface } from '@/features/ai-chat/components/chat-interface'

type AiTool = {
  slug: string
  name: string
  description: string
  icon: 'file-search' | 'edit-3' | 'message-square' | 'file-text' | (string & {})
  locked: boolean
  order: number
  templates: { label: string; prompt: string }[]
}

const ICONS = {
  'file-search': FileSearch,
  'edit-3': Edit3,
  'message-square': MessageSquare,
  'file-text': FileText,
} as const


const normalizeMarkdown = (value: string): string => {
  const text = value.trim()
  if (!text.startsWith('```')) return text

  const lines = text.split('\n')
  if (lines.length < 2) return text
  if (!lines[0].trim().startsWith('```')) return text
  if (lines[lines.length - 1].trim() !== '```') return text
  return lines.slice(1, -1).join('\n').trim()
}

export default function IAJuridicaPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useUser()
  const [tools, setTools] = useState<AiTool[]>([])
  const [isToolsLoading, setIsToolsLoading] = useState(true)
  const [selectedTool, setSelectedTool] = useState('')
  const [prompt, setPrompt] = useState('')
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [cnisFile, setCnisFile] = useState<File | null>(null)
  const [cnisFileInputKey, setCnisFileInputKey] = useState(0)
  const [generatedText, setGeneratedText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const isCnisAnalysis = selectedTool === 'cnis-analysis'
  const aiEndpoint = selectedTool ? `${API_URL}/ai/${selectedTool}` : ''

  const currentTool = tools.find((t) => t.slug === selectedTool) || null
  const markdownToRender = normalizeMarkdown(generatedText)
  const templates = currentTool?.templates || []
  const isChatTool = currentTool?.icon === 'message-square'

  const resetToolState = useCallback(() => {
    setPrompt('')
    setCnisFile(null)
    setCnisFileInputKey((k) => k + 1)
    setGeneratedText('')
  }, [])

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
    if (isCnisAnalysis) return
    resizePromptTextarea()
  }, [isCnisAnalysis, prompt, resizePromptTextarea])

  useEffect(() => {
    if (!isAuthenticated) return

    const loadTools = async () => {
      setIsToolsLoading(true)
      try {
        const response = await fetchWithCredentials(`${API_URL}/ai/tools`)
        if (!response.ok) throw new Error('Erro ao carregar ferramentas')
        const data = (await response.json()) as AiTool[]
        const sorted = [...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        setTools(sorted)
        setSelectedTool(
          (prev) => prev || sorted.find((t) => !t.locked)?.slug || sorted[0]?.slug || '',
        )
      } catch {
        setTools([])
      } finally {
        setIsToolsLoading(false)
      }
    }

    loadTools()
  }, [isAuthenticated])

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

  const handleGenerate = useCallback(async () => {
    if (!selectedTool) {
      toast.error('Selecione uma ferramenta')
      return
    }

    if (isCnisAnalysis) {
      if (!cnisFile) return toast.error('Por favor, envie o CNIS em PDF')
    } else {
      if (!prompt.trim()) {
        toast.error(isChatTool ? 'Digite sua pergunta' : 'Por favor, forneça uma descrição do documento')
        return
      }

      if (!isChatTool && prompt.trim().length < 10) {
        toast.error('Por favor, forneça mais detalhes (mínimo 10 caracteres)')
        return
      }
    }

    setIsLoading(true)

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
            // ignore
          }
          throw new Error(message)
        }

        const data = (await response.json()) as { text?: string }
        setGeneratedText(data.text || '')
        toast.success('CNIS analisado com sucesso!')
        return
      }

      if (isChatTool) {
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
          let message = 'Erro ao processar sua mensagem. Tente novamente.'
          try {
            const data = (await response.json()) as { detail?: string }
            if (data?.detail) message = data.detail
          } catch {
            // ignore
          }
          throw new Error(message)
        }

        const data = (await response.json()) as { response?: string }
        setGeneratedText(data.response || '')
        toast.success('Resposta gerada com sucesso!')
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
          // ignore
        }
        throw new Error(message)
      }

      const data = (await response.json()) as { response?: string }
      setGeneratedText(data.response || '')
      toast.success('Documento gerado com sucesso!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar documento. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }, [aiEndpoint, cnisFile, isCnisAnalysis, isChatTool, prompt, selectedTool])

  const handleDownload = useCallback(() => {
    if (!generatedText) return

    ;(async () => {
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
            // ignore
          }
          throw new Error(message)
        }

        const payload = (await response.json()) as {
          download_url?: string
          expires_in?: number
          document_id?: string
          storage_path?: string
          pipeline_version?: string
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

  // Show loading while checking authentication
  if (isAuthLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  // Show preview if not authenticated
  if (!isAuthenticated) {
    return (
      <ProtectedFeaturePreview
        title="IA Jurídica"
        description="Crie documentos jurídicos profissionais com auxílio da inteligência artificial. Economize tempo e melhore a qualidade das suas peças processuais."
        benefits={[
          'Geração automática de petições iniciais, contestações e recursos',
          'Criação de minutas de contratos personalizados',
          'Templates prontos para diversos tipos de documentos',
          'Análise de jurisprudência e fundamentação legal',
          'Economia de até 70% do tempo na elaboração de peças',
          'Sugestões inteligentes baseadas em milhares de casos',
        ]}
      />
    )
  }

  // Show the full page if authenticated
  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-slate-700 selection:text-white">
      <Header />

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-[var(--hero-glow-opacity)]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6 mt-8">
              IA Jurídica
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Crie documentos jurídicos profissionais com auxílio da inteligência artificial.
              Economize tempo e melhore a qualidade das suas peças processuais.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar com Ferramentas */}
          <div className="lg:col-span-1">
            <h2 id="tools-heading" className="text-xl font-bold text-foreground mb-6 tracking-tight">
              Ferramentas
            </h2>
            <div className="space-y-4" role="radiogroup" aria-labelledby="tools-heading">
              {isToolsLoading ? (
                <div className="py-8 flex justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : tools.length ? (
                tools.map((tool) => {
                  const ToolIcon = ICONS[tool.icon as keyof typeof ICONS] ?? FileText

                  return (
                    <button
                      key={tool.slug}
                      onClick={() => {
                        if (tool.locked) {
                          toast.info('Em breve')
                          return
                        }

                        setSelectedTool(tool.slug)
                        resetToolState()
                      }}
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
                              selectedTool === tool.slug && !tool.locked
                                ? 'text-white'
                                : 'text-foreground'
                            }`}
                          >
                            <span className="inline-flex items-center">
                              {tool.name}
                              {tool.locked && (
                                <span className="ml-2 inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                  <Lock className="h-3 w-3" />
                                  Bloqueado
                                </span>
                              )}
                            </span>
                          </h3>
                          <p
                            className={`text-xs mt-1 ${
                              selectedTool === tool.slug && !tool.locked
                                ? 'text-white/80'
                                : 'text-muted-foreground'
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

            {/* Templates */}
            {templates.length && !isChatTool ? (
              <div className="mt-8">
                <h3 id="templates-heading" className="text-lg font-bold text-foreground mb-4 tracking-tight">
                  Templates
                </h3>
                <div className="space-y-2" role="list" aria-labelledby="templates-heading">
                  {templates.map((template, index) => (
                    <button
                      key={index}
                      onClick={() => setPrompt(template.prompt)}
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

          {/* Área Principal */}
          <div className="lg:col-span-3">
            <div className="bg-card rounded-[2rem] border border-border shadow-xl p-8">
              <div className="flex items-center space-x-4 mb-8">
                <div className="bg-slate-900 p-4 rounded-2xl shadow-lg">
                  <Brain className="h-8 w-8 text-white" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">
                    {currentTool?.name || 'Selecione uma ferramenta'}
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    {currentTool?.description || ''}
                  </p>
                </div>
              </div>

              {isChatTool ? (
                <div className="mb-8">
                  <ChatInterface />
                </div>
              ) : (
                <>
                  {isCnisAnalysis ? (
                    <div className="mb-8">
                      <label htmlFor="cnis-file" className="block text-sm font-bold text-foreground mb-3">
                        Envie o CNIS (PDF) <span className="text-destructive">*</span>
                      </label>

                      <div className="border border-border rounded-2xl bg-muted/30 p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-bold text-foreground">Arquivo</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Aceita apenas PDF (até 10MB)
                            </div>
                          </div>

                          {cnisFile ? (
                            <button
                              type="button"
                              onClick={() => {
                                setCnisFile(null)
                                setCnisFileInputKey((k) => k + 1)
                                setGeneratedText('')
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-sm font-bold"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remover
                            </button>
                          ) : null}
                        </div>

                        {cnisFile ? (
                          <div className="mt-4 rounded-xl border border-border bg-card p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-foreground truncate">{cnisFile.name}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {(cnisFile.size / (1024 * 1024)).toFixed(2)} MB
                                </div>
                              </div>
                              <div className="text-xs font-bold text-muted-foreground">PDF</div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4">
                            <input
                              key={cnisFileInputKey}
                              id="cnis-file"
                              type="file"
                              accept="application/pdf"
                              onChange={handleCnisFileChange}
                              className="hidden"
                            />
                            <label
                              htmlFor="cnis-file"
                              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors font-bold cursor-pointer"
                            >
                              <Upload className="h-5 w-5" />
                              Selecionar PDF
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-8">
                      <label htmlFor="prompt-input" className="block text-sm font-bold text-foreground mb-3">
                        Descreva o que você precisa <span className="text-destructive">*</span>
                      </label>
                      <div className="rounded-2xl border border-input bg-muted/50 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all duration-200">
                        <textarea
                          id="prompt-input"
                          ref={promptTextareaRef}
                          value={prompt}
                          onChange={(e) => {
                            setPrompt(e.target.value)
                            resizePromptTextarea()
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter' || e.shiftKey) return

                            e.preventDefault()
                            if (isLoading) return
                            if (!prompt.trim()) return
                            void handleGenerate()
                          }}
                          placeholder="Ex: Criar uma petição inicial para ação de cobrança contra empresa que não pagou serviços prestados no valor de R$ 10.000,00..."
                          className="w-full px-6 py-4 text-base bg-transparent focus:outline-none resize-none placeholder-muted-foreground text-foreground"
                        />
                        <div className="px-6 pb-4 flex items-center justify-between gap-4 text-xs text-muted-foreground font-medium">
                          <span>Enter para gerar • Shift+Enter para quebra de linha</span>
                          <span>{prompt.length} caracteres</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-4 mb-8">
                    <button
                      onClick={handleGenerate}
                      disabled={isCnisAnalysis ? !cnisFile || isLoading : !prompt.trim() || isLoading}
                      className="bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center px-8 py-4 rounded-xl font-bold text-base transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full sm:w-auto"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                          <span>{isCnisAnalysis ? 'Analisando CNIS...' : 'Gerando Documento...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5 mr-2" />
                          <span>{isCnisAnalysis ? 'Analisar CNIS' : 'Gerar com IA'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {generatedText && (
                    <div role="region" aria-labelledby="result-heading">
                      <div className="flex items-center justify-between mb-4">
                        <h3 id="result-heading" className="text-lg font-bold text-foreground">
                          {isCnisAnalysis ? 'Análise do CNIS' : 'Documento Gerado'}
                        </h3>
                        <div className="flex space-x-2" role="toolbar" aria-label="Ações do documento">
                          <button
                            onClick={handleDownload}
                            aria-label="Baixar como PDF"
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                            title="Baixar PDF"
                          >
                            <Download className="h-5 w-5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div
                        className="bg-muted/30 border border-border rounded-2xl p-8 shadow-inner"
                        role="article"
                        aria-label={isCnisAnalysis ? 'Análise do CNIS' : 'Documento gerado pela IA'}
                        tabIndex={0}
                      >
                        <MarkdownPreview source={markdownToRender} className="text-sm" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Dicas */}
            <div className="mt-8 bg-card border border-border rounded-2xl p-8 shadow-sm">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center">
                <span className="bg-[hsl(var(--tip-bg)/var(--tip-bg-alpha))] text-[hsl(var(--tip-text))] p-2 rounded-lg mr-3">💡</span>
                Dicas para melhores resultados
              </h3>
              <ul className="space-y-3 text-muted-foreground">
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
                  Sempre revise o texto gerado por um profissional qualificado
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-muted-foreground/60">•</span>
                  Use os templates sugeridos para estruturar melhor seu pedido
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
