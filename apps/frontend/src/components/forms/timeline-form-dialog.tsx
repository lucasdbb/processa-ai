import { useCallback, useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  timelineService,
  type TimelineEventType,
} from '@/services/timeline-service'
import {
  documentsService,
  type Document,
} from '@/services/documents-service'
import { X, Upload, FileText } from 'lucide-react'

const EVENT_TYPE_OPTIONS: { value: TimelineEventType; label: string }[] = [
  { value: 'hearing', label: 'Audiencia' },
  { value: 'petition', label: 'Peticao' },
  { value: 'decision', label: 'Decisao Judicial' },
  { value: 'citation', label: 'Citacao' },
  { value: 'status_change', label: 'Mudanca de Status' },
  { value: 'deadline', label: 'Prazo' },
  { value: 'document', label: 'Documento' },
  { value: 'note', label: 'Anotacao' },
  { value: 'update', label: 'Atualizacao' },
  { value: 'creation', label: 'Criacao' },
  { value: 'other', label: 'Outro' },
]

interface TimelineFormDialogProps {
  isOpen: boolean
  onClose: () => void
  processId: string
  onSave: () => void
  event?: {
    id: string
    title: string
    event_type: TimelineEventType
    description?: string
    event_date?: string
    documents?: Array<{ id: string; name: string }>
  }
}

export function TimelineFormDialog({
  isOpen,
  onClose,
  processId,
  onSave,
  event,
}: TimelineFormDialogProps) {
  const isEditing = !!event

  const [title, setTitle] = useState(event?.title || '')
  const [eventType, setEventType] = useState<TimelineEventType>(event?.event_type || 'other')
  const [description, setDescription] = useState(event?.description || '')
  const [eventDate, setEventDate] = useState(
    event?.event_date
      ? event.event_date.split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const [selectedDocuments, setSelectedDocuments] = useState<Document[]>([])
  const [availableDocuments, setAvailableDocuments] = useState<Document[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadDocuments = useCallback(async () => {
    setIsLoadingDocs(true)
    try {
      const { documents } = await documentsService.list({ process_id: processId })
      setAvailableDocuments(documents)
    } catch {
      toast.error('Erro ao carregar documentos')
    } finally {
      setIsLoadingDocs(false)
    }
  }, [processId])

  useEffect(() => {
    if (isOpen && processId) {
      loadDocuments()
    }
  }, [isOpen, processId, loadDocuments])

  // Set selected documents when editing
  useEffect(() => {
    if (event?.documents && availableDocuments.length > 0) {
      const docs = availableDocuments.filter((doc) =>
        event.documents?.some((ed) => ed.id === doc.id)
      )
      setSelectedDocuments(docs)
    }
  }, [event, availableDocuments])

  // Sync form state when event prop changes (for editing)
  useEffect(() => {
    if (event) {
      setTitle(event.title)
      setEventType(event.event_type)
      setDescription(event.description || '')
      setEventDate(event.event_date ? event.event_date.split('T')[0] : new Date().toISOString().split('T')[0])
    } else {
      // Reset form for new event
      setTitle('')
      setEventType('other')
      setDescription('')
      setEventDate(new Date().toISOString().split('T')[0])
    }
    setNewFiles([])
    setErrors({})
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [event])

  const resetForm = () => {
    setTitle('')
    setEventType('other')
    setDescription('')
    setEventDate(new Date().toISOString().split('T')[0])
    setSelectedDocuments([])
    setNewFiles([])
    setErrors({})
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!title.trim()) newErrors.title = 'Titulo e obrigatorio'
    if (!eventDate) newErrors.eventDate = 'Data e obrigatoria'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    setIsSaving(true)
    try {
      // 1. Upload new files first
      const uploadedDocIds: string[] = []
      if (newFiles.length > 0) {
        for (const file of newFiles) {
          try {
            const doc = await documentsService.createWithFile(
              {
                name: file.name,
                type: 'other',
                process_id: processId,
              },
              file
            )
            uploadedDocIds.push(doc.id)
          } catch (error) {
            console.error('Error uploading file:', file.name, error)
            toast.error(`Erro ao enviar ${file.name}`)
          }
        }
      }

      // 2. Combine existing + uploaded document IDs
      const allDocumentIds = [
        ...selectedDocuments.map((d) => d.id),
        ...uploadedDocIds,
      ]
      
      // 3. Create/update timeline event
      if (isEditing && event) {
        await timelineService.update(event.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          event_date: new Date(eventDate + 'T12:00:00').toISOString(),
          document_ids: allDocumentIds,
        })
        toast.success('Andamento atualizado com sucesso')
      } else {
        await timelineService.create({
          process_id: processId,
          event_type: eventType,
          title: title.trim(),
          description: description.trim() || undefined,
          event_date: new Date(eventDate + 'T12:00:00').toISOString(),
          document_ids: allDocumentIds,
        })
        toast.success('Andamento registrado com sucesso')
      }
      resetForm()
      onSave()
    } catch {
      toast.error(isEditing ? 'Erro ao atualizar andamento' : 'Erro ao criar andamento')
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setNewFiles(prev => [...prev, ...files])
    }
  }

  const handleRemoveFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Andamento' : 'Novo Andamento'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tipo de Evento
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as TimelineEventType)}
              disabled={isEditing}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Titulo *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Audiencia de conciliacao realizada"
              className={cn(
                'w-full px-3 py-2 bg-background border rounded-lg text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary',
                errors.title ? 'border-destructive' : 'border-border'
              )}
            />
            {errors.title && (
              <p className="text-xs text-destructive mt-1">{errors.title}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Data do Evento *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className={cn(
                'w-full px-3 py-2 bg-background border rounded-lg text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary',
                errors.eventDate ? 'border-destructive' : 'border-border'
              )}
            />
            {errors.eventDate && (
              <p className="text-xs text-destructive mt-1">{errors.eventDate}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Descricao
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes sobre o andamento..."
              rows={4}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Documents */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Documentos
            </label>

            {/* Selected + New Files Display */}
            {(selectedDocuments.length > 0 || newFiles.length > 0) && (
              <div className="mb-3 space-y-1.5">
                {/* Existing documents */}
                {selectedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between px-3 py-2 bg-primary/10 text-primary rounded-md text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{doc.name}</span>
                      <span className="text-primary/60 flex-shrink-0">(existente)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDocuments(prev => prev.filter(d => d.id !== doc.id))}
                      className="hover:bg-primary/20 rounded p-1 ml-2 flex-shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {/* New files to upload */}
                {newFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-3 py-2 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Upload className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-green-600/60 dark:text-green-400/60 flex-shrink-0">
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="hover:bg-green-500/20 rounded p-1 ml-2 flex-shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Two sections: Link existing + Upload new */}
            <div className="space-y-3">
              {/* Link existing documents */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Vincular Documentos Existentes
                </label>
                <select
                  value=""
                  onChange={(e) => {
                    const docId = e.target.value
                    if (!docId) return
                    const doc = availableDocuments.find(d => d.id === docId)
                    if (doc && !selectedDocuments.find(d => d.id === doc.id)) {
                      setSelectedDocuments(prev => [...prev, doc])
                    }
                    e.target.value = ''
                  }}
                  disabled={isLoadingDocs || availableDocuments.length === 0}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                >
                  <option value="">
                    {isLoadingDocs
                      ? 'Carregando...'
                      : availableDocuments.length === 0
                      ? 'Nenhum documento disponível'
                      : 'Selecionar documento'}
                  </option>
                  {availableDocuments
                    .filter(doc => !selectedDocuments.find(d => d.id === doc.id))
                    .map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Upload new files */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Adicionar Novos Arquivos
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-background border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Escolher arquivos
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Você pode selecionar múltiplos arquivos
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Registrar'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
