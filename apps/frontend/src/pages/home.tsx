import { useRef, useState, useMemo, useEffect } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
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
import { fetchAiTools } from '@/features/ai/api'
import type { AiTool } from '@/features/ai/types'

export default function HomePage() {
  const { openRegisterModal } = useOutletContext<RootLayoutOutletContext>()
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [isNewsletterSubmitting, setIsNewsletterSubmitting] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [aiTools, setAiTools] = useState<AiTool[]>([])
  const [latestPost, setLatestPost] = useState<{ title: string; slug: string; category?: string } | null>(null)

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Fetch AI tools from backend on mount
  useEffect(() => {
    fetchAiTools().then((tools) => setAiTools(tools))
  }, [])

  // Fetch latest blog post for social proof on Blog card
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

  const featuresRef = useRef<HTMLElement>(null)
  const demoRef = useRef<HTMLElement>(null)

  const screenshots = [
    {
      title: 'Gestão do Escritório',
      description: 'Clientes, processos e prazos organizados em um só painel',
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop',
    },
    {
      title: 'Gestão de Clientes',
      description: 'Busca avançada, filtros e organização completa da carteira',
      image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop',
    },
    {
      title: 'IA Jurídica',
      description: 'Análise de CNIS, resumo de processos e extração de documentos',
      image: 'https://images.unsplash.com/photo-1555421689-d68471e189f2?q=80&w=2070&auto=format&fit=crop',
    },
    {
      title: 'Calculadoras',
      description: 'Cálculos trabalhistas e previdenciários com índices atualizados',
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

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Processos sob controle. Cálculos automáticos. IA treinada para o direito brasileiro.
            Tudo no mesmo lugar.
          </p>

          <div className="flex flex-col items-center gap-3 mb-10">
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
                  Começar a organizar meu escritório
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <button
                onClick={scrollToDemo}
                className="px-8 py-4 bg-card text-card-foreground border border-border rounded-2xl font-semibold text-lg hover:bg-accent hover:border-border transition-all duration-200 flex items-center gap-2"
              >
                Ver como funciona
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <span className="text-xs text-muted-foreground">Demonstração de 60 segundos, sem cadastro</span>
          </div>

          {/* Prova social */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex -space-x-2">
              {[
                { initials: 'AM', color: isDark ? 'bg-blue-800 text-blue-200' : 'bg-blue-100 text-blue-700' },
                { initials: 'RS', color: isDark ? 'bg-violet-800 text-violet-200' : 'bg-violet-100 text-violet-700' },
                { initials: 'CT', color: isDark ? 'bg-emerald-800 text-emerald-200' : 'bg-emerald-100 text-emerald-700' },
                { initials: 'JP', color: isDark ? 'bg-amber-800 text-amber-200' : 'bg-amber-100 text-amber-700' },
                { initials: 'LF', color: isDark ? 'bg-rose-800 text-rose-200' : 'bg-rose-100 text-rose-700' },
              ].map((avatar) => (
                <div
                  key={avatar.initials}
                  className={`w-8 h-8 rounded-full border-2 ${isDark ? 'border-background' : 'border-white'} flex items-center justify-center text-[10px] font-bold ${avatar.color}`}
                >
                  {avatar.initials}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Mais de <span className="font-semibold text-foreground">2.000 advogados</span> já usam a Processa AI
            </p>
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
              Tudo que o seu escritório precisa.<br className="hidden md:block" /> Num só lugar.
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Menos abas abertas. Menos sistemas. Mais tempo para advogar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:grid-rows-[repeat(3,220px)]">
            {/* Linha 1-2: CRM Jurídico (2 cols x 2 rows) + [IA (1 col, row 1) + Calculadora (1 col, row 2)] */}
            
            {/* CRM Jurídico - Card Grande (Destaque Principal) */}
            <div
              className={`md:col-span-2 md:row-span-2 group relative overflow-hidden rounded-3xl p-6 flex flex-col justify-between transition-all duration-500 hover:shadow-2xl shadow-xl hover:scale-[1.02] border ${
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
                    Gestão do Escritório
                  </h3>
                </div>
                <p
                  className={`text-base leading-relaxed font-light transition-colors duration-300 ${
                    isDark
                      ? 'text-slate-600 group-hover:text-slate-700'
                      : 'text-[#94a3b8] group-hover:text-[#cbd5e1]'
                  }`}
                >
                  Chega de post-it e planilha. Cada cliente, processo e prazo em um só lugar,
                  sem deixar nada cair.
                </p>

                {/* Momento de imaginação — aparece no hover */}
                <div className="mt-5 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[
                      { label: 'Clientes ativos', value: '47' },
                      { label: 'Processos', value: '128' },
                      { label: 'Prazos hoje', value: '3', urgent: true },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className={`rounded-xl p-3 border ${
                          isDark ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <p className={`text-xl font-bold tracking-tight ${stat.urgent ? 'text-red-500' : isDark ? 'text-slate-900' : 'text-white'}`}>
                          {stat.value}
                        </p>
                        <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Honorários a receber', value: 'R$ 18.400' },
                      { label: 'Recebido este mês', value: 'R$ 9.200' },
                      { label: 'Audiências na semana', value: '6' },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className={`rounded-xl p-3 border ${
                          isDark ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <p className={`text-sm font-bold tracking-tight ${isDark ? 'text-slate-900' : 'text-white'}`}>
                          {stat.value}
                        </p>
                        <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Mini gráfico de barras — novos processos por mês */}
                  <div className="mt-3">
                    <p className={`text-[10px] mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Novos processos (últimos 6 meses)
                    </p>
                    <div className="flex items-end gap-1 h-10">
                      {[
                        { mes: 'Out', v: 55 },
                        { mes: 'Nov', v: 70 },
                        { mes: 'Dez', v: 48 },
                        { mes: 'Jan', v: 80 },
                        { mes: 'Fev', v: 65 },
                        { mes: 'Mar', v: 100 },
                      ].map((d, i, arr) => (
                        <div key={d.mes} className="flex flex-col items-center gap-0.5 flex-1">
                          <div
                            className={`w-full rounded-sm transition-all duration-300 ${
                              i === arr.length - 1
                                ? 'bg-blue-500'
                                : isDark ? 'bg-slate-300' : 'bg-white/20'
                            }`}
                            style={{ height: `${(d.v / 100) * 32}px` }}
                          />
                          <span className={`text-[9px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{d.mes}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Link
                to="/app/clientes"
                className={`relative z-10 inline-flex items-center gap-2 font-medium hover:gap-3 transition-all self-start pt-3 border-t w-full group-hover:border-blue-500/20 ${
                  isDark
                    ? 'text-slate-700 border-slate-200 group-hover:text-slate-900'
                    : 'text-[#cbd5e1] border-[#1e293b] group-hover:text-white'
                }`}
              >
                <span className="transition-colors">Organizar meu escritório</span>{' '}
                <ArrowRight
                  className={`w-4 h-4 transition-colors ${
                    isDark
                      ? 'text-slate-500 group-hover:text-slate-700'
                      : 'text-[#64748b] group-hover:text-slate-300'
                  }`}
                />
              </Link>
            </div>

            {/* IA Jurídica com Badge Dinâmico - Médio Destaque */}
            <div
              className={`md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02] border ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                        isDark
                          ? 'bg-slate-700 border-slate-600'
                          : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <BrainCircuit
                        className={`w-4 h-4 ${
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
                      IA Jurídica
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border flex-shrink-0 ${
                      isDark
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-green-50 text-green-700 border-green-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-green-400' : 'bg-green-500'}`} />
                    {availableAITools} ferramentas ativas
                  </span>
                </div>
                <p
                  className={`text-base leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Analise CNIS, resuma processos e extraia o essencial de documentos. IA treinada para o direito brasileiro.
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
                  Analisar meu primeiro documento <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Calculadoras - Médio Destaque */}
            <div
              className={`md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02] border ${
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
                    className={`text-lg font-bold tracking-tight ${
                      isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    Calculadoras Jurídicas
                  </h3>
                </div>
                <p
                  className={`text-base leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Números certos na hora certa. Trabalhista e previdenciário com índices sempre atualizados.
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
                  Fazer meu primeiro cálculo <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Linha 3: Blog (2 cols) + Biblioteca (1 col) - Menor Destaque */}
            
            {/* Blog + Newsletter */}
            <div
              className={`md:col-span-2 md:row-span-1 group relative overflow-hidden rounded-3xl p-5 flex flex-col md:flex-row gap-4 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.01] border ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Esquerda — Blog */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                      isDark
                        ? 'bg-slate-700 border-slate-600'
                        : 'bg-slate-100 border-slate-200'
                    }`}
                  >
                    <FileText
                      className={`w-4 h-4 ${
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
                    Blog Jurídico
                  </h3>
                </div>

                <p className={`text-sm leading-relaxed mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
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

              {/* Divisor vertical */}
              <div className={`hidden md:block w-px self-stretch ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

              {/* Direita — Newsletter */}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div className="mb-3">
                  <h4 className={`text-base font-bold tracking-tight mb-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    Newsletter
                  </h4>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Atualizações do direito direto no seu e-mail.
                  </p>
                </div>
                <form onSubmit={handleNewsletterSubscribe} className="w-full">
                  <label htmlFor="home-newsletter-email" className="sr-only">
                    Seu melhor e-mail
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      id="home-newsletter-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
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
                      className={`font-semibold py-2 px-3 rounded-lg transition-all duration-200 shadow-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed text-sm ${
                        isDark
                          ? 'bg-white text-slate-900 hover:bg-slate-100'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {isNewsletterSubmitting ? 'Inscrevendo…' : 'Inscrever'}
                    </button>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Sem spam. Cancele quando quiser.
                  </p>
                </form>
              </div>
            </div>

            {/* Biblioteca Jurídica - Menor Destaque */}
            <div
              className={`md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.01] border ${
                isDark
                  ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
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
                      className={`text-lg font-bold tracking-tight ${
                        isDark ? 'text-slate-100' : 'text-slate-900'
                      }`}
                    >
                      Biblioteca Jurídica
                    </h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border flex-shrink-0 ${
                      isDark
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    Só assinantes
                  </span>
                </div>
                <p
                  className={`text-base leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Não comece do zero. Modelos prontos, guias práticos e ebooks para quem assina.
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
                  Ver materiais disponíveis <ArrowRight className="w-4 h-4" />
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
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Em 4 telas, você entende como funciona.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
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

            {/* Slide Indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {screenshots.map((slide, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  aria-label={`Ir para: ${slide.title}`}
                  className={`h-8 rounded-full px-3 text-xs font-semibold transition-all duration-300 whitespace-nowrap ${
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

            <div className="relative z-10 max-w-3xl mx-auto">
              <h2
                className={`text-3xl md:text-5xl font-bold mb-4 tracking-tight ${
                  isDark ? 'text-foreground' : 'text-white'
                }`}
              >
                O escritório que você imaginou quando entrou na advocacia.
              </h2>
              <p
                className={`text-lg mb-10 leading-relaxed font-light ${
                  isDark ? 'text-muted-foreground' : 'text-slate-300'
                }`}
              >
                Comece hoje. Organize tudo ainda esta semana.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                <button
                  onClick={openRegisterModal}
                  className={`px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:-translate-y-1 shadow-lg ${
                    isDark
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Começar a organizar meu escritório
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

              <p className={`text-sm font-medium ${isDark ? 'text-muted-foreground' : 'text-slate-400'}`}>
                Sem cartão de crédito • Cancelamento a qualquer momento
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
