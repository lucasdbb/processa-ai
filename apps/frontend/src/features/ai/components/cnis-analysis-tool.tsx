import { Download, Sparkles, Trash2, Upload } from 'lucide-react'

import type { ToolComponentProps } from '../types'
import { Progress } from '@/components/ui/progress'

export function CnisAnalysisTool({
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
  return (
    <>
      <div className="mb-8">
        <label htmlFor="cnis-file" className="block text-sm font-bold text-foreground mb-3">
          Envie o CNIS (PDF) <span className="text-destructive">*</span>
        </label>

        <div className="border border-border rounded-2xl bg-muted/30 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-foreground">Arquivo</div>
              <div className="text-xs text-muted-foreground mt-1">Aceita apenas PDF (até 10MB)</div>
            </div>

            {cnisFile ? (
              <button
                type="button"
                onClick={onClearCnisFile}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-sm font-bold"
              >
                <Trash2 className="h-4 w-4" />
                Remover
              </button>
            ) : null}
          </div>

          {cnisFile ? (
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">{cnisFile.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{(cnisFile.size / (1024 * 1024)).toFixed(2)} MB</div>
                </div>
                <div className="text-xs font-bold text-muted-foreground">PDF</div>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <input
                key={cnisFileInputKey}
                id="cnis-file"
                type="file"
                accept="application/pdf"
                onChange={onCnisFileChange}
                className="hidden"
              />
              <label
                htmlFor="cnis-file"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors font-bold cursor-pointer"
              >
                <Upload className="h-5 w-5" />
                Selecionar PDF
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="flex space-x-4 mb-8">
        <button
          onClick={onGenerate}
          disabled={!cnisFile || isGenerating}
          className="bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center px-8 py-4 rounded-xl font-bold text-base transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full sm:w-auto"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
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

      {isGenerating && (
        <div className="mb-8 space-y-2 bg-muted/50 border border-border rounded-xl p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {progress === 0 ? 'Iniciando análise...' : 'Processando análise...'}
            </span>
            <span className="text-muted-foreground font-mono">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>
      )}

      {generatedPdfUrl ? (
        <div role="region" aria-labelledby="result-heading">
          <div className="flex items-center justify-between mb-4">
            <h3 id="result-heading" className="text-lg font-bold text-foreground">
              Análise do CNIS
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
            aria-label="Análise do CNIS"
            tabIndex={0}
          >
            <iframe title="Análise do CNIS" src={generatedPdfUrl} className="w-full h-[70vh] rounded-xl border border-border bg-background" />
          </div>
        </div>
      ) : null}
    </>
  )
}
