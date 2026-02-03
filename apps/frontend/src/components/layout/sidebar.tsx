import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CalendarClock,
  Calculator,
  Bot,
  FileText,
  BookOpen,
  Settings,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/stores/sidebar-store'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { useTheme } from 'next-themes'
import { useAiTools } from '@/features/ai/context'
import { useCalculators } from '@/features/calculators/context'
import type { AiTool } from '@/features/ai/types'
import type { CalculatorItem } from '@/features/calculators/api'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface NavItem {
  name: string
  href: string
  icon: typeof LayoutDashboard
  children?: { name: string; href: string }[]
  dataTour?: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const getNavigationGroups = (
  aiTools: AiTool[],
  calculators: CalculatorItem[]
): NavGroup[] => {
  // Build IA Jurídica children from API tools (only unlocked ones)
  const iaChildren = aiTools
    .filter((tool) => !tool.locked)
    .sort((a, b) => a.order - b.order)
    .map((tool) => ({
      name: tool.name,
      href: `/app/ia/${tool.slug}`,
    }))

  // Build Calculadoras children from API (only unlocked ones)
  const calcChildren = calculators
    .filter((calc) => !calc.locked)
    .sort((a, b) => a.order - b.order)
    .map((calc) => ({
      name: calc.name,
      href: calc.path,
    }))

  return [
    {
      label: '',
      items: [
        { name: 'Dashboard', href: '/app', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Gestao',
      items: [
        { name: 'Clientes', href: '/app/clientes', icon: Users },
        { name: 'Processos', href: '/app/processos', icon: FolderKanban },
        { name: 'Prazos', href: '/app/prazos', icon: CalendarClock },
      ],
    },
    {
      label: 'Ferramentas',
      items: [
        {
          name: 'Calculadoras',
          href: '/app/calculadoras',
          icon: Calculator,
          children: calcChildren,
        },
        {
          name: 'IA Juridica',
          href: '/app/ia',
          icon: Bot,
          children: iaChildren,
        },
      ],
    },
    {
      label: 'Recursos',
      items: [
        { name: 'Documentos', href: '/app/documentos', icon: FileText },
        { name: 'Materiais', href: '/app/materiais', icon: BookOpen },
      ],
    },
  ]
}

const bottomNavigation: NavItem[] = [
  { name: 'Configuracoes', href: '/app/configuracoes', icon: Settings },
  { name: 'Ajuda', href: '/app/ajuda', icon: HelpCircle },
]

export function Sidebar() {
  const location = useLocation()
  const { isExpanded, isMobileOpen, toggle, closeMobile } = useSidebarStore()
  const { logout } = useAuthStore()
  const { resolvedTheme } = useTheme()
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const { tools: aiTools } = useAiTools()
  const { calculators } = useCalculators()

  const isDark = resolvedTheme === 'dark'
  const logoSrc = isDark ? '/logo_dark.png' : '/logo_light.png'

  const navigation = getNavigationGroups(aiTools, calculators)

  const isActive = (href: string) => {
    if (href === '/app') {
      return location.pathname === '/app'
    }
    return location.pathname.startsWith(href)
  }

  const toggleExpanded = (name: string) => {
    setExpandedItems((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  const handleLogout = () => {
    setShowLogoutConfirm(false)
    logout()
    window.location.href = '/'
  }

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href)
    const hasChildren = item.children && item.children.length > 0
    const isItemExpanded = expandedItems.includes(item.name)
    const Icon = item.icon

    if (hasChildren) {
      return (
        <div key={item.name} data-tour={item.dataTour}>
          <button
            onClick={() => toggleExpanded(item.name)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {isExpanded && (
              <>
                <span className="flex-1 text-left">{item.name}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    isItemExpanded && 'rotate-180'
                  )}
                />
              </>
            )}
          </button>
          {isExpanded && isItemExpanded && item.children && (
            <div className="ml-4 mt-1 space-y-1 border-l border-border pl-4">
              {item.children.map((child) => (
                <Link
                  key={child.href}
                  to={child.href}
                  onClick={closeMobile}
                  className={cn(
                    'block px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive(child.href)
                      ? 'bg-accent text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  {child.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )
    }

    return (
      <Link
        key={item.href}
        to={item.href}
        onClick={closeMobile}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          active
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          !isExpanded && 'justify-center'
        )}
        title={!isExpanded ? item.name : undefined}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {isExpanded && <span>{item.name}</span>}
      </Link>
    )
  }

  const sidebarContent = (
    <>
      {/* Logo e Toggle */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2" onClick={closeMobile}>
          {isExpanded ? (
            <img src={logoSrc} alt="Processa AI" className="h-10 w-auto" />
          ) : (
            <img src="/favicon.svg" alt="Processa AI" className="h-8 w-8" />
          )}
        </Link>
        <button
          onClick={toggle}
          className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label={isExpanded ? 'Recolher sidebar' : 'Expandir sidebar'}
        >
          {isExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <button
          onClick={closeMobile}
          className="lg:hidden h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navegacao Principal */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navigation.map((group, idx) => (
          <div key={idx}>
            {group.label && isExpanded && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </h3>
            )}
            <div className="space-y-1">{group.items.map((item) => renderNavItem(item))}</div>
          </div>
        ))}
      </nav>

      {/* Navegacao Inferior */}
      <div className="border-t border-border px-3 py-4 space-y-1">
        {bottomNavigation.map((item) => renderNavItem(item))}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors',
            !isExpanded && 'justify-center'
          )}
          title={!isExpanded ? 'Sair' : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {isExpanded && <span>Sair</span>}
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Overlay Mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Mobile */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-background border-r border-border transition-transform duration-300 lg:hidden',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
          'w-72'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Sidebar Desktop */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 bg-background border-r border-border transition-all duration-300',
          isExpanded ? 'lg:w-64' : 'lg:w-[72px]'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Sair da plataforma?"
        description="Você será desconectado e precisará fazer login novamente para acessar sua conta."
        confirmText="Sair"
        variant="warning"
      />
    </>
  )
}
