import { useState } from 'react'
import { Download, FileSearch, FileText, Plus, Trash2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToolComponentProps } from '../types'
import { Progress } from '@/components/ui/progress'

const MAX_FILES = 5

export function ProcessSummaryTool({
  isGenerating,
  progress,
  onGenerate,
  files,
  onFilesChange,
  onRemoveFile,
  generatedPdfUrl,
  onDownload,
}: ToolComponentProps) {
  const [isDragging, setIsDragging] = useState(false)

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
      onFilesChange([...files, ...allowed])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    const allowed = selected.slice(0, MAX_FILES - files.length)
    if (allowed.length > 0) {
      onFilesChange([...files, ...allowed])
    }
    e.target.value = ''
  }

  const canGenerate = files.length > 0 && !isGenerating

  return (
    <>
      <div className="mb-6">
        <label className="block text-sm font-bold text-foreground mb-3">
          Envie o(s) PDF(s) do Processo <span className="text-destructive">*</span>
        </label>
        <p className="text-sm text-muted-foreground mb-3">
          Anexe as peças do processo que deseja resumir. A IA irá gerar um resumo estruturado com os principais fatos, pedidos e decisões.
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
                    onClick={() => onRemoveFile(index)}
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
        {files.length < MAX_FILES && (
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
              id="process-summary-files"
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
            <label
              htmlFor="process-summary-files"
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
                  PDF (até 10MB cada) &bull; Máximo {MAX_FILES - files.length} arquivo{MAX_FILES - files.length !== 1 ? 's' : ''}
                </p>
              </div>
            </label>
          </div>
        )}
      </div>

      <div className="flex space-x-4 mb-6">
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full sm:w-auto"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2" />
              <span>Gerando resumo...</span>
            </>
          ) : (
            <>
              <FileSearch className="h-5 w-5 mr-2" />
              <span>Gerar Resumo</span>
            </>
          )}
        </button>
      </div>

      {isGenerating && (
        <div className="mb-6 space-y-2 bg-muted/50 border border-border rounded-lg p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {progress === 0
                ? 'Iniciando análise...'
                : progress < 40
                  ? 'Extraindo texto do processo...'
                  : progress < 95
                    ? 'Gerando resumo estruturado...'
                    : 'Finalizando...'}
            </span>
            <span className="text-muted-foreground font-mono">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>
      )}

      {generatedPdfUrl ? (
        <div role="region" aria-labelledby="result-heading">
          <div className="flex items-center justify-between mb-3">
            <h3 id="result-heading" className="text-base font-semibold text-foreground">
              Resumo do Processo
            </h3>
            <button
              onClick={onDownload}
              aria-label="Baixar como PDF"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              title="Baixar PDF"
            >
              <Download className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div
            className="bg-muted/30 border border-border rounded-2xl p-8 shadow-inner"
            role="article"
            aria-label="Resumo do Processo"
            tabIndex={0}
          >
            <iframe title="Resumo do Processo" src={generatedPdfUrl} className="w-full h-[70vh] rounded-xl border border-border bg-background" />
          </div>
        </div>
      ) : null}
    </>
  )
}
