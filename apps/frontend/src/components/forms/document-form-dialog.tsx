import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { ClientSelect } from '@/components/ui/client-select'
import { ProcessSelect } from '@/components/ui/process-select'

interface Document {
  id: string
  name: string
  type: 'ai_analysis' | 'calculation' | 'petition' | 'contract' | 'other'
  status: 'draft' | 'final' | 'archived'
  file_url: string | null
  process_id: string | null
  client_id: string | null
  description: string | null
}

interface DocumentFormDialogProps {
  isOpen: boolean
  onClose: () => void
  document?: Document
  preselectedProcessId?: string
  preselectedClientId?: string
  onSave: (document: Omit<Document, 'id' | 'file_url'> & { id?: string; file_url?: string }) => void | Promise<void>
}

const getInitialFormData = (document?: Document, preselectedProcessId?: string, preselectedClientId?: string) => ({
  name: document?.name ?? '',
  type: document?.type ?? ('other' as const),
  status: document?.status ?? ('draft' as const),
  process_id: document?.process_id ?? preselectedProcessId ?? '',
  client_id: document?.client_id ?? preselectedClientId ?? '',
  description: document?.description ?? '',
})

function DocumentFormDialogBody({
  document,
  preselectedProcessId,
  preselectedClientId,
  isEditing,
  onClose,
  onSave,
}: {
  document?: Document
  preselectedProcessId?: string
  preselectedClientId?: string
  isEditing: boolean
  onClose: () => void
  onSave: (document: Omit<Document, 'id' | 'file_url'> & { id?: string; file_url?: string }) => void | Promise<void>
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(document, preselectedProcessId, preselectedClientId))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Reset form when document changes
  useEffect(() => {
    setFormData(getInitialFormData(document, preselectedProcessId, preselectedClientId))
    setErrors({})
  }, [document, preselectedProcessId, preselectedClientId])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Nome do documento é obrigatório'
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
      if (isEditing && document) {
        await onSave({ ...formData, id: document.id, file_url: document.file_url || undefined })
      } else {
        await onSave(formData)
      }
      onClose()
    } catch (error) {
      console.error('Error saving document:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const documentTypes = [
    { value: 'other', label: 'Outro' },
    { value: 'petition', label: 'Petição' },
    { value: 'contract', label: 'Contrato' },
    { value: 'ai_analysis', label: 'Análise IA' },
    { value: 'calculation', label: 'Cálculo' },
  ]

  const statusOptions = [
    { value: 'draft', label: 'Rascunho' },
    { value: 'final', label: 'Final' },
    { value: 'archived', label: 'Arquivado' },
  ]

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar Documento' : 'Novo Documento'}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Nome do Documento <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={cn(
                'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                errors.name ? 'border-destructive' : 'border-border'
              )}
              placeholder="Ex: Contrato de prestação de serviços"
            />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Tipo
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {documentTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
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
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Cliente (Opcional)
            </label>
            <ClientSelect
              value={formData.client_id}
              onChange={(clientId: string | null) => handleChange('client_id', clientId || '')}
              placeholder="Selecione um cliente..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Processo (Opcional)
            </label>
            <ProcessSelect
              value={formData.process_id}
              onChange={(processId: string | null) => handleChange('process_id', processId || '')}
              clientId={formData.client_id || undefined}
              placeholder="Selecione um processo..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Descrição
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="Adicione detalhes sobre o documento..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors text-sm font-medium"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar Alterações' : 'Criar Documento'}
          </button>
        </div>
      </form>
    </DialogContent>
  )
}

export function DocumentFormDialog({ isOpen, onClose, document, preselectedProcessId, preselectedClientId, onSave }: DocumentFormDialogProps) {
  const isEditing = !!document

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DocumentFormDialogBody
        document={document}
        preselectedProcessId={preselectedProcessId}
        preselectedClientId={preselectedClientId}
        isEditing={isEditing}
        onClose={onClose}
        onSave={onSave}
      />
    </Dialog>
  )
}
