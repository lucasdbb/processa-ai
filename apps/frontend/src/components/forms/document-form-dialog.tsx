import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ClientSelect } from '@/components/ui/client-select'
import { ProcessSelect } from '@/components/ui/process-select'
import { toast } from 'sonner'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'

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
  onSave: (document: Omit<Document, 'id' | 'file_url'> & { id?: string; file_url?: string }, file?: File) => void | Promise<void>
}

const getInitialFormData = (document?: Document, preselectedProcessId?: string, preselectedClientId?: string) => ({
  name: document?.name ?? '',
  type: document?.type ?? ('other' as const),
  status: document?.status ?? ('draft' as const),
  process_id: document?.process_id ?? preselectedProcessId ?? '',
  client_id: document?.client_id ?? preselectedClientId ?? '',
  description: document?.description ?? '',
})

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getFileTypeLabel = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return 'Imagem'
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'Word'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'Planilha'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Apresentacao'
  return 'Arquivo'
}

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
  onSave: (document: Omit<Document, 'id' | 'file_url'> & { id?: string; file_url?: string }, file?: File) => void | Promise<void>
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(document, preselectedProcessId, preselectedClientId))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setFormData(getInitialFormData(document, preselectedProcessId, preselectedClientId))
    setErrors({})
    setSelectedFile(null)
  }, [document, preselectedProcessId, preselectedClientId])

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) {
      newErrors.name = 'Nome do documento e obrigatorio'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSaving(true)
    try {
      if (isEditing && document) {
        await onSave({ ...formData, id: document.id, file_url: document.file_url || undefined }, selectedFile || undefined)
      } else {
        await onSave(formData, selectedFile || undefined)
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

  const handleFileSelect = useCallback((file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, file: 'Arquivo excede o limite de 50MB' }))
      return
    }
    setSelectedFile(file)
    if (!formData.name.trim()) {
      setFormData((prev) => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, '') }))
    }
    setErrors((prev) => ({ ...prev, file: '' }))
  }, [formData.name])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const documentTypes = [
    { value: 'other', label: 'Outro' },
    { value: 'petition', label: 'Peticao' },
    { value: 'contract', label: 'Contrato' },
    { value: 'ai_analysis', label: 'Analise IA' },
    { value: 'calculation', label: 'Calculo' },
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

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* File Upload Zone */}
        {!isEditing && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Arquivo
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : selectedFile
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInput}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.zip,.rar"
              />

              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                    {getFileTypeLabel(selectedFile.type).substring(0, 3).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground truncate max-w-[300px]">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getFileTypeLabel(selectedFile.type)} · {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="ml-2 p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-muted flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground">
                      <path d="M12 16V8M12 8L9 11M12 8L15 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M20 16.7428C21.2215 15.734 22 14.2079 22 12.5C22 9.46243 19.5376 7 16.5 7C16.2815 7 16.0771 6.886 15.9661 6.69774C14.6621 4.48484 12.2544 3 9.5 3C5.35786 3 2 6.35786 2 10.5C2 12.5661 2.83545 14.4371 4.18695 15.7935" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Arraste um arquivo ou clique para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, Word, Excel, imagens e outros · Max 50MB
                    </p>
                  </div>
                </div>
              )}
            </div>
            {errors.file && <p className="mt-1 text-xs text-destructive">{errors.file}</p>}
          </div>
        )}

        {/* Existing file indicator for editing */}
        {isEditing && document?.file_url && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
              ARQ
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">Arquivo anexado</p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const url = await fetchWithCredentials(
                      `${API_URL}/office/documents/${document.id}/download`
                    )
                    if (!url.ok) throw new Error('Download failed')
                    const data = await url.json() as { download_url: string }
                    const res = await fetch(data.download_url)
                    if (!res.ok) throw new Error('Download failed')
                    const blob = await res.blob()
                    const blobUrl = URL.createObjectURL(blob)
                    const element = document.createElement('a')
                    element.href = blobUrl
                    element.download = document.name
                    document.body.appendChild(element)
                    element.click()
                    document.body.removeChild(element)
                    URL.revokeObjectURL(blobUrl)
                    toast.success('Download iniciado')
                  } catch {
                    toast.error('Erro ao baixar documento')
                  }
                }}
                className="text-xs text-primary hover:underline"
              >
                Baixar arquivo
              </button>
            </div>
          </div>
        )}

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
              placeholder="Ex: Contrato de prestacao de servicos"
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
              Descricao
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

        {/* Upload Progress */}
        {isSaving && selectedFile && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Enviando arquivo...</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        )}

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
            {isSaving && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {isEditing ? 'Salvar Alteracoes' : selectedFile ? 'Enviar e Criar' : 'Criar Documento'}
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
