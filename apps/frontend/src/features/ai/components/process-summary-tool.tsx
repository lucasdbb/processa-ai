import { useState, useCallback, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Download, FileSearch, FileText, Plus, Trash2, Upload } from 'lucide-react'
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

const MAX_FILES = 5

interface ProcessSummaryToolProps {
  selectedClientId?: string | null
}

export function ProcessSummaryTool({ selectedClientId }: ProcessSummaryToolProps) {
  const { user, isAuthenticated } = useUser()
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
      toast.error(error instanceof Error ? error.message : 'Erro ao processar resumo')
      setIsGenerating(false)
    }
  }, [isAuthenticated, files, openRegisterModal, uploadFiles, selectedClientId, fetchCredits])

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Documentos do Processo</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Envie as peças processuais (PDF) para gerar um resumo cronológico e identificar pontos-chave.
          </p>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 transition-colors text-center",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            )}
          >
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Arraste e solte seus arquivos aqui
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ou clique para selecionar (máx. {MAX_FILES} arquivos)
                </p>
              </div>
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="mt-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Selecionar Arquivos
              </label>
            </div>
          </div>
        </div>

        {files.length > 0 && (
          <div className="space-y-3">
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

        {isGenerating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Processando...</span>
              <span className="font-medium text-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || files.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full"
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

      {(generatedText || generatedPdfUrl) && (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Resultado da Análise
            </h3>
            {generatedPdfUrl && (
              <a
                href={generatedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="h-4 w-4" />
                Baixar PDF
              </a>
            )}
          </div>
          
          <div className="p-6">
            <div 
              className="prose prose-slate dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
