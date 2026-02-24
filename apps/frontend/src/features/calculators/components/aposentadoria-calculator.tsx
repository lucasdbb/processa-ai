
import { useState, useCallback } from 'react'
import { Calculator, Loader2, FileText, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'
import { useCreditsStore } from '@/stores/credits-store'
import type { AposentadoriaDetalhes, CalculatorResult } from '../types'
import { analytics } from '@/lib/analytics'

interface AposentadoriaCalculatorProps {
  selectedClientId: string | null
}

export function AposentadoriaCalculator({ selectedClientId }: AposentadoriaCalculatorProps) {
  const { user } = useUser()
  const { credits, fetchCredits } = useCreditsStore()
  
  const [resultado, setResultado] = useState<CalculatorResult<AposentadoriaDetalhes> | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  
  const [formData, setFormData] = useState({
    sexo: 'masculino',
    tipoAposentadoria: 'tempo_contribuicao',
    idade: '',
    tempoContribuicao: '',
    salarioContribuicao: '',
  })

  const handleInputChange = useCallback(
    (field: keyof typeof formData, value: string | boolean) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }))
    },
    []
  )

  const handleCalculate = useCallback(async () => {
    if (!user?.id) {
      toast.error('Usuário não autenticado')
      return
    }

    // Check credits
    await fetchCredits()
    if (credits && credits.total_available < 1) {
       toast.error('Créditos insuficientes. Recarregue para continuar.')
       return
    }

    setIsCalculating(true)
    
    analytics.track('feature_used', {
      feature: 'aposentadoria_calculator',
      action: 'started',
      tipo: formData.tipoAposentadoria
    })

    try {
      const res = await fetchWithCredentials(`${API_URL}/calculators/previdencia/aposentadoria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          ...(selectedClientId && { client_id: selectedClientId }),
          sexo: formData.sexo,
          tipo_aposentadoria: formData.tipoAposentadoria,
          idade: parseInt(formData.idade) || 0,
          tempo_contribuicao: parseInt(formData.tempoContribuicao) || 0,
          salario_contribuicao: parseFloat(formData.salarioContribuicao) || 0,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error((error as { detail?: string } | null)?.detail || 'Erro ao calcular aposentadoria')
      }

      const data = await res.json() as {
        detalhes: {
          pode_aposentar: boolean
          anos_restantes: number
          tempo_restante: number
          beneficio: number
          idade_minima: number
          tempo_minimo_contrib: number
        }
      }

      setResultado({
        tipo: 'aposentadoria',
        detalhes: {
          podeAposentar: data.detalhes.pode_aposentar,
          anosRestantes: data.detalhes.anos_restantes,
          tempoRestante: data.detalhes.tempo_restante,
          beneficio: data.detalhes.beneficio,
          idadeMinima: data.detalhes.idade_minima,
          tempoMinimoContrib: data.detalhes.tempo_minimo_contrib,
        },
      })
      
      // Update credits
      fetchCredits()
      
      analytics.track('feature_used', {
        feature: 'aposentadoria_calculator',
        action: 'completed',
        success: true,
        pode_aposentar: data.detalhes.pode_aposentar
      })
    } catch (err) {
      analytics.track('feature_used', {
        feature: 'aposentadoria_calculator',
        action: 'failed',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      toast.error(err instanceof Error ? err.message : 'Erro ao calcular aposentadoria')
    } finally {
      setIsCalculating(false)
    }
  }, [formData, selectedClientId, user, credits, fetchCredits])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 min-h-0">
      <div className="lg:col-span-3 flex flex-col min-h-0">
        <div className="bg-card border border-border rounded-xl flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Sexo *</label>
                  <div className="flex space-x-3">
                    <label className="flex items-center cursor-pointer group">
                      <input
                        type="radio"
                        name="sexo"
                        value="masculino"
                        checked={formData.sexo === 'masculino'}
                        onChange={(e) => handleInputChange('sexo', e.target.value)}
                        className="w-3.5 h-3.5 text-primary focus:ring-primary border-input"
                      />
                      <span className="ml-1.5 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        Masculino
                      </span>
                    </label>
                    <label className="flex items-center cursor-pointer group">
                      <input
                        type="radio"
                        name="sexo"
                        value="feminino"
                        checked={formData.sexo === 'feminino'}
                        onChange={(e) => handleInputChange('sexo', e.target.value)}
                        className="w-3.5 h-3.5 text-primary focus:ring-primary border-input"
                      />
                      <span className="ml-1.5 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        Feminino
                      </span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Tipo *</label>
                  <div className="relative">
                    <select
                      value={formData.tipoAposentadoria}
                      onChange={(e) => handleInputChange('tipoAposentadoria', e.target.value)}
                      className="w-full px-3 py-1.5 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none text-foreground text-sm"
                    >
                      <option value="tempo_contribuicao">Tempo de Contribuição</option>
                      <option value="idade">Idade</option>
                      <option value="pontos">Pontos</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-muted-foreground">
                      <ChevronDown className="h-3 w-3" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Idade Atual *</label>
                  <input
                    type="number"
                    value={formData.idade}
                    onChange={(e) => handleInputChange('idade', e.target.value)}
                    className="w-full px-3 py-1.5 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground text-sm"
                    placeholder="Ex: 45"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Tempo Contrib. (anos) *</label>
                  <input
                    type="number"
                    value={formData.tempoContribuicao}
                    onChange={(e) => handleInputChange('tempoContribuicao', e.target.value)}
                    className="w-full px-3 py-1.5 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground text-sm"
                    placeholder="Ex: 20"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-foreground mb-1.5">Salário Contribuição (R$) *</label>
                  <input
                    type="number"
                    value={formData.salarioContribuicao}
                    onChange={(e) => handleInputChange('salarioContribuicao', e.target.value)}
                    className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground"
                    placeholder="Ex: 4500,00"
                    required
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-border bg-muted/10 shrink-0">
            <button
              type="button"
              onClick={handleCalculate}
              disabled={isCalculating}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isCalculating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              <span>{isCalculating ? 'Calculando...' : 'Calcular'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 flex flex-col min-h-0">
        {resultado ? (
          <div className="bg-card border border-border rounded-xl flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <div className="space-y-4">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Análise Previdenciária
                </h2>
                <div
                  className={cn(
                    'p-4 rounded-xl border',
                    resultado.detalhes.podeAposentar
                      ? 'bg-green-500/10 border-green-500/20'
                      : 'bg-yellow-500/10 border-yellow-500/20'
                  )}
                >
                  <div
                    className={cn(
                      'font-bold text-base mb-2',
                      resultado.detalhes.podeAposentar
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-yellow-600 dark:text-yellow-400'
                    )}
                  >
                    {resultado.detalhes.podeAposentar ? 'Pode se aposentar' : 'Não pode se aposentar ainda'}
                  </div>
                  
                  {!resultado.detalhes.podeAposentar ? (
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between p-2 bg-background/50 rounded-lg">
                        <span className="text-muted-foreground">Faltam (idade)</span>
                        <span className="text-foreground font-medium">{resultado.detalhes.anosRestantes} anos</span>
                      </div>
                      <div className="flex justify-between p-2 bg-background/50 rounded-lg">
                        <span className="text-muted-foreground">Faltam (contribuição)</span>
                        <span className="text-foreground font-medium">{resultado.detalhes.tempoRestante} anos</span>
                      </div>
                    </div>
                  ) : null}
                  
                  <div className="mt-4 space-y-2 text-xs border-t border-border/50 pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Idade mínima exigida</span>
                      <span className="text-foreground font-medium">{resultado.detalhes.idadeMinima} anos</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tempo mínimo exigido</span>
                      <span className="text-foreground font-medium">{resultado.detalhes.tempoMinimoContrib} anos</span>
                    </div>
                  </div>
                  
                  {resultado.detalhes.podeAposentar ? (
                    <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center text-foreground font-bold">
                      <span>Benefício estimado</span>
                      <span>R$ {resultado.detalhes.beneficio.toFixed(2)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground h-full flex flex-col items-center justify-center">
            <Calculator className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Preencha os dados ao lado e clique em Calcular</p>
            <p className="text-xs mt-1 opacity-60">Os resultados aparecerão aqui</p>
          </div>
        )}
      </div>
    </div>
  )
}
