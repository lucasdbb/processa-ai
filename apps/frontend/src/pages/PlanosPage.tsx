import React, { useState } from 'react';
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
import ContactSupportModal from '@/shared/components/ContactSupportModal';

interface PlanosPageProps {
  onRegisterClick?: () => void;
}

const PlanosPage: React.FC<PlanosPageProps> = React.memo(({ onRegisterClick }) => {
  const [isContactOpen, setIsContactOpen] = useState(false);

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
              <Crown className="h-8 w-8 text-gray-900" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              Escolha o Plano Ideal
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              Ferramentas jurídicas inteligentes para impulsionar sua prática profissional
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <div className="flex items-center text-gray-600 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
                <Check className="w-4 h-4 mr-2 text-green-500" />
                <span className="text-sm font-medium">14 dias de teste grátis</span>
              </div>
              <div className="flex items-center text-gray-600 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
                <Check className="w-4 h-4 mr-2 text-green-500" />
                <span className="text-sm font-medium">Sem compromisso</span>
              </div>
              <div className="flex items-center text-gray-600 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
                <Check className="w-4 h-4 mr-2 text-green-500" />
                <span className="text-sm font-medium">Cancele quando quiser</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="py-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
            <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">
              Planos Transparentes
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Escolha o plano que melhor se adapta às suas necessidades profissionais
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
            {plans.map((plan, index) => {
              const IconComponent = plan.icon;
              return (
                <div
                  key={index}
                  className={`relative bg-white rounded-[2rem] p-8 flex flex-col transition-all duration-300 hover:scale-[1.02] ${
                    plan.popular
                      ? 'shadow-2xl ring-2 ring-gray-900 z-10'
                      : 'shadow-xl border border-gray-200 hover:shadow-2xl'
                  } animate-in fade-in slide-in-from-bottom-8 duration-700`}
                  style={{ animationDelay: `${index * 150 + 500}ms` }}
                >
                  {plan.popular && (
                    <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                      <div className="bg-gray-900 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg flex items-center tracking-wide">
                        <Star className="w-3.5 h-3.5 mr-2 fill-current" />
                        MAIS POPULAR
                      </div>
                    </div>
                  )}

                  <div className="mb-8">
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-6 ${
                      plan.popular ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
                    }`}>
                      <IconComponent className="w-7 h-7" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">
                      {plan.name}
                    </h3>
                    <p className="text-gray-500 text-sm h-10 leading-relaxed">{plan.description}</p>
                  </div>

                  <div className="flex items-baseline mb-8">
                    <span className="text-5xl font-bold text-gray-900 tracking-tight">
                      {plan.price}
                    </span>
                    <span className="text-gray-500 ml-2 font-medium">{plan.period}</span>
                  </div>

                  <ul className="space-y-4 mb-8 flex-grow">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-50 flex items-center justify-center mr-3 mt-0.5">
                          <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={3} />
                        </div>
                        <span className="text-gray-600 text-sm font-medium leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    <button
                      className={`w-full py-4 px-6 rounded-xl font-bold transition-all duration-200 transform hover:-translate-y-1 ${
                        plan.popular
                          ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg hover:shadow-xl'
                          : 'bg-white text-gray-900 border-2 border-gray-200 hover:border-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {plan.buttonText}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 tracking-tight">
              Por que escolher o Processa AI?
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Recursos que fazem a diferença na sua prática jurídica
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div key={index} className="text-center group">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-50 rounded-[2rem] mb-8 group-hover:scale-110 transition-transform duration-300 border border-gray-100">
                    <IconComponent className="w-10 h-10 text-gray-900" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed max-w-xs mx-auto">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-gray-50 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 tracking-tight">
              Perguntas Frequentes
            </h2>
            <p className="text-lg text-gray-500">
              Tire suas dúvidas sobre nossos planos
            </p>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 hover:shadow-md transition-shadow">
                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  {faq.question}
                </h3>
                <p className="text-gray-500 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <div className="bg-gray-900 rounded-[2.5rem] p-8 md:p-20 text-center relative overflow-hidden shadow-2xl">
          {/* Background Effects */}
          <div className="absolute inset-0">
             <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gray-800/30 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
             <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gray-800/30 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
          </div>

          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 tracking-tight">
              Pronto para começar?
            </h2>
            <p className="text-xl text-gray-400 mb-12 font-light">
              Junte-se a centenas de advogados que já confiam no Processa AI
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <button 
                onClick={onRegisterClick}
                className="bg-white text-gray-900 px-8 py-4 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                Começar Teste Grátis
              </button>
              <button 
                onClick={() => setIsContactOpen(true)}
                className="px-8 py-4 rounded-xl font-bold text-white border border-gray-700 hover:bg-gray-800 transition-all hover:border-gray-600"
              >
                Falar com o Suporte
              </button>
            </div>
          </div>
        </div>
      </section>

      <ContactSupportModal 
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />
    </div>
  );
});

PlanosPage.displayName = 'PlanosPage';

export default PlanosPage;