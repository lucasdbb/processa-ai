'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { UserMenu } from '@/features/auth/components/user-menu'
import { useUser } from '@/features/auth/hooks/use-user'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Início', href: '/' },
  { name: 'Blog', href: '/blog' },
  { name: 'IA Jurídica', href: '/ia-juridica' },
  { name: 'Calculadoras', href: '/calculadoras' },
  { name: 'Planos', href: '/planos' },
  { name: 'Sobre', href: '/sobre' },
]

interface HeaderProps {
  onLoginClick?: () => void
}

export function Header({ onLoginClick }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading } = useUser()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isActive = (path: string) => pathname === path

  const getLinkClasses = (path: string) => {
    const active = isActive(path)
    return cn(
      'text-sm font-medium transition-colors duration-200',
      active ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'
    )
  }

  const getMobileLinkClasses = (path: string) => {
    return cn(
      'block px-4 py-3 rounded-xl transition-all duration-200',
      isActive(path)
        ? 'text-gray-900 font-semibold bg-gray-50'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
    )
  }

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b',
        isScrolled || mobileMenuOpen
          ? 'bg-white/80 backdrop-blur-md border-gray-200 shadow-sm'
          : 'bg-white/0 border-transparent'
      )}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center hover:opacity-80 transition-opacity focus:outline-none rounded-lg"
              aria-label="Processa AI - Página inicial"
            >
              <img
                src="/logo.png"
                alt="Processa AI"
                className="h-10 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav
            id="main-navigation"
            className="hidden md:flex items-center space-x-8"
            role="navigation"
            aria-label="Navegação principal"
          >
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={getLinkClasses(item.href)}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Login Button / User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {isLoading ? (
              <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-100 animate-pulse">
                <div className="h-8 w-8 bg-gray-300 rounded-full" />
                <div className="h-4 w-24 bg-gray-300 rounded" />
              </div>
            ) : isAuthenticated && user ? (
              <UserMenu user={user} />
            ) : (
              <button
                onClick={onLoginClick}
                className="group relative inline-flex items-center justify-center px-6 py-2 text-sm font-semibold text-white transition-all duration-200 bg-gray-900 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
                aria-label="Fazer login na plataforma"
              >
                Entrar
                <div className="absolute inset-0 -z-10 rounded-full ring-1 ring-white/20 group-hover:ring-white/40 transition-all" />
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-700 hover:text-gray-900 p-2 rounded-lg transition-all duration-200 focus:outline-none"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div
            className="md:hidden absolute top-20 left-0 right-0 bg-white border-b border-gray-100 shadow-xl"
            id="mobile-menu"
          >
            <nav
              className="px-4 pt-4 pb-6 space-y-2 max-h-[calc(100vh-5rem)] overflow-y-auto"
              role="navigation"
              aria-label="Navegação móvel"
            >
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={getMobileLinkClasses(item.href)}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  {item.name}
                </Link>
              ))}

              <div className="pt-4 mt-4 border-t border-gray-100">
                {isAuthenticated && user ? (
                  <div className="space-y-2">
                    <div className="px-4 py-3 flex items-center space-x-3 mb-2">
                      <div className="w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-medium shadow-sm">
                        {(user.name || user.email?.split('@')[0] || 'U')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {user.name || user.email?.split('@')[0]}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                    </div>
                    <UserMenu user={user} />
                  </div>
                ) : (
                  <div className="px-4 pb-2">
                    <button
                      onClick={() => {
                        onLoginClick?.()
                        setMobileMenuOpen(false)
                      }}
                      className="w-full py-3 text-white bg-gray-900 hover:bg-gray-800 font-semibold rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 shadow-lg shadow-gray-900/10"
                    >
                      Entrar na Plataforma
                    </button>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
