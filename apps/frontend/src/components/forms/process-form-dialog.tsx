import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Process {
  id: string
  number: string
  type: string
  court: string
  client: string
  defendant: string
  value: number
  status: 'active' | 'archived'
  distributionDate?: string
  description?: string
}

interface ProcessFormDialogProps {
  isOpen: boolean
  onClose: () => void
  process?: Process
  onSave: (process: Omit<Process, 'id'> & { id?: string }) => void
}

const getInitialFormData = (process?: Process) => ({
  number: process?.number ?? '',
  type: process?.type ?? '',
  court: process?.court ?? '',
  client: process?.client ?? '',
  defendant: process?.defendant ?? '',
  value: process?.value ? process.value.toString() : '',
  status: process?.status ?? ('active' as 'active' | 'archived'),
  distributionDate: process?.distributionDate ?? '',
  description: process?.description ?? '',
})

function ProcessFormDialogBody({
  process,
  isEditing,
  onClose,
  onSave,
}: {
  process?: Process
  isEditing: boolean
  onClose: () => void
  onSave: (process: Omit<Process, 'id'> & { id?: string }) => void
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(process))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.number.trim()) {
      newErrors.number = 'Número do processo é obrigatório'
    }

    if (!formData.type.trim()) {
      newErrors.type = 'Tipo de processo é obrigatório'
    }

    if (!formData.court.trim()) {
      newErrors.court = 'Vara/Tribunal é obrigatório'
    }

    if (!formData.client.trim()) {
      newErrors.client = 'Cliente/Autor é obrigatório'
    }

    if (!formData.defendant.trim()) {
      newErrors.defendant = 'Réu é obrigatório'
    }

    if (!formData.value.trim()) {
      newErrors.value = 'Valor da causa é obrigatório'
    } else if (isNaN(Number(formData.value)) || Number(formData.value) <= 0) {
      newErrors.value = 'Valor inválido'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    const processData = {
      ...formData,
      value: Number(formData.value),
      ...(process ? { id: process.id } : {}),
    }

    onSave(processData)
    onClose()
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const processTypes = [
    'Reclamação Trabalhista',
    'Ação Civil Pública',
    'Ação de Cobrança',
    'Ação de Indenização',
    'Ação Previdenciária',
    'Execução Fiscal',
    'Mandado de Segurança',
    'Outros',
  ]

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar Processo' : 'Novo Processo'}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Informações do Processo</h3>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Número do Processo <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.number}
                onChange={(e) => handleChange('number', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 bg-background border rounded-lg text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                  errors.number ? 'border-destructive' : 'border-border'
                )}
                placeholder="0000000-00.0000.0.00.0000"
              />
              {errors.number && <p className="mt-1 text-xs text-destructive">{errors.number}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Tipo de Processo <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                    errors.type ? 'border-destructive' : 'border-border'
                  )}
                >
                  <option value="">Selecione...</option>
                  {processTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {errors.type && <p className="mt-1 text-xs text-destructive">{errors.type}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Vara/Tribunal <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.court}
                  onChange={(e) => handleChange('court', e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                    errors.court ? 'border-destructive' : 'border-border'
                  )}
                  placeholder="1ª Vara do Trabalho de São Paulo"
                />
                {errors.court && <p className="mt-1 text-xs text-destructive">{errors.court}</p>}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Valor da Causa <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.value}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d.]/g, '')
                    handleChange('value', value)
                  }}
                  className={cn(
                    'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                    errors.value ? 'border-destructive' : 'border-border'
                  )}
                  placeholder="15000.00"
                />
                {errors.value && <p className="mt-1 text-xs text-destructive">{errors.value}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Data de Distribuição
                </label>
                <input
                  type="date"
                  value={formData.distributionDate}
                  onChange={(e) => handleChange('distributionDate', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Status</label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value as 'active' | 'archived')}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="active">Ativo</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
          </div>

          {/* Partes */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Partes do Processo</h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Cliente/Autor <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.client}
                  onChange={(e) => handleChange('client', e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                    errors.client ? 'border-destructive' : 'border-border'
                  )}
                  placeholder="Nome do cliente"
                />
                {errors.client && <p className="mt-1 text-xs text-destructive">{errors.client}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Réu/Reclamado <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.defendant}
                  onChange={(e) => handleChange('defendant', e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                    errors.defendant ? 'border-destructive' : 'border-border'
                  )}
                  placeholder="Nome do réu"
                />
                {errors.defendant && (
                  <p className="mt-1 text-xs text-destructive">{errors.defendant}</p>
                )}
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Descrição do Caso
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="Descreva resumidamente o caso..."
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
              {isEditing ? 'Salvar Alterações' : 'Criar Processo'}
            </button>
          </div>
      </form>
    </DialogContent>
  )
}

export function ProcessFormDialog({ isOpen, onClose, process, onSave }: ProcessFormDialogProps) {
  const isEditing = !!process

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {isOpen && (
        <ProcessFormDialogBody
          key={process?.id ?? 'new'}
          process={process}
          isEditing={isEditing}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </Dialog>
  )
}
