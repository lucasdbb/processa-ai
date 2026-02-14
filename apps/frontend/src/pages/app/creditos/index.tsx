import { useEffect, useState } from 'react'
import { useCreditsStore } from '@/stores/credits-store'
import { creditsService, type CreditHistoryResponse } from '@/services/credits-service'
import { Coins, CreditCard, CheckCircle2, History, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

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
        window.location.href // Redirect back here
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
        <TabsContent value="packages" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <Card key={pkg.id} className="flex flex-col relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Coins className="w-24 h-24" />
                </div>
                
                <CardHeader>
                  <CardTitle className="text-xl">{pkg.name}</CardTitle>
                  <CardDescription>{pkg.credits} créditos válidos por tempo indeterminado</CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1">
                  <div className="text-3xl font-bold mb-4">
                    {formatCurrency(pkg.price_cents)}
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Sem validade (não expiram)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Uso em todas as ferramentas
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Pagamento único e seguro
                    </li>
                  </ul>
                </CardContent>
                
                <CardFooter>
                  <Button 
                    className="w-full" 
                    onClick={() => handlePurchase(pkg.id)}
                    disabled={!!purchasingId}
                  >
                    {purchasingId === pkg.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Comprar Agora
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ))}
            
            {/* Subscription Upsell */}
            <Card className="flex flex-col bg-slate-50 dark:bg-slate-900/50 border-dashed border-2">
              <CardHeader>
                <CardTitle className="text-xl">Precisa de mais?</CardTitle>
                <CardDescription>Assine um plano mensal e economize até 40%</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center items-center text-center p-6">
                <p className="text-muted-foreground mb-4">
                  Planos recorrentes incluem renovação mensal de créditos e acesso prioritário.
                </p>
                <Button variant="outline" className="w-full" asChild>
                  <a href="/planos">Ver Planos de Assinatura</a>
                </Button>
              </CardContent>
            </Card>
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
                  
                  {/* Pagination - Simple prev/next for now */}
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
