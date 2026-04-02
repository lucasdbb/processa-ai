import { useState } from 'react'
import { Calculator, Loader2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import type { FatorPrevidenciarioResult } from '../types'
import { analytics } from '@/lib/analytics'

interface FatorPrevidenciarioCalculatorProps {
  selectedClientId: string | null
}

export function FatorPrevidenciarioCalculator(_props: FatorPrevidenciarioCalculatorProps) {
  const [tempoContribuicao, setTempoContribuicao] = useState('')
  const [idade, setIdade] = useState('')
  const [sexo, setSexo] = useState<'M' | 'F'>('M')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<FatorPrevidenciarioResult | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const tc = parseFloat(tempoContribuicao)
    const id = parseFloat(idade)

    if (isNaN(tc) || isNaN(id) || tc <= 0 || id <= 0) {
      toast.error('Preencha todos os campos corretamente')
      return
    }

    setLoading(true)
    setResultado(null)

    try {
      const res = await fetchWithCredentials(`${API_URL}/calculators/previdencia/fator-previdenciario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempo_contribuicao_anos: tc,
          idade: id,
          sexo,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Erro ao calcular')
      }

      const data: FatorPrevidenciarioResult = await res.json()
      setResultado(data)

      analytics.track('feature_used', {
        feature: 'calculator_fator_previdenciario',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao calcular fator previdenciário')
    } finally {
      setLoading(false)
    }
  }

  const fatorColor = resultado
    ? resultado.fator >= 1
      ? 'text-green-600 dark:text-green-400'
      : resultado.fator >= 0.7
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400'
    : ''

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Formulário */}
      <div className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sexo */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Sexo</label>
            <div className="flex gap-3">
              {(['M', 'F'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSexo(s)}
                  className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                    sexo === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:border-primary/50'
                  }`}
                >
                  {s === 'M' ? 'Masculino' : 'Feminino'}
                </button>
              ))}
            </div>
          </div>

          {/* Tempo de Contribuição */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Tempo de Contribuição (anos)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="60"
              value={tempoContribuicao}
              onChange={(e) => setTempoContribuicao(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Ex: 35"
            />
          </div>

          {/* Idade */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Idade (anos)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="120"
              value={idade}
              onChange={(e) => setIdade(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Ex: 63"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4" />
            )}
            Calcular Fator
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Gratuito — sem custo de créditos
          </p>
        </form>
      </div>

      {/* Resultado */}
      <div className="lg:border-l lg:pl-6 border-border">
        {resultado ? (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Resultado
            </h2>

            <div className="p-6 rounded-xl border border-border bg-muted/30 text-center">
              <p className="text-sm text-muted-foreground mb-1">Fator Previdenciário</p>
              <p className={`text-4xl font-bold ${fatorColor}`}>
                {resultado.fator.toFixed(4)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {resultado.fator >= 1
                  ? 'Fator favorável — aumenta o benefício'
                  : resultado.fator >= 0.7
                    ? 'Fator moderado — redução parcial'
                    : 'Fator desfavorável — redução significativa'}
              </p>
            </div>

            <div className="p-4 rounded-lg border border-border bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground mb-2">Fórmula aplicada</p>
              <p className="text-xs font-mono text-foreground break-all">
                {resultado.formula_detalhada}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Quando se aplica:</strong> O fator previdenciário é obrigatório na regra de
                Pedágio 50% e na aposentadoria por tempo de contribuição (direito adquirido pré-reforma).
                Nas demais regras pós-reforma, não é utilizado.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <p>Preencha os dados e clique em calcular</p>
          </div>
        )}
      </div>
    </div>
  )
}
