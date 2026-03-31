import { Menu, Search, Bell, Moon, Sun, AlertCircle, FolderKanban, Calculator, Check, Coins, Sparkles, MessageSquarePlus, Shield, LogOut, FileText, Info, Users, Zap, Crown, GraduationCap, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/stores/sidebar-store'
import { useCommandPaletteStore } from '@/stores/command-palette-store'
import { useTheme } from 'next-themes'
import { useUser } from '@/features/auth/hooks/use-user'
import { useState, useEffect } from 'react'
import { useCreditsStore } from '@/stores/credits-store'
import { notificationService, type NotificationItem } from '@/services/notification-service'
import { FeedbackFormDialog } from '@/components/forms/feedback-form-dialog'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useBillingStore } from '@/stores/billing-store'
import { useOnboardingStore } from '@/features/onboarding/store'
import type { TourId } from '@/features/onboarding/types'
import { OnboardingProgress } from '@/components/onboarding/OnboardingChecklist'

// Plan badge config
const PLAN_CONFIG: Record<string, { label: string; icon: typeof Users; className: string }> = {
  basico:    { label: 'Básico',     icon: Users,         className: 'bg-muted text-muted-foreground hover:bg-muted/80' },
  estudante: { label: 'Estudante',  icon: GraduationCap, className: 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20' },
  autonomo:  { label: 'Autônomo',   icon: Zap,           className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20' },
  escritorio:{ label: 'Escritório', icon: Crown,         className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20' },
}

function PlanBadge({ planId }: { planId: string | null | undefined }) {
  const isFree = !planId || planId === 'none'
  const config = isFree ? null : PLAN_CONFIG[planId]

  if (isFree) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit bg-muted text-muted-foreground">
        <Sparkles className="h-3 w-3" strokeWidth={2} />
        Fazer upgrade
      </span>
    )
  }

  if (!config) return null
  const Icon = config.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit', config.className)}>
      <Icon className="h-3 w-3" strokeWidth={2} />
      {config.label}
    </span>
  )
}

// Helper functions
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

export function AppHeader() {
  const { isExpanded, setMobileOpen } = useSidebarStore()
  const { open: openCommandPalette } = useCommandPaletteStore()
  const { resolvedTheme, setTheme } = useTheme()
  const { user } = useUser()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { credits } = useCreditsStore()
  const { subscription } = useBillingStore()
  const { startTour } = useOnboardingStore()
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isMacPlatform, setIsMacPlatform] = useState(false)

  const isDark = resolvedTheme === 'dark'

  const loadNotifications = async () => {
    try {
      const response = await notificationService.list(false)
      // Show only first 5 in dropdown
      setNotifications(response.items.slice(0, 5))
      setUnreadCount(response.unread_count)
    } catch (error) {
    }
  }

  // Load notifications
  useEffect(() => {
    if (!user) return
    const timeout = setTimeout(() => {
      void loadNotifications()
    }, 0)
    return () => clearTimeout(timeout)
  }, [user])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const platform = window.navigator.platform?.toLowerCase() || ''
    const userAgent = window.navigator.userAgent?.toLowerCase() || ''
    setIsMacPlatform(platform.includes('mac') || userAgent.includes('mac'))
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const handleMarkAsRead = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await notificationService.markAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      toast.error('Erro ao marcar notificação como lida')
    }
  }

  const handleMarkAllAsRead = async (event: React.MouseEvent) => {
    event.preventDefault()
    try {
      await notificationService.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
      toast.success('Todas as notificações foram marcadas como lidas')
    } catch (error) {
      toast.error('Erro ao marcar todas como lidas')
    }
  }

  const getRecommendedTour = (pathname: string): TourId => {
    if (pathname.startsWith('/app/ia')) return 'ai-tools'
    if (pathname.startsWith('/app/calculadoras')) return 'calculators'
    if (pathname.startsWith('/app/clientes')) return 'clients'
    if (pathname.startsWith('/app/processos')) return 'processes'
    return 'dashboard'
  }

  const handleStartTour = () => {
    const tourId = getRecommendedTour(location.pathname)
    window.setTimeout(() => {
      startTour(tourId)
    }, 120)
  }

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (email) {
      return email.split('@')[0].slice(0, 2).toUpperCase()
    }
    return 'U'
  }

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-16 bg-background/95 backdrop-blur-sm border-b border-border transition-all duration-300',
        isExpanded ? 'lg:left-64' : 'lg:left-[72px]',
        'left-0'
      )}
    >
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Lado Esquerdo */}
        <div className="flex items-center gap-4">
          {/* Menu Mobile */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden h-10 w-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Busca Global - Abre Command Palette */}
          <button
            onClick={openCommandPalette}
            className="group flex items-center gap-3 h-10 px-3 lg:px-4 rounded-lg bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-accent hover:border-foreground/20 transition-all w-full max-w-xs lg:max-w-md cursor-pointer"
            aria-label={`Abrir busca (${isMacPlatform ? 'Command+K' : 'Ctrl+K'})`}
          >
            <Search className="h-4 w-4 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-sm flex-1 text-left truncate">
              <span className="hidden sm:inline">Buscar ou pressione </span>
              <span className="sm:hidden">Buscar</span>
            </span>
            {isMacPlatform ? (
              <kbd className="hidden sm:inline-flex h-6 select-none items-center gap-1 rounded bg-background border border-border px-2 font-mono text-[11px] font-medium text-muted-foreground leading-none group-hover:border-foreground/30 transition-colors">
                <span className="leading-none">⌘</span>
                <span className="leading-none">K</span>
              </kbd>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1">
                <kbd className="inline-flex h-6 select-none items-center rounded bg-background border border-border px-1.5 font-mono text-[11px] font-medium text-muted-foreground leading-none group-hover:border-foreground/30 transition-colors">
                  Ctrl
                </kbd>
                <span className="text-[11px] font-mono text-muted-foreground/80">+</span>
                <kbd className="inline-flex h-6 min-w-[1.5rem] select-none items-center justify-center rounded bg-background border border-border px-1.5 font-mono text-[11px] font-medium text-muted-foreground leading-none group-hover:border-foreground/30 transition-colors">
                  K
                </kbd>
              </span>
            )}
          </button>
        </div>

        {/* Lado Direito */}
        <div className="flex items-center gap-2">
          {/* Onboarding Checklist */}
          <OnboardingProgress />

          {/* Credits Display */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-tour="header-credits"
                className="flex items-center gap-1.5 sm:gap-2 h-10 px-2.5 sm:px-3 rounded-full bg-muted/50 border border-border hover:bg-accent hover:border-foreground/20 transition-colors group"
                aria-label="Ver detalhes de créditos"
              >
                <div className="relative text-amber-500">
                  <Coins className="h-4 w-4 group-hover:scale-110 transition-transform" />
                  <Sparkles className="h-3 w-3 absolute -top-1 -right-1 text-amber-400/90" />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {credits ? credits.total_available.toLocaleString('pt-BR') : '0'}
                </span>
                <span className="hidden sm:inline text-xs text-muted-foreground">créditos</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-80 max-w-80 p-0">
              <div className="px-4 pt-4 pb-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                    <Coins className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Créditos</p>
                    <p className="text-xs text-muted-foreground">Detalhes do seu saldo</p>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 space-y-3">
                {/* Subscription Credits */}
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-foreground">Assinatura</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Mensal
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Saldo</span>
                    <span className="text-sm font-semibold text-foreground">
                      {credits ? credits.subscription_credits.toLocaleString('pt-BR') : '0'}
                    </span>
                  </div>
                </div>

                {/* Purchased Credits */}
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-foreground">Créditos Extras</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Nunca expiram
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Saldo</span>
                    <span className="text-sm font-semibold text-foreground">
                      {credits ? credits.purchased_credits.toLocaleString('pt-BR') : '0'}
                    </span>
                  </div>
                </div>

                {/* Total */}
                <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">Total Disponível</span>
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {credits ? credits.total_available.toLocaleString('pt-BR') : '0'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-4">
                <Link
                  to="/app/assinatura"
                  className="flex items-center justify-center gap-2 rounded-lg bg-foreground text-background text-sm font-semibold py-2.5 hover:opacity-90 transition-opacity"
                >
                  Adquirir mais créditos
                </Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Toggle Tema */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="h-10 w-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Alternar tema"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* Notificações */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                className="relative h-10 w-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Notificações"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <h3 className="font-semibold text-sm">Notificações</h3>
                  {unreadCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'}
                    </p>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-primary hover:underline"
                  >
                    Marcar todas como lidas
                  </button>
                )}
              </div>
              <DropdownMenuSeparator />

              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma notificação no momento
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((notification) => {
                    const { icon: Icon, color: iconColor } = getNotificationIcon(notification.type)
                    const timeAgo = formatTimeAgo(notification.created_at)

                    return (
                      <Link
                        key={notification.id}
                        to="/app/notificacoes"
                        className={cn(
                          'flex gap-3 px-4 py-3 hover:bg-accent transition-colors cursor-pointer border-l-2',
                          notification.read
                            ? 'border-transparent'
                            : 'border-primary bg-accent/50'
                        )}
                      >
                        <div className={cn('shrink-0 mt-0.5', iconColor)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground line-clamp-1">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <button
                                onClick={(e) => handleMarkAsRead(notification.id, e)}
                                className="shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-background transition-colors"
                                aria-label="Marcar como lida"
                              >
                                <Check className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                          </div>
                          {notification.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {notification.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {timeAgo}
                          </p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}

              {notifications.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <Link
                      to="/app/notificacoes"
                      className="block w-full text-center text-sm text-primary hover:underline py-2"
                    >
                      Ver todas as notificações
                    </Link>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Menu Usuario */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                data-tour="user-menu"
                className="flex items-center gap-2 h-10 pl-2 pr-3 rounded-lg hover:bg-accent transition-colors"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar_url || undefined} alt={user?.name || user?.email || 'Usuario'} />
                  <AvatarFallback className="bg-slate-900 text-white text-xs">
                    {getInitials(user?.name, user?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:flex flex-col items-start">
                  <span className="text-sm font-medium text-foreground leading-tight">
                    {user?.name || user?.email?.split('@')[0] || 'Usuario'}
                  </span>
                  <PlanBadge planId={subscription?.plan_id} />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{user?.name || 'Usuario'}</span>
                  <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user?.role === 'admin' && (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className={cn(
                      "flex items-center w-full cursor-pointer",
                      isDark ? "text-red-400 focus:text-red-300 focus:bg-red-900/10" : "text-red-600 focus:text-red-700 focus:bg-red-50"
                    )}>
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Painel Admin</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => setIsFeedbackOpen(true)}>
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                <span>Enviar Sugestão</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleStartTour}>
                <Play className="mr-2 h-4 w-4" />
                <span>Iniciar missão guiada</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className={cn(
                  "flex items-center w-full cursor-pointer",
                  isDark
                    ? "text-red-400 focus:text-red-300 focus:bg-red-900/10"
                    : "text-red-600 focus:text-red-700 focus:bg-red-50"
                )}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <FeedbackFormDialog
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </header>
  )
}
