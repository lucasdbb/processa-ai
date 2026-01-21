import { useRef, useState, useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import {
  ArrowRight,
  BrainCircuit,
  Calculator,
  ChevronDown,
  FileText,
  Users,
  BookOpen,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { toast } from 'sonner'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'
import { AI_TOOLS } from '@/features/ai/ai-tools'

export default function HomePage() {
  const { openRegisterModal } = useOutletContext<RootLayoutOutletContext>()
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [isNewsletterSubmitting, setIsNewsletterSubmitting] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const availableAITools = useMemo(() => AI_TOOLS.filter((t) => !t.locked).length, [])

  const featuresRef = useRef<HTMLElement>(null)
  const demoRef = useRef<HTMLElement>(null)

  const screenshots = [
    {
      title: 'Dashboard - Visão Geral',
      description: 'Métricas de clientes, processos e prazos em tempo real',
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop',
    },
    {
      title: 'Gestão de Clientes',
      description: 'Busca avançada, filtros e organização completa',
      image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop',
    },
    {
      title: 'IA - Petição Inicial',
      description: 'Editor markdown com geração automática de peças',
      image: 'https://images.unsplash.com/photo-1555421689-d68471e189f2?q=80&w=2070&auto=format&fit=crop',
    },
    {
      title: 'Calendário de Prazos',
      description: 'Alertas coloridos e dashboard de urgências',
      image: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=2068&auto=format&fit=crop',
    },
  ]

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % screenshots.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + screenshots.length) % screenshots.length)
  }

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
            A plataforma completa para advogados modernos: CRM jurídico + Calculadoras automatizadas
            + IA especializada em direito brasileiro.
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
        className="min-h-[calc(100vh-5rem)] flex flex-col justify-center py-6 bg-background relative z-10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center mb-6">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Poder concentrado.
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Todas as ferramentas que você precisa para elevar o nível da sua advocacia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 auto-rows-[220px]">
            {/* Linha 1: CRM Jurídico (2 cols) + Calendário de Prazos (1 col) */}
            
            {/* CRM Jurídico - Card Grande */}
            <div
              className={`md:col-span-2 md:row-span-1 group relative overflow-hidden rounded-3xl p-6 flex flex-col justify-between transition-all duration-500 hover:shadow-2xl shadow-xl hover:scale-[1.02] border ${
                isDark ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-[#1e293b]'
              }`}
            >
              <div
                className={`absolute inset-0 z-0 transition-opacity duration-500 group-hover:opacity-0 ${
                  isDark ? 'bg-slate-50' : 'bg-[#0f172a]'
                }`}
              />
              <div
                className={`absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                  isDark
                    ? 'bg-gradient-to-br from-white via-blue-50 to-indigo-50'
                    : 'bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a]'
                }`}
              />

              <div className={`absolute -right-20 -top-20 w-96 h-96 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${
                isDark ? 'bg-blue-500/10' : 'bg-blue-500/10'
              }`} />
              <div className={`absolute -left-20 -bottom-20 w-96 h-96 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${
                isDark ? 'bg-indigo-500/10' : 'bg-purple-500/10'
              }`} />

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border group-hover:border-blue-500/30 transition-all duration-500 shadow-sm ${
                      isDark
                        ? 'bg-white border-slate-200 group-hover:bg-blue-50'
                        : 'bg-[#1e293b] border-[#334155] group-hover:bg-blue-900/20'
                    }`}
                  >
                    <Users
                      className={`w-5 h-5 transition-colors duration-300 ${
                        isDark
                          ? 'text-slate-700 group-hover:text-blue-600'
                          : 'text-[#cbd5e1] group-hover:text-blue-300'
                      }`}
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3
                    className={`text-lg font-bold tracking-tight transition-colors duration-300 ${
                      isDark
                        ? 'text-slate-900 group-hover:text-slate-950'
                        : 'text-white group-hover:text-slate-50'
                    }`}
                  >
                    CRM Jurídico Completo
                  </h3>
                </div>
                <p
                  className={`text-sm leading-relaxed font-light transition-colors duration-300 ${
                    isDark
                      ? 'text-slate-600 group-hover:text-slate-700'
                      : 'text-[#94a3b8] group-hover:text-[#cbd5e1]'
                  }`}
                >
                  Cadastre clientes, acompanhe processos com número CNJ, gerencie prazos com
                  alertas automáticos de urgência e mantenha tudo organizado.
                </p>
              </div>

              <Link
                to="/app/clientes"
                className={`relative z-10 inline-flex items-center gap-2 font-medium hover:gap-3 transition-all self-start pt-3 border-t w-full group-hover:border-blue-500/20 ${
                  isDark
                    ? 'text-slate-700 border-slate-200 group-hover:text-slate-900'
                    : 'text-[#cbd5e1] border-[#1e293b] group-hover:text-white'
                }`}
              >
                <span className="transition-colors">Explorar CRM</span>{' '}
                <ArrowRight
                  className={`w-4 h-4 transition-colors ${
                    isDark
                      ? 'text-slate-500 group-hover:text-slate-700'
                      : 'text-[#64748b] group-hover:text-slate-300'
                  }`}
                />
              </Link>
            </div>

            {/* Calendário de Prazos */}
            <div
              className={`group relative overflow-hidden rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02] border ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                      isDark
                        ? 'bg-slate-700 border-slate-600'
                        : 'bg-slate-100 border-slate-200'
                    }`}
                  >
                    <CalendarClock
                      className={`w-4 h-4 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3
                    className={`text-base font-bold tracking-tight ${
                      isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    Calendário de Prazos
                  </h3>
                </div>
                <p
                  className={`text-sm leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Alertas automáticos de urgência com dashboard: hoje, próximos 7 dias, este mês.
                </p>
              </div>
              <div
                className={`pt-2 mt-auto border-t ${
                  isDark ? 'border-slate-700' : 'border-slate-200'
                }`}
              >
                <Link
                  to="/app/prazos"
                  className={`inline-flex items-center justify-between w-full text-sm font-semibold transition-colors group-hover:translate-x-1 duration-200 ${
                    isDark
                      ? 'text-slate-300 hover:text-slate-100'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Acessar <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Linha 2: Calculadoras (1 col) + IA Jurídica (2 cols) */}
            
            {/* Calculadoras */}
            <div
              className={`group relative overflow-hidden rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02] border ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                      isDark
                        ? 'bg-slate-700 border-slate-600'
                        : 'bg-slate-100 border-slate-200'
                    }`}
                  >
                    <Calculator
                      className={`w-4 h-4 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3
                    className={`text-base font-bold tracking-tight ${
                      isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    Calculadoras Jurídicas
                  </h3>
                </div>
                <p
                  className={`text-sm leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Trabalhista e previdenciário com atualização automática de índices e legislação.
                </p>
              </div>
              <div
                className={`pt-2 mt-auto border-t ${
                  isDark ? 'border-slate-700' : 'border-slate-200'
                }`}
              >
                <Link
                  to="/app/calculadoras"
                  className={`inline-flex items-center justify-between w-full text-sm font-semibold transition-colors group-hover:translate-x-1 duration-200 ${
                    isDark
                      ? 'text-slate-300 hover:text-slate-100'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Acessar <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* IA Jurídica com Badge Dinâmico - Card Grande */}
            <div
              className={`md:col-span-2 group relative overflow-hidden rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02] border ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                        isDark
                          ? 'bg-slate-700 border-slate-600'
                          : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <BrainCircuit
                        className={`w-5 h-5 ${
                          isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}
                        strokeWidth={1.5}
                      />
                    </div>
                    <h3
                      className={`text-lg font-bold tracking-tight ${
                        isDark ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      IA Jurídica Especializada
                    </h3>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border flex-shrink-0 ${
                      isDark
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-green-50 text-green-700 border-green-200'
                    }`}
                  >
                    {availableAITools} Ferramentas
                  </span>
                </div>
                <p
                  className={`text-sm leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Automatize elaboração de peças, análise de documentos e pesquisa jurídica com IA
                  treinada para o direito brasileiro.
                </p>
              </div>
              <div
                className={`pt-2 mt-auto border-t ${
                  isDark ? 'border-slate-700' : 'border-slate-200'
                }`}
              >
                <Link
                  to="/app/ia"
                  className={`inline-flex items-center justify-between w-full text-sm font-semibold transition-colors group-hover:translate-x-1 duration-200 ${
                    isDark
                      ? 'text-slate-300 hover:text-slate-100'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Explorar IA <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Linha 3: Blog Jurídico (2 cols) + Biblioteca Jurídica (1 col) */}
            
            {/* Blog + Newsletter - Card Grande */}
            <div
              className={`md:col-span-2 group relative overflow-hidden rounded-3xl p-6 flex flex-col transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02] h-full border ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                      isDark
                        ? 'bg-slate-700 border-slate-600'
                        : 'bg-slate-100 border-slate-200'
                    }`}
                  >
                    <FileText
                      className={`w-5 h-5 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3
                    className={`text-lg font-bold tracking-tight ${
                      isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    Blog Jurídico + Newsletter
                  </h3>
                </div>
                <p
                  className={`text-sm leading-relaxed mb-3 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Notícias do meio jurídico, análises aprofundadas e atualizações sobre legislação.
                </p>
              </div>

              <div
                className={`mt-auto pt-2 w-full border-t ${
                  isDark ? 'border-slate-700' : 'border-slate-200'
                }`}
              >
                <form onSubmit={handleNewsletterSubscribe} className="w-full max-w-2xl">
                  <label htmlFor="home-newsletter-email" className="sr-only">
                    Seu melhor e-mail
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="home-newsletter-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="Seu melhor e-mail"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                        isDark
                          ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400 focus:bg-slate-600'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-500 focus:bg-white'
                      }`}
                      disabled={isNewsletterSubmitting}
                      required
                    />
                    <button
                      type="submit"
                      disabled={isNewsletterSubmitting}
                      className={`font-semibold py-2 px-4 rounded-lg transition-all duration-200 shadow-md whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed text-sm ${
                        isDark
                          ? 'bg-white text-slate-900 hover:bg-slate-100'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {isNewsletterSubmitting ? 'Inscrevendo…' : 'Inscrever-se'}
                    </button>
                  </div>
                  <p
                    className={`mt-1.5 text-[10px] ${
                      isDark ? 'text-slate-500' : 'text-slate-500'
                    }`}
                  >
                    Ao se inscrever, você concorda em receber e-mails.
                  </p>
                </form>
              </div>
            </div>

            {/* Biblioteca Jurídica */}
            <div
              className={`group relative overflow-hidden rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02] border ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                      isDark
                        ? 'bg-slate-700 border-slate-600'
                        : 'bg-slate-100 border-slate-200'
                    }`}
                  >
                    <BookOpen
                      className={`w-4 h-4 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3
                    className={`text-base font-bold tracking-tight ${
                      isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    Biblioteca Jurídica
                  </h3>
                </div>
                <p
                  className={`text-sm leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Modelos de petições, guias práticos e ebooks exclusivos para assinantes.
                </p>
              </div>
              <div
                className={`pt-2 mt-auto border-t ${
                  isDark ? 'border-slate-700' : 'border-slate-200'
                }`}
              >
                <Link
                  to="/materiais"
                  className={`inline-flex items-center justify-between w-full text-sm font-semibold transition-colors group-hover:translate-x-1 duration-200 ${
                    isDark
                      ? 'text-slate-300 hover:text-slate-100'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Acessar <ArrowRight className="w-4 h-4" />
                </Link>
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

          {/* Carousel Container */}
          <div className="relative max-w-5xl mx-auto">
            {/* Screenshot Display */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-border bg-card aspect-video">
              <div className="absolute inset-0 transition-opacity duration-500">
                <img
                  src={screenshots[currentSlide].image}
                  alt={screenshots[currentSlide].title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>

              {/* Caption */}
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <h3 className="text-xl font-bold mb-1">{screenshots[currentSlide].title}</h3>
                <p className="text-sm text-white/90">{screenshots[currentSlide].description}</p>
              </div>

              {/* Navigation Arrows */}
              <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 backdrop-blur-md border-2 border-white shadow-xl flex items-center justify-center hover:bg-white hover:scale-110 transition-all group"
                aria-label="Slide anterior"
              >
                <ChevronLeft className="w-6 h-6 text-slate-900 group-hover:scale-110 transition-transform" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 backdrop-blur-md border-2 border-white shadow-xl flex items-center justify-center hover:bg-white hover:scale-110 transition-all group"
                aria-label="Próximo slide"
              >
                <ChevronRight className="w-6 h-6 text-slate-900 group-hover:scale-110 transition-transform" />
              </button>
            </div>

            {/* Dots Indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {screenshots.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentSlide
                      ? 'w-8 bg-foreground'
                      : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                  aria-label={`Ir para slide ${index + 1}`}
                />
              ))}
            </div>
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
                  className={`px-8 py-4 bg-transparent border-1 rounded-xl font-bold text-lg transition-all inline-flex items-center justify-center ${
                    isDark
                      ? 'border-slate-900 text-foreground hover:bg-slate-900/10'
                      : 'border-white text-white hover:bg-white/10'
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
