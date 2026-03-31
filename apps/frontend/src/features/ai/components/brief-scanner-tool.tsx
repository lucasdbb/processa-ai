import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { ScanSearch, Trash2, Upload, FileText, History } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'
import { useOnboardingStore } from '@/features/onboarding'
import { useOutletContext } from 'react-router-dom'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'
import { useFileUpload } from '@/features/ai/hooks/use-file-upload'
import { FunctionalityType } from '@/features/ai/types'
import { analytics } from '@/lib/analytics'

import { AnalysisHistoryList } from '@/features/ai/components/analysis-history-list'
import { AnalysisResultModal } from '@/features/ai/components/analysis-result-modal'
import { HistoryBottomSheet } from '@/features/ai/components/history-bottom-sheet'
import { useAnalysisHistory } from '@/features/ai/hooks/use-analysis-history'

interface BriefScannerToolProps {
  onOpenRegisterModal?: () => void
  selectedClientId?: string | null
}

export function BriefScannerTool({ onOpenRegisterModal: propOpenRegisterModal, selectedClientId }: BriefScannerToolProps) {
  const { isAuthenticated } = useUser()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const outletContext = useOutletContext<RootLayoutOutletContext | null>()
  
  const openRegisterModal = useMemo(
    () => propOpenRegisterModal || outletContext?.openRegisterModal || (() => {}),
    [propOpenRegisterModal, outletContext?.openRegisterModal]
  )

  const { uploadFiles } = useFileUpload()
  const { markAiToolUsed } = useOnboardingStore()

  const [file, setFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const { data: historyJobs } = useAnalysisHistory('brief_scanner', selectedClientId, historyRefreshKey)

  // Abort controller for polling cleanup on unmount
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // Ref para URL do PDF para revogar quando mudar
  const pdfUrlRef = useRef<string | null>(null)

  const setPdfUrl = useCallback((next: string) => {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current)
    }
    pdfUrlRef.current = next || null
    setGeneratedPdfUrl(next)
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      toast.error('Envie um arquivo PDF')
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 10MB')
      return
    }

    setFile(selectedFile)
    setPdfUrl('')
  }, [setPdfUrl])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0 && files[0].type === 'application/pdf') {
      const mockEvent = {
        target: { files }
      } as unknown as React.ChangeEvent<HTMLInputElement>
      handleFileChange(mockEvent)
    }
  }

  const clearFile = useCallback(() => {
    setFile(null)
    setFileInputKey((k) => k + 1)
    setPdfUrl('')
    setProgress(0)
  }, [setPdfUrl])

  const handleGenerate = useCallback(async () => {
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

    if (!file) {
      toast.error('Por favor, envie a peça processual em PDF')
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setPdfUrl('')

    analytics.track('feature_used', {
      feature: 'brief_scanner',
      action: 'started',
      file_size: file.size
    })

    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        openRegisterModal()
        return
      }

      // 1. Upload file with progress
      const UPLOAD_PROGRESS_MAX = 20

      const { uploadMetadata, jobUuid: commonJobUuid } = await uploadFiles(
        [file],
        selectedClientId,
        FunctionalityType.AI,
        (uploadProgress) => {
          const uiProgress = Math.round((uploadProgress / 100) * UPLOAD_PROGRESS_MAX)
          setProgress(uiProgress)
        }
      )

      setProgress(UPLOAD_PROGRESS_MAX)

      const fileMetadata = uploadMetadata[0]

      // 2. Start analysis job
      const submitResponse = await fetchWithCredentials(`${API_URL}/ai/analyses/brief-scanner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: fileMetadata.storage_path,
          bucket: fileMetadata.bucket,
          files: uploadMetadata,
          job_uuid: commonJobUuid,
          client_id: selectedClientId || undefined,
          functionality: FunctionalityType.AI,
          store_pdf: true,
        }),
      })

      if (!submitResponse.ok) {
        if (submitResponse.status === 401 || submitResponse.status === 403) {
          openRegisterModal()
          return
        }

        let message = 'Erro ao iniciar análise. Tente novamente.'
        try {
          const data = (await submitResponse.json()) as { detail?: string }
          if (data?.detail) message = data.detail
        } catch {
          void 0
        }
        throw new Error(message)
      }

      markAiToolUsed()

      const submitData = (await submitResponse.json()) as { job_id: string }
      if (!submitData.job_id) {
        throw new Error('Resposta inválida do servidor')
      }

      // 3. Poll for job completion
      const jobId = submitData.job_id
      const maxAttempts = 120
      const pollInterval = 2000

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (controller.signal.aborted) return
        await new Promise((resolve) => setTimeout(resolve, pollInterval))
        if (controller.signal.aborted) return

        const statusResponse = await fetchWithCredentials(`${API_URL}/ai/jobs/${encodeURIComponent(jobId)}`)
        if (!statusResponse.ok) continue

        const statusData = (await statusResponse.json()) as {
          status: string
          progress: number
          result?: { download_url?: string; content?: string; document_id?: string }
          error?: string
        }

        // Map backend progress (0-100) to UI progress (20-100)
        const backendProgress = statusData.progress || 0
        const uiProgress = UPLOAD_PROGRESS_MAX + Math.round((backendProgress / 100) * (100 - UPLOAD_PROGRESS_MAX))
        setProgress(uiProgress)

        if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Erro ao processar peça. Tente novamente.')
        }

        if (statusData.status === 'completed') {
          if (statusData.result?.download_url) {
            setPdfUrl(statusData.result.download_url)
            setIsResultModalOpen(true)
          } else if (statusData.result?.content) {
            const binary = atob(statusData.result.content)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
            const blob = new Blob([bytes], { type: 'application/pdf' })
            setPdfUrl(URL.createObjectURL(blob))
            setIsResultModalOpen(true)
          } else if (statusData.result?.document_id) {
            toast.success('Análise concluída! O documento foi salvo em "Meus Documentos".')
            setHistoryRefreshKey((k) => k + 1)
            return
          } else {
            throw new Error('Resultado inválido do servidor')
          }

          toast.success('Análise da peça concluída com sucesso!')
          setHistoryRefreshKey((k) => k + 1)
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
      setProgress(0)
    } finally {
      setIsGenerating(false)
    }
  }, [isAuthenticated, file, setPdfUrl, openRegisterModal, uploadFiles, selectedClientId, markAiToolUsed])

  const handleDownload = useCallback(async () => {
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

    if (!generatedPdfUrl) return

    try {
      analytics.track('feature_used', {
        feature: 'brief_scanner',
        action: 'downloaded_pdf',
      })

      const response = await fetch(generatedPdfUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)

      const element = document.createElement('a')
      element.href = url
      element.download = `analise_scanner_${Date.now()}.pdf`
      document.body.appendChild(element)
      element.click()

      window.URL.revokeObjectURL(url)
      document.body.removeChild(element)
    } catch (error) {
      window.open(generatedPdfUrl, '_blank')
    }
  }, [generatedPdfUrl, isAuthenticated, openRegisterModal])

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex-1 min-h-0 grid gap-4 grid-cols-1 lg:grid-cols-2 grid-rows-[1fr]">
        {/* Left Column: Input */}
        <div className="flex flex-col h-full min-h-0">
          <div className="flex-1 flex flex-col min-h-0 bg-card border border-border rounded-xl p-4 gap-4">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
              <div>
                <label htmlFor="scanner-file" className="block text-sm sm:text-base font-bold text-foreground mb-1">
                  Envie a peça processual (PDF) <span className="text-destructive">*</span>
                </label>
                <p className="text-sm text-muted-foreground">
                  Anexe a petição, contestação, recurso ou outra peça que deseja analisar. A IA identificará teses frágeis,
                  pedidos faltantes, riscos e oportunidades de melhoria.
                </p>
              </div>

              <div>
              {file ? (
                <div className="border-2 border-border rounded-xl bg-card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{file.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • PDF
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearFile}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-accent transition-colors text-xs font-medium"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    'border-2 border-dashed rounded-xl transition-all cursor-pointer group',
                    isDragging
                      ? 'border-primary bg-primary/5 scale-[1.01]'
                      : 'border-border bg-muted/10 hover:bg-muted/30 hover:border-primary/50'
                  )}
                >
                  <input
                    key={fileInputKey}
                    id="scanner-file"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="scanner-file"
                    className="flex flex-col items-center justify-center py-6 px-6 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200">
                      <Upload className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-center space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">
                        <span className="text-primary">Clique para escolher</span> ou arraste o arquivo
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PDF até 10MB
                      </p>
                    </div>
                  </label>
                </div>
              )}
              </div>

              {isGenerating && (
                <div className="space-y-2 bg-muted/50 border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {progress < 20 ? 'Salvando arquivo...' : 'Analisando peça processual...'}
                    </span>
                    <span className="text-muted-foreground font-mono">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>
              )}
            </div>

            {/* Fixed bottom actions */}
            <div className="flex-shrink-0 pt-4 border-t border-border">
              <button
                onClick={handleGenerate}
                disabled={!file || isGenerating}
                className={cn(
                  "flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 w-full disabled:opacity-50 disabled:cursor-not-allowed border border-border",
                  isDark ? "bg-slate-100 text-slate-900 hover:bg-slate-200" : "!bg-[#0d1c34] !text-white hover:!bg-[#0d1c34]/90"
                )}
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2" />
                    <span>Analisando Peça...</span>
                  </>
                ) : (
                  <>
                    <ScanSearch className="h-5 w-5 mr-2" />
                    <span>Analisar Peça</span>
                  </>
                )}
              </button>

              {/* History trigger — mobile only */}
              <HistoryBottomSheet
                itemCount={historyJobs?.length ?? 0}
                trigger={(open) => (
                  <button
                    type="button"
                    onClick={open}
                    className="lg:hidden flex items-center justify-center gap-2 w-full mt-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <History className="h-4 w-4" />
                    <span>Ver histórico de análises{(historyJobs?.length ?? 0) > 0 ? ` (${historyJobs?.length})` : ''}</span>
                  </button>
                )}
              >
                <AnalysisHistoryList
                  functionality="brief_scanner"
                  clientId={selectedClientId}
                  title="Histórico de Análises de Peças"
                  refreshKey={historyRefreshKey}
                />
              </HistoryBottomSheet>
            </div>
          </div>
        </div>

        {/* Right Column: History — desktop only */}
        <div className="hidden lg:flex flex-col h-full min-h-0 bg-card border border-border rounded-xl overflow-hidden">
          <AnalysisHistoryList
            functionality="brief_scanner"
            clientId={selectedClientId}
            title="Histórico de Análises de Peças"
            refreshKey={historyRefreshKey}
          />
        </div>
      </div>

      <AnalysisResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        title="Análise da Peça"
        pdfUrl={generatedPdfUrl}
        onDownload={handleDownload}
      />
    </div>
  )
}
