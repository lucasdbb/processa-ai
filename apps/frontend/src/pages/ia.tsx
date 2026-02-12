import { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect, type ChangeEvent } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Brain } from 'lucide-react'
import { toast } from 'sonner'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { normalizeMarkdown } from '@/lib/utils'
import { fetchAiTools } from '@/features/ai/api'
import { ToolsSidebar } from '@/features/ai/components/tools-sidebar'
import type { AiTool, ChatMessage } from '@/features/ai/types'
import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'

export default function IAPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useUser()
  const { openRegisterModal } = useOutletContext<RootLayoutOutletContext>()

  const [aiTools, setAiTools] = useState<AiTool[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(true)

  // Fetch AI tools from backend on mount
  useEffect(() => {
    fetchAiTools()
      .then((tools) => setAiTools(tools))
      .finally(() => setIsLoadingTools(false))
  }, [])

  const tools = useMemo(() => [...aiTools].sort((a, b) => a.order - b.order), [aiTools])
  const [selectedTool, setSelectedTool] = useState(() => tools.find((t) => !t.locked)?.slug || tools[0]?.slug || '')

  const [prompt, setPrompt] = useState('')
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [cnisFile, setCnisFile] = useState<File | null>(null)
  const [cnisFileInputKey, setCnisFileInputKey] = useState(0)
  const cnisPdfUrlRef = useRef<string | null>(null)
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState('')

  const [generatedText, setGeneratedText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)

  const currentTool = tools.find((t) => t.slug === selectedTool) || null
  const templates = currentTool?.templates || []

  const isCnisAnalysis = currentTool?.variant === 'cnis'
  const markdownToRender = normalizeMarkdown(generatedText)

  const previewHtml = useMemo(() => {
    if (!markdownToRender) return ''
    return DOMPurify.sanitize(marked.parse(markdownToRender) as string)
  }, [markdownToRender])

  const setCnisPdfUrl = useCallback((next: string) => {
    if (cnisPdfUrlRef.current) {
      URL.revokeObjectURL(cnisPdfUrlRef.current)
    }
    cnisPdfUrlRef.current = next || null
    setGeneratedPdfUrl(next)
  }, [])

  const resetToolState = useCallback(() => {
    setPrompt('')
    setCnisFile(null)
    setCnisFileInputKey((k) => k + 1)
    setGeneratedText('')
    setCnisPdfUrl('')
    setProgress(0)
    setChatMessages([])
    setChatInput('')
  }, [setCnisPdfUrl])

  const handleSelectTool = useCallback(
    (tool: AiTool) => {
      if (tool.locked) {
        toast.info('Em breve')
        return
      }

      setSelectedTool(tool.slug)
      resetToolState()
    },
    [resetToolState]
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
    if (isCnisAnalysis) return
    resizePromptTextarea()
  }, [isCnisAnalysis, prompt, resizePromptTextarea])

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
    setCnisPdfUrl('')
  }, [setCnisPdfUrl])

  const clearCnisFile = useCallback(() => {
    setCnisFile(null)
    setCnisFileInputKey((k) => k + 1)
    setGeneratedText('')
    setCnisPdfUrl('')
  }, [setCnisPdfUrl])

  const handleGenerate = useCallback(async () => {
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

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
        // Get user from Supabase session
        const supabase = (await import('@/lib/supabase/client')).createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          openRegisterModal()
          return
        }

        // 1. Submit job to backend
        const formData = new FormData()
        formData.append('file', cnisFile as File)
        formData.append('user_id', user.id)
        formData.append('store_pdf', 'true')

        const submitResponse = await fetchWithCredentials(`${API_URL}/ai/analyses/cnis-upload`, {
          method: 'POST',
          body: formData,
        })

        if (!submitResponse.ok) {
          if (submitResponse.status === 401 || submitResponse.status === 403) {
            openRegisterModal()
            return
          }

          let message = 'Erro ao enviar CNIS. Tente novamente.'
          try {
            const data = (await submitResponse.json()) as { detail?: string }
            if (data?.detail) message = data.detail
          } catch {
            void 0
          }
          throw new Error(message)
        }

        const submitData = (await submitResponse.json()) as { job_id: string }
        if (!submitData.job_id) {
          throw new Error('Resposta inválida do servidor')
        }

        // 2. Poll for job completion
        const jobId = submitData.job_id
        const maxAttempts = 120 // 2 minutes max
        const pollInterval = 2000 // 2 seconds

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval))

          const statusResponse = await fetchWithCredentials(`${API_URL}/ai/jobs/${encodeURIComponent(jobId)}`)

          if (!statusResponse.ok) {
            continue // Retry on error
          }

          const statusData = (await statusResponse.json()) as {
            status: string
            progress: number
            result?: { download_url?: string; content?: string }
            error?: string
          }

          // Update progress bar
          setProgress(statusData.progress || 0)

          if (statusData.status === 'failed') {
            throw new Error(statusData.error || 'Erro ao processar CNIS')
          }

          if (statusData.status === 'completed') {
            // Job completed - get the result
            if (statusData.result?.download_url) {
              // Download from signed URL
              const pdfResponse = await fetch(statusData.result.download_url)
              if (!pdfResponse.ok) {
                throw new Error('Erro ao baixar PDF')
              }
              const blob = await pdfResponse.blob()
              setCnisPdfUrl(URL.createObjectURL(blob))
            } else if (statusData.result?.content) {
              // Base64 content
              const binary = atob(statusData.result.content)
              const bytes = new Uint8Array(binary.length)
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
              const blob = new Blob([bytes], { type: 'application/pdf' })
              setCnisPdfUrl(URL.createObjectURL(blob))
            } else {
              throw new Error('Resultado inválido do servidor')
            }

            setGeneratedText('')
            toast.success('CNIS analisado com sucesso!')
            return
          }

          // Still processing - continue polling
        }

        throw new Error('Tempo esgotado. Tente novamente.')
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
        if (response.status === 401 || response.status === 403) {
          openRegisterModal()
          return
        }

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
  }, [cnisFile, isAuthenticated, isCnisAnalysis, openRegisterModal, prompt, selectedTool, setCnisPdfUrl])

  const handleDownload = useCallback(() => {
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

    if (isCnisAnalysis) {
      if (!generatedPdfUrl) return

      const element = document.createElement('a')
      const baseName = (currentTool?.name || 'cnis').toLowerCase().replaceAll(' ', '_')
      element.href = generatedPdfUrl
      element.download = `${baseName}_${Date.now()}.pdf`
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
      return
    }

    if (!generatedText) return

    // Download markdown as text file for prompt tools
    const blob = new Blob([generatedText], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const element = document.createElement('a')
    const baseName = (currentTool?.name || 'documento').toLowerCase().replaceAll(' ', '_')

    element.href = url
    element.download = `${baseName}_${Date.now()}.md`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    URL.revokeObjectURL(url)

    toast.success('Documento baixado com sucesso!')
  }, [currentTool?.name, generatedPdfUrl, generatedText, isAuthenticated, isCnisAnalysis, openRegisterModal])

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return

    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

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
        if (response.status === 401 || response.status === 403) {
          openRegisterModal()
          return
        }
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
  }, [chatInput, isChatLoading, isAuthenticated, openRegisterModal])

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
                  prompt={prompt}
                  setPrompt={setPrompt}
                  promptTextareaRef={promptTextareaRef}
                  resizePromptTextarea={resizePromptTextarea}
                  isGenerating={isGenerating}
                  progress={progress}
                  onGenerate={handleGenerate}
                  cnisFile={cnisFile}
                  cnisFileInputKey={cnisFileInputKey}
                  onCnisFileChange={handleCnisFileChange}
                  onClearCnisFile={clearCnisFile}
                  generatedText={generatedText}
                  previewHtml={previewHtml}
                  generatedPdfUrl={generatedPdfUrl}
                  onDownload={handleDownload}
                  chatMessages={chatMessages}
                  chatInput={chatInput}
                  setChatInput={setChatInput}
                  isChatLoading={isChatLoading}
                  onSendChatMessage={sendChatMessage}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

