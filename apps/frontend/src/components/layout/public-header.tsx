import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Moon, Sun, ChevronDown } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { useUser } from '@/features/auth/hooks/use-user'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navigation = [
  {
    name: 'Recursos',
    href: '#',
    children: [
      { name: 'IA Juridica', href: '/app/ia', description: 'Chat e geracao de documentos' },
      { name: 'Calculadoras', href: '/app/calculadoras', description: 'Trabalhista e previdenciario' },
      { name: 'Materiais', href: '/app/materiais', description: 'Downloads e modelos' },
    ],
  },
  { name: 'Planos', href: '/planos' },
  { name: 'Blog', href: '/blog' },
  { name: 'Sobre', href: '/sobre' },
]

interface PublicHeaderProps {
  onLoginClick?: () => void
}

export function PublicHeader({ onLoginClick }: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const location = useLocation()
  const { isAuthenticated, isLoading } = useUser()
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
            <img src={logoSrc} alt="Processa AI" className="h-14 w-auto object-contain" />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigation.map((item) =>
              item.children ? (
                <DropdownMenu key={item.name}>
                  <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    {item.name}
                    <ChevronDown className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-64">
                    {item.children.map((child) => (
                      <DropdownMenuItem key={child.href} asChild>
                        <Link to={child.href} className="flex flex-col items-start gap-1 py-2">
                          <span className="font-medium">{child.name}</span>
                          <span className="text-xs text-muted-foreground">{child.description}</span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {item.name}
                </Link>
              )
            )}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="h-10 w-10 flex items-center justify-center rounded-full text-foreground hover:bg-muted transition-colors"
              aria-label="Alternar tema"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {isLoading ? (
              <div className="h-10 w-24 bg-muted rounded-full animate-pulse" />
            ) : isAuthenticated ? (
              <Link
                to="/app"
                className="px-6 py-2 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors"
              >
                Acessar App
              </Link>
            ) : (
              <button
                onClick={onLoginClick}
                className="group relative inline-flex items-center justify-center px-6 py-2 text-sm font-semibold text-white transition-all duration-200 bg-slate-900 hover:bg-slate-800 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
                aria-label="Fazer login na plataforma"
              >
                Entrar
                <div className="absolute inset-0 -z-10 rounded-full ring-1 ring-white/20 group-hover:ring-white/40 transition-all" />
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 right-0 bg-background border-b border-border shadow-xl">
            <nav className="px-4 pt-4 pb-6 space-y-2">
              {isAuthenticated ? (
                <Link
                  to="/app"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full py-3 text-center text-white bg-slate-900 rounded-xl font-semibold mb-2"
                >
                  Meu painel
                </Link>
              ) : null}

              {navigation.map((item) =>
                item.children ? (
                  <div key={item.name} className="space-y-2">
                    <span className="block px-4 py-2 text-sm font-semibold text-foreground">
                      {item.name}
                    </span>
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        to={child.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block px-4 py-2 pl-8 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'block px-4 py-3 rounded-xl transition-colors',
                      isActive(item.href)
                        ? 'text-foreground font-semibold bg-accent'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    {item.name}
                  </Link>
                )
              )}

              <div className="pt-4 mt-4 border-t border-border space-y-2">
                {!isAuthenticated ? (
                  <button
                    onClick={() => {
                      onLoginClick?.()
                      setMobileMenuOpen(false)
                    }}
                    className="block w-full py-3 text-center text-white bg-slate-900 hover:bg-slate-800 rounded-xl font-semibold transition-colors duration-200"
                  >
                    Entrar na Plataforma
                  </button>
                ) : null}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
