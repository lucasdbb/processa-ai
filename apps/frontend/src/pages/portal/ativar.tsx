'use client'

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Lock, CheckCircle } from 'lucide-react'

type Step = 'loading' | 'set-password' | 'done' | 'error'

export default function PortalAtivarPage() {
  const navigate = useNavigate()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // On mount Supabase JS will automatically detect the #access_token in the
  // URL fragment and establish a session via onAuthStateChange.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Session exchanged from the invite token — ask for password
        setStep('set-password')
      }
    })

    // Check if there is already a session (e.g. user refreshed the page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStep('set-password')
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 8) {
      setErrorMsg('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setErrorMsg('As senhas não coincidem.')
      return
    }

    setErrorMsg('')
    setSubmitting(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setStep('done')
      // Redirect to portal after a brief pause
      setTimeout(() => navigate('/portal', { replace: true }), 2500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao definir senha'
      setErrorMsg(message)
    } finally {
      setSubmitting(false)
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="text-sm text-muted-foreground">Verificando convite…</p>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Conta ativada!</h1>
          <p className="text-sm text-muted-foreground">
            Sua senha foi definida. Redirecionando para o portal…
          </p>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Link inválido</h1>
          <p className="text-sm text-muted-foreground">
            Este link de ativação expirou ou já foi utilizado. Solicite um novo convite ao seu advogado.
          </p>
        </div>
      </div>
    )
  }

  // step === 'set-password'
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Lock className="w-7 h-7 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Ative sua conta</h1>
          <p className="text-sm text-muted-foreground">
            Defina uma senha para acessar o Portal do Cliente.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSetPassword} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Nova senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="confirm" className="text-sm font-medium text-foreground">
              Confirmar senha
            </label>
            <input
              id="confirm"
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a senha"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Salvando…' : 'Ativar conta'}
          </button>
        </form>
      </div>
    </div>
  )
}
