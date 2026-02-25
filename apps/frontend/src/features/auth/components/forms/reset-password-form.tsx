import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { resetPasswordSchema, type ResetPasswordFormData } from '../../schemas/auth-schemas'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface ResetPasswordFormProps {
  onSuccess: () => void
  onLogin: () => void
}

export function ResetPasswordForm({ onSuccess, onLogin }: ResetPasswordFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const supabase = createClient()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
    reset,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setFocus('password')
    }, 100)
    return () => clearTimeout(timer)
  }, [setFocus])

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    setApiError('')
    setSuccessMessage('')
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password
      })

      if (error) throw error

      setSuccessMessage('Senha atualizada com sucesso! Você já pode fazer login.')
      toast.success('Senha atualizada com sucesso!')
      reset()
      
      // Call success callback after delay
      setTimeout(() => {
        onSuccess()
      }, 2000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar senha'
      setApiError(message)
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

      {successMessage && (
        <div className="bg-green-500/15 border border-green-500/20 rounded-xl p-3 flex items-start gap-2" role="alert">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">{successMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(handleResetPassword)} className="space-y-3" noValidate>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-foreground mb-1.5">
              Nova Senha
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
                autoComplete="new-password"
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
            {!errors.password && (
              <p className="mt-1 text-[10px] text-muted-foreground">Mínimo 8 caracteres</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-foreground mb-1.5">
              Confirmar Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                placeholder="••••••••"
                {...register('confirmPassword')}
                className={`w-full bg-background border border-input text-foreground text-sm rounded-xl focus:ring-primary focus:border-primary block pl-10 p-2.5 transition-colors ${
                  errors.confirmPassword ? 'border-destructive focus:ring-destructive focus:border-destructive bg-destructive/5' : ''
                }`}
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
              />
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-destructive font-medium" role="alert">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
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
              Atualizando...
            </>
          ) : (
            <span>Redefinir Senha</span>
          )}
        </button>
      </form>

      <div className="mt-4 space-y-3">
        <div className="text-center pt-3 border-t border-border">
          <p className="text-muted-foreground text-xs">
            Voltar para login
            <button 
              onClick={onLogin} 
              className="text-primary hover:text-primary/80 font-bold ml-1.5 transition-colors"
            >
              Fazer login
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}