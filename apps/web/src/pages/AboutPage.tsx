import React from 'react';
import {
  Target,
  Eye,
  Heart,
  Users,
  Award,
  Zap,
  Shield,
  TrendingUp,
  CheckCircle,
  Mail,
  Linkedin,
  Phone
} from 'lucide-react';

const AboutPage: React.FC = React.memo(() => {
  const values = [
    {
      icon: Target,
      title: 'Excelência',
      description: 'Comprometimento com a qualidade e precisão em todas as nossas ferramentas e serviços.',
      color: 'bg-primary-600'
    },
    {
      icon: Heart,
      title: 'Dedicação',
      description: 'Focados em facilitar o trabalho dos profissionais do direito com soluções práticas.',
      color: 'bg-secondary-600'
    },
    {
      icon: Zap,
      title: 'Inovação',
      description: 'Utilizamos tecnologia de ponta para trazer inovação ao meio jurídico.',
      color: 'bg-primary-700'
    },
    {
      icon: Shield,
      title: 'Segurança',
      description: 'Proteção de dados e privacidade são prioridades em nossa plataforma.',
      color: 'bg-secondary-700'
    }
  ];

  const team = [
    {
      name: 'Dra. Alexia Machado',
      role: 'Fundadora & Head de Conteúdo',
      description: 'Advogada autônoma com experiência em Direito Trabalhista, Previdenciário e do Consumidor.',
      image: 'https://SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/public/avatars/team/alexia.jpg'
    },
    {
      name: 'Marcelo Cardozo',
      role: 'Fundador & CTO',
      description: 'Especialista em Tecnologia Jurídica e Inteligência Artificial.',
      image: 'https://SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/public/avatars/team/marcelo.jpg'
    }
  ];

  const achievements = [
    {
      number: '10.000+',
      label: 'Advogados Atendidos',
      icon: Users
    },
    {
      number: '50.000+',
      label: 'Documentos Gerados',
      icon: Award
    },
    {
      number: '98%',
      label: 'Satisfação dos Clientes',
      icon: TrendingUp
    }
  ];

  const features = [
    'Ferramentas de IA para criação de documentos jurídicos',
    'Calculadoras trabalhistas e previdenciárias precisas',
    'Blog atualizado com as últimas notícias jurídicas',
    'Suporte técnico especializado',
    'Atualizações constantes baseadas na legislação vigente',
    'Interface intuitiva e fácil de usar'
  ];

  return (
    <div className="min-h-screen bg-warm-bg">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-800 to-primary-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-6">
              <Users className="h-8 w-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Sobre a Processa AI
            </h1>
            <p className="text-xl text-primary-100 max-w-2xl mx-auto">
              Transformando a prática jurídica com tecnologia e inovação
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Nossa História */}
        <section className="mb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Nossa História</h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  A <strong className="text-primary-700">Processa AI</strong> nasceu da necessidade
                  de modernizar e otimizar o trabalho dos profissionais do direito. Fundada em 2025
                  por advogados que enfrentavam diariamente os desafios da rotina jurídica, nossa
                  missão é trazer tecnologia de ponta para simplificar processos e aumentar a
                  produtividade.
                </p>
                <p>
                  Combinamos <strong>inteligência artificial</strong>, <strong>automação</strong> e
                  conhecimento jurídico profundo para criar uma plataforma que realmente entende as
                  necessidades dos advogados brasileiros.
                </p>
                <p>
                  Hoje, atendemos milhares de profissionais em todo o país, oferecendo ferramentas
                  que vão desde a criação automatizada de documentos até cálculos complexos de
                  verbas trabalhistas e previdenciárias.
                </p>
              </div>
            </div>
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&h=400&fit=crop"
                alt="Equipe da Processa AI trabalhando em conjunto em um ambiente moderno de escritório"
                className="rounded-2xl shadow-2xl"
                loading="lazy"
              />
              <div className="absolute -bottom-6 -left-6 bg-secondary-600 text-white p-6 rounded-xl shadow-lg">
                <p className="text-3xl font-bold">2025</p>
                <p className="text-sm">Ano de Fundação</p>
              </div>
            </div>
          </div>
        </section>

        {/* Missão, Visão e Valores */}
        <section className="mb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-primary-600 p-3 rounded-lg">
                  <Target className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold text-primary-900">Missão</h3>
              </div>
              <p className="text-primary-800">
                Democratizar o acesso à tecnologia jurídica, oferecendo ferramentas de alta
                qualidade que tornem o trabalho dos advogados mais eficiente e produtivo.
              </p>
            </div>

            <div className="card bg-gradient-to-br from-secondary-50 to-secondary-100 border-secondary-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-secondary-600 p-3 rounded-lg">
                  <Eye className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold text-secondary-900">Visão</h3>
              </div>
              <p className="text-secondary-800">
                Ser a plataforma jurídica mais completa e inovadora do Brasil, reconhecida
                pela excelência e pela transformação digital no meio jurídico.
              </p>
            </div>

            <div className="card bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-primary-600 p-3 rounded-lg">
                  <Heart className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold text-primary-900">Valores</h3>
              </div>
              <p className="text-primary-800">
                Excelência, inovação, ética, compromisso com o cliente e respeito à
                profissão jurídica guiam todas as nossas decisões e ações.
              </p>
            </div>
          </div>
        </section>

        {/* Nossos Valores Detalhados */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Nossos Pilares</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <div key={index} className="card text-center hover:shadow-xl transition-shadow duration-300">
                <div className={`${value.color} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <value.icon className="h-8 w-8 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-sm text-gray-600">{value.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Conquistas */}
        {/* <section className="mb-16">
          <div className="bg-gradient-to-br from-primary-800 to-primary-900 rounded-2xl p-12 text-white">
            <h2 className="text-3xl font-bold mb-8 text-center">Nossas Conquistas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {achievements.map((achievement, index) => (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
                    <achievement.icon className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <p className="text-4xl font-bold mb-2">{achievement.number}</p>
                  <p className="text-primary-100">{achievement.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section> */}

        {/* Nossa Equipe */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Conheça Nossa Equipe</h2>
          <div
            className={`grid grid-cols-1 gap-8 ${
              team.length === 1
                ? 'md:grid-cols-1 max-w-md mx-auto'
                : team.length === 2
                ? 'md:grid-cols-2 max-w-4xl mx-auto'
                : team.length === 3
                ? 'md:grid-cols-3'
                : 'md:grid-cols-2 lg:grid-cols-4'
            }`}
          >
            {team.map((member, index) => (
              <div key={index} className="card text-center hover:shadow-xl transition-shadow duration-300">
                <img
                  src={member.image}
                  alt={`Foto de ${member.name}, ${member.role} da Processa AI`}
                  className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border-4 border-primary-100"
                  loading="lazy"
                />
                <h3 className="text-xl font-bold text-gray-900 mb-1">{member.name}</h3>
                <p className="text-primary-700 font-semibold mb-3">{member.role}</p>
                <p className="text-sm text-gray-600">{member.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* O Que Oferecemos */}
        <section className="mb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">O Que Oferecemos</h2>
              <div className="space-y-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-secondary-600 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-700">{feature}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="card bg-gradient-to-br from-secondary-50 to-secondary-100 border-secondary-200 p-8">
              <h3 className="text-2xl font-bold text-secondary-900 mb-4">
                Por que escolher a Processa AI?
              </h3>
              <ul className="space-y-3 text-secondary-800">
                <li className="flex items-start">
                  <span className="font-bold mr-2">✓</span>
                  Tecnologia de ponta com IA especializada em direito
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2">✓</span>
                  Economia de tempo em tarefas repetitivas
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2">✓</span>
                  Precisão em cálculos complexos
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2">✓</span>
                  Atualizações constantes com a legislação
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2">✓</span>
                  Suporte dedicado para advogados
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Contato */}
        <section>
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">Entre em Contato</h2>
            <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
              Tem alguma dúvida ou sugestão? Estamos sempre prontos para ouvir você e
              melhorar ainda mais nossa plataforma.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <a
                href="mailto:contato@processaai.com"
                className="flex items-center justify-center space-x-3 p-4 border-2 border-primary-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all duration-200"
              >
                <Mail className="h-6 w-6 text-primary-700" />
                <div>
                  <p className="font-semibold text-gray-900">E-mail</p>
                  <p className="text-sm text-gray-600">contato@processaai.com</p>
                </div>
              </a>
              <a
                href="tel:+5511999999999"
                className="flex items-center justify-center space-x-3 p-4 border-2 border-primary-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all duration-200"
              >
                <Phone className="h-6 w-6 text-primary-700" />
                <div>
                  <p className="font-semibold text-gray-900">Telefone</p>
                  <p className="text-sm text-gray-600">(11) 99999-9999</p>
                </div>
              </a>
              <a
                href="https://linkedin.com/company/processa-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-3 p-4 border-2 border-primary-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all duration-200"
              >
                <Linkedin className="h-6 w-6 text-primary-700" />
                <div>
                  <p className="font-semibold text-gray-900">LinkedIn</p>
                  <p className="text-sm text-gray-600">Siga-nos</p>
                </div>
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

AboutPage.displayName = 'AboutPage';

export default AboutPage;
