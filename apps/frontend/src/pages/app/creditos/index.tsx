import { useEffect, useState } from 'react'
import { useCreditsStore } from '@/stores/credits-store'
import { creditsService, type CreditHistoryResponse } from '@/services/credits-service'
import { Coins, CreditCard, History, AlertCircle, Loader2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'

export default function CreditosPage() {
  const { credits, packages, costs, fetchCredits, fetchPackages, fetchCosts, isLoading } = useCreditsStore()
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyData, setHistoryData] = useState<CreditHistoryResponse | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    fetchCredits()
    fetchPackages()
    fetchCosts()
    loadHistory(1)
  }, [fetchCredits, fetchPackages, fetchCosts])

  const loadHistory = async (page: number) => {
    setLoadingHistory(true)
    try {
      const data = await creditsService.getHistory(page)
      setHistoryData(data)
      setHistoryPage(page)
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handlePurchase = async (packageId: string) => {
    setPurchasingId(packageId)
    try {
      const { checkout_url } = await creditsService.purchaseCredits(
        packageId,
        window.location.href
      )
      window.location.href = checkout_url
    } catch {
      toast.error('Erro ao iniciar compra. Tente novamente.')
      setPurchasingId(null)
    }
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Meus Créditos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seu saldo e adquira pacotes para usar ferramentas avançadas.
          </p>
        </div>

        {/* Balance Card */}
        <div className="bg-slate-900 text-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg flex items-center gap-6 min-w-[300px]">
          <div className="p-3 bg-white/10 rounded-xl">
            <Coins className="w-8 h-8 text-yellow-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-300 uppercase tracking-wide">Saldo Disponível</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">
                {isLoading && !credits ? '...' : credits?.total_available || 0}
              </span>
              <span className="text-sm font-medium text-slate-400">créditos</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="packages" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="packages" className="rounded-lg px-4">Comprar Créditos</TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg px-4">Histórico</TabsTrigger>
          <TabsTrigger value="costs" className="rounded-lg px-4">Tabela de Custos</TabsTrigger>
        </TabsList>

        {/* Packages Tab */}
        <TabsContent value="packages" className="space-y-5">
          {/* One-liner context */}
          <p className="text-xs text-muted-foreground">
            Créditos avulsos nunca expiram e funcionam em todas as ferramentas do seu plano.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {packages.map((pkg) => {
              return (
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
                      : 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                  )}
                >
                  {purchasingId === pkg.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      {formatCurrency(pkg.price_cents)}
                    </>
                  )}
                </button>
              </div>
              )
            })}
          </div>

          {/* Subscription upsell — inline banner, no extra card */}
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
            <Link
              to="/app/planos"
              className="shrink-0 rounded-xl border-2 border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-primary hover:bg-muted transition-all"
            >
              Ver planos
            </Link>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Histórico de Transações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : historyData && historyData.transactions.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
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
                          <TableCell className="text-muted-foreground text-xs">
                            {formatDate(tx.created_at)}
                          </TableCell>
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
                            "text-right font-medium",
                            tx.transaction_type === 'grant' || tx.transaction_type === 'refund'
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          )}>
                            {tx.transaction_type === 'grant' || tx.transaction_type === 'refund' ? '+' : '-'}
                            {tx.amount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-end space-x-2 py-4 px-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadHistory(historyPage - 1)}
                      disabled={historyPage <= 1 || loadingHistory}
                    >
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {historyPage}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadHistory(historyPage + 1)}
                      disabled={!historyData || historyData.transactions.length < 20 || loadingHistory}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhuma transação encontrada.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Costs Tab */}
        <TabsContent value="costs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Custo das Ferramentas
              </CardTitle>
              <CardDescription>
                Consumo de créditos por utilização de cada ferramenta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
