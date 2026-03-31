import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Mail, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../../schemas/auth-schemas'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface ForgotPasswordFormProps {
  onLogin: () => void
}

export function ForgotPasswordForm({ onLogin }: ForgotPasswordFormProps) {
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
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setFocus('email')
    }, 100)
    return () => clearTimeout(timer)
  }, [setFocus])

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setApiError('')
    setSuccessMessage('')
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/`,
      })

      if (error) throw error

      setSuccessMessage('Email de recuperação enviado! Verifique sua caixa de entrada.')
      toast.success('Email de recuperação enviado!')
      reset()
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Erro ao enviar email de recuperação'
      const errorCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code ?? '')
          : ''
      
      // Handle rate limit error
      if (
        message.toLowerCase().includes('rate limit') || 
        message.toLowerCase().includes('too many requests') ||
        errorCode === 'over_email_send_rate_limit'
      ) {
        message = 'Muitas tentativas recentes. Por favor, aguarde 60 segundos antes de tentar novamente.'
      }

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

      <form onSubmit={handleSubmit(handleForgotPassword)} className="space-y-3" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-1.5">
            E-mail cadastrado
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

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full font-bold py-3 px-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm mt-2",
            isDark 
              ? "bg-white text-black hover:bg-gray-100 hover:shadow-md" 
              : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/25"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Enviando...
            </>
          ) : (
            <span>Enviar link de recuperação</span>
          )}
        </button>
      </form>

      <div className="mt-4 space-y-3">
        <div className="text-center pt-3 border-t border-border">
          <p className="text-muted-foreground text-xs">
            Lembrou sua senha?
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