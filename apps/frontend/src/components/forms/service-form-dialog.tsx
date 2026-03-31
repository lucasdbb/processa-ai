import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { Service, ServiceCategory, ServiceCreate, ServiceUpdate } from '@/services/services-service'
import { ClientSelect } from '@/components/ui/client-select'
import { analytics } from '@/lib/analytics'

interface ServiceFormDialogProps {
  isOpen: boolean
  onClose: () => void
  service?: Service
  /** Se fornecido, o campo de cliente não é exibido (já está pré-definido) */
  clientId?: string
  onSave: (service: Partial<Service> & { id?: string; client_id?: string }) => void | Promise<void>
}

const getInitialFormData = (service?: Service) => ({
  name: service?.name ?? '',
  category: service?.category ?? ('outro' as ServiceCategory),
  value: service?.value ? formatCurrency(service.value) : '',
  status: service?.status ?? 'active',
  notes: service?.notes ?? '',
  is_partnership: service?.is_partnership ?? false,
  partner_lawyer: service?.partner_lawyer ?? '',
  partner_percentage: service?.partner_percentage?.toString() ?? '',
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

const categories: Array<{ value: ServiceCategory; label: string }> = [
  { value: 'previdenciario', label: 'Previdenciário' },
  { value: 'trabalhista', label: 'Trabalhista' },
  { value: 'civel', label: 'Cível' },
  { value: 'tributario', label: 'Tributário' },
  { value: 'familiar', label: 'Familiar' },
  { value: 'empresarial', label: 'Empresarial' },
  { value: 'imobiliario', label: 'Imobiliário' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'outro', label: 'Outro' },
]

function ServiceFormDialogBody({
  service,
  isEditing,
  clientId,
  onClose,
  onSave,
}: {
  service?: Service
  isEditing: boolean
  clientId?: string
  onClose: () => void
  onSave: (service: Partial<Service> & { id?: string; client_id?: string }) => void | Promise<void>
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(service))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientId ?? null)

  useEffect(() => {
    setFormData(getInitialFormData(service))
    setErrors({})
  }, [service])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório'
    }

    if (!isEditing && !clientId && !selectedClientId) {
      newErrors.client_id = 'Selecione um cliente'
    }

    if (formData.is_partnership) {
      if (!formData.partner_lawyer.trim()) {
        newErrors.partner_lawyer = 'Advogado(a) parceiro(a) é obrigatório'
      }
      const pct = parseFloat(formData.partner_percentage)
      if (!formData.partner_percentage || isNaN(pct) || pct < 0 || pct > 100) {
        newErrors.partner_percentage = 'Informe um percentual válido entre 0 e 100'
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
      const valueAmount = parseCurrency(formData.value)
      const partnerPct = formData.is_partnership && formData.partner_percentage
        ? parseFloat(formData.partner_percentage)
        : undefined

      const payload: ServiceCreate | ServiceUpdate = {
        name: formData.name,
        category: formData.category as ServiceCategory,
        value: valueAmount > 0 ? valueAmount : null,
        status: formData.status,
        notes: formData.notes || null,
        is_partnership: formData.is_partnership,
        partner_lawyer: formData.is_partnership ? formData.partner_lawyer || null : null,
        partner_percentage: formData.is_partnership ? partnerPct ?? null : null,
      }

      if (isEditing && service) {
        await onSave({ ...payload, id: service.id })
        analytics.track('office_action', { entity: 'service', action: 'updated', category: formData.category })
      } else {
        await onSave({ ...payload, client_id: clientId ?? selectedClientId ?? undefined })
        analytics.track('office_action', { entity: 'service', action: 'created', category: formData.category })
      }
      onClose()
    } catch (error) {
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    if (field === 'value') {
      setFormData((prev) => ({ ...prev, [field]: formatCurrencyInput(value) }))
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {/* Campo de cliente — apenas ao criar sem clientId pré-definido */}
          {!isEditing && !clientId && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Cliente <span className="text-destructive">*</span>
              </label>
              <ClientSelect
                value={selectedClientId ?? undefined}
                onChange={(id) => {
                  setSelectedClientId(id)
                  if (errors.client_id) setErrors((prev) => ({ ...prev, client_id: '' }))
                }}
                placeholder="Selecione um cliente..."
                error={errors.client_id}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Nome <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={cn(
                'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                errors.name ? 'border-destructive' : 'border-border'
              )}
              placeholder="Ex: Consultoria previdenciária, Análise de aposentadoria..."
            />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Categoria <span className="text-destructive">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Valor
              </label>
              <input
                type="text"
                value={formData.value}
                onChange={(e) => handleChange('value', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="R$ 0,00"
              />
            </div>
          </div>

          <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="active">Ativo</option>
                <option value="completed">Concluído</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

          {/* Parceria */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Parceria</p>
                <p className="text-xs text-muted-foreground mt-0.5">Este serviço é conduzido em parceria com outro advogado(a)?</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.is_partnership}
                onClick={() => {
                  setFormData((prev) => ({ ...prev, is_partnership: !prev.is_partnership }))
                  if (errors.partner_lawyer || errors.partner_percentage) {
                    setErrors((prev) => ({ ...prev, partner_lawyer: '', partner_percentage: '' }))
                  }
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  formData.is_partnership ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    formData.is_partnership ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {formData.is_partnership && (
              <div className="space-y-4 border-l-2 border-purple-500/30 pl-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Advogado(a) Parceiro(a) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.partner_lawyer}
                    onChange={(e) => handleChange('partner_lawyer', e.target.value)}
                    className={cn(
                      'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                      errors.partner_lawyer ? 'border-destructive' : 'border-border'
                    )}
                    placeholder="Nome ou OAB do advogado(a) parceiro(a)"
                  />
                  {errors.partner_lawyer && <p className="mt-1 text-xs text-destructive">{errors.partner_lawyer}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    % do Ganho do Escritório <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.partner_percentage}
                      onChange={(e) => handleChange('partner_percentage', e.target.value)}
                      className={cn(
                        'w-full pr-10 px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                        errors.partner_percentage ? 'border-destructive' : 'border-border'
                      )}
                      placeholder="Ex: 70"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Percentual dos honorários que fica com o escritório</p>
                  {errors.partner_percentage && <p className="mt-1 text-xs text-destructive">{errors.partner_percentage}</p>}
                </div>
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
            {isEditing ? 'Salvar Alterações' : 'Criar Serviço'}
          </button>
        </div>
      </form>
    </DialogContent>
  )
}

export function ServiceFormDialog({ isOpen, onClose, service, clientId, onSave }: ServiceFormDialogProps) {
  const isEditing = !!service

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <ServiceFormDialogBody
        service={service}
        isEditing={isEditing}
        clientId={clientId}
        onClose={onClose}
        onSave={onSave}
      />
    </Dialog>
  )
}
