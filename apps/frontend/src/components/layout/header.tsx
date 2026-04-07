import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Moon, Sun, Calculator, Bot, BookOpen, LayoutDashboard, ChevronDown, ChevronRight, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { UserMenu } from '@/features/auth/components/user-menu'
import { useUser } from '@/features/auth/hooks/use-user'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { fetchToolsCatalog } from './tools-catalog-utils'
import type { AiTool } from '@/features/ai/types'
import type { CalculatorItem } from '@/features/calculators/api'

type HeaderSubitem = {
  id?: string
  name: string
  description: string
  href: string
  locked?: boolean
  icon?: LucideIcon
}

type HeaderResourceItem = {
  name: string
  description: string
  icon: LucideIcon
  href?: string
  subitems?: HeaderSubitem[]
}

interface HeaderProps {
  onLoginClick?: () => void
}

export function Header({ onLoginClick }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false)
  const [recursosOpen, setRecursosOpen] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)
  const [aiTools, setAiTools] = useState<AiTool[]>([])
  const [calculators, setCalculators] = useState<CalculatorItem[]>([])
  const recursosRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<number | null>(null)
  const location = useLocation()
  const { user, isAuthenticated, isLoading } = useUser()
  const { logout } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()

  // Fetch AI tools and calculators from backend on mount
  useEffect(() => {
    fetchToolsCatalog().then(({ aiTools, calculators }) => {
      setAiTools(aiTools)
      setCalculators(calculators)
    })
  }, [])

  // Recursos principais - o que o usuário pode ACESSAR
  const recursos: HeaderResourceItem[] = [
    {
      name: 'IA Jurídica',
      description: 'Ferramentas de inteligência artificial',
      icon: Bot,
      subitems: [...aiTools]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
        .map((tool) => ({
          id: tool.slug,
          name: tool.name,
          description: tool.description,
          href: `/app/ia?tool=${tool.slug}`,
          icon: tool.icon,
          locked: tool.locked,
        })),
    },
    {
      name: 'Calculadoras',
      description: 'Trabalhista e previdenciária',
      icon: Calculator,
      subitems: calculators
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
        .map((calc) => ({
          id: calc.slug,
          name: calc.name,
          description: calc.description,
          href: calc.path,
          locked: calc.locked,
        })),
    },
    {
      name: 'Materiais Complementares',
      description: 'E-books, planilhas e modelos',
      href: '/materiais',
      icon: BookOpen,
    },
  ]

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (recursosRef.current && !recursosRef.current.contains(event.target as Node)) {
        setRecursosOpen(false)
        setActiveSubmenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fechar menu mobile ao mudar de rota
  useEffect(() => {
    setMobileMenuOpen(false)
    setMobileProfileOpen(false)
    setRecursosOpen(false)
    setActiveSubmenu(null)
  }, [location.pathname])

  // Bloquear scroll do body quando menu mobile está aberto
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  const isDark = resolvedTheme === 'dark'
  const logoSrc = isDark ? '/logo_dark.png' : '/logo_light.png'

  const isActive = (path: string) => location.pathname === path

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b',
        isScrolled || mobileMenuOpen
          ? 'bg-background/95 backdrop-blur-md border-border shadow-sm'
          : 'bg-background/95 border-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 lg:h-20">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <img
              src={logoSrc}
              alt="Processa AI"
              className="h-10 lg:h-12 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {/* Link Inicio */}
            <Link
              to="/"
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                isActive('/')
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              Inicio
            </Link>
            
            <Link
              to="/blog"
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                isActive('/blog')
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              Blog
            </Link>

            {/* Dropdown Recursos com Mega Menu Lateral */}
            <div className="relative" ref={recursosRef}>
              <button
                onClick={() => setRecursosOpen(!recursosOpen)}
                onMouseEnter={() => setRecursosOpen(true)}
                className={cn(
                  'flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  recursosOpen
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                Recursos
                <ChevronDown className={cn('h-4 w-4 transition-transform', recursosOpen && 'rotate-180')} />
              </button>

              {recursosOpen && (
                <div
                  className="absolute top-full left-0 mt-1"
                  onMouseEnter={() => {
                    if (closeTimeoutRef.current) {
                      clearTimeout(closeTimeoutRef.current)
                      closeTimeoutRef.current = null
                    }
                  }}
                  onMouseLeave={() => {
                    closeTimeoutRef.current = setTimeout(() => {
                      setRecursosOpen(false)
                      setActiveSubmenu(null)
                    }, 150)
                  }}
                >
                  {/* Menu Principal */}
                  <div className="w-72 py-2 bg-background border border-border rounded-xl shadow-xl">
                    {recursos.map((item) => {
                      const Icon = item.icon
                      const hasSubitems = item.subitems && item.subitems.length > 0
                      
                      if (hasSubitems) {
                        return (
                          <button
                            key={item.name}
                            onMouseEnter={() => {
                              if (closeTimeoutRef.current) {
                                clearTimeout(closeTimeoutRef.current)
                                closeTimeoutRef.current = null
                              }
                              setActiveSubmenu(item.name)
                            }}
                            className={cn(
                              'w-full flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted transition-colors',
                              activeSubmenu === item.name && 'bg-muted'
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                                <Icon className="h-5 w-5 text-foreground" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-medium text-foreground">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-3" />
                          </button>
                        )
                      }
                      
                      return (
                        <Link
                          key={item.name}
                          to={item.href!}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted transition-colors"
                        >
                          <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                            <Icon className="h-5 w-5 text-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>

                  {/* Submenu Lateral com espaçamento reduzido */}
                  {activeSubmenu && (
                    <div 
                      className="absolute left-full top-0 -ml-1 w-64 py-2 bg-background border border-border rounded-xl shadow-xl"
                      onMouseEnter={() => {
                        if (closeTimeoutRef.current) {
                          clearTimeout(closeTimeoutRef.current)
                          closeTimeoutRef.current = null
                        }
                      }}
                      onMouseLeave={() => {
                        closeTimeoutRef.current = setTimeout(() => {
                          setActiveSubmenu(null)
                        }, 150)
                      }}
                    >
                      {recursos
                        .find((r) => r.name === activeSubmenu)
                        ?.subitems?.map((subitem) => {
                          const isLocked = subitem.locked
                          
                          if (isLocked) {
                            return (
                              <div
                                key={subitem.name}
                                className="px-4 py-3 opacity-60 cursor-not-allowed"
                              >
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-foreground">{subitem.name}</p>
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500">
                                    Em breve
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{subitem.description}</p>
                              </div>
                            )
                          }
                          
                          return (
                            <Link
                              key={subitem.name}
                              to={subitem.href}
                              className="block px-4 py-3 hover:bg-muted transition-colors"
                            >
                              <p className="text-sm font-medium text-foreground">{subitem.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{subitem.description}</p>
                            </Link>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link
              to="/planos"
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                isActive('/planos')
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              Planos
            </Link>

            <Link
              to="/sobre"
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                isActive('/sobre')
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              Sobre
            </Link>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Alternar tema"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {isLoading ? (
              <div className="h-9 w-20 bg-muted rounded-lg animate-pulse" />
            ) : isAuthenticated && user ? (
              <UserMenu user={user} />
            ) : (
              <button
                onClick={onLoginClick}
                className="group relative inline-flex items-center justify-center px-6 py-2 text-sm font-semibold text-white transition-all duration-200 bg-slate-900 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
                aria-label="Fazer login na plataforma"
              >
                Entrar
                <div className="absolute inset-0 -z-10 rounded-full ring-1 ring-white/20 group-hover:ring-white/40 transition-all" />
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-1">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground"
              aria-label="Alternar tema"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-foreground"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-background border-t border-border max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain">
          <div className="px-4 py-4 space-y-4">
            {/* Link Inicio */}
            <Link
              to="/"
              className={cn(
                'block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive('/') ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              Inicio
            </Link>

            {/* Recursos */}
            <div>
              <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Recursos
              </p>
              <div className="space-y-1">
                {recursos.map((item) => {
                  const Icon = item.icon

                  // Se tiver subitems, renderizar com submenu
                  if (item.subitems && item.subitems.length > 0) {
                    return (
                      <div key={item.name} className="space-y-1">
                        <div className="px-3 py-2 text-sm font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span>{item.name}</span>
                          </div>
                        </div>
                        <div className="ml-6 space-y-1">
                          {item.subitems.map((subitem) => (
                            <Link
                              key={subitem.name}
                              to={subitem.href}
                              className={cn(
                                "block px-3 py-2 rounded-lg text-sm transition-colors",
                                subitem.locked
                                  ? "text-muted-foreground opacity-60 cursor-not-allowed"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              {subitem.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  // Se não tiver subitems, renderizar como link simples
                  return (
                    <Link
                      key={item.name}
                      to={item.href!}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-muted transition-colors"
                    >
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Links */}
            <div className="border-t border-border pt-4 space-y-1">
              <Link
                to="/planos"
                className={cn(
                  'block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive('/planos') ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                Planos
              </Link>
              <Link
                to="/blog"
                className={cn(
                  'block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive('/blog') ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                Blog
              </Link>
              <Link
                to="/sobre"
                className={cn(
                  'block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive('/sobre') ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                Sobre
              </Link>
            </div>

            {/* Auth CTA */}
            <div className="border-t border-border pt-4">
              {isAuthenticated && user ? (
                <div>
                  <button
                    onClick={() => setMobileProfileOpen(!mobileProfileOpen)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/50 transition-colors w-full"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url} alt={user.name || user.email} />
                      <AvatarFallback className="bg-slate-900 text-white text-sm font-medium">
                        {(user.name || user.email?.split('@')[0] || 'U')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user.name || user.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform', mobileProfileOpen && 'rotate-180')} />
                  </button>
                  {mobileProfileOpen && (
                    <div className="mt-1 ml-3 space-y-1">
                      <Link
                        to="/app"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Acessar Painel
                      </Link>
                      <button
                        onClick={async () => {
                          setMobileMenuOpen(false)
                          await logout()
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors w-full"
                      >
                        <LogOut className="h-4 w-4" />
                        Sair
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => {
                    onLoginClick?.()
                    setMobileMenuOpen(false)
                  }}
                  className="w-full py-3 text-white bg-slate-900 hover:bg-slate-800 font-semibold rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 shadow-lg"
                >
                  Entrar na Plataforma
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
