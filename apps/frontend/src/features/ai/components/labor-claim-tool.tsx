import { useState, useRef, useCallback, useMemo, useLayoutEffect, useEffect } from 'react'
import { FileText, Gavel, Trash2, Upload, Plus } from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { cn, normalizeMarkdown } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'
import { useOutletContext } from 'react-router-dom'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'
import { useFileUpload } from '@/features/ai/hooks/use-file-upload'
import { FunctionalityType } from '@/features/ai/types'
import { analytics } from '@/lib/analytics'


const MAX_FILES = 5

import { AnalysisHistoryList } from '@/features/ai/components/analysis-history-list'
import { AnalysisResultModal } from '@/features/ai/components/analysis-result-modal'

interface LaborClaimToolProps {
  selectedClientId?: string | null
  layoutMode?: 'stack' | 'side-by-side'
}

export function LaborClaimTool({ selectedClientId, layoutMode = 'side-by-side' }: LaborClaimToolProps) {
  const { user, isAuthenticated } = useUser()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const outletContext = useOutletContext<RootLayoutOutletContext | null>()
  const openRegisterModal = outletContext?.openRegisterModal || (() => {})
  const { uploadFiles } = useFileUpload()

  const [prompt, setPrompt] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState('')
  const [generatedText, setGeneratedText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [])

  const resizePromptTextarea = useCallback(() => {
    const el = promptTextareaRef.current
    if (!el) return

    const minHeight = 160
    const maxHeight = 400

    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${Math.max(next, minHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  const markdownToRender = normalizeMarkdown(generatedText)
  const previewHtml = useMemo(() => {
    if (!markdownToRender) return ''
    return DOMPurify.sanitize(marked.parse(markdownToRender) as string)
  }, [markdownToRender])

  useLayoutEffect(() => {
    resizePromptTextarea()
  }, [prompt, resizePromptTextarea])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === 'application/pdf'
    )
    if (droppedFiles.length === 0) return

    const allowed = droppedFiles.slice(0, MAX_FILES - files.length)
    if (allowed.length > 0) {
      setFiles((prev) => [...prev, ...allowed])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    const allowed = selected.slice(0, MAX_FILES - files.length)
    if (allowed.length > 0) {
      setFiles((prev) => [...prev, ...allowed])
    }
    e.target.value = ''
  }

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleGenerate = async () => {
    if (!isAuthenticated || !user) {
      openRegisterModal()
      return
    }

    if (!prompt.trim() || prompt.length < 50) {
      toast.error('Por favor, descreva os fatos com mais detalhes (mínimo 50 caracteres)')
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setGeneratedPdfUrl('')
    setGeneratedText('')

    analytics.track('feature_used', {
      feature: 'labor_claim',
      action: 'started',
      file_count: files.length,
      prompt_length: prompt.length
    })

    try {
      // 1. Upload files if any
      let uploadedFiles: any[] = []
      let jobUuid = ''

      if (files.length > 0) {
        setProgress(10)
        const result = await uploadFiles(
          files,
          selectedClientId,
          FunctionalityType.AI,
          (p) => {
            setProgress(10 + Math.floor((p * 30) / 100))
          }
        )
        uploadedFiles = result.uploadMetadata || []
        jobUuid = result.jobUuid || ''
      }

      // 2. Call Analysis API
      setProgress(40)
      const response = await fetchWithCredentials(`${API_URL}/ai/analyses/labor-claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          files: uploadedFiles,
          job_uuid: jobUuid,
          client_id: selectedClientId || undefined,
          functionality: FunctionalityType.AI,
          store_pdf: true,
        }),
      })

      if (!response.ok) {
        if (response.status === 402) {
          toast.error('Créditos insuficientes')
          return
        }
        throw new Error('Erro ao gerar reclamação')
      }

      const { job_id } = await response.json()
      
      // 3. Poll for results
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetchWithCredentials(`${API_URL}/ai/jobs/${job_id}`)
          if (!statusRes.ok) return

          const statusData = await statusRes.json()

          const backendProgress = statusData.progress || 0
          setProgress(40 + Math.floor((backendProgress * 60) / 100))

          if (statusData.status === 'completed') {
            if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null }
            setProgress(100)

            if (statusData.result) {
              setGeneratedText(statusData.result.text || '')
              if (statusData.result.pdf_url || statusData.result.download_url) {
                setGeneratedPdfUrl(statusData.result.pdf_url || statusData.result.download_url)
              }
              setIsResultModalOpen(true)
            }

            toast.success('Reclamação trabalhista gerada com sucesso!')
            setHistoryRefreshKey((k) => k + 1)
            setIsGenerating(false)
            analytics.track('feature_used', {
              feature: 'labor_claim',
              action: 'completed',
              success: true
            })
          } else if (statusData.status === 'failed') {
            if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null }
            setIsGenerating(false)
            const errorMessage = statusData.error || 'Falha na geração'
            toast.error(errorMessage)

            analytics.track('feature_used', {
              feature: 'labor_claim',
              action: 'failed',
              error: errorMessage,
              success: false
            })
          }
        } catch (error) {
          console.error('Polling error:', error)
        }
      }, 2000)

    } catch (error) {
      console.error(error)
      analytics.track('feature_used', {
        feature: 'labor_claim',
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      })
      toast.error(error instanceof Error ? error.message : 'Erro ao processar')
      setIsGenerating(false)
    }
  }

  const handleDownload = useCallback(async () => {
    if (!generatedPdfUrl) return

    try {
      analytics.track('feature_used', { feature: 'labor_claim', action: 'downloaded_pdf' })

      const response = await fetch(generatedPdfUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      
      const element = document.createElement('a')
      element.href = url
      element.download = `reclamacao_trabalhista_${Date.now()}.pdf`
      document.body.appendChild(element)
      element.click()
      
      window.URL.revokeObjectURL(url)
      document.body.removeChild(element)
    } catch (error) {
      console.error('Download failed:', error)
      window.open(generatedPdfUrl, '_blank')
    }
  }, [generatedPdfUrl])

  return (
    <div className="h-full flex flex-col gap-4">
      <div className={cn(
        "flex-1 min-h-0 grid gap-4 transition-all duration-300 ease-in-out",
        layoutMode === 'side-by-side' ? "lg:grid-cols-2 lg:items-start" : "grid-cols-1"
      )}>
        {/* Left Column: Inputs */}
        <div className="flex flex-col h-full min-h-0">
          <div className="flex-1 flex flex-col min-h-0 bg-card border border-border rounded-xl p-4 gap-4">
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-4">
              <div className="flex-shrink-0">
                <div className="mb-4">
                  <label className="block text-sm font-bold text-foreground mb-1">
                    Relato dos Fatos <span className="text-destructive">*</span>
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Descreva detalhadamente o caso, incluindo datas e valores.
                  </p>
                </div>

                <div className="relative">
                  <textarea
                    ref={promptTextareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ex: O reclamante foi admitido em 10/01/2020 e demitido sem justa causa em 15/05/2023. Recebia salário de R$ 2.500,00. Trabalhava das 08h às 19h com 30min de intervalo..."
                    className="w-full min-h-[120px] p-4 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-all shadow-sm text-foreground placeholder:text-muted-foreground text-sm leading-relaxed"
                    disabled={isGenerating}
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-background/80 px-2 rounded-md">
                    {prompt.length} caracteres
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0">
                <h3 className="text-base font-semibold text-foreground mb-2">Documentos Complementares (Opcional)</h3>
                
                {files.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "border-2 border-dashed rounded-xl transition-colors text-center cursor-pointer group",
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/30 hover:border-primary/50",
                      files.length > 0 ? "p-3" : "p-6"
                    )}
                  >
                    <input
                        type="file"
                        accept="application/pdf"
                        multiple
                        onChange={handleFileInput}
                        className="hidden"
                        id="labor-file-upload"
                      />

                    {files.length > 0 ? (
                      <label
                        htmlFor="labor-file-upload"
                        className="flex items-center justify-center gap-3 cursor-pointer w-full"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Plus className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-primary">Adicionar mais arquivos</p>
                        </div>
                      </label>
                    ) : (
                      <label
                        htmlFor="labor-file-upload"
                        className="flex flex-col items-center justify-center gap-2 cursor-pointer w-full"
                      >
                        <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                          <Upload className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Arraste PDFs aqui ou clique para selecionar
                          </p>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                {isGenerating && (
                  <div className="space-y-2 flex-shrink-0">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Elaborando petição...</span>
                      <span className="font-medium text-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}
            </div>

            <div className="flex-shrink-0 pt-4 border-t border-border">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className={cn(
                  "w-full py-4 rounded-xl font-semibold text-base transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-border",
                  isDark ? "bg-slate-100 text-slate-900 hover:bg-slate-200" : "!bg-[#0d1c34] !text-white hover:!bg-[#0d1c34]/90"
                )}
              >
                {isGenerating ? (
                  <>
                    <Gavel className="h-5 w-5 animate-pulse" />
                    Gerando Reclamação...
                  </>
                ) : (
                  <>
                    <Gavel className="h-5 w-5" />
                    Gerar Reclamação Trabalhista
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: History */}
        <div className="flex flex-col h-full min-h-0 bg-card border border-border rounded-xl overflow-hidden">
          <AnalysisHistoryList
            functionality="labor_claim"
            clientId={selectedClientId}
            title="Histórico de Reclamações"
            refreshKey={historyRefreshKey}
          />
        </div>
      </div>

      <AnalysisResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        title="Reclamação Trabalhista"
        pdfUrl={generatedPdfUrl}
        htmlContent={generatedText ? previewHtml : undefined}
        onDownload={handleDownload}
      />
    </div>
  )
}
