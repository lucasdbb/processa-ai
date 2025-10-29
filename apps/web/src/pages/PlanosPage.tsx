import React from 'react';
import {
  Check,
  Star,
  Zap,
  Shield,
  Users,
  Clock,
  HeadphonesIcon,
  Crown
} from 'lucide-react';

const PlanosPage: React.FC = React.memo(() => {
  const plans = [
    {
      name: 'Básico',
      price: 'Gratuito',
      period: '',
      description: 'Ideal para começar a explorar nossas ferramentas',
      features: [
        'Acesso a calculadoras básicas',
        'Até 10 consultas por mês',
        'Suporte por email',
        'Documentos básicos'
      ],
      buttonText: 'Começar Grátis',
      buttonStyle: 'bg-gray-600 hover:bg-gray-700 text-white',
      popular: false,
      icon: Users
    },
    {
      name: 'Profissional',
      price: 'R$ 49',
      period: '/mês',
      description: 'Para advogados que precisam de mais recursos',
      features: [
        'Acesso completo a todas as calculadoras',
        'Consultas ilimitadas',
        'Suporte prioritário',
        'Documentos avançados',
        'Relatórios personalizados',
        'Integração com sistemas'
      ],
      buttonText: 'Assinar Agora',
      buttonStyle: 'bg-primary-600 hover:bg-primary-700 text-white',
      popular: true,
      icon: Zap
    },
    {
      name: 'Escritório',
      price: 'R$ 149',
      period: '/mês',
      description: 'Para escritórios e equipes jurídicas',
      features: [
        'Tudo do plano Profissional',
        'Até 10 usuários',
        'Dashboard administrativo',
        'Suporte telefônico',
        'Treinamento personalizado',
        'API dedicada',
        'Backup automático',
        'Compliance avançado'
      ],
      buttonText: 'Falar com Vendas',
      buttonStyle: 'bg-secondary-600 hover:bg-secondary-700 text-white',
      popular: false,
      icon: Crown
    }
  ];

  const features = [
    {
      icon: Shield,
      title: 'Segurança Garantida',
      description: 'Seus dados protegidos com criptografia de ponta a ponta'
    },
    {
      icon: Clock,
      title: 'Disponibilidade 24/7',
      description: 'Acesse suas ferramentas a qualquer hora, em qualquer lugar'
    },
    {
      icon: HeadphonesIcon,
      title: 'Suporte Especializado',
      description: 'Equipe técnica especializada em direito para te ajudar'
    }
  ];

  const faqs = [
    {
      question: 'Posso cancelar minha assinatura a qualquer momento?',
      answer: 'Sim, você pode cancelar sua assinatura a qualquer momento sem taxas de cancelamento. O acesso continuará até o final do período pago.'
    },
    {
      question: 'Existe desconto para pagamento anual?',
      answer: 'Sim, oferecemos 20% de desconto para pagamentos anuais em todos os planos pagos.'
    },
    {
      question: 'Como funciona o período de teste?',
      answer: 'Oferecemos 14 dias de teste gratuito para todos os planos pagos, sem necessidade de cartão de crédito.'
    },
    {
      question: 'Posso mudar de plano depois?',
      answer: 'Claro! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. As mudanças são aplicadas no próximo ciclo de cobrança.'
    }
  ];

  return (
    <div className="min-h-screen bg-warm-bg">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-800 to-primary-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Escolha o Plano Ideal para Você
          </h1>
          <p className="text-xl md:text-2xl text-primary-100 mb-8 max-w-3xl mx-auto">
            Ferramentas jurídicas inteligentes para impulsionar sua prática profissional
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <div className="flex items-center text-primary-100">
              <Check className="w-5 h-5 mr-2" />
              <span>14 dias de teste grátis</span>
            </div>
            <div className="flex items-center text-primary-100">
              <Check className="w-5 h-5 mr-2" />
              <span>Sem compromisso</span>
            </div>
            <div className="flex items-center text-primary-100">
              <Check className="w-5 h-5 mr-2" />
              <span>Cancele quando quiser</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Planos Transparentes
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Escolha o plano que melhor se adapta às suas necessidades profissionais
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {plans.map((plan, index) => {
              const IconComponent = plan.icon;
              return (
                <div
                  key={index}
                  className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl flex flex-col ${
                    plan.popular
                      ? 'border-primary-500 transform scale-105'
                      : 'border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className="bg-primary-500 text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center">
                        <Star className="w-4 h-4 mr-1" />
                        Mais Popular
                      </div>
                    </div>
                  )}

                  <div className="p-8 flex flex-col flex-grow">
                    <div className="text-center mb-8">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                        <IconComponent className="w-8 h-8 text-primary-600" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        {plan.name}
                      </h3>
                      <p className="text-gray-600 mb-4">{plan.description}</p>
                      <div className="flex items-baseline justify-center">
                        <span className="text-4xl font-bold text-gray-900">
                          {plan.price}
                        </span>
                        <span className="text-gray-600 ml-1">{plan.period}</span>
                      </div>
                    </div>

                    <ul className="space-y-4 mb-8 flex-grow">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start">
                          <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto">
                      <button
                        className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${plan.buttonStyle}`}
                      >
                        {plan.buttonText}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Por que escolher o Processa AI?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Recursos que fazem a diferença na sua prática jurídica
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-6">
                    <IconComponent className="w-8 h-8 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Perguntas Frequentes
            </h2>
            <p className="text-xl text-gray-600">
              Tire suas dúvidas sobre nossos planos
            </p>
          </div>

          <div className="space-y-8">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {faq.question}
                </h3>
                <p className="text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Pronto para começar?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Junte-se a centenas de advogados que já confiam no Processa AI
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Começar Teste Grátis
            </button>
            <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-primary-600 transition-colors">
              Falar com Especialista
            </button>
          </div>
        </div>
      </section>
    </div>
  );
});

PlanosPage.displayName = 'PlanosPage';

export default PlanosPage;