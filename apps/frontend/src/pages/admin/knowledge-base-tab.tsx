import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Plus,
  Trash2,
  Search,
  RefreshCw,
  BookOpen,
  FileText,
  Link,
  Type,
  Loader2,
  Eye,
} from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Cross2Icon } from '@radix-ui/react-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'

// ── Types ────────────────────────────────────────────────

interface LegalArea {
  id: string
  name: string
  slug: string
  description?: string | null
}

interface LegalTopic {
  id: string
  area_id: string
  name: string
  slug: string
  keywords: string[]
}

interface RagDocument {
  id: string
  filename: string
  original_filename: string
  document_type: string
  status: string
  error_message?: string | null
  total_chunks: number
  is_compound: boolean
  area_id?: string | null
  area_name?: string | null
  topic_id?: string | null
  topic_name?: string | null
  created_at: string
  updated_at: string
  progress?: number
  progress_message?: string | null
}

interface RagChunkPreview {
  id: string
  content: string
  section_title?: string | null
  area: string
  legislacao?: string | null
  artigo?: string | null
  chunk_index: number
}

interface KbStats {
  total_documents: number
  total_chunks: number
  documents_by_status: Record<string, number>
  chunks_by_area: Record<string, number>
}

type UploadMode = 'file' | 'text' | 'url'

// ── Status Badge ─────────────────────────────────────────

function StatusBadge({ status, errorMessage }: { status: string; errorMessage?: string | null }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: 'Aguardando', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    processing: { label: 'Processando', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    ready: { label: 'Pronto', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    error: { label: 'Erro', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  }
  const { label, className } = config[status] || { label: status, className: 'bg-muted text-muted-foreground' }

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', className)} title={errorMessage || undefined}>
      {status === 'processing' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {label}
    </span>
  )
}

function ProgressBar({ progress, message }: { progress: number; message?: string | null }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-8 text-right">
          {progress}%
        </span>
      </div>
      {message ? (
        <p className="text-[11px] text-muted-foreground/70 truncate">{message}</p>
      ) : null}
    </div>
  )
}

// ── Upload Modal ─────────────────────────────────────────

function UploadModal({
  open,
  areas,
  isSaving,
  onOpenChange,
  onSubmitFile,
  onSubmitText,
  onSubmitUrl,
}: {
  open: boolean
  areas: LegalArea[]
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onSubmitFile: (file: File, areaId: string | null, topicId: string | null) => void
  onSubmitText: (title: string, content: string, areaId: string, legislacao: string | null) => void
  onSubmitUrl: (url: string, areaId: string, title: string | null) => void
}) {
  const [mode, setMode] = useState<UploadMode>('file')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // File mode state
  const [file, setFile] = useState<File | null>(null)
  const [fileAreaId, setFileAreaId] = useState('')

  // Text mode state
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const [textAreaId, setTextAreaId] = useState('')
  const [textLegislacao, setTextLegislacao] = useState('')

  // URL mode state
  const [urlValue, setUrlValue] = useState('')
  const [urlAreaId, setUrlAreaId] = useState('')
  const [urlTitle, setUrlTitle] = useState('')

  const resetForm = useCallback(() => {
    setFile(null)
    setFileAreaId('')
    setTextTitle('')
    setTextContent('')
    setTextAreaId('')
    setTextLegislacao('')
    setUrlValue('')
    setUrlAreaId('')
    setUrlTitle('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  useEffect(() => {
    if (!open) resetForm()
  }, [open, resetForm])

  const handleSubmit = () => {
    if (mode === 'file') {
      if (!file) return toast.error('Selecione um arquivo')
      onSubmitFile(file, fileAreaId || null, null)
    } else if (mode === 'text') {
      if (!textContent.trim() || textContent.trim().length < 50) return toast.error('Conteúdo deve ter no mínimo 50 caracteres')
      if (!textAreaId) return toast.error('Selecione a área do direito')
      if (!textTitle.trim()) return toast.error('Informe o título')
      onSubmitText(textTitle.trim(), textContent.trim(), textAreaId, textLegislacao.trim() || null)
    } else {
      if (!urlValue.trim()) return toast.error('Informe a URL')
      if (!urlAreaId) return toast.error('Selecione a área do direito')
      onSubmitUrl(urlValue.trim(), urlAreaId, urlTitle.trim() || null)
    }
  }

  const tabBtnClass = (m: UploadMode) =>
    cn(
      'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
      mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
    )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <DialogPrimitive.Title className="text-lg font-semibold">
              Adicionar documento
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-full p-1 hover:bg-muted">
              <Cross2Icon className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button type="button" onClick={() => setMode('file')} className={tabBtnClass('file')}>
              <FileText className="h-4 w-4" /> Arquivo
            </button>
            <button type="button" onClick={() => setMode('text')} className={tabBtnClass('text')}>
              <Type className="h-4 w-4" /> Texto
            </button>
            <button type="button" onClick={() => setMode('url')} className={tabBtnClass('url')}>
              <Link className="h-4 w-4" /> URL
            </button>
          </div>

          <div className="space-y-4">
            {mode === 'file' ? (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">Arquivo PDF</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm border border-input rounded-lg px-3 py-2 bg-background"
                  />
                  {file ? <p className="text-xs text-muted-foreground mt-1">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p> : null}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Área do Direito</label>
                  <select
                    value={fileAreaId}
                    onChange={(e) => setFileAreaId(e.target.value)}
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                  >
                    <option value="">Detectar automaticamente</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </>
            ) : mode === 'text' ? (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">Título</label>
                  <Input value={textTitle} onChange={(e) => setTextTitle(e.target.value)} placeholder="Ex: Art. 477 da CLT" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Conteúdo</label>
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Cole o conteúdo legislativo aqui..."
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background min-h-[150px] resize-y"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Área do Direito *</label>
                  <select
                    value={textAreaId}
                    onChange={(e) => setTextAreaId(e.target.value)}
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                  >
                    <option value="">Selecione...</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Legislação</label>
                  <Input value={textLegislacao} onChange={(e) => setTextLegislacao(e.target.value)} placeholder="Ex: CLT, Código Civil" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">URL do documento</label>
                  <Input value={urlValue} onChange={(e) => setUrlValue(e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Título (opcional)</label>
                  <Input value={urlTitle} onChange={(e) => setUrlTitle(e.target.value)} placeholder="Nome do documento" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Área do Direito *</label>
                  <select
                    value={urlAreaId}
                    onChange={(e) => setUrlAreaId(e.target.value)}
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                  >
                    <option value="">Selecione...</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Adicionar
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ── Chunks Preview Modal ─────────────────────────────────

function ChunksModal({
  open,
  document: doc,
  chunks,
  isLoading,
  onOpenChange,
}: {
  open: boolean
  document: RagDocument | null
  chunks: RagChunkPreview[]
  isLoading: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl rounded-2xl bg-card border border-border p-6 shadow-xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <DialogPrimitive.Title className="text-lg font-semibold">
              {doc?.original_filename || 'Chunks'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-full p-1 hover:bg-muted">
              <Cross2Icon className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {doc ? (
            <div className="flex gap-2 mb-4 text-sm text-muted-foreground">
              <StatusBadge status={doc.status} errorMessage={doc.error_message} />
              <span>{doc.total_chunks} chunks</span>
              {doc.area_name ? <span>• {doc.area_name}</span> : null}
            </div>
          ) : null}

          {isLoading ? (
            <div className="py-8 text-center"><LoadingSpinner /></div>
          ) : chunks.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum chunk encontrado</p>
          ) : (
            <div className="space-y-3">
              {chunks.map((chunk) => (
                <div key={chunk.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">#{chunk.chunk_index}</span>
                    {chunk.artigo ? <span className="text-xs bg-primary/10 text-primary px-1.5 rounded">{chunk.artigo}</span> : null}
                    {chunk.legislacao ? <span className="text-xs bg-muted px-1.5 rounded">{chunk.legislacao}</span> : null}
                    <span className="text-xs text-muted-foreground ml-auto">{chunk.area}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap line-clamp-4">{chunk.content}</p>
                </div>
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ── Main Tab Component ───────────────────────────────────

export default function KnowledgeBaseTab() {
  const [documents, setDocuments] = useState<RagDocument[]>([])
  const [total, setTotal] = useState(0)
  const [areas, setAreas] = useState<LegalArea[]>([])
  const [stats, setStats] = useState<KbStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Upload modal
  const [showUpload, setShowUpload] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Chunks modal
  const [showChunks, setShowChunks] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<RagDocument | null>(null)
  const [chunks, setChunks] = useState<RagChunkPreview[]>([])
  const [chunksLoading, setChunksLoading] = useState(false)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<RagDocument | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Polling
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (areaFilter) params.set('area_id', areaFilter)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetchWithCredentials(`${API_URL}/ai/knowledge-base/documents?${params}`)
      if (!res.ok) return
      const data = (await res.json()) as { documents: RagDocument[]; total: number }
      setDocuments(data.documents)
      setTotal(data.total)
    } catch {
      // ignore
    }
  }, [search, areaFilter, statusFilter])

  const loadTaxonomy = useCallback(async () => {
    try {
      const res = await fetchWithCredentials(`${API_URL}/ai/knowledge-base/taxonomy`)
      if (!res.ok) return
      const data = (await res.json()) as { areas: LegalArea[]; topics: LegalTopic[] }
      setAreas(data.areas)
    } catch {
      // ignore
    }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchWithCredentials(`${API_URL}/ai/knowledge-base/stats`)
      if (!res.ok) return
      const data = (await res.json()) as KbStats
      setStats(data)
    } catch {
      // ignore
    }
  }, [])

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    await Promise.all([loadDocuments(), loadTaxonomy(), loadStats()])
    setIsLoading(false)
  }, [loadDocuments, loadTaxonomy, loadStats])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // Polling for pending/processing docs
  useEffect(() => {
    const hasPending = documents.some((d) => d.status === 'pending' || d.status === 'processing')
    if (hasPending) {
      pollingRef.current = setInterval(() => {
        void loadDocuments()
        void loadStats()
      }, 3000)
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [documents, loadDocuments, loadStats])

  // ── Upload handlers ────────────────────────────────────

  const handleUploadFile = useCallback(async (file: File, areaId: string | null, topicId: string | null) => {
    setIsSaving(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (areaId) formData.append('area_id', areaId)
      if (topicId) formData.append('topic_id', topicId)

      const res = await fetchWithCredentials(`${API_URL}/ai/knowledge-base/documents/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string }
        throw new Error(err.detail || 'Erro ao enviar arquivo')
      }

      toast.success('Documento enviado para processamento')
      setShowUpload(false)
      void loadDocuments()
      void loadStats()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }, [loadDocuments, loadStats])

  const handleUploadText = useCallback(async (title: string, content: string, areaId: string, legislacao: string | null) => {
    setIsSaving(true)
    try {
      const res = await fetchWithCredentials(`${API_URL}/ai/knowledge-base/documents/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, area_id: areaId, legislacao }),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string }
        throw new Error(err.detail || 'Erro ao criar documento')
      }

      toast.success('Texto enviado para processamento')
      setShowUpload(false)
      void loadDocuments()
      void loadStats()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }, [loadDocuments, loadStats])

  const handleUploadUrl = useCallback(async (url: string, areaId: string, title: string | null) => {
    setIsSaving(true)
    try {
      const res = await fetchWithCredentials(`${API_URL}/ai/knowledge-base/documents/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, area_id: areaId, title }),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string }
        throw new Error(err.detail || 'Erro ao importar URL')
      }

      toast.success('URL enviada para processamento')
      setShowUpload(false)
      void loadDocuments()
      void loadStats()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }, [loadDocuments, loadStats])

  // ── View chunks ────────────────────────────────────────

  const handleViewChunks = useCallback(async (doc: RagDocument) => {
    setSelectedDoc(doc)
    setShowChunks(true)
    setChunksLoading(true)
    try {
      const res = await fetchWithCredentials(`${API_URL}/ai/knowledge-base/documents/${doc.id}`)
      if (!res.ok) return
      const data = (await res.json()) as { document: RagDocument; chunks: RagChunkPreview[] }
      setChunks(data.chunks)
    } catch {
      // ignore
    } finally {
      setChunksLoading(false)
    }
  }, [])

  // ── Delete ─────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetchWithCredentials(`${API_URL}/ai/knowledge-base/documents/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erro ao deletar')
      toast.success('Documento removido')
      setDeleteTarget(null)
      void loadDocuments()
      void loadStats()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, loadDocuments, loadStats])

  // ── Render ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-16 flex items-center justify-center">
          <LoadingSpinner size="lg" text="Carregando base de conhecimento..." />
        </CardContent>
      </Card>
    )
  }

  const topAreas = stats?.chunks_by_area
    ? Object.entries(stats.chunks_by_area)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Base de Conhecimento</h2>
          <p className="text-sm text-muted-foreground">Gerencie os documentos do RAG jurídico</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadAll()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button onClick={() => setShowUpload(true)}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar documento
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total de documentos</p>
            <p className="text-2xl font-bold">{stats?.total_documents ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total de chunks</p>
            <p className="text-2xl font-bold">{stats?.total_chunks ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Prontos</p>
            <p className="text-2xl font-bold text-green-600">{stats?.documents_by_status?.ready ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Top áreas</p>
            <div className="text-sm">
              {topAreas.length > 0
                ? topAreas.map(([area, count]) => (
                    <span key={area} className="block truncate">
                      {area}: {count}
                    </span>
                  ))
                : <span className="text-muted-foreground">—</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="pl-9"
          />
        </div>
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="border border-input rounded-lg px-3 py-2 text-sm bg-background min-w-[180px]"
        >
          <option value="">Todas as áreas</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-input rounded-lg px-3 py-2 text-sm bg-background min-w-[140px]"
        >
          <option value="">Todos os status</option>
          <option value="pending">Aguardando</option>
          <option value="processing">Processando</option>
          <option value="ready">Pronto</option>
          <option value="error">Erro</option>
        </select>
      </div>

      {/* Documents table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium">Nome</th>
                  <th className="text-center px-4 py-3 font-medium">Tipo</th>
                  <th className="text-center px-4 py-3 font-medium">Área</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-center px-4 py-3 font-medium">Chunks</th>
                  <th className="text-center px-4 py-3 font-medium">Data</th>
                  <th className="text-center px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      Nenhum documento encontrado
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => {
                    const isProcessing = doc.status === 'processing' || doc.status === 'pending'
                    return (
                      <tr key={doc.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium truncate max-w-[250px]">{doc.original_filename}</p>
                          {isProcessing && doc.progress != null && doc.progress > 0 ? (
                            <div className="mt-1.5 max-w-[250px]">
                              <ProgressBar progress={doc.progress} message={doc.progress_message} />
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{doc.document_type}</td>
                        <td className="px-4 py-3 text-center">{doc.area_name || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={doc.status} errorMessage={doc.error_message} />
                        </td>
                        <td className="px-4 py-3 text-center">{doc.total_chunks}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleViewChunks(doc)}
                              className="p-1.5 rounded hover:bg-muted transition-colors"
                              title="Ver chunks"
                            >
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(doc)}
                              className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                              title="Deletar"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {total > documents.length ? (
            <div className="px-4 py-3 text-sm text-muted-foreground border-t border-border">
              Mostrando {documents.length} de {total} documentos
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Modals */}
      <UploadModal
        open={showUpload}
        areas={areas}
        isSaving={isSaving}
        onOpenChange={setShowUpload}
        onSubmitFile={handleUploadFile}
        onSubmitText={handleUploadText}
        onSubmitUrl={handleUploadUrl}
      />

      <ChunksModal
        open={showChunks}
        document={selectedDoc}
        chunks={chunks}
        isLoading={chunksLoading}
        onOpenChange={setShowChunks}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remover documento"
        description={`Deseja remover "${deleteTarget?.original_filename}"? Todos os chunks serão deletados.`}
        confirmText="Remover"
        onConfirm={() => void handleDelete()}
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  )
}
