import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { RouteLoadingBar } from './route-loading-bar'
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
import { useBillingStore } from '@/stores/billing-store'
import { useCreditsStore } from '@/stores/credits-store'

import { WelcomeModal } from '@/components/onboarding/WelcomeModal'
import { SubscriptionSuccessModal } from '@/components/billing/SubscriptionSuccessModal'

export function AppLayout() {
  const location = useLocation()
  const { isExpanded } = useSidebarStore()
  const { toggle: toggleCommandPalette } = useCommandPaletteStore()
  const { fetchSubscription } = useBillingStore()
  const { subscribeToCredits, unsubscribeFromCredits, fetchCredits } = useCreditsStore()

  // Initialize auth
  const { user } = useAuth()

  // Initialize billing + re-validate on window focus
  useEffect(() => {
    fetchSubscription()

    const onFocus = () => fetchSubscription()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchSubscription])

  // Initialize credits realtime subscription
  useEffect(() => {
    if (user?.id) {
      // Fetch initial credits
      fetchCredits()
      // Subscribe to realtime updates
      subscribeToCredits(user.id)
    }
    return () => {
      unsubscribeFromCredits()
    }
  }, [user?.id, subscribeToCredits, unsubscribeFromCredits, fetchCredits])

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
          <RouteLoadingBar topClass="top-16" />
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
          <WelcomeModal />
          <SubscriptionSuccessModal />
        </div>
      </CalculatorsProvider>
    </AiToolsProvider>
  )
}
