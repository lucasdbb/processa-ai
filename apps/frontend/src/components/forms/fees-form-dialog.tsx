import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { Fee, FeeType } from '@/services/fees-service'
import { analytics } from '@/lib/analytics'

interface FeesFormDialogProps {
  isOpen: boolean
  onClose: () => void
  clientId: string
  fee?: Fee
  onSave: (fee: Partial<Fee> & { id?: string }) => void | Promise<void>
  onSaveBatch?: (fees: Array<Partial<Fee>>) => void | Promise<void>
  processes?: Array<{ id: string; number: string; title: string }>
  services?: Array<{ id: string; name: string; category: string }>
}

const getInitialFormData = (fee?: Fee) => ({
  linkType: (fee?.process_id ? 'process' : fee?.service_id ? 'service' : 'process') as 'process' | 'service',
  fee_type: fee?.fee_type ?? ('initial' as FeeType),
  description: fee?.description ?? '',
  amount: fee?.amount ? formatCurrency(fee.amount) : '',
  status: fee?.status ?? 'pending',
  due_date: fee?.due_date ?? '',
  process_id: fee?.process_id ?? '',
  service_id: fee?.service_id ?? '',
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
  onSaveBatch,
  processes,
  services,
}: {
  fee?: Fee
  isEditing: boolean
  onClose: () => void
  onSave: (fee: Partial<Fee> & { id?: string }) => void | Promise<void>
  onSaveBatch?: (fees: Array<Partial<Fee>>) => void | Promise<void>
  processes?: Array<{ id: string; number: string; title: string }>
  services?: Array<{ id: string; name: string; category: string }>
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(fee))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isInstallment, setIsInstallment] = useState(false)
  const [installmentCount, setInstallmentCount] = useState(2)
  const [firstDueDate, setFirstDueDate] = useState('')

  // Reset form when fee changes (create vs edit)
  useEffect(() => {
    setFormData(getInitialFormData(fee))
    setErrors({})
    setIsInstallment(false)
    setInstallmentCount(2)
    setFirstDueDate('')
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

    // Validate that either process or service is selected
    if (formData.linkType === 'process' && !formData.process_id) {
      newErrors.process_id = 'Selecione um processo'
    }
    if (formData.linkType === 'service' && !formData.service_id) {
      newErrors.service_id = 'Selecione um serviço'
    }

    // Validate installment fields
    if (!isEditing && isInstallment) {
      if (!installmentCount || installmentCount < 2 || installmentCount > 48) {
        newErrors.installmentCount = 'Entre 2 e 48 parcelas'
      }
      if (!firstDueDate) {
        newErrors.firstDueDate = 'Informe a data do primeiro vencimento'
      }
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
      const basePayload = {
        fee_type: formData.fee_type,
        description: formData.description,
        amount: parseCurrency(formData.amount),
        status: isInstallment ? 'pending' : formData.status,
        due_date: isInstallment ? null : (formData.due_date || null),
        process_id: formData.linkType === 'process' ? (formData.process_id || null) : null,
        service_id: formData.linkType === 'service' ? (formData.service_id || null) : null,
        notes: formData.notes || null,
      }

      if (isEditing && fee) {
        await onSave({ ...basePayload, id: fee.id })
        analytics.track('office_action', { entity: 'fee', action: 'updated', fee_type: formData.fee_type })
      } else if (isInstallment && onSaveBatch) {
        const installments = Array.from({ length: installmentCount }, (_, i) => {
          const date = new Date(firstDueDate + 'T12:00:00')
          date.setMonth(date.getMonth() + i)
          const dueDateStr = date.toISOString().split('T')[0]
          return {
            ...basePayload,
            description: `${basePayload.description} - Parcela ${i + 1}/${installmentCount}`,
            due_date: dueDateStr,
            status: 'pending' as const,
          }
        })
        await onSaveBatch(installments)
        analytics.track('office_action', { entity: 'fee', action: 'created', fee_type: formData.fee_type, is_installment: true, installment_count: installmentCount })
      } else {
        await onSave(basePayload)
        analytics.track('office_action', { entity: 'fee', action: 'created', fee_type: formData.fee_type })
      }
      onClose()
    } catch (error) {
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

  const installmentTotal = parseCurrency(formData.amount) * installmentCount

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
              placeholder={isInstallment ? 'Ex: Inventário Extrajudicial' : 'Ex: Honorários iniciais do processo X'}
            />
            {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description}</p>}
            {isInstallment && formData.description && (
              <p className="mt-1 text-xs text-muted-foreground">
                Cada parcela será nomeada: &quot;{formData.description} - Parcela 1/{installmentCount}&quot;
              </p>
            )}
          </div>

          {/* Radio Toggle: Processo ou Serviço */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Vincular a <span className="text-destructive">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="linkType"
                  value="process"
                  checked={formData.linkType === 'process'}
                  onChange={(e) => {
                    handleChange('linkType', e.target.value)
                    handleChange('service_id', '')
                  }}
                  className="h-4 w-4 text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground">Processo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="linkType"
                  value="service"
                  checked={formData.linkType === 'service'}
                  onChange={(e) => {
                    handleChange('linkType', e.target.value)
                    handleChange('process_id', '')
                  }}
                  className="h-4 w-4 text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground">Serviço</span>
              </label>
            </div>
          </div>

          {/* Conditional: Processo Dropdown */}
          {formData.linkType === 'process' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Processo <span className="text-destructive">*</span>
              </label>
              {processes && processes.length > 0 ? (
                <>
                  <select
                    value={formData.process_id}
                    onChange={(e) => handleChange('process_id', e.target.value)}
                    className={cn(
                      'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                      errors.process_id ? 'border-destructive' : 'border-border'
                    )}
                  >
                    <option value="">Selecione um processo</option>
                    {processes.map((process) => (
                      <option key={process.id} value={process.id}>
                        {process.number} - {process.title}
                      </option>
                    ))}
                  </select>
                  {errors.process_id && <p className="mt-1 text-xs text-destructive">{errors.process_id}</p>}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-2 px-3 border border-dashed border-border rounded-lg">
                  Nenhum processo cadastrado. Cadastre um processo primeiro.
                </p>
              )}
            </div>
          )}

          {/* Conditional: Serviço Dropdown */}
          {formData.linkType === 'service' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Serviço <span className="text-destructive">*</span>
              </label>
              {services && services.length > 0 ? (
                <>
                  <select
                    value={formData.service_id}
                    onChange={(e) => handleChange('service_id', e.target.value)}
                    className={cn(
                      'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                      errors.service_id ? 'border-destructive' : 'border-border'
                    )}
                  >
                    <option value="">Selecione um serviço</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} ({service.category})
                      </option>
                    ))}
                  </select>
                  {errors.service_id && <p className="mt-1 text-xs text-destructive">{errors.service_id}</p>}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-2 px-3 border border-dashed border-border rounded-lg">
                  Nenhum serviço cadastrado. Cadastre um serviço primeiro.
                </p>
              )}
            </div>
          )}

          <div className={cn('grid gap-4', isInstallment ? 'grid-cols-1' : 'grid-cols-2')}>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {isInstallment ? 'Valor da Parcela' : 'Valor'} <span className="text-destructive">*</span>
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

            {!isInstallment && (
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
                  <option value="overdue">Vencido</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            )}
          </div>

          {/* Installment Mode - only for new fees */}
          {!isEditing && (
            <div className={cn(
              'rounded-lg border p-4 transition-colors',
              isInstallment ? 'border-primary/30 bg-primary/5' : 'border-border'
            )}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInstallment}
                  onChange={(e) => setIsInstallment(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-foreground">Parcelado</span>
                <span className="text-xs text-muted-foreground">(criar varias parcelas de uma vez)</span>
              </label>

              {isInstallment && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Parcelas <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={48}
                        value={installmentCount}
                        onChange={(e) => {
                          setInstallmentCount(parseInt(e.target.value) || 2)
                          if (errors.installmentCount) {
                            setErrors((prev) => ({ ...prev, installmentCount: '' }))
                          }
                        }}
                        className={cn(
                          'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                          errors.installmentCount ? 'border-destructive' : 'border-border'
                        )}
                      />
                      {errors.installmentCount && <p className="mt-1 text-xs text-destructive">{errors.installmentCount}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Primeiro Vencimento <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="date"
                        value={firstDueDate}
                        onChange={(e) => {
                          setFirstDueDate(e.target.value)
                          if (errors.firstDueDate) {
                            setErrors((prev) => ({ ...prev, firstDueDate: '' }))
                          }
                        }}
                        className={cn(
                          'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                          errors.firstDueDate ? 'border-destructive' : 'border-border'
                        )}
                      />
                      {errors.firstDueDate && <p className="mt-1 text-xs text-destructive">{errors.firstDueDate}</p>}
                    </div>
                  </div>

                  {parseCurrency(formData.amount) > 0 && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-sm font-semibold text-foreground">
                        Total: {formatCurrency(installmentTotal)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {installmentCount}x de {formData.amount || 'R$ 0,00'} com vencimento mensal
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Due Date - only when not in installment mode */}
          {!isInstallment && (
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
          )}

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
            {isEditing
              ? 'Salvar Alterações'
              : isInstallment
                ? `Criar ${installmentCount} Parcelas`
                : 'Criar Honorário'}
          </button>
        </div>
      </form>
    </DialogContent>
  )
}

export function FeesFormDialog({ isOpen, onClose, fee, onSave, onSaveBatch, processes, services }: FeesFormDialogProps) {
  const isEditing = !!fee

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <FeesFormDialogBody
        fee={fee}
        isEditing={isEditing}
        onClose={onClose}
        onSave={onSave}
        onSaveBatch={onSaveBatch}
        processes={processes}
        services={services}
      />
    </Dialog>
  )
}
