import { useState, useEffect } from 'react'
import { AlertCircle, FolderKanban, Calculator, Check, Filter, Trash2, Bell, FileText, Sparkles, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { InfoTooltip } from '@/components/ui/tooltip'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { notificationService, type NotificationItem } from '@/services/notification-service'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Icon mapping
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'deadline':
      return { icon: AlertCircle, color: 'text-destructive' }
    case 'process':
      return { icon: FolderKanban, color: 'text-blue-500' }
    case 'calculation':
      return { icon: Calculator, color: 'text-green-500' }
    case 'blog':
      return { icon: FileText, color: 'text-purple-500' }
    case 'feature':
      return { icon: Sparkles, color: 'text-yellow-500' }
    case 'system':
    default:
      return { icon: Info, color: 'text-gray-500' }
  }
}

const formatTimeAgo = (date: string) => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
  } catch {
    return 'há algum tempo'
  }
}

export default function NotificacoesPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const response = await notificationService.list(false)
      setNotifications(response.items)
      setUnreadCount(response.unread_count)
    } catch (error) {
      toast.error('Erro ao carregar notificações')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read
    return true
  })

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
      toast.success('Notificação marcada como lida')
    } catch (error) {
      toast.error('Erro ao marcar notificação como lida')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
      toast.success('Todas as notificações foram marcadas como lidas')
    } catch (error) {
      toast.error('Erro ao marcar todas como lidas')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await notificationService.delete(id)
      const notification = notifications.find((n) => n.id === id)
      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      setDeleteId(null)
      toast.success('Notificação excluída')
    } catch (error) {
      toast.error('Erro ao excluir notificação')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0
              ? `${unreadCount} não ${unreadCount === 1 ? 'lida' : 'lidas'}`
              : 'Todas as notificações foram lidas'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <>
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors text-sm"
              >
                <Check className="h-4 w-4" />
                Marcar todas como lidas
              </button>
              <InfoTooltip content="Marca todas as notificações como lidas de uma vez" />
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <InfoTooltip content="Filtre para visualizar todas ou apenas não lidas" />
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm transition-colors',
            filter === 'all'
              ? 'bg-accent text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Todas ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm transition-colors',
            filter === 'unread'
              ? 'bg-accent text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Não lidas ({unreadCount})
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {filteredNotifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}
            description={filter === 'unread' ? 'Você está em dia!' : 'Você não tem notificações no momento.'}
          />
        ) : (
          filteredNotifications.map((notification) => {
            const { icon: Icon, color: iconColor } = getNotificationIcon(notification.type)
            const timeAgo = formatTimeAgo(notification.created_at)

            return (
              <div
                key={notification.id}
                className={cn(
                  'flex gap-4 p-4 rounded-lg border transition-colors hover:bg-accent/50',
                  notification.read ? 'border-border bg-card' : 'border-primary bg-accent/30'
                )}
              >
                {/* Icon */}
                <div className={cn('shrink-0 mt-1', iconColor)}>
                  <Icon className="h-6 w-6" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {notification.title}
                    </h3>
                    {!notification.read && (
                      <span className="shrink-0 h-2 w-2 rounded-full bg-primary mt-2" />
                    )}
                  </div>
                  {notification.description && (
                    <p className="text-sm text-muted-foreground">{notification.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{timeAgo}</p>
                </div>

                {/* Actions */}
                <div className="flex items-start gap-1 shrink-0">
                  {!notification.read && (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors"
                      aria-label="Marcar como lida"
                      title="Marcar como lida"
                    >
                      <Check className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteId(notification.id)}
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-destructive/10 transition-colors"
                    aria-label="Excluir notificação"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Excluir notificação?"
        description="Esta ação não pode ser desfeita. A notificação será removida permanentemente."
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  )
}
