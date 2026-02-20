import { useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react'
import { Download, FileText, Gavel, Trash2, Upload } from 'lucide-react'
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

const MAX_FILES = 5

interface LaborClaimToolProps {
  selectedClientId?: string | null
}

export function LaborClaimTool({ selectedClientId }: LaborClaimToolProps) {
  const { user, isAuthenticated } = useUser()
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
  
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)

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

    try {
      // 1. Upload files if any
      let uploadedFiles: any[] = []
      let jobUuid = ''

      if (files.length > 0) {
        setProgress(10)
        const result = await uploadFiles(
          files,
          user.id,
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
        throw new Error('Erro ao gerar reclamação')
      }

      const { job_id } = await response.json()
      
      // 3. Poll for results
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetchWithCredentials(`${API_URL}/ai/jobs/${job_id}`)
          if (!statusRes.ok) return

          const statusData = await statusRes.json()
          
          const backendProgress = statusData.progress || 0
          setProgress(40 + Math.floor((backendProgress * 60) / 100))

          if (statusData.status === 'completed') {
            clearInterval(pollInterval)
            setProgress(100)
            
            if (statusData.result) {
              setGeneratedText(statusData.result.text || '')
              if (statusData.result.pdf_url) {
                setGeneratedPdfUrl(statusData.result.pdf_url)
              }
            }
            
            toast.success('Reclamação trabalhista gerada com sucesso!')
            setIsGenerating(false)
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval)
            throw new Error(statusData.error || 'Falha na geração')
          }
        } catch (error) {
          // Ignore polling errors
        }
      }, 2000)

    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Erro ao processar')
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Relato dos Fatos</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Descreva detalhadamente o caso, incluindo datas, valores, horas extras não pagas e outras verbas pleiteadas.
          </p>
          <div className="relative">
            <textarea
              ref={promptTextareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: O reclamante foi admitido em 10/01/2020 e demitido sem justa causa em 15/05/2023. Recebia salário de R$ 2.500,00. Trabalhava das 08h às 19h com 30min de intervalo..."
              className="w-full min-h-[160px] p-4 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-all shadow-sm text-foreground placeholder:text-muted-foreground"
              disabled={isGenerating}
            />
            <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
              {prompt.length} caracteres
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Documentos Complementares (Opcional)</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Anexe documentos que comprovem o relato (TRCT, holerites, cartão de ponto).
          </p>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-6 transition-colors text-center",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            )}
          >
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Arraste arquivos PDF aqui
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ou clique para selecionar (máx. {MAX_FILES})
                </p>
              </div>
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleFileInput}
                className="hidden"
                id="labor-file-upload"
              />
              <label
                htmlFor="labor-file-upload"
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

        {isGenerating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Elaborando petição...</span>
              <span className="font-medium text-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2"
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

      {(generatedText || generatedPdfUrl) && (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Petição Gerada
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
