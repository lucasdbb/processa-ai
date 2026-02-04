export default function TermosPage() {
  return (
    <div className="pt-24">
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[520px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-[var(--hero-glow-opacity)]" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-3">
              Termos de Uso
            </h1>
            <p className="text-lg text-muted-foreground">
              Regras de uso da plataforma Processa AI
            </p>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-card border border-border rounded-2xl p-8 md:p-10 space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Aceitação dos termos</h2>
              <p className="text-muted-foreground leading-relaxed">
                Ao acessar ou utilizar a Processa AI, você concorda com estes Termos de Uso e com as
                políticas aplicáveis. Se não concordar, não utilize a plataforma.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Elegibilidade e conta</h2>
              <p className="text-muted-foreground leading-relaxed">
                Você é responsável por manter suas credenciais seguras e pelas atividades realizadas
                na sua conta. É necessário fornecer informações verdadeiras e atualizadas.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Uso aceitável</h2>
              <p className="text-muted-foreground leading-relaxed">
                É proibido utilizar a plataforma para fins ilícitos, violar direitos de terceiros,
                realizar engenharia reversa, tentar acessar dados de outros usuários ou contornar
                limitações técnicas.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Conteúdo e IA</h2>
              <p className="text-muted-foreground leading-relaxed">
                As ferramentas de IA auxiliam na produtividade jurídica, mas não substituem a análise
                profissional. Os conteúdos gerados devem ser revisados antes de uso.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Planos, créditos e cobrança</h2>
              <p className="text-muted-foreground leading-relaxed">
                O acesso a recursos pode variar por plano. Os créditos de assinatura são renovados
                periodicamente conforme o plano contratado. Créditos extras seguem as regras de
                aquisição exibidas na plataforma.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Disponibilidade</h2>
              <p className="text-muted-foreground leading-relaxed">
                Trabalhamos para manter a plataforma estável, mas podem ocorrer interrupções por
                manutenção, atualizações ou fatores externos.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Propriedade intelectual</h2>
              <p className="text-muted-foreground leading-relaxed">
                Todo o conteúdo da plataforma, incluindo marca, design e funcionalidades, é protegido
                por direitos autorais e não pode ser reproduzido sem autorização.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Limitação de responsabilidade</h2>
              <p className="text-muted-foreground leading-relaxed">
                A Processa AI não se responsabiliza por decisões tomadas exclusivamente com base em
                informações geradas pela plataforma. A responsabilidade final é do usuário.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Contato</h2>
              <p className="text-muted-foreground leading-relaxed">
                Em caso de dúvidas, fale conosco pelo e-mail{' '}
                <a className="text-primary hover:underline" href="mailto:suporte@processai.app.br">
                  suporte@processai.app.br
                </a>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
