import { useRef, useState, useMemo, useEffect } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { SEO } from '@/components/seo'
import {
  ArrowRight,
  BrainCircuit,
  Calculator,
  ChevronDown,
  FileText,
  Users,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { toast } from 'sonner'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'
import { fetchToolsCatalog } from '@/components/layout/tools-catalog-utils'
import type { AiTool } from '@/features/ai/types'
import type { CalculatorItem } from '@/features/calculators/api'
import { useAuth } from '@/features/auth/hooks/use-auth'

export default function HomePage() {
  const { openRegisterModal, openLoginModal } = useOutletContext<RootLayoutOutletContext>()
  const { isAuthenticated } = useAuth()
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [isNewsletterSubmitting, setIsNewsletterSubmitting] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [aiTools, setAiTools] = useState<AiTool[]>([])
  const [calculators, setCalculators] = useState<CalculatorItem[]>([])
  const [latestPost, setLatestPost] = useState<{ title: string; slug: string; category?: string } | null>(null)

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Fetch AI tools and calculators from backend on mount
  useEffect(() => {
    fetchToolsCatalog().then(({ aiTools, calculators }) => {
      setAiTools(aiTools)
      setCalculators(calculators)
    })
  }, [])

  // Fetch latest blog post for desktop display
  useEffect(() => {
    fetchWithCredentials(`${API_URL}/blog/posts?published=true&limit=1`)
      .then((r) => r.json())
      .then((payload: unknown) => {
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as Record<string, unknown>)?.posts)
            ? ((payload as Record<string, unknown>).posts as unknown[])
            : Array.isArray((payload as Record<string, unknown>)?.items)
              ? ((payload as Record<string, unknown>).items as unknown[])
              : []
        const first = list[0] as { title?: string; slug?: string; category?: string } | undefined
        if (first?.title && first?.slug) {
          setLatestPost({ title: first.title, slug: first.slug, category: first.category })
        }
      })
      .catch(() => null)
  }, [])

  const availableAITools = useMemo(() => aiTools.filter((t) => !t.locked).length, [aiTools])
  const availableCalculators = useMemo(() => calculators.filter((calc) => !calc.locked).length, [calculators])

  const featuresRef = useRef<HTMLElement>(null)
  const demoRef = useRef<HTMLElement>(null)

  const screenshots = [
    {
      title: 'Gestão do Escritório',
      description: 'Clientes, processos, prazos, honorários e muito mais. Tudo sob controle num painel simples.',
      image: '/images/waitlist/painel_gestao.png',
    },
    {
      title: 'IA Jurídica',
      description: 'Análise de CNIS, resumos e automações em minutos para o direito brasileiro.',
      image: '/images/waitlist/analise_cnis.png',
    },
    {
      title: 'Calculadoras',
      description: 'Cálculos confiáveis de rescisão ou previdência com relatórios em PDF.',
      image: '/images/waitlist/calculadora_rescisao.png',
    },
    {
      title: 'Biblioteca de Materiais',
      description: 'E-books, guias e petições de alta qualidade para você não começar do zero.',
      image: '/images/waitlist/materiais.png',
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

  const handleProtectedFeatureClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (isAuthenticated) return
    event.preventDefault()
    openLoginModal()
  }

  return (
    <main>
      <SEO ogUrl="https://processai.app.br" />
      <section className="relative min-h-screen flex flex-col justify-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-60" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex-grow flex flex-col justify-center">
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-foreground mb-8 leading-[1.1]">
            A evolução natural <br className="hidden md:block" />
            do seu{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground via-muted-foreground to-foreground">
              escritório jurídico
            </span>
            .
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Processos sob controle. Cálculos automáticos. IA treinada para o direito brasileiro.
            Tudo no mesmo lugar.
          </p>

          <div className="flex flex-col items-center gap-3 mb-10">
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-[70%] mx-auto">
              <button
                onClick={openRegisterModal}
                className={`group relative w-full sm:w-auto px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-200 shadow-xl hover:-translate-y-1 overflow-hidden ${
                  isDark
                    ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-black/10'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-900/10'
                }`}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Começar a organizar meu escritório
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <button
                onClick={scrollToDemo}
                className="w-full sm:w-auto px-8 py-4 bg-card text-card-foreground border border-border rounded-2xl font-semibold text-lg hover:bg-accent hover:border-border transition-all duration-200 flex items-center gap-2"
              >
                Ver como funciona
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <span className="text-xs text-muted-foreground">Demonstração de 60 segundos, sem cadastro</span>
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
          <div className="text-center mb-4 sm:mb-6">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-2 sm:mb-3 leading-tight">
              Tudo que o seu escritório precisa.<br className="hidden md:block" /> Num só lugar.
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Menos abas abertas. Menos sistemas. Mais tempo para advogar.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:grid-rows-[repeat(3,auto)] md:h-auto">
            {/* Linha 1-2: CRM Jurídico (2 cols x 2 rows) + [IA (1 col, row 1) + Calculadora (1 col, row 2)] */}
            
            {/* Gestão do Escritório - Mesmo tamanho de IA e Calculadoras */}
            <div
              className={`md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02] border ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                      isDark
                        ? 'bg-slate-700 border-slate-600'
                        : 'bg-slate-100 border-slate-200'
                    }`}
                  >
                    <Users
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3
                    className={`text-base sm:text-lg font-bold tracking-tight ${
                      isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    Gestão do Escritório
                  </h3>
                </div>
                <p
                  className={`text-xs sm:text-sm leading-relaxed mb-4 sm:mb-5 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Organize rotinas, acompanhe tudo em tempo real e ganhe clareza para o próximo passo. E isso é só o começo.
                </p>
              </div>
              <div
                className={`pt-2 mt-auto border-t ${
                  isDark ? 'border-slate-700' : 'border-slate-200'
                }`}
              >
                <Link
                  to="/app/clientes"
                  onClick={handleProtectedFeatureClick}
                  className={`inline-flex items-center justify-between w-full text-xs sm:text-sm font-semibold transition-colors group-hover:translate-x-1 duration-200 ${
                    isDark
                      ? 'text-slate-300 hover:text-slate-100'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Organizar meu escritório <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Link>
              </div>
            </div>

            {/* IA Jurídica com Badge Dinâmico - Médio Destaque */}
            <div
              className={`md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02] border ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                        isDark
                          ? 'bg-slate-700 border-slate-600'
                          : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <BrainCircuit
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                          isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}
                        strokeWidth={1.5}
                      />
                    </div>
                    <h3
                      className={`text-base sm:text-lg font-bold tracking-tight truncate ${
                        isDark ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      IA Jurídica
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider rounded border flex-shrink-0 ${
                      isDark
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-green-50 text-green-700 border-green-200'
                    }`}
                  >
                    <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full animate-pulse ${isDark ? 'bg-green-400' : 'bg-green-500'}`} />
                    {availableAITools} ativas
                  </span>
                </div>
                <p
                  className={`text-xs sm:text-sm leading-relaxed mb-4 sm:mb-5 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Transforme demandas complexas em respostas objetivas em minutos. E tem muito mais para explorar.
                </p>
              </div>
              <div
                className={`pt-2 mt-auto border-t ${
                  isDark ? 'border-slate-700' : 'border-slate-200'
                }`}
              >
                <Link
                  to="/app/ia"
                  onClick={handleProtectedFeatureClick}
                  className={`inline-flex items-center justify-between w-full text-xs sm:text-sm font-semibold transition-colors group-hover:translate-x-1 duration-200 ${
                    isDark
                      ? 'text-slate-300 hover:text-slate-100'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Analisar meu primeiro documento <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Link>
              </div>
            </div>

            {/* Calculadoras - Médio Destaque */}
            <div
              className={`md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02] border ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                        isDark
                          ? 'bg-slate-700 border-slate-600'
                          : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <Calculator
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                          isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}
                        strokeWidth={1.5}
                      />
                    </div>
                    <h3
                      className={`text-base sm:text-lg font-bold tracking-tight truncate ${
                        isDark ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      Calculadoras Jurídicas
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider rounded border flex-shrink-0 ${
                      isDark
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full animate-pulse ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`} />
                    {availableCalculators} ativas
                  </span>
                </div>
                <p
                  className={`text-xs sm:text-sm leading-relaxed mb-4 sm:mb-5 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Simule cenários, compare resultados e decida com confiança. O melhor começa depois do primeiro cálculo.
                </p>
              </div>
              <div
                className={`pt-2 mt-auto border-t ${
                  isDark ? 'border-slate-700' : 'border-slate-200'
                }`}
              >
                <Link
                  to="/app/calculadoras"
                  onClick={handleProtectedFeatureClick}
                  className={`inline-flex items-center justify-between w-full text-xs sm:text-sm font-semibold transition-colors group-hover:translate-x-1 duration-200 ${
                    isDark
                      ? 'text-slate-300 hover:text-slate-100'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Fazer meu primeiro cálculo <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Link>
              </div>
            </div>

            {/* Linha 3: Blog (2 cols) + Biblioteca (1 col) - Menor Destaque */}
            
            {/* Blog + Newsletter */}
            <div
              className={`md:col-span-2 md:row-span-1 group relative overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 flex flex-col md:flex-row gap-3 sm:gap-4 md:gap-6 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.01] border ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Esquerda — Blog (apenas desktop) */}
              <div className="hidden md:flex flex-1 flex-col min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                      isDark
                        ? 'bg-slate-700 border-slate-600'
                        : 'bg-slate-100 border-slate-200'
                    }`}
                  >
                    <FileText
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3
                    className={`text-base sm:text-lg font-bold tracking-tight ${
                      isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    Blog Jurídico
                  </h3>
                </div>

                <p className={`text-xs sm:text-sm leading-relaxed mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Fique à frente. Análises e atualizações do direito direto na sua caixa de entrada.
                </p>

                {latestPost && (
                  <Link
                    to={`/blog/${latestPost.slug}`}
                    className={`flex-1 flex flex-col justify-between p-3 rounded-xl border transition-colors group/post ${
                      isDark
                        ? 'bg-slate-700/50 border-slate-600 hover:bg-slate-700'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`} />
                      <div className="min-w-0">
                        {latestPost.category && (
                          <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                            {latestPost.category}
                          </p>
                        )}
                        <p className={`text-sm font-semibold leading-snug line-clamp-2 group-hover/post:underline ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                          {latestPost.title}
                        </p>
                      </div>
                    </div>
                    <p className={`text-xs mt-2 flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Ler artigo <ArrowRight className="w-3 h-3" />
                    </p>
                  </Link>
                )}
              </div>

              {/* Divisor vertical (apenas desktop) */}
              <div className={`hidden md:block w-px self-stretch ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

              {/* Direita — Newsletter */}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 md:hidden">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                        isDark
                          ? 'bg-slate-700 border-slate-600'
                          : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <FileText
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                          isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}
                        strokeWidth={1.5}
                      />
                    </div>
                    <h3
                      className={`text-base sm:text-lg font-bold tracking-tight ${
                        isDark ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      Blog Jurídico
                    </h3>
                  </div>

                  <div className="mb-2 sm:mb-3 md:mb-4">
                    <h4 className={`text-base font-bold tracking-tight mb-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      Newsletter
                    </h4>
                    <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Atualizações do direito direto no seu e-mail.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleNewsletterSubscribe} className="w-full">
                  <label htmlFor="home-newsletter-email" className="sr-only">
                    Seu melhor e-mail
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2 mb-1.5 sm:mb-2">
                    <input
                      id="home-newsletter-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      value={newsletterEmail}
                      onChange={(e) => setNewsletterEmail(e.target.value)}
                      className={`flex-1 px-3 py-2 rounded-lg border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
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
                      className={`font-semibold py-2 px-3 rounded-lg transition-all duration-200 shadow-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed text-xs sm:text-sm ${
                        isDark
                          ? 'bg-white text-slate-900 hover:bg-slate-100'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {isNewsletterSubmitting ? 'Inscrevendo…' : 'Inscrever'}
                    </button>
                  </div>
                  <p className={`text-[10px] sm:text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Sem spam. Cancele quando quiser.
                  </p>
                </form>
              </div>
            </div>

            {/* Biblioteca Jurídica - Menor Destaque */}
            <div
              className={`md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.01] border ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-3 flex-wrap">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                        isDark
                          ? 'bg-slate-700 border-slate-600'
                          : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <BookOpen
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                          isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}
                        strokeWidth={1.5}
                      />
                    </div>
                    <h3
                      className={`text-base sm:text-lg font-bold tracking-tight ${
                        isDark ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      Biblioteca Jurídica
                    </h3>
                  </div>
                </div>
                <p
                  className={`text-xs sm:text-sm leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Não comece do zero. Modelos prontos, guias práticos e ebooks para quem assina.
                </p>
              </div>
              <div
                className={`pt-2 sm:pt-3 mt-auto border-t ${
                  isDark ? 'border-slate-700' : 'border-slate-200'
                }`}
              >
                <Link
                  to="/materiais"
                  className={`inline-flex items-center justify-between w-full text-xs sm:text-sm font-semibold transition-colors group-hover:translate-x-1 duration-200 ${
                    isDark
                      ? 'text-slate-300 hover:text-slate-100'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Ver materiais disponíveis <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-3 sm:mb-4 leading-tight">
              Em 3 telas, você entende como funciona.
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Cada módulo resolve um problema real do seu dia a dia na advocacia.
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
                  className="w-full h-full object-contain bg-background"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              </div>

              {/* Caption */}
              <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 md:p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
                <h3 className="text-base sm:text-lg md:text-xl font-bold mb-1 line-clamp-2">{screenshots[currentSlide].title}</h3>
                <p className="text-xs sm:text-sm md:text-sm text-white/90 line-clamp-2">{screenshots[currentSlide].description}</p>
              </div>

              {/* Navigation Arrows */}
              <button
                onClick={prevSlide}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-white/90 backdrop-blur-md border border-white sm:border-2 shadow-lg sm:shadow-xl flex items-center justify-center hover:bg-white hover:scale-110 transition-all group"
                aria-label="Slide anterior"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-slate-900 group-hover:scale-110 transition-transform" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-white/90 backdrop-blur-md border border-white sm:border-2 shadow-lg sm:shadow-xl flex items-center justify-center hover:bg-white hover:scale-110 transition-all group"
                aria-label="Próximo slide"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-slate-900 group-hover:scale-110 transition-transform" />
              </button>
            </div>

            {/* Slide Indicators */}
            <div className="flex justify-center gap-2 sm:gap-3 mt-4 sm:mt-6 flex-wrap">
              {screenshots.map((slide, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  aria-label={`Ir para: ${slide.title}`}
                  className={`h-6 sm:h-8 rounded-full px-2 sm:px-3 text-[10px] sm:text-xs font-semibold transition-all duration-300 whitespace-nowrap ${
                    index === currentSlide
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20'
                  }`}
                >
                  {slide.title}
                </button>
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

            <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6">
              <h2
                className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 sm:mb-4 tracking-tight leading-tight ${
                  isDark ? 'text-foreground' : 'text-white'
                }`}
              >
                O escritório que você imaginou quando entrou na advocacia.
              </h2>
              <p
                className={`text-sm sm:text-base md:text-lg mb-6 sm:mb-8 md:mb-10 leading-relaxed font-light ${
                  isDark ? 'text-muted-foreground' : 'text-slate-300'
                }`}
              >
                Comece hoje. Organize tudo ainda esta semana.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-4 sm:mb-6">
                <button
                  onClick={openRegisterModal}
                  className={`px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all transform hover:-translate-y-1 shadow-lg ${
                    isDark
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Começar a organizar meu escritório
                </button>
                <Link
                  to="/planos"
                  className={`px-6 sm:px-8 py-3 sm:py-4 bg-transparent border rounded-xl font-bold text-base sm:text-lg transition-all inline-flex items-center justify-center ${
                    isDark
                      ? 'border-slate-700 text-foreground hover:bg-slate-900/20'
                      : 'border-white text-white hover:bg-white/10'
                  }`}
                >
                  Ver Planos
                </Link>
              </div>

              <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-muted-foreground' : 'text-slate-400'}`}>
                Sem cartão de crédito • Cancelamento a qualquer momento
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
