import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { useOnboardingStore } from '@/features/onboarding/store'
import { creditsService } from '@/services/credits-service'
import { toast } from 'sonner'
import { Loader2, PartyPopper } from 'lucide-react'
import { cpfMask, isValidCpf, removeDocumentMask } from '@/lib/masks'
import confetti from 'canvas-confetti'

export function WelcomeCreditsModal() {
  const { user, setUser } = useAuthStore()
  const { isWelcomeModalOpen, openWelcomeModal, closeWelcomeModal, startTour } = useOnboardingStore()
  const [cpf, setCpf] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<'cpf' | 'success'>('cpf')

  useEffect(() => {
    // Show modal if user is logged in, hasn't claimed credits
    if (user && !user.welcome_credits_claimed) {
      openWelcomeModal()
    } else if (user?.welcome_credits_claimed && isWelcomeModalOpen) {
      // Ensure modal is closed if already claimed (fixes persisted state issues)
      closeWelcomeModal()
    }
  }, [user, isWelcomeModalOpen, openWelcomeModal, closeWelcomeModal])

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(cpfMask(e.target.value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isValidCpf(cpf)) {
      toast.error('CPF inválido')
      return
    }

    setIsLoading(true)
    try {
      const cleanCpf = removeDocumentMask(cpf)
      const result = await creditsService.claimWelcomeCredits(cleanCpf)
      
      if (result.success) {
        // Update user locally
        if (user) {
          setUser({ ...user, welcome_credits_claimed: true, cpf: cleanCpf })
        }
        
        setStep('success')
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        })

        // Inicia o tour automaticamente após o sucesso
        setTimeout(() => {
          closeWelcomeModal()
          startTour('dashboard')
        }, 1500)
      }
    } catch (error) {
      console.error('Failed to claim credits:', error)
      const err = error as { status?: number }
      if (err.status === 409) {
        toast.error('Este CPF já recebeu os créditos de boas-vindas.')
      } else if (err.status === 429) {
        toast.error('Muitas tentativas. Tente novamente mais tarde.')
      } else {
        toast.error('Erro ao reivindicar créditos. Tente novamente.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    closeWelcomeModal()
  }

  // Se não tiver usuário ou já tiver resgatado, não renderiza nada
  if (!user || user.welcome_credits_claimed) return null

  return (
    <Dialog open={isWelcomeModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        {step === 'cpf' ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PartyPopper className="w-5 h-5 text-yellow-500" />
                Ganhe 10 Créditos Grátis!
              </DialogTitle>
              <DialogDescription>
                Complete seu cadastro informando seu CPF para ganhar 10 créditos de boas-vindas e testar nossas ferramentas.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCpfChange}
                  maxLength={14}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Necessário para evitar fraudes e duplicidade de contas.
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:justify-between gap-2">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Depois
              </Button>
              <Button type="submit" disabled={isLoading || cpf.length < 14}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Resgatar Créditos'
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-2xl">Parabéns!</DialogTitle>
              <DialogDescription className="text-center">
                Você recebeu 10 créditos para usar como quiser.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 flex justify-center">
              <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <span className="text-4xl font-bold text-yellow-600 dark:text-yellow-400">10</span>
              </div>
            </div>
            <DialogFooter>
              <Button className="w-full" onClick={() => { handleClose(); startTour('dashboard'); }}>
                Começar a usar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
