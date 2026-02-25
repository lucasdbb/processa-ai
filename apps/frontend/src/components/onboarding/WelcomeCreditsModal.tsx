import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { useOnboardingStore } from '@/features/onboarding/store'
import { creditsService } from '@/services/credits-service'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, PartyPopper } from 'lucide-react'
import { cpfMask, isValidCpf, removeDocumentMask } from '@/lib/masks'
import confetti from 'canvas-confetti'

export function WelcomeCreditsModal() {
  const { user, setUser } = useAuthStore()
  const { isWelcomeModalOpen, openWelcomeModal, closeWelcomeModal, startTour } = useOnboardingStore()
  const [cpf, setCpf] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)
  const [step, setStep] = useState<'cpf' | 'success'>('cpf')

  useEffect(() => {
    async function checkStatus() {
      if (!user) {
        setIsCheckingStatus(false)
        return
      }

      // Se já temos a flag localmente, confiamos nela primeiro para evitar flicker
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
          // Atualiza store local se estiver desatualizada
          setUser({ ...user, welcome_credits_claimed: true })
          closeWelcomeModal()
        } else {
          // Se não reivindicou, abre o modal
          openWelcomeModal()
        }
      } catch (err) {
        console.error('Erro ao verificar status de créditos:', err)
      } finally {
        setIsCheckingStatus(false)
      }
    }

    checkStatus()
  }, [user?.id, openWelcomeModal, closeWelcomeModal, setUser]) // Removido user completo das deps para evitar loop

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value
    // Remove tudo que não é dígito
    value = value.replace(/\D/g, '')
    // Limita a 11 dígitos
    if (value.length > 11) value = value.slice(0, 11)
    
    setCpf(cpfMask(value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const cleanCpf = removeDocumentMask(cpf)
    
    if (!isValidCpf(cleanCpf)) {
      toast.error('CPF inválido')
      return
    }

    setIsLoading(true)
    try {
      // 1. Tenta atualizar o perfil direto no Supabase
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cpf: cleanCpf })
        .eq('id', user?.id)

      if (updateError) throw updateError

      // 2. Chama o serviço de créditos para liberar os créditos
      const result = await creditsService.claimWelcomeCredits(cleanCpf)
      
      if (result.success) {
        // Atualiza estado local
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
        }, 2000)
      } else {
         toast.error('Erro ao reivindicar créditos.')
      }

    } catch (error: any) {
      console.error('Failed to claim credits:', error)
      if (error?.message?.includes('violates unique constraint') || error?.status === 409) {
        toast.error('Este CPF já está em uso por outra conta.')
      } else {
        toast.error('Erro ao processar solicitação. Tente novamente.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    // Só permite fechar se já tiver reivindicado (proteção extra)
    // Mas o botão "Depois" permite fechar temporariamente
    closeWelcomeModal()
  }

  // Se estiver checando, ou se não tiver user, ou se já reivindicou (e o modal não deveria estar aberto), não renderiza
  if (isCheckingStatus || !user || user.welcome_credits_claimed) return null

  // Se o modal não estiver aberto no estado global, não renderiza
  if (!isWelcomeModalOpen) return null

  return (
    <Dialog open={isWelcomeModalOpen} onOpenChange={(open) => {
      // Impede fechamento clicando fora se não tiver completado
      if (!open && step !== 'success') {
         // Opcional: permitir fechar clicando fora? O user pediu "obrigatório" no passado?
         // Por enquanto deixamos o botão "Depois" cuidar disso explicitamente
         // handleClose() 
      }
    }}>
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
                  disabled={isLoading}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Necessário para evitar fraudes e duplicidade de contas.
                </p>
              </div>
            </div>
            <DialogFooter className="flex-col sm:justify-between gap-2">
              <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>
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
          <div className="flex flex-col items-center">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl">Parabéns!</DialogTitle>
              <DialogDescription className="text-center">
                Você recebeu 10 créditos para usar como quiser.
              </DialogDescription>
            </DialogHeader>
            <div className="py-8 flex justify-center w-full">
              <div className="w-24 h-24 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center animate-bounce">
                <span className="text-4xl font-bold text-yellow-600 dark:text-yellow-400">10</span>
              </div>
            </div>
            <DialogFooter className="w-full">
              <Button className="w-full" onClick={() => { handleClose(); startTour('dashboard'); }}>
                Começar a usar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
