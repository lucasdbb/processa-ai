import {
  CheckCircle,
  Clock,
  Eye,
  HeadphonesIcon,
  Heart,
  Linkedin,
  Mail,
  Phone,
  Shield,
  Target,
  Zap,
} from 'lucide-react'

const values = [
  {
    icon: Target,
    title: 'Excelência',
    description: 'Comprometimento com a qualidade e precisão em todas as nossas ferramentas e serviços.',
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
    description: 'Advogada autônoma especializada em Direito Trabalhista, Previdenciário e do Consumidor.',
    image: '/images/founder_alexia.jpg',
  },
  {
    name: 'Marcelo Cardozo',
    role: 'Fundador & CTO',
    description: 'Engenheiro de software especialista em Inteligência Artificial e Tecnologia Jurídica.',
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

export default function SobrePage() {
  return (
    <div className="pt-24">
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-[var(--hero-glow-opacity)]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-4">
              Sobre a Processa AI
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Transformando a prática jurídica com tecnologia e inovação
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-10">
        <section className="mb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6 tracking-tight">Nossa História</h2>
              <div className="space-y-6 text-muted-foreground text-lg leading-relaxed">
                <p>
                  A Processa AI nasceu em 2025 da união de duas paixões: o Direito e a Tecnologia.
                  Fundada pela Dra. Alexia Machado e pelo Engenheiro Marcelo Cardozo, nossa missão
                  desde o primeiro dia tem sido simplificar a vida dos profissionais jurídicos.
                </p>
                <p>
                  Observando a complexidade e a repetitividade de muitas tarefas no dia a dia dos
                  escritórios de advocacia, percebemos que a Inteligência Artificial poderia ser uma
                  grande aliada. Não para substituir o advogado, mas para potencializar sua
                  capacidade analítica e criativa.
                </p>
                <p>
                  Hoje, oferecemos uma suíte completa de ferramentas que vão desde calculadoras
                  precisas até assistentes de IA para redação de peças, permitindo que advogados em
                  todo o Brasil foquem no que realmente importa: seus clientes e a estratégia dos
                  casos.
                </p>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary to-secondary rounded-[2.5rem] blur-xl opacity-30 group-hover:opacity-50 transition duration-500" />
              <img
                src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&h=400&fit=crop"
                alt="Equipe da Processa AI trabalhando em conjunto em um ambiente moderno de escritório"
                className="relative rounded-[2rem] shadow-2xl w-full object-cover transform transition-transform duration-300 group-hover:-translate-y-2"
                loading="lazy"
              />
              <div className="absolute -bottom-6 -left-6 bg-slate-900 text-white p-8 rounded-[1.5rem] shadow-xl transform transition-transform duration-300 group-hover:scale-105">
                <p className="text-4xl font-bold mb-1">2025</p>
                <p className="text-sm text-white/80 font-medium tracking-wide uppercase">Ano de Fundação</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-[2rem] border border-border shadow-lg hover:shadow-xl transition-all duration-300 group">
              <div className="flex items-center space-x-4 mb-6">
                <div className="bg-muted p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-8 w-8 text-foreground" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-foreground">Missão</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Democratizar o acesso à tecnologia jurídica, oferecendo ferramentas de alta qualidade
                que tornem o trabalho dos advogados mais eficiente e produtivo.
              </p>
            </div>

            <div className="bg-slate-900 p-8 rounded-[2rem] shadow-xl hover:shadow-2xl transition-all duration-300 group text-white transform md:-translate-y-4">
              <div className="flex items-center space-x-4 mb-6">
                <div className="bg-white/10 p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Eye className="h-8 w-8 text-white" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold">Visão</h3>
              </div>
              <p className="text-white/80 leading-relaxed">
                Ser a plataforma jurídica mais completa e inovadora do Brasil, reconhecida pela
                excelência e pela transformação digital no meio jurídico.
              </p>
            </div>

            <div className="bg-card p-8 rounded-[2rem] border border-border shadow-lg hover:shadow-xl transition-all duration-300 group">
              <div className="flex items-center space-x-4 mb-6">
                <div className="bg-muted p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Heart className="h-8 w-8 text-foreground" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-foreground">Valores</h3>
              </div>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                  <span>Ética e Transparência</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                  <span>Inovação Contínua</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                  <span>Foco no Cliente</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-24">
          <h2 className="text-3xl font-bold text-foreground mb-12 text-center tracking-tight">Nossos Pilares</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <div
                key={index}
                className="bg-card p-8 rounded-[2rem] border border-border text-center hover:shadow-xl transition-all duration-300 group hover:-translate-y-1"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  <value.icon className="h-8 w-8 text-foreground" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-3">{value.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-24">
          <h2 className="text-3xl font-bold text-foreground mb-12 text-center tracking-tight">Conheça Nossa Equipe</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {team.map((member, index) => (
              <div
                key={index}
                className="bg-card p-8 rounded-[2rem] border border-border text-center hover:shadow-xl transition-all duration-300 group hover:-translate-y-1 flex flex-col"
              >
                <div className="relative inline-block mb-6 mx-auto">
                  <div className="absolute inset-0 bg-slate-500/10 rounded-full transform rotate-6 transition-transform group-hover:rotate-12" />
                  <img
                    src={member.image}
                    alt={`Foto de ${member.name}, ${member.role} da Processa AI`}
                    width={128}
                    height={128}
                    className="relative w-32 h-32 rounded-full object-cover border-4 border-card shadow-lg"
                    loading="lazy"
                  />
                </div>
                <div className="flex-grow flex flex-col">
                  <h3 className="text-xl font-bold text-foreground mb-2 min-h-[28px]">{member.name}</h3>
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 min-h-[40px]">
                    {member.role}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{member.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-4 tracking-tight">O Que Oferecemos</h2>
              <div className="space-y-1">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 px-3 py-2 rounded-xl border border-transparent hover:bg-muted/40 hover:border-border transition-all duration-200"
                  >
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/10 flex items-center justify-center mt-1">
                      <CheckCircle
                        className="h-3 w-3 text-[hsl(var(--success-strong))]"
                        strokeWidth={2.5}
                      />
                    </div>
                    <p className="text-muted-foreground font-medium text-sm">{feature}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50" />
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-6">Por que escolher a Processa AI?</h3>
                <ul className="space-y-4">
                  <li className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                      <Zap className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-medium text-white/90 text-sm">Tecnologia de ponta com IA</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                      <Clock className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-medium text-white/90 text-sm">Economia de tempo</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                      <Target className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-medium text-white/90 text-sm">Precisão em cálculos</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                      <Shield className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-medium text-white/90 text-sm">Atualizações constantes</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                      <HeadphonesIcon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-medium text-white/90 text-sm">Suporte dedicado</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="bg-card rounded-[2rem] shadow-xl border border-border p-8 md:p-12 text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4 tracking-tight">Entre em Contato</h2>
            <p className="text-base text-muted-foreground mb-8 max-w-2xl mx-auto">
              Tem alguma dúvida ou sugestão? Estamos sempre prontos para ouvir você e melhorar ainda
              mais nossa plataforma.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href="mailto:contato@processaai.com"
                className="flex flex-col items-center justify-center p-6 rounded-xl bg-muted/50 border border-border hover:bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-background rounded-xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Mail className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                </div>
                <p className="font-bold text-foreground mb-1 text-sm">E-mail</p>
                <p className="text-xs text-muted-foreground">contato@processaai.com</p>
              </a>

              <a
                href="tel:+5511999999999"
                className="flex flex-col items-center justify-center p-6 rounded-xl bg-muted/50 border border-border hover:bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-background rounded-xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Phone className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                </div>
                <p className="font-bold text-foreground mb-1 text-sm">Telefone</p>
                <p className="text-xs text-muted-foreground">(11) 99999-9999</p>
              </a>

              <a
                href="https://linkedin.com/company/processa-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-6 rounded-xl bg-muted/50 border border-border hover:bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="w-12 h-12 bg-background rounded-xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Linkedin className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                </div>
                <p className="font-bold text-foreground mb-1 text-sm">LinkedIn</p>
                <p className="text-xs text-muted-foreground">Siga-nos</p>
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
