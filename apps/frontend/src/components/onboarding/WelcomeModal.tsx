import { useState } from 'react'
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
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11)
    setCpf(cpfMask(raw))
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11)
    setPhone(phoneMask(raw))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSubmitting) return

    const cleanCpf = removeDocumentMask(cpf)
    if (!isValidCpf(cleanCpf)) {
      toast.error('CPF inválido')
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Claim credits (validates unique CPF on backend)
      const result = await creditsService.claimWelcomeCredits(cleanCpf)
      if (!result.success) {
        toast.error('Erro ao resgatar créditos.')
        return
      }

      // 2. Update profile
      const updatedUser = await authService.updateProfile({
        cpf: cleanCpf,
        phone: phone.trim() ? removePhoneMask(phone) : undefined,
        company: company.trim() || undefined,
        bio: area || undefined,
      })

      setUser({ ...user!, ...updatedUser, welcome_credits_claimed: true })
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
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
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
                <Label htmlFor="phone">Telefone <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  id="phone"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength={15}
                  disabled={isSubmitting}
                />
              </div>
            </div>

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
            <Button type="submit" disabled={isSubmitting || cpf.length < 14}>
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
