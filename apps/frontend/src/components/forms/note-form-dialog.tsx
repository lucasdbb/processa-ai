import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface Note {
  id: string
  title: string
  content: string
  note_type: 'general' | 'meeting' | 'call' | 'email' | 'other'
  is_pinned: boolean
}

interface NoteFormDialogProps {
  isOpen: boolean
  onClose: () => void
  clientId: string
  note?: Note
  onSave: (note: Omit<Note, 'id'> & { id?: string }) => void | Promise<void>
}

const getInitialFormData = (note?: Note) => ({
  title: note?.title ?? '',
  content: note?.content ?? '',
  note_type: note?.note_type ?? ('general' as 'general' | 'meeting' | 'call' | 'email' | 'other'),
  is_pinned: note?.is_pinned ?? false,
})

function NoteFormDialogBody({
  note,
  isEditing,
  onClose,
  onSave,
}: {
  note?: Note
  isEditing: boolean
  onClose: () => void
  onSave: (note: Omit<Note, 'id'> & { id?: string }) => void | Promise<void>
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(note))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Reset form when note changes (create vs edit)
  useEffect(() => {
    setFormData(getInitialFormData(note))
    setErrors({})
  }, [note])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Título é obrigatório'
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Conteúdo é obrigatório'
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
      if (isEditing && note) {
        await onSave({ ...formData, id: note.id })
      } else {
        await onSave(formData)
      }
      onClose()
    } catch (error) {
      console.error('Error saving note:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const noteTypes = [
    { value: 'general', label: 'Geral' },
    { value: 'meeting', label: 'Reunião' },
    { value: 'call', label: 'Ligação' },
    { value: 'email', label: 'E-mail' },
    { value: 'other', label: 'Outro' },
  ]

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar Nota' : 'Nova Nota'}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Título <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className={cn(
                'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                errors.title ? 'border-destructive' : 'border-border'
              )}
              placeholder="Título da nota"
            />
            {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tipo
            </label>
            <select
              value={formData.note_type}
              onChange={(e) => handleChange('note_type', e.target.value as typeof formData.note_type)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {noteTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Conteúdo <span className="text-destructive">*</span>
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => handleChange('content', e.target.value)}
              rows={6}
              className={cn(
                'w-full px-3 py-2 bg-background border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none',
                errors.content ? 'border-destructive' : 'border-border'
              )}
              placeholder="Escreva o conteúdo da nota..."
            />
            {errors.content && <p className="mt-1 text-xs text-destructive">{errors.content}</p>}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_pinned"
              checked={formData.is_pinned}
              onChange={(e) => handleChange('is_pinned', e.target.checked)}
              className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
            />
            <label htmlFor="is_pinned" className="text-sm font-medium text-foreground cursor-pointer">
              Fixar nota
            </label>
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
            {isEditing ? 'Salvar Alterações' : 'Criar Nota'}
          </button>
        </div>
      </form>
    </DialogContent>
  )
}

export function NoteFormDialog({ isOpen, onClose, clientId, note, onSave }: NoteFormDialogProps) {
  const isEditing = !!note

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <NoteFormDialogBody
        note={note}
        isEditing={isEditing}
        onClose={onClose}
        onSave={onSave}
      />
    </Dialog>
  )
}
