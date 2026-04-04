import { useState, useRef, useCallback, useEffect } from 'react'
import { Calculator, Loader2, FileText, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { useCreditsStore } from '@/stores/credits-store'
import { useOnboardingStore } from '@/features/onboarding'
import { analytics } from '@/lib/analytics'
import type { RemuneracaoInput, MediaSalarialResult, CnisParseResult } from '../types'
import { CnisUpload } from './cnis-upload'
import { RemuneracoesEditor } from './remuneracoes-editor'

interface MediaSalarialCalculatorProps {
  selectedClientId: string | null
}

type InputMode = 'manual' | 'cnis'

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return 'R$ 0,00'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function MediaSalarialCalculator({ selectedClientId }: MediaSalarialCalculatorProps) {
  const { fetchCredits } = useCreditsStore()
  const { markCalculatorUsed } = useOnboardingStore()

  const [inputMode, setInputMode] = useState<InputMode>('manual')
  const [remuneracoes, setRemuneracoes] = useState<RemuneracaoInput[]>([])
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<MediaSalarialResult | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleCnisParsed = useCallback((data: CnisParseResult) => {
    const allRemuneracoes: RemuneracaoInput[] = []
    for (const vinculo of data.vinculos) {
      for (const rem of vinculo.remuneracoes) {
        allRemuneracoes.push({
          competencia: rem.competencia,
          valor: rem.valor,
          indicadores: rem.indicadores || [],
        })
      }
    }

    // Sort by competência desc
    allRemuneracoes.sort((a, b) => b.competencia.localeCompare(a.competencia))
    setRemuneracoes(allRemuneracoes)
    toast.success(`${allRemuneracoes.length} remuneração(ões) importada(s) do CNIS`)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (remuneracoes.length === 0) {
      toast.error('Adicione pelo menos uma remuneração')
      return
    }

    const invalid = remuneracoes.some((r) => !r.competencia || r.valor <= 0)
    if (invalid) {
      toast.error('Preencha competência e valor de todas as remunerações')
      return
    }

    setLoading(true)
    setResultado(null)

    try {
      const res = await fetchWithCredentials(
        `${API_URL}/calculators/previdencia/media-salarial`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            remuneracoes,
            client_id: selectedClientId || undefined,
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail || 'Erro ao calcular')
      }

      const data = (await res.json()) as { calculation_id: string }

      markCalculatorUsed()
      fetchCredits()

      const calcId = data.calculation_id
      let attempts = 0
      const maxAttempts = 60

      if (pollRef.current) clearInterval(pollRef.current)

      pollRef.current = setInterval(async () => {
        attempts++
        try {
          const histRes = await fetchWithCredentials(
            `${API_URL}/calculators/history?calculator_key=previdencia.media-salarial&limit=1`
          )
          if (!histRes.ok) return

          const histData = (await histRes.json()) as {
            calculations: Array<{
              id: string
              status: string
              output_payload?: MediaSalarialResult
              error?: string
            }>
          }

          const calc = histData.calculations.find((c) => c.id === calcId)
          if (!calc) return

          if (calc.status === 'completed' && calc.output_payload) {
            clearInterval(pollRef.current!)
            pollRef.current = null
            // Worker returns {detalhes: {...}} — extract inner object
            const payload = calc.output_payload as MediaSalarialResult | { detalhes: MediaSalarialResult }
            const data = 'detalhes' in payload ? payload.detalhes : payload
            setResultado(data)
            setLoading(false)

            analytics.track('feature_used', {
              feature: 'calculator_media_salarial',
            })
          } else if (calc.status === 'failed') {
            clearInterval(pollRef.current!)
            pollRef.current = null
            setLoading(false)
            toast.error(calc.error || 'Erro ao calcular média salarial')
          }
        } catch {
          // continue polling
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setLoading(false)
          toast.error('Tempo esgotado ao calcular')
        }
      }, 2000)
    } catch (err) {
      setLoading(false)
      toast.error(err instanceof Error ? err.message : 'Erro ao calcular')
    }
  }, [remuneracoes, selectedClientId, fetchCredits, markCalculatorUsed])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="space-y-4">
        {/* Mode selector */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setInputMode('cnis')}
            className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
              inputMode === 'cnis'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:border-primary/50'
            }`}
          >
            Importar CNIS
          </button>
          <button
            type="button"
            onClick={() => setInputMode('manual')}
            className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
              inputMode === 'manual'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:border-primary/50'
            }`}
          >
            Manual
          </button>
        </div>

        {/* CNIS Upload */}
        {inputMode === 'cnis' && (
          <CnisUpload
            onParsed={handleCnisParsed}
            onReset={() => {
              setRemuneracoes([])
              setResultado(null)
            }}
            disabled={loading}
          />
        )}

        {/* Remunerações editor */}
        <RemuneracoesEditor
          remuneracoes={remuneracoes}
          onChange={setRemuneracoes}
          disabled={loading}
        />

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || remuneracoes.length === 0}
          className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Calculator className="h-4 w-4" />
          )}
          Calcular Média
        </button>
      </div>

      {/* Result */}
      <div className="lg:border-l lg:pl-6 border-border">
        {resultado ? (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Resultado
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl border border-border bg-muted/30 text-center">
                <DollarSign className="h-6 w-6 mx-auto mb-1 text-primary" />
                <p className="text-xs text-muted-foreground mb-1">Média 100%</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(resultado.media_100)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Pós-reforma (EC 103/2019)</p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/30 text-center">
                <DollarSign className="h-6 w-6 mx-auto mb-1 text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs text-muted-foreground mb-1">Média 80% melhores</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(resultado.media_80)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Pré-reforma / Dir. adquirido</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between p-2 rounded bg-muted/30 text-xs">
                <span className="text-muted-foreground">Contribuições processadas</span>
                <span className="font-medium text-foreground">{resultado.qtd_contribuicoes}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-muted/30 text-xs">
                <span className="text-muted-foreground">Maior contribuição</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(resultado.maior_contribuicao)}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-muted/30 text-xs">
                <span className="text-muted-foreground">Menor contribuição</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(resultado.menor_contribuicao)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Média 100%:</strong> Considera todas as contribuições desde jul/1994 (regra pós-reforma).{' '}
                <strong>Média 80%:</strong> Descarta as 20% menores (regra pré-reforma e direito adquirido).
                Valores corrigidos pelo INPC.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <p>Adicione remunerações e clique em calcular</p>
          </div>
        )}
      </div>
    </div>
  )
}
