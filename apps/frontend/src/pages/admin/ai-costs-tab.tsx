import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  RefreshCw,
  Cpu,
  DollarSign,
  Zap,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { toast } from 'sonner'
import {
  dashboardService,
  type AiCostStats,
} from '@/services/dashboard-service'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const ENDPOINT_LABELS: Record<string, string> = {
  cnis_analysis: 'Analise de CNIS',
  process_summary: 'Resumo de Processo',
  labor_claim: 'Reclamatoria Trabalhista',
  brief_scanner: 'Scanner de Peca',
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('pt-BR')
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n)
}

function formatDay(day: string): string {
  const [, m, d] = day.split('-')
  return `${d}/${m}`
}

export default function AiCostsTab() {
  const [stats, setStats] = useState<AiCostStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadStats = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await dashboardService.getAiCostStats()
      setStats(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar custos de IA')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const s30 = stats?.last_30d
  const sAll = stats?.all_time

  if (isLoading && !stats) {
    return (
      <Card>
        <CardContent className="py-16 flex items-center justify-center">
          <LoadingSpinner size="lg" text="Carregando custos de IA..." />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Custos de IA</h2>
        <Button variant="outline" onClick={loadStats} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30">
              <DollarSign className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">30 dias</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{formatUsd(s30?.cost_usd ?? 0)}</p>
          <p className="text-sm text-muted-foreground mt-1">Custo total</p>
        </div>

        <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <Zap className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">30 dias</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{formatTokens(s30?.total_tokens ?? 0)}</p>
          <p className="text-sm text-muted-foreground mt-1">Tokens consumidos</p>
        </div>

        <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/30">
              <Cpu className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">30 dias</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{s30?.total_jobs ?? 0}</p>
          <p className="text-sm text-muted-foreground mt-1">Jobs processados</p>
        </div>

        <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <TrendingUp className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Histórico</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{formatUsd(sAll?.cost_usd ?? 0)}</p>
          <p className="text-sm text-muted-foreground mt-1">Custo total acumulado</p>
        </div>
      </div>

      {/* Daily cost chart */}
      {stats?.daily_trend && stats.daily_trend.length > 0 ? (
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base font-semibold">Custo diário (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.daily_trend}>
                  <defs>
                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1, 220 70% 50%))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1, 220 70% 50%))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="day"
                    tickFormatter={formatDay}
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                    width={60}
                  />
                  <Tooltip
                    formatter={(value: number | undefined) => [formatUsd(value ?? 0), 'Custo']}
                    labelFormatter={(label: ReactNode) => formatDay(String(label))}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost_usd"
                    stroke="hsl(var(--chart-1, 220 70% 50%))"
                    fill="url(#costGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Breakdown tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Model */}
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base font-semibold">Custo por Modelo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {stats?.by_model && stats.by_model.length > 0 ? (
              <div className="divide-y divide-border">
                {stats.by_model.map((item) => (
                  <div key={`${item.provider}-${item.model}`} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-violet-100 dark:bg-violet-900/30">
                        <Cpu className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{item.model}</p>
                        <p className="text-xs text-muted-foreground">{item.provider} &middot; {item.job_count} jobs &middot; {formatTokens(item.total_tokens)} tokens</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-foreground">{formatUsd(item.cost_usd)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">Nenhum dado disponível</div>
            )}
          </CardContent>
        </Card>

        {/* By Endpoint */}
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base font-semibold">Custo por Ferramenta</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {stats?.by_endpoint && stats.by_endpoint.length > 0 ? (
              <div className="divide-y divide-border">
                {stats.by_endpoint.map((item) => (
                  <div key={item.endpoint_key} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-sky-100 dark:bg-sky-900/30">
                        <Zap className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          {ENDPOINT_LABELS[item.endpoint_key] ?? item.endpoint_key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.job_count} jobs &middot; {formatTokens(item.total_tokens)} tokens</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-foreground">{formatUsd(item.cost_usd)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">Nenhum dado disponível</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed totals */}
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-base font-semibold">Resumo Detalhado de Tokens</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Período</th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">Jobs</th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">Tokens Input</th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">Tokens Output</th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">Total Tokens</th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">Custo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">Últimos 30 dias</td>
                  <td className="px-6 py-4 text-right text-foreground">{s30?.total_jobs ?? 0}</td>
                  <td className="px-6 py-4 text-right text-foreground">{formatTokens(s30?.prompt_tokens ?? 0)}</td>
                  <td className="px-6 py-4 text-right text-foreground">{formatTokens(s30?.completion_tokens ?? 0)}</td>
                  <td className="px-6 py-4 text-right text-foreground">{formatTokens(s30?.total_tokens ?? 0)}</td>
                  <td className="px-6 py-4 text-right font-bold text-foreground">{formatUsd(s30?.cost_usd ?? 0)}</td>
                </tr>
                <tr className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">Histórico total</td>
                  <td className="px-6 py-4 text-right text-foreground">{sAll?.total_jobs ?? 0}</td>
                  <td className="px-6 py-4 text-right text-foreground">{formatTokens(sAll?.prompt_tokens ?? 0)}</td>
                  <td className="px-6 py-4 text-right text-foreground">{formatTokens(sAll?.completion_tokens ?? 0)}</td>
                  <td className="px-6 py-4 text-right text-foreground">{formatTokens(sAll?.total_tokens ?? 0)}</td>
                  <td className="px-6 py-4 text-right font-bold text-foreground">{formatUsd(sAll?.cost_usd ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
