import { useState } from 'react'
import { Outlet, useNavigation } from 'react-router-dom'
import { PublicHeader } from './public-header'
import { Footer } from './footer'
import { LoginModal } from '@/features/auth/components/login-modal'
import { useAuth } from '@/features/auth/hooks/use-auth'

function RouteLoadingBar() {
  const navigation = useNavigation()
  const isLoading = navigation.state !== 'idle'

  if (!isLoading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-1 bg-muted">
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

export type PublicLayoutContext = {
  openLoginModal: () => void
  openRegisterModal: () => void
}

export function PublicLayout() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [loginModalView, setLoginModalView] = useState<'login' | 'register'>('login')

  // Initialize auth on app load
  useAuth()

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
      <PublicHeader onLoginClick={openLoginModal} />
      <main className="flex-1">
        <Outlet context={{ openLoginModal, openRegisterModal } satisfies PublicLayoutContext} />
      </main>
      <Footer />
      {isLoginModalOpen && (
        <LoginModal
          key={loginModalView}
          isOpen
          onClose={() => setIsLoginModalOpen(false)}
          initialView={loginModalView}
        />
      )}
    </div>
  )
}
