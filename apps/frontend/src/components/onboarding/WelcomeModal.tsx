import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { useOnboardingStore } from '@/features/onboarding/store'
import { creditsService } from '@/services/credits-service'
import { authService } from '@/features/auth/services/auth-service'
import { calendarService } from '@/services/calendar-service'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, PartyPopper, Calendar, Bot, Calculator, Users, Building2, Check } from 'lucide-react'
import { cpfMask, phoneMask, isValidCpf, removeDocumentMask, removePhoneMask } from '@/lib/masks'
import { cn } from '@/lib/utils'
import confetti from 'canvas-confetti'

type Step = 'perfil' | 'calendario' | 'sucesso'

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

const TOTAL_STEPS = 2 // passos antes do sucesso

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i < current ? 'w-4 bg-foreground' : i === current ? 'w-4 bg-foreground' : 'w-1.5 bg-border',
          )}
        />
      ))}
    </div>
  )
}

export function WelcomeModal() {
  const { user, setUser } = useAuthStore()
  const { isWelcomeModalOpen, openWelcomeModal, closeWelcomeModal, startTour } = useOnboardingStore()
  const navigate = useNavigate()

  // Step state
  const [step, setStep] = useState<Step>('perfil')

  // Step 1 — perfil
  const [company, setCompany] = useState('')
  const [area, setArea] = useState('')
  const [cpf, setCpf] = useState('')
  const [phone, setPhone] = useState('')
  const [isSubmittingPerfil, setIsSubmittingPerfil] = useState(false)

  // Step 2 — calendario
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false)
  const [googleConnected] = useState(false)

  // Initial check
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)

  useEffect(() => {
    async function checkStatus() {
      if (!user) {
        setIsCheckingStatus(false)
        return
      }

      if (user.welcome_credits_claimed) {
        closeWelcomeModal()
        setIsCheckingStatus(false)
        return
      }

      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('profiles')
          .select('welcome_credits_claimed')
          .eq('id', user.id)
          .single()

        if (error) throw error

        if (data?.welcome_credits_claimed) {
          setUser({ ...user, welcome_credits_claimed: true })
          closeWelcomeModal()
        } else {
          openWelcomeModal()
        }
      } catch (err) {
        console.error('Erro ao verificar status de créditos:', err)
      } finally {
        setIsCheckingStatus(false)
      }
    }

    checkStatus()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11)
    setCpf(cpfMask(raw))
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11)
    setPhone(phoneMask(raw))
  }

  const handleSubmitPerfil = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanCpf = removeDocumentMask(cpf)
    if (!isValidCpf(cleanCpf)) {
      toast.error('CPF inválido')
      return
    }

    setIsSubmittingPerfil(true)
    try {
      // 1. Resgata créditos (valida CPF único no backend)
      const result = await creditsService.claimWelcomeCredits(cleanCpf)
      if (!result.success) {
        toast.error('Erro ao resgatar créditos.')
        return
      }

      // 2. Atualiza perfil completo via backend
      const updatedUser = await authService.updateProfile({
        cpf: cleanCpf,
        phone: phone.trim() ? removePhoneMask(phone) : undefined,
        company: company.trim() || undefined,
        bio: area || undefined,
      })

      setUser({ ...user!, ...updatedUser, welcome_credits_claimed: true })

      setStep('calendario')
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string }
      if (err?.status === 409 || err?.message?.includes('CPF já cadastrado')) {
        toast.error('Este CPF já está em uso por outra conta.')
      } else {
        toast.error((err as Error)?.message || 'Erro ao processar. Tente novamente.')
      }
    } finally {
      setIsSubmittingPerfil(false)
    }
  }

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true)
    try {
      const { auth_url } = await calendarService.connectGoogle()
      window.location.href = auth_url
    } catch {
      toast.error('Erro ao conectar com Google Calendar.')
      setIsConnectingGoogle(false)
    }
  }

  const handleFinish = (destination?: string) => {
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
    closeWelcomeModal()
    if (destination) {
      navigate(destination)
    } else {
      startTour('dashboard')
    }
  }

  // ── Guard ─────────────────────────────────────────────────────────────────────

  // Não renderiza enquanto verifica o status ou se não há usuário
  if (isCheckingStatus || !user) return null
  // Só bloqueia por welcome_credits_claimed se o modal estiver fechado
  // (durante os steps do wizard o crédito já foi marcado mas ainda mostramos os próximos passos)
  if (!isWelcomeModalOpen) return null

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Dialog
      open={isWelcomeModalOpen}
      onOpenChange={() => {/* bloqueado — só fecha via botões */}}
    >
      <DialogContent
        className="sm:max-w-md p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        {/* ── Passo 1: Perfil ── */}
        {step === 'perfil' && (
          <form onSubmit={handleSubmitPerfil}>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-center justify-between mb-1">
                <StepDots current={0} />
                <span className="text-xs text-muted-foreground">Passo 1 de {TOTAL_STEPS}</span>
              </div>
              <h2 className="text-lg font-semibold text-foreground mt-3">
                Bem-vindo ao Processa AI
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure seu perfil e ganhe <span className="font-semibold text-foreground">10 créditos</span> para começar.
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="company">Nome do escritório <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  id="company"
                  placeholder="Ex: Silva & Associados"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={isSubmittingPerfil}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="area">Principal área de atuação <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Select value={area} onValueChange={setArea} disabled={isSubmittingPerfil}>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cpf">CPF <span className="text-red-500">*</span></Label>
                  <Input
                    id="cpf"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={handleCpfChange}
                    maxLength={14}
                    disabled={isSubmittingPerfil}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={handlePhoneChange}
                    maxLength={15}
                    disabled={isSubmittingPerfil}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={closeWelcomeModal}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={isSubmittingPerfil}
              >
                Preencher depois
              </button>
              <Button type="submit" disabled={isSubmittingPerfil || cpf.length < 14}>
                {isSubmittingPerfil ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Verificando...</>
                ) : (
                  'Continuar →'
                )}
              </Button>
            </div>
          </form>
        )}

        {/* ── Passo 2: Google Calendar ── */}
        {step === 'calendario' && (
          <div>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-center justify-between mb-1">
                <StepDots current={1} />
                <span className="text-xs text-muted-foreground">Passo 2 de {TOTAL_STEPS}</span>
              </div>
              <h2 className="text-lg font-semibold text-foreground mt-3">
                Conecte seu Google Calendar
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Sincronize prazos e audiências automaticamente. Nunca mais perca uma data.
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {googleConnected ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">Conectado!</p>
                    <p className="text-xs text-green-600 dark:text-green-400">Google Calendar sincronizado com sucesso.</p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={isConnectingGoogle}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-muted/40 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    {isConnectingGoogle ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : (
                      <Calendar className="w-5 h-5 text-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {isConnectingGoogle ? 'Conectando...' : 'Conectar com Google Calendar'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Seus prazos processuais aparecem automaticamente na agenda
                    </p>
                  </div>
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep('sucesso')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Conectar depois
              </button>
              <Button onClick={() => setStep('sucesso')}>
                Continuar →
              </Button>
            </div>
          </div>
        )}

        {/* ── Passo 3: Sucesso ── */}
        {step === 'sucesso' && (
          <div>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mb-3">
                <PartyPopper className="w-7 h-7 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Tudo pronto!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Você ganhou <span className="font-semibold text-foreground">10 créditos</span> para explorar as ferramentas.
              </p>
            </div>

            {/* Atalhos */}
            <div className="px-6 py-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Por onde quer começar?
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Usar IA Jurídica', icon: Bot, path: '/app/ia' },
                  { label: 'Calculadoras', icon: Calculator, path: '/app/calculadoras' },
                  { label: 'Meus Processos', icon: Building2, path: '/app/processos' },
                  { label: 'Meus Clientes', icon: Users, path: '/app/clientes' },
                ].map(({ label, icon: Icon, path }) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => handleFinish(path)}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/40 transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-foreground" />
                    </div>
                    <span className="text-sm font-medium text-foreground leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <Button variant="ghost" className="w-full" onClick={() => handleFinish()}>
                Ir para o Dashboard
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
