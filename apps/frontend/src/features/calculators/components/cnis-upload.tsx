import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, FileText, Loader2, X, AlertTriangle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { useFileUpload } from '@/features/ai/hooks/use-file-upload'
import { FunctionalityType } from '@/features/ai/types'
import type { CnisParseResult } from '../types'

interface CnisUploadProps {
  onParsed: (data: CnisParseResult) => void
  onReset?: () => void
  disabled?: boolean
}

type UploadState = 'idle' | 'uploading' | 'parsing' | 'done' | 'error' | 'timeout'

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}min ${sec}s`
}

export function CnisUpload({ onParsed, onReset, disabled }: CnisUploadProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [pendingJobId, setPendingJobId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { uploadFiles } = useFileUpload()

  // Elapsed timer
  useEffect(() => {
    if (state === 'parsing') {
      setElapsed(0)
      elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current)
        elapsedRef.current = null
      }
    }
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current)
    }
  }, [state])

  const reset = useCallback(() => {
    setState('idle')
    setFileName(null)
    setProgress(0)
    setErrorMsg(null)
    setElapsed(0)
    setPendingJobId(null)
    setRetrying(false)
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
    onReset?.()
  }, [onReset])

  const pollForResult = useCallback(async (jobId: string, controller: AbortController) => {
    const maxAttempts = 300 // 300 × 2s = 10 min (matches worker timeout)
    const pollInterval = 2000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (controller.signal.aborted) return

      await new Promise((resolve) => setTimeout(resolve, pollInterval))

      if (controller.signal.aborted) return

      try {
        const statusRes = await fetchWithCredentials(
          `${API_URL}/jobs/${encodeURIComponent(jobId)}`
        )
        if (!statusRes.ok) continue

        const statusData = (await statusRes.json()) as {
          status: string
          result?: CnisParseResult
          error?: string
        }

        if (statusData.status === 'completed' && statusData.result) {
          setState('done')
          setProgress(100)
          setPendingJobId(null)
          onParsed(statusData.result)
          return
        } else if (statusData.status === 'failed') {
          setPendingJobId(null)
          throw new Error(statusData.error || 'Erro ao processar CNIS')
        }

        setProgress(20 + Math.round((attempt / maxAttempts) * 80))
      } catch (err) {
        if (controller.signal.aborted) return
        setState('error')
        const msg = err instanceof Error ? err.message : 'Erro ao processar CNIS'
        setErrorMsg(msg)
        toast.error(msg)
        return
      }
    }

    // Timeout — keep jobId for retry
    setState('timeout')
    setErrorMsg('O processamento está demorando mais que o esperado, mas continua rodando.')
  }, [onParsed])

  const handleRetryCheck = useCallback(async () => {
    if (!pendingJobId) return

    setRetrying(true)
    try {
      const statusRes = await fetchWithCredentials(
        `${API_URL}/jobs/${encodeURIComponent(pendingJobId)}`
      )
      if (!statusRes.ok) {
        toast.error('Erro ao verificar status')
        setRetrying(false)
        return
      }

      const statusData = (await statusRes.json()) as {
        status: string
        result?: CnisParseResult
        error?: string
      }

      if (statusData.status === 'completed' && statusData.result) {
        setState('done')
        setProgress(100)
        setPendingJobId(null)
        onParsed(statusData.result)
        toast.success('CNIS processado com sucesso!')
      } else if (statusData.status === 'failed') {
        setState('error')
        setPendingJobId(null)
        const msg = statusData.error || 'Erro ao processar CNIS'
        setErrorMsg(msg)
        toast.error(msg)
      } else {
        // Still processing — resume polling
        setState('parsing')
        const controller = new AbortController()
        abortRef.current = controller
        pollForResult(pendingJobId, controller)
      }
    } catch {
      toast.error('Erro ao verificar status')
    } finally {
      setRetrying(false)
    }
  }, [pendingJobId, onParsed, pollForResult])

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Selecione um arquivo PDF')
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máximo 20MB)')
      return
    }

    setFileName(file.name)
    setState('uploading')
    setProgress(0)
    setErrorMsg(null)
    setPendingJobId(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      // 1. Upload file to storage
      const { uploadMetadata } = await uploadFiles(
        [file],
        null,
        FunctionalityType.CALCULATOR,
        (p) => setProgress(Math.round(p * 0.2))
      )

      if (controller.signal.aborted) return

      const fileMeta = uploadMetadata[0]

      // 2. Trigger CNIS parsing
      setState('parsing')
      setProgress(20)

      const parseRes = await fetchWithCredentials(
        `${API_URL}/calculators/previdencia/parse-cnis`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_url: null,
            bucket: fileMeta.bucket,
            storage_path: fileMeta.storage_path
          }),
        }
      )

      if (!parseRes.ok) {
        const err = await parseRes.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail || 'Erro ao enviar CNIS para parsing')
      }

      const { job_id } = (await parseRes.json()) as { job_id: string }
      setPendingJobId(job_id)

      // 3. Poll for result
      await pollForResult(job_id, controller)
    } catch (err) {
      if (controller.signal.aborted) return
      setState('error')
      const msg = err instanceof Error ? err.message : 'Erro ao processar CNIS'
      setErrorMsg(msg)
      toast.error(msg)
    }
  }, [uploadFiles, pollForResult])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (disabled || state === 'uploading' || state === 'parsing') return
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [disabled, state, handleFile])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  if (state === 'done') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/10">
        <FileText className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-700 dark:text-green-300 truncate">
            {fileName}
          </p>
          <p className="text-xs text-green-600/80 dark:text-green-400/80">
            CNIS processado com sucesso
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="p-1 rounded hover:bg-green-500/20 text-green-600 dark:text-green-400 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  if (state === 'timeout') {
    return (
      <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
              Processamento em andamento
            </p>
            <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80 mt-1">
              {errorMsg || 'O CNIS ainda está sendo processado em segundo plano.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRetryCheck}
            disabled={retrying}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-yellow-600 text-white hover:bg-yellow-700 transition-colors disabled:opacity-50"
          >
            {retrying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Verificar resultado
          </button>
          <button
            type="button"
            onClick={reset}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-yellow-500/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/10 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10">
        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            Erro ao processar CNIS
          </p>
          {errorMsg && (
            <p className="text-xs text-red-600/80 dark:text-red-400/80 truncate">
              {errorMsg}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={reset}
          className="px-3 py-1 rounded-md text-xs font-medium border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (state === 'uploading' || state === 'parsing') {
    return (
      <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              {state === 'uploading'
                ? 'Enviando arquivo...'
                : `Processando CNIS... ${formatElapsed(elapsed)}`}
            </p>
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="relative"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="w-full p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          Arraste o PDF do CNIS aqui ou clique para selecionar
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF do Meu INSS (máx. 20MB) — 1 crédito · Pode levar alguns minutos
        </p>
      </button>
    </div>
  )
}
