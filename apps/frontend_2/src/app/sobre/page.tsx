'use client'

import {
  Target,
  Eye,
  Heart,
  Users,
  Zap,
  Shield,
  CheckCircle,
  Mail,
  Linkedin,
  Phone,
  HeadphonesIcon,
  Clock,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'

const values = [
  {
    icon: Target,
    title: 'Excelência',
    description:
      'Comprometimento com a qualidade e precisão em todas as nossas ferramentas e serviços.',
  },
  {
    icon: Heart,
    title: 'Dedicação',
    description: 'Focados em facilitar o trabalho dos profissionais do direito com soluções práticas.',
  },
  {
    icon: Zap,
    title: 'Inovação',
    description: 'Utilizamos tecnologia de ponta para trazer inovação ao meio jurídico.',
  },
  {
    icon: Shield,
    title: 'Segurança',
    description: 'Proteção de dados e privacidade são prioridades em nossa plataforma.',
  },
]

const team = [
  {
    name: 'Dra. Alexia Machado',
    role: 'Fundadora & Head de Conteúdo',
    description:
      'Advogada autônoma especializada em Direito Trabalhista, Previdenciário e do Consumidor.',
    image: '/images/founder_alexia.jpg',
  },
  {
    name: 'Marcelo Cardozo',
    role: 'Fundador & CTO',
    description: 'Especialista em Tecnologia Jurídica e Inteligência Artificial.',
    image: '/images/founder_marcelo.jpg',
  },
]

const features = [
  'Ferramentas de IA para criação de documentos jurídicos',
  'Calculadoras trabalhistas e previdenciárias precisas',
  'Blog atualizado com as últimas notícias jurídicas',
  'Suporte técnico especializado',
  'Atualizações constantes baseadas na legislação vigente',
  'Interface intuitiva e fácil de usar',
]

export default function AboutPage() {
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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-8">
              <Users className="h-8 w-8 text-gray-900" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6">
              Sobre a Processa AI
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed">
              Transformando a prática jurídica com tecnologia e inovação
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-10">
        {/* Nossa História */}
        <section className="mb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6 tracking-tight">Nossa História</h2>
              <div className="space-y-6 text-gray-500 text-lg leading-relaxed">
                <p>
                  A <strong className="text-gray-900">Processa AI</strong> nasceu da necessidade de
                  modernizar e otimizar o trabalho dos profissionais do direito. Fundada em 2025 por
                  advogados que enfrentavam diariamente os desafios da rotina jurídica, nossa missão é
                  trazer tecnologia de ponta para simplificar processos e aumentar a produtividade.
                </p>
                <p>
                  Combinamos <strong className="text-gray-900">inteligência artificial</strong>,{' '}
                  <strong className="text-gray-900">automação</strong> e conhecimento jurídico profundo
                  para criar uma plataforma que realmente entende as necessidades dos advogados
                  brasileiros.
                </p>
                <p>
                  Hoje, atendemos milhares de profissionais em todo o país, oferecendo ferramentas que
                  vão desde a criação automatizada de documentos até cálculos complexos de verbas
                  trabalhistas e previdenciárias.
                </p>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gray-900/10 rounded-[2rem] transform rotate-3 transition-transform group-hover:rotate-6 duration-300" />
              <img
                src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&h=400&fit=crop"
                alt="Equipe da Processa AI trabalhando em conjunto em um ambiente moderno de escritório"
                className="relative rounded-[2rem] shadow-2xl w-full object-cover transform transition-transform duration-300 group-hover:-translate-y-2"
                loading="lazy"
              />
              <div className="absolute -bottom-6 -left-6 bg-gray-900 text-white p-8 rounded-[1.5rem] shadow-xl transform transition-transform duration-300 group-hover:scale-105">
                <p className="text-4xl font-bold mb-1">2025</p>
                <p className="text-sm text-gray-400 font-medium tracking-wide uppercase">
                  Ano de Fundação
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Missão, Visão e Valores */}
        <section className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <div className="flex items-center space-x-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-8 w-8 text-gray-900" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Missão</h3>
              </div>
              <p className="text-gray-500 leading-relaxed">
                Democratizar o acesso à tecnologia jurídica, oferecendo ferramentas de alta qualidade
                que tornem o trabalho dos advogados mais eficiente e produtivo.
              </p>
            </div>

            <div className="bg-gray-900 p-8 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all duration-300 group text-white transform md:-translate-y-4">
              <div className="flex items-center space-x-4 mb-6">
                <div className="bg-white/10 p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Eye className="h-8 w-8 text-white" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold">Visão</h3>
              </div>
              <p className="text-gray-300 leading-relaxed">
                Ser a plataforma jurídica mais completa e inovadora do Brasil, reconhecida pela
                excelência e pela transformação digital no meio jurídico.
              </p>
            </div>

            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 group">
              <div className="flex items-center space-x-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Heart className="h-8 w-8 text-gray-900" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Valores</h3>
              </div>
              <p className="text-gray-500 leading-relaxed">
                Excelência, inovação, ética, compromisso com o cliente e respeito à profissão jurídica
                guiam todas as nossas decisões e ações.
              </p>
            </div>
          </div>
        </section>

        {/* Nossos Pilares */}
        <section className="mb-24">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center tracking-tight">
            Nossos Pilares
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <div
                key={index}
                className="bg-white p-8 rounded-[2rem] border border-gray-100 text-center hover:shadow-xl transition-all duration-300 group hover:-translate-y-1"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  <value.icon className="h-8 w-8 text-gray-900" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{value.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Nossa Equipe */}
        <section className="mb-24">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center tracking-tight">
            Conheça Nossa Equipe
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {team.map((member, index) => (
              <div
                key={index}
                className="bg-white p-8 rounded-[2rem] border border-gray-100 text-center hover:shadow-xl transition-all duration-300 group hover:-translate-y-1 flex flex-col"
              >
                <div className="relative inline-block mb-6 mx-auto">
                  <div className="absolute inset-0 bg-gray-900/5 rounded-full transform rotate-6 transition-transform group-hover:rotate-12" />
                  <img
                    src={member.image}
                    alt={`Foto de ${member.name}, ${member.role} da Processa AI`}
                    className="relative w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                    loading="lazy"
                  />
                </div>
                <div className="flex-grow flex flex-col">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 min-h-[28px]">{member.name}</h3>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 min-h-[40px]">
                    {member.role}
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed">{member.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* O Que Oferecemos */}
        <section className="mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6 tracking-tight">
                O Que Oferecemos
              </h2>
              <div className="space-y-2">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 p-3 rounded-xl hover:bg-white hover:shadow-sm transition-all duration-200"
                  >
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-50 flex items-center justify-center mt-0.5">
                      <CheckCircle className="h-3.5 w-3.5 text-green-600" strokeWidth={2.5} />
                    </div>
                    <p className="text-gray-600 font-medium text-sm">{feature}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gray-800 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50" />
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-6">Por que escolher a Processa AI?</h3>
                <ul className="space-y-4">
                  <li className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                      <Zap className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-medium text-gray-200 text-sm">Tecnologia de ponta com IA</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                      <Clock className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-medium text-gray-200 text-sm">Economia de tempo</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                      <Target className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-medium text-gray-200 text-sm">Precisão em cálculos</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                      <Shield className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-medium text-gray-200 text-sm">Atualizações constantes</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                      <HeadphonesIcon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-medium text-gray-200 text-sm">Suporte dedicado</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Contato */}
        <section>
          <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 p-8 md:p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 tracking-tight">
              Entre em Contato
            </h2>
            <p className="text-base text-gray-500 mb-8 max-w-2xl mx-auto">
              Tem alguma dúvida ou sugestão? Estamos sempre prontos para ouvir você e melhorar ainda
              mais nossa plataforma.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href="mailto:contato@processaai.com"
                className="flex flex-col items-center justify-center p-6 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Mail className="h-6 w-6 text-gray-900" strokeWidth={1.5} />
                </div>
                <p className="font-bold text-gray-900 mb-1 text-sm">E-mail</p>
                <p className="text-xs text-gray-500">contato@processaai.com</p>
              </a>

              <a
                href="tel:+5511999999999"
                className="flex flex-col items-center justify-center p-6 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Phone className="h-6 w-6 text-gray-900" strokeWidth={1.5} />
                </div>
                <p className="font-bold text-gray-900 mb-1 text-sm">Telefone</p>
                <p className="text-xs text-gray-500">(11) 99999-9999</p>
              </a>

              <a
                href="https://linkedin.com/company/processa-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-6 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Linkedin className="h-6 w-6 text-gray-900" strokeWidth={1.5} />
                </div>
                <p className="font-bold text-gray-900 mb-1 text-sm">LinkedIn</p>
                <p className="text-xs text-gray-500">Siga-nos</p>
              </a>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  )
}
