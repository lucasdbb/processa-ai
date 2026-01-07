'use client'

import { useState } from 'react'
import { Check, Star, Crown, Zap, Users } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { LoginModal } from '@/features/auth/components/login-modal'

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
      'Documentos básicos',
    ],
    buttonText: 'Começar Grátis',
    popular: false,
    icon: Users,
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
      'Integração com sistemas',
    ],
    buttonText: 'Assinar Agora',
    popular: true,
    icon: Zap,
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
      'Compliance avançado',
    ],
    buttonText: 'Falar com Vendas',
    popular: false,
    icon: Crown,
  },
]

export default function PlanosPage() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-gray-900 selection:text-white flex flex-col">
      <Header onLoginClick={() => setIsLoginModalOpen(true)} />

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-gray-100 to-transparent rounded-full blur-3xl opacity-60" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6 mt-8">
              Escolha o Plano Ideal
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed">
              Ferramentas jurídicas inteligentes para impulsionar sua prática profissional
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="py-4 pb-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="grid md:grid-cols-3 gap-6 w-full">
            {plans.map((plan, index) => {
              const IconComponent = plan.icon
              return (
                <div
                  key={index}
                  className={`relative bg-white rounded-2xl p-5 flex flex-col transition-all duration-300 hover:scale-[1.02] ${
                    plan.popular
                      ? 'shadow-2xl ring-2 ring-gray-900 z-10'
                      : 'shadow-xl border border-gray-200 hover:shadow-2xl'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-gray-900 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg flex items-center tracking-wide">
                        <Star className="w-3 h-3 mr-1.5 fill-current" />
                        MAIS POPULAR
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <div
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 ${
                        plan.popular ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <IconComponent className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">
                      {plan.name}
                    </h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{plan.description}</p>
                  </div>

                  <div className="flex items-baseline mb-4">
                    <span className="text-3xl font-bold text-gray-900 tracking-tight">
                      {plan.price}
                    </span>
                    <span className="text-gray-500 ml-1.5 text-sm font-medium">{plan.period}</span>
                  </div>

                  <ul className="space-y-2.5 mb-4 flex-grow">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-50 flex items-center justify-center mr-2.5 mt-0.5">
                          <Check className="w-3 h-3 text-green-600" strokeWidth={3} />
                        </div>
                        <span className="text-gray-600 text-sm font-medium leading-relaxed">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    <button
                      onClick={() => setIsLoginModalOpen(true)}
                      className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 transform hover:-translate-y-0.5 ${
                        plan.popular
                          ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg hover:shadow-xl'
                          : 'bg-white text-gray-900 border-2 border-gray-200 hover:border-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {plan.buttonText}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <Footer />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        initialView="register"
      />
    </div>
  )
}
