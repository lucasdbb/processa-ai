import { useState, useCallback, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Download, FileSearch, FileText, Plus, Trash2, Upload } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn, normalizeMarkdown } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useUser } from '@/features/auth/hooks/use-user'
import { useCreditsStore } from '@/stores/credits-store'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'
import { useFileUpload } from '@/features/ai/hooks/use-file-upload'
import { FunctionalityType } from '@/features/ai/types'
import { analytics } from '@/lib/analytics'


const MAX_FILES = 5

interface ProcessSummaryToolProps {
  selectedClientId?: string | null
  layoutMode?: 'stack' | 'side-by-side'
}

export function ProcessSummaryTool({ selectedClientId, layoutMode = 'side-by-side' }: ProcessSummaryToolProps) {
  const { user, isAuthenticated } = useUser()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const outletContext = useOutletContext<RootLayoutOutletContext | null>()
  const openRegisterModal = outletContext?.openRegisterModal || (() => {})
  const { fetchCredits } = useCreditsStore()
  const { uploadFiles } = useFileUpload()

  const [files, setFiles] = useState<File[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string>('')
  const [generatedText, setGeneratedText] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const previewHtml = useMemo(() => {
    if (!generatedText) return ''
    const normalized = normalizeMarkdown(generatedText)
    return DOMPurify.sanitize(marked.parse(normalized) as string)
  }, [generatedText])

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
      setGeneratedPdfUrl('')
      setGeneratedText('')
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    const allowed = selected.slice(0, MAX_FILES - files.length)
    if (allowed.length > 0) {
      setFiles((prev) => [...prev, ...allowed])
      setGeneratedPdfUrl('')
      setGeneratedText('')
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
    setGeneratedPdfUrl('')
    setGeneratedText('')

    analytics.track('feature_used', {
      feature: 'process_summary',
      action: 'started',
      file_count: files.length
    })

    try {
      // 1. Upload files
      setProgress(10)
      const { uploadMetadata, jobUuid } = await uploadFiles(
        files,
        user.id,
        selectedClientId,
        FunctionalityType.AI,
        (p) => {
          // Upload phase: 10% to 50%
          setProgress(10 + Math.floor((p * 40) / 100))
        }
      )

      if (!uploadMetadata || uploadMetadata.length === 0) {
        throw new Error('Falha no upload dos arquivos')
      }

      // 2. Call Analysis API
      setProgress(50)
      const response = await fetchWithCredentials(`${API_URL}/ai/analyses/process-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: uploadMetadata,
          job_uuid: jobUuid,
          user_id: user.id,
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
        throw new Error('Erro ao iniciar análise')
      }

      const { job_id } = await response.json()
      
      // 3. Poll for results
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetchWithCredentials(`${API_URL}/ai/jobs/${job_id}`)
          if (!statusRes.ok) return

          const statusData = await statusRes.json()
          
          // Processing phase: 50% to 90%
          const backendProgress = statusData.progress || 0
          setProgress(50 + Math.floor((backendProgress * 40) / 100))

          if (statusData.status === 'completed') {
            clearInterval(pollInterval)
            setProgress(100)
            
            if (statusData.result) {
              setGeneratedText(statusData.result.text || '')
              if (statusData.result.pdf_url) {
                setGeneratedPdfUrl(statusData.result.pdf_url)
              }
            }
            
            toast.success('Resumo gerado com sucesso!')
            void fetchCredits() // Refresh credits
            setIsGenerating(false)
            analytics.track('feature_used', {
              feature: 'process_summary',
              action: 'completed',
              success: true
            })
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval)
            throw new Error(statusData.error || 'Falha na análise')
          }
        } catch (error) {
          // Ignore polling errors
        }
      }, 2000)

    } catch (error) {
      console.error(error)
      analytics.track('feature_used', {
        feature: 'process_summary',
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      })
      toast.error(error instanceof Error ? error.message : 'Erro ao processar resumo')
      setIsGenerating(false)
    }
  }, [isAuthenticated, files, openRegisterModal, uploadFiles, selectedClientId, fetchCredits])

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
        {/* Left Column: Input */}
        <div className="flex flex-col h-full min-h-0">
          <div className="flex-1 flex flex-col min-h-0 bg-card border border-border rounded-xl p-4 gap-4">
            <div className="flex-shrink-0">
              <div className="mb-4">
                <label className="block text-sm font-bold text-foreground mb-1">
                  Documentos do Processo <span className="text-destructive">*</span>
                </label>
                <p className="text-sm text-muted-foreground">
                  Envie as peças processuais (PDF).
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 pr-2">
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
              <div className="space-y-2 flex-shrink-0">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Processando...</span>
                  <span className="font-medium text-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            <div className="pt-4 border-t border-border flex-shrink-0">
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
            </div>
          </div>
        </div>

        {/* Right Column: Results */}
        {(generatedText || generatedPdfUrl) ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between flex-shrink-0">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Resultado da Análise
              </h3>
              {generatedPdfUrl && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Baixar PDF
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div 
                className="prose prose-slate dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        ) : (
           layoutMode === 'side-by-side' && (
            <div className="hidden lg:flex items-center justify-center h-full min-h-[400px] border-2 border-dashed border-border/50 rounded-2xl bg-muted/10 text-muted-foreground">
              <div className="text-center max-w-xs p-6">
                 <FileSearch className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                 <p className="text-sm">O resumo do processo aparecerá aqui</p>
              </div>
            </div>
           )
        )}
      </div>
    </div>
  )
}
