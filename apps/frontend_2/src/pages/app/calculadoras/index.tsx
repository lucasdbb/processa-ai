import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Calculator, DollarSign, Calendar, TrendingUp, Clock, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type RescisaoDetalhes = {
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

const calculators = [
  {
    id: 'rescisao',
    name: 'Rescisão Trabalhista',
    description: 'Calcule todas as verbas rescisórias: saldo de salário, aviso prévio, férias, 13°, FGTS e multa.',
    icon: DollarSign,
    href: '/app/calculadoras/rescisao',
    category: 'trabalhista',
    available: true,
  },
  {
    id: 'aposentadoria',
    name: 'Simulação de Aposentadoria',
    description: 'Simule tempo de contribuição, idade mínima e valor do benefício com as regras de transição.',
    icon: Calendar,
    href: '/app/calculadoras/aposentadoria',
    category: 'previdenciario',
    available: true,
  },
  {
    id: 'correcao',
    name: 'Correção Monetária',
    description: 'Atualize valores com IPCA-E, INPC, Taxa Selic, TR ou IGP-M de forma automática.',
    icon: TrendingUp,
    href: '/app/calculadoras/correcao',
    category: 'civel',
    available: false,
  },
  {
    id: 'juros',
    name: 'Juros de Mora',
    description: 'Calcule juros de mora sobre valores com diferentes taxas e períodos.',
    icon: Clock,
    href: '/app/calculadoras/juros',
    category: 'civel',
    available: false,
  },
]

const categories = [
  { id: 'all', name: 'Todas' },
  { id: 'trabalhista', name: 'Trabalhista' },
  { id: 'previdenciario', name: 'Previdenciário' },
  { id: 'civel', name: 'Cível' },
]

export default function CalculadorasHubPage() {
  const { calculatorId } = useParams<{ calculatorId?: string }>()

  const selectedCalculator = useMemo(() => {
    if (!calculatorId) return null
    if (calculatorId === 'rescisao' || calculatorId === 'aposentadoria') return calculatorId
    return null
  }, [calculatorId])

  const current = useMemo(() => {
    if (!selectedCalculator) return null
    return calculators.find((c) => c.id === selectedCalculator) || null
  }, [selectedCalculator])

  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [formData, setFormData] = useState({
    salario: '',
    dataAdmissao: '',
    dataRescisao: '',
    tipoRescisao: 'sem_justa_causa',
    avisoPrevio: true,
    feriasVencidas: '',
    feriasProporcionais: true,
    decimoTerceiro: true,

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

  const calcularRescisao = useCallback(() => {
    const salario = parseFloat(formData.salario) || 0
    const dataAdm = new Date(formData.dataAdmissao)
    const dataResc = new Date(formData.dataRescisao)

    const mesesTrabalhados = Math.max(0, (dataResc.getTime() - dataAdm.getTime()) / (1000 * 60 * 60 * 24 * 30))
    const saldoSalario = salario * 0.5
    const avisoPrevio = formData.avisoPrevio ? salario : 0
    const feriasVencidas = parseFloat(formData.feriasVencidas) || 0
    const feriasProporcionais = formData.feriasProporcionais ? (salario / 12) * (mesesTrabalhados % 12) : 0
    const decimoTerceiro = formData.decimoTerceiro ? (salario / 12) * (mesesTrabalhados % 12) : 0
    const fgts = salario * 0.08 * mesesTrabalhados
    const multaFgts = formData.tipoRescisao === 'sem_justa_causa' ? fgts * 0.4 : 0
    const total = saldoSalario + avisoPrevio + feriasVencidas + feriasProporcionais + decimoTerceiro + fgts + multaFgts

    setResultado({
      tipo: 'rescisao',
      detalhes: {
        saldoSalario,
        avisoPrevio,
        feriasVencidas,
        feriasProporcionais,
        decimoTerceiro,
        fgts,
        multaFgts,
        total,
      },
    })
  }, [formData])

  const calcularAposentadoria = useCallback(() => {
    const idade = parseInt(formData.idade) || 0
    const tempoContrib = parseInt(formData.tempoContribuicao) || 0
    const salario = parseFloat(formData.salarioContribuicao) || 0

    const idadeMinima = formData.sexo === 'masculino' ? 65 : 62
    const tempoMinimoContrib = 15

    const podeAposentar = idade >= idadeMinima && tempoContrib >= tempoMinimoContrib
    const anosRestantes = Math.max(0, idadeMinima - idade)
    const tempoRestante = Math.max(0, tempoMinimoContrib - tempoContrib)

    const beneficio = podeAposentar ? salario * 0.6 + (tempoContrib - 15) * 0.02 * salario : 0

    setResultado({
      tipo: 'aposentadoria',
      detalhes: {
        podeAposentar,
        anosRestantes,
        tempoRestante,
        beneficio,
        idadeMinima,
        tempoMinimoContrib,
      },
    })
  }, [formData])

  const handleCalculate = useCallback(() => {
    setResultado(null)
    if (selectedCalculator === 'rescisao') {
      calcularRescisao()
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
            <h1 className="text-2xl font-bold text-foreground">{current.name}</h1>
            <p className="text-muted-foreground mt-1">{current.description}</p>
          </div>
          <Link
            to="/app/calculadoras"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Ver todas
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <div className="bg-card border border-border rounded-2xl p-6">
              {selectedCalculator === 'rescisao' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-2">Salário Mensal (R$) *</label>
                      <input
                        type="number"
                        value={formData.salario}
                        onChange={(e) => handleInputChange('salario', e.target.value)}
                        className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground"
                        placeholder="Ex: 3000,00"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-2">Data de Admissão *</label>
                      <input
                        type="date"
                        value={formData.dataAdmissao}
                        onChange={(e) => handleInputChange('dataAdmissao', e.target.value)}
                        className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-2">Data de Rescisão *</label>
                      <input
                        type="date"
                        value={formData.dataRescisao}
                        onChange={(e) => handleInputChange('dataRescisao', e.target.value)}
                        className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-2">Motivo da Rescisão *</label>
                      <div className="relative">
                        <select
                          value={formData.tipoRescisao}
                          onChange={(e) => handleInputChange('tipoRescisao', e.target.value)}
                          className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all appearance-none text-foreground"
                        >
                          <option value="sem_justa_causa">Dispensa sem Justa Causa</option>
                          <option value="por_pedido">Pedido de Demissão</option>
                          <option value="com_justa_causa">Dispensa com Justa Causa</option>
                          <option value="acordo">Acordo (Reforma Trabalhista)</option>
                          <option value="termino_contrato">Término de Contrato</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-muted-foreground">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-2">Férias Vencidas (dias)</label>
                      <input
                        type="number"
                        value={formData.feriasVencidas}
                        onChange={(e) => handleInputChange('feriasVencidas', e.target.value)}
                        className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-muted-foreground"
                        placeholder="Ex: 0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.avisoPrevio}
                        onChange={(e) => handleInputChange('avisoPrevio', e.target.checked)}
                        className="rounded border-input text-primary focus:ring-primary w-5 h-5 transition-all"
                      />
                      <span className="ml-3 text-sm text-muted-foreground group-hover:text-foreground font-medium transition-colors">
                        Aviso Prévio
                      </span>
                    </label>
                    <label className="flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.feriasProporcionais}
                        onChange={(e) => handleInputChange('feriasProporcionais', e.target.checked)}
                        className="rounded border-input text-primary focus:ring-primary w-5 h-5 transition-all"
                      />
                      <span className="ml-3 text-sm text-muted-foreground group-hover:text-foreground font-medium transition-colors">
                        Férias Proporcionais
                      </span>
                    </label>
                    <label className="flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.decimoTerceiro}
                        onChange={(e) => handleInputChange('decimoTerceiro', e.target.checked)}
                        className="rounded border-input text-primary focus:ring-primary w-5 h-5 transition-all"
                      />
                      <span className="ml-3 text-sm text-muted-foreground group-hover:text-foreground font-medium transition-colors">
                        13º Proporcional
                      </span>
                    </label>
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

              <div className="mt-8 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={handleCalculate}
                  className="bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-center px-8 py-4 rounded-xl font-bold text-base transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full sm:w-auto"
                >
                  <Calculator className="h-5 w-5 mr-2" />
                  <span>Calcular</span>
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
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              category.id === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Calculator Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {calculators.map((calc) => {
          const Icon = calc.icon

          return (
            <div
              key={calc.id}
              className={cn(
                'group relative bg-card border border-border rounded-xl p-6 transition-all',
                calc.available
                  ? 'hover:border-muted-foreground/50 hover:shadow-md cursor-pointer'
                  : 'opacity-60'
              )}
            >
              {!calc.available && (
                <div className="absolute top-4 right-4">
                  <span className="px-2 py-1 text-[10px] font-bold uppercase bg-muted text-muted-foreground rounded">
                    Em breve
                  </span>
                </div>
              )}

              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'p-3 rounded-xl transition-colors',
                    calc.available
                      ? 'bg-muted group-hover:bg-slate-900 group-hover:text-white'
                      : 'bg-muted'
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">{calc.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {calc.description}
                  </p>
                </div>
              </div>

              {calc.available && (
                <Link
                  to={calc.href}
                  className="mt-4 flex items-center gap-1 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors"
                >
                  Acessar
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
            </div>
          )
        })}
      </div>

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
