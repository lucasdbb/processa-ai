import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Brain, Info } from 'lucide-react'
import { toast } from 'sonner'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { normalizeMarkdown } from '@/lib/utils'

import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { useAiTools } from '@/features/ai/context'
import type { ChatMessage } from '@/features/ai/types'
import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ClientSelector } from '@/components/forms/client-selector'

export default function IAHubPage() {
  const { toolId } = useParams<{ toolId?: string }>()
  const { isLoading: isAuthLoading } = useUser()
  const { tools: aiTools, isLoading: isLoadingTools } = useAiTools()

  const allTools = useMemo(() => [...aiTools].sort((a, b) => a.order - b.order), [aiTools])

  // toolId is the URL slug, which matches the database 'key' column exactly
  const resolvedToolSlug = toolId || null

  const defaultSlug = useMemo(() => {
    return allTools.find((t) => !t.locked)?.slug || allTools[0]?.slug || ''
  }, [allTools])

  const activeSlug = resolvedToolSlug ?? defaultSlug

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
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  const currentTool = useMemo(() => {
    if (!activeSlug) return null
    return allTools.find((t) => t.slug === activeSlug) || null
  }, [activeSlug, allTools])

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
    setIsGenerating(false)
    setIsChatLoading(false)
    setSelectedClientId(null)
  }, [setCnisPdfUrl])

  useLayoutEffect(() => {
    resetToolState()
  }, [activeSlug, resetToolState])

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
    setCnisPdfUrl('')
  }, [setCnisPdfUrl])

  const clearCnisFile = useCallback(() => {
    setCnisFile(null)
    setCnisFileInputKey((k) => k + 1)
    setGeneratedText('')
    setCnisPdfUrl('')
  }, [setCnisPdfUrl])

  const handleGenerate = useCallback(async () => {
    if (!currentTool) return

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

    // Limpar PDF anterior e progresso antes de iniciar nova análise
    setCnisPdfUrl('')
    setProgress(0)
    setIsGenerating(true)

    try {
      if (isCnisAnalysis) {
        // Get user from Supabase session
        const supabase = (await import('@/lib/supabase/client')).createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error('Usuário não autenticado')
        }

        // 1. Submit job to backend
        const formData = new FormData()
        formData.append('file', cnisFile as File)
        formData.append('user_id', user.id)
        formData.append('store_pdf', 'true')
        if (selectedClientId) {
          formData.append('client_id', selectedClientId)
        }

        // Determine which endpoint to use based on tool slug
        const endpoint = activeSlug === 'process_summary'
          ? `${API_URL}/ai/analyses/process-summary-upload`
          : `${API_URL}/ai/analyses/cnis-upload`

        const submitResponse = await fetchWithCredentials(endpoint, {
          method: 'POST',
          body: formData,
        })

        if (!submitResponse.ok) {
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
            result?: { document_id?: string; download_url?: string; content?: string }
            error?: string
          }

          // Update progress bar
          setProgress(statusData.progress || 0)

          if (statusData.status === 'failed') {
            throw new Error(statusData.error || 'Erro ao processar CNIS')
          }

          if (statusData.status === 'completed') {
            // Job completed - get the result
            if (statusData.result?.document_id) {
              // Gerar nova URL assinada via endpoint de download
              const downloadResponse = await fetchWithCredentials(
                `${API_URL}/ai/documents/${encodeURIComponent(statusData.result.document_id)}/download?expires_in=3600`
              )
              if (!downloadResponse.ok) {
                throw new Error('Erro ao gerar URL de download')
              }
              const downloadData = (await downloadResponse.json()) as { download_url: string }
              if (!downloadData.download_url) {
                throw new Error('URL de download não encontrada')
              }

              // Baixar PDF da URL assinada
              const pdfResponse = await fetch(downloadData.download_url)
              if (!pdfResponse.ok) {
                throw new Error('Erro ao baixar PDF')
              }
              const blob = await pdfResponse.blob()
              setCnisPdfUrl(URL.createObjectURL(blob))
            } else if (statusData.result?.content) {
              // Base64 content (fallback)
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
          ...(selectedClientId && { client_id: selectedClientId }),
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
  }, [cnisFile, currentTool, isCnisAnalysis, prompt, setCnisPdfUrl])

  const handleDownload = useCallback(() => {
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
  }, [currentTool?.name, generatedPdfUrl, generatedText, isCnisAnalysis])

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

  if (isAuthLoading || isLoadingTools) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  const tipsButton = (
    <details className="relative z-[60]">
      <summary className="cursor-pointer list-none inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background [&::-webkit-details-marker]:hidden">
        <Info className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">Dicas para melhores resultados</span>
      </summary>
      <div className="absolute left-0 mt-3 w-[320px] rounded-2xl border border-border bg-background/95 backdrop-blur-md shadow-xl p-4 z-[70]">
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
  )

  if (toolId && !currentTool) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ferramenta não encontrada</h1>
          <p className="text-muted-foreground mt-1">Selecione uma opção no menu lateral e tente novamente.</p>
        </div>
        <Link
          to="/app/ia/chat"
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Ir para o Chat
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">IA Juridica</h1>
            {tipsButton}
          </div>
          <p className="text-muted-foreground mt-1">Escolha uma ferramenta no menu lateral e comece a usar.</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="bg-slate-900 p-4 rounded-2xl shadow-lg">
              <Brain className="h-7 w-7 text-white" strokeWidth={1.5} />
            </div>
            <div>
              {currentTool?.name ? <h2 className="text-xl font-bold text-foreground tracking-tight">{currentTool.name}</h2> : null}
              {currentTool?.description ? <p className="text-muted-foreground mt-1">{currentTool.description}</p> : null}
            </div>
          </div>
          <ClientSelector
            value={selectedClientId}
            onChange={(id) => setSelectedClientId(id)}
            className="w-64 flex-shrink-0"
            label="Cliente"
          />
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
  )
}
