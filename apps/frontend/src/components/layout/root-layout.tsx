import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Header } from './header'
import { Footer } from './footer'
import { PageTransition } from './page-transition'
import { LoginModal } from '@/features/auth/components/login-modal'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { usePageTracking } from '@/lib/analytics/hooks'
import { createClient } from '@/lib/supabase/client'

type RootLayoutOutletContext = {
  openLoginModal: () => void
  openRegisterModal: () => void
}

function RouteLoadingBar() {
  const navigation = useNavigation()
  const isLoading = navigation.state !== 'idle'

  if (!isLoading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
      <div
        className="h-full bg-gray-900 animate-pulse transition-all duration-300"
        style={{
          width: '70%',
          animation: 'loading 1s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes loading {
          0% {
            width: 0%;
          }
          50% {
            width: 70%;
          }
          100% {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}

export function RootLayout() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [loginModalView, setLoginModalView] = useState<'login' | 'register' | 'reset_password'>('login')
  const location = useLocation()
  const supabase = createClient()

  // Initialize auth on app load
  useAuth()
  
  // Initialize analytics tracking
  usePageTracking()

  const isAdminRoute = location.pathname.startsWith('/admin')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setLoginModalView('reset_password')
        setIsLoginModalOpen(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const openLoginModal = () => {
    setLoginModalView('login')
    setIsLoginModalOpen(true)
  }

  const openRegisterModal = () => {
    setLoginModalView('register')
    setIsLoginModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-slate-700 selection:text-white flex flex-col">
      <RouteLoadingBar />
      {isAdminRoute ? null : <Header onLoginClick={openLoginModal} />}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet context={{ openLoginModal, openRegisterModal } satisfies RootLayoutOutletContext} />
          </PageTransition>
        </AnimatePresence>
      </main>
      {isAdminRoute ? null : <Footer />}
      {isLoginModalOpen && (
        <LoginModal
          key={loginModalView}
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          initialView={loginModalView}
        />
      )}
    </div>
  )
}

export type { RootLayoutOutletContext }
