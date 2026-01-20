import { Menu, Search, Bell, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/stores/sidebar-store'
import { useCommandPaletteStore } from '@/stores/command-palette-store'
import { useTheme } from 'next-themes'
import { useUser } from '@/features/auth/hooks/use-user'
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

export function AppHeader() {
  const { isExpanded, setMobileOpen } = useSidebarStore()
  const { open: openCommandPalette } = useCommandPaletteStore()
  const { resolvedTheme, setTheme } = useTheme()
  const { user } = useUser()
  const { logout } = useAuthStore()

  const isDark = resolvedTheme === 'dark'

  const handleLogout = () => {
    logout()
    window.location.href = '/'
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
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notificacoes</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma notificacao no momento
              </div>
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
