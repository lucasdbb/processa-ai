import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Brain } from 'lucide-react'
import { toast } from 'sonner'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { normalizeMarkdown } from '@/lib/utils'
import { AI_TOOLS } from '@/features/ai/ai-tools'
import { ToolsSidebar } from '@/features/ai/components/tools-sidebar'
import type { AiTool, ChatMessage } from '@/features/ai/types'
import { useUser } from '@/features/auth/hooks/use-user'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'

export default function IAPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useUser()
  const { openRegisterModal } = useOutletContext<RootLayoutOutletContext>()

  const tools = useMemo(() => [...AI_TOOLS].sort((a, b) => a.order - b.order), [])
  const [selectedTool, setSelectedTool] = useState(() => tools.find((t) => !t.locked)?.slug || tools[0]?.slug || '')

  const [prompt, setPrompt] = useState('')
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [cnisFile, setCnisFile] = useState<File | null>(null)
  const [cnisFileInputKey, setCnisFileInputKey] = useState(0)

  const [generatedText, setGeneratedText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)

  const currentTool = tools.find((t) => t.slug === selectedTool) || null
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
  }, [])

  const clearCnisFile = useCallback(() => {
    setCnisFile(null)
    setCnisFileInputKey((k) => k + 1)
    setGeneratedText('')
  }, [])

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
        const formData = new FormData()
        formData.append('file', cnisFile as File)

        const response = await fetchWithCredentials(aiEndpoint, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            openRegisterModal()
            return
          }

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
  }, [aiEndpoint, cnisFile, isAuthenticated, isCnisAnalysis, openRegisterModal, prompt, selectedTool])

  const handleDownload = useCallback(() => {
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

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
          if (response.status === 401 || response.status === 403) {
            openRegisterModal()
            return
          }

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
  }, [currentTool?.name, generatedText, isAuthenticated, markdownToRender, openRegisterModal])

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

  if (isAuthLoading) {
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
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

