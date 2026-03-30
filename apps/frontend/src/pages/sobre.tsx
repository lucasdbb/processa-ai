import { useEffect, useRef } from 'react'
import { Eye, Heart, Mail, Target } from 'lucide-react'


const team = [
  {
    name: 'Alexia Machado',
    role: 'Fundadora & Head de Conteúdo',
    description: 'Advogada autônoma especializada em Direito Trabalhista, Previdenciário e do Consumidor.',
    image: '/images/founder_alexia.jpg',
  },
  {
    name: 'Marcelo Cardozo',
    role: 'Fundador & Head de Tecnologia',
    description: 'Desenvolvedor de software especialista em Inteligência Artificial e Tecnologia Jurídica.',
    image: '/images/founder_marcelo.jpg',
  },
]


export default function SobrePage() {
  const valuesCarouselRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = valuesCarouselRef.current
    if (!container) return

    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (!isMobile) return

    requestAnimationFrame(() => {
      const centerCard = container.querySelector<HTMLElement>('[data-values-card="1"]')
      centerCard?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' })
    })
  }, [])

  return (
    <div className="pt-24">
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-[var(--hero-glow-opacity)]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-3 sm:mb-4">
              Criado por quem viveu o problema.
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
              Tecnologia jurídica prática para reduzir retrabalho, ganhar tempo e elevar a qualidade técnica da rotina forense.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-10">
        <section className="mb-14 sm:mb-20 md:mb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 sm:mb-6 tracking-tight">Nossa História</h2>
              <div className="space-y-4 sm:space-y-6 text-muted-foreground text-base sm:text-lg leading-relaxed">
                <p>
                  A Processa AI nasceu em 2026 para resolver um cenário comum na advocacia: excesso de tarefas operacionais,
                  pressão por produtividade e pouco tempo para estratégia jurídica.
                </p>
                <p>
                  A proposta é simples: usar tecnologia para automatizar o que é repetitivo e liberar energia para o que
                  realmente gera valor no escritório: análise, negociação e tomada de decisão.
                </p>
                <p>
                  Hoje a plataforma reúne gestão de escritório, calculadoras automatizadas e IA aplicada ao direito brasileiro,
                  ajudando profissionais em todo o país a atuar com mais previsibilidade, eficiência e segurança técnica.
                </p>
              </div>
            </div>
            <div className="relative group mt-2 sm:mt-0">
              <div className="absolute -inset-3 sm:-inset-4 bg-gradient-to-r from-primary to-secondary rounded-[2rem] sm:rounded-[2.5rem] blur-xl opacity-30 group-hover:opacity-50 transition duration-500" />
              <img
                src="/images/geometric_dash.png"
                alt="Equipe da Processa AI trabalhando em conjunto em um ambiente moderno de escritório"
                className="relative rounded-2xl sm:rounded-[2rem] shadow-2xl w-full object-cover transform transition-transform duration-300 group-hover:-translate-y-2"
                loading="lazy"
              />
              <div className="absolute -bottom-4 sm:-bottom-6 -left-2 sm:-left-6 bg-slate-900 text-white p-4 sm:p-8 rounded-xl sm:rounded-[1.5rem] shadow-xl transform transition-transform duration-300 group-hover:scale-105">
                <p className="text-2xl sm:text-4xl font-bold mb-1">2026</p>
                <p className="text-[10px] sm:text-sm text-white/80 font-medium tracking-wide uppercase">Ano de Fundação</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-14 sm:mb-20 md:mb-24">
          <div ref={valuesCarouselRef} className="w-full max-w-7xl mx-auto flex md:grid md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none overscroll-x-contain px-1 sm:px-0 pb-2">
            <div data-values-card="0" className="bg-card p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-border shadow-lg hover:shadow-xl transition-all duration-300 group basis-[70%] sm:basis-[70%] md:basis-auto snap-center md:snap-none shrink-0 md:shrink">
              <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
                <div className="bg-muted p-3 sm:p-4 rounded-xl sm:rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-6 sm:h-8 w-6 sm:w-8 text-foreground" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground">Missão</h3>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Eliminar o trabalho mecânico da advocacia para que advogados dediquem
                seu tempo ao que realmente importa: estratégia e clientes.
              </p>
            </div>

            <div data-values-card="1" className="bg-slate-900 p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] shadow-xl hover:shadow-2xl transition-all duration-300 group text-white transform md:-translate-y-4 basis-[70%] sm:basis-[70%] md:basis-auto snap-center md:snap-none shrink-0 md:shrink">
              <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
                <div className="bg-white/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Eye className="h-6 sm:h-8 w-6 sm:w-8 text-white" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold">Visão</h3>
              </div>
              <p className="text-sm sm:text-base text-white/80 leading-relaxed">
                Ser a plataforma jurídica mais completa e inovadora do Brasil, reconhecida pela
                excelência e pela transformação digital no meio jurídico.
              </p>
            </div>

            <div data-values-card="2" className="bg-card p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-border shadow-lg hover:shadow-xl transition-all duration-300 group basis-[70%] sm:basis-[70%] md:basis-auto snap-center md:snap-none shrink-0 md:shrink">
              <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
                <div className="bg-muted p-3 sm:p-4 rounded-xl sm:rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Heart className="h-6 sm:h-8 w-6 sm:w-8 text-foreground" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground">Valores</h3>
              </div>
              <ul className="space-y-2 text-sm sm:text-base text-muted-foreground">
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

        <section className="mb-14 sm:mb-20 md:mb-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-8 sm:mb-12 text-center tracking-tight">Conheça Nossa Equipe</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 max-w-4xl mx-auto">
            {team.map((member, index) => (
              <div
                key={index}
                className="bg-card p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-border text-center hover:shadow-xl transition-all duration-300 group hover:-translate-y-1 flex flex-col"
              >
                <div className="relative inline-block mb-4 sm:mb-6 mx-auto">
                  <div className="absolute inset-0 bg-slate-500/10 rounded-full transform rotate-6 transition-transform group-hover:rotate-12" />
                  <img
                    src={member.image}
                    alt={`Foto de ${member.name}, ${member.role} da Processa AI`}
                    width={128}
                    height={128}
                    className="relative w-28 sm:w-32 h-28 sm:h-32 rounded-full object-cover border-4 border-card shadow-lg"
                    loading="lazy"
                  />
                </div>
                <div className="flex-grow flex flex-col">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 min-h-[24px] sm:min-h-[28px]">{member.name}</h3>
                  <p className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 sm:mb-4 min-h-[34px] sm:min-h-[40px]">
                    {member.role}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{member.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl sm:rounded-[2rem] shadow-2xl p-6 sm:p-10 md:p-16 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-16 sm:w-20 h-16 sm:h-20 bg-white/10 rounded-xl sm:rounded-2xl mb-4 sm:mb-6 backdrop-blur-sm">
                <Mail className="h-8 sm:h-10 w-8 sm:w-10 text-white" strokeWidth={1.5} />
              </div>
              
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4 tracking-tight">
                Quer falar com quem criou a plataforma?
              </h2>

              <p className="text-sm sm:text-base md:text-lg text-white/80 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed">
                Sugestão, dúvida ou feedback. Lemos tudo e respondemos pessoalmente.
              </p>
              
              <a
                href="mailto:suporte@processai.app.br"
                className="inline-flex items-center justify-center w-full sm:w-auto gap-2 sm:gap-3 px-5 sm:px-8 py-3 sm:py-4 bg-white text-slate-900 rounded-lg sm:rounded-xl font-semibold hover:bg-white/90 hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl group"
              >
                <Mail className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                <span className="text-sm sm:text-lg">suporte@processai.app.br</span>
              </a>
              
              <p className="text-xs sm:text-sm text-white/60 mt-4 sm:mt-6">
                Respondemos em até 24 horas úteis
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
