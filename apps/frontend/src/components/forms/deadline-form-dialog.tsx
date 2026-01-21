import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Deadline {
  id: string
  title: string
  processNumber: string
  processId?: string
  date: string
  time?: string
  type: 'contestacao' | 'recurso' | 'audiencia' | 'pericia' | 'outros'
  priority: 'alta' | 'media' | 'baixa'
  description?: string
  notifyBefore?: number // dias antes para notificar
}

interface DeadlineFormDialogProps {
  isOpen: boolean
  onClose: () => void
  deadline?: Deadline
  onSave: (deadline: Omit<Deadline, 'id'> & { id?: string }) => void
}

export function DeadlineFormDialog({
  isOpen,
  onClose,
  deadline,
  onSave,
}: DeadlineFormDialogProps) {
  const isEditing = !!deadline

  const [formData, setFormData] = useState({
    title: '',
    processNumber: '',
    processId: '',
    date: '',
    time: '',
    type: 'outros' as 'contestacao' | 'recurso' | 'audiencia' | 'pericia' | 'outros',
    priority: 'media' as 'alta' | 'media' | 'baixa',
    description: '',
    notifyBefore: 3,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (deadline) {
      setFormData({
        title: deadline.title,
        processNumber: deadline.processNumber,
        processId: deadline.processId || '',
        date: deadline.date,
        time: deadline.time || '',
        type: deadline.type,
        priority: deadline.priority,
        description: deadline.description || '',
        notifyBefore: deadline.notifyBefore || 3,
      })
    } else {
      setFormData({
        title: '',
        processNumber: '',
        processId: '',
        date: '',
        time: '',
        type: 'outros',
        priority: 'media',
        description: '',
        notifyBefore: 3,
      })
    }
    setErrors({})
  }, [deadline, isOpen])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Título do prazo é obrigatório'
    }

    if (!formData.processNumber.trim()) {
      newErrors.processNumber = 'Número do processo é obrigatório'
    }

    if (!formData.date) {
      newErrors.date = 'Data é obrigatória'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    const deadlineData = {
      ...formData,
      ...(isEditing && { id: deadline.id }),
    }

    onSave(deadlineData)
    onClose()
  }

  const handleChange = (field: keyof typeof formData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const deadlineTypes = [
    { value: 'contestacao', label: 'Contestação' },
    { value: 'recurso', label: 'Recurso' },
    { value: 'audiencia', label: 'Audiência' },
    { value: 'pericia', label: 'Perícia' },
    { value: 'outros', label: 'Outros' },
  ]

  const priorityOptions = [
    { value: 'alta', label: 'Alta' },
    { value: 'media', label: 'Média' },
    { value: 'baixa', label: 'Baixa' },
  ]

  const notifyOptions = [
    { value: 1, label: '1 dia antes' },
    { value: 3, label: '3 dias antes' },
    { value: 7, label: '7 dias antes' },
    { value: 15, label: '15 dias antes' },
    { value: 30, label: '30 dias antes' },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Prazo' : 'Novo Prazo'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Informações do Prazo</h3>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Título do Prazo <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                  errors.title ? 'border-destructive' : 'border-border'
                )}
                placeholder="Ex: Prazo para contestação"
              />
              {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Número do Processo <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.processNumber}
                  onChange={(e) => handleChange('processNumber', e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 bg-background border rounded-lg text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                    errors.processNumber ? 'border-destructive' : 'border-border'
                  )}
                  placeholder="0000000-00.0000.0.00.0000"
                />
                {errors.processNumber && (
                  <p className="mt-1 text-xs text-destructive">{errors.processNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Tipo de Prazo <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    handleChange(
                      'type',
                      e.target.value as
                        | 'contestacao'
                        | 'recurso'
                        | 'audiencia'
                        | 'pericia'
                        | 'outros'
                    )
                  }
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {deadlineTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Data de Vencimento <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleChange('date', e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                    errors.date ? 'border-destructive' : 'border-border'
                  )}
                />
                {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Horário
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => handleChange('time', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Prioridade
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    handleChange('priority', e.target.value as 'alta' | 'media' | 'baixa')
                  }
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {priorityOptions.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Notificar
                </label>
                <select
                  value={formData.notifyBefore}
                  onChange={(e) => handleChange('notifyBefore', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {notifyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Descrição/Observações
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="Adicione observações sobre este prazo..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              {isEditing ? 'Salvar Alterações' : 'Criar Prazo'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
