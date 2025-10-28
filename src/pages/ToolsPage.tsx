import React, { useState } from 'react';
import { 
  Brain, 
  FileText, 
  Edit3, 
  Download, 
  Copy, 
  Sparkles,
  MessageSquare,
  Settings,
  Save
} from 'lucide-react';

const ToolsPage: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState('petition');
  const [prompt, setPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const tools = [
    {
      id: 'petition',
      name: 'Petição Inicial',
      description: 'Crie petições iniciais com base nos fatos do caso',
      icon: FileText,
      color: 'bg-primary-600'
    },
    {
      id: 'contract',
      name: 'Contratos',
      description: 'Gere minutas de contratos personalizados',
      icon: Edit3,
      color: 'bg-secondary-600'
    },
    {
      id: 'defense',
      name: 'Contestação',
      description: 'Elabore contestações e defesas processuais',
      icon: MessageSquare,
      color: 'bg-primary-700'
    },
    {
      id: 'appeal',
      name: 'Recursos',
      description: 'Crie recursos e apelações fundamentadas',
      icon: Settings,
      color: 'bg-secondary-700'
    }
  ];

  const templates = {
    petition: [
      'Ação de Cobrança',
      'Ação Trabalhista',
      'Ação de Indenização',
      'Ação Previdenciária',
      'Ação de Despejo'
    ],
    contract: [
      'Contrato de Trabalho',
      'Contrato de Prestação de Serviços',
      'Contrato de Locação',
      'Contrato de Compra e Venda',
      'Contrato de Sociedade'
    ],
    defense: [
      'Contestação Trabalhista',
      'Contestação Cível',
      'Defesa Criminal',
      'Impugnação ao Valor da Causa',
      'Exceção de Incompetência'
    ],
    appeal: [
      'Recurso Ordinário',
      'Apelação Cível',
      'Agravo de Instrumento',
      'Recurso Especial',
      'Recurso Extraordinário'
    ]
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    
    // Simulando geração de texto com IA
    setTimeout(() => {
      const sampleText = `
EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA ${Math.floor(Math.random() * 20) + 1}ª VARA CÍVEL DA COMARCA DE SÃO PAULO/SP

${prompt.toUpperCase()}

I - DOS FATOS

Com base nas informações fornecidas, os fatos relevantes para o presente caso são os seguintes:

[Aqui seria inserido o texto gerado pela IA com base no prompt fornecido, incluindo uma análise detalhada dos fatos, fundamentação jurídica e pedidos específicos]

II - DO DIREITO

A presente ação encontra amparo legal nos seguintes dispositivos:
- Constituição Federal, artigos aplicáveis
- Código Civil, disposições pertinentes
- Legislação específica relacionada ao caso

III - DOS PEDIDOS

Diante do exposto, requer-se:

a) A citação da parte requerida;
b) A procedência total dos pedidos;
c) A condenação em custas e honorários advocatícios.

Termos em que pede deferimento.

São Paulo, ${new Date().toLocaleDateString('pt-BR')}.

[Nome do Advogado]
OAB/SP nº [número]
      `;
      
      setGeneratedText(sampleText);
      setIsGenerating(false);
    }, 2000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
    // Aqui você poderia adicionar uma notificação de sucesso
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([generatedText], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${tools.find(t => t.id === selectedTool)?.name.toLowerCase().replace(' ', '_')}_${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-warm-bg">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-800 to-primary-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-6">
              <Brain className="h-8 w-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Ferramentas de IA Jurídica
            </h1>
            <p className="text-xl text-primary-100 max-w-2xl mx-auto">
              Crie documentos jurídicos profissionais com auxílio da inteligência artificial.
              Economize tempo e melhore a qualidade das suas peças processuais.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar com Ferramentas */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Ferramentas Disponíveis</h2>
            <div className="space-y-3">
              {tools.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => setSelectedTool(tool.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors duration-200 ${
                    selectedTool === tool.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`${tool.color} p-2 rounded-lg`}>
                      <tool.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{tool.name}</h3>
                      <p className="text-sm text-gray-600">{tool.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Templates */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Templates</h3>
              <div className="space-y-2">
                {templates[selectedTool as keyof typeof templates]?.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => setPrompt(`Criar ${template.toLowerCase()} para `)}
                    className="w-full text-left p-3 text-sm bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors duration-200"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Área Principal */}
          <div className="lg:col-span-3">
            <div className="card">
              <div className="flex items-center space-x-3 mb-6">
                <div className={`${tools.find(t => t.id === selectedTool)?.color} p-3 rounded-lg`}>
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {tools.find(t => t.id === selectedTool)?.name}
                  </h2>
                  <p className="text-gray-600">
                    {tools.find(t => t.id === selectedTool)?.description}
                  </p>
                </div>
              </div>

              {/* Input do Prompt */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descreva o que você precisa:
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ex: Criar uma petição inicial para ação de cobrança contra empresa que não pagou serviços prestados no valor de R$ 10.000,00..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex space-x-4 mb-6">
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Gerando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Gerar com IA</span>
                    </>
                  )}
                </button>
              </div>

              {/* Resultado */}
              {generatedText && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Documento Gerado</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleCopy}
                        className="btn-secondary flex items-center space-x-2"
                      >
                        <Copy className="h-4 w-4" />
                        <span>Copiar</span>
                      </button>
                      <button
                        onClick={handleDownload}
                        className="btn-secondary flex items-center space-x-2"
                      >
                        <Download className="h-4 w-4" />
                        <span>Baixar</span>
                      </button>
                      <button className="btn-secondary flex items-center space-x-2">
                        <Save className="h-4 w-4" />
                        <span>Salvar</span>
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                      {generatedText}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Dicas */}
            <div className="mt-8 card bg-gradient-to-br from-secondary-50 to-secondary-100 border-secondary-200">
              <h3 className="text-lg font-semibold text-secondary-900 mb-4">💡 Dicas para melhores resultados</h3>
              <ul className="space-y-2 text-secondary-800">
                <li>• Seja específico sobre os fatos do caso</li>
                <li>• Inclua valores, datas e partes envolvidas</li>
                <li>• Mencione a legislação aplicável quando souber</li>
                <li>• Revise sempre o texto gerado antes de usar</li>
                <li>• Use os templates como ponto de partida</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolsPage;