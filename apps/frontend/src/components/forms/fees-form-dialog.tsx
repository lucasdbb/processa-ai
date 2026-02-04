import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { Fee, FeeType } from '@/services/fees-service'

interface FeesFormDialogProps {
  isOpen: boolean
  onClose: () => void
  clientId: string
  fee?: Fee
  onSave: (fee: Partial<Fee> & { id?: string }) => void | Promise<void>
  processes?: Array<{ id: string; number: string; title: string }>
}

const getInitialFormData = (fee?: Fee) => ({
  fee_type: fee?.fee_type ?? ('initial' as FeeType),
  description: fee?.description ?? '',
  amount: fee?.amount ? formatCurrency(fee.amount) : '',
  status: fee?.status ?? 'pending',
  due_date: fee?.due_date ?? '',
  process_id: fee?.process_id ?? '',
  notes: fee?.notes ?? '',
})

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

function FeesFormDialogBody({
  fee,
  isEditing,
  onClose,
  onSave,
  processes,
}: {
  fee?: Fee
  isEditing: boolean
  onClose: () => void
  onSave: (fee: Partial<Fee> & { id?: string }) => void | Promise<void>
  processes?: Array<{ id: string; number: string; title: string }>
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(fee))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Reset form when fee changes (create vs edit)
  useEffect(() => {
    setFormData(getInitialFormData(fee))
    setErrors({})
  }, [fee])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.description.trim()) {
      newErrors.description = 'Descrição é obrigatória'
    }

    const amountValue = parseCurrency(formData.amount)
    if (!amountValue || amountValue <= 0) {
      newErrors.amount = 'Valor deve ser maior que zero'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setIsSaving(true)

    try {
      const payload = {
        fee_type: formData.fee_type,
        description: formData.description,
        amount: parseCurrency(formData.amount),
        status: formData.status,
        due_date: formData.due_date || null,
        process_id: formData.process_id || null,
        notes: formData.notes || null,
      }

      if (isEditing && fee) {
        await onSave({ ...payload, id: fee.id })
      } else {
        await onSave(payload)
      }
      onClose()
    } catch (error) {
      console.error('Error saving fee:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    if (field === 'amount') {
      setFormData((prev) => ({ ...prev, [field]: formatCurrencyInput(value) }))
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const feeTypes = [
    { value: 'initial', label: 'Honorários Iniciais' },
    { value: 'success', label: 'Honorários de Êxito' },
    { value: 'monthly', label: 'Mensalidade' },
    { value: 'hourly', label: 'Por Hora' },
    { value: 'hearing', label: 'Por Audiência' },
    { value: 'petition', label: 'Por Petição' },
    { value: 'other', label: 'Outros' },
  ]

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar Honorário' : 'Novo Honorário'}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tipo <span className="text-destructive">*</span>
            </label>
            <select
              value={formData.fee_type}
              onChange={(e) => handleChange('fee_type', e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {feeTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Descrição <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className={cn(
                'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                errors.description ? 'border-destructive' : 'border-border'
              )}
              placeholder="Ex: Honorários iniciais do processo X"
            />
            {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Valor <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                  errors.amount ? 'border-destructive' : 'border-border'
                )}
                placeholder="R$ 0,00"
              />
              {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Status <span className="text-destructive">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="partial">Parcial</option>
                <option value="overdue">Vencido</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => handleChange('due_date', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {processes && processes.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Processo (opcional)
                </label>
                <select
                  value={formData.process_id}
                  onChange={(e) => handleChange('process_id', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Nenhum processo vinculado</option>
                  {processes.map((process) => (
                    <option key={process.id} value={process.id}>
                      {process.number} - {process.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Observações
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="Observações adicionais..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors text-sm font-medium"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar Alterações' : 'Criar Honorário'}
          </button>
        </div>
      </form>
    </DialogContent>
  )
}

export function FeesFormDialog({ isOpen, onClose, fee, onSave, processes }: FeesFormDialogProps) {
  const isEditing = !!fee

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <FeesFormDialogBody
        fee={fee}
        isEditing={isEditing}
        onClose={onClose}
        onSave={onSave}
        processes={processes}
      />
    </Dialog>
  )
}
