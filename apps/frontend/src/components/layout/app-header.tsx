import { Menu, Search, Bell, Moon, Sun, AlertCircle, FolderKanban, Calculator, Check, Coins, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/stores/sidebar-store'
import { useCommandPaletteStore } from '@/stores/command-palette-store'
import { useTheme } from 'next-themes'
import { useUser } from '@/features/auth/hooks/use-user'
import { useState, useEffect } from 'react'
import { creditsService, type UserCredits } from '@/services/credits-service'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store/auth-store'

// Mock notifications data
const mockNotifications = [
  {
    id: '1',
    type: 'deadline',
    title: 'Prazo vencendo hoje',
    description: 'Contestação - Processo 0001234-12.2025.5.02.0001',
    time: 'há 2 horas',
    read: false,
    icon: AlertCircle,
    iconColor: 'text-destructive',
  },
  {
    id: '2',
    type: 'process',
    title: 'Movimentação processual',
    description: 'Processo 0005678-34.2025.5.02.0002 - Nova sentença',
    time: 'há 5 horas',
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
    read: true,
    icon: Calculator,
    iconColor: 'text-green-500',
  },
]

export function AppHeader() {
  const { isExpanded, setMobileOpen } = useSidebarStore()
  const { open: openCommandPalette } = useCommandPaletteStore()
  const { resolvedTheme, setTheme } = useTheme()
  const { user } = useUser()
  const { logout } = useAuthStore()
  const [credits, setCredits] = useState<UserCredits | null>(null)
  const [, setLoadingCredits] = useState(false)

  const isDark = resolvedTheme === 'dark'

  // Load credits
  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingCredits(true)
      creditsService
        .getCredits()
        .then(setCredits)
        .catch((error) => {
          console.error('Failed to load credits:', error)
        })
        .finally(() => setLoadingCredits(false))
    }
  }, [user])

  const handleLogout = () => {
    logout()
    window.location.href = '/'
  }

  const unreadCount = mockNotifications.filter((n) => !n.read).length

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
            aria-label="Abrir busca (Cmd+K)"
          >
            <Search className="h-4 w-4 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-sm flex-1 text-left truncate">
              <span className="hidden sm:inline">Buscar ou pressione </span>
              <span className="sm:hidden">Buscar</span>
            </span>
            <kbd className="hidden sm:inline-flex h-6 select-none items-center gap-0.5 rounded bg-background border border-border px-2 font-mono text-[11px] font-medium text-muted-foreground group-hover:border-foreground/30 transition-colors">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        {/* Lado Direito */}
        <div className="flex items-center gap-2">
          {/* Credits Display */}
          {credits && (
            <div className="hidden sm:flex items-center gap-2 h-10 px-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all group cursor-pointer">
              <div className="relative">
                <Coins className="h-5 w-5 text-amber-500 group-hover:scale-110 transition-transform" />
                <Sparkles className="h-3 w-3 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 leading-none">
                  {credits.available_credits.toLocaleString('pt-BR')}
                </span>
                <span className="text-[10px] text-amber-600/70 dark:text-amber-400/70 leading-none">
                  créditos
                </span>
              </div>
            </div>
          )}

          {/* Toggle Tema */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="h-10 w-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Alternar tema"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* Notificacoes */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative h-10 w-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Notificacoes"
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
                {mockNotifications.length > 0 && (
                  <button className="text-xs text-primary hover:underline">
                    Marcar todas como lidas
                  </button>
                )}
              </div>
              <DropdownMenuSeparator />

              {mockNotifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma notificação no momento
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {mockNotifications.map((notification) => {
                    const Icon = notification.icon
                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          'flex gap-3 px-4 py-3 hover:bg-accent transition-colors cursor-pointer border-l-2',
                          notification.read
                            ? 'border-transparent'
                            : 'border-primary bg-accent/50'
                        )}
                      >
                        <div className={cn('shrink-0 mt-0.5', notification.iconColor)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground line-clamp-1">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <button
                                className="shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-background transition-colors"
                                aria-label="Marcar como lida"
                              >
                                <Check className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {notification.time}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {mockNotifications.length > 0 && (
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 h-10 pl-2 pr-3 rounded-lg hover:bg-accent transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar_url || undefined} alt={user?.name || user?.email || 'Usuario'} />
                  <AvatarFallback className="bg-slate-900 text-white text-xs">
                    {getInitials(user?.name, user?.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden lg:block text-sm font-medium text-foreground">
                  {user?.name || user?.email?.split('@')[0] || 'Usuario'}
                </span>
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
              <DropdownMenuItem asChild>
                <Link to="/app/configuracoes">Minha Conta</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/app/configuracoes">Assinatura</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/app/configuracoes">Preferencias</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
