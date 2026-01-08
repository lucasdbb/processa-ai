'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { X, Eye, EyeOff, Mail, Lock, User, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/use-auth'
import {
  loginSchema,
  registerSchema,
  type LoginFormData,
  type RegisterFormData,
} from '../schemas/auth-schemas'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  initialView?: 'login' | 'register'
}

export function LoginModal({ isOpen, onClose, initialView = 'login' }: LoginModalProps) {
  const [isLogin, setIsLogin] = useState(initialView === 'login')
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const { login, register: registerUser } = useAuth()

  const modalRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      newsletter_opt_in: false,
    },
  })

  const currentForm = isLogin ? loginForm : registerForm
  const isLoading = currentForm.formState.isSubmitting

  // Reset form when modal opens/closes or mode changes
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setIsLogin(initialView === 'login')
    } else {
      document.body.style.overflow = 'unset'
    }

    setApiError('')
    setSuccessMessage('')
    loginForm.reset()
    registerForm.reset()

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, initialView, loginForm, registerForm])

  // Focus management
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      firstInputRef.current.focus()
    }
  }, [isOpen, isLogin])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleLogin = async (data: LoginFormData) => {
    setApiError('')
    setSuccessMessage('')

    try {
      await login(data)
      toast.success('Login realizado com sucesso!')
      onClose()
      loginForm.reset()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao fazer login'
      setApiError(message)
    }
  }

  const handleRegister = async (data: RegisterFormData) => {
    setApiError('')
    setSuccessMessage('')

    try {
      await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
        newsletter_opt_in: data.newsletter_opt_in,
      })
      setSuccessMessage('Solicitação enviada com sucesso! Confirme o seu e-mail.')
      toast.success('Conta criada com sucesso! Verifique seu email.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao criar conta'
      setApiError(message)
    }
  }

  const handleModeToggle = () => {
    setIsLogin(!isLogin)
    setApiError('')
    setSuccessMessage('')
    loginForm.reset()
    registerForm.reset()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

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
        className="bg-card text-card-foreground rounded-3xl shadow-2xl max-w-md w-full p-6 relative border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Fechar modal de login"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Título */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-slate-900 rounded-xl mb-3 text-white">
            <User className="h-5 w-5" />
          </div>
          <h2 id="modal-title" className="text-2xl font-bold text-foreground tracking-tight">
            {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
          </h2>
          <p className="text-muted-foreground mt-1 text-base">
            {isLogin ? 'Acesse seu painel jurídico' : 'Comece a transformar sua advocacia'}
          </p>
        </div>

        {/* Mensagens de Erro e Sucesso */}
        {apiError && (
          <div
            className="bg-destructive/15 border border-destructive/20 rounded-xl p-4 flex items-start gap-3 mb-6"
            role="alert"
          >
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-destructive font-medium">{apiError}</p>
          </div>
        )}

        {successMessage && (
          <div
            className="bg-green-500/15 border border-green-500/20 rounded-xl p-4 flex items-start gap-3 mb-6"
            role="alert"
          >
            <AlertCircle
              className="h-5 w-5 text-[hsl(var(--success))] flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p className="text-sm text-[hsl(var(--success-strong))] font-medium">{successMessage}</p>
          </div>
        )}

        {/* Formulário */}
        <form
          onSubmit={
            isLogin
              ? loginForm.handleSubmit(handleLogin)
              : registerForm.handleSubmit(handleRegister)
          }
          className="space-y-4"
          noValidate
        >
          {/* Nome - Apenas no registro */}
          {!isLogin && (
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-foreground mb-1.5">
                Nome Completo
              </label>
              <div className="relative">
                <User
                  className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5"
                  aria-hidden="true"
                />
                <input
                  {...(!isLogin ? { ref: firstInputRef } : {})}
                  type="text"
                  id="name"
                  placeholder="Seu nome completo"
                  {...registerForm.register('name')}
                  className={`w-full bg-background border border-input text-foreground text-sm rounded-xl focus:ring-primary focus:border-primary block pl-10 p-2.5 transition-colors ${
                    registerForm.formState.errors.name
                      ? 'border-destructive focus:ring-destructive focus:border-destructive bg-destructive/5'
                      : ''
                  }`}
                  aria-invalid={!!registerForm.formState.errors.name}
                />
              </div>
              {registerForm.formState.errors.name && (
                <p className="mt-1 text-sm text-destructive font-medium" role="alert">
                  {registerForm.formState.errors.name.message}
                </p>
              )}
            </div>
          )}

          {/* E-mail */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-1.5">
              E-mail
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5"
                aria-hidden="true"
              />
              <input
                {...(isLogin ? { ref: firstInputRef } : {})}
                type="email"
                id="email"
                placeholder="seu@email.com"
                {...(isLogin ? loginForm.register('email') : registerForm.register('email'))}
                className={`w-full bg-background border border-input text-foreground text-sm rounded-xl focus:ring-primary focus:border-primary block pl-10 p-2.5 transition-colors ${
                  currentForm.formState.errors.email
                    ? 'border-destructive focus:ring-destructive focus:border-destructive bg-destructive/5'
                    : ''
                }`}
                autoComplete="email"
                aria-invalid={!!currentForm.formState.errors.email}
              />
            </div>
            {currentForm.formState.errors.email && (
              <p className="mt-1 text-sm text-destructive font-medium" role="alert">
                {currentForm.formState.errors.email.message}
              </p>
            )}
          </div>

          {/* Senha */}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-foreground mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5"
                aria-hidden="true"
              />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="••••••••"
                {...(isLogin ? loginForm.register('password') : registerForm.register('password'))}
                className={`w-full bg-background border border-input text-foreground text-sm rounded-xl focus:ring-primary focus:border-primary block pl-10 pr-10 p-2.5 transition-colors ${
                  currentForm.formState.errors.password
                    ? 'border-destructive focus:ring-destructive focus:border-destructive bg-destructive/5'
                    : ''
                }`}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                aria-invalid={!!currentForm.formState.errors.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
            {currentForm.formState.errors.password && (
              <p className="mt-1 text-sm text-destructive font-medium" role="alert">
                {currentForm.formState.errors.password.message}
              </p>
            )}
            {!currentForm.formState.errors.password && !isLogin && (
              <p className="mt-1 text-xs text-muted-foreground">
                Mínimo 8 caracteres, maiúscula, minúscula e número
              </p>
            )}
          </div>

          {/* Confirmar Senha - Apenas no registro */}
          {!isLogin && (
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-semibold text-foreground mb-1.5"
              >
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5"
                  aria-hidden="true"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  placeholder="••••••••"
                  {...registerForm.register('confirmPassword')}
                  className={`w-full bg-background border border-input text-foreground text-sm rounded-xl focus:ring-primary focus:border-primary block pl-10 p-2.5 transition-colors ${
                    registerForm.formState.errors.confirmPassword
                      ? 'border-destructive focus:ring-destructive focus:border-destructive bg-destructive/5'
                      : ''
                  }`}
                  autoComplete="new-password"
                  aria-invalid={!!registerForm.formState.errors.confirmPassword}
                />
              </div>
              {registerForm.formState.errors.confirmPassword && (
                <p className="mt-1 text-sm text-destructive font-medium" role="alert">
                  {registerForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
          )}

          {/* Newsletter - Apenas no registro */}
          {!isLogin && (
            <div className="flex items-center space-x-2">
              <input
                id="newsletter"
                type="checkbox"
                {...registerForm.register('newsletter_opt_in')}
                className="h-4 w-4 rounded border-input text-primary focus:ring-primary bg-background"
              />
              <label htmlFor="newsletter" className="text-sm text-muted-foreground">
                Quero receber novidades e atualizações por email
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl focus:outline-none focus:ring-4 focus:ring-ring/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/20 !mt-6"
          >
            {isLoading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {isLoading
              ? 'Processando...'
              : isLogin
                ? 'Entrar na Plataforma'
                : 'Criar Conta Gratuita'}
          </button>
        </form>

        {/* Footer Actions */}
        <div className="mt-4 space-y-4">
          {/* Forgot Password */}
          {isLogin && (
            <div className="text-center">
              <button
                onClick={() => toast.info('Função em desenvolvimento')}
                className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
              >
                Esqueceu sua senha?
              </button>
            </div>
          )}

          {/* Toggle Login/Registro */}
          <div className="text-center pt-4 border-t border-border">
            <p className="text-muted-foreground text-sm">
              {isLogin ? 'Ainda não tem uma conta?' : 'Já possui cadastro?'}
              <button
                onClick={handleModeToggle}
                className="text-primary hover:text-primary/80 font-bold ml-1.5 transition-colors"
              >
                {isLogin ? 'Cadastre-se gratuitamente' : 'Fazer login'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
