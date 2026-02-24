import { useState, useCallback, useMemo } from 'react'
import { Download, FileText, Plus, ScanSearch, Trash2, Upload } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { normalizeMarkdown } from '@/lib/utils'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'
import { useOutletContext } from 'react-router-dom'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'
import { useFileUpload } from '@/features/ai/hooks/use-file-upload'
import { FunctionalityType } from '@/features/ai/types'
import { analytics } from '@/lib/analytics'


interface BriefScannerToolProps {
  onOpenRegisterModal?: () => void
  selectedClientId?: string | null
  layoutMode?: 'stack' | 'side-by-side'
}

export function BriefScannerTool({ onOpenRegisterModal: propOpenRegisterModal, selectedClientId, layoutMode = 'side-by-side' }: BriefScannerToolProps) {
  const { isAuthenticated } = useUser()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const outletContext = useOutletContext<RootLayoutOutletContext | null>()
  const openRegisterModal = propOpenRegisterModal || outletContext?.openRegisterModal || (() => {})
  const { uploadFiles } = useFileUpload()

  const [files, setFiles] = useState<File[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState('')
  const [generatedText, setGeneratedText] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const markdownToRender = normalizeMarkdown(generatedText)
  const previewHtml = useMemo(() => {
    if (!markdownToRender) return ''
    return DOMPurify.sanitize(marked.parse(markdownToRender) as string)
  }, [markdownToRender])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleFilesChange = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter((f) => {
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) {
        toast.error(`${f.name}: apenas arquivos PDF são permitidos`)
        return false
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name}: o arquivo deve ter no máximo 10MB`)
        return false
      }
      return true
    })
    setFiles(valid)
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === 'application/pdf'
    )
    if (droppedFiles.length === 0) return

    const maxFiles = 5
    const currentCount = files.length
    const allowed = droppedFiles.slice(0, maxFiles - currentCount)
    if (allowed.length > 0) {
      handleFilesChange([...files, ...allowed])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    const maxFiles = 5
    const currentCount = files.length
    const allowed = selected.slice(0, maxFiles - currentCount)
    if (allowed.length > 0) {
      handleFilesChange([...files, ...allowed])
    }
    e.target.value = ''
  }

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

    if (files.length === 0) {
      toast.error('Por favor, envie ao menos uma peça processual em PDF')
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setGeneratedText('')
    setGeneratedPdfUrl('')

    analytics.track('feature_used', {
      feature: 'brief_scanner',
      action: 'started',
      file_count: files.length
    })

    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        openRegisterModal()
        return
      }

      // 1. Upload files with progress
      const UPLOAD_PROGRESS_MAX = 20 // 20% reserved for uploads
      
      const { uploadMetadata, jobUuid: commonJobUuid } = await uploadFiles(
        files, 
        user.id, 
        selectedClientId,
        FunctionalityType.AI,
        (uploadProgress) => {
          // Map 0-100 upload progress to 0-20 UI progress
          const uiProgress = Math.round((uploadProgress / 100) * UPLOAD_PROGRESS_MAX)
          setProgress(uiProgress)
        }
      )
      
      // Ensure we are at least at UPLOAD_PROGRESS_MAX
      setProgress(UPLOAD_PROGRESS_MAX)

      // 3. Start analysis job
      const endpoint = `${API_URL}/ai/analyses/brief-scanner`

      const payload: Record<string, unknown> = {
        user_id: user.id,
        client_id: selectedClientId || undefined,
        store_pdf: true,
        job_uuid: commonJobUuid || undefined,
        files: uploadMetadata,
      }

      const submitResponse = await fetchWithCredentials(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!submitResponse.ok) {
        if (submitResponse.status === 401 || submitResponse.status === 403) {
          openRegisterModal()
          return
        }

        let message = 'Erro ao enviar. Tente novamente.'
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

      // Poll for job completion
      const jobId = submitData.job_id
      const maxAttempts = 120
      const pollInterval = 2000

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval))

        const statusResponse = await fetchWithCredentials(`${API_URL}/ai/jobs/${encodeURIComponent(jobId)}`)
        if (!statusResponse.ok) continue

        const statusData = (await statusResponse.json()) as {
          status: string
          progress: number
          result?: { download_url?: string; content?: string }
          error?: string
        }

        // Map backend progress (0-100) to UI progress (20-100)
        // because 0-20 is reserved for upload
        const backendProgress = statusData.progress || 0
        const uiProgress = 20 + Math.round((backendProgress / 100) * 80)
        setProgress(uiProgress)

        if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Erro ao processar. Tente novamente.')
        }

        if (statusData.status === 'completed') {
          if (statusData.result?.download_url) {
            setGeneratedPdfUrl(statusData.result.download_url)
          } else if (statusData.result?.content) {
            const binary = atob(statusData.result.content)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
            const blob = new Blob([bytes], { type: 'application/pdf' })
            setGeneratedPdfUrl(URL.createObjectURL(blob))
          } else {
            throw new Error('Resultado inválido do servidor')
          }

          toast.success('Análise da peça concluída com sucesso!')
          analytics.track('feature_used', {
            feature: 'brief_scanner',
            action: 'completed',
            success: true
          })
          return
        }
      }

      throw new Error('Tempo esgotado. Tente novamente.')
    } catch (error) {
      analytics.track('feature_used', {
        feature: 'brief_scanner',
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      })
      toast.error(error instanceof Error ? error.message : 'Erro ao analisar peça')
    } finally {
      setIsGenerating(false)
    }
  }, [files, isAuthenticated, openRegisterModal])

  const handleDownload = useCallback(async () => {
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

    if (generatedPdfUrl) {
      try {
        analytics.track('feature_used', {
          feature: 'brief_scanner',
          action: 'downloaded_pdf',
        })
        
        // Fetch blob to force download
        const response = await fetch(generatedPdfUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)

        const element = document.createElement('a')
        element.href = url
        element.download = `analise_scanner_${Date.now()}.pdf`
        document.body.appendChild(element)
        element.click()
        
        // Cleanup
        window.URL.revokeObjectURL(url)
        document.body.removeChild(element)
      } catch (error) {
        console.error('Download failed:', error)
        // Fallback to direct link
        window.open(generatedPdfUrl, '_blank')
      }
      return
    }
  }, [generatedPdfUrl, isAuthenticated, openRegisterModal])

  const canGenerate = files.length > 0 && !isGenerating
  const hasResult = !!generatedPdfUrl || !!generatedText

  return (
    <div className="h-full flex flex-col gap-4">
      <div className={cn(
        "flex-1 min-h-0 grid gap-4 transition-all duration-300 ease-in-out",
        layoutMode === 'side-by-side' ? "lg:grid-cols-2 lg:items-start" : "grid-cols-1"
      )}>
        {/* Left Column: Input */}
        <div className="flex flex-col h-full min-h-0">
          <div className="flex-1 flex flex-col min-h-0 bg-card border border-border rounded-xl p-4 gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-bold text-foreground mb-1">
                    Envie a(s) peça(s) processual(is) <span className="text-destructive">*</span>
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Anexe petições, contestações, recursos ou outras peças que deseja analisar. A IA identificará teses frágeis,
                    pedidos faltantes, riscos e oportunidades de melhoria.
                  </p>
                </div>
              </div>
            </div>

            {/* Lista de arquivos e Dropzone */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-2">
              {files.length > 0 && (
                <div className="space-y-2 mb-3">
                  {files.map((file, index) => (
                    <div key={`${file.name}-${file.size}`} className="border border-border rounded-xl bg-card p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{file.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(index)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-accent transition-colors text-sm"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {files.length < 5 && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    'border-2 border-dashed rounded-xl transition-all cursor-pointer group',
                    isDragging
                      ? 'border-primary bg-primary/5 scale-[1.01]'
                      : 'border-border bg-muted/10 hover:bg-muted/30 hover:border-primary/50',
                    files.length > 0 ? 'py-4' : ''
                  )}
                >
                  <input
                    id="scanner-files"
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <label
                    htmlFor="scanner-files"
                    className={cn(
                      "flex flex-col items-center justify-center cursor-pointer",
                      files.length > 0 ? "py-4 px-4 flex-row gap-4" : "py-10 px-6"
                    )}
                  >
                    <div className={cn(
                      "rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-200",
                      files.length > 0 ? "w-10 h-10" : "w-12 h-12 mb-4"
                    )}>
                      {files.length > 0 ? (
                        <Plus className={cn("text-primary", files.length > 0 ? "h-5 w-5" : "h-6 w-6")} />
                      ) : (
                        <Upload className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div className={cn("text-center", files.length > 0 && "text-left")}>
                      <p className="text-sm font-semibold text-foreground">
                        {files.length > 0 ? (
                          <span className="text-primary">Adicionar mais arquivos</span>
                        ) : (
                          <>
                            <span className="text-primary">Clique para escolher</span> ou arraste
                          </>
                        )}
                      </p>
                      {!files.length && (
                        <p className="text-xs text-muted-foreground mt-1">
                          PDF (até 10MB) • Máx {5 - files.length} arqs
                        </p>
                      )}
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Barra de progresso */}
            {isGenerating && (
              <div className="flex-shrink-0 space-y-2 bg-muted/50 border border-border rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {progress < 20
                      ? 'Salvando arquivo(s)...'
                      : progress < 40
                        ? 'Extraindo texto das pecas...'
                        : progress < 95
                          ? 'Analisando argumentos e identificando fragilidades...'
                          : 'Finalizando relatorio...'}
                  </span>
                  <span className="text-muted-foreground font-mono">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>
            )}

            {/* Botao analisar */}
            <div className="flex-shrink-0 pt-4 border-t border-border">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={cn(
                  "flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 w-full disabled:opacity-50 disabled:cursor-not-allowed border border-border",
                  isDark ? "bg-slate-100 text-slate-900 hover:bg-slate-200" : "!bg-[#0d1c34] !text-white hover:!bg-[#0d1c34]/90"
                )}
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2" />
                    <span>Analisando Peça{files.length > 1 ? 's' : ''}...</span>
                  </>
                ) : (
                  <>
                    <ScanSearch className="h-5 w-5 mr-2" />
                    <span>Analisar Peça{files.length > 1 ? 's' : ''}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Results */}
        {generatedPdfUrl ? (
          <div role="region" aria-labelledby="result-heading" className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h3 id="result-heading" className="text-base font-semibold text-foreground">
                Relatorio de Analise
              </h3>
              <button
                onClick={handleDownload}
                aria-label="Baixar como PDF"
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                title="Baixar PDF"
              >
                <Download className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className={cn(
              "bg-muted/30 border border-border rounded-2xl p-8 shadow-inner flex-1 min-h-0",
              layoutMode === 'side-by-side' ? "" : "h-[70vh]"
            )}>
              <iframe
                title="Relatorio de Analise"
                src={generatedPdfUrl}
                className="w-full h-full rounded-xl border border-border bg-background"
              />
            </div>
          </div>
        ) : hasResult && previewHtml ? (
          /* Resultado em HTML */
          <div role="region" aria-labelledby="result-heading" className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 id="result-heading" className="text-lg font-bold text-foreground">
                Relatorio de Analise
              </h3>
              <button
                onClick={handleDownload}
                aria-label="Baixar documento"
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                title="Baixar"
              >
                <Download className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className={cn(
               "bg-muted/30 border border-border rounded-2xl p-8 shadow-inner flex-1 min-h-0 overflow-y-auto",
               layoutMode === 'side-by-side' ? "" : ""
            )}>
              <div
                className="prose prose-lg max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        ) : (
           layoutMode === 'side-by-side' && (
            <div className="hidden lg:flex items-center justify-center h-full min-h-[400px] border-2 border-dashed border-border/50 rounded-2xl bg-muted/10 text-muted-foreground">
              <div className="text-center max-w-xs p-6">
                 <ScanSearch className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                 <p className="text-sm">O resultado da análise aparecerá aqui</p>
              </div>
            </div>
           )
        )}
      </div>
    </div>
  )
}
