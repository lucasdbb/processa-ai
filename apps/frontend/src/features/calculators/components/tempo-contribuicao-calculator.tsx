import { useState, useRef, useCallback, useEffect } from 'react'
import { Calculator, Loader2, FileText, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { useCreditsStore } from '@/stores/credits-store'
import { useOnboardingStore } from '@/features/onboarding'
import { analytics } from '@/lib/analytics'
import type { VinculoInput, TempoContribuicaoResult, CnisParseResult } from '../types'
import { CnisUpload } from './cnis-upload'
import { VinculosEditor } from './vinculos-editor'

interface TempoContribuicaoCalculatorProps {
  selectedClientId: string | null
}

type InputMode = 'manual' | 'cnis'

export function TempoContribuicaoCalculator({ selectedClientId }: TempoContribuicaoCalculatorProps) {
  const { fetchCredits } = useCreditsStore()
  const { markCalculatorUsed } = useOnboardingStore()

  const [inputMode, setInputMode] = useState<InputMode>('manual')
  const [vinculos, setVinculos] = useState<VinculoInput[]>([])
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<TempoContribuicaoResult | null>(null)
  const [alertas, setAlertas] = useState<string[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleCnisParsed = useCallback((data: CnisParseResult) => {
    const mapped: VinculoInput[] = data.vinculos.map((v) => ({
      empresa: v.empresa || '',
      cnpj: v.cnpj || '',
      data_inicio: v.data_inicio || '',
      data_fim: v.data_fim || null,
      tipo_vinculo: v.tipo || 'Empregado',
      atividade_especial: false,
      categoria_especial: null,
      indicadores: v.indicadores || [],
    }))
    setVinculos(mapped)
    if (data.alertas?.length) {
      setAlertas(data.alertas)
    }
    toast.success(`${mapped.length} vínculo(s) importado(s) do CNIS`)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (vinculos.length === 0) {
      toast.error('Adicione pelo menos um vínculo')
      return
    }

    const invalid = vinculos.some((v) => !v.data_inicio)
    if (invalid) {
      toast.error('Preencha a data de início de todos os vínculos')
      return
    }

    setLoading(true)
    setResultado(null)

    try {
      const res = await fetchWithCredentials(
        `${API_URL}/calculators/previdencia/tempo-contribuicao`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vinculos,
            client_id: selectedClientId || undefined,
            export_pdf: false,
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail || 'Erro ao calcular')
      }

      const data = (await res.json()) as {
        calculation_id: string
        pdf?: { job_id: string; status: string } | null
      }

      markCalculatorUsed()
      fetchCredits()

      // Poll for result from the calculation
      const calcId = data.calculation_id
      let attempts = 0
      const maxAttempts = 60

      if (pollRef.current) clearInterval(pollRef.current)

      pollRef.current = setInterval(async () => {
        attempts++
        try {
          const histRes = await fetchWithCredentials(
            `${API_URL}/calculators/history?calculator_key=previdencia.tempo-contribuicao&limit=1`
          )
          if (!histRes.ok) return

          const histData = (await histRes.json()) as {
            calculations: Array<{
              id: string
              status: string
              output_payload?: TempoContribuicaoResult
              error?: string
            }>
          }

          const calc = histData.calculations.find((c) => c.id === calcId)
          if (!calc) return

          if (calc.status === 'completed' && calc.output_payload) {
            clearInterval(pollRef.current!)
            pollRef.current = null
            setResultado(calc.output_payload)
            setLoading(false)

            analytics.track('feature_used', {
              feature: 'calculator_tempo_contribuicao',
            })
          } else if (calc.status === 'failed') {
            clearInterval(pollRef.current!)
            pollRef.current = null
            setLoading(false)
            toast.error(calc.error || 'Erro ao calcular tempo de contribuição')
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
  }, [vinculos, selectedClientId, fetchCredits, markCalculatorUsed])

  const tempoDisplay = resultado
    ? [
        resultado.anos > 0 ? `${resultado.anos} ano${resultado.anos !== 1 ? 's' : ''}` : null,
        resultado.meses > 0 ? `${resultado.meses} ${resultado.meses !== 1 ? 'meses' : 'mês'}` : null,
        resultado.dias > 0 ? `${resultado.dias} dia${resultado.dias !== 1 ? 's' : ''}` : null,
      ]
        .filter(Boolean)
        .join(', ') || '0 dias'
    : null

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
              setVinculos([])
              setAlertas([])
              setResultado(null)
            }}
            disabled={loading}
          />
        )}

        {/* Vínculos editor */}
        <VinculosEditor
          vinculos={vinculos}
          onChange={setVinculos}
          alertas={alertas}
          disabled={loading}
        />

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || vinculos.length === 0}
          className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Calculator className="h-4 w-4" />
          )}
          Calcular Tempo
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

            <div className="p-6 rounded-xl border border-border bg-muted/30 text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground mb-1">Tempo Total de Contribuição</p>
              <p className="text-3xl font-bold text-foreground">{tempoDisplay}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {resultado.total_dias.toLocaleString('pt-BR')} dias •{' '}
                {resultado.vinculos_processados} vínculo{resultado.vinculos_processados !== 1 ? 's' : ''}
              </p>
            </div>

            {resultado.alertas.length > 0 && (
              <div className="space-y-1">
                {resultado.alertas.map((a, i) => (
                  <div key={i} className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">{a}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Nota:</strong> Períodos sobrepostos são contados uma única vez.
                Vínculos sem data fim são considerados até a data de referência.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <p>Adicione vínculos e clique em calcular</p>
          </div>
        )}
      </div>
    </div>
  )
}
