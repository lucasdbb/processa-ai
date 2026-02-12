import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { Service, ServiceCategory } from '@/services/services-service'

interface ServiceFormDialogProps {
  isOpen: boolean
  onClose: () => void
  service?: Service
  onSave: (service: Partial<Service> & { id?: string }) => void | Promise<void>
}

const getInitialFormData = (service?: Service) => ({
  name: service?.name ?? '',
  category: service?.category ?? ('outro' as ServiceCategory),
  value: service?.value ? formatCurrency(service.value) : '',
  status: service?.status ?? 'active',
  notes: service?.notes ?? '',
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
  onClose,
  onSave,
}: {
  service?: Service
  isEditing: boolean
  onClose: () => void
  onSave: (service: Partial<Service> & { id?: string }) => void | Promise<void>
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(service))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setFormData(getInitialFormData(service))
    setErrors({})
  }, [service])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório'
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
      const payload = {
        name: formData.name,
        category: formData.category as ServiceCategory,
        value: valueAmount > 0 ? valueAmount : null,
        status: formData.status,
        notes: formData.notes || null,
      }

      if (isEditing && service) {
        await onSave({ ...payload, id: service.id })
      } else {
        await onSave(payload)
      }
      onClose()
    } catch (error) {
      console.error('Error saving service:', error)
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

          {isEditing && (
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
            {isEditing ? 'Salvar Alterações' : 'Criar Serviço'}
          </button>
        </div>
      </form>
    </DialogContent>
  )
}

export function ServiceFormDialog({ isOpen, onClose, service, onSave }: ServiceFormDialogProps) {
  const isEditing = !!service

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <ServiceFormDialogBody
        service={service}
        isEditing={isEditing}
        onClose={onClose}
        onSave={onSave}
      />
    </Dialog>
  )
}
