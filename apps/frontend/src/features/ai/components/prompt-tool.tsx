import { Download, Sparkles } from 'lucide-react'

import type { ToolComponentProps } from '../types'

export function PromptTool({
  prompt,
  setPrompt,
  promptTextareaRef,
  resizePromptTextarea,
  isGenerating,
  onGenerate,
  generatedText,
  previewHtml,
  onDownload,
}: ToolComponentProps) {
  return (
    <>
      <div className="mb-8">
        <label htmlFor="prompt-input" className="block text-sm font-bold text-foreground mb-3">
          Descreva o que você precisa <span className="text-destructive">*</span>
        </label>
        <div className="rounded-2xl border border-input bg-muted/50 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all duration-200">
          <textarea
            id="prompt-input"
            ref={promptTextareaRef}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value)
              resizePromptTextarea()
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.shiftKey) return
              e.preventDefault()
              if (isGenerating) return
              if (!prompt.trim()) return
              void onGenerate()
            }}
            placeholder="Ex: Criar uma petição inicial para ação de cobrança contra empresa que não pagou serviços prestados no valor de R$ 10.000,00..."
            className="w-full px-6 py-4 text-base bg-transparent focus:outline-none resize-none placeholder-muted-foreground text-foreground"
          />
          <div className="px-6 pb-4 flex items-center justify-between gap-4 text-xs text-muted-foreground font-medium">
            <span>Enter para gerar • Shift+Enter para quebra de linha</span>
            <span>{prompt.length} caracteres</span>
          </div>
        </div>
      </div>

      <div className="flex space-x-4 mb-8">
        <button
          onClick={onGenerate}
          disabled={!prompt.trim() || isGenerating}
          className="bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center px-8 py-4 rounded-xl font-bold text-base transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full sm:w-auto"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
              <span>Gerando Documento...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 mr-2" />
              <span>Gerar com IA</span>
            </>
          )}
        </button>
      </div>

      {generatedText ? (
        <div role="region" aria-labelledby="result-heading">
          <div className="flex items-center justify-between mb-4">
            <h3 id="result-heading" className="text-lg font-bold text-foreground">
              Documento Gerado
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
            aria-label="Documento gerado pela IA"
            tabIndex={0}
          >
            <div className="prose prose-lg max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      ) : null}
    </>
  )
}
