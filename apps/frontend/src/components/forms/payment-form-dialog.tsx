import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Loader2, AlertCircle } from 'lucide-react'

interface PaymentFormDialogProps {
  isOpen: boolean
  onClose: () => void
  totalAmount: number
  paidAmount: number
  description: string
  onSave: (amount: number) => void | Promise<void>
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const parseCurrency = (value: string): number => {
  return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
}

const formatCurrencyInput = (value: string): string => {
  const numbers = value.replace(/\D/g, '')
  const amount = parseFloat(numbers) / 100
  return formatCurrency(amount)
}

export function PaymentFormDialog({
  isOpen,
  onClose,
  totalAmount,
  paidAmount,
  description,
  onSave,
}: PaymentFormDialogProps) {
  const remainingAmount = totalAmount - paidAmount

  const [amount, setAmount] = useState(() => formatCurrency(remainingAmount))
  const [date, setDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value)
    setAmount(formatted)
    setError('')
  }

  const validate = () => {
    const amountValue = parseCurrency(amount)
    if (!amountValue || amountValue <= 0) {
      setError('Valor deve ser maior que zero')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setIsSaving(true)

    try {
      const amountValue = parseCurrency(amount)
      await onSave(amountValue)
      // Reset form
      setAmount(formatCurrency(remainingAmount))
      setDate(new Date().toISOString().split('T')[0])
      setNotes('')
      setError('')
    } catch (err) {
      console.error('Error saving payment:', err)
      setError('Erro ao registrar pagamento')
    } finally {
      setIsSaving(false)
    }
  }

  const amountValue = parseCurrency(amount)
  const showOverpaymentWarning = amountValue > remainingAmount

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Info Section (Read-only) */}
          <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/50">
            <div>
              <p className="text-sm font-medium text-foreground">{description}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Valor total:</span>
                <p className="font-semibold text-foreground">{formatCurrency(totalAmount)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Já pago:</span>
                <p className="font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(paidAmount)}
                </p>
              </div>
            </div>
            <div className="pt-1 border-t border-border">
              <span className="text-xs text-muted-foreground">Saldo restante:</span>
              <p className="text-base font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(remainingAmount)}
              </p>
            </div>
          </div>

          {/* Payment Amount */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Valor do pagamento <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={amount}
              onChange={handleAmountChange}
              placeholder="R$ 0,00"
              className={cn(
                'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                'placeholder:text-muted-foreground',
                error ? 'border-destructive' : 'border-border'
              )}
            />
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
            {showOverpaymentWarning && !error && (
              <div className="mt-2 flex items-start gap-2 text-xs text-orange-600 dark:text-orange-400">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  O valor informado é maior que o saldo restante. Isso criará um crédito para o
                  cliente.
                </span>
              </div>
            )}
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Data do pagamento
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Adicione observações sobre este pagamento..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || !!error}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar Pagamento
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
