import { useState } from 'react'
import { Download, FileText, Plus, ScanSearch, Trash2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToolComponentProps } from '../types'
import { Progress } from '@/components/ui/progress'

export function BriefScannerTool({
  isGenerating,
  progress,
  onGenerate,
  files,
  onFilesChange,
  onRemoveFile,
  generatedText,
  previewHtml,
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

    const maxFiles = 5
    const currentCount = files.length
    const allowed = droppedFiles.slice(0, maxFiles - currentCount)
    if (allowed.length > 0) {
      onFilesChange([...files, ...allowed])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    const maxFiles = 5
    const currentCount = files.length
    const allowed = selected.slice(0, maxFiles - currentCount)
    if (allowed.length > 0) {
      onFilesChange([...files, ...allowed])
    }
    e.target.value = ''
  }

  const canGenerate = files.length > 0 && !isGenerating
  const hasResult = generatedPdfUrl || generatedText

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
          onClick={onGenerate}
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
              {progress < 10
                ? 'Iniciando analise...'
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
              onClick={onDownload}
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
              onClick={onDownload}
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
