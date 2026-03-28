import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PartyPopper } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useBillingStore } from '@/stores/billing-store'

function fireConfetti() {
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.55 },
  })
  // Segunda rajada com leve delay para o efeito de "fogos"
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.65 },
    })
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.65 },
    })
  }, 300)
}

export function SubscriptionSuccessModal() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const invalidateSubscription = useBillingStore((s) => s.invalidate)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('subscription') === 'success') {
      setOpen(true)
      // Re-fetch subscription to reflect the new plan immediately
      invalidateSubscription()
      // Remove o query param da URL sem reload
      const newSearch = new URLSearchParams(location.search)
      newSearch.delete('subscription')
      const newUrl = `${location.pathname}${newSearch.toString() ? `?${newSearch}` : ''}`
      navigate(newUrl, { replace: true })
    }
  }, []) // Roda só na montagem

  useEffect(() => {
    if (open) {
      fireConfetti()
    }
  }, [open])

  function handleClose() {
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <div className="flex flex-col items-center text-center">
          <DialogHeader className="items-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-2">
              <PartyPopper className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-2xl">Assinatura ativada!</DialogTitle>
            <DialogDescription className="text-base">
              Parabéns! Seu plano está ativo e você já pode aproveitar todos os recursos.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 flex justify-center w-full">
            <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center animate-bounce">
              <span className="text-3xl">🎉</span>
            </div>
          </div>

          <DialogFooter className="w-full">
            <Button className="w-full" onClick={handleClose}>
              Começar a usar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
