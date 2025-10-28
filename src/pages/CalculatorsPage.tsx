import React, { useState } from 'react';
import { 
  Calculator, 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  FileText,
  Download,
  Info
} from 'lucide-react';

const CalculatorsPage: React.FC = () => {
  const [selectedCalculator, setSelectedCalculator] = useState('rescisao');
  const [formData, setFormData] = useState({
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
    tipoAposentadoria: 'tempo_contribuicao'
  });

  const [resultado, setResultado] = useState<any>(null);

  const calculators = [
    {
      id: 'rescisao',
      name: 'Rescisão Trabalhista',
      description: 'Calcule todas as verbas rescisórias',
      icon: DollarSign,
      color: 'bg-primary-600'
    },
    {
      id: 'aposentadoria',
      name: 'Simulação de Aposentadoria',
      description: 'Simule aposentadoria e benefícios',
      icon: Calendar,
      color: 'bg-secondary-600'
    }
  ];

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calcularRescisao = () => {
    const salario = parseFloat(formData.salario) || 0;
    const dataAdm = new Date(formData.dataAdmissao);
    const dataResc = new Date(formData.dataRescisao);
    
    // Cálculos simplificados para demonstração
    const mesesTrabalhados = (dataResc.getTime() - dataAdm.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    const saldoSalario = salario * 0.5; // Exemplo: meio mês
    const avisoPrevio = formData.avisoPrevio ? salario : 0;
    const feriasVencidas = parseFloat(formData.feriasVencidas) || 0;
    const feriasProporcionais = formData.feriasProporcionais ? (salario / 12) * (mesesTrabalhados % 12) : 0;
    const decimoTerceiro = formData.decimoTerceiro ? (salario / 12) * (mesesTrabalhados % 12) : 0;
    const fgts = salario * 0.08 * mesesTrabalhados;
    const multaFgts = formData.tipoRescisao === 'sem_justa_causa' ? fgts * 0.4 : 0;
    
    const total = saldoSalario + avisoPrevio + feriasVencidas + feriasProporcionais + decimoTerceiro + fgts + multaFgts;

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
        total
      }
    });
  };

  const calcularAposentadoria = () => {
    const idade = parseInt(formData.idade) || 0;
    const tempoContrib = parseInt(formData.tempoContribuicao) || 0;
    const salario = parseFloat(formData.salarioContribuicao) || 0;
    
    // Regras simplificadas
    const idadeMinima = formData.sexo === 'masculino' ? 65 : 62;
    const tempoMinimoContrib = 15;
    
    const podeAposentar = idade >= idadeMinima && tempoContrib >= tempoMinimoContrib;
    const anosRestantes = Math.max(0, idadeMinima - idade);
    const tempoRestante = Math.max(0, tempoMinimoContrib - tempoContrib);
    
    const beneficio = podeAposentar ? salario * 0.6 + (tempoContrib - 15) * 0.02 * salario : 0;

    setResultado({
      tipo: 'aposentadoria',
      detalhes: {
        podeAposentar,
        anosRestantes,
        tempoRestante,
        beneficio,
        idadeMinima,
        tempoMinimoContrib
      }
    });
  };

  const handleCalculate = () => {
    switch (selectedCalculator) {
      case 'rescisao':
        calcularRescisao();
        break;
      case 'aposentadoria':
        calcularAposentadoria();
        break;
      default:
        break;
    }
  };

  const renderRescisaoForm = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            💰 Salário Mensal (R$) *
          </label>
          <input
            type="number"
            value={formData.salario}
            onChange={(e) => handleInputChange('salario', e.target.value)}
            className="input-field"
            placeholder="Ex: 3500,00"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            📋 Tipo de Rescisão *
          </label>
          <select
            value={formData.tipoRescisao}
            onChange={(e) => handleInputChange('tipoRescisao', e.target.value)}
            className="input-field"
          >
            <option value="sem_justa_causa">Sem Justa Causa</option>
            <option value="com_justa_causa">Com Justa Causa</option>
            <option value="pedido_demissao">Pedido de Demissão</option>
            <option value="acordo">Acordo</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            📅 Data de Admissão *
          </label>
          <input
            type="date"
            value={formData.dataAdmissao}
            onChange={(e) => handleInputChange('dataAdmissao', e.target.value)}
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            📅 Data de Rescisão *
          </label>
          <input
            type="date"
            value={formData.dataRescisao}
            onChange={(e) => handleInputChange('dataRescisao', e.target.value)}
            className="input-field"
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            🏖️ Férias Vencidas (R$)
          </label>
          <input
            type="number"
            value={formData.feriasVencidas}
            onChange={(e) => handleInputChange('feriasVencidas', e.target.value)}
            className="input-field"
            placeholder="Ex: 1000,00 (opcional)"
          />
          <p className="text-xs text-gray-500 mt-1">Deixe em branco se não houver férias vencidas</p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">✅ Verbas Adicionais</h3>
        <div className="space-y-3">
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={formData.avisoPrevio}
              onChange={(e) => handleInputChange('avisoPrevio', e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-5 h-5"
            />
            <span className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 font-medium">Aviso Prévio</span>
          </label>
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={formData.feriasProporcionais}
              onChange={(e) => handleInputChange('feriasProporcionais', e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-5 h-5"
            />
            <span className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 font-medium">Férias Proporcionais</span>
          </label>
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={formData.decimoTerceiro}
              onChange={(e) => handleInputChange('decimoTerceiro', e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-5 h-5"
            />
            <span className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 font-medium">13º Salário Proporcional</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderAposentadoriaForm = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            👤 Idade Atual *
          </label>
          <input
            type="number"
            value={formData.idade}
            onChange={(e) => handleInputChange('idade', e.target.value)}
            className="input-field"
            placeholder="Ex: 55"
            min="0"
            max="120"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            👥 Sexo *
          </label>
          <select
            value={formData.sexo}
            onChange={(e) => handleInputChange('sexo', e.target.value)}
            className="input-field"
          >
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            ⏱️ Tempo de Contribuição (anos) *
          </label>
          <input
            type="number"
            value={formData.tempoContribuicao}
            onChange={(e) => handleInputChange('tempoContribuicao', e.target.value)}
            className="input-field"
            placeholder="Ex: 25"
            min="0"
            max="60"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            💵 Salário de Contribuição (R$) *
          </label>
          <input
            type="number"
            value={formData.salarioContribuicao}
            onChange={(e) => handleInputChange('salarioContribuicao', e.target.value)}
            className="input-field"
            placeholder="Ex: 4500,00"
            required
          />
        </div>
      </div>

      <div className="bg-secondary-50 p-4 rounded-lg border border-secondary-200">
        <h3 className="text-sm font-semibold text-secondary-900 mb-2">ℹ️ Informações Importantes</h3>
        <ul className="text-xs text-secondary-800 space-y-1">
          <li>• Idade mínima para homens: 65 anos</li>
          <li>• Idade mínima para mulheres: 62 anos</li>
          <li>• Tempo mínimo de contribuição: 15 anos</li>
        </ul>
      </div>
    </div>
  );

  const renderResultado = () => {
    if (!resultado) return null;

    if (resultado.tipo === 'rescisao') {
      const { detalhes } = resultado;
      return (
        <div className="card bg-primary-50 border-primary-200">
          <h3 className="text-lg font-semibold text-primary-900 mb-4">Resultado do Cálculo</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Saldo de Salário:</span>
              <span className="font-medium">R$ {detalhes.saldoSalario.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Aviso Prévio:</span>
              <span className="font-medium">R$ {detalhes.avisoPrevio.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Férias Vencidas:</span>
              <span className="font-medium">R$ {detalhes.feriasVencidas.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Férias Proporcionais:</span>
              <span className="font-medium">R$ {detalhes.feriasProporcionais.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>13º Proporcional:</span>
              <span className="font-medium">R$ {detalhes.decimoTerceiro.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>FGTS:</span>
              <span className="font-medium">R$ {detalhes.fgts.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Multa FGTS (40%):</span>
              <span className="font-medium">R$ {detalhes.multaFgts.toFixed(2)}</span>
            </div>
            <div className="border-t border-primary-300 pt-3">
              <div className="flex justify-between text-lg font-bold text-primary-900">
                <span>Total:</span>
                <span>R$ {detalhes.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (resultado.tipo === 'aposentadoria') {
      const { detalhes } = resultado;
      return (
        <div className={`card ${detalhes.podeAposentar ? 'bg-secondary-50 border-secondary-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${detalhes.podeAposentar ? 'text-secondary-900' : 'text-yellow-900'}`}>
            Resultado da Simulação
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={`font-medium ${detalhes.podeAposentar ? 'text-secondary-800' : 'text-yellow-600'}`}>
                {detalhes.podeAposentar ? 'Pode se aposentar' : 'Não pode se aposentar ainda'}
              </span>
            </div>
            {!detalhes.podeAposentar && (
              <>
                <div className="flex justify-between">
                  <span>Anos restantes (idade):</span>
                  <span className="font-medium">{detalhes.anosRestantes} anos</span>
                </div>
                <div className="flex justify-between">
                  <span>Tempo restante (contribuição):</span>
                  <span className="font-medium">{detalhes.tempoRestante} anos</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span>Idade mínima:</span>
              <span className="font-medium">{detalhes.idadeMinima} anos</span>
            </div>
            <div className="flex justify-between">
              <span>Tempo mínimo de contribuição:</span>
              <span className="font-medium">{detalhes.tempoMinimoContrib} anos</span>
            </div>
            {detalhes.podeAposentar && (
              <div className="border-t border-secondary-300 pt-3">
                <div className="flex justify-between text-lg font-bold text-secondary-900">
                  <span>Benefício estimado:</span>
                  <span>R$ {detalhes.beneficio.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-800 to-primary-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-6">
              <Calculator className="h-8 w-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Calculadoras Jurídicas
            </h1>
            <p className="text-xl text-primary-100 max-w-2xl mx-auto">
              Ferramentas precisas para cálculos trabalhistas e previdenciários.
              Economize tempo e evite erros em seus cálculos.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar com Calculadoras */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Escolha a Calculadora</h2>
            <div className="space-y-3">
              {calculators.map(calc => (
                <button
                  key={calc.id}
                  onClick={() => {
                    setSelectedCalculator(calc.id);
                    setResultado(null);
                  }}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 ${
                    selectedCalculator === calc.id
                      ? 'border-primary-500 bg-primary-50 shadow-lg'
                      : 'border-gray-200 bg-white hover:border-primary-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`${calc.color} p-3 rounded-lg shadow-md`}>
                      <calc.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm">{calc.name}</h3>
                      <p className="text-xs text-gray-600 mt-1">{calc.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Info Card */}
            <div className="mt-6 p-4 bg-gradient-to-br from-secondary-50 to-secondary-100 rounded-xl border border-secondary-200">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-secondary-700 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-secondary-900 mb-1">Dica</h3>
                  <p className="text-xs text-secondary-800">
                    Preencha todos os campos obrigatórios para obter um cálculo preciso.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Área Principal */}
          <div className="lg:col-span-3">
            <div className="card shadow-lg">
              <div className="flex items-center space-x-4 mb-8 pb-6 border-b border-gray-200">
                <div className={`${calculators.find(c => c.id === selectedCalculator)?.color} p-4 rounded-xl shadow-lg`}>
                  {calculators.find(c => c.id === selectedCalculator)?.icon &&
                    React.createElement(calculators.find(c => c.id === selectedCalculator)!.icon, { className: "h-8 w-8 text-white" })
                  }
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    {calculators.find(c => c.id === selectedCalculator)?.name}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {calculators.find(c => c.id === selectedCalculator)?.description}
                  </p>
                </div>
              </div>

              {/* Formulário */}
              {selectedCalculator === 'rescisao' && renderRescisaoForm()}
              {selectedCalculator === 'aposentadoria' && renderAposentadoriaForm()}

              {(selectedCalculator === 'rescisao' || selectedCalculator === 'aposentadoria') && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleCalculate}
                    className="btn-primary flex items-center space-x-2 px-8 py-3 text-lg shadow-lg hover:shadow-xl transition-shadow"
                  >
                    <Calculator className="h-5 w-5" />
                    <span>Calcular Agora</span>
                  </button>
                </div>
              )}
            </div>

            {/* Resultado */}
            {resultado && (
              <div className="mt-8 animate-fade-in">
                {renderResultado()}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="btn-secondary flex items-center space-x-2 shadow-md hover:shadow-lg transition-shadow">
                    <Download className="h-4 w-4" />
                    <span>Baixar Relatório PDF</span>
                  </button>
                  <button className="btn-secondary flex items-center space-x-2 shadow-md hover:shadow-lg transition-shadow">
                    <FileText className="h-4 w-4" />
                    <span>Salvar Cálculo</span>
                  </button>
                </div>
              </div>
            )}

            {/* Aviso Legal */}
            <div className="mt-8 card bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 shadow-md">
              <div className="flex items-start space-x-3">
                <div className="bg-yellow-100 p-2 rounded-lg">
                  <Info className="h-5 w-5 text-yellow-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-yellow-900 mb-2">⚠️ Aviso Legal Importante</h3>
                  <p className="text-sm text-yellow-800 leading-relaxed">
                    Os cálculos apresentados são <strong>estimativas</strong> baseadas na legislação vigente.
                    Sempre consulte a legislação atualizada e considere as particularidades
                    de cada caso. <strong>Recomenda-se fortemente</strong> a revisão por profissional especializado antes de tomar decisões jurídicas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculatorsPage;