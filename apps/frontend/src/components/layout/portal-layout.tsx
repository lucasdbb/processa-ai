'use client'

import { Outlet, useLocation } from 'react-router-dom'
import { LogOut, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { usePageTracking } from '@/lib/analytics/hooks'

export function PortalLayout() {
  usePageTracking()

  const location = useLocation()
  const { logout } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const isPreviewMode = new URLSearchParams(location.search).has('previewClientId')

  const isDark = resolvedTheme === 'dark'
  const logoSrc = isDark ? '/logo_dark.png' : '/logo_light.png'

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-40">
        <div className="w-full max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <img src={logoSrc} alt="Processa AI" className="h-8 w-auto shrink-0" />

          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Alternar tema"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {!isPreviewMode && (
              <button
                onClick={() => logout()}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Sair do portal"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content — fills remaining height, children manage scroll */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="w-full max-w-5xl mx-auto px-4 py-6 flex-1 min-h-0 flex flex-col">
          <Outlet />
        </div>
      </main>

      {/* Footer — always visible */}
      <footer className="shrink-0 border-t py-4">
        <p className="text-center text-xs text-muted-foreground">
          Powered by{' '}
          <a
            href="https://www.processai.app.br"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Processa AI
          </a>
        </p>
      </footer>
    </div>
  )
}
