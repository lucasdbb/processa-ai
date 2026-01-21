import { useState } from 'react'
import { AlertCircle, FolderKanban, Calculator, Check, Filter, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock notifications (mesmas do header + mais algumas)
const allNotifications = [
  {
    id: '1',
    type: 'deadline',
    title: 'Prazo vencendo hoje',
    description: 'Contestação - Processo 0001234-12.2025.5.02.0001 · João Silva',
    time: 'há 2 horas',
    date: '2026-01-20T14:00:00',
    read: false,
    icon: AlertCircle,
    iconColor: 'text-destructive',
  },
  {
    id: '2',
    type: 'process',
    title: 'Movimentação processual',
    description: 'Processo 0005678-34.2025.5.02.0002 - Nova sentença publicada',
    time: 'há 5 horas',
    date: '2026-01-20T11:00:00',
    read: false,
    icon: FolderKanban,
    iconColor: 'text-blue-500',
  },
  {
    id: '3',
    type: 'calculation',
    title: 'Cálculo concluído',
    description: 'Rescisão Trabalhista - João Silva',
    time: 'ontem',
    date: '2026-01-19T16:30:00',
    read: true,
    icon: Calculator,
    iconColor: 'text-green-500',
  },
  {
    id: '4',
    type: 'deadline',
    title: 'Prazo em 2 dias',
    description: 'Recurso Ordinário - Processo 0005678-34.2025.5.02.0002 · Maria Oliveira',
    time: 'há 2 dias',
    date: '2026-01-18T09:00:00',
    read: true,
    icon: AlertCircle,
    iconColor: 'text-orange-500',
  },
  {
    id: '5',
    type: 'process',
    title: 'Processo arquivado',
    description: 'Processo 1000567-89.2024.8.26.0100 foi arquivado com sucesso',
    time: 'há 3 dias',
    date: '2026-01-17T15:20:00',
    read: true,
    icon: FolderKanban,
    iconColor: 'text-gray-500',
  },
]

export default function NotificacoesPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [notifications, setNotifications] = useState(allNotifications)

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read
    return true
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleDelete = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
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
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors text-sm"
            >
              <Check className="h-4 w-4" />
              Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
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
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              {filter === 'unread'
                ? 'Nenhuma notificação não lida'
                : 'Nenhuma notificação encontrada'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const Icon = notification.icon
            return (
              <div
                key={notification.id}
                className={cn(
                  'flex gap-4 p-4 rounded-lg border transition-colors hover:bg-accent/50',
                  notification.read ? 'border-border bg-card' : 'border-primary bg-accent/30'
                )}
              >
                {/* Icon */}
                <div className={cn('shrink-0 mt-1', notification.iconColor)}>
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
                  <p className="text-sm text-muted-foreground">{notification.description}</p>
                  <p className="text-xs text-muted-foreground">{notification.time}</p>
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
                    onClick={() => handleDelete(notification.id)}
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
    </div>
  )
}
