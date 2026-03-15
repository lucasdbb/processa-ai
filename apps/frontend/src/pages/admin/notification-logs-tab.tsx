import { useCallback, useEffect, useState } from 'react'
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageCircle,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Send,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'

interface NotificationLog {
  id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  channel: string
  recipient: string
  notification_type: string
  subject: string | null
  status: string
  error_message: string | null
  created_at: string
  updated_at: string
}

interface NotificationStats {
  total: number
  by_channel: Record<string, number>
  by_status: Record<string, number>
  last_24h: number
  last_7d: number
  failure_rate: number
}

const PAGE_SIZE = 20

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  sent: { label: 'Enviado', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-500/10', icon: Send },
  delivered: { label: 'Entregue', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-500/10', icon: CheckCircle2 },
  read: { label: 'Lido', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/10', icon: Eye },
  failed: { label: 'Falhou', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-500/10', icon: XCircle },
  queued: { label: 'Na fila', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-500/10', icon: Clock },
}

const CHANNEL_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  email: { label: 'E-mail', icon: Mail, color: 'text-blue-600' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: 'text-green-600' },
}

const TYPE_LABELS: Record<string, string> = {
  deadline_reminder: 'Lembrete de prazo',
  deadline_urgent: 'Prazo urgente',
  weekly_summary: 'Resumo semanal',
}

export default function NotificationLogsTab() {
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [channelFilter, setChannelFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchWithCredentials(`${API_URL}/notification-logs/stats`)
      if (res.ok) setStats(await res.json())
    } catch {
      // ignore
    }
  }, [])

  const loadLogs = useCallback(async (p = 1) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String((p - 1) * PAGE_SIZE),
      })
      if (channelFilter !== 'all') params.set('channel', channelFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetchWithCredentials(`${API_URL}/notification-logs/logs?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar logs')

      const data = await res.json()
      setLogs(data.items || [])
      setTotal(data.total || 0)
      setPage(p)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar logs')
      setLogs([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [channelFilter, statusFilter, debouncedSearch])

  useEffect(() => { void loadStats() }, [loadStats])
  useEffect(() => { void loadLogs(1) }, [loadLogs])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
      ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Logs de Notificações</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Rastreamento de e-mails e mensagens WhatsApp enviados pelo sistema.
        </p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total enviados" value={stats.total} />
          <StatCard label="Últimas 24h" value={stats.last_24h} />
          <StatCard label="Últimos 7 dias" value={stats.last_7d} />
          <StatCard
            label="Taxa de falha"
            value={`${stats.failure_rate}%`}
            variant={stats.failure_rate > 5 ? 'danger' : 'default'}
          />
        </div>
      )}

      {/* Channel + Status breakdown */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Por canal</h3>
              <div className="space-y-2">
                {Object.entries(stats.by_channel).map(([channel, count]) => {
                  const cfg = CHANNEL_CONFIG[channel] || { label: channel, icon: Mail, color: 'text-muted-foreground' }
                  const Icon = cfg.icon
                  return (
                    <div key={channel} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-4 w-4', cfg.color)} />
                        <span className="text-sm">{cfg.label}</span>
                      </div>
                      <span className="text-sm font-semibold">{count}</span>
                    </div>
                  )
                })}
                {Object.keys(stats.by_channel).length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum envio registrado</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Por status</h3>
              <div className="space-y-2">
                {Object.entries(stats.by_status).map(([status, count]) => {
                  const cfg = STATUS_CONFIG[status] || { label: status, color: 'text-muted-foreground', bg: 'bg-muted', icon: Clock }
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <span className={cn('text-sm px-2 py-0.5 rounded-full', cfg.bg, cfg.color)}>
                        {cfg.label}
                      </span>
                      <span className="text-sm font-semibold">{count}</span>
                    </div>
                  )
                })}
                {Object.keys(stats.by_status).length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum envio registrado</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por destinatário, assunto..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos canais</SelectItem>
            <SelectItem value="email">E-mail</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="delivered">Entregue</SelectItem>
            <SelectItem value="read">Lido</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
            <SelectItem value="queued">Na fila</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { void loadLogs(1); void loadStats() }}
          disabled={isLoading}
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum log encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Canal</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Destinatário</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assunto</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const channelCfg = CHANNEL_CONFIG[log.channel] || { label: log.channel, icon: Mail, color: 'text-muted-foreground' }
                    const ChannelIcon = channelCfg.icon
                    const statusCfg = STATUS_CONFIG[log.status] || { label: log.status, color: 'text-muted-foreground', bg: 'bg-muted', icon: Clock }

                    return (
                      <tr key={log.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <ChannelIcon className={cn('h-4 w-4', channelCfg.color)} />
                            <span>{channelCfg.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            {log.user_name && (
                              <p className="font-medium text-foreground truncate max-w-[200px]">{log.user_name}</p>
                            )}
                            <p className="text-muted-foreground truncate max-w-[200px]">{log.recipient}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {TYPE_LABELS[log.notification_type] || log.notification_type}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-foreground truncate max-w-[250px]">{log.subject || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', statusCfg.bg, statusCfg.color)}>
                              {statusCfg.label}
                            </span>
                            {log.error_message && (
                              <span title={log.error_message}>
                                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                {total} registro{total !== 1 ? 's' : ''} — Página {page} de {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => void loadLogs(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => void loadLogs(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: string | number
  variant?: 'default' | 'danger'
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={cn(
          'text-2xl font-bold',
          variant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-foreground',
        )}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
