import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { RouteLoadingBar } from './route-loading-bar'
import { PublicHeader } from './public-header'
import { Footer } from './footer'
import { LoginModal } from '@/features/auth/components/login-modal'
import { useAuth } from '@/features/auth/hooks/use-auth'

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
