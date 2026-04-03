import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Mic, Trash2, Upload, FileAudio, History, Copy, Check } from 'lucide-react'
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
import { HistoryBottomSheet } from '@/features/ai/components/history-bottom-sheet'
import { useAnalysisHistory } from '@/features/ai/hooks/use-analysis-history'

const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'audio/aac',
]

const ACCEPTED_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg', '.webm', '.flac', '.aac']

const MAX_FILE_SIZE_MB = 25
const MAX_DURATION_MINUTES = 60

function isAudioFile(file: File): boolean {
  if (ACCEPTED_AUDIO_TYPES.includes(file.type)) return true
  const name = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

function checkAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.preload = 'metadata'

    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      if (isFinite(audio.duration)) {
        resolve(audio.duration)
      } else {
        // Some formats don't report duration from metadata alone
        resolve(0)
      }
    }

    audio.onerror = () => {
      URL.revokeObjectURL(url)
      // Can't determine duration, allow upload and let backend handle
      resolve(0)
    }

    audio.src = url
  })
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface AudioTranscriptionToolProps {
  onOpenRegisterModal?: () => void
  selectedClientId?: string | null
}

export function AudioTranscriptionTool({ onOpenRegisterModal: propOpenRegisterModal, selectedClientId }: AudioTranscriptionToolProps) {
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
  const [fileDuration, setFileDuration] = useState<number>(0)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [transcription, setTranscription] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const { data: historyJobs } = useAnalysisHistory('audio_transcription', selectedClientId, historyRefreshKey)

  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!isAudioFile(selectedFile)) {
      toast.error('Envie um arquivo de áudio (MP3, M4A, WAV, OGG, WebM, FLAC ou AAC)')
      return
    }

    if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`O arquivo deve ter no máximo ${MAX_FILE_SIZE_MB}MB`)
      return
    }

    // Check duration
    const duration = await checkAudioDuration(selectedFile)
    if (duration > MAX_DURATION_MINUTES * 60) {
      toast.error(`O áudio deve ter no máximo ${MAX_DURATION_MINUTES} minutos. Este tem ${formatDuration(duration)}.`)
      return
    }

    setFile(selectedFile)
    setFileDuration(duration)
    setTranscription('')
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0 && isAudioFile(files[0])) {
      const mockEvent = {
        target: { files }
      } as unknown as React.ChangeEvent<HTMLInputElement>
      handleFileChange(mockEvent)
    }
  }

  const clearFile = useCallback(() => {
    setFile(null)
    setFileDuration(0)
    setFileInputKey((k) => k + 1)
    setTranscription('')
    setProgress(0)
  }, [])

  const handleCopy = useCallback(async () => {
    if (!transcription) return
    try {
      await navigator.clipboard.writeText(transcription)
      setCopied(true)
      toast.success('Transcrição copiada!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erro ao copiar')
    }
  }, [transcription])

  const handleGenerate = useCallback(async () => {
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

    if (!file) {
      toast.error('Por favor, envie o arquivo de áudio')
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setTranscription('')

    analytics.track('feature_used', {
      feature: 'audio_transcription',
      action: 'started',
      file_size: file.size,
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

      // 2. Start transcription job
      const submitResponse = await fetchWithCredentials(`${API_URL}/ai/analyses/audio-transcription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: fileMetadata.storage_path,
          bucket: fileMetadata.bucket,
          files: uploadMetadata,
          job_uuid: commonJobUuid,
          client_id: selectedClientId || undefined,
          functionality: FunctionalityType.AI,
          store_pdf: false,
        }),
      })

      if (!submitResponse.ok) {
        if (submitResponse.status === 401 || submitResponse.status === 403) {
          openRegisterModal()
          return
        }

        let message = 'Erro ao iniciar transcrição. Tente novamente.'
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
      const maxAttempts = 180 // 6 minutes (audio transcription may take longer)
      const pollInterval = 2000

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (controller.signal.aborted) return
        await new Promise((resolve) => setTimeout(resolve, pollInterval))
        if (controller.signal.aborted) return

        const statusResponse = await fetchWithCredentials(`${API_URL}/jobs/${encodeURIComponent(jobId)}`)
        if (!statusResponse.ok) continue

        const statusData = (await statusResponse.json()) as {
          status: string
          progress: number
          result?: { markdown?: string; download_url?: string; content?: string; document_id?: string }
          error?: string
        }

        // Map backend progress (0-100) to UI progress (20-100)
        const backendProgress = statusData.progress || 0
        const uiProgress = UPLOAD_PROGRESS_MAX + Math.round((backendProgress / 100) * (100 - UPLOAD_PROGRESS_MAX))
        setProgress(uiProgress)

        if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Erro ao transcrever áudio. Tente novamente.')
        }

        if (statusData.status === 'completed') {
          const markdown = statusData.result?.markdown || ''
          if (markdown) {
            setTranscription(markdown)
          } else {
            throw new Error('Transcrição vazia retornada pelo servidor')
          }

          toast.success('Transcrição concluída com sucesso!')
          setHistoryRefreshKey((k) => k + 1)
          analytics.track('feature_used', {
            feature: 'audio_transcription',
            action: 'completed',
            success: true,
          })
          return
        }
      }

      throw new Error('Tempo esgotado. Tente novamente.')
    } catch (error) {
      analytics.track('feature_used', {
        feature: 'audio_transcription',
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      })
      toast.error(error instanceof Error ? error.message : 'Erro ao transcrever áudio')
      setProgress(0)
    } finally {
      setIsGenerating(false)
    }
  }, [isAuthenticated, file, openRegisterModal, uploadFiles, selectedClientId, markAiToolUsed])

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex-1 min-h-0 grid gap-4 grid-cols-1 lg:grid-cols-2 grid-rows-[1fr]">
        {/* Left Column: Input / Result */}
        <div className="flex flex-col h-full min-h-0">
          <div className="flex-1 flex flex-col min-h-0 bg-card border border-border rounded-xl p-4 gap-4">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
              {transcription ? (
                /* Transcription result */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground">Transcrição</h3>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent transition-colors text-xs font-medium"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-foreground bg-muted/30 border border-border rounded-lg p-4 whitespace-pre-wrap text-sm leading-relaxed">
                    {transcription}
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-accent transition-colors text-sm font-medium"
                  >
                    <Mic className="h-4 w-4" />
                    Nova transcrição
                  </button>
                </div>
              ) : (
                /* File upload area */
                <>
                  <div>
                    <label htmlFor="audio-file" className="block text-sm sm:text-base font-bold text-foreground mb-1">
                      Envie o áudio <span className="text-destructive">*</span>
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Anexe o áudio de audiência, depoimento ou reunião. A IA transcreverá o conteúdo completo com identificação de falantes e marcadores de tempo.
                    </p>
                  </div>

                  <div>
                    {file ? (
                      <div className="border-2 border-border rounded-xl bg-card p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <FileAudio className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">{file.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                                {fileDuration > 0 && ` • ${formatDuration(fileDuration)}`}
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
                          id="audio-file"
                          type="file"
                          accept="audio/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="audio-file"
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
                              MP3, M4A, WAV, OGG, WebM, FLAC ou AAC — até {MAX_FILE_SIZE_MB}MB, máximo {MAX_DURATION_MINUTES} min
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
                          {progress < 20 ? 'Enviando áudio...' : 'Transcrevendo áudio...'}
                        </span>
                        <span className="text-muted-foreground font-mono">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-3" />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Fixed bottom actions */}
            {!transcription && (
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
                      <span>Transcrevendo...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5 mr-2" />
                      <span>Transcrever Áudio</span>
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
                      <span>Ver histórico{(historyJobs?.length ?? 0) > 0 ? ` (${historyJobs?.length})` : ''}</span>
                    </button>
                  )}
                >
                  <AnalysisHistoryList
                    functionality="audio_transcription"
                    clientId={selectedClientId}
                    title="Histórico de Transcrições"
                    refreshKey={historyRefreshKey}
                  />
                </HistoryBottomSheet>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: History — desktop only */}
        <div className="hidden lg:flex flex-col h-full min-h-0 bg-card border border-border rounded-xl overflow-hidden">
          <AnalysisHistoryList
            functionality="audio_transcription"
            clientId={selectedClientId}
            title="Histórico de Transcrições"
            refreshKey={historyRefreshKey}
          />
        </div>
      </div>
    </div>
  )
}
