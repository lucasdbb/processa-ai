import { useEffect } from 'react'
import { Outlet, useLocation, useNavigation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Sidebar } from './sidebar'
import { AppHeader } from './app-header'
import { BottomNav } from './bottom-nav'
import { PageTransition } from './page-transition'
import { CommandPalette } from '@/components/navigation/command-palette'
import { Breadcrumbs } from '@/components/navigation/breadcrumbs'
import { useSidebarStore } from '@/stores/sidebar-store'
import { useCommandPaletteStore } from '@/stores/command-palette-store'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { cn } from '@/lib/utils'
import { AiToolsProvider } from '@/features/ai/provider'
import { CalculatorsProvider } from '@/features/calculators/provider'

function RouteLoadingBar() {
  const navigation = useNavigation()
  const isLoading = navigation.state !== 'idle'

  if (!isLoading) return null

  return (
    <div className="fixed top-16 left-0 right-0 z-[60] h-1 bg-muted">
      <div
        className="h-full bg-slate-900 transition-all duration-300"
        style={{
          animation: 'loading 1s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes loading {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}

export function AppLayout() {
  const location = useLocation()
  const { isExpanded } = useSidebarStore()
  const { toggle: toggleCommandPalette } = useCommandPaletteStore()

  // Initialize auth
  useAuth()

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggleCommandPalette()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleCommandPalette])

  return (
    <AiToolsProvider>
      <CalculatorsProvider>
        <div className="min-h-screen bg-background font-sans text-foreground">
          <RouteLoadingBar />
          <Sidebar />
          <AppHeader />

          <main
            className={cn(
              'min-h-screen pt-16 pb-20 lg:pb-0 transition-all duration-300',
              isExpanded ? 'lg:pl-64' : 'lg:pl-[72px]'
            )}
          >
            <div className="p-4 lg:p-6 space-y-6">
              <Breadcrumbs />
              <AnimatePresence mode="wait">
                <PageTransition key={location.pathname}>
                  <Outlet />
                </PageTransition>
              </AnimatePresence>
            </div>
          </main>

          <BottomNav />
          <CommandPalette />
        </div>
      </CalculatorsProvider>
    </AiToolsProvider>
  )
}
