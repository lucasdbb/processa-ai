import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, DollarSign, Edit, FileText, MoreVertical, Plus, Trash2, Wallet, Handshake } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { analytics } from '@/lib/analytics'
import { servicesService } from '@/services/services-service'
import { documentsService, type Document } from '@/services/documents-service'
import { ServiceFormDialog } from '@/components/forms/service-form-dialog'
import { DocumentFormDialog } from '@/components/forms/document-form-dialog'
import { useServiceDetail } from '@/hooks/use-services'
import { useQueryClient, useQuery } from '@tanstack/react-query'

type Tab = 'resumo' | 'documentos'

type SaveServicePayload = Parameters<ComponentProps<typeof ServiceFormDialog>['onSave']>[0]
type SaveDocumentPayload = Parameters<ComponentProps<typeof DocumentFormDialog>['onSave']>[0]
type SaveDocumentFile = Parameters<ComponentProps<typeof DocumentFormDialog>['onSave']>[1]

const formatCurrency = (value: number | null) => {
  if (value === null) return 'Não definido'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const formatShortDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return dateStr
  }
}

const getServiceCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    previdenciario: 'Previdenciário',
    trabalhista: 'Trabalhista',
    civel: 'Cível',
    tributario: 'Tributário',
    familiar: 'Familiar',
    empresarial: 'Empresarial',
    imobiliario: 'Imobiliário',
    administrativo: 'Administrativo',
    consultoria: 'Consultoria',
    outro: 'Outro',
  }
  return labels[category] || category
}

const getServiceStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-500',
    completed: 'bg-blue-500/10 text-blue-500',
    cancelled: 'bg-gray-500/10 text-gray-500',
  }
  return colors[status] || 'bg-gray-500/10 text-gray-500'
}

const getServiceStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    active: 'Ativo',
    completed: 'Concluído',
    cancelled: 'Cancelado',
  }
  return labels[status] || status
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ServicoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('resumo')
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDocumentDialog, setShowDocumentDialog] = useState(false)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const actionsMenuRef = useRef<HTMLDivElement>(null)

  const { data: service, isLoading, isError } = useServiceDetail(id || '')

  useEffect(() => {
    if (isError) {
      toast.error('Erro ao carregar serviço')
      navigate('/app/servicos')
    }
  }, [isError, navigate])

  const { data: documentsResponse, isLoading: isLoadingDocuments } = useQuery({
    queryKey: ['documents', 'service', id],
    queryFn: () => documentsService.list({ service_id: id! }),
    enabled: !!id && activeTab === 'documentos',
  })
  const documents = documentsResponse?.documents ?? []

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSaveService = async (data: SaveServicePayload) => {
    try {
      await servicesService.update(id!, data)
      toast.success('Serviço atualizado')
      await queryClient.invalidateQueries({ queryKey: ['services', 'detail', id] })
      setShowEditDialog(false)
    } catch (error) {
      console.error('Error updating service:', error)
      toast.error('Erro ao atualizar serviço')
    }
  }

  const handleSaveDocument = async (data: SaveDocumentPayload, file?: SaveDocumentFile) => {
    try {
      const normalizedData = {
        ...data,
        process_id: data.process_id || undefined,
        service_id: data.service_id || undefined,
        client_id: data.client_id || undefined,
        description: data.description || undefined,
      }

      if (editingDocument) {
        await documentsService.update(editingDocument.id, normalizedData)
        toast.success('Documento atualizado')
      } else {
        const createPayload = {
          ...normalizedData,
          service_id: id ?? normalizedData.service_id,
        }
        if (file) {
          await documentsService.createWithFile(createPayload, file)
        } else {
          await documentsService.create(createPayload)
        }
        toast.success('Documento criado')
      }
      await queryClient.invalidateQueries({ queryKey: ['documents', 'service', id] })
      await queryClient.invalidateQueries({ queryKey: ['services', 'detail', id] })
      setShowDocumentDialog(false)
      setEditingDocument(null)
    } catch (error) {
      console.error('Error saving document:', error)
      toast.error(editingDocument ? 'Erro ao atualizar documento' : 'Erro ao criar documento')
    }
  }

  const handleDownloadDocument = async (doc: Document) => {
    try {
      const url = await documentsService.getDownloadUrl(doc.id)
      const res = await fetch(url)
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const element = document.createElement('a')
      element.href = blobUrl
      element.download = doc.name
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
      URL.revokeObjectURL(blobUrl)
      toast.success('Download iniciado')
    } catch (error) {
      console.error('Error downloading document:', error)
      toast.error('Erro ao baixar documento')
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return
    try {
      await documentsService.delete(docId)
      analytics.track('office_action', { entity: 'document', action: 'deleted' })
      toast.success('Documento excluído')
      await queryClient.invalidateQueries({ queryKey: ['documents', 'service', id] })
      await queryClient.invalidateQueries({ queryKey: ['services', 'detail', id] })
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Erro ao excluir documento')
    }
  }


  const handleDeleteService = async () => {
    if (!service) return
    try {
      await servicesService.delete(id!)
      analytics.track('office_action', { entity: 'service', action: 'deleted' })
      toast.success('Serviço excluído')
      navigate('/app/clientes/' + service.client_id)
    } catch (error) {
      console.error('Error deleting service:', error)
      toast.error('Erro ao excluir serviço')
    }
  }

  if (isLoading || !service) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando serviço...</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'resumo' as const, label: 'Resumo' },
    { id: 'documentos' as const, label: 'Documentos' },
  ]
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 rounded-lg border border-border bg-card">
        {/* Top row: título + status + botão de ações (sempre na mesma linha) */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground truncate">{service.name}</h1>
              <span
                className={cn(
                  'shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase',
                  getServiceStatusColor(service.status)
                )}
              >
                {getServiceStatusLabel(service.status)}
              </span>
            </div>
          </div>

          {/* Actions Menu — sempre à direita, no topo */}
          <div className="relative shrink-0" ref={actionsMenuRef}>
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Mais ações"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showActionsMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg z-50">
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowEditDialog(true)
                      setShowActionsMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Editar Serviço
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteModal(true)
                      setShowActionsMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir Serviço
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cliente */}
        <div className="flex items-center gap-1.5 text-sm sm:text-base mb-3">
          <span className="text-muted-foreground">Cliente:</span>
          <Link
            to={`/app/clientes/${service.client.id}`}
            className="font-medium text-foreground hover:text-primary"
          >
            {service.client.name}
          </Link>
          <Link
            to={`/app/clientes/${service.client.id}`}
            className="text-xs text-primary hover:underline"
            title="Ver cliente"
          >
            (ver perfil)
          </Link>
        </div>

        {/* Metadata inline: categoria · valor · data */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground mb-2">
          <span className="font-medium text-foreground">{getServiceCategoryLabel(service.category)}</span>
          {service.value ? (
            <><span>·</span><span className="flex items-center gap-1 text-green-600 dark:text-green-500 font-medium"><DollarSign className="h-3 w-3" />{formatCurrency(service.value)}</span></>
          ) : null}
          <span>·</span>
          <span>Criado em {formatShortDate(service.created_at)}</span>
        </div>

        {/* Parceria — linha separada se existir */}
        {service.is_partnership && (
          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-purple-600 dark:text-purple-400 font-medium">
            <Handshake className="h-3.5 w-3.5 shrink-0" />
            <span>Parceria · {service.partner_percentage}% escritório{service.partner_lawyer ? ` · ${service.partner_lawyer}` : ''}</span>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => {
          setShowDocumentDialog(true)
          setEditingDocument(null)
        }}
        className="fixed bottom-18 right-6 lg:bottom-6 z-50 flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
        title="Novo Documento"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Tabs */}
      <div className="border-b border-border pb-1">
        <div className="flex gap-2 overflow-x-auto p-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap text-sm font-medium',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pb-6">
        {activeTab === 'resumo' && (
          <div className="space-y-6">
            {/* Financial Summary */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Resumo Financeiro</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm text-muted-foreground">Valor Total</h3>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(service.value)}
                  </p>
                </div>
                <div className="p-6 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <h3 className="text-sm text-muted-foreground">Valor Pago</h3>
                  </div>
                  <p className="text-2xl font-bold text-green-500">
                    {formatCurrency(service.paid_amount)}
                  </p>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{
                        width: `${Math.min(service.value ? (service.paid_amount / service.value) * 100 : 0, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="p-6 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <h3 className="text-sm text-muted-foreground">Saldo Pendente</h3>
                  </div>
                  <p className="text-2xl font-bold text-orange-500">
                    {formatCurrency(service.value ? service.value - service.paid_amount : 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Description/Notes */}
            {service.notes && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Descrição</h3>
                <div className="p-4 rounded-lg border border-border bg-card">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{service.notes}</p>
                </div>
              </div>
            )}

            {/* Recent Documents */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Documentos Recentes</h3>
                {service.documents_count > 0 && (
                  <button
                    onClick={() => setActiveTab('documentos')}
                    className="text-sm text-primary hover:underline"
                  >
                    Ver todos ({service.documents_count})
                  </button>
                )}
              </div>
              {service.documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum documento cadastrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {service.documents.slice(0, 3).map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-lg border border-border bg-card flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatShortDate(doc.created_at)}
                            {doc.file_size && ` · ${formatFileSize(doc.file_size)}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'documentos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Documentos do Serviço</h3>
            </div>

            {isLoadingDocuments ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum documento cadastrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-lg border border-border bg-card flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatShortDate(doc.created_at)}
                          {doc.file_size && ` · ${formatFileSize(doc.file_size)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {doc.file_url && (
                        <button
                          onClick={() => handleDownloadDocument(doc)}
                          className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                          title="Baixar documento"
                        >
                          <svg
                            className="h-4 w-4 text-muted-foreground"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingDocument(doc)
                          setShowDocumentDialog(true)
                        }}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                        title="Editar documento"
                      >
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                        title="Excluir documento"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Dialogs */}
      {showEditDialog && (
        <ServiceFormDialog
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          service={service}
          onSave={handleSaveService}
        />
      )}

      {showDocumentDialog && (
        <DocumentFormDialog
          isOpen={showDocumentDialog}
          onClose={() => {
            setShowDocumentDialog(false)
            setEditingDocument(null)
          }}
          document={editingDocument || undefined}
          preselectedServiceId={id}
          onSave={handleSaveDocument}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">Excluir Serviço</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.
            </p>
            {service.documents_count > 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
                <p className="text-sm text-destructive">
                  ⚠️ Este serviço possui {service.documents_count} documento(s) que também serão excluídos.
                </p>
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleDeleteService()
                  setShowDeleteModal(false)
                }}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors text-sm font-medium"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
