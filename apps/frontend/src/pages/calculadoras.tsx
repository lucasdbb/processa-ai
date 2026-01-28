import { useCallback, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Calendar, Calculator, Download, DollarSign, FileText, Info } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useUser } from '@/features/auth/hooks/use-user'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'

type CalculatorType = 'rescisao' | 'aposentadoria'

interface CalculatorFormData {
  salario: string
  dataAdmissao: string
  dataRescisao: string
  tipoRescisao: string
  avisoPrevio: boolean
  feriasVencidas: string
  feriasProporcionais: boolean
  decimoTerceiro: boolean

  idade: string
  tempoContribuicao: string
  salarioContribuicao: string
  sexo: string
  tipoAposentadoria: string
}

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

interface CalculatorConfig {
  id: CalculatorType
  name: string
  description: string
  icon: typeof DollarSign
  available: boolean
}

export default function CalculadorasPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useUser()
  const { openRegisterModal } = useOutletContext<RootLayoutOutletContext>()
  const [selectedCalculator, setSelectedCalculator] = useState<CalculatorType>('rescisao')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [formData, setFormData] = useState<CalculatorFormData>({
    salario: '',
    dataAdmissao: '',
    dataRescisao: '',
    tipoRescisao: 'sem_justa_causa',
    avisoPrevio: true,
    feriasVencidas: '',
    feriasProporcionais: true,
    decimoTerceiro: true,

    idade: '',
    tempoContribuicao: '',
    salarioContribuicao: '',
    sexo: 'masculino',
    tipoAposentadoria: 'tempo_contribuicao',
  })

  const calculators: CalculatorConfig[] = [
    {
      id: 'rescisao',
      name: 'Rescisão Trabalhista',
      description: 'Calcule todas as verbas rescisórias',
      icon: DollarSign,
      available: true,
    },
    {
      id: 'aposentadoria',
      name: 'Simulação de Aposentadoria',
      description: 'Simule aposentadoria e benefícios',
      icon: Calendar,
      available: true,
    },
  ]

  const handleInputChange = useCallback((field: keyof CalculatorFormData, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  const calcularRescisao = useCallback(() => {
    const salario = parseFloat(formData.salario) || 0
    const dataAdm = new Date(formData.dataAdmissao)
    const dataResc = new Date(formData.dataRescisao)

    const mesesTrabalhados = (dataResc.getTime() - dataAdm.getTime()) / (1000 * 60 * 60 * 24 * 30)

    const saldoSalario = salario * 0.5
    const avisoPrevio = formData.avisoPrevio ? salario : 0
    const feriasVencidasDias = parseInt(formData.feriasVencidas) || 0
    const feriasVencidas = (salario / 30) * feriasVencidasDias * (4 / 3)
    const feriasProporcionais = formData.feriasProporcionais
      ? (salario / 12) * (mesesTrabalhados % 12)
      : 0
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
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

    switch (selectedCalculator) {
      case 'rescisao':
        calcularRescisao()
        break
      case 'aposentadoria':
        calcularAposentadoria()
        break
      default:
        break
    }
  }, [calcularAposentadoria, calcularRescisao, isAuthenticated, openRegisterModal, selectedCalculator])

  const handleProtectedResultAction = useCallback(() => {
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }
  }, [isAuthenticated, openRegisterModal])

  const handleCalculatorSelect = useCallback((calculatorId: CalculatorType) => {
    setSelectedCalculator(calculatorId)
    setResultado(null)
  }, [])

  const renderRescisaoForm = () => (
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
            placeholder="Ex: 30"
          />
        </div>
        <div className="flex flex-col space-y-4 pt-2">
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
              13º Salário Proporcional
            </span>
          </label>
        </div>
      </div>
    </div>
  )

  const renderAposentadoriaForm = () => (
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
            placeholder="Ex: 55"
            min="0"
            max="120"
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
            placeholder="Ex: 25"
            min="0"
            max="60"
            required
          />
        </div>
        <div>
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
  )

  const renderResultado = () => {
    if (!resultado) return null

    if (resultado.tipo === 'rescisao') {
      const { detalhes } = resultado
      return (
        <div className="bg-muted/50 border border-border rounded-2xl p-6">
          <h3 className="text-lg font-bold text-foreground mb-6">Resultado do Cálculo</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Saldo de Salário:</span>
              <span className="font-medium text-foreground">R$ {detalhes.saldoSalario.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Aviso Prévio:</span>
              <span className="font-medium text-foreground">R$ {detalhes.avisoPrevio.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Férias Vencidas:</span>
              <span className="font-medium text-foreground">R$ {detalhes.feriasVencidas.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Férias Proporcionais:</span>
              <span className="font-medium text-foreground">R$ {detalhes.feriasProporcionais.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>13º Proporcional:</span>
              <span className="font-medium text-foreground">R$ {detalhes.decimoTerceiro.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>FGTS:</span>
              <span className="font-medium text-foreground">R$ {detalhes.fgts.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Multa FGTS (40%):</span>
              <span className="font-medium text-foreground">R$ {detalhes.multaFgts.toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-4 mt-2">
              <div className="flex justify-between items-center text-xl font-bold text-foreground">
                <span>Total:</span>
                <span>R$ {detalhes.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (resultado.tipo === 'aposentadoria') {
      const { detalhes } = resultado
      return (
        <div
          className={`p-6 rounded-2xl border ${
            detalhes.podeAposentar ? 'bg-green-500/10 border-green-500/20' : 'bg-yellow-500/10 border-yellow-500/20'
          }`}
        >
          <h3
            className={`text-lg font-bold mb-6 ${
              detalhes.podeAposentar
                ? 'text-[hsl(var(--success-strong))]'
                : 'text-[hsl(var(--warning-strong))]'
            }`}
          >
            Resultado da Simulação
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className={detalhes.podeAposentar ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--warning))]'}>
                Status:
              </span>
              <span
                className={`font-bold ${
                  detalhes.podeAposentar
                    ? 'text-[hsl(var(--success-strong))]'
                    : 'text-[hsl(var(--warning-strong))]'
                }`}
              >
                {detalhes.podeAposentar ? 'Pode se aposentar' : 'Não pode se aposentar ainda'}
              </span>
            </div>
            {!detalhes.podeAposentar ? (
              <>
                <div className="flex justify-between items-center text-[hsl(var(--warning))]">
                  <span>Anos restantes (idade):</span>
                  <span className="font-medium">{detalhes.anosRestantes} anos</span>
                </div>
                <div className="flex justify-between items-center text-[hsl(var(--warning))]">
                  <span>Tempo restante (contribuição):</span>
                  <span className="font-medium">{detalhes.tempoRestante} anos</span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between items-center text-muted-foreground">
              <span className={detalhes.podeAposentar ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--warning))]'}>
                Idade mínima:
              </span>
              <span className="font-medium text-foreground">{detalhes.idadeMinima} anos</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span className={detalhes.podeAposentar ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--warning))]'}>
                Tempo mínimo:
              </span>
              <span className="font-medium text-foreground">{detalhes.tempoMinimoContrib} anos</span>
            </div>
            {detalhes.podeAposentar ? (
              <div className="border-t border-green-500/20 pt-4 mt-2">
                <div className="flex justify-between items-center text-xl font-bold text-[hsl(var(--success-strong))]">
                  <span>Benefício Estimado:</span>
                  <span>R$ {detalhes.beneficio.toFixed(2)}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )
    }

    return null
  }

  if (isAuthLoading) {
    return <LoadingSpinner fullScreen size="lg" />
  }

  return (
    <div className="pt-24">
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-[var(--hero-glow-opacity)]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-4">
              Calculadoras Jurídicas
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Ferramentas precisas para cálculos trabalhistas e previdenciários. Economize tempo e
              evite erros em seus cálculos.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <h2 className="text-xl font-bold text-foreground mb-6 tracking-tight">
              Escolha a Calculadora
            </h2>
            <div className="space-y-4">
              {calculators.map((calc) => (
                <button
                  key={calc.id}
                  onClick={() => handleCalculatorSelect(calc.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 group ${
                    selectedCalculator === calc.id
                      ? 'border-primary bg-slate-900 shadow-lg scale-[1.02]'
                      : 'border-border bg-card hover:border-muted-foreground/50 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2.5 rounded-xl transition-colors ${
                        selectedCalculator === calc.id
                          ? 'bg-white/10 text-white'
                          : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
                      }`}
                    >
                      <calc.icon className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <h3
                        className={`font-bold text-sm ${
                          selectedCalculator === calc.id ? 'text-white' : 'text-foreground'
                        }`}
                      >
                        {calc.name}
                      </h3>
                      <p
                        className={`text-xs mt-1 ${
                          selectedCalculator === calc.id ? 'text-white/80' : 'text-muted-foreground'
                        }`}
                      >
                        {calc.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-card rounded-[2rem] border border-border shadow-xl p-8">
              <div className="flex items-center space-x-4 mb-8 pb-6 border-b border-border">
                <div className="bg-slate-900 p-4 rounded-2xl shadow-lg">
                  {(() => {
                    const current = calculators.find((c) => c.id === selectedCalculator)
                    if (!current) return null
                    const Icon = current.icon
                    return <Icon className="h-8 w-8 text-white" strokeWidth={1.5} />
                  })()}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">
                    {calculators.find((c) => c.id === selectedCalculator)?.name}
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    {calculators.find((c) => c.id === selectedCalculator)?.description}
                  </p>
                </div>
              </div>

              {selectedCalculator === 'rescisao' ? renderRescisaoForm() : null}
              {selectedCalculator === 'aposentadoria' ? renderAposentadoriaForm() : null}

              {selectedCalculator === 'rescisao' || selectedCalculator === 'aposentadoria' ? (
                <div className="mt-8 pt-6 border-t border-border">
                  <button
                    onClick={handleCalculate}
                    className="bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-center px-8 py-4 rounded-xl font-bold text-base transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full sm:w-auto"
                  >
                    <Calculator className="h-5 w-5 mr-2" />
                    <span>Calcular Agora</span>
                  </button>
                </div>
              ) : null}
            </div>

            {resultado ? (
              <div className="mt-8">
                {renderResultado()}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleProtectedResultAction}
                    className="flex items-center space-x-2 px-6 py-3 bg-card border border-border text-foreground font-semibold rounded-xl hover:bg-muted hover:border-muted-foreground/50 transition-all shadow-sm hover:shadow-md"
                  >
                    <Download className="h-5 w-5" />
                    <span>Baixar Relatório PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleProtectedResultAction}
                    className="flex items-center space-x-2 px-6 py-3 bg-card border border-border text-foreground font-semibold rounded-xl hover:bg-muted hover:border-muted-foreground/50 transition-all shadow-sm hover:shadow-md"
                  >
                    <FileText className="h-5 w-5" />
                    <span>Salvar Cálculo</span>
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-8 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6">
              <div className="flex items-start space-x-3">
                <div className="bg-yellow-500/20 p-2 rounded-lg">
                  <Info className="h-5 w-5 text-[hsl(var(--warning-strong))]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[hsl(var(--warning-title))] mb-2">Aviso Legal Importante</h3>
                  <p className="text-sm text-[hsl(var(--warning-strong))] leading-relaxed">
                    Os cálculos apresentados são <strong>estimativas</strong> baseadas na legislação
                    vigente. Sempre consulte a legislação atualizada e considere as particularidades
                    de cada caso. <strong>Recomenda-se fortemente</strong> a revisão por profissional
                    especializado antes de tomar decisões jurídicas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
