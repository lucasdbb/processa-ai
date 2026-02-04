import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ProcessSelect } from '@/components/ui/process-select'
import { ClientSelect } from '@/components/ui/client-select'
import { deadlinesService, type DeadlineCreate } from '@/services/deadlines-service'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { Process } from '@/services/processes-service'
import type { Client } from '@/services/clients-service'

interface ProcessWithClient extends Process {
  client_name?: string
}

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
  notifyBefore?: number
}

interface DeadlineFormDialogProps {
  isOpen: boolean
  onClose: () => void
  deadline?: Deadline
  defaultDate?: string
  /** Processo pre-selecionado (para fluxo de cadeia) */
  preselectedProcess?: ProcessWithClient
  /** Filtrar processos por cliente específico */
  clientId?: string
  onSave: (deadline: Omit<Deadline, 'id'> & { id?: string }) => void
}

const getInitialFormData = (deadline?: Deadline, defaultDate?: string, preselectedProcess?: ProcessWithClient) => ({
  title: deadline?.title ?? '',
  processNumber: deadline?.processNumber ?? preselectedProcess?.process_number ?? '',
  processId: deadline?.processId ?? preselectedProcess?.id ?? '',
  date: deadline?.date ?? defaultDate ?? '',
  time: deadline?.time ?? '',
  type:
    deadline?.type ??
    ('outros' as 'contestacao' | 'recurso' | 'audiencia' | 'pericia' | 'outros'),
  priority: deadline?.priority ?? ('media' as 'alta' | 'media' | 'baixa'),
  description: deadline?.description ?? '',
  notifyBefore: deadline?.notifyBefore ?? 3,
})

function DeadlineFormDialogBody({
  deadline,
  defaultDate,
  preselectedProcess,
  clientId,
  isEditing,
  onClose,
  onSave,
}: {
  deadline?: Deadline
  defaultDate?: string
  preselectedProcess?: ProcessWithClient
  clientId?: string
  isEditing: boolean
  onClose: () => void
  onSave: (deadline: Omit<Deadline, 'id'> & { id?: string }) => void
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(deadline, defaultDate, preselectedProcess))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [, setSelectedProcess] = useState<ProcessWithClient | null>(preselectedProcess ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientId ?? null)

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Titulo do prazo e obrigatorio'
    }

    if (!formData.processId) {
      newErrors.processId = 'Selecione um processo'
    }

    if (!formData.date) {
      newErrors.date = 'Data e obrigatoria'
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
      if (isEditing && deadline?.id) {
        // Update existente
        await deadlinesService.update(deadline.id, {
          title: formData.title,
          due_date: formData.date,
          description: formData.description || undefined,
          priority: mapPriorityToApi(formData.priority),
          reminder_days_before: formData.notifyBefore,
        })
        toast.success('Prazo atualizado com sucesso!')

        const deadlineData = {
          ...formData,
          id: deadline.id,
        }
        onSave(deadlineData)
      } else {
        // Criar novo
        const payload: DeadlineCreate = {
          process_id: formData.processId,
          title: formData.title,
          due_date: formData.date,
          description: formData.description || undefined,
          priority: mapPriorityToApi(formData.priority),
          reminder_days_before: formData.notifyBefore,
        }

        const created = await deadlinesService.create(payload)
        toast.success('Prazo criado com sucesso!')

        const deadlineData = {
          ...formData,
          id: created.id,
        }
        onSave(deadlineData)
      }
      onClose()
    } catch {
      toast.error('Erro ao salvar prazo')
    } finally {
      setIsSaving(false)
    }
  }

  const mapPriorityToApi = (priority: 'alta' | 'media' | 'baixa'): 'low' | 'medium' | 'high' | 'urgent' => {
    switch (priority) {
      case 'alta': return 'high'
      case 'media': return 'medium'
      case 'baixa': return 'low'
      default: return 'medium'
    }
  }

  const handleChange = (field: keyof typeof formData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const handleProcessChange = (processId: string | null, process: ProcessWithClient | null) => {
    setSelectedProcess(process)
    setFormData((prev) => ({
      ...prev,
      processId: processId || '',
      processNumber: process?.process_number || '',
    }))
    if (errors.processId && processId) {
      setErrors((prev) => ({ ...prev, processId: '' }))
    }
  }

  const deadlineTypes = [
    { value: 'contestacao', label: 'Contestacao' },
    { value: 'recurso', label: 'Recurso' },
    { value: 'audiencia', label: 'Audiencia' },
    { value: 'pericia', label: 'Pericia' },
    { value: 'outros', label: 'Outros' },
  ]

  const priorityOptions = [
    { value: 'alta', label: 'Alta' },
    { value: 'media', label: 'Media' },
    { value: 'baixa', label: 'Baixa' },
  ]

  const notifyOptions = [
    { value: 1, label: '1 dia antes' },
    { value: 3, label: '3 dias antes' },
    { value: 7, label: '7 dias antes' },
    { value: 15, label: '15 dias antes' },
    { value: 30, label: '30 dias antes' },
  ]

  // Montar initialProcess para o ProcessSelect
  const initialProcess: ProcessWithClient | undefined = deadline?.processId ? {
    id: deadline.processId,
    process_number: deadline.processNumber,
    user_id: '',
    client_id: '',
    type: '',
    subject: null,
    court: null,
    defendant: null,
    value: null,
    status: 'active',
    notes: null,
    start_date: null,
    end_date: null,
    created_at: '',
    updated_at: '',
  } : preselectedProcess

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar Prazo' : 'Novo Prazo'}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cliente (opcional - filtrar processos) */}
        {!clientId && !preselectedProcess && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Filtro (Opcional)</h3>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Cliente (filtrar processos)
              </label>
              <ClientSelect
                value={selectedClientId || ''}
                onChange={(clientId: string | null, client: Client | null) => {
                  setSelectedClientId(clientId)
                  // Limpar processo selecionado quando cliente mudar
                  if (formData.processId) {
                    setFormData(prev => ({ ...prev, processId: '', processNumber: '' }))
                  }
                }}
                placeholder="Selecione um cliente para filtrar processos..."
              />
            </div>
          </div>
        )}

        {/* Processo */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Processo</h3>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Selecione o Processo <span className="text-destructive">*</span>
            </label>
            <ProcessSelect
              value={formData.processId}
              onChange={handleProcessChange}
              initialProcess={initialProcess}
              clientId={selectedClientId ?? clientId}
              error={errors.processId}
              placeholder="Buscar processo por numero ou tipo..."
              disabled={!!preselectedProcess}
            />
          </div>
        </div>

        {/* Informacoes Basicas */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Informacoes do Prazo</h3>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Titulo do Prazo <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className={cn(
                'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                errors.title ? 'border-destructive' : 'border-border'
              )}
              placeholder="Ex: Prazo para contestacao"
            />
            {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
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
                Horario
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => handleChange('time', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
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

        {/* Descricao */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Descricao/Observacoes
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            placeholder="Adicione observacoes sobre este prazo..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
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
            {isEditing ? 'Salvar Alteracoes' : 'Criar Prazo'}
          </button>
        </div>
      </form>
    </DialogContent>
  )
}

export function DeadlineFormDialog({ isOpen, onClose, deadline, defaultDate, preselectedProcess, clientId, onSave }: DeadlineFormDialogProps) {
  const isEditing = !!deadline

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {isOpen && (
        <DeadlineFormDialogBody
          key={deadline?.id ?? preselectedProcess?.id ?? defaultDate ?? 'new'}
          deadline={deadline}
          defaultDate={defaultDate}
          preselectedProcess={preselectedProcess}
          clientId={clientId}
          isEditing={isEditing}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </Dialog>
  )
}
