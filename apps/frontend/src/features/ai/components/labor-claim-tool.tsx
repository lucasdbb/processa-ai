import { useState } from 'react'
import { Download, FileText, Plus, Sparkles, Trash2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToolComponentProps } from '../types'
import { Progress } from '@/components/ui/progress'

export function LaborClaimTool({
  prompt,
  setPrompt,
  promptTextareaRef,
  resizePromptTextarea,
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

  const canGenerate = prompt.trim().length >= 50 && !isGenerating
  const hasResult = generatedPdfUrl || generatedText

  return (
    <>
      {/* Textarea para fatos do caso */}
      <div className="mb-6">
        <label htmlFor="labor-claim-prompt" className="block text-sm font-bold text-foreground mb-3">
          Descreva os fatos do caso <span className="text-destructive">*</span>
        </label>
        <div className="rounded-2xl border border-input bg-muted/50 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all duration-200">
          <textarea
            id="labor-claim-prompt"
            ref={promptTextareaRef}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value)
              resizePromptTextarea()
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.shiftKey) return
              e.preventDefault()
              if (!canGenerate) return
              void onGenerate()
            }}
            placeholder={
              'Descreva detalhadamente os fatos do caso, incluindo:\n' +
              '- Nome do reclamante e da empresa reclamada\n' +
              '- Data de admissão e rescisão\n' +
              '- Função exercida e salário\n' +
              '- Irregularidades (horas extras não pagas, rescisão indevida, etc.)\n' +
              '- Qualquer informação relevante para a reclamação'
            }
            className="w-full px-6 py-4 text-base bg-transparent focus:outline-none resize-none placeholder-muted-foreground text-foreground min-h-[160px]"
          />
          <div className="px-6 pb-4 flex items-center justify-between gap-4 text-xs text-muted-foreground font-medium">
            <span>
              {prompt.trim().length < 50
                ? `Mínimo 50 caracteres (faltam ${50 - prompt.trim().length})`
                : 'Enter para gerar \u2022 Shift+Enter para quebra de linha'}
            </span>
            <span>{prompt.length} caracteres</span>
          </div>
        </div>
      </div>

      {/* Upload de documentos de apoio */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-foreground mb-3">
          Documentos de apoio <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <p className="text-sm text-muted-foreground mb-3">
          Anexe contratos de trabalho, holerites, TRCT ou outros documentos relevantes para enriquecer a petição.
        </p>

        {/* Lista de arquivos já adicionados */}
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

        {/* Dropzone para novos arquivos */}
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
              id="labor-claim-files"
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
            <label
              htmlFor="labor-claim-files"
              className="flex flex-col items-center justify-center py-6 px-6 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                {files.length > 0 ? (
                  <Plus className="h-6 w-6 text-primary" />
                ) : (
                  <Upload className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground mb-1">
                  <span className="text-primary font-semibold">Clique para escolher</span> ou arraste arquivos
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF (at\u00e9 10MB cada) \u2022 M\u00e1ximo {5 - files.length} arquivo{5 - files.length !== 1 ? 's' : ''}
                </p>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Bot\u00e3o gerar */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center px-8 py-4 rounded-xl font-bold text-base transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full sm:w-auto"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
              <span>Gerando Reclama\u00e7\u00e3o...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 mr-2" />
              <span>Gerar Reclama\u00e7\u00e3o Trabalhista</span>
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
                ? 'Iniciando...'
                : progress < 40
                  ? 'Processando documentos...'
                  : progress < 95
                    ? 'Gerando reclama\u00e7\u00e3o trabalhista...'
                    : 'Finalizando...'}
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
              Reclama\u00e7\u00e3o Trabalhista Gerada
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
              title="Reclama\u00e7\u00e3o Trabalhista"
              src={generatedPdfUrl}
              className="w-full h-[70vh] rounded-xl border border-border bg-background"
            />
          </div>
        </div>
      ) : hasResult && previewHtml ? (
        /* Fallback: resultado em HTML */
        <div role="region" aria-labelledby="result-heading">
          <div className="flex items-center justify-between mb-4">
            <h3 id="result-heading" className="text-lg font-bold text-foreground">
              Reclama\u00e7\u00e3o Trabalhista Gerada
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
