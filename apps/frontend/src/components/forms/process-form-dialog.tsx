import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ClientSelect } from '@/components/ui/client-select'
import { processesService, type ProcessCreate, type ProcessUpdate } from '@/services/processes-service'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { Client } from '@/services/clients-service'

export interface ProcessFormData {
  id: string
  process_number: string
  type: string
  area: string
  court: string
  client_id: string
  client_name?: string
  defendant: string
  value: number
  status: 'active' | 'pending' | 'suspended' | 'archived' | 'concluded' | 'cancelled'
  start_date?: string
  notes?: string
}

interface ProcessFormDialogProps {
  isOpen: boolean
  onClose: () => void
  process?: ProcessFormData
  /** Cliente pre-selecionado (para fluxo de cadeia) */
  preselectedClient?: Client
  onSave: (process: ProcessFormData) => void
}

const formatCurrencyInput = (value: string): string => {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const cents = parseInt(digits, 10)
  const reais = cents / 100
  return reais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const parseCurrencyToNumber = (formatted: string): number => {
  if (!formatted) return 0
  const cleaned = formatted.replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

const numberToCurrencyDisplay = (value: number | string | null | undefined): string => {
  if (value == null) return ''
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num) || num === 0) return ''
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const getInitialFormData = (process?: ProcessFormData, preselectedClient?: Client) => ({
  process_number: process?.process_number ?? '',
  type: process?.type ?? '',
  area: process?.area ?? '',
  court: process?.court ?? '',
  client_id: process?.client_id ?? preselectedClient?.id ?? '',
  defendant: process?.defendant ?? '',
  value: numberToCurrencyDisplay(process?.value),
  status: process?.status ?? ('active' as ProcessFormData['status']),
  start_date: process?.start_date ?? '',
  notes: process?.notes ?? '',
})

function ProcessFormDialogBody({
  process,
  preselectedClient,
  isEditing,
  onClose,
  onSave,
}: {
  process?: ProcessFormData
  preselectedClient?: Client
  isEditing: boolean
  onClose: () => void
  onSave: (process: ProcessFormData) => void
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(process, preselectedClient))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedClient, setSelectedClient] = useState<Client | null>(preselectedClient ?? null)
  const [isSaving, setIsSaving] = useState(false)

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.process_number.trim()) {
      newErrors.process_number = 'Número do processo é obrigatório'
    }

    if (!formData.type.trim()) {
      newErrors.type = 'Tipo de processo é obrigatório'
    }

    if (!formData.area.trim()) {
      newErrors.area = 'Área do direito é obrigatória'
    }

    if (!formData.court.trim()) {
      newErrors.court = 'Vara/Tribunal é obrigatório'
    }

    if (!formData.client_id) {
      newErrors.client_id = 'Selecione um cliente'
    }

    if (!formData.defendant.trim()) {
      newErrors.defendant = 'Réu é obrigatório'
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
      if (isEditing && process) {
        // Update existente
        const payload: ProcessUpdate = {
          process_number: formData.process_number,
          type: formData.type,
          area: formData.area,
          court: formData.court || undefined,
          defendant: formData.defendant || undefined,
          value: formData.value ? parseCurrencyToNumber(formData.value) : undefined,
          notes: formData.notes || undefined,
          start_date: formData.start_date || undefined,
          status: formData.status,
        }

        const updated = await processesService.update(process.id, payload)

        const updatedProcess: ProcessFormData = {
          ...process,
          ...updated,
          client_name: selectedClient?.name ?? process.client_name,
          area: updated.area || '',
          court: updated.court || '',
          defendant: updated.defendant || '',
          value: updated.value || 0,
          start_date: updated.start_date || undefined,
          notes: updated.notes || undefined,
        }
        
        toast.success('Processo atualizado com sucesso!')
        onSave(updatedProcess)
        onClose()
      } else {
        // Criar novo
        const payload: ProcessCreate = {
          client_id: formData.client_id,
          process_number: formData.process_number,
          type: formData.type,
          area: formData.area,
          court: formData.court || undefined,
          defendant: formData.defendant || undefined,
          value: formData.value ? parseCurrencyToNumber(formData.value) : undefined,
          notes: formData.notes || undefined,
          start_date: formData.start_date || undefined,
        }

        const created = await processesService.create(payload)

        const savedProcess: ProcessFormData = {
          id: created.id,
          process_number: created.process_number,
          type: created.type,
          area: created.area || '',
          court: created.court || '',
          client_id: created.client_id,
          client_name: selectedClient?.name,
          defendant: created.defendant || '',
          value: created.value || 0,
          status: created.status as ProcessFormData['status'],
          start_date: created.start_date || undefined,
          notes: created.notes || undefined,
        }

        toast.success('Processo criado com sucesso!')
        onSave(savedProcess)
        onClose()
      }
    } catch {
      toast.error('Erro ao salvar processo')
    } finally {
      setIsSaving(false)
    }
  }

  const formatProcessNumber = (value: string): string => {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, '')
    
    // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
    // 7 dígitos - 2 dígitos - 4 dígitos - 1 dígito - 2 dígitos - 4 dígitos
    if (numbers.length <= 7) {
      return numbers
    } else if (numbers.length <= 9) {
      return `${numbers.slice(0, 7)}-${numbers.slice(7)}`
    } else if (numbers.length <= 13) {
      return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9)}`
    } else if (numbers.length <= 14) {
      return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9, 13)}.${numbers.slice(13)}`
    } else if (numbers.length <= 16) {
      return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9, 13)}.${numbers.slice(13, 14)}.${numbers.slice(14)}`
    } else {
      return `${numbers.slice(0, 7)}-${numbers.slice(7, 9)}.${numbers.slice(9, 13)}.${numbers.slice(13, 14)}.${numbers.slice(14, 16)}.${numbers.slice(16, 20)}`
    }
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    if (field === 'process_number') {
      setFormData((prev) => ({ ...prev, [field]: formatProcessNumber(value) }))
    } else if (field === 'value') {
      setFormData((prev) => ({ ...prev, [field]: formatCurrencyInput(value) }))
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const handleClientChange = (clientId: string | null, client: Client | null) => {
    setSelectedClient(client)
    setFormData((prev) => ({ ...prev, client_id: clientId || '' }))
    if (errors.client_id && clientId) {
      setErrors((prev) => ({ ...prev, client_id: '' }))
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
    'Divórcio',
    'Inventário',
    'Alimentos',
    'Usucapião',
    'Despejo',
    'Outros',
  ]

  const processAreas = [
    'Trabalhista',
    'Cível',
    'Família e Sucessões',
    'Consumidor',
    'Tributário',
    'Criminal',
    'Previdenciário',
    'Empresarial',
    'Imobiliário',
    'Administrativo',
    'Outros',
  ]

  // ClientSelect irá buscar os dados completos se initialClient não for passado
  const initialClient = isEditing ? undefined : preselectedClient

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
      <DialogHeader className="p-6 pb-2 shrink-0">
        <DialogTitle>{isEditing ? 'Editar Processo' : 'Novo Processo'}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
          {/* Cliente - sempre visivel mas travado se edicao ou pre-selecionado */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Cliente</h3>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Selecione o Cliente <span className="text-destructive">*</span>
              </label>
              <ClientSelect
                value={formData.client_id}
                onChange={handleClientChange}
                initialClient={initialClient}
                error={errors.client_id}
                placeholder="Buscar cliente por nome, CPF ou email..."
                disabled={isEditing || !!preselectedClient}
              />
            </div>
          </div>

          {/* Informacoes Basicas */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Informacoes do Processo</h3>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Numero do Processo <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.process_number}
                onChange={(e) => handleChange('process_number', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 bg-background border rounded-lg text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                  errors.process_number ? 'border-destructive' : 'border-border'
                )}
                placeholder="0000000-00.0000.0.00.0000"
              />
              {errors.process_number && <p className="mt-1 text-xs text-destructive">{errors.process_number}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Área do Direito <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.area}
                  onChange={(e) => handleChange('area', e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                    errors.area ? 'border-destructive' : 'border-border'
                  )}
                >
                  <option value="">Selecione...</option>
                  {processAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                {errors.area && <p className="mt-1 text-xs text-destructive">{errors.area}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Tipo de Processo <span className="text-destructive">*</span>
                </label>
                <input
                  list="process-types"
                  type="text"
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  className={cn(
                    'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                    errors.type ? 'border-destructive' : 'border-border'
                  )}
                  placeholder="Selecione ou digite..."
                />
                <datalist id="process-types">
                  {processTypes.map((type) => (
                    <option key={type} value={type} />
                  ))}
                </datalist>
                {errors.type && <p className="mt-1 text-xs text-destructive">{errors.type}</p>}
              </div>

              <div className="sm:col-span-2">
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
                  placeholder="Ex: 1ª Vara Cível de São Paulo"
                />
                {errors.court && <p className="mt-1 text-xs text-destructive">{errors.court}</p>}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Valor da Causa
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.value}
                    onChange={(e) => handleChange('value', e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Data de Distribuição
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            {isEditing && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value as ProcessFormData['status'])}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="active">Ativo</option>
                  <option value="archived">Arquivado</option>
                </select>
              </div>
            )}
          </div>

          {/* Partes */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Parte Contraria</h3>

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

          {/* Descricao */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Observações
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="Observações sobre o processo..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border shrink-0 bg-background">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar Alteracoes' : 'Criar Processo'}
          </button>
        </div>
      </form>
    </DialogContent>
  )
}

export function ProcessFormDialog({ isOpen, onClose, process, preselectedClient, onSave }: ProcessFormDialogProps) {
  const isEditing = !!process

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {isOpen && (
        <ProcessFormDialogBody
          key={process?.id ?? preselectedClient?.id ?? 'new'}
          process={process}
          preselectedClient={preselectedClient}
          isEditing={isEditing}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </Dialog>
  )
}
