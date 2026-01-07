'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Brain,
  Calculator,
  FileText,
  ArrowRight,
  ChevronDown,
  Search,
  Clock,
  BrainCircuit,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { LoginModal } from '@/features/auth/components/login-modal'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { toast } from 'sonner'

export function HomePage() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [loginModalView, setLoginModalView] = useState<'login' | 'register'>('login')
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [isNewsletterSubmitting, setIsNewsletterSubmitting] = useState(false)

  const featuresRef = useRef<HTMLElement>(null)
  const demoRef = useRef<HTMLElement>(null)

  const handleLoginClick = () => {
    setLoginModalView('login')
    setIsLoginModalOpen(true)
  }

  const handleRegisterClick = () => {
    setLoginModalView('register')
    setIsLoginModalOpen(true)
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
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      <Header onLoginClick={handleLoginClick} />

      <main>
        {/* Hero Section - Full Height */}
        <section className="relative min-h-screen flex flex-col justify-center pt-20 overflow-hidden">
          {/* Background Elements */}
          <div className="absolute inset-0 z-0">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-gray-100 to-transparent rounded-full blur-3xl opacity-60" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex-grow flex flex-col justify-center">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 mb-8 leading-[1.1]">
              A evolução natural <br className="hidden md:block" />
              do seu{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900">
                escritório jurídico
              </span>
              .
            </h1>

            <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-12 leading-relaxed">
              Elimine o trabalho repetitivo com nossa IA. Crie petições, realize cálculos
              complexos e mantenha-se atualizado em uma única interface moderna.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleRegisterClick}
                className="group relative px-8 py-4 bg-gray-900 text-white rounded-2xl font-semibold text-lg hover:bg-gray-800 transition-all duration-200 shadow-xl shadow-gray-900/10 hover:-translate-y-1 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Começar Gratuitamente
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <button
                onClick={scrollToDemo}
                className="px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-2xl font-semibold text-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
              >
                Ver Demonstração
              </button>
            </div>

            {/* Floating UI Preview - Smaller but visible */}
            <div className="mt-16 relative max-w-4xl mx-auto hidden md:block">
              <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden aspect-[21/9] transform scale-95 opacity-80 hover:opacity-100 hover:scale-100 transition-all duration-500">
                <div className="absolute inset-0 bg-gray-50/50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-3 animate-bounce">
                      <Brain className="w-6 h-6 text-gray-900" />
                    </div>
                    <p className="text-gray-400 font-medium text-sm">Interface do Sistema</p>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-gray-50 via-transparent to-transparent" />
              </div>
            </div>
          </div>

          {/* Scroll Down Arrow */}
          <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce cursor-pointer z-20"
            onClick={scrollToFeatures}
          >
            <ChevronDown className="w-8 h-8 text-gray-400 hover:text-gray-900 transition-colors" />
          </div>
        </section>

        {/* Bento Grid Features */}
        <section
          ref={featuresRef}
          className="min-h-[calc(100vh-5rem)] flex flex-col justify-center py-12 lg:py-16 bg-white relative z-10"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Poder concentrado.
              </h2>
              <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                Todas as ferramentas que você precisa para elevar o nível da sua advocacia.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[280px]">
              {/* Card 1: IA (Large) */}
              <div className="md:col-span-2 md:row-span-1 group relative overflow-hidden rounded-3xl bg-gray-900 p-8 flex flex-col justify-between transition-all duration-500 hover:shadow-2xl shadow-xl hover:scale-[1.02] border border-gray-800">
                {/* Background with Hover Gradient Reveal */}
                <div className="absolute inset-0 bg-gray-900 z-0 transition-opacity duration-500 group-hover:opacity-0" />
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-[#1e1b4b] to-gray-900 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Subtle Glow Effects on Hover */}
                <div className="absolute -right-20 -top-20 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-start">
                  <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center flex-shrink-0 border border-gray-700 group-hover:border-indigo-500/30 group-hover:bg-indigo-900/20 transition-all duration-500">
                    <BrainCircuit
                      className="w-7 h-7 text-gray-300 group-hover:text-indigo-300 transition-colors duration-300"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-2 tracking-tight text-white group-hover:text-indigo-50 transition-colors duration-300">
                      IA Jurídica Avançada
                    </h3>
                    <p className="text-gray-400 text-base max-w-lg leading-relaxed font-light group-hover:text-gray-300 transition-colors duration-300">
                      Gere petições fundamentadas, analise contratos e obtenha insights estratégicos
                      em segundos.
                    </p>
                  </div>
                </div>

                <Link
                  href="/ia-juridica"
                  className="relative z-10 mt-6 md:mt-0 inline-flex items-center gap-2 text-gray-300 font-medium hover:gap-3 transition-all self-start pt-6 border-t border-gray-800 w-full group-hover:border-indigo-500/20 group-hover:text-white"
                >
                  <span className="transition-colors">Explorar IA</span>{' '}
                  <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-indigo-300 transition-colors" />
                </Link>
              </div>

              {/* Card 2: Calculators */}
              <div className="group relative overflow-hidden rounded-3xl bg-white border border-gray-200 p-8 flex flex-col justify-between hover:border-gray-300 transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02]">
                <div>
                  <div className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center mb-6">
                    <Calculator className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 tracking-tight">
                    Calculadoras
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    Trabalhista e previdenciário com atualização automática.
                  </p>
                </div>
                <div className="pt-6 border-t border-gray-100">
                  <Link
                    href="/calculadoras"
                    className="inline-flex items-center justify-between w-full text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors group-hover:translate-x-1 duration-200"
                  >
                    Acessar <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Card 3: Tracking (New) */}
              <div className="group relative overflow-hidden rounded-3xl bg-gray-50 border border-gray-200 p-8 flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02]">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center">
                      <Search className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
                    </div>
                    <span className="px-2.5 py-1 bg-gray-200/50 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-gray-200">
                      Em Breve
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-500 mb-2 tracking-tight">Processos</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Monitoramento automático com notificações em tempo real.
                  </p>
                </div>
                <div className="pt-6 border-t border-gray-200/50">
                  <button
                    disabled
                    className="inline-flex items-center justify-between w-full text-sm font-semibold text-gray-400 cursor-not-allowed"
                  >
                    Aguarde <Clock className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Card 4: Blog/Updates (Wide) */}
              <div className="md:col-span-2 group relative overflow-hidden rounded-3xl bg-white border border-gray-200 p-8 flex flex-col hover:border-gray-300 transition-all duration-300 shadow-md hover:shadow-xl hover:scale-[1.02] h-full">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 flex-1">
                  <div className="flex items-start gap-6 w-full">
                    <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1 tracking-tight">
                        Blog Jurídico
                      </h3>
                      <p className="text-gray-500 text-sm leading-relaxed">
                        Notícias do meio jurídico e análises aprofundadas sobre legislação.
                      </p>
                    </div>
                  </div>

                  <div className="w-full md:w-auto pt-6 md:pt-0 md:pl-8 md:border-l border-gray-100 border-t md:border-t-0">
                    <Link
                      href="/blog"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors whitespace-nowrap group-hover:translate-x-1 duration-200"
                    >
                      Ler Notícias <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-100 w-full">
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
                        className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition-all"
                        disabled={isNewsletterSubmitting}
                        required
                      />
                      <button
                        type="submit"
                        disabled={isNewsletterSubmitting}
                        className="bg-gray-900 text-white hover:bg-gray-800 font-semibold py-2.5 px-4 rounded-xl transition-all duration-200 shadow-md whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                      >
                        {isNewsletterSubmitting ? 'Inscrevendo…' : 'Inscrever-se'}
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-gray-400">
                      Ao se inscrever, você concorda em receber e-mails.
                    </p>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Demo Section - Video */}
        <section
          ref={demoRef}
          className="min-h-[calc(100vh-5rem)] flex flex-col justify-center py-12 lg:py-16 bg-gray-50 relative overflow-hidden"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Veja em ação.
              </h2>
              <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                Descubra como nossa plataforma transforma a rotina do seu escritório em poucos
                cliques.
              </p>
            </div>

            <div className="relative max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl border border-gray-200 bg-gray-900 aspect-video group">
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/30 transition-colors cursor-pointer">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 transition-transform group-hover:scale-110">
                  <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[24px] border-l-white border-b-[12px] border-b-transparent ml-2" />
                </div>
              </div>
              {/* Placeholder para o vídeo - substituir src pelo vídeo real */}
              <Image
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
                alt="Demonstração da Plataforma"
                fill
                sizes="(max-width: 1024px) 100vw, 80vw"
                className="object-cover opacity-80"
              />
            </div>
          </div>

          {/* Background Elements for Demo Section */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 -left-64 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 -right-64 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
          </div>
        </section>

        {/* CTA Section - Distinct & Modern */}
        <section className="py-24 bg-white relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="bg-gray-900 rounded-[2.5rem] p-8 md:p-16 text-center relative overflow-hidden shadow-2xl">
              {/* Background Effects - Subtle */}
              <div className="absolute inset-0">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gray-800/30 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gray-800/30 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
              </div>

              <div className="relative z-10 max-w-3xl mx-auto">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
                  Pronto para o próximo nível?
                </h2>
                <p className="text-lg text-gray-400 mb-10 leading-relaxed font-light">
                  Junte-se a milhares de advogados que já estão economizando tempo e aumentando sua
                  produtividade com a Processa AI.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={handleRegisterClick}
                    className="px-8 py-4 bg-white text-gray-900 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all transform hover:-translate-y-1 shadow-lg"
                  >
                    Criar Conta Gratuita
                  </button>
                  <Link
                    href="/planos"
                    className="px-8 py-4 bg-transparent border border-gray-700 text-white rounded-xl font-bold text-lg hover:bg-gray-800 hover:border-gray-600 transition-all inline-flex items-center justify-center"
                  >
                    Ver Planos
                  </Link>
                </div>

                <p className="mt-8 text-sm text-gray-500">
                  Sem cartão de crédito • Cancelamento a qualquer momento
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        initialView={loginModalView}
      />
    </div>
  )
}
