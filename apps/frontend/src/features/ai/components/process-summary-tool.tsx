import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { FileSearch, FileText, Plus, Trash2, Upload, History } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { useUser } from '@/features/auth/hooks/use-user'
import { useCreditsStore } from '@/stores/credits-store'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { useOnboardingStore } from '@/features/onboarding'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'
import { useFileUpload } from '@/features/ai/hooks/use-file-upload'
import { FunctionalityType } from '@/features/ai/types'
import { analytics } from '@/lib/analytics'

import { AnalysisHistoryList } from '@/features/ai/components/analysis-history-list'
import { AnalysisResultModal } from '@/features/ai/components/analysis-result-modal'
import { HistoryBottomSheet } from '@/features/ai/components/history-bottom-sheet'
import { useAnalysisHistory } from '@/features/ai/hooks/use-analysis-history'

const MAX_FILES = 5

interface ProcessSummaryToolProps {
  selectedClientId?: string | null
}

export function ProcessSummaryTool({ selectedClientId }: ProcessSummaryToolProps) {
  const { user, isAuthenticated } = useUser()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const outletContext = useOutletContext<RootLayoutOutletContext | null>()
  
  const openRegisterModal = useMemo(
    () => outletContext?.openRegisterModal || (() => {}),
    [outletContext?.openRegisterModal]
  )

  const { fetchCredits } = useCreditsStore()
  const { uploadFiles } = useFileUpload()
  const { markAiToolUsed } = useOnboardingStore()

  const [files, setFiles] = useState<File[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const { data: historyJobs } = useAnalysisHistory('process_summary', selectedClientId, historyRefreshKey)

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
    if (pdfUrlRef.current && pdfUrlRef.current.startsWith('blob:')) {
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
      setPdfUrl('')
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    const allowed = selected.slice(0, MAX_FILES - files.length)
    if (allowed.length > 0) {
      setFiles((prev) => [...prev, ...allowed])
      setPdfUrl('')
    }
    e.target.value = ''
  }

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!isAuthenticated || !user) {
      openRegisterModal()
      return
    }

    if (files.length === 0) {
      toast.error('Por favor, envie ao menos uma peça processual em PDF')
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setPdfUrl('')

    analytics.track('feature_used', {
      feature: 'process_summary',
      action: 'started',
      file_count: files.length,
    })

    try {
      // 1. Upload files (0–20%)
      const UPLOAD_PROGRESS_MAX = 20
      const { uploadMetadata, jobUuid } = await uploadFiles(
        files,
        selectedClientId,
        FunctionalityType.AI,
        (p) => {
          setProgress(Math.round((p / 100) * UPLOAD_PROGRESS_MAX))
        }
      )

      if (!uploadMetadata || uploadMetadata.length === 0) {
        throw new Error('Falha no upload dos arquivos')
      }

      setProgress(UPLOAD_PROGRESS_MAX)

      // 2. Call Analysis API
      const response = await fetchWithCredentials(`${API_URL}/ai/analyses/process-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: uploadMetadata,
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
        let message = 'Erro ao iniciar análise. Tente novamente.'
        try {
          const data = (await response.json()) as { detail?: string }
          if (data?.detail) message = data.detail
        } catch { void 0 }
        throw new Error(message)
      }

      markAiToolUsed()

      const { job_id } = (await response.json()) as { job_id: string }
      if (!job_id) throw new Error('Resposta inválida do servidor')

      // 3. Poll for results (20–100%)
      const maxAttempts = 120
      const pollInterval = 2000

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (controller.signal.aborted) return
        await new Promise((resolve) => setTimeout(resolve, pollInterval))
        if (controller.signal.aborted) return

        const statusRes = await fetchWithCredentials(`${API_URL}/jobs/${encodeURIComponent(job_id)}`)
        if (!statusRes.ok) continue

        const statusData = (await statusRes.json()) as {
          status: string
          progress: number
          result?: { download_url?: string; content?: string; document_id?: string }
          error?: string
        }

        // Map backend progress (0–100) to UI (20–100%)
        const backendProgress = statusData.progress || 0
        setProgress(UPLOAD_PROGRESS_MAX + Math.round((backendProgress / 100) * (100 - UPLOAD_PROGRESS_MAX)))

        if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Falha na análise')
        }

        if (statusData.status === 'completed') {
          setProgress(100)

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
            toast.success('Resumo gerado! O documento foi salvo em "Meus Documentos".')
            setHistoryRefreshKey((k) => k + 1)
            void fetchCredits()
            return
          } else {
            throw new Error('Resultado inválido do servidor')
          }

          toast.success('Resumo gerado com sucesso!')
          setHistoryRefreshKey((k) => k + 1)
          void fetchCredits()
          analytics.track('feature_used', {
            feature: 'process_summary',
            action: 'completed',
            success: true,
          })
          return
        }
      }

      throw new Error('Tempo esgotado. Tente novamente.')
    } catch (error) {
      analytics.track('feature_used', {
        feature: 'process_summary',
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      })
      toast.error(error instanceof Error ? error.message : 'Erro ao processar resumo')
      setProgress(0)
    } finally {
      setIsGenerating(false)
    }
  }, [isAuthenticated, user, files, openRegisterModal, uploadFiles, selectedClientId, setPdfUrl, fetchCredits, markAiToolUsed])

  const handleDownload = useCallback(async () => {
    if (!generatedPdfUrl) return

    try {
      analytics.track('feature_used', { feature: 'process_summary', action: 'downloaded_pdf' })

      const response = await fetch(generatedPdfUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)

      const element = document.createElement('a')
      element.href = url
      element.download = `resumo_processo_${Date.now()}.pdf`
      document.body.appendChild(element)
      element.click()

      window.URL.revokeObjectURL(url)
      document.body.removeChild(element)
    } catch {
      window.open(generatedPdfUrl, '_blank')
    }
  }, [generatedPdfUrl])

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex-1 min-h-0 grid gap-4 grid-cols-1 lg:grid-cols-2 grid-rows-[1fr]">
        {/* Left Column: Input */}
        <div className="flex flex-col h-full min-h-0">
          <div className="flex-1 flex flex-col min-h-0 bg-card border border-border rounded-xl p-4 gap-4">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-4">
              <div>
                <label className="block text-sm sm:text-base font-bold text-foreground mb-1">
                  Documentos do Processo <span className="text-destructive">*</span>
                </label>
                <p className="text-sm text-muted-foreground">
                  Envie as peças processuais (PDF). A IA identificará partes, pedidos, decisões e pontos de atenção.
                </p>
              </div>

              <div>
              {files.length > 0 && (
                <div className="space-y-3 mb-4">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
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
                  files.length > 0 ? "p-4" : "p-8"
                )}
              >
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-upload"
                />

                {files.length > 0 ? (
                  <label
                    htmlFor="file-upload"
                    className="flex items-center justify-center gap-3 cursor-pointer w-full"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-primary">Adicionar mais arquivos</p>
                      <p className="text-xs text-muted-foreground">PDF até 10MB</p>
                    </div>
                  </label>
                ) : (
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center justify-center gap-3 cursor-pointer w-full"
                  >
                    <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                      <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Arraste e solte seus arquivos aqui
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ou clique para selecionar (máx. {MAX_FILES} arquivos)
                      </p>
                    </div>
                    <div className="mt-2 px-4 py-2 bg-foreground text-background text-xs font-semibold rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      Selecionar Arquivos
                    </div>
                  </label>
                )}
              </div>
              </div>

              {isGenerating && (
                <div className="space-y-2 bg-muted/50 border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {progress < 20 ? 'Salvando arquivos...' : 'Processando análise...'}
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
                disabled={isGenerating || files.length === 0}
                className={cn(
                  "flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 w-full disabled:opacity-50 disabled:cursor-not-allowed border border-border",
                  isDark ? "bg-slate-100 text-slate-900 hover:bg-slate-200" : "!bg-[#0d1c34] !text-white hover:!bg-[#0d1c34]/90"
                )}
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2" />
                    <span>Analisando Processo...</span>
                  </>
                ) : (
                  <>
                    <FileSearch className="h-5 w-5 mr-2" />
                    <span>Gerar Resumo do Processo</span>
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
                    <span>Ver histórico de resumos{(historyJobs?.length ?? 0) > 0 ? ` (${historyJobs?.length})` : ''}</span>
                  </button>
                )}
              >
                <AnalysisHistoryList
                  functionality="process_summary"
                  clientId={selectedClientId}
                  title="Histórico de Resumos"
                  refreshKey={historyRefreshKey}
                />
              </HistoryBottomSheet>
            </div>
          </div>
        </div>

        {/* Right Column: History — desktop only */}
        <div className="hidden lg:flex flex-col h-full min-h-0 bg-card border border-border rounded-xl overflow-hidden">
          <AnalysisHistoryList
            functionality="process_summary"
            clientId={selectedClientId}
            title="Histórico de Resumos"
            refreshKey={historyRefreshKey}
          />
        </div>
      </div>

      <AnalysisResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        title="Resumo do Processo"
        pdfUrl={generatedPdfUrl}
        onDownload={handleDownload}
      />
    </div>
  )
}
