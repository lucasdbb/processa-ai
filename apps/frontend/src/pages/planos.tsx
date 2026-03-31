import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Check, ChevronDown, Crown, GraduationCap, Loader2, Star, Users, Zap } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { billingService } from '@/services/billing-service'
import { fetchPlans, plansQueryKey } from '@/services/plans-service'
import { useUser } from '@/features/auth/hooks/use-user'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'
import type { ApiPlan } from '@/services/plans-service'

const faqs = [
  {
    question: 'Posso cancelar a qualquer momento?',
    answer: 'Sim. Você pode cancelar quando quiser e continua com acesso até o fim do ciclo vigente.',
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
      'Não, apenas não inclui as funcionalidades de Gestão.',
  },
  {
    question: 'Como funciona o limite da IA?',
    answer:
      'A plataforma é baseada em créditos, cada utilização consome créditos para utilização. Você pode monitorar seu consumo e adquirir créditos extras conforme necessário.',
  },
  {
    question: 'Os créditos expiram ou acumulam?',
    answer:
      'Existem dois tipos de créditos: os inclusos na assinatura, que são renovados mensalmente (não acumulam), e os créditos extras adquiridos separadamente, que nunca expiram e podem ser usados a qualquer momento.',
  },
]

export default function PlanosPage() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { openRegisterModal } = useOutletContext<RootLayoutOutletContext>()
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0)
  const plansCarouselRef = useRef<HTMLDivElement | null>(null)

  const { data: apiPlans = [], isLoading: isLoadingPlans } = useQuery<ApiPlan[]>({
    queryKey: plansQueryKey,
    queryFn: fetchPlans,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  })

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
      const stripePriceId = p.price?.stripe_price_id

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
          ? 'Começar a usar agora'
          : `Quero o ${p.name}`

      return {
        slug: p.slug,
        name: p.name,
        price: priceLabel,
        period: periodLabel,
        description: p.description || '',
        features: p.features || [],
        buttonText,
        popular: !!p.is_popular,
        icon: iconBySlug[p.slug] || Users,
        comingSoon: isComingSoon,
        isHidden: !p.is_visible,
        sortOrder: p.sort_order ?? 0,
        stripePriceId: stripePriceId || null,
        isFree: amountCents === 0,
      }
    }

    return apiPlans.map(normalize).sort((a, b) => a.sortOrder - b.sortOrder)
  }, [apiPlans])

  useEffect(() => {
    if (!plans.length) {
      setCurrentPlanIndex(0)
      return
    }

    const popularIndex = plans.findIndex((plan) => plan.popular && !plan.isHidden)
    setCurrentPlanIndex(popularIndex >= 0 ? popularIndex : 0)
  }, [plans])

  useEffect(() => {
    const container = plansCarouselRef.current
    if (!container || plans.length === 0) return

    const updateFocusedCard = () => {
      const containerRect = container.getBoundingClientRect()
      const containerCenter = containerRect.left + containerRect.width / 2
      const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-plan-index]'))

      if (cards.length === 0) return

      let closestIdx = 0
      let closestDistance = Number.POSITIVE_INFINITY

      cards.forEach((card, idx) => {
        const rect = card.getBoundingClientRect()
        const cardCenter = rect.left + rect.width / 2
        const distance = Math.abs(cardCenter - containerCenter)

        if (distance < closestDistance) {
          closestDistance = distance
          closestIdx = idx
        }
      })

      setCurrentPlanIndex((prev) => (prev === closestIdx ? prev : closestIdx))
    }

    updateFocusedCard()

    container.addEventListener('scroll', updateFocusedCard, { passive: true })
    window.addEventListener('resize', updateFocusedCard)

    return () => {
      container.removeEventListener('scroll', updateFocusedCard)
      window.removeEventListener('resize', updateFocusedCard)
    }
  }, [plans.length])

  type Plan = (typeof plans)[number]

  const handlePlanClick = async (plan: Plan) => {
    if (plan.comingSoon) return

    // Se não estiver logado, abrir modal de registro
    if (!user) {
      openRegisterModal()
      return
    }

    // Se for plano gratuito, redirecionar para o app
    if (plan.isFree) {
      navigate('/app')
      return
    }

    // Se não tiver stripe_price_id, mostrar erro
    if (!plan.stripePriceId) {
      toast.error('Este plano não está disponível no momento.')
      return
    }

    setLoadingPlan(plan.slug)

    try {
      const successUrl = `${window.location.origin}/app?subscription=success`
      const cancelUrl = `${window.location.origin}/planos?subscription=canceled`

      const { checkout_url } = await billingService.createCheckout({
        price_id: plan.stripePriceId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      })

      // Redirecionar para o Stripe Checkout
      window.location.assign(checkout_url)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao iniciar checkout. Tente novamente.'
      toast.error(message)
      setLoadingPlan(null)
    }
  }

  return (
    <div className="pt-24">
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-muted to-transparent rounded-full blur-3xl opacity-[var(--hero-glow-opacity)]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-3 sm:mb-4">
              Invista no seu escritório.
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
              Menos retrabalho. Mais advocacia. Escolha como quer crescer.
            </p>
          </div>
        </div>
      </section>

      <section className="py-2 sm:py-4 pb-10 sm:pb-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isLoadingPlans ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando planos...</div>
          ) : (
            <>
              <div
                ref={plansCarouselRef}
                className="flex sm:flex-wrap justify-start sm:justify-center gap-4 sm:gap-6 w-full max-w-[1360px] mx-auto overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none px-1 sm:px-0 pt-5 pb-4 sm:py-0"
              >
                {plans.map((plan, index) => {
                  const IconComponent = plan.icon
                  const isComingSoon = (plan as { comingSoon?: boolean }).comingSoon === true
                  const isHidden = (plan as { isHidden?: boolean }).isHidden === true
                  return (
                    <div
                      key={index}
                      data-plan-index={index}
                      className={`relative snap-center shrink-0 w-[84vw] max-w-[320px] sm:w-full bg-card rounded-xl sm:rounded-2xl p-4 sm:p-5 ${plan.popular ? 'pt-7 sm:pt-5' : ''} flex flex-col transition-all duration-300 ${
                        plan.popular ? 'shadow-2xl ring-2 ring-primary z-10' : 'shadow-xl border border-border'
                      } ${
                        isComingSoon || isHidden
                          ? 'opacity-90'
                          : 'hover:scale-[1.01] hover:shadow-2xl hover:border-muted-foreground/50'
                      } ${
                        isHidden ? 'blur-[4px] pointer-events-none' : ''
                      } ${
                        currentPlanIndex === index ? 'scale-100 opacity-100' : 'scale-[0.96] opacity-80 sm:scale-100 sm:opacity-100'
                      }`}
                    >
                    {plan.popular ? (
                      <div className="absolute top-2 sm:-top-3 left-1/2 transform -translate-x-1/2">
                        <div className="bg-slate-900 text-white px-3 sm:px-4 py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-lg flex items-center tracking-wide whitespace-nowrap">
                          <Star className="w-3 h-3 mr-1 sm:mr-1.5 fill-current" />
                          MAIS POPULAR
                        </div>
                      </div>
                    ) : null}

                    {isComingSoon ? (
                      <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-20">
                        <div className="bg-slate-900 text-white px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-lg tracking-wide">
                          EM BREVE
                        </div>
                      </div>
                    ) : null}

                    <div className={`${isComingSoon ? 'blur-[2px] opacity-60' : ''} flex flex-col flex-1`}>
                      <div className="mb-3 sm:mb-4 flex-shrink-0">
                        <div
                          className={`inline-flex items-center justify-center w-9 sm:w-10 h-9 sm:h-10 rounded-lg sm:rounded-xl mb-2 sm:mb-3 ${
                            plan.popular ? 'bg-slate-900 text-white' : 'bg-muted text-foreground'
                          }`}
                        >
                          <IconComponent className="w-4 sm:w-5 h-4 sm:h-5" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1.5 sm:mb-2 tracking-tight">{plan.name}</h3>
                        <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{plan.description}</p>
                      </div>

                      <div className="flex items-baseline mb-3 sm:mb-4 flex-shrink-0">
                        <span className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{plan.price}</span>
                        <span className="text-muted-foreground ml-1.5 text-xs sm:text-sm font-medium">{plan.period}</span>
                      </div>

                      <ul className="space-y-2 sm:space-y-2.5 mb-5 sm:mb-6 flex-1">
                        {plan.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start">
                            <div className="flex-shrink-0 w-4 sm:w-5 h-4 sm:h-5 rounded-full bg-green-500/10 flex items-center justify-center mr-2 sm:mr-2.5 mt-0.5">
                              <Check
                                className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-[hsl(var(--success-strong))]"
                                strokeWidth={3}
                              />
                            </div>
                            <span className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="flex-shrink-0">
                        <button
                          onClick={() => handlePlanClick(plan)}
                          disabled={isComingSoon || loadingPlan === plan.slug}
                          className={`w-full min-h-[46px] sm:min-h-[48px] flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 transform ${
                            isComingSoon || loadingPlan === plan.slug
                              ? 'bg-muted text-muted-foreground cursor-not-allowed border-2 border-border'
                              : plan.popular
                                ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:shadow-xl hover:-translate-y-0.5 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                                : 'bg-card text-foreground border-2 border-border hover:border-primary hover:bg-muted hover:-translate-y-0.5'
                          }`}
                        >
                          {loadingPlan === plan.slug ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processando...
                            </>
                          ) : (
                            plan.buttonText
                          )}
                        </button>
                      </div>
                    </div>
                    </div>
                  )
                })}
              </div>
              {plans.length > 1 ? (
                <div className="mt-4 sm:hidden flex justify-center gap-2">
                  {plans.map((_, idx) => (
                    <span
                      key={`dot-${idx}`}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === currentPlanIndex ? 'w-5 bg-foreground' : 'w-1.5 bg-muted-foreground/40'
                      }`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section className="pb-16 sm:pb-20 md:pb-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-card rounded-2xl sm:rounded-[2rem] shadow-xl border border-border p-5 sm:p-8 md:p-12">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 sm:mb-3 tracking-tight">Tem dúvidas antes de decidir?</h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Respondem as perguntas que a maioria faz antes de assinar.
              </p>
            </div>

            <div className="mt-6 sm:mt-10 space-y-3 sm:space-y-4">
              {faqs.map((item, index) => {
                const isOpen = openFaqIndex === index
                return (
                  <div
                    key={index}
                    className="rounded-lg sm:rounded-xl border border-border bg-muted/30 hover:bg-muted/40 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex((current) => (current === index ? null : index))}
                      className="w-full flex items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 text-left"
                      aria-expanded={isOpen}
                      aria-controls={`faq-${index}`}
                    >
                      <span className="font-semibold text-foreground text-sm md:text-base">
                        {item.question}
                      </span>
                      <ChevronDown
                        className={`h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground transition-transform flex-shrink-0 ${
                          isOpen ? 'rotate-180' : 'rotate-0'
                        }`}
                      />
                    </button>
                    {isOpen ? (
                      <div id={`faq-${index}`} className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-1 sm:-mt-2">
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
