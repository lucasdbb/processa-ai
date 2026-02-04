import { useState } from 'react'
import { Download, FileSearch, Trash2, Upload, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToolComponentProps } from '../types'
import { Progress } from '@/components/ui/progress'

export function ProcessSummaryTool({
  cnisFile,
  cnisFileInputKey,
  onCnisFileChange,
  onClearCnisFile,
  isGenerating,
  progress,
  onGenerate,
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
    
    const files = e.dataTransfer.files
    if (files.length > 0 && files[0].type === 'application/pdf') {
      const mockEvent = {
        target: { files }
      } as unknown as React.ChangeEvent<HTMLInputElement>
      onCnisFileChange(mockEvent)
    }
  }

  return (
    <>
      <div className="mb-6">
        <label htmlFor="process-file" className="block text-sm font-medium text-foreground mb-2">
          Envie o PDF do Processo <span className="text-destructive">*</span>
        </label>

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
                onClick={onClearCnisFile}
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
              'border-2 border-dashed rounded-xl transition-all cursor-pointer',
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/50'
            )}
          >
            <input
              key={cnisFileInputKey}
              id="process-file"
              type="file"
              accept="application/pdf"
              onChange={onCnisFileChange}
              className="hidden"
            />
            <label
              htmlFor="process-file"
              className="flex flex-col items-center justify-center py-8 px-6 cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground mb-1">
                  <span className="text-primary font-semibold">Clique para escolher</span> ou arraste o arquivo aqui
                </p>
                <p className="text-xs text-muted-foreground">
                  Aceita apenas PDF (até 10MB)
                </p>
              </div>
            </label>
          </div>
        )}
      </div>

      <div className="flex space-x-4 mb-6">
        <button
          onClick={onGenerate}
          disabled={!cnisFile || isGenerating}
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
              {progress === 0 ? 'Iniciando análise...' : 'Processando resumo...'}
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
            <div className="flex space-x-2" role="toolbar" aria-label="Ações do documento">
              <button
                onClick={onDownload}
                aria-label="Baixar como PDF"
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                title="Baixar PDF"
              >
                <Download className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
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
