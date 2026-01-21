import { useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import {
  ArrowRight,
  BrainCircuit,
  Calculator,
  ChevronDown,
  Clock,
  FileText,
  Search,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { toast } from 'sonner'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'

export default function HomePage() {
  const { openRegisterModal } = useOutletContext<RootLayoutOutletContext>()
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [isNewsletterSubmitting, setIsNewsletterSubmitting] = useState(false)

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const featuresRef = useRef<HTMLElement>(null)
  const demoRef = useRef<HTMLElement>(null)

  const scrollToFeatures = () => {
    if (featuresRef.current) {
      const headerOffset = 80
      const elementPosition = featuresRef.current.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.scrollY - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
    }
  }

  const scrollToDemo = () => {
    if (demoRef.current) {
      const headerOffset = 80
      const elementPosition = demoRef.current.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.scrollY - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
    }
  }

  const handleNewsletterSubscribe = async (event: React.FormEvent) => {
    event.preventDefault()

    const email = newsletterEmail.trim()
    if (!email) {
      toast.error('Informe seu e-mail')
      return
    }

    setIsNewsletterSubmitting(true)
    try {
      const response = await fetchWithCredentials(`${API_URL}/newsletter/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          channel: 'email',
          consent: true,
        }),
      })

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as
          | { detail?: string; error?: string }
          | null
        throw new Error(error?.detail || error?.error || 'Não foi possível inscrever na newsletter')
      }

      setNewsletterEmail('')
      toast.success('Inscrição recebida! Confira seu e-mail para confirmar.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao inscrever na newsletter')
    } finally {
      setIsNewsletterSubmitting(false)
    }
  }

  return (
    <main>
      <section className="relative min-h-screen flex flex-col justify-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-60" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex-grow flex flex-col justify-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-8 leading-[1.1]">
            A evolução natural <br className="hidden md:block" />
            do seu{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground via-muted-foreground to-foreground">
              escritório jurídico
            </span>
            .
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
            Elimine o trabalho repetitivo com nossa IA. Crie petições, realize cálculos
            complexos e mantenha-se atualizado em uma única interface moderna.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={openRegisterModal}
              className={`group relative px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-200 shadow-xl hover:-translate-y-1 overflow-hidden ${
                isDark
                  ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-black/10'
                  : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-900/10'
              }`}
            >
              <span className="relative z-10 flex items-center gap-2">
                Começar Gratuitamente
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button
              onClick={scrollToDemo}
              className="px-8 py-4 bg-card text-card-foreground border border-border rounded-2xl font-semibold text-lg hover:bg-accent hover:border-border transition-all duration-200"
            >
              Ver Demonstração
            </button>
          </div>
        </div>

        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce cursor-pointer z-20"
          onClick={scrollToFeatures}
        >
          <ChevronDown className="w-8 h-8 text-gray-400 hover:text-gray-900 transition-colors" />
        </div>
      </section>

      <section
        ref={featuresRef}
        className="min-h-[calc(100vh-5rem)] flex flex-col justify-center py-12 lg:py-16 bg-background relative z-10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Poder concentrado.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Todas as ferramentas que você precisa para elevar o nível da sua advocacia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[280px]">
            <div
              className={`md:col-span-2 md:row-span-1 group relative overflow-hidden rounded-3xl p-8 flex flex-col justify-between transition-all duration-500 hover:shadow-2xl shadow-xl hover:scale-[1.02] border ${
                isDark ? 'bg-[#f8fafc] border-[#e2e8f0]' : 'bg-slate-900 border-[#1e293b]'
              }`}
            >
              <div
                className={`absolute inset-0 z-0 transition-opacity duration-500 group-hover:opacity-0 ${
                  isDark ? 'bg-[#f8fafc]' : 'bg-[#0f172a]'
                }`}
              />
              <div
                className={`absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                  isDark
                    ? 'bg-gradient-to-br from-[#f8fafc] via-white to-[#f1f5f9]'
                    : 'bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a]'
                }`}
              />

              <div className="absolute -right-20 -top-20 w-96 h-96 bg-slate-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-start">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border group-hover:border-slate-500/30 transition-all duration-500 shadow-sm ${
                    isDark
                      ? 'bg-white border-[#e2e8f0] group-hover:bg-slate-50'
                      : 'bg-[#1e293b] border-[#334155] group-hover:bg-slate-900/20'
                  }`}
                >
                  <BrainCircuit
                    className={`w-7 h-7 transition-colors duration-300 ${
                      isDark
                        ? 'text-[#0f172a] group-hover:text-slate-600'
                        : 'text-[#cbd5e1] group-hover:text-slate-300'
                    }`}
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h3
                    className={`text-2xl font-bold mb-2 tracking-tight transition-colors duration-300 ${
                      isDark
                        ? 'text-[#0f172a] group-hover:text-slate-900'
                        : 'text-white group-hover:text-slate-50'
                    }`}
                  >
                    IA Jurídica Avançada
                  </h3>
                  <p
                    className={`text-base max-w-lg leading-relaxed font-light transition-colors duration-300 ${
                      isDark
                        ? 'text-[#475569] group-hover:text-[#1e293b]'
                        : 'text-[#94a3b8] group-hover:text-[#cbd5e1]'
                    }`}
                  >
                    Gere petições fundamentadas, analise contratos e obtenha insights estratégicos
                    em segundos.
                  </p>
                </div>
              </div>

              <Link
                to="/ia-juridica"
                className={`relative z-10 mt-6 md:mt-0 inline-flex items-center gap-2 font-medium hover:gap-3 transition-all self-start pt-6 border-t w-full group-hover:border-slate-500/20 ${
                  isDark
                    ? 'text-[#334155] border-[#e2e8f0] group-hover:text-[#0f172a]'
                    : 'text-[#cbd5e1] border-[#1e293b] group-hover:text-white'
                }`}
              >
                <span className="transition-colors">Explorar IA</span>{' '}
                <ArrowRight
                  className={`w-4 h-4 transition-colors ${
                    isDark
                      ? 'text-[#94a3b8] group-hover:text-slate-600'
                      : 'text-[#64748b] group-hover:text-slate-300'
                  }`}
                />
              </Link>
            </div>

            <div className="group relative overflow-hidden rounded-3xl bg-card border border-border p-8 flex flex-col justify-between hover:border-muted-foreground/50 transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02]">
              <div>
                <div className="w-10 h-10 bg-muted border border-border rounded-xl flex items-center justify-center mb-6">
                  <Calculator className="w-5 h-5 text-foreground" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2 tracking-tight">Calculadoras</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Trabalhista e previdenciário com atualização automática.
                </p>
              </div>
              <div className="pt-6 border-t border-border">
                <Link
                  to="/calculadoras"
                  className="inline-flex items-center justify-between w-full text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors group-hover:translate-x-1 duration-200"
                >
                  Acessar <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-3xl bg-muted/30 border border-border p-8 flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02]">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 bg-card border border-border rounded-xl flex items-center justify-center">
                    <Search className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <span className="px-2.5 py-1 bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider rounded-lg border border-border">
                    Em Breve
                  </span>
                </div>
                <h3 className="text-lg font-bold text-muted-foreground mb-2 tracking-tight">Processos</h3>
                <p className="text-muted-foreground/80 text-sm leading-relaxed">
                  Monitoramento automático com notificações em tempo real.
                </p>
              </div>
              <div className="pt-6 border-t border-border">
                <button
                  disabled
                  className="inline-flex items-center justify-between w-full text-sm font-semibold text-muted-foreground cursor-not-allowed"
                >
                  Aguarde <Clock className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="md:col-span-2 group relative overflow-hidden rounded-3xl bg-card border border-border p-8 flex flex-col hover:border-muted-foreground/50 transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02] h-full">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 flex-1">
                <div className="flex items-start gap-6 w-full">
                  <div className="w-12 h-12 bg-muted border border-border rounded-2xl flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-foreground" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1 tracking-tight">Blog Jurídico</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Notícias do meio jurídico e análises aprofundadas sobre legislação.
                    </p>
                  </div>
                </div>

                <div className="w-full md:w-auto pt-6 md:pt-0 md:pl-8 md:border-l border-border border-t md:border-t-0">
                  <Link
                    to="/blog"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors whitespace-nowrap group-hover:translate-x-1 duration-200"
                  >
                    Ler Notícias <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-border w-full">
                <form onSubmit={handleNewsletterSubscribe} className="w-full max-w-2xl">
                  <label htmlFor="home-newsletter-email" className="sr-only">
                    Seu melhor e-mail
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      id="home-newsletter-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="Seu melhor e-mail"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                      disabled={isNewsletterSubmitting}
                      required
                    />
                    <button
                      type="submit"
                      disabled={isNewsletterSubmitting}
                      className={`font-semibold py-2.5 px-4 rounded-xl transition-all duration-200 shadow-md whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed text-sm ${
                        isDark
                          ? 'bg-white text-slate-900 hover:bg-slate-100'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {isNewsletterSubmitting ? 'Inscrevendo…' : 'Inscrever-se'}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Ao se inscrever, você concorda em receber e-mails.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        ref={demoRef}
        className="min-h-[calc(100vh-5rem)] flex flex-col justify-center py-12 lg:py-16 bg-muted/30 relative overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Veja em ação.</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Descubra como nossa plataforma transforma a rotina do seu escritório em poucos
              cliques.
            </p>
          </div>

          <div className="relative max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl border border-border bg-card aspect-video group">
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/30 transition-colors cursor-pointer">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 transition-transform group-hover:scale-110">
                <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[24px] border-l-white border-b-[12px] border-b-transparent ml-2" />
              </div>
            </div>
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
              alt="Demonstração da Plataforma"
              className="absolute inset-0 h-full w-full object-cover opacity-80"
              loading="lazy"
            />
          </div>
        </div>

        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-64 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-64 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl" />
        </div>
      </section>

      <section className="py-24 bg-background relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div
            className={`rounded-[2.5rem] p-8 md:p-16 text-center relative overflow-hidden shadow-2xl ${
              isDark ? 'bg-muted' : 'bg-slate-900'
            }`}
          >
            <div className="absolute inset-0">
              <div
                className={`absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 ${
                  isDark ? 'bg-background/10' : 'bg-white/5'
                }`}
              />
              <div
                className={`absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2 ${
                  isDark ? 'bg-background/10' : 'bg-white/5'
                }`}
              />
            </div>

            <div className="relative z-10 max-w-3xl mx-auto">
              <h2
                className={`text-3xl md:text-5xl font-bold mb-6 tracking-tight ${
                  isDark ? 'text-foreground' : 'text-white'
                }`}
              >
                Pronto para o próximo nível?
              </h2>
              <p
                className={`text-lg mb-10 leading-relaxed font-light ${
                  isDark ? 'text-muted-foreground' : 'text-slate-300'
                }`}
              >
                Junte-se a milhares de advogados que já estão economizando tempo e aumentando sua
                produtividade com a Processa AI.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={openRegisterModal}
                  className={`px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:-translate-y-1 shadow-lg ${
                    isDark
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Criar Conta Gratuita
                </button>
                <Link
                  to="/planos"
                  className={`px-8 py-4 bg-transparent border rounded-xl font-bold text-lg transition-all inline-flex items-center justify-center ${
                    isDark
                      ? 'border-border text-foreground hover:bg-background/10'
                      : 'border-slate-700 text-white hover:bg-white/10'
                  }`}
                >
                  Ver Planos
                </Link>
              </div>

              <p className={`mt-8 text-sm ${isDark ? 'text-muted-foreground' : 'text-slate-500'}`}>
                Sem cartão de crédito • Cancelamento a qualquer momento
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
