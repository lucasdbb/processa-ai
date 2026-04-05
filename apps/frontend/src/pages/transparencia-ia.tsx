export default function TransparenciaIAPage() {
  return (
    <div className="pt-24">
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[520px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-[var(--hero-glow-opacity)]" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-3">
              Transparência de IA
            </h1>
            <p className="text-lg text-muted-foreground">
              Quais serviços de inteligência artificial utilizamos e como
            </p>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-card border border-border rounded-2xl p-8 md:p-10 space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Visão geral</h2>
              <p className="text-muted-foreground leading-relaxed">
                A Processa AI utiliza modelos de inteligência artificial de terceiros para oferecer
                recursos como OCR (extração de texto de documentos), resumo de peças jurídicas,
                análise de CNIS e um assistente jurídico conversacional. Não treinamos nem
                hospedamos modelos de IA próprios. Todas as funcionalidades são fornecidas via
                API pelos provedores listados abaixo.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Provedores de IA utilizados</h2>

              <div className="space-y-6">
                <div className="border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-1">Google Gemini AI</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Usado para análise de documentos jurídicos, resumos de processos, análise de
                    CNIS, geração de relatórios de calculadoras e o chat jurídico com RAG
                    (recuperação aumentada por embeddings). Dados são enviados à API do Gemini
                    exclusivamente para processar a requisição do usuário.
                  </p>
                </div>

                <div className="border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-1">OpenAI</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Utilizado como provedor de modelos de linguagem em determinados fluxos de
                    análise jurídica. Os dados processados se limitam ao conteúdo do documento ou
                    da consulta do usuário, sem armazenamento persistente pelo provedor além do
                    necessário para retornar a resposta.
                  </p>
                </div>

                <div className="border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-1">Mistral AI</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Usado para OCR (reconhecimento óptico de caracteres), extração de texto de
                    documentos PDF e imagens enviados pelo usuário. O conteúdo extraído é
                    processado localmente nos nossos servidores após o retorno da API.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">O que NÃO é enviado para IA</h2>
              <p className="text-muted-foreground leading-relaxed">
                Dados de gestão do escritório (clientes, processos, prazos, honorários) e dados
                obtidos da integração com o Google Calendar (como datas de prazo sincronizadas)
                <strong className="text-foreground"> nunca são enviados</strong> para nenhum
                modelo de IA. Essas integrações são módulos determinísticos de sincronização de
                dados e operam de forma completamente separada dos recursos de IA.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Uso dos dados pelos provedores</h2>
              <p className="text-muted-foreground leading-relaxed">
                Nenhum dos provedores acima usa os dados transmitidos para treinar seus modelos
                (de acordo com os termos de API de cada provedor). Os dados são processados em
                trânsito para gerar a resposta solicitada e não são armazenados de forma
                persistente pelos provedores além do necessário para a resposta imediata.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">Dúvidas</h2>
              <p className="text-muted-foreground leading-relaxed">
                Para qualquer dúvida sobre o uso de IA na plataforma, entre em contato pelo
                e-mail de suporte disponível na página{' '}
                <a href="/sobre" className="text-foreground underline underline-offset-2 hover:opacity-80 transition-opacity">
                  Sobre
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
