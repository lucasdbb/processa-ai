import { useState, useRef, useCallback, useMemo, useLayoutEffect, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { normalizeMarkdown, cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'
import { useOutletContext } from 'react-router-dom'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'
import { analytics } from '@/lib/analytics'

interface PromptToolProps {
  externalPrompt?: string
  onPromptChange?: (prompt: string) => void
}

export function PromptTool({ externalPrompt, onPromptChange }: PromptToolProps) {
  const { isAuthenticated } = useUser()
  const outletContext = useOutletContext<RootLayoutOutletContext | null>()
  const openRegisterModal = outletContext?.openRegisterModal || (() => {})
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [prompt, setPrompt] = useState(externalPrompt || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedText, setGeneratedText] = useState('')
  
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (externalPrompt !== undefined) {
      setPrompt(externalPrompt)
    }
  }, [externalPrompt])

  const resizePromptTextarea = useCallback(() => {
    const el = promptTextareaRef.current
    if (!el) return

    const minHeight = 120
    const maxHeight = 400

    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${Math.max(next, minHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  useLayoutEffect(() => {
    resizePromptTextarea()
  }, [prompt, resizePromptTextarea])

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setPrompt(val)
    onPromptChange?.(val)
  }

  const handleGenerate = async () => {
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

    if (!prompt.trim()) {
      toast.error('Por favor, digite sua solicitação')
      return
    }

    setIsGenerating(true)
    setGeneratedText('')

    analytics.track('feature_used', {
      feature: 'prompt_tool',
      action: 'started',
      prompt_length: prompt.length
    })

    try {
      const response = await fetchWithCredentials(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      })

      if (!response.ok) {
        if (response.status === 402) {
          toast.error('Créditos insuficientes')
          return
        }
        throw new Error('Erro ao processar solicitação')
      }

      const data = await response.json()
      setGeneratedText(data.response)
      toast.success('Resposta gerada!')
      
      analytics.track('feature_used', {
        feature: 'prompt_tool',
        action: 'completed',
        success: true,
        response_length: data.response.length
      })
    } catch (error) {
      console.error(error)
      analytics.track('feature_used', {
        feature: 'prompt_tool',
        action: 'failed',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      toast.error('Erro ao conectar com a IA')
    } finally {
      setIsGenerating(false)
    }
  }

  const previewHtml = useMemo(() => {
    if (!generatedText) return ''
    const normalized = normalizeMarkdown(generatedText)
    return DOMPurify.sanitize(marked.parse(normalized) as string)
  }, [generatedText])

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="relative">
          <textarea
            ref={promptTextareaRef}
            value={prompt}
            onChange={handlePromptChange}
            placeholder="Descreva o que você precisa... (Ex: 'Elabore uma petição inicial de danos morais por extravio de bagagem')"
            className="w-full min-h-[120px] p-4 pr-12 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-all shadow-sm text-foreground placeholder:text-muted-foreground"
            disabled={isGenerating}
          />
          <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
            {prompt.length} caracteres
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className={cn(
            "w-full py-3 font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2",
            isDark ? "bg-slate-800 text-white hover:bg-slate-700 shadow-slate-900/20" : "!bg-[#0d1c34] !text-white hover:!bg-[#0d1c34]/90 shadow-slate-900/20"
          )}
        >
          {isGenerating ? (
            <>
              <Sparkles className="h-5 w-5 animate-pulse" />
              Processando...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Gerar com IA
            </>
          )}
        </button>
      </div>

      {generatedText && (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Resposta da IA
            </h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedText)
                toast.success('Copiado para a área de transferência')
                analytics.track('feature_used', { feature: 'prompt_tool', action: 'copied_text' })
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Copiar Texto
            </button>
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
