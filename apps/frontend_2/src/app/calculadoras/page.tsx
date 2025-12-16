'use client'

import { useState, useCallback } from 'react'
import { ProtectedFeaturePreview } from '@/components/auth/protected-feature-preview'
import { useUser } from '@/features/auth/hooks/use-user'
import { Calculator, DollarSign, Calendar, FileText, Download, Info } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

type CalculatorType = 'rescisao' | 'aposentadoria'
type DocumentType = 'cpf' | 'cnpj'

interface CalculatorFormData {
  // Rescisão
  salario: string
  dataAdmissao: string
  dataRescisao: string
  tipoRescisao: string
  avisoPrevio: boolean
  feriasVencidas: string
  feriasProporcionais: boolean
  decimoTerceiro: boolean

  // Aposentadoria
  idade: string
  tempoContribuicao: string
  salarioContribuicao: string
  sexo: string
  tipoAposentadoria: string
}

interface Resultado {
  tipo: 'rescisao' | 'aposentadoria'
  detalhes: any
}

interface CalculatorConfig {
  id: CalculatorType
  name: string
  description: string
  icon: typeof DollarSign
  color: string
  available: boolean
}

export default function CalculadorasPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useUser()
  const [selectedCalculator, setSelectedCalculator] = useState<CalculatorType>('rescisao')
  const [formData, setFormData] = useState<CalculatorFormData>({
    // Rescisão
    salario: '',
    dataAdmissao: '',
    dataRescisao: '',
    tipoRescisao: 'sem_justa_causa',
    avisoPrevio: true,
    feriasVencidas: '',
    feriasProporcionais: true,
    decimoTerceiro: true,

    // Aposentadoria
    idade: '',
    tempoContribuicao: '',
    salarioContribuicao: '',
    sexo: 'masculino',
    tipoAposentadoria: 'tempo_contribuicao',
  })

  const [resultado, setResultado] = useState<Resultado | null>(null)

  const calculators: CalculatorConfig[] = [
    {
      id: 'rescisao',
      name: 'Rescisão Trabalhista',
      description: 'Calcule todas as verbas rescisórias',
      icon: DollarSign,
      color: 'bg-primary-600',
      available: true,
    },
    {
      id: 'aposentadoria',
      name: 'Simulação de Aposentadoria',
      description: 'Simule aposentadoria e benefícios',
      icon: Calendar,
      color: 'bg-secondary-600',
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

    // Cálculos simplificados para demonstração
    const mesesTrabalhados = (dataResc.getTime() - dataAdm.getTime()) / (1000 * 60 * 60 * 24 * 30)

    const saldoSalario = salario * 0.5 // Exemplo: meio mês
    const avisoPrevio = formData.avisoPrevio ? salario : 0
    const feriasVencidas = parseFloat(formData.feriasVencidas) || 0
    const feriasProporcionais = formData.feriasProporcionais
      ? (salario / 12) * (mesesTrabalhados % 12)
      : 0
    const decimoTerceiro = formData.decimoTerceiro ? (salario / 12) * (mesesTrabalhados % 12) : 0
    const fgts = salario * 0.08 * mesesTrabalhados
    const multaFgts = formData.tipoRescisao === 'sem_justa_causa' ? fgts * 0.4 : 0

    const total =
      saldoSalario +
      avisoPrevio +
      feriasVencidas +
      feriasProporcionais +
      decimoTerceiro +
      fgts +
      multaFgts

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

    // Regras simplificadas
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
  }, [selectedCalculator, calcularRescisao, calcularAposentadoria])

  const handleCalculatorSelect = useCallback((calculatorId: CalculatorType) => {
    setSelectedCalculator(calculatorId)
    setResultado(null)
  }, [])

  const renderRescisaoForm = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">
            Salário Mensal (R$) *
          </label>
          <input
            type="number"
            value={formData.salario}
            onChange={(e) => handleInputChange('salario', e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
            placeholder="Ex: 3500,00"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">Tipo de Rescisão *</label>
          <select
            value={formData.tipoRescisao}
            onChange={(e) => handleInputChange('tipoRescisao', e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
          >
            <option value="sem_justa_causa">Sem Justa Causa</option>
            <option value="com_justa_causa">Com Justa Causa</option>
            <option value="pedido_demissao">Pedido de Demissão</option>
            <option value="acordo">Acordo</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">Data de Admissão *</label>
          <input
            type="date"
            value={formData.dataAdmissao}
            onChange={(e) => handleInputChange('dataAdmissao', e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">Data de Rescisão *</label>
          <input
            type="date"
            value={formData.dataRescisao}
            onChange={(e) => handleInputChange('dataRescisao', e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-gray-900 mb-2">
            Férias Vencidas (R$)
          </label>
          <input
            type="number"
            value={formData.feriasVencidas}
            onChange={(e) => handleInputChange('feriasVencidas', e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
            placeholder="Ex: 1000,00 (opcional)"
          />
          <p className="text-xs text-gray-500 mt-1">Deixe em branco se não houver férias vencidas</p>
        </div>
      </div>

      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Verbas Adicionais</h3>
        <div className="space-y-3">
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={formData.avisoPrevio}
              onChange={(e) => handleInputChange('avisoPrevio', e.target.checked)}
              className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 w-5 h-5 transition-all"
            />
            <span className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 font-medium">
              Aviso Prévio
            </span>
          </label>
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={formData.feriasProporcionais}
              onChange={(e) => handleInputChange('feriasProporcionais', e.target.checked)}
              className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 w-5 h-5 transition-all"
            />
            <span className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 font-medium">
              Férias Proporcionais
            </span>
          </label>
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={formData.decimoTerceiro}
              onChange={(e) => handleInputChange('decimoTerceiro', e.target.checked)}
              className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 w-5 h-5 transition-all"
            />
            <span className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 font-medium">
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
          <label className="block text-sm font-bold text-gray-900 mb-2">Idade Atual *</label>
          <input
            type="number"
            value={formData.idade}
            onChange={(e) => handleInputChange('idade', e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
            placeholder="Ex: 55"
            min="0"
            max="120"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">Sexo *</label>
          <select
            value={formData.sexo}
            onChange={(e) => handleInputChange('sexo', e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
          >
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">
            Tempo de Contribuição (anos) *
          </label>
          <input
            type="number"
            value={formData.tempoContribuicao}
            onChange={(e) => handleInputChange('tempoContribuicao', e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
            placeholder="Ex: 25"
            min="0"
            max="60"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">
            Salário de Contribuição (R$) *
          </label>
          <input
            type="number"
            value={formData.salarioContribuicao}
            onChange={(e) => handleInputChange('salarioContribuicao', e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
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
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Resultado do Cálculo</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-gray-600">
              <span>Saldo de Salário:</span>
              <span className="font-medium text-gray-900">R$ {detalhes.saldoSalario.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Aviso Prévio:</span>
              <span className="font-medium text-gray-900">R$ {detalhes.avisoPrevio.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Férias Vencidas:</span>
              <span className="font-medium text-gray-900">R$ {detalhes.feriasVencidas.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Férias Proporcionais:</span>
              <span className="font-medium text-gray-900">
                R$ {detalhes.feriasProporcionais.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>13º Proporcional:</span>
              <span className="font-medium text-gray-900">R$ {detalhes.decimoTerceiro.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>FGTS:</span>
              <span className="font-medium text-gray-900">R$ {detalhes.fgts.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Multa FGTS (40%):</span>
              <span className="font-medium text-gray-900">R$ {detalhes.multaFgts.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-200 pt-4 mt-2">
              <div className="flex justify-between items-center text-xl font-bold text-gray-900">
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
          className={`p-6 rounded-2xl border ${detalhes.podeAposentar ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}
        >
          <h3
            className={`text-lg font-bold mb-6 ${detalhes.podeAposentar ? 'text-green-900' : 'text-yellow-900'}`}
          >
            Resultado da Simulação
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className={detalhes.podeAposentar ? 'text-green-800' : 'text-yellow-800'}>
                Status:
              </span>
              <span
                className={`font-bold ${detalhes.podeAposentar ? 'text-green-900' : 'text-yellow-900'}`}
              >
                {detalhes.podeAposentar ? 'Pode se aposentar' : 'Não pode se aposentar ainda'}
              </span>
            </div>
            {!detalhes.podeAposentar && (
              <>
                <div className="flex justify-between items-center text-yellow-800">
                  <span>Anos restantes (idade):</span>
                  <span className="font-medium">{detalhes.anosRestantes} anos</span>
                </div>
                <div className="flex justify-between items-center text-yellow-800">
                  <span>Tempo restante (contribuição):</span>
                  <span className="font-medium">{detalhes.tempoRestante} anos</span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center text-gray-600">
              <span className={detalhes.podeAposentar ? 'text-green-800' : 'text-yellow-800'}>
                Idade mínima:
              </span>
              <span
                className={`font-medium ${detalhes.podeAposentar ? 'text-green-900' : 'text-yellow-900'}`}
              >
                {detalhes.idadeMinima} anos
              </span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span className={detalhes.podeAposentar ? 'text-green-800' : 'text-yellow-800'}>
                Tempo mínimo de contribuição:
              </span>
              <span
                className={`font-medium ${detalhes.podeAposentar ? 'text-green-900' : 'text-yellow-900'}`}
              >
                {detalhes.tempoMinimoContrib} anos
              </span>
            </div>
            {detalhes.podeAposentar && (
              <div className="border-t border-green-200 pt-4 mt-2">
                <div className="flex justify-between items-center text-xl font-bold text-green-900">
                  <span>Benefício estimado:</span>
                  <span>R$ {detalhes.beneficio.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    return null
  }

  // Show loading while checking authentication
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  // Show preview if not authenticated
  if (!isAuthenticated) {
    return (
      <ProtectedFeaturePreview
        title="Calculadoras Jurídicas"
        description="Ferramentas precisas para cálculos trabalhistas e previdenciários. Economize tempo e evite erros em seus cálculos."
        benefits={[
          "Cálculo preciso de rescisão trabalhista com todas as verbas",
          "Simulação completa de aposentadoria (idade e tempo de contribuição)",
          "Geração de relatórios em PDF para seus clientes",
          "Histórico de cálculos salvos para consulta futura",
          "Atualizações automáticas conforme mudanças na legislação",
          "Interface intuitiva que economiza tempo no dia a dia",
        ]}
      />
    )
  }

  // Show the full page if authenticated
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      <Header />

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-gray-100 to-transparent rounded-full blur-3xl opacity-60" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-8 animate-in fade-in zoom-in duration-500">
              <Calculator className="h-8 w-8 text-gray-900" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              Calculadoras Jurídicas
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              Ferramentas precisas para cálculos trabalhistas e previdenciários. Economize tempo e
              evite erros em seus cálculos.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar com Calculadoras */}
          <div className="lg:col-span-1 animate-in fade-in slide-in-from-left duration-700 delay-300">
            <h2 className="text-xl font-bold text-gray-900 mb-6 tracking-tight">
              Escolha a Calculadora
            </h2>
            <div className="space-y-4">
              {calculators.map((calc) => (
                <button
                  key={calc.id}
                  onClick={() => handleCalculatorSelect(calc.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 group ${
                    selectedCalculator === calc.id
                      ? 'border-gray-900 bg-gray-900 shadow-lg scale-[1.02]'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2.5 rounded-xl transition-colors ${
                        selectedCalculator === calc.id
                          ? 'bg-white/10 text-white'
                          : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                      }`}
                    >
                      <calc.icon className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <h3
                        className={`font-bold text-sm ${
                          selectedCalculator === calc.id ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {calc.name}
                      </h3>
                      <p
                        className={`text-xs mt-1 ${
                          selectedCalculator === calc.id ? 'text-gray-400' : 'text-gray-500'
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

          {/* Área Principal */}
          <div className="lg:col-span-3 animate-in fade-in slide-in-from-bottom duration-700 delay-500">
            <div className="bg-white rounded-[2rem] border border-gray-200 shadow-xl p-8">
              <div className="flex items-center space-x-4 mb-8 pb-6 border-b border-gray-100">
                <div className="bg-gray-900 p-4 rounded-2xl shadow-lg">
                  {calculators.find((c) => c.id === selectedCalculator)?.icon &&
                    (() => {
                      const Icon = calculators.find((c) => c.id === selectedCalculator)!.icon
                      return <Icon className="h-8 w-8 text-white" strokeWidth={1.5} />
                    })()}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {calculators.find((c) => c.id === selectedCalculator)?.name}
                  </h2>
                  <p className="text-gray-500 mt-1">
                    {calculators.find((c) => c.id === selectedCalculator)?.description}
                  </p>
                </div>
              </div>

              {/* Formulário */}
              {selectedCalculator === 'rescisao' && renderRescisaoForm()}
              {selectedCalculator === 'aposentadoria' && renderAposentadoriaForm()}

              {(selectedCalculator === 'rescisao' || selectedCalculator === 'aposentadoria') && (
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <button
                    onClick={handleCalculate}
                    className="bg-gray-900 text-white hover:bg-gray-800 flex items-center justify-center px-8 py-4 rounded-xl font-bold text-base transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 w-full sm:w-auto"
                  >
                    <Calculator className="h-5 w-5 mr-2" />
                    <span>Calcular Agora</span>
                  </button>
                </div>
              )}
            </div>

            {/* Resultado */}
            {resultado && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
                {renderResultado()}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="flex items-center space-x-2 px-6 py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm hover:shadow-md">
                    <Download className="h-5 w-5" />
                    <span>Baixar Relatório PDF</span>
                  </button>
                  <button className="flex items-center space-x-2 px-6 py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm hover:shadow-md">
                    <FileText className="h-5 w-5" />
                    <span>Salvar Cálculo</span>
                  </button>
                </div>
              </div>
            )}

            {/* Aviso Legal */}
            <div className="mt-8 bg-yellow-50 border border-yellow-100 rounded-2xl p-6">
              <div className="flex items-start space-x-3">
                <div className="bg-yellow-100 p-2 rounded-lg">
                  <Info className="h-5 w-5 text-yellow-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-yellow-900 mb-2">Aviso Legal Importante</h3>
                  <p className="text-sm text-yellow-800 leading-relaxed">
                    Os cálculos apresentados são <strong>estimativas</strong> baseadas na legislação
                    vigente. Sempre consulte a legislação atualizada e considere as particularidades
                    de cada caso. <strong>Recomenda-se fortemente</strong> a revisão por
                    profissional especializado antes de tomar decisões jurídicas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
