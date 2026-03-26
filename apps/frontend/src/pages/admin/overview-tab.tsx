import { useCallback, useEffect, useState } from 'react'
import {
  RefreshCw,
  Coins,
  BarChart,
  ArrowUpRight,
  PieChart,
  Users,
  Crown,
  TrendingUp,
  FileText,
  CheckCircle,
  Edit,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { toast } from 'sonner'
import { creditsService, type AdminCreditsMetrics } from '@/services/credits-service'

interface AdminPostListItem {
  id: string
  slug: string
  title: string
  status: 'draft' | 'published' | 'archived'
  created_at?: string
  published_at?: string
  author?: {
    id: string
    name?: string
  }
}

interface UserListItem {
  id: string
  email: string
  name: string
  role: 'client' | 'author' | 'admin'
  status: 'active' | 'suspended' | 'deleted'
  avatar_url?: string | null
  created_at: string
  confirmed_at?: string | null
  credits?: number
  plan_id?: string
  subscription_status?: string
}

interface OverviewTabProps {
  isAdmin: boolean
}

export default function OverviewTab({ isAdmin }: OverviewTabProps) {
  const [posts, setPosts] = useState<AdminPostListItem[]>([])
  const [users, setUsers] = useState<UserListItem[]>([])
  const [creditStats, setCreditStats] = useState<AdminCreditsMetrics | null>(null)
  const [isReloading, setIsReloading] = useState(true)

  const extractErrorMessage = useCallback(async (response: Response, fallback: string) => {
    try {
      const data: unknown = await response.json()
      if (data && typeof data === 'object' && 'detail' in data) {
        const detail = (data as { detail?: unknown }).detail
        if (typeof detail === 'string' && detail.trim()) return detail

        if (Array.isArray(detail)) {
          const messages = detail
            .map((item) => {
              if (!item || typeof item !== 'object') return null
              const loc = 'loc' in item ? (item as { loc?: unknown }).loc : undefined
              const msg = 'msg' in item ? (item as { msg?: unknown }).msg : undefined
              const locParts = Array.isArray(loc) ? loc : []
              const field = locParts
                .map((p) => (typeof p === 'string' || typeof p === 'number' ? String(p) : ''))
                .filter(Boolean)
                .at(-1)
              const messageText = typeof msg === 'string' ? msg : ''
              if (field && messageText) return `${field}: ${messageText}`
              if (messageText) return messageText
              return null
            })
            .filter((m): m is string => Boolean(m && m.trim()))

          if (messages.length > 0) return messages.join('; ')
        }
      }
    } catch {
      return fallback
    }
    return fallback
  }, [])

  const loadPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: '1',
        page_size: '100',
      })
      const res = await fetchWithCredentials(`${API_URL}/blog/admin/posts?${params.toString()}`)
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao carregar posts'))
      const payload = (await res.json()) as { items?: AdminPostListItem[] }
      setPosts(Array.isArray(payload.items) ? payload.items : [])
    } catch (err) {
      setPosts([])
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar posts')
    }
  }, [extractErrorMessage])

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await fetchWithCredentials(`${API_URL}/users?limit=100&offset=0`)
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao carregar usuários'))
      const data = (await res.json()) as unknown
      setUsers(Array.isArray(data) ? (data as UserListItem[]) : [])
    } catch (err) {
      setUsers([])
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar usuários')
    }
  }, [extractErrorMessage, isAdmin])

  const loadCreditStats = useCallback(async () => {
    if (!isAdmin) return
    try {
      const stats = await creditsService.getAdminStats()
      setCreditStats(stats)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar estatísticas de créditos')
    }
  }, [isAdmin])

  const loadOverview = useCallback(async () => {
    setIsReloading(true)
    try {
      await Promise.all([loadPosts(), loadUsers(), loadCreditStats()])
    } finally {
      setIsReloading(false)
    }
  }, [loadPosts, loadUsers, loadCreditStats])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])
  const usersCountByRole = (() => {
    const byRole: Record<string, number> = { user: 0, author: 0, premium: 0, admin: 0 }
    for (const u of users) byRole[u.role] = (byRole[u.role] || 0) + 1
    return byRole
  })()

  const recentUsersCount = (() => {
    if (users.length === 0) return 0
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return users.filter((u) => new Date(u.created_at) > sevenDaysAgo).length
  })()

  if (isReloading && posts.length === 0 && (!isAdmin || users.length === 0) && !creditStats) {
    return (
      <Card>
        <CardContent className="py-16 flex items-center justify-center">
          <LoadingSpinner size="lg" text="Carregando visao geral..." />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Visão Geral</h2>
        <Button variant="outline" onClick={loadOverview} disabled={isReloading}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {isAdmin ? (
          <section>
            <h3 className="text-lg font-semibold text-muted-foreground mb-4">Métricas de Créditos</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Coins className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Últimos 30 dias</span>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {creditStats?.total_consumed_last_30d.toLocaleString('pt-BR') || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Créditos consumidos</p>
              </div>

              <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <BarChart className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Total</span>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {creditStats?.total_consumed_all_time.toLocaleString('pt-BR') || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Créditos consumidos (Histórico)</p>
              </div>

              <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                    <ArrowUpRight className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Estimado</span>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {(creditStats?.total_revenue_cents || 0) / 100 > 0
                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((creditStats?.total_revenue_cents || 0) / 100)
                    : 'R$ 0,00'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Receita de Créditos Avulsos</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
               <Card className="overflow-hidden shadow-sm">
                <CardHeader className="border-b border-border">
                  <CardTitle className="text-base font-semibold">Consumo por Funcionalidade</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {creditStats?.usage_by_feature && creditStats.usage_by_feature.length > 0 ? (
                    <div className="divide-y divide-border">
                      {creditStats.usage_by_feature
                        .sort((a, b) => b.total_consumed - a.total_consumed)
                        .map((item) => (
                        <div key={item.feature_key} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800">
                              <PieChart className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-foreground">
                                {item.feature_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </p>
                              <p className="text-xs text-muted-foreground">{item.count} execuções</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm text-foreground">{item.total_consumed.toLocaleString('pt-BR')}</p>
                            <p className="text-xs text-muted-foreground">créditos</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm">Nenhum dado disponível</div>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden shadow-sm">
                <CardHeader className="border-b border-border">
                  <CardTitle className="text-base font-semibold">Top Consumidores</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {creditStats?.top_consumers && creditStats.top_consumers.length > 0 ? (
                    <div className="divide-y divide-border">
                      {creditStats.top_consumers.map((consumer, index) => (
                        <div key={consumer.user_id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                              {index + 1}
                            </span>
                            <div>
                              <p className="font-medium text-sm text-foreground max-w-[150px] truncate" title={consumer.name || ''}>
                                {consumer.name || 'Usuário Sem Nome'}
                              </p>
                              <p className="text-xs text-muted-foreground max-w-[150px] truncate" title={consumer.email || ''}>
                                {consumer.email || 'Sem email'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm text-foreground">{consumer.total_consumed.toLocaleString('pt-BR')}</p>
                            <p className="text-xs text-muted-foreground">créditos</p>
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
          </section>
        ) : null}

        {isAdmin ? (
          <section>
            <h3 className="text-lg font-semibold text-muted-foreground mb-4">Métricas de Usuários</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Total</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{users.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Usuários cadastrados</p>
              </div>

              <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                    <Crown className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Premium</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{usersCountByRole.premium || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Assinantes ativos</p>
              </div>

              <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">+7 dias</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{recentUsersCount}</p>
                <p className="text-sm text-muted-foreground mt-1">Novos usuários</p>
              </div>
            </div>
          </section>
        ) : null}

        <section>
          <h3 className="text-lg font-semibold text-muted-foreground mb-4">Métricas de Conteúdo</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Total</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{posts.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Artigos criados</p>
            </div>

            <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Publicados</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{posts.filter((p) => p.status === 'published').length}</p>
              <p className="text-sm text-muted-foreground mt-1">Visíveis no blog</p>
            </div>

            <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <Edit className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Rascunhos</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{posts.filter((p) => p.status === 'draft').length}</p>
              <p className="text-sm text-muted-foreground mt-1">Em edição</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
