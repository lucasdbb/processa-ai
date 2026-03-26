import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Edit, Trash2, Search, RefreshCw, FileText } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Cross2Icon } from '@radix-ui/react-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'

type MaterialMimeType = 'pdf' | 'xls' | 'xlsx' | 'xlsm' | 'docx' | 'csv'

interface AdminMaterialListItem {
  id: string
  slug: string
  title: string
  description?: string | null
  category: string
  filename: string
  mime_type: MaterialMimeType
  is_published: boolean
  created_at: string
  updated_at: string
}

type MaterialModalMode = 'create' | 'edit'

type MaterialModalSubmitData = {
  title: string
  slug?: string
  group: string
  description?: string
  is_published: boolean
  mime_type: MaterialMimeType
  file: File | null
}

interface MaterialsTabProps {
  isAdmin: boolean
}

function MaterialModal({
  open,
  mode,
  initial,
  groupOptions,
  isSaving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  mode: MaterialModalMode
  initial: AdminMaterialListItem | null
  groupOptions: string[]
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: MaterialModalSubmitData) => void
}) {
  const titleInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState(() => (mode === 'edit' && initial ? initial.title : ''))
  const [slug, setSlug] = useState(() => (mode === 'edit' && initial ? initial.slug : ''))
  const [group, setGroup] = useState(() => (mode === 'edit' && initial ? initial.category : ''))
  const [description, setDescription] = useState(() =>
    mode === 'edit' && initial ? initial.description || '' : ''
  )
  const [isPublished, setIsPublished] = useState(() => (mode === 'edit' && initial ? initial.is_published : true))
  const [mimeType, setMimeType] = useState<MaterialMimeType>(() =>
    mode === 'edit' && initial ? initial.mime_type : 'pdf'
  )
  const [file, setFile] = useState<File | null>(null)

  const acceptByMime: Record<MaterialMimeType, string> = {
    pdf: 'application/pdf,.pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx',
    xls: 'application/vnd.ms-excel,.xls',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx',
    xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12,.xlsm',
    csv: 'text/csv,.csv',
  }

  const clearSelectedFile = () => {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const openCurrentFile = () => {
    if (!initial?.slug) return
    const slug = encodeURIComponent(initial.slug)
    window.open(`${API_URL}/materials/${slug}/download`, '_blank', 'noopener,noreferrer')
  }

  const formatBytes = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return ''
    const units = ['B', 'KB', 'MB', 'GB']
    const base = 1024
    const index = Math.min(Math.floor(Math.log(value) / Math.log(base)), units.length - 1)
    const size = value / Math.pow(base, index)
    const digits = index === 0 ? 0 : size >= 10 ? 1 : 2
    return `${size.toFixed(digits)} ${units[index]}`
  }

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => titleInputRef.current?.focus())
  }, [open])

  const handlePrimary = () => {
    const nextTitle = title.trim()
    const nextGroup = group.trim()
    const nextSlug = slug.trim()

    if (!nextTitle) {
      toast.error('Título é obrigatório')
      return
    }

    if (!nextGroup) {
      toast.error('Grupo é obrigatório')
      return
    }

    if (mode === 'edit' && !nextSlug) {
      toast.error('Slug é obrigatório')
      return
    }

    if (mode === 'create' && !file) {
      toast.error('Arquivo é obrigatório')
      return
    }

    onSubmit({
      title: nextTitle,
      slug: nextSlug ? nextSlug : undefined,
      group: nextGroup,
      description: description.trim() || undefined,
      is_published: isPublished,
      mime_type: mimeType,
      file,
    })
  }

  const titleText = mode === 'create' ? 'Novo material' : 'Editar material'
  const primaryText = mode === 'create' ? 'Criar' : 'Salvar'

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-3xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-card p-6 font-sans shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight text-foreground">
                {titleText}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground mt-1">
                {mode === 'create'
                  ? 'Faça upload e configure título, grupo e visibilidade.'
                  : initial
                    ? `/${initial.slug}`
                    : ''}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              disabled={isSaving}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Cross2Icon className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Título</label>
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                {mode === 'create' ? 'Slug (opcional)' : 'Slug'}
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="mt-1 w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Grupo</label>
              <input
                type="text"
                list="material-group-options"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="mt-1 w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              />
              <datalist id="material-group-options">
                {groupOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Tipo</label>
              <select
                value={mimeType}
                onChange={(e) => setMimeType(e.target.value as MaterialMimeType)}
                className="mt-1 w-full pl-4 pr-10 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              >
                <option value="pdf">PDF</option>
                <option value="docx">DOCX</option>
                <option value="xls">XLS</option>
                <option value="xlsx">XLSX</option>
                <option value="xlsm">XLSM</option>
                <option value="csv">CSV</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">Descrição (opcional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground resize-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">
                {mode === 'create' ? 'Arquivo' : 'Substituir arquivo (opcional)'}
              </label>
              <div className="mt-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptByMime[mimeType]}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-dashed border-border bg-background/60 p-4 text-left transition-colors hover:bg-muted/30 disabled:opacity-60"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file?.name || initial?.filename || 'Selecionar arquivo'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {file
                          ? `Novo arquivo selecionado${file.size ? ` • ${formatBytes(file.size)}` : ''}`
                          : mode === 'edit' && initial?.filename
                            ? 'Arquivo atual'
                            : 'PDF, DOCX, XLS, XLSX, XLSM ou CSV'}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {mode === 'create'
                        ? 'Selecionar'
                        : initial?.filename
                          ? 'Trocar'
                          : 'Selecionar'}
                    </span>
                  </div>
                </button>

                <div className="flex items-center justify-between gap-2">
                  {mode === 'edit' && initial?.filename ? (
                    <button
                      type="button"
                      onClick={openCurrentFile}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-60"
                    >
                      Abrir arquivo atual
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">&nbsp;</span>
                  )}

                  {file ? (
                    <button
                      type="button"
                      onClick={clearSelectedFile}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
                    >
                      Remover seleção
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
              <input
                id="material-modal-published"
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="material-modal-published" className="text-sm text-foreground">
                Publicado
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <DialogPrimitive.Close
              disabled={isSaving}
              className="px-4 py-2 bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg"
            >
              Cancelar
            </DialogPrimitive.Close>
            <button
              onClick={handlePrimary}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              {isSaving ? 'Salvando...' : primaryText}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default function MaterialsTab({ isAdmin }: MaterialsTabProps) {
  const [materials, setMaterials] = useState<AdminMaterialListItem[]>([])
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(true)
  const [materialsSearch, setMaterialsSearch] = useState('')
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false)
  const [materialModalMode, setMaterialModalMode] = useState<MaterialModalMode>('create')
  const [materialModalInitial, setMaterialModalInitial] = useState<AdminMaterialListItem | null>(null)
  const [isSavingMaterial, setIsSavingMaterial] = useState(false)
  const [deleteMaterialId, setDeleteMaterialId] = useState<string | null>(null)

  const extractErrorMessage = useCallback(async (response: Response, fallback: string) => {
    try {
      const data: unknown = await response.json()
      if (data && typeof data === 'object' && 'detail' in data) {
        const detail = (data as { detail?: unknown }).detail
        if (typeof detail === 'string' && detail.trim()) return detail

        if (Array.isArray(detail)) {
          const messages = detail
            .map((item) => {
              if (!item || typeof item !== 'object') return null
              const loc = 'loc' in item ? (item as { loc?: unknown }).loc : undefined
              const msg = 'msg' in item ? (item as { msg?: unknown }).msg : undefined
              const locParts = Array.isArray(loc) ? loc : []
              const field = locParts
                .map((p) => (typeof p === 'string' || typeof p === 'number' ? String(p) : ''))
                .filter(Boolean)
                .at(-1)
              const messageText = typeof msg === 'string' ? msg : ''
              if (field && messageText) return `${field}: ${messageText}`
              if (messageText) return messageText
              return null
            })
            .filter((m): m is string => Boolean(m && m.trim()))

          if (messages.length > 0) return messages.join('; ')
        }
      }
    } catch {
      return fallback
    }
    return fallback
  }, [])

  const loadMaterials = useCallback(async () => {
    setIsMaterialsLoading(true)
    try {
      const res = await fetchWithCredentials(`${API_URL}/materials/admin/list`)
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao carregar materiais'))
      const data = (await res.json()) as unknown
      setMaterials(Array.isArray(data) ? (data as AdminMaterialListItem[]) : [])
    } catch (err) {
      setMaterials([])
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar materiais')
    } finally {
      setIsMaterialsLoading(false)
    }
  }, [extractErrorMessage])

  useEffect(() => {
    void loadMaterials()
  }, [loadMaterials])

  const openCreateMaterialModal = () => {
    setMaterialModalMode('create')
    setMaterialModalInitial(null)
    setIsMaterialModalOpen(true)
  }

  const openEditMaterialModal = (item: AdminMaterialListItem) => {
    setMaterialModalMode('edit')
    setMaterialModalInitial(item)
    setIsMaterialModalOpen(true)
  }

  const closeMaterialModal = () => {
    setIsMaterialModalOpen(false)
    setMaterialModalInitial(null)
  }

  const handleSubmitMaterial = async (data: MaterialModalSubmitData) => {
    if (!isAdmin) {
      toast.error('Apenas admin pode salvar materiais')
      return
    }
    setIsSavingMaterial(true)
    try {
      const formData = new FormData()
      formData.append('title', data.title)
      formData.append('category', data.group)
      if (data.slug) formData.append('slug', data.slug)
      formData.append('description', data.description ?? '')
      formData.append('is_published', String(data.is_published))
      formData.append('mime_type', data.mime_type)
      if (data.file) formData.append('file', data.file)

      const url = materialModalMode === 'create'
        ? `${API_URL}/materials/admin`
        : `${API_URL}/materials/admin/${materialModalInitial?.id}`

      const method = materialModalMode === 'create' ? 'POST' : 'PATCH'

      const res = await fetchWithCredentials(url, {
        method,
        body: formData,
      })

      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao salvar material'))
      toast.success(materialModalMode === 'create' ? 'Material criado!' : 'Material atualizado!')
      closeMaterialModal()
      void loadMaterials()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar material')
    } finally {
      setIsSavingMaterial(false)
    }
  }

  const handleDeleteMaterial = async (materialId: string) => {
    if (!isAdmin) {
      toast.error('Apenas admin pode excluir materiais')
      return
    }
    try {
      const res = await fetchWithCredentials(`${API_URL}/materials/admin/${materialId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(await extractErrorMessage(res, 'Erro ao excluir material'))
      toast.success('Material excluído!')
      if (materialModalInitial?.id === materialId) closeMaterialModal()
      setDeleteMaterialId(null)
      void loadMaterials()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir material')
    }
  }

  const materialGroupOptions = useMemo(() => {
    const set = new Set<string>()
    for (const m of materials) {
      if (m.category?.trim()) set.add(m.category.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [materials])
  const filteredMaterials = useMemo(() => {
    const q = materialsSearch.trim().toLowerCase()
    return materials.filter((m) => {
      if (!q) return true
      return (
        m.title.toLowerCase().includes(q) ||
        m.slug.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      )
    })
  }, [materials, materialsSearch])

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-foreground">Gerenciar Materiais</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadMaterials} disabled={isMaterialsLoading}>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button onClick={openCreateMaterialModal}>
              <Plus className="h-4 w-4" />
              Novo material
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="p-4 border-b border-border">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={materialsSearch}
                  onChange={(e) => setMaterialsSearch(e.target.value)}
                  placeholder="Buscar materiais..."
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isMaterialsLoading ? (
              <div className="py-16 flex items-center justify-center">
                <LoadingSpinner size="lg" text="Carregando materiais..." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Material</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Grupo</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="px-6 py-3 text-right font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredMaterials.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{m.title}</span>
                            <span className="text-xs text-muted-foreground">{m.slug}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{m.category}</td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                              m.is_published
                                ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50'
                                : 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800'
                            )}
                          >
                            {m.is_published ? 'Publicado' : 'Rascunho'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditMaterialModal(m)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteMaterialId(m.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredMaterials.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">Nenhum material encontrado.</div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        {isMaterialModalOpen ? (
          <MaterialModal
            key={`${materialModalMode}-${materialModalInitial?.id ?? 'new'}`}
            open={isMaterialModalOpen}
            mode={materialModalMode}
            initial={materialModalInitial}
            groupOptions={materialGroupOptions}
            isSaving={isSavingMaterial}
            onOpenChange={(open) => {
              if (!open) closeMaterialModal()
              else setIsMaterialModalOpen(true)
            }}
            onSubmit={handleSubmitMaterial}
          />
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={!!deleteMaterialId}
        onClose={() => setDeleteMaterialId(null)}
        onConfirm={() => deleteMaterialId && handleDeleteMaterial(deleteMaterialId)}
        title="Excluir material?"
        description="Esta ação é permanente e não pode ser desfeita. O arquivo será removido do servidor."
        confirmText="Excluir"
        variant="danger"
      />
    </>
  )
}
