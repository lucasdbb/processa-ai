import { useState, useRef, useCallback } from 'react'
import { Download, Sparkles, Trash2, Upload, FileText, Columns, Rows } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'
import { useOutletContext } from 'react-router-dom'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'
import { useFileUpload } from '@/features/ai/hooks/use-file-upload'
import { FunctionalityType } from '@/features/ai/types'

import { ClientSelector } from '@/components/forms/client-selector'

interface CnisAnalysisToolProps {
  onOpenRegisterModal?: () => void
  selectedClientId?: string | null
  layoutMode?: 'stack' | 'side-by-side'
}

export function CnisAnalysisTool({ onOpenRegisterModal, selectedClientId, layoutMode = 'stack' }: CnisAnalysisToolProps) {
  const { isAuthenticated } = useUser()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const outletContext = useOutletContext<RootLayoutOutletContext | null>()
  const openRegisterModal = onOpenRegisterModal || outletContext?.openRegisterModal || (() => {})
  const { uploadFiles } = useFileUpload()

  const [cnisFile, setCnisFile] = useState<File | null>(null)
  const [cnisFileInputKey, setCnisFileInputKey] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  
  // Ref para URL do PDF para revogar quando mudar
  const cnisPdfUrlRef = useRef<string | null>(null)

  const setCnisPdfUrl = useCallback((next: string) => {
    if (cnisPdfUrlRef.current) {
      URL.revokeObjectURL(cnisPdfUrlRef.current)
    }
    cnisPdfUrlRef.current = next || null
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

  const handleCnisFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
    setCnisPdfUrl('')
  }, [setCnisPdfUrl])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0 && files[0].type === 'application/pdf') {
      const mockEvent = {
        target: { files }
      } as unknown as React.ChangeEvent<HTMLInputElement>
      handleCnisFileChange(mockEvent)
    }
  }

  const clearCnisFile = useCallback(() => {
    setCnisFile(null)
    setCnisFileInputKey((k) => k + 1)
    setCnisPdfUrl('')
    setProgress(0)
  }, [setCnisPdfUrl])

  const handleGenerate = useCallback(async () => {
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

    if (!cnisFile) {
      toast.error('Por favor, envie o CNIS em PDF')
      return
    }

    setIsGenerating(true)

    try {
      // Get user from Supabase session
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        openRegisterModal()
        return
      }

      // 1. Upload files with progress
      const UPLOAD_PROGRESS_MAX = 20 // 20% reserved for uploads
      
      const { uploadMetadata, jobUuid: commonJobUuid } = await uploadFiles(
        [cnisFile], 
        user.id, 
        selectedClientId,
        FunctionalityType.AI,
        (uploadProgress) => {
          const uiProgress = Math.round((uploadProgress / 100) * UPLOAD_PROGRESS_MAX)
          setProgress(uiProgress)
        }
      )
      
      // Ensure we are at least at UPLOAD_PROGRESS_MAX
      setProgress(UPLOAD_PROGRESS_MAX)
      
      const fileMetadata = uploadMetadata[0]

      // 3. Start analysis job
      const submitResponse = await fetchWithCredentials(`${API_URL}/ai/analyses/cnis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: fileMetadata.storage_path,
          bucket: fileMetadata.bucket,
          files: uploadMetadata,
          job_uuid: commonJobUuid,
          user_id: user.id,
          client_id: selectedClientId || undefined,
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

      const submitData = (await submitResponse.json()) as { job_id: string }
      if (!submitData.job_id) {
        throw new Error('Resposta inválida do servidor')
      }

      // 4. Poll for job completion
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
          result?: { download_url?: string; content?: string; document_id?: string }
          error?: string
        }

        // Map backend progress (0-100) to UI progress
        const backendProgress = statusData.progress || 0
        const UPLOAD_PROGRESS_MAX = 20
        const uiProgress = UPLOAD_PROGRESS_MAX + Math.round((backendProgress / 100) * (100 - UPLOAD_PROGRESS_MAX))
        setProgress(uiProgress)

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
          } else if (statusData.result?.document_id) {
             // Se tiver document_id mas não url/content, pode ser que o worker não gerou a URL ou expirou.
             // Idealmente o worker deve retornar download_url.
             // Se cair aqui, vamos considerar sucesso mas avisar que o PDF está salvo em Documentos.
             toast.success('Análise concluída! O documento foi salvo em "Meus Documentos".')
             return
          } else {
            throw new Error('Resultado inválido do servidor')
          }

          toast.success('CNIS analisado com sucesso!')
          return
        }

        // Still processing - continue polling
      }

      throw new Error('Tempo esgotado. Tente novamente.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao processar CNIS')
      setProgress(0)
    } finally {
      setIsGenerating(false)
    }
  }, [isAuthenticated, cnisFile, openRegisterModal, setCnisPdfUrl])

  const handleDownload = useCallback(() => {
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

    if (!generatedPdfUrl) return

    const element = document.createElement('a')
    element.href = generatedPdfUrl
    element.download = `analise_cnis_${Date.now()}.pdf`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }, [generatedPdfUrl, isAuthenticated, openRegisterModal])

  return (
    <div className="h-full flex flex-col gap-4">
      <div className={cn(
        "flex-1 min-h-0 grid gap-4 transition-all duration-300 ease-in-out",
        layoutMode === 'side-by-side' ? "lg:grid-cols-2 lg:items-start" : "grid-cols-1"
      )}>
        {/* Left Column: Inputs */}
        <div className="flex flex-col h-full min-h-0">
          <div className="flex-1 flex flex-col min-h-0 bg-card border border-border rounded-xl p-4 gap-4">
            <div className="flex-shrink-0">
              <div className="mb-4">
                <label htmlFor="cnis-file" className="block text-sm font-bold text-foreground mb-1">
                  Envie o CNIS (PDF) <span className="text-destructive">*</span>
                </label>
                <p className="text-sm text-muted-foreground">
                  Anexe o extrato previdenciário (CNIS) completo em PDF. A IA identificará vínculos, 
                  remunerações e possíveis inconsistências.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {cnisFile ? (
                <div className="border-2 border-border rounded-xl bg-card p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{cnisFile.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(cnisFile.size / (1024 * 1024)).toFixed(2)} MB • PDF
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearCnisFile}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:bg-accent transition-colors text-sm font-medium"
                    >
                      <Trash2 className="h-4 w-4" />
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
                    key={cnisFileInputKey}
                    id="cnis-file"
                    type="file"
                    accept="application/pdf"
                    onChange={handleCnisFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="cnis-file"
                    className="flex flex-col items-center justify-center py-10 px-6 cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-center space-y-1">
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
              <div className="flex-shrink-0 space-y-2 bg-muted/50 border border-border rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {progress < 20 ? 'Salvando arquivo...' : 'Processando análise...'}
                  </span>
                  <span className="text-muted-foreground font-mono">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>
            )}

            <div className="flex-shrink-0 pt-4 border-t border-border">
              <button
                onClick={handleGenerate}
                disabled={!cnisFile || isGenerating}
                className={cn(
                  "flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 w-full disabled:opacity-50 disabled:cursor-not-allowed border border-border",
                  isDark ? "bg-slate-100 text-slate-900 hover:bg-slate-200" : "!bg-[#0d1c34] !text-white hover:!bg-[#0d1c34]/90"
                )}
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2" />
                    <span>Analisando CNIS...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    <span>Analisar CNIS</span>
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
                Análise do CNIS
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
              className={cn(
                "bg-muted/30 border border-border rounded-2xl p-8 shadow-inner flex-1 min-h-0",
                layoutMode === 'side-by-side' ? "" : "h-[70vh]"
              )}
              role="article"
              aria-label="Análise do CNIS"
              tabIndex={0}
            >
              <iframe 
                title="Análise do CNIS" 
                src={generatedPdfUrl} 
                className="w-full h-full rounded-xl border border-border bg-background"
              />
            </div>
          </div>
        ) : (
           layoutMode === 'side-by-side' && (
            <div className="hidden lg:flex items-center justify-center h-full min-h-[400px] border-2 border-dashed border-border/50 rounded-2xl bg-muted/10 text-muted-foreground">
              <div className="text-center max-w-xs p-6">
                 <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                 <p className="text-sm">O resultado da análise aparecerá aqui</p>
              </div>
            </div>
           )
        )}
      </div>
    </div>
  )
}
