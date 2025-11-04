import React from 'react';
import {
  Brain,
  Calculator,
  Newspaper,
  Shield,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = React.memo(() => {
  const features = [
    {
      icon: Newspaper,
      title: 'Blog Jurídico',
      description: 'Mantenha-se atualizado com as últimas notícias e mudanças na legislação.',
      color: 'text-primary-700',
      link: '/blog'
    },
    {
      icon: Brain,
      title: 'IA para Peças Processuais',
      description: 'Crie petições, contratos e documentos jurídicos com auxílio da inteligência artificial.',
      color: 'text-secondary-900',
      link: '/ia-juridica'
    },
    {
      icon: Calculator,
      title: 'Calculadoras Jurídicas',
      description: 'Calcule rescisões trabalhistas, simulações previdenciárias e muito mais.',
      color: 'text-primary-600',
      link: '/calculadoras'
    }
  ];

  const benefits = [
    'Economize tempo na criação de documentos',
    'Reduza erros em cálculos jurídicos',
    'Mantenha-se atualizado com a legislação',
    'Acesse ferramentas profissionais',
    'Interface intuitiva e moderna',
    'Suporte especializado'
  ];

  // Testimonials foram desativados na LandingPage; removidos para evitar erros de build (TS6133: variáveis não utilizadas)

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-800 to-primary-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                O futuro da
                <span className="text-secondary-300"> advocacia</span> é aqui
              </h1>
              <p className="text-xl mb-8 text-primary-100">
                Plataforma completa com inteligência artificial, calculadoras jurídicas 
                e as últimas notícias do meio jurídico. Tudo em um só lugar.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="bg-white text-primary-800 hover:bg-gray-100 font-semibold py-3 px-8 rounded-lg transition-colors duration-200">
                  Começar Gratuitamente
                </button>
                <button className="border-2 border-white text-white hover:bg-white hover:text-primary-800 font-semibold py-3 px-8 rounded-lg transition-colors duration-200">
                  Ver Demonstração
                </button>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-secondary-500 rounded-full"></div>
                    <span>Blog em Tempo Real</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-secondary-400 rounded-full"></div>
                    <span>IA Jurídica Ativa</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-secondary-300 rounded-full"></div>
                    <span>Calculadoras Atualizadas</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-warm-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Ferramentas Poderosas para Advogados
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Descubra como nossa plataforma pode transformar sua prática jurídica 
              com tecnologia de ponta e ferramentas especializadas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card hover:shadow-lg transition-shadow duration-300">
                <div className="text-center">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-6`}>
                    <feature.icon className={`h-8 w-8 ${feature.color}`} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {feature.description}
                  </p>
                  <Link
                    to={feature.link}
                    className="text-primary-700 hover:text-primary-800 font-medium flex items-center justify-center space-x-2"
                  >
                    <span>Saiba mais</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Por que escolher a Processa AI?
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Nossa plataforma foi desenvolvida especificamente para atender 
                às necessidades dos profissionais do direito, oferecendo 
                ferramentas que realmente fazem a diferença no dia a dia.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-br from-secondary-50 to-secondary-100 rounded-2xl p-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-700 rounded-full mb-6">
                  <Shield className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Segurança e Confiabilidade
                </h3>
                <p className="text-gray-600">
                  Seus dados estão protegidos com criptografia de ponta e 
                  nossa plataforma segue todas as normas de segurança 
                  exigidas para o setor jurídico.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      {/* <section className="py-20 bg-warm-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              O que nossos clientes dizem
            </h2>
            <p className="text-xl text-gray-600">
              Veja como a Processa AI está transformando a prática jurídica
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="card">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6 italic">
                  "{testimonial.content}"
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-primary-700 rounded-full flex items-center justify-center text-white font-semibold mr-4">
                    {testimonial.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                    <p className="text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* CTA Section */}
      <section className="py-20 bg-primary-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Pronto para revolucionar sua prática jurídica?
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Junte-se a centenas de advogados que já estão usando a Processa AI 
            para otimizar seu trabalho e oferecer melhores resultados aos clientes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-primary-800 hover:bg-gray-100 font-semibold py-3 px-8 rounded-lg transition-colors duration-200">
              Começar Agora - Grátis
            </button>
            <button className="border-2 border-white text-white hover:bg-white hover:text-primary-800 font-semibold py-3 px-8 rounded-lg transition-colors duration-200">
              Falar com Especialista
            </button>
          </div>
        </div>
      </section>
    </div>
  );
});

LandingPage.displayName = 'LandingPage';

export default LandingPage;