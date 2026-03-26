import { useState, useEffect, useRef } from 'react'
import { X, ArrowLeft } from 'lucide-react'
import { LoginForm } from './forms/login-form'
import { RegisterForm } from './forms/register-form'
import { ForgotPasswordForm } from './forms/forgot-password-form'
import { ResetPasswordForm } from './forms/reset-password-form'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  initialView?: 'login' | 'register' | 'reset_password'
}

type AuthView = 'login' | 'register' | 'forgot_password' | 'reset_password'

export function LoginModal({ isOpen, onClose, initialView = 'login' }: LoginModalProps) {
  const [view, setView] = useState<AuthView>(initialView)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setView(initialView)
    }
  }, [isOpen, initialView])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  if (!isOpen) return null

  const getTitle = () => {
    switch (view) {
      case 'login': return 'Acesse sua conta'
      case 'register': return 'Crie sua conta'
      case 'forgot_password': return 'Recuperar senha'
      case 'reset_password': return 'Redefinir senha'
    }
  }

  const getDescription = () => {
    switch (view) {
      case 'login': return 'Bem-vindo de volta ao Processa AI'
      case 'register': return 'Comece a transformar sua advocacia hoje'
      case 'forgot_password': return 'Digite seu email para receber o link de recuperação'
      case 'reset_password': return 'Digite sua nova senha abaixo'
    }
  }

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-card text-card-foreground rounded-3xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col relative border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground hover:bg-muted/80 hover:scale-105 rounded-full p-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Fechar modal"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {view === 'forgot_password' && (
          <button
            onClick={() => setView('login')}
            className="absolute top-4 left-4 z-10 text-muted-foreground hover:text-foreground hover:bg-muted/80 hover:scale-105 rounded-full p-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Voltar para login"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        <div className="overflow-y-auto p-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          <div className="text-center mb-6">
            <h2 id="modal-title" className="text-2xl font-bold text-foreground tracking-tight">
              {getTitle()}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {getDescription()}
            </p>
          </div>

          {view === 'login' && (
            <LoginForm 
              onSuccess={onClose}
              onForgotPassword={() => setView('forgot_password')}
              onRegister={() => setView('register')}
            />
          )}

          {view === 'register' && (
            <RegisterForm 
              onSuccess={onClose}
              onLogin={() => setView('login')}
            />
          )}

          {view === 'forgot_password' && (
            <ForgotPasswordForm 
              onLogin={() => setView('login')}
            />
          )}

          {view === 'reset_password' && (
            <ResetPasswordForm 
              onSuccess={() => setView('login')}
              onLogin={() => setView('login')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
