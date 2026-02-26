import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Check, Crown, GraduationCap, Loader2, Star, Users, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { billingService } from '@/services/billing-service'

type ApiPlanPrice = {
  currency: string
  amount_cents: number
  interval: string
  stripe_price_id?: string
}

type ApiPlan = {
  slug: string
  name: string
  description: string | null
  is_popular: boolean
  is_visible: boolean
  is_sellable: boolean
  sort_order: number
  price: ApiPlanPrice | null
  features: string[]
}


export default function AppPlanosPage() {
  const [apiPlans, setApiPlans] = useState<ApiPlan[] | null>(null)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Detecta retorno do Stripe com cancelamento
  useEffect(() => {
    if (searchParams.get('subscription') === 'canceled') {
      toast.info('Checkout cancelado. Escolha um plano quando quiser.')
      const next = new URLSearchParams(searchParams)
      next.delete('subscription')
      navigate({ search: next.toString() }, { replace: true })
    }
  }, []) // Roda só na montagem

  useEffect(() => {
    let didCancel = false

    const loadPlans = async () => {
      try {
        const res = await fetchWithCredentials(`${API_URL}/plans`, { method: 'GET' })
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }))
          console.error('Error loading plans:', errorData)
          throw new Error('Falha ao carregar planos')
        }
        const data = (await res.json()) as ApiPlan[]
        if (!didCancel) setApiPlans(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Failed to load plans:', error)
        if (!didCancel) setApiPlans([])
      }
    }

    void loadPlans()

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
          ? 'Plano Atual'
          : `Assinar ${p.name}`

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

    return (apiPlans || []).map(normalize).sort((a, b) => a.sortOrder - b.sortOrder)
  }, [apiPlans])

  type Plan = (typeof plans)[number]

  const handlePlanClick = async (plan: Plan) => {
    if (plan.comingSoon) return

    // Se for plano gratuito, apenas redireciona para dashboard (já está logado)
    if (plan.isFree) {
      toast.info('Você já está no plano gratuito.')
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
      const cancelUrl = `${window.location.origin}/app/planos?subscription=canceled`

      const { checkout_url } = await billingService.createCheckout({
        price_id: plan.stripePriceId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      })

      // Redirecionar para o Stripe Checkout
      window.location.href = checkout_url
    } catch (error) {
      console.error('Error creating checkout:', error)
      toast.error('Erro ao iniciar checkout. Tente novamente.')
      setLoadingPlan(null)
    }
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Planos de Assinatura</h1>
        <p className="text-muted-foreground">
          Escolha o plano ideal para impulsionar sua prática profissional com ferramentas jurídicas inteligentes.
        </p>
      </div>

      <section className="relative z-10">
        {apiPlans === null ? (
          <div className="flex justify-center items-center py-20">
             <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-6 w-full mx-auto">
            {plans.map((plan, index) => {
              const IconComponent = plan.icon
              const isComingSoon = (plan as { comingSoon?: boolean }).comingSoon === true
              const isHidden = (plan as { isHidden?: boolean }).isHidden === true
              return (
                <div
                  key={index}
                  className={`relative bg-card rounded-2xl p-5 flex flex-col transition-all duration-300 w-full max-w-[320px] ${
                    plan.popular ? 'shadow-2xl ring-2 ring-primary z-10' : 'shadow-xl border border-border'
                  } ${
                    isComingSoon || isHidden
                      ? 'opacity-90'
                      : 'hover:scale-[1.01] hover:shadow-2xl hover:border-muted-foreground/50'
                  } ${
                    isHidden ? 'blur-[4px] pointer-events-none' : ''
                  }`}
                >
                  {plan.popular ? (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-slate-900 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg flex items-center tracking-wide">
                        <Star className="w-3 h-3 mr-1.5 fill-current" />
                        MAIS POPULAR
                      </div>
                    </div>
                  ) : null}

                  {isComingSoon ? (
                    <div className="absolute top-4 right-4 z-20">
                      <div className="bg-slate-900 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg tracking-wide">
                        EM BREVE
                      </div>
                    </div>
                  ) : null}

                  <div className={`${isComingSoon ? 'blur-[2px] opacity-60' : ''} flex flex-col flex-1`}>
                    <div className="mb-4 flex-shrink-0">
                      <div
                        className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 ${
                          plan.popular ? 'bg-slate-900 text-white' : 'bg-muted text-foreground'
                        }`}
                      >
                        <IconComponent className="w-5 h-5" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">{plan.name}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{plan.description}</p>
                    </div>

                    <div className="flex items-baseline mb-4 flex-shrink-0">
                      <span className="text-3xl font-bold text-foreground tracking-tight">{plan.price}</span>
                      <span className="text-muted-foreground ml-1.5 text-sm font-medium">{plan.period}</span>
                    </div>

                    <ul className="space-y-2.5 mb-6 flex-1">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center mr-2.5 mt-0.5">
                            <Check
                              className="w-3 h-3 text-[hsl(var(--success-strong))]"
                              strokeWidth={3}
                            />
                          </div>
                          <span className="text-muted-foreground text-sm font-medium leading-relaxed">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex-shrink-0">
                      <button
                        onClick={() => handlePlanClick(plan)}
                        disabled={isComingSoon || loadingPlan === plan.slug}
                        className={`w-full min-h-[48px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 transform ${
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
        )}
      </section>
    </div>
  )
}
