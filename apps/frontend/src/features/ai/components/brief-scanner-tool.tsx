import { useState, useCallback, useMemo } from 'react'
import { Download, FileText, Plus, ScanSearch, Trash2, Upload } from 'lucide-react'
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

interface BriefScannerToolProps {
  onOpenRegisterModal?: () => void
  selectedClientId?: string | null
}

export function BriefScannerTool({ onOpenRegisterModal: propOpenRegisterModal, selectedClientId }: BriefScannerToolProps) {
  const { isAuthenticated } = useUser()
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
            const pdfResponse = await fetch(statusData.result.download_url)
            if (!pdfResponse.ok) throw new Error('Erro ao baixar PDF')
            const blob = await pdfResponse.blob()
            setGeneratedPdfUrl(URL.createObjectURL(blob))
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
          return
        }
      }

      throw new Error('Tempo esgotado. Tente novamente.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao analisar peça')
    } finally {
      setIsGenerating(false)
    }
  }, [files, isAuthenticated, openRegisterModal])

  const handleDownload = useCallback(() => {
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

    if (generatedPdfUrl) {
      const element = document.createElement('a')
      element.href = generatedPdfUrl
      element.download = `analise_scanner_${Date.now()}.pdf`
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
      return
    }
  }, [generatedPdfUrl, isAuthenticated, openRegisterModal])

  const canGenerate = files.length > 0 && !isGenerating
  const hasResult = !!generatedPdfUrl || !!generatedText

  return (
    <>
      {/* Upload de pecas processuais */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-foreground mb-3">
          Envie a(s) peça(s) processual(is) <span className="text-destructive">*</span>
        </label>
        <p className="text-sm text-muted-foreground mb-3">
          Anexe petições, contestações, recursos ou outras peças que deseja analisar. A IA identificará teses frageis,
          pedidos faltantes, riscos e oportunidades de melhoria.
        </p>

        {/* Lista de arquivos */}
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

        {/* Dropzone */}
        {files.length < 5 && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-xl transition-all cursor-pointer',
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/50'
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
              className="flex flex-col items-center justify-center py-8 px-6 cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                {files.length > 0 ? (
                  <Plus className="h-7 w-7 text-primary" />
                ) : (
                  <Upload className="h-7 w-7 text-primary" />
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground mb-1">
                  <span className="text-primary font-semibold">Clique para escolher</span> ou arraste os arquivos aqui
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF (ate 10MB cada) &bull; Maximo {5 - files.length} arquivo{5 - files.length !== 1 ? 's' : ''}
                </p>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Botao analisar */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full sm:w-auto"
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

      {/* Barra de progresso */}
      {isGenerating && (
        <div className="mb-6 space-y-2 bg-muted/50 border border-border rounded-lg p-3">
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

      {/* Resultado - PDF iframe */}
      {generatedPdfUrl ? (
        <div role="region" aria-labelledby="result-heading">
          <div className="flex items-center justify-between mb-3">
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
          <div className="bg-muted/30 border border-border rounded-2xl p-8 shadow-inner">
            <iframe
              title="Relatorio de Analise"
              src={generatedPdfUrl}
              className="w-full h-[70vh] rounded-xl border border-border bg-background"
            />
          </div>
        </div>
      ) : hasResult && previewHtml ? (
        /* Resultado em HTML */
        <div role="region" aria-labelledby="result-heading">
          <div className="flex items-center justify-between mb-4">
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
          <div className="bg-muted/30 border border-border rounded-2xl p-8 shadow-inner">
            <div
              className="prose prose-lg max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
