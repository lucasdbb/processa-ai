import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Calculator, ArrowRight, Loader2, Coins, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'
import { useCalculators } from '@/features/calculators/context'
import { useCreditsStore } from '@/stores/credits-store'
import { ClientSelector } from '@/components/forms/client-selector'
import type { LucideIcon } from 'lucide-react'

type RescisaoDetalhes = {
  remuneracaoBruta: number
  saldoSalario: number
  avisoPrevio: number
  feriasVencidas: number
  feriasProporcionais: number
  decimoTerceiro: number
  fgts: number
  multaFgts: number
  total: number
}

type AposentadoriaDetalhes = {
  podeAposentar: boolean
  anosRestantes: number
  tempoRestante: number
  beneficio: number
  idadeMinima: number
  tempoMinimoContrib: number
}

type Resultado =
  | {
      tipo: 'rescisao'
      detalhes: RescisaoDetalhes
    }
  | {
      tipo: 'aposentadoria'
      detalhes: AposentadoriaDetalhes
    }

// Category mapping based on calculator slugs
const getCategoryForCalculator = (slug: string): string => {
  const categoryMap: Record<string, string> = {
    rescisao: 'trabalhista',
    aposentadoria: 'previdenciario',
    correcao_monetaria: 'civel',
    honorarios: 'civel',
    juros: 'civel',
  }
  return categoryMap[slug] || 'civel'
}

const categories = [
  { id: 'all', name: 'Todas' },
  { id: 'trabalhista', name: 'Trabalhista' },
  { id: 'previdenciario', name: 'Previdenciário' },
  { id: 'civel', name: 'Cível' },
]

interface CalculatorConfig {
  id: string
  name: string
  description: string
  icon: LucideIcon
  href: string
  category: string
  available: boolean
}

export default function CalculadorasHubPage() {
  const { calculatorId } = useParams<{ calculatorId?: string }>()
  const navigate = useNavigate()
  const { calculators: calculatorsFromContext, isLoading: isLoadingCalcs, error: calcsError } = useCalculators()
  const { credits, fetchCredits, costs, fetchCosts } = useCreditsStore()

  useEffect(() => {
    fetchCosts()
  }, [fetchCosts])

  // Build calculators array from context
  const calculators = useMemo<CalculatorConfig[]>(() => {
    return calculatorsFromContext.map((calc) => ({
      id: calc.slug,
      name: calc.name,
      description: calc.description,
      icon: calc.icon,
      href: calc.path,
      category: getCategoryForCalculator(calc.slug),
      available: !calc.locked,
    }))
  }, [calculatorsFromContext])

  const selectedCalculator = useMemo(() => {
    if (!calculatorId) return null
    if (calculatorId === 'rescisao' || calculatorId === 'aposentadoria') return calculatorId
    return null
  }, [calculatorId])

  const costDisplay = useMemo(() => {
    if (!selectedCalculator) return null

    const featureKey = `calculator_${selectedCalculator}`

    const costItem = costs.find(c => c.feature_key === featureKey)
    if (costItem) return costItem.cost === 1 ? '1 crédito' : `${costItem.cost} créditos`

    // Fallback
    return '1 crédito'
  }, [selectedCalculator, costs])

  const current = useMemo(() => {
    if (!selectedCalculator) return null
    return calculators.find((c) => c.id === selectedCalculator) || null
  }, [calculators, selectedCalculator])

  const { user } = useUser()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    // Rescisão - Composição Salarial
    salarioBase: '',
    adicionalPericulosidade: false,
    adicionalInsalubridadeGrau: '0', // 0, 10, 20, 40
    baseInsalubridade: '1621.00',
    adicionalNoturnoPercent: '20',
    mediaHorasNoturnas: '',
    outrasVerbas: '',

    // Rescisão - Dados do Contrato
    dataAdmissao: '',
    dataRescisao: '',
    tipoRescisao: 'sem_justa_causa',
    avisoPrevio: true,
    feriasVencidas: '',
    feriasProporcionais: true,
    decimoTerceiro: true,

    // Aposentadoria
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

  const calcularRescisao = useCallback(async () => {
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
    try {
      const res = await fetchWithCredentials(`${API_URL}/calculators/trabalhista/rescisao-trabalhista`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          ...(selectedClientId && { client_id: selectedClientId }),
          
          // Novos campos de composição
          salario_base: parseFloat(formData.salarioBase) || 0,
          adicional_periculosidade: formData.adicionalPericulosidade,
          adicional_insalubridade_grau: parseInt(formData.adicionalInsalubridadeGrau) || 0,
          base_insalubridade: parseFloat(formData.baseInsalubridade) || 1621.00,
          adicional_noturno_percent: parseFloat(formData.adicionalNoturnoPercent) || 20,
          media_horas_noturnas: parseFloat(formData.mediaHorasNoturnas) || 0,
          outras_verbas: parseFloat(formData.outrasVerbas) || 0,

          data_admissao: formData.dataAdmissao,
          data_rescisao: formData.dataRescisao,
          tipo_rescisao: formData.tipoRescisao,
          aviso_previo: formData.avisoPrevio,
          ferias_vencidas: parseInt(formData.feriasVencidas) || 0,
          ferias_proporcionais: formData.feriasProporcionais,
          decimo_terceiro: formData.decimoTerceiro,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error((error as { detail?: string } | null)?.detail || 'Erro ao calcular rescisão')
      }

      const data = await res.json() as {
        detalhes: {
          remuneracao_bruta: number
          saldo_salario: number
          aviso_previo: number
          ferias_vencidas: number
          ferias_proporcionais: number
          decimo_terceiro: number
          fgts: number
          multa_fgts: number
          total: number
        }
      }

      setResultado({
        tipo: 'rescisao',
        detalhes: {
          remuneracaoBruta: data.detalhes.remuneracao_bruta,
          saldoSalario: data.detalhes.saldo_salario,
          avisoPrevio: data.detalhes.aviso_previo,
          feriasVencidas: data.detalhes.ferias_vencidas,
          feriasProporcionais: data.detalhes.ferias_proporcionais,
          decimoTerceiro: data.detalhes.decimo_terceiro,
          fgts: data.detalhes.fgts,
          multaFgts: data.detalhes.multa_fgts,
          total: data.detalhes.total,
        },
      })
      
      // Update credits
      fetchCredits()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao calcular rescisão')
    } finally {
      setIsCalculating(false)
    }
  }, [formData, selectedClientId, user, credits, fetchCredits])

  const calcularAposentadoria = useCallback(async () => {
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao calcular aposentadoria')
    } finally {
      setIsCalculating(false)
    }
  }, [formData, selectedClientId, user, credits, fetchCredits])

  const handleCalculate = useCallback(async () => {
    setResultado(null)
    if (selectedCalculator === 'rescisao') {
      await calcularRescisao()
      return
    }

    if (selectedCalculator === 'aposentadoria') {
      calcularAposentadoria()
    }
  }, [calcularAposentadoria, calcularRescisao, selectedCalculator])

  if (calculatorId && !selectedCalculator) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calculadora não encontrada</h1>
          <p className="text-muted-foreground mt-1">Volte para a lista e selecione uma calculadora disponível.</p>
        </div>
        <Link
          to="/app/calculadoras"
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Voltar
        </Link>
      </div>
    )
  }

  if (selectedCalculator && current) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <select
                  value={selectedCalculator}
                  onChange={(e) => {
                    const calc = calculators.find((c) => c.id === e.target.value)
                    if (calc) navigate(calc.href)
                  }}
                  className="appearance-none pl-3 pr-8 py-1.5 bg-muted border border-border rounded-lg text-xl font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  {calculators.filter((c) => c.available).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              {costDisplay && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-xs font-medium text-yellow-600 dark:text-yellow-500">
                  <Coins className="w-3.5 h-3.5" />
                  <span>{costDisplay}</span>
                </div>
              )}
            </div>
            <p className="text-muted-foreground mt-1">{current.description}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <ClientSelector
              value={selectedClientId}
              onChange={(id) => setSelectedClientId(id)}
              className="w-64"
              label="Cliente"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <div className="bg-card border border-border rounded-xl p-5">
              {selectedCalculator === 'rescisao' ? (
                <div className="space-y-6">
                  {/* Seção 1: Composição Salarial */}
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">
                      Composição Salarial
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-1.5">Salário Base na Carteira (R$) *</label>
                        <input
                          type="number"
                          value={formData.salarioBase}
                          onChange={(e) => handleInputChange('salarioBase', e.target.value)}
                          className="w-full px-3 py-2 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground text-sm"
                          placeholder="Ex: 3000,00"
                          required
                        />
                      </div>

                      {/* Adicionais */}
                      <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                            <label className="flex items-center cursor-pointer mb-2">
                              <input
                                type="checkbox"
                                checked={formData.adicionalPericulosidade}
                                onChange={(e) => handleInputChange('adicionalPericulosidade', e.target.checked)}
                                className="rounded border-input text-primary focus:ring-primary w-4 h-4 transition-all"
                              />
                              <span className="ml-2 text-sm font-medium text-foreground">
                                Periculosidade (30%)
                              </span>
                            </label>
                            <p className="text-xs text-muted-foreground ml-6">Incide 30% sobre o salário base.</p>
                         </div>

                         <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                            <label className="block text-sm font-medium text-foreground mb-1.5">Insalubridade</label>
                            <select
                              value={formData.adicionalInsalubridadeGrau}
                              onChange={(e) => handleInputChange('adicionalInsalubridadeGrau', e.target.value)}
                              className="w-full px-2 py-1.5 bg-background border border-input rounded-md text-sm mb-2"
                            >
                              <option value="0">Não se aplica</option>
                              <option value="10">Grau Mínimo (10%)</option>
                              <option value="20">Grau Médio (20%)</option>
                              <option value="40">Grau Máximo (40%)</option>
                            </select>
                            {formData.adicionalInsalubridadeGrau !== '0' && (
                              <div>
                                <label className="text-xs text-muted-foreground">Base de Cálculo (R$)</label>
                                <input
                                  type="number"
                                  value={formData.baseInsalubridade}
                                  onChange={(e) => handleInputChange('baseInsalubridade', e.target.value)}
                                  className="w-full px-2 py-1 bg-background border border-input rounded-md text-xs"
                                />
                              </div>
                            )}
                         </div>
                      </div>

                      {/* Adicional Noturno */}
                      <div className="bg-muted/30 p-3 rounded-lg border border-border/50 md:col-span-2">
                          <label className="block text-sm font-medium text-foreground mb-2">Adicional Noturno</label>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">Percentual (%)</label>
                              <input
                                type="number"
                                value={formData.adicionalNoturnoPercent}
                                onChange={(e) => handleInputChange('adicionalNoturnoPercent', e.target.value)}
                                className="w-full px-2 py-1.5 bg-background border border-input rounded-md text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">Média Horas/Mês</label>
                              <input
                                type="number"
                                value={formData.mediaHorasNoturnas}
                                onChange={(e) => handleInputChange('mediaHorasNoturnas', e.target.value)}
                                className="w-full px-2 py-1.5 bg-background border border-input rounded-md text-sm"
                                placeholder="Ex: 0"
                              />
                            </div>
                          </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-1.5">Outras Verbas (Comissões/Médias) R$</label>
                        <input
                          type="number"
                          value={formData.outrasVerbas}
                          onChange={(e) => handleInputChange('outrasVerbas', e.target.value)}
                          className="w-full px-3 py-2 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground text-sm"
                          placeholder="Ex: 500,00"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção 2: Dados do Contrato */}
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">
                      Dados do Contrato
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Data de Admissão *</label>
                        <input
                          type="date"
                          value={formData.dataAdmissao}
                          onChange={(e) => handleInputChange('dataAdmissao', e.target.value)}
                          className="w-full px-3 py-2 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Data de Rescisão *</label>
                        <input
                          type="date"
                          value={formData.dataRescisao}
                          onChange={(e) => handleInputChange('dataRescisao', e.target.value)}
                          className="w-full px-3 py-2 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground text-sm"
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-1.5">Motivo da Rescisão *</label>
                        <div className="relative">
                          <select
                            value={formData.tipoRescisao}
                            onChange={(e) => handleInputChange('tipoRescisao', e.target.value)}
                            className="w-full px-3 py-2 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none text-foreground text-sm"
                          >
                            <option value="sem_justa_causa">Dispensa sem Justa Causa</option>
                            <option value="por_pedido">Pedido de Demissão</option>
                            <option value="com_justa_causa">Dispensa com Justa Causa</option>
                            <option value="acordo">Acordo (Reforma Trabalhista)</option>
                            <option value="termino_contrato">Término de Contrato</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-muted-foreground">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Férias Vencidas (dias)</label>
                        <input
                          type="number"
                          value={formData.feriasVencidas}
                          onChange={(e) => handleInputChange('feriasVencidas', e.target.value)}
                          className="w-full px-3 py-2 bg-muted/50 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground text-sm"
                          placeholder="Ex: 0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 mt-4 border-t border-border">
                      <label className="flex items-center cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={formData.avisoPrevio}
                          onChange={(e) => handleInputChange('avisoPrevio', e.target.checked)}
                          className="rounded border-input text-primary focus:ring-primary w-4 h-4 transition-all"
                        />
                        <span className="ml-2 text-sm text-muted-foreground group-hover:text-foreground font-medium transition-colors">
                          Aviso Prévio
                        </span>
                      </label>
                      <label className="flex items-center cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={formData.feriasProporcionais}
                          onChange={(e) => handleInputChange('feriasProporcionais', e.target.checked)}
                          className="rounded border-input text-primary focus:ring-primary w-4 h-4 transition-all"
                        />
                        <span className="ml-2 text-sm text-muted-foreground group-hover:text-foreground font-medium transition-colors">
                          Férias Proporcionais
                        </span>
                      </label>
                      <label className="flex items-center cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={formData.decimoTerceiro}
                          onChange={(e) => handleInputChange('decimoTerceiro', e.target.checked)}
                          className="rounded border-input text-primary focus:ring-primary w-4 h-4 transition-all"
                        />
                        <span className="ml-2 text-sm text-muted-foreground group-hover:text-foreground font-medium transition-colors">
                          13º Proporcional
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedCalculator === 'aposentadoria' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-2">Sexo *</label>
                      <div className="flex space-x-4">
                        <label className="flex items-center cursor-pointer group">
                          <input
                            type="radio"
                            name="sexo"
                            value="masculino"
                            checked={formData.sexo === 'masculino'}
                            onChange={(e) => handleInputChange('sexo', e.target.value)}
                            className="w-4 h-4 text-primary focus:ring-primary border-input"
                          />
                          <span className="ml-2 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
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
                            className="w-4 h-4 text-primary focus:ring-primary border-input"
                          />
                          <span className="ml-2 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                            Feminino
                          </span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-2">Tipo de Aposentadoria *</label>
                      <div className="relative">
                        <select
                          value={formData.tipoAposentadoria}
                          onChange={(e) => handleInputChange('tipoAposentadoria', e.target.value)}
                          className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none text-foreground"
                        >
                          <option value="tempo_contribuicao">Tempo de Contribuição</option>
                          <option value="idade">Idade</option>
                          <option value="pontos">Pontos</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-muted-foreground">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-2">Idade Atual *</label>
                      <input
                        type="number"
                        value={formData.idade}
                        onChange={(e) => handleInputChange('idade', e.target.value)}
                        className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground"
                        placeholder="Ex: 45"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-2">Tempo de Contribuição (anos) *</label>
                      <input
                        type="number"
                        value={formData.tempoContribuicao}
                        onChange={(e) => handleInputChange('tempoContribuicao', e.target.value)}
                        className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground"
                        placeholder="Ex: 20"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-foreground mb-2">Salário de Contribuição (R$) *</label>
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
              ) : null}

              <div className="mt-5 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={handleCalculate}
                  disabled={isCalculating}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCalculating ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Calculator className="h-5 w-5 mr-2" />
                  )}
                  <span>{isCalculating ? 'Calculando...' : 'Calcular'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {resultado ? (
              <div className="bg-card border border-border rounded-2xl p-6">
                {resultado.tipo === 'rescisao' ? (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold text-foreground">Resultado</h2>
                    
                    <div className="pb-3 border-b border-border">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Remuneração Base</span>
                          <span className="font-semibold text-foreground">R$ {resultado.detalhes.remuneracaoBruta.toFixed(2)}</span>
                       </div>
                    </div>

                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Saldo de Salário</span>
                      <span className="font-medium text-foreground">R$ {resultado.detalhes.saldoSalario.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Aviso Prévio</span>
                      <span className="font-medium text-foreground">R$ {resultado.detalhes.avisoPrevio.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Férias Vencidas</span>
                      <span className="font-medium text-foreground">R$ {resultado.detalhes.feriasVencidas.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Férias Proporcionais</span>
                      <span className="font-medium text-foreground">R$ {resultado.detalhes.feriasProporcionais.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>13º Proporcional</span>
                      <span className="font-medium text-foreground">R$ {resultado.detalhes.decimoTerceiro.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>FGTS</span>
                      <span className="font-medium text-foreground">R$ {resultado.detalhes.fgts.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Multa FGTS</span>
                      <span className="font-medium text-foreground">R$ {resultado.detalhes.multaFgts.toFixed(2)}</span>
                    </div>
                    <div className="pt-4 border-t border-border flex justify-between items-center text-foreground font-bold">
                      <span>Total</span>
                      <span>R$ {resultado.detalhes.total.toFixed(2)}</span>
                    </div>
                  </div>
                ) : null}

                {resultado.tipo === 'aposentadoria' ? (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold text-foreground">Resultado</h2>
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
                          'font-bold',
                          resultado.detalhes.podeAposentar
                            ? 'text-[hsl(var(--success-strong))]'
                            : 'text-[hsl(var(--warning-strong))]'
                        )}
                      >
                        {resultado.detalhes.podeAposentar ? 'Pode se aposentar' : 'Não pode se aposentar ainda'}
                      </div>
                      {!resultado.detalhes.podeAposentar ? (
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Anos restantes (idade)</span>
                            <span className="text-foreground font-medium">{resultado.detalhes.anosRestantes} anos</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tempo restante (contribuição)</span>
                            <span className="text-foreground font-medium">{resultado.detalhes.tempoRestante} anos</span>
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Idade mínima</span>
                          <span className="text-foreground font-medium">{resultado.detalhes.idadeMinima} anos</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tempo mínimo</span>
                          <span className="text-foreground font-medium">{resultado.detalhes.tempoMinimoContrib} anos</span>
                        </div>
                      </div>
                      {resultado.detalhes.podeAposentar ? (
                        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center text-foreground font-bold">
                          <span>Benefício estimado</span>
                          <span>R$ {resultado.detalhes.beneficio.toFixed(2)}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground">
                <Calculator className="h-10 w-10 mx-auto mb-3 opacity-60" />
                <p>Preencha os campos e clique em Calcular.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calculadoras</h1>
        <p className="text-muted-foreground mt-1">
          Ferramentas de cálculo para auxiliar no seu trabalho jurídico.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              category.id === selectedCategory
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Calculator Grid */}
      {isLoadingCalcs ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : calcsError ? (
        <div className="text-center py-12">
          <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Erro ao carregar calculadoras</h3>
          <p className="text-muted-foreground">Não foi possível carregar as calculadoras. Tente novamente mais tarde.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {calculators.filter((calc) => selectedCategory === 'all' || calc.category === selectedCategory).map((calc) => {
          const Icon = calc.icon

          return (
            <div
              key={calc.id}
              className={cn(
                'group relative bg-card border border-border rounded-xl p-4 transition-all duration-200',
                calc.available
                  ? 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-0.5 cursor-pointer'
                  : 'opacity-60'
              )}
            >
              {!calc.available && (
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-500 text-[11px] font-semibold rounded-full border border-amber-500/20">
                  Em breve
                </div>
              )}

              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                    calc.available
                      ? 'bg-muted group-hover:bg-primary group-hover:text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground mb-0.5">{calc.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {calc.description}
                  </p>
                </div>
              </div>

              {calc.available && (
                <Link
                  to={calc.href}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground mt-3 pt-3 border-t border-border transition-colors"
                >
                  Acessar
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
            </div>
          )
        })}
      </div>
      )}

      {/* Recent Calculations */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Cálculos Recentes</h2>
        </div>
        <div className="p-5">
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Seus cálculos recentes aparecerão aqui.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
