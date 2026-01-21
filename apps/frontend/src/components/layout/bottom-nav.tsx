import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, FolderKanban, Calculator, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/stores/sidebar-store'

const navItems = [
  { name: 'Home', href: '/app', icon: LayoutDashboard },
  { name: 'Clientes', href: '/app/clientes', icon: Users },
  { name: 'Processos', href: '/app/processos', icon: FolderKanban },
  { name: 'Calc.', href: '/app/calculadoras', icon: Calculator },
]

export function BottomNav() {
  const location = useLocation()
  const { setMobileOpen } = useSidebarStore()

  const isActive = (href: string) => {
    if (href === '/app') {
      return location.pathname === '/app'
    }
    return location.pathname.startsWith(href)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border lg:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-lg transition-colors',
                active
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'text-primary')} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </div>
    </nav>
  )
}
