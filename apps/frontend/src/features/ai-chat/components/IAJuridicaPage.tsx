import React, { useState, useCallback } from 'react';
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
import { useAsync } from '../../../shared/hooks/useAsync';
import { useFormValidation } from '../../../shared/hooks/useFormValidation';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import ErrorMessage from '../../../shared/components/ErrorMessage';
import ValidationError from '../../../shared/components/ValidationError';

/**
 * Página de ferramentas de IA para geração de documentos jurídicos
 * Permite aos usuários selecionar templates e gerar documentos personalizados
 * 
 * @example
 * ```tsx
 * <IAJuridicaPage />
 * ```
 */
const IAJuridicaPageComponent: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState('petition');
  const [prompt, setPrompt] = useState('');

  // Form validation setup
  const {
    errors,
    validateField,
    validateForm,
    clearFieldError
  } = useFormValidation({
    prompt: {
      required: true,
      minLength: 10,
      maxLength: 2000,
      custom: (value: string) => {
        const trimmedValue = value.trim();
        if (trimmedValue.length < 10) {
          return 'Por favor, forneça mais detalhes (mínimo 10 caracteres)';
        }
        if (trimmedValue.split(' ').length < 3) {
          return 'Por favor, forneça uma descrição mais detalhada (mínimo 3 palavras)';
        }
        return null;
      }
    }
  });

  // Use the useAsync hook for text generation
  const {
    data: generatedText,
    loading,
    error,
    execute: generateText,
    clearError
  } = useAsync(async (inputPrompt: string) => {
    if (!inputPrompt.trim()) {
      throw new Error('Por favor, forneça um prompt para gerar o texto.');
    }

    // Simulate AI text generation with delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const sampleText = `
EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA ${Math.floor(Math.random() * 20) + 1}ª VARA CÍVEL DA COMARCA DE SÃO PAULO/SP

${inputPrompt.toUpperCase()}

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

Local, ${new Date().toLocaleDateString('pt-BR')}.

[Nome do Advogado]
OAB/SP nº [número]
`;
    
    return sampleText;
  });

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

  /**
   * Handles prompt input changes with real-time validation
   */
  const handlePromptChange = useCallback((value: string) => {
    setPrompt(value);
    
    // Clear field error when user starts typing
    if (errors.prompt) {
      clearFieldError('prompt');
    }
    
    // Validate on blur or when field has sufficient content
    if (value.trim().length > 5) {
      validateField('prompt', value);
    }
  }, [errors.prompt, clearFieldError, validateField]);

  /**
   * Handles form submission with validation
   * Only generates text if validation passes
   */
  const handleGenerate = useCallback(() => {
    // Clear any existing errors
    clearError();
    
    // Validate the form
    const isValid = validateForm({ prompt });
    
    if (isValid) {
      generateText(prompt);
    }
  }, [clearError, validateForm, prompt, generateText]);

  /**
   * Copia o texto gerado para a área de transferência do usuário
   * Utiliza a Clipboard API do navegador para realizar a operação
   * 
   * @function
   * @returns {void}
   * 
   * @remarks
   * Em produção, considere adicionar feedback visual (toast/notificação)
   * para confirmar que o texto foi copiado com sucesso
   */
  const handleCopy = useCallback(() => {
    if (generatedText) {
      navigator.clipboard.writeText(generatedText);
      // Aqui você poderia adicionar uma notificação de sucesso
    }
  }, [generatedText]);

  /**
   * Faz o download do texto gerado como arquivo .txt
   * Cria um blob com o conteúdo e força o download no navegador
   * 
   * @function
   * @returns {void}
   * 
   * @remarks
   * O nome do arquivo é gerado automaticamente baseado no tipo de ferramenta
   * e timestamp atual para evitar conflitos de nomes
   */
  const handleDownload = useCallback(() => {
    if (generatedText) {
      const element = document.createElement('a');
      const file = new Blob([generatedText], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `${tools.find(t => t.id === selectedTool)?.name.toLowerCase().replace(' ', '_')}_${Date.now()}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  }, [generatedText, selectedTool]);

  const handleToolSelect = useCallback((toolId: string) => {
    setSelectedTool(toolId);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-gray-100 to-transparent rounded-full blur-3xl opacity-60" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-8 animate-in fade-in zoom-in duration-500">
              <Brain className="h-8 w-8 text-gray-900" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              IA Jurídica
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              Crie documentos jurídicos profissionais com auxílio da inteligência artificial.
              Economize tempo e melhore a qualidade das suas peças processuais.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar com Ferramentas */}
          <div className="lg:col-span-1 animate-in fade-in slide-in-from-left duration-700 delay-300">
            <h2 id="tools-heading" className="text-xl font-bold text-gray-900 mb-6 tracking-tight">Ferramentas</h2>
            <div 
              className="space-y-4"
              role="radiogroup"
              aria-labelledby="tools-heading"
            >
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => handleToolSelect(tool.id)}
                  role="radio"
                  aria-checked={selectedTool === tool.id}
                  aria-describedby={`tool-${tool.id}-description`}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 group ${
                    selectedTool === tool.id
                      ? 'border-gray-900 bg-gray-900 shadow-lg scale-[1.02]'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-xl transition-colors ${
                      selectedTool === tool.id 
                        ? 'bg-white/10 text-white' 
                        : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                    }`} aria-hidden="true">
                      <tool.icon className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className={`font-bold text-sm ${
                        selectedTool === tool.id ? 'text-white' : 'text-gray-900'
                      }`}>{tool.name}</h3>
                      <p 
                        id={`tool-${tool.id}-description`}
                        className={`text-xs mt-1 ${
                          selectedTool === tool.id ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        {tool.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Templates */}
            <div className="mt-8">
              <h3 id="templates-heading" className="text-lg font-bold text-gray-900 mb-4 tracking-tight">Templates</h3>
              <div 
                className="space-y-2"
                role="list"
                aria-labelledby="templates-heading"
              >
                {templates[selectedTool as keyof typeof templates]?.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => setPrompt(`Criar ${template.toLowerCase()} para `)}
                    role="listitem"
                    aria-label={`Usar template: ${template}`}
                    className="w-full text-left px-4 py-3 text-sm bg-white border border-gray-200 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 text-gray-700 font-medium"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Área Principal */}
          <div className="lg:col-span-3 animate-in fade-in slide-in-from-bottom duration-700 delay-500">
            <div className="bg-white rounded-[2rem] border border-gray-200 shadow-xl p-8">
              <div className="flex items-center space-x-4 mb-8">
                <div className="bg-gray-900 p-4 rounded-2xl shadow-lg">
                  <Brain className="h-8 w-8 text-white" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {tools.find(t => t.id === selectedTool)?.name}
                  </h2>
                  <p className="text-gray-500 mt-1">
                    {tools.find(t => t.id === selectedTool)?.description}
                  </p>
                </div>
              </div>

              {/* Input do Prompt */}
              <div className="mb-8">
                <label 
                  htmlFor="prompt-input"
                  className="block text-sm font-bold text-gray-900 mb-3"
                >
                  Descreva o que você precisa <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <textarea
                    id="prompt-input"
                    value={prompt}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    onBlur={() => validateField('prompt', prompt)}
                    placeholder="Ex: Criar uma petição inicial para ação de cobrança contra empresa que não pagou serviços prestados no valor de R$ 10.000,00..."
                    aria-describedby={`prompt-help ${errors.prompt ? 'prompt-error' : ''}`}
                    aria-required="true"
                    aria-invalid={!!errors.prompt}
                    className={`w-full h-40 px-6 py-4 text-base border rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none transition-all duration-200 bg-gray-50 placeholder-gray-400 ${
                      errors.prompt 
                        ? 'border-red-300 focus:ring-red-500 bg-red-50' 
                        : 'border-gray-200'
                    }`}
                  />
                  <div className="absolute bottom-4 right-4 text-xs text-gray-400 font-medium">
                    {prompt.length} caracteres
                  </div>
                </div>
                <div id="prompt-help" className="sr-only">
                  Digite uma descrição detalhada do documento que você deseja gerar usando inteligência artificial
                </div>
                <ValidationError 
                  error={errors.prompt} 
                  id="prompt-error"
                />
              </div>

              <div className="flex space-x-4 mb-8">
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || loading === 'loading' || !!errors.prompt}
                  aria-describedby="generate-button-help"
                  className="bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center px-8 py-4 rounded-xl font-bold text-base transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 w-full sm:w-auto"
                >
                  {loading === 'loading' ? (
                    <>
                      <LoadingSpinner size="sm" inline />
                      <span className="ml-2">Gerando Documento...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      <span>Gerar com IA</span>
                    </>
                  )}
                </button>
              </div>

              {/* Error Display */}
              {error.hasError && (
                <div className="mb-8 animate-in fade-in slide-in-from-top-4">
                  <ErrorMessage 
                    error={error} 
                    onRetry={handleGenerate}
                    onDismiss={clearError}
                  />
                </div>
              )}

              {/* Resultado */}
              {generatedText && (
                <div role="region" aria-labelledby="result-heading" className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <h3 id="result-heading" className="text-lg font-bold text-gray-900">Documento Gerado</h3>
                    <div className="flex space-x-2" role="toolbar" aria-label="Ações do documento">
                      <button
                        onClick={handleCopy}
                        aria-label="Copiar documento para a área de transferência"
                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
                        title="Copiar"
                      >
                        <Copy className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <button
                        onClick={handleDownload}
                        aria-label="Baixar documento como arquivo de texto"
                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
                        title="Baixar"
                      >
                        <Download className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <button 
                        aria-label="Salvar documento no sistema"
                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
                        title="Salvar"
                      >
                        <Save className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div 
                    className="bg-gray-50 border border-gray-200 rounded-2xl p-8 shadow-inner"
                    role="textbox"
                    aria-readonly="true"
                    aria-label="Documento gerado pela IA"
                    tabIndex={0}
                  >
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                      {generatedText}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Dicas */}
            <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <span className="bg-yellow-100 text-yellow-800 p-2 rounded-lg mr-3">💡</span>
                Dicas para melhores resultados
              </h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start">
                  <span className="mr-2 text-gray-400">•</span>
                  Seja específico sobre os fatos do caso, incluindo datas e valores
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-gray-400">•</span>
                  Identifique claramente as partes envolvidas (requerente e requerido)
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-gray-400">•</span>
                  Mencione a legislação aplicável ou jurisprudência se souber
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-gray-400">•</span>
                  Sempre revise o texto gerado por um profissional qualificado
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-gray-400">•</span>
                  Use os templates sugeridos para estruturar melhor seu pedido
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const IAJuridicaPage = React.memo(IAJuridicaPageComponent);
IAJuridicaPage.displayName = 'IAJuridicaPage';

export default IAJuridicaPage;