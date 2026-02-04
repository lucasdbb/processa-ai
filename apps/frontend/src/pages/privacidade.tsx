export default function PrivacidadePage() {
  return (
    <div className="pt-24">
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[520px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-[var(--hero-glow-opacity)]" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-3">
              Política de Privacidade
            </h1>
            <p className="text-lg text-muted-foreground">
              Como tratamos e protegemos seus dados
            </p>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-card border border-border rounded-2xl p-8 md:p-10 space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Dados coletados</h2>
              <p className="text-muted-foreground leading-relaxed">
                Coletamos dados de cadastro (como nome e e-mail), dados de uso da plataforma e
                informações necessárias para autenticação e faturamento. Também registramos eventos
                para segurança e melhoria dos serviços.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Finalidades</h2>
              <p className="text-muted-foreground leading-relaxed">
                Usamos seus dados para fornecer acesso ao app, executar recursos de IA, organizar
                clientes, processos, prazos e documentos, além de oferecer suporte e comunicações
                essenciais.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Compartilhamento</h2>
              <p className="text-muted-foreground leading-relaxed">
                Podemos compartilhar dados com provedores de infraestrutura e pagamento para operar
                a plataforma (ex.: hospedagem, e-mail transacional e processamento de cobrança). Não
                vendemos seus dados.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Segurança</h2>
              <p className="text-muted-foreground leading-relaxed">
                Adotamos medidas técnicas e organizacionais para proteger suas informações, incluindo
                controle de acesso, criptografia e monitoramento.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Retenção</h2>
              <p className="text-muted-foreground leading-relaxed">
                Mantemos os dados pelo tempo necessário para cumprir finalidades legais e operacionais
                ou enquanto sua conta estiver ativa.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Seus direitos</h2>
              <p className="text-muted-foreground leading-relaxed">
                Você pode solicitar acesso, correção ou exclusão de dados, além de informações sobre
                o tratamento realizado. Atendemos solicitações conforme a legislação aplicável.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Contato</h2>
              <p className="text-muted-foreground leading-relaxed">
                Para dúvidas sobre privacidade, entre em contato pelo e-mail{' '}
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
