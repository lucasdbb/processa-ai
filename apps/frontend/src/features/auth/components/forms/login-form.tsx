import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/use-auth'
import { loginSchema, type LoginFormData } from '../../schemas/auth-schemas'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface LoginFormProps {
  onSuccess: () => void
  onForgotPassword: () => void
  onRegister: () => void
}

export function LoginForm({ onSuccess, onForgotPassword, onRegister }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState('')
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const supabase = createClient()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    // Focus email input on mount with a small delay for animation
    const timer = setTimeout(() => {
      setFocus('email')
    }, 100)
    return () => clearTimeout(timer)
  }, [setFocus])

  const handleLogin = async (data: LoginFormData) => {
    setApiError('')

    try {
      const loggedUser = await login(data)
      toast.success('Login realizado com sucesso!')
      onSuccess()
      if (loggedUser?.role === 'office_client') {
        navigate('/portal', { replace: true })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao fazer login'
      setApiError(message)
    }
  }

  const handleGoogleSignIn = async () => {
    setApiError('')
    setIsGoogleLoading(true)
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        setApiError('Erro ao fazer login com Google. Tente novamente.')
        setIsGoogleLoading(false)
      }
    } catch {
      setApiError('Erro inesperado. Tente novamente.')
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {apiError && (
        <div className="bg-destructive/15 border border-destructive/20 rounded-xl p-3 flex items-start gap-2" role="alert">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-destructive font-medium">{apiError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(handleLogin)} className="space-y-3" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-1.5">
            E-mail
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" aria-hidden="true" />
            <input
              type="email"
              id="email"
              placeholder="seu@email.com"
              {...register('email')}
              className={`w-full bg-background border border-input text-foreground text-sm rounded-xl focus:ring-primary focus:border-primary block pl-10 p-2.5 transition-colors ${
                errors.email ? 'border-destructive focus:ring-destructive focus:border-destructive bg-destructive/5' : ''
              }`}
              autoComplete="email"
              aria-invalid={!!errors.email}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-xs text-destructive font-medium" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-foreground mb-1.5">
            Senha
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" aria-hidden="true" />
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              placeholder="••••••••"
              {...register('password')}
              className={`w-full bg-background border border-input text-foreground text-sm rounded-xl focus:ring-primary focus:border-primary block pl-10 pr-10 p-2.5 transition-colors ${
                errors.password ? 'border-destructive focus:ring-destructive focus:border-destructive bg-destructive/5' : ''
              }`}
              autoComplete="current-password"
              aria-invalid={!!errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-destructive font-medium" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full font-bold py-3 px-4 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm mt-2",
            isDark 
              ? "bg-white text-black hover:bg-gray-100" 
              : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Entrando...
            </>
          ) : (
            <span>Entrar</span>
          )}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <div className="h-px bg-border flex-1" />
        <span className="text-[10px] uppercase text-muted-foreground">Ou continue com</span>
        <div className="h-px bg-border flex-1" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading}
        className="w-full bg-white hover:bg-gray-50 text-gray-900 font-semibold py-3 px-4 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 shadow-sm flex items-center justify-center gap-3 text-sm"
      >
        {isGoogleLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        <span>Continuar com Google</span>
      </button>

      <div className="mt-4 space-y-3">
        <div className="text-center">
          <button
            onClick={onForgotPassword}
            className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            Esqueceu sua senha?
          </button>
        </div>

        <div className="text-center pt-3 border-t border-border">
          <p className="text-muted-foreground text-xs">
            Ainda não tem uma conta?
            <button 
              onClick={onRegister}
              className="text-primary hover:text-primary/80 font-bold ml-1.5 transition-colors"
            >
              Cadastre-se gratuitamente
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}