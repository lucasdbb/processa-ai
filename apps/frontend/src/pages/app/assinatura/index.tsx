import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { SEO } from '@/components/seo'
import { Check, Crown, GraduationCap, Loader2, Star, Users, Zap, Coins, CreditCard, History, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { billingService } from '@/services/billing-service'
import { useBillingStore } from '@/stores/billing-store'
import { useCreditsStore } from '@/stores/credits-store'
import { creditsService, type CreditHistoryResponse } from '@/services/credits-service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type Tab = 'planos' | 'creditos' | 'historico' | 'custos'

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

export default function AssinaturaPage() {
  const [activeTab, setActiveTab] = useState<Tab>('planos')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // ── Plans state ──────────────────────────────────────────────────────────────
  const [apiPlans, setApiPlans] = useState<ApiPlan[] | null>(null)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const { subscription, invalidate: invalidateSubscription } = useBillingStore()
  const currentPlanId = subscription?.plan_id ?? null

  // ── Credits state ─────────────────────────────────────────────────────────────
  const { credits, packages, costs, fetchCredits, fetchPackages, fetchCosts, isLoading: loadingCredits } = useCreditsStore()
  const [purchasingId, setPurchasingId] = useState<string | null>(null)

  // ── History state ─────────────────────────────────────────────────────────────
  const [historyPage, setHistoryPage] = useState(1)
  const [historyData, setHistoryData] = useState<CreditHistoryResponse | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  // ── Effects ───────────────────────────────────────────────────────────────────

  // Detect Stripe return with cancellation
  useEffect(() => {
    if (searchParams.get('subscription') === 'canceled') {
      toast.info('Checkout cancelado. Escolha um plano quando quiser.')
      const next = new URLSearchParams(searchParams)
      next.delete('subscription')
      navigate({ search: next.toString() }, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load plans
  useEffect(() => {
    let didCancel = false
    const loadPlans = async () => {
      try {
        const res = await fetchWithCredentials(`${API_URL}/plans`, { method: 'GET' })
        if (!res.ok) throw new Error('Falha ao carregar planos')
        const data = (await res.json()) as ApiPlan[]
        if (!didCancel) setApiPlans(Array.isArray(data) ? data : [])
      } catch {
        if (!didCancel) setApiPlans([])
      }
    }
    void loadPlans()
    return () => { didCancel = true }
  }, [])

  // Load credits, packages, costs
  useEffect(() => {
    fetchCredits()
    fetchPackages()
    fetchCosts()
    loadHistory(1)
  }, [fetchCredits, fetchPackages, fetchCosts])

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const loadHistory = async (page: number) => {
    setLoadingHistory(true)
    try {
      const data = await creditsService.getHistory(page)
      setHistoryData(data)
      setHistoryPage(page)
    } catch {
      // silently fail
    } finally {
      setLoadingHistory(false)
    }
  }

  const handlePurchase = async (packageId: string) => {
    setPurchasingId(packageId)
    try {
      const { checkout_url } = await creditsService.purchaseCredits(packageId, window.location.href)
      window.location.href = checkout_url
    } catch {
      toast.error('Erro ao iniciar compra. Tente novamente.')
      setPurchasingId(null)
    }
  }

  // ── Plans logic ───────────────────────────────────────────────────────────────

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
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(value)
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

      const priceLabel = isComingSoon ? 'Em breve' : amountCents === 0 ? 'Gratuito' : formatMoney(currency, amountCents)
      const periodLabel = isComingSoon ? '' : amountCents === 0 ? '' : interval === 'year' ? '/ano' : '/mês'

      const isCurrentPlan = p.slug === currentPlanId
      const hasActiveStripeSubscription = !!(
        subscription?.stripe_subscription_id &&
        (subscription.status === 'active' || subscription.status === 'trialing')
      )
      const isFreeTarget = amountCents === 0

      const buttonText = isComingSoon
        ? 'Em breve'
        : isCurrentPlan
          ? 'Plano Atual'
          : isFreeTarget && hasActiveStripeSubscription
            ? 'Cancelar assinatura'
            : hasActiveStripeSubscription
              ? `Mudar para ${p.name}`
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
        isCurrentPlan,
      }
    }

    return (apiPlans || []).map(normalize).sort((a, b) => a.sortOrder - b.sortOrder)
  }, [apiPlans, currentPlanId, subscription])

  type Plan = (typeof plans)[number]

  const handlePlanClick = async (plan: Plan) => {
    if (plan.comingSoon || plan.isCurrentPlan) return

    const hasStripeSubscription = !!(
      subscription?.stripe_subscription_id &&
      (subscription.status === 'active' || subscription.status === 'trialing')
    )

    setLoadingPlan(plan.slug)

    try {
      if (plan.isFree && hasStripeSubscription) {
        await billingService.cancelSubscription()
        await invalidateSubscription()
        toast.success('Assinatura cancelada. Você terá acesso até o fim do período atual.')
        setLoadingPlan(null)
        return
      }

      if (hasStripeSubscription && plan.stripePriceId) {
        await billingService.changePlan(plan.stripePriceId)
        await invalidateSubscription()
        toast.success(`Plano alterado para ${plan.name} com sucesso!`)
        setLoadingPlan(null)
        return
      }

      if (!plan.stripePriceId) {
        toast.error('Este plano não está disponível no momento.')
        setLoadingPlan(null)
        return
      }

      const successUrl = `${window.location.origin}/app?subscription=success`
      const cancelUrl = `${window.location.origin}/app/assinatura?subscription=canceled`

      const { checkout_url } = await billingService.createCheckout({
        price_id: plan.stripePriceId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      })

      window.location.href = checkout_url
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao processar. Tente novamente.')
      setLoadingPlan(null)
    }
  }

  // ── Formatters ────────────────────────────────────────────────────────────────

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

  // ── Tab definitions ───────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'planos', label: 'Planos', icon: Crown },
    { id: 'creditos', label: 'Créditos Avulsos', icon: Coins },
    { id: 'historico', label: 'Histórico', icon: History },
    { id: 'custos', label: 'Tabela de Custos', icon: AlertCircle },
  ]

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl pb-24 lg:pb-10">
      <SEO title="Assinatura" noindex />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assinatura & Créditos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seu plano, créditos e histórico de uso.</p>
        </div>

        {/* Credit balance card */}
        <div className="bg-slate-900 text-white dark:bg-slate-800 px-4 sm:px-5 py-3 sm:py-4 rounded-2xl shadow-lg flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="p-2 sm:p-2.5 bg-white/10 rounded-xl">
            <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-300 uppercase tracking-wide">Saldo disponível</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold">
                {loadingCredits && !credits ? '...' : credits?.total_available || 0}
              </span>
              <span className="text-xs font-medium text-slate-400">créditos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-border overflow-x-auto overflow-y-hidden -mx-4 px-4 lg:mx-0 lg:px-0">
        <nav className="-mb-px flex gap-1 w-max min-w-full" aria-label="Seções de assinatura">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{id === 'creditos' ? 'Créditos' : id === 'historico' ? 'Histórico' : id === 'custos' ? 'Custos' : label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── Aba: Planos ── */}
      {activeTab === 'planos' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-foreground">Escolha seu plano</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Todos os planos incluem acesso às ferramentas de IA jurídica e calculadoras. Cancele a qualquer momento.
            </p>
          </div>
          {apiPlans === null ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
              {plans.map((plan, index) => {
                const IconComponent = plan.icon
                const isComingSoon = plan.comingSoon === true
                const isHidden = plan.isHidden === true
                return (
                  <div
                    key={index}
                    className={cn(
                      'relative bg-card rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex flex-col transition-all duration-300 w-full',
                      plan.popular ? 'shadow-2xl ring-2 ring-primary z-10' : 'shadow-xl border border-border',
                      isComingSoon || isHidden ? 'opacity-90' : 'hover:scale-[1.01] hover:shadow-2xl hover:border-muted-foreground/50',
                      isHidden ? 'blur-[4px] pointer-events-none' : '',
                    )}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
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

                    <div className={cn(isComingSoon ? 'blur-[2px] opacity-60' : '', 'flex flex-col flex-1')}>
                      <div className="sm:hidden mb-2.5 shrink-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={cn(
                              'inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
                              plan.popular ? 'bg-slate-900 text-white' : 'bg-muted text-foreground',
                            )}>
                              <IconComponent className="w-4 h-4" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-base font-bold text-foreground tracking-tight truncate">{plan.name}</h3>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xl font-bold text-foreground tracking-tight leading-none">{plan.price}</div>
                            <div className="text-[11px] text-muted-foreground font-medium mt-1">{plan.period}</div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug mt-2 line-clamp-2">{plan.description}</p>
                      </div>

                      <div className="hidden sm:block mb-4 shrink-0">
                        <div className={cn(
                          'inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3',
                          plan.popular ? 'bg-slate-900 text-white' : 'bg-muted text-foreground',
                        )}>
                          <IconComponent className="w-5 h-5" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{plan.description}</p>
                      </div>

                      <div className="hidden sm:flex items-baseline mb-4 shrink-0">
                        <span className="text-3xl font-bold text-foreground tracking-tight">{plan.price}</span>
                        <span className="text-muted-foreground ml-1.5 text-sm font-medium">{plan.period}</span>
                      </div>

                      <div className="border-t border-border/70 pt-2.5 sm:border-0 sm:pt-0">
                      <ul className="space-y-1.5 mb-3 sm:hidden flex-1">
                        {plan.features.map((feature, fi) => (
                          <li key={fi} className="flex items-start">
                            <div className="shrink-0 w-4 h-4 rounded-full bg-green-500/10 flex items-center justify-center mr-1.5 mt-0.5">
                              <Check className="w-2.5 h-2.5 text-[hsl(var(--success-strong))]" strokeWidth={3} />
                            </div>
                            <span className="text-muted-foreground text-sm font-medium leading-snug">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      </div>

                      <ul className="hidden sm:block sm:space-y-2.5 sm:mb-6 sm:flex-1">
                        {plan.features.map((feature, fi) => (
                          <li key={fi} className="flex items-start">
                            <div className="shrink-0 w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center mr-2.5 mt-0.5">
                              <Check className="w-3 h-3 text-[hsl(var(--success-strong))]" strokeWidth={3} />
                            </div>
                            <span className="text-muted-foreground text-sm font-medium leading-relaxed">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="shrink-0">
                        <button
                          onClick={() => handlePlanClick(plan)}
                          disabled={isComingSoon || plan.isCurrentPlan || loadingPlan === plan.slug}
                          className={cn(
                            'w-full min-h-[38px] sm:min-h-[48px] flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-3 px-2.5 sm:px-4 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-bold transition-all duration-200 transform',
                            isComingSoon || plan.isCurrentPlan || loadingPlan === plan.slug
                              ? 'bg-muted text-muted-foreground cursor-not-allowed border-2 border-border'
                              : plan.popular
                                ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:shadow-xl hover:-translate-y-0.5 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                                : 'bg-card text-foreground border-2 border-border hover:border-primary hover:bg-muted hover:-translate-y-0.5',
                          )}
                        >
                          {loadingPlan === plan.slug ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
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
        </div>
      )}

      {/* ── Aba: Créditos Avulsos ── */}
      {activeTab === 'creditos' && (
        <div className="space-y-5">
          <p className="text-xs text-muted-foreground">
            Créditos avulsos nunca expiram e funcionam em todas as ferramentas do seu plano.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="relative flex flex-col rounded-2xl border-2 border-border bg-card p-6 hover:border-primary/40 hover:shadow-md transition-all overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Coins className="w-24 h-24" />
                </div>

                <div className="flex-1 mb-6">
                  <div className="mb-1">
                    <span className="text-4xl font-extrabold text-foreground tracking-tight">
                      {pkg.credits.toLocaleString('pt-BR')}
                    </span>
                    <span className="ml-2 text-sm font-medium text-muted-foreground">créditos</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{pkg.name}</p>
                </div>

                <button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={!!purchasingId}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all',
                    purchasingId === pkg.id
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100',
                  )}
                >
                  {purchasingId === pkg.id ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
                  ) : (
                    <><CreditCard className="w-4 h-4" />{formatCurrency(pkg.price_cents)}</>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Subscription upsell */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Precisa de créditos todos os meses?</p>
                <p className="text-xs text-muted-foreground">Assine um plano e economize até 40% — renovação automática.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('planos')}
              className="shrink-0 rounded-xl border-2 border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-primary hover:bg-muted transition-all"
            >
              Ver planos
            </button>
          </div>
        </div>
      )}

      {/* ── Aba: Histórico ── */}
      {activeTab === 'historico' && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="w-4 h-4" />
              Histórico de Transações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : historyData && historyData.transactions.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-muted-foreground text-xs">{formatDate(tx.created_at)}</TableCell>
                          <TableCell>
                            <Badge variant={
                              tx.transaction_type === 'grant' ? 'default' :
                              tx.transaction_type === 'consume' ? 'secondary' :
                              tx.transaction_type === 'refund' ? 'outline' : 'secondary'
                            }>
                              {tx.transaction_type === 'grant' && 'Crédito'}
                              {tx.transaction_type === 'consume' && 'Uso'}
                              {tx.transaction_type === 'refund' && 'Estorno'}
                              {tx.transaction_type === 'reset' && 'Reset'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {tx.reason || '-'}
                            <span className="text-xs text-muted-foreground block">
                              {tx.credit_type === 'subscription' ? 'Assinatura' : 'Avulso'}
                            </span>
                          </TableCell>
                          <TableCell className={cn(
                            'text-right font-medium',
                            tx.transaction_type === 'grant' || tx.transaction_type === 'refund'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400',
                          )}>
                            {tx.transaction_type === 'grant' || tx.transaction_type === 'refund' ? '+' : '-'}{tx.amount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 py-4 px-4 border-t">
                  <Button variant="outline" size="sm" onClick={() => loadHistory(historyPage - 1)} disabled={historyPage <= 1 || loadingHistory}>
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[88px] text-center">Página {historyPage}</span>
                  <Button variant="outline" size="sm" onClick={() => loadHistory(historyPage + 1)} disabled={!historyData || historyData.transactions.length < 20 || loadingHistory}>
                    Próxima
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhuma transação encontrada.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Aba: Tabela de Custos ── */}
      {activeTab === 'custos' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="w-4 h-4" />
              Custo das Ferramentas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ferramenta</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Custo (Créditos)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costs.map((item) => (
                      <TableRow key={item.feature_key}>
                        <TableCell className="font-medium">{item.display_name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.description}</TableCell>
                        <TableCell className="text-right font-bold">{item.cost}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
