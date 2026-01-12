'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Star, Crown, Zap, Users, GraduationCap, ChevronDown } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { LoginModal } from '@/features/auth/components/login-modal'
import { fetchWithCredentials } from '@/lib/fetch'

type ApiPlanPrice = {
  currency: string
  amount_cents: number
  interval: string
}

type ApiPlan = {
  slug: string
  name: string
  description: string | null
  is_popular: boolean
  is_sellable: boolean
  sort_order: number
  price: ApiPlanPrice | null
  features: string[]
}

const faqs = [
  {
    question: 'Posso cancelar a qualquer momento?',
    answer:
      'Sim. Você pode cancelar quando quiser e continua com acesso até o fim do ciclo vigente.',
  },
  {
    question: 'Existe fidelidade ou multa?',
    answer: 'Não. Não há fidelidade e não cobramos multa por cancelamento.',
  },
  {
    question: 'Posso trocar de plano depois?',
    answer:
      'Sim. Você pode fazer upgrade ou downgrade a qualquer momento. Ajustes de cobrança seguem as regras do provedor de pagamento.',
  },
  {
    question: 'Quais formas de pagamento são aceitas?',
    answer: 'Cartão de crédito e outras opções conforme disponibilidade no checkout.',
  },
  {
    question: 'O plano Estudante exige comprovação?',
    answer:
      'No lançamento, podemos solicitar comprovação simples (ex.: e-mail institucional) para ativação ou renovação do desconto.',
  },
  {
    question: 'Como funciona o limite da IA?',
    answer:
      'Cada plano tem um limite mensal de uso. Ao atingir o limite, você pode aguardar a renovação ou fazer upgrade.',
  },
]

export default function PlanosPage() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)
  const [apiPlans, setApiPlans] = useState<ApiPlan[] | null>(null)

  useEffect(() => {
    let didCancel = false

    const loadPlans = async () => {
      try {
        const res = await fetchWithCredentials('/api/plans', { method: 'GET' })
        if (!res.ok) {
          throw new Error('Falha ao carregar planos')
        }
        const data = (await res.json()) as ApiPlan[]
        if (!didCancel) setApiPlans(Array.isArray(data) ? data : [])
      } catch {
        if (!didCancel) setApiPlans([])
      }
    }

    loadPlans()

    return () => {
      didCancel = true
    }
  }, [])

  const plans = useMemo(() => {
    const iconBySlug: Record<string, typeof Users> = {
      basico: Users,
      estudante: GraduationCap,
      autonomo: Zap,
      escritorio: Crown,
    }

    const formatMoney = (currency: string, amountCents: number) => {
      const value = Number.isFinite(amountCents) ? amountCents / 100 : 0
      try {
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: currency || 'BRL',
        }).format(value)
      } catch {
        return `R$ ${value.toFixed(2)}`.replace('.', ',')
      }
    }

    const normalize = (p: ApiPlan) => {
      const isComingSoon = !p.is_sellable
      const amountCents = p.price?.amount_cents ?? 0
      const currency = p.price?.currency ?? 'BRL'
      const interval = p.price?.interval

      const priceLabel = isComingSoon
        ? 'Em breve'
        : amountCents === 0
          ? 'Gratuito'
          : formatMoney(currency, amountCents)

      const periodLabel = isComingSoon
        ? ''
        : amountCents === 0
          ? ''
          : interval === 'year'
            ? '/ano'
            : '/mês'

      const buttonText = isComingSoon
        ? 'Em breve'
        : amountCents === 0
          ? 'Começar Grátis'
          : `Assinar ${p.name}`

      return {
        name: p.name,
        price: priceLabel,
        period: periodLabel,
        description: p.description || '',
        features: p.features || [],
        buttonText,
        popular: !!p.is_popular,
        icon: iconBySlug[p.slug] || Users,
        comingSoon: isComingSoon,
        sortOrder: p.sort_order ?? 0,
      }
    }

    return (apiPlans || []).map(normalize).sort((a, b) => a.sortOrder - b.sortOrder)
  }, [apiPlans])

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-slate-700 selection:text-white flex flex-col">
      <Header onLoginClick={() => setIsLoginModalOpen(true)} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 overflow-hidden">
          {/* Background Elements */}
          <div className="absolute inset-0 z-0">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-[var(--hero-glow-opacity)]" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6 mt-8">
                Escolha o Plano Ideal
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Ferramentas jurídicas inteligentes para impulsionar sua prática profissional
              </p>
            </div>
          </div>
        </section>

        {/* Pricing Plans */}
        <section className="py-4 pb-12 relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {apiPlans === null ? (
              <div className="text-center text-sm text-muted-foreground py-10">Carregando planos...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                {plans.map((plan, index) => {
                const IconComponent = plan.icon
                const isComingSoon = (plan as { comingSoon?: boolean }).comingSoon === true
                return (
                  <div
                    key={index}
                    className={`relative bg-card rounded-2xl p-5 flex flex-col transition-all duration-300 ${
                      plan.popular
                        ? 'shadow-2xl ring-2 ring-primary z-10'
                        : 'shadow-xl border border-border'
                    } ${
                      isComingSoon
                        ? 'opacity-90'
                        : 'hover:scale-[1.02] hover:shadow-2xl hover:border-muted-foreground/50'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <div className="bg-slate-900 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg flex items-center tracking-wide">
                          <Star className="w-3 h-3 mr-1.5 fill-current" />
                          MAIS POPULAR
                        </div>
                      </div>
                    )}

                    {isComingSoon && (
                      <div className="absolute top-4 right-4 z-20">
                        <div className="bg-slate-900 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg tracking-wide">
                          EM BREVE
                        </div>
                      </div>
                    )}

                    <div className={isComingSoon ? 'blur-[2px] opacity-60' : ''}>
                      <div className="mb-4">
                      <div
                        className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 ${
                          plan.popular
                            ? 'bg-slate-900 text-white'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        <IconComponent className="w-5 h-5" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">
                        {plan.name}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{plan.description}</p>
                      </div>

                      <div className="flex items-baseline mb-4">
                      <span className="text-3xl font-bold text-foreground tracking-tight">
                        {plan.price}
                      </span>
                      <span className="text-muted-foreground ml-1.5 text-sm font-medium">
                        {plan.period}
                      </span>
                      </div>

                      <ul className="space-y-2.5 mb-4 flex-grow">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center mr-2.5 mt-0.5">
                            <Check className="w-3 h-3 text-[hsl(var(--success-strong))]" strokeWidth={3} />
                          </div>
                          <span className="text-muted-foreground text-sm font-medium leading-relaxed">
                            {feature}
                          </span>
                        </li>
                      ))}
                      </ul>

                      <div className="mt-auto">
                        <button
                          onClick={() => {
                            if (isComingSoon) return
                            setIsLoginModalOpen(true)
                          }}
                          disabled={isComingSoon}
                          className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 transform ${
                            isComingSoon
                              ? 'bg-muted text-muted-foreground cursor-not-allowed border-2 border-border'
                              : plan.popular
                                ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                                : 'bg-card text-foreground border-2 border-border hover:border-primary hover:bg-muted hover:-translate-y-0.5'
                          }`}
                        >
                          {plan.buttonText}
                        </button>
                      </div>
                    </div>
                  </div>
                )
                })}
              </div>
            )}
          </div>
        </section>

        <section className="pb-24 relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-card rounded-[2rem] shadow-xl border border-border p-8 md:p-12">
              <div className="text-center max-w-3xl mx-auto">
                <h2 className="text-3xl font-bold text-foreground mb-3 tracking-tight">
                  Perguntas frequentes
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed">
                  Dúvidas comuns sobre cobrança, cancelamento e elegibilidade.
                </p>
              </div>

              <div className="mt-10 space-y-4">
                {faqs.map((item, index) => {
                  const isOpen = openFaqIndex === index
                  return (
                    <div
                      key={index}
                      className="rounded-xl border border-border bg-muted/30 hover:bg-muted/40 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex((current) => (current === index ? null : index))}
                        className="w-full flex items-center justify-between gap-4 p-5 text-left"
                        aria-expanded={isOpen}
                        aria-controls={`faq-${index}`}
                      >
                        <span className="font-semibold text-foreground text-sm md:text-base">
                          {item.question}
                        </span>
                        <ChevronDown
                          className={`h-5 w-5 text-muted-foreground transition-transform ${
                            isOpen ? 'rotate-180' : 'rotate-0'
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div id={`faq-${index}`} className="px-5 pb-5 -mt-2">
                          <p className="text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        initialView="register"
      />
    </div>
  )
}
