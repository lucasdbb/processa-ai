import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Moon, Sun, Calculator, Bot, BookOpen, ArrowRight, ChevronDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { UserMenu } from '@/features/auth/components/user-menu'
import { useUser } from '@/features/auth/hooks/use-user'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'

// Ferramentas principais - o que o usuário pode FAZER
const ferramentas = [
  {
    name: 'IA Juridica',
    description: 'Chat, analise de CNIS, peticoes e mais',
    href: '/app/ia',
    icon: Bot,
  },
  {
    name: 'Calculadoras',
    description: 'Trabalhista e previdenciaria',
    href: '/app/calculadoras',
    icon: Calculator,
  },
  {
    name: 'Materiais Complementares',
    description: 'E-books, planilhas e modelos',
    href: '/materiais',
    icon: BookOpen,
  },
]

interface HeaderProps {
  onLoginClick?: () => void
}

export function Header({ onLoginClick }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [ferramentasOpen, setFerramentasOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const ferramentasRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const { user, isAuthenticated, isLoading } = useUser()
  const { resolvedTheme, setTheme } = useTheme()

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
      if (ferramentasRef.current && !ferramentasRef.current.contains(event.target as Node)) {
        setFerramentasOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fechar menu mobile ao mudar de rota
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false)
    setFerramentasOpen(false)
  }, [location.pathname])

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

            {/* Dropdown Ferramentas */}
            <div className="relative" ref={ferramentasRef}>
              <button
                onClick={() => setFerramentasOpen(!ferramentasOpen)}
                onMouseEnter={() => setFerramentasOpen(true)}
                className={cn(
                  'flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  ferramentasOpen
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                Ferramentas
                <ChevronDown className={cn('h-4 w-4 transition-transform', ferramentasOpen && 'rotate-180')} />
              </button>

              {ferramentasOpen && (
                <div
                  className="absolute top-full left-0 mt-1 w-72 bg-background border border-border rounded-xl shadow-xl py-2"
                  onMouseLeave={() => setFerramentasOpen(false)}
                >
                  {ferramentas.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
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
        <div className="lg:hidden bg-background border-t border-border">
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

            {/* Ferramentas */}
            <div>
              <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ferramentas
              </p>
              <div className="space-y-1">
                {ferramentas.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
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

            {/* Auth */}
            <div className="border-t border-border pt-4">
              {isAuthenticated && user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-3">
                    <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                      {(user.name || user.email?.split('@')[0] || 'U')
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user.name || user.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <Link
                    to="/app"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg"
                  >
                    Acessar Painel
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      onLoginClick?.()
                      setMobileMenuOpen(false)
                    }}
                    className="w-full py-3 text-white bg-slate-900 hover:bg-slate-800 font-semibold rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 shadow-lg"
                  >
                    Entrar na Plataforma
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
