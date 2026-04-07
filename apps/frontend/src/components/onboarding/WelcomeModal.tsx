import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { useOnboardingStore } from '@/features/onboarding/store'
import { creditsService } from '@/services/credits-service'
import { authService } from '@/features/auth/services/auth-service'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'
import { cpfMask, phoneMask, isValidCpf, removeDocumentMask, removePhoneMask } from '@/lib/masks'
import confetti from 'canvas-confetti'

const AREAS = [
  'Trabalhista',
  'Cível',
  'Previdenciário',
  'Criminal',
  'Empresarial',
  'Tributário',
  'Família e Sucessões',
  'Imobiliário',
  'Ambiental',
  'Outro',
]

export function WelcomeModal() {
  const { user, setUser } = useAuthStore()
  const { isWelcomeModalOpen, closeWelcomeModal } = useOnboardingStore()

  // Form state
  const [company, setCompany] = useState('')
  const [area, setArea] = useState('')
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [isPhoneVerified, setIsPhoneVerified] = useState(false)
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null)
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null)
  const [nowTs, setNowTs] = useState(Date.now())
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const codeInputRef = useRef<HTMLInputElement | null>(null)
  const lastAutoSubmittedCode = useRef('')

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11)
    setCpf(cpfMask(raw))
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11)
    setPhone(phoneMask(raw))
    setCodeSent(false)
    setIsPhoneVerified(false)
    setVerificationCode('')
    setCodeExpiresAt(null)
    setResendAvailableAt(null)
    setVerificationError(null)
    lastAutoSubmittedCode.current = ''
  }

  const cleanCpf = useMemo(() => removeDocumentMask(cpf), [cpf])
  const cleanPhone = useMemo(() => removePhoneMask(phone), [phone])
  const isCpfValid = useMemo(() => isValidCpf(cleanCpf), [cleanCpf])
  const isPhoneValid = useMemo(() => cleanPhone.length === 10 || cleanPhone.length === 11, [cleanPhone])

  useEffect(() => {
    if (!codeSent || isPhoneVerified) return
    const timer = window.setInterval(() => {
      setNowTs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [codeSent, isPhoneVerified])

  useEffect(() => {
    if (codeSent && !isPhoneVerified) {
      codeInputRef.current?.focus()
    }
  }, [codeSent, isPhoneVerified])

  const secondsToExpire = useMemo(() => {
    if (!codeExpiresAt) return 0
    return Math.max(0, Math.floor((codeExpiresAt - nowTs) / 1000))
  }, [codeExpiresAt, nowTs])

  const secondsToResend = useMemo(() => {
    if (!resendAvailableAt) return 0
    return Math.max(0, Math.floor((resendAvailableAt - nowTs) / 1000))
  }, [resendAvailableAt, nowTs])

  const isCodeExpired = codeSent && !isPhoneVerified && secondsToExpire === 0

  const formatSeconds = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  const handleSendCode = async () => {
    if (!isPhoneValid) {
      toast.error('Informe um telefone válido para enviar o código.')
      return
    }

    setIsSendingCode(true)
    setVerificationError(null)
    try {
      const response = await creditsService.sendPhoneCode(cleanPhone)
      setCodeSent(true)
      setIsPhoneVerified(false)
      setVerificationCode('')
      setCodeExpiresAt(Date.now() + response.expires_in * 1000)
      setResendAvailableAt(Date.now() + 60 * 1000)
      lastAutoSubmittedCode.current = ''
      toast.success('Código enviado por SMS.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar código.'
      setVerificationError(message)
      toast.error(message)
    } finally {
      setIsSendingCode(false)
    }
  }

  const handleVerifyCode = async (codeOverride?: string) => {
    const codeToValidate = (codeOverride ?? verificationCode).trim()

    if (!isPhoneValid) {
      toast.error('Telefone inválido.')
      return
    }

    if (isCodeExpired) {
      setVerificationError('Código expirado. Reenvie um novo código.')
      toast.error('Código expirado. Reenvie um novo código.')
      return
    }

    if (codeToValidate.length !== 6) {
      toast.error('O código deve ter 6 dígitos.')
      return
    }

    setIsVerifyingCode(true)
    setVerificationError(null)
    try {
      await creditsService.verifyPhoneCode(cleanPhone, codeToValidate)
      setIsPhoneVerified(true)
      setVerificationError(null)
      toast.success('Telefone verificado com sucesso.')
    } catch (error) {
      setIsPhoneVerified(false)
      const message = error instanceof Error ? error.message : 'Código inválido.'
      setVerificationError(message)
      toast.error(message)
    } finally {
      setIsVerifyingCode(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return

    if (!isCpfValid) {
      toast.error('CPF inválido')
      return
    }

    if (!isPhoneValid) {
      toast.error('Telefone obrigatório e inválido.')
      return
    }

    if (!isPhoneVerified) {
      toast.error('Verifique seu telefone para liberar os créditos.')
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Claim credits (requires verified phone)
      const result = await creditsService.claimWelcomeCredits(cleanCpf, cleanPhone)
      if (!result.success) {
        toast.error('Erro ao resgatar créditos.')
        return
      }

      // 2. Update profile
      const updatedUser = await authService.updateProfile({
        cpf: cleanCpf,
        phone: cleanPhone,
        company: company.trim() || undefined,
        bio: area || undefined,
      })

      setUser({
        ...user!,
        ...updatedUser,
        welcome_credits_claimed: true,
        phone_verified: true,
      })
      closeWelcomeModal()

      // Celebrate
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
      toast.success('Acesso liberado! Você ganhou 10 créditos.', {
        description: 'Explore as ferramentas de IA e calculadoras.',
        duration: 5000,
      })
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string }
      if (err?.status === 409 || err?.message?.includes('CPF já cadastrado')) {
        toast.error('Este CPF já está em uso por outra conta.')
      } else if (err?.message?.includes('telefone')) {
        toast.error(err.message)
      } else {
        toast.error((err as Error)?.message || 'Erro ao processar. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user || !isWelcomeModalOpen) return null

  return (
    <Dialog open={isWelcomeModalOpen} onOpenChange={closeWelcomeModal}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Completar perfil</DialogTitle>

        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 shrink-0">
                <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Libere seus créditos
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ganhe <span className="font-semibold text-foreground">10 créditos gratuitos</span> ao completar seu perfil.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isPhoneVerified ? 'Etapa concluída' : codeSent ? 'Etapa 2 de 2' : 'Etapa 1 de 2'}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cpf">CPF <span className="text-red-500">*</span></Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCpfChange}
                  maxLength={14}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefone <span className="text-red-500">*</span></Label>
                <div className="flex gap-2">
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={handlePhoneChange}
                    maxLength={15}
                    disabled={isSubmitting}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendCode}
                    disabled={isSubmitting || isSendingCode || !isPhoneValid || (secondsToResend > 0 && codeSent)}
                  >
                    {isSendingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : (codeSent ? 'Reenviar' : 'Enviar código')}
                  </Button>
                </div>
                {!isPhoneValid && phone.trim().length > 0 && (
                  <p className="text-xs text-destructive">Telefone inválido. Use DDD + número.</p>
                )}
                {codeSent && !isPhoneVerified && (
                  <p className="text-xs text-muted-foreground">
                    {secondsToResend > 0
                      ? `Reenvio disponível em ${formatSeconds(secondsToResend)}`
                      : 'Você já pode reenviar um novo código.'}
                  </p>
                )}
                {isPhoneVerified && (
                  <p className="text-xs text-green-600 dark:text-green-400">Telefone verificado.</p>
                )}
              </div>
            </div>

            {codeSent && !isPhoneVerified && (
              <div className="space-y-1.5 rounded-lg border border-border p-3">
                <Label htmlFor="code">Código de verificação</Label>
                <div className="flex gap-2">
                  <Input
                    ref={codeInputRef}
                    id="code"
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setVerificationCode(value)
                      setVerificationError(null)

                      if (value.length < 6) {
                        lastAutoSubmittedCode.current = ''
                      }

                      if (
                        value.length === 6 &&
                        value !== lastAutoSubmittedCode.current &&
                        !isVerifyingCode &&
                        !isCodeExpired
                      ) {
                        lastAutoSubmittedCode.current = value
                        void handleVerifyCode(value)
                      }
                    }}
                    maxLength={6}
                    disabled={isSubmitting || isVerifyingCode || isPhoneVerified || isCodeExpired}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleVerifyCode()}
                    disabled={
                      isSubmitting ||
                      isVerifyingCode ||
                      verificationCode.length !== 6 ||
                      isPhoneVerified ||
                      isCodeExpired
                    }
                  >
                    {isVerifyingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verificar'}
                  </Button>
                </div>
                {!isPhoneVerified && (
                  <p className="text-xs text-muted-foreground">
                    {isCodeExpired
                      ? 'Código expirado. Reenvie um novo código.'
                      : `Código expira em ${formatSeconds(secondsToExpire)}`}
                  </p>
                )}
                {verificationError && (
                  <p className="text-xs text-destructive">{verificationError}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="area">Área de atuação <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Select value={area} onValueChange={setArea} disabled={isSubmitting}>
                <SelectTrigger id="area">
                  <SelectValue placeholder="Selecione uma área" />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company">Escritório <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                id="company"
                placeholder="Ex: Silva & Associados"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex items-center justify-end gap-3">
            <Button
              type="submit"
              disabled={isSubmitting || !isCpfValid || !isPhoneValid || !isPhoneVerified}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Liberando...</>
              ) : (
                'Liberar 10 créditos'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
