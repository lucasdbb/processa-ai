import { useCallback, useEffect, useState, useRef, type ComponentProps } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Calendar,
  User,
  Building2,
  DollarSign,
  FileText,
  Clock,
  AlertCircle,
  Edit,
  Plus,
  Trash2,
  TrendingUp,
  Download,
  MoreVertical,
  Archive,
  AlertTriangle,
  Scale,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { CalendarEventFormDialog } from '@/components/forms/calendar-event-form-dialog'
import { ProcessFormDialog, type ProcessFormData } from '@/components/forms/process-form-dialog'
import { DocumentFormDialog } from '@/components/forms/document-form-dialog'
import { TimelineFormDialog } from '@/components/forms/timeline-form-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import {
  processesService,
  type ProcessDetail,
  type ProcessTimelineEvent,
} from '@/services/processes-service'
import { calendarService, type CalendarEvent } from '@/services/calendar-service'
import { documentsService, type Document } from '@/services/documents-service'
import { timelineService, type TimelineEventType } from '@/services/timeline-service'

type Tab = 'resumo' | 'andamentos' | 'prazos' | 'documentos'
type EditingTimelineEvent = ComponentProps<typeof TimelineFormDialog>['event']

export default function ProcessoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('resumo')
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined)
  const [showDocumentDialog, setShowDocumentDialog] = useState(false)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [showTimelineDialog, setShowTimelineDialog] = useState(false)
  const [editingTimelineEvent, setEditingTimelineEvent] = useState<EditingTimelineEvent>(undefined)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteTimelineModal, setShowDeleteTimelineModal] = useState(false)
  const [timelineToDelete, setTimelineToDelete] = useState<ProcessTimelineEvent | null>(null)
  const [deleteTimelineDocuments, setDeleteTimelineDocuments] = useState(false)
  const [isDeletingTimeline, setIsDeletingTimeline] = useState(false)
  const actionsMenuRef = useRef<HTMLDivElement>(null)

  const [process, setProcess] = useState<ProcessDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProcess = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const data = await processesService.getDetail(id)
      setProcess(data)
    } catch (error) {
      console.error('Error fetching process:', error)
      toast.error('Erro ao carregar processo')
      navigate('/app/processos')
    } finally {
      setIsLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    void fetchProcess()
  }, [fetchProcess])

  // Close actions menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const processForDialog: ProcessFormData | undefined = process
    ? {
        id: process.id,
        client_id: process.client_id,
        client_name: process.client?.name,
        process_number: process.process_number,
        type: process.type,
        area: process.area || '',
        court: process.court || '',
        tribunal: process.tribunal || '',
        defendant: process.defendant || '',
        client_role: process.client_role ?? 'author',
        value: process.value || 0,
        status: process.status,
        notes: process.notes || undefined,
        start_date: process.start_date || undefined,
      }
    : undefined

  const formatCurrency = (value: number) => {
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getPriorityColor = (priority: string | null) => {
    const colors: Record<string, string> = {
      high: 'text-destructive',
      alta: 'text-destructive',
      medium: 'text-orange-500',
      media: 'text-orange-500',
      low: 'text-blue-500',
      baixa: 'text-blue-500',
    }
    return priority ? colors[priority.toLowerCase()] || 'text-muted-foreground' : 'text-muted-foreground'
  }

  const getTimelineIcon = (eventType: string) => {
    const colors: Record<string, string> = {
      creation: 'bg-green-500',
      update: 'bg-blue-500',
      deadline: 'bg-orange-500',
      document: 'bg-purple-500',
      note: 'bg-gray-500',
      status_change: 'bg-yellow-500',
      hearing: 'bg-red-500',
      petition: 'bg-indigo-500',
      decision: 'bg-emerald-500',
      citation: 'bg-cyan-500',
      other: 'bg-gray-400',
    }
    return colors[eventType] || 'bg-gray-500'
  }

  const handleArchiveProcess = async () => {
    if (!id) return
    try {
      await processesService.update(id, { status: 'archived' })
      toast.success('Processo arquivado com sucesso')
      await fetchProcess()
      setShowActionsMenu(false)
    } catch (error) {
      console.error('Error archiving process:', error)
      toast.error('Erro ao arquivar processo')
    }
  }

  const handleDeleteProcess = async () => {
    if (!id || !deleteConfirmation) return
    setIsDeleting(true)
    try {
      await processesService.delete(id)
      toast.success('Processo excluído com sucesso')
      navigate('/app/processos')
    } catch (error) {
      console.error('Error deleting process:', error)
      toast.error('Erro ao excluir processo')
      setShowDeleteModal(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEditTimelineEvent = (event: ProcessTimelineEvent) => {
    setEditingTimelineEvent({
      id: event.id,
      title: event.title,
      event_type: event.event_type as TimelineEventType,
      description: event.description || undefined,
      event_date: event.event_date,
      documents: event.documents?.map((doc) => ({ id: doc.id, name: doc.name })) || [],
    })
    setShowTimelineDialog(true)
  }

  const handleDeleteTimelineEvent = async () => {
    if (!timelineToDelete) return
    setIsDeletingTimeline(true)
    try {
      // Delete timeline event
      await timelineService.delete(timelineToDelete.id)
      
      // If user chose to delete documents, delete them
      if (deleteTimelineDocuments && timelineToDelete.documents?.length) {
        for (const doc of timelineToDelete.documents) {
          try {
            await documentsService.delete(doc.id)
          } catch (error) {
            console.error('Error deleting document:', doc.id, error)
          }
        }
      }
      
      toast.success('Andamento excluído com sucesso')
      await fetchProcess()
      setShowDeleteTimelineModal(false)
      setTimelineToDelete(null)
      setDeleteTimelineDocuments(false)
    } catch (error) {
      console.error('Error deleting timeline event:', error)
      toast.error('Erro ao excluir andamento')
    } finally {
      setIsDeletingTimeline(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'andamentos', label: 'Andamentos' },
    { id: 'prazos', label: 'Prazos' },
    { id: 'documentos', label: 'Documentos' },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!process) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Processo não encontrado</p>
        <Link to="/app/processos" className="text-primary hover:underline mt-2 inline-block">
          Voltar aos Processos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Process Header */}
      <div className="p-4 rounded-lg border border-border bg-card">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Left: Title + Info */}
          <div className="flex-1 space-y-3">
            {/* Title + Status */}
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-foreground">{process.process_number}</h1>
              <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold uppercase', 
                process.status === 'active' ? 'bg-green-500/10 text-green-500' :
                process.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                process.status === 'suspended' ? 'bg-orange-500/10 text-orange-500' :
                process.status === 'archived' ? 'bg-gray-500/10 text-gray-500' :
                process.status === 'concluded' ? 'bg-blue-500/10 text-blue-500' :
                'bg-red-500/10 text-red-500'
              )}>
                {process.status === 'active' ? 'Ativo' :
                 process.status === 'pending' ? 'Pendente' :
                 process.status === 'suspended' ? 'Suspenso' :
                 process.status === 'archived' ? 'Arquivado' :
                 process.status === 'concluded' ? 'Concluído' :
                 'Cancelado'}
              </span>
            </div>
            
            {/* Metadata Chips */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                {process.type}
              </span>
              {process.area && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-500 font-medium">
                  <Scale className="h-3 w-3" />
                  {process.area}
                </span>
              )}
              {process.value && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-600 dark:text-green-500 font-medium">
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(process.value)}
                </span>
              )}
              {(process.court || process.tribunal) && (
                <span className="text-muted-foreground">
                  {[process.tribunal, process.court].filter(Boolean).join(' • ')}
                </span>
              )}
            </div>

            {/* Client + Defendant inline */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {process.client_role === 'defendant' ? (
                <>
                  {process.defendant && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>{process.defendant}</span>
                    </div>
                  )}
                  {process.defendant && <span className="text-muted-foreground">vs</span>}
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{process.client.name}</span>
                    <Link
                      to={`/app/clientes/${process.client.id}`}
                      className="text-xs text-primary hover:underline"
                      title="Ver cliente"
                    >
                      (ver perfil)
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{process.client.name}</span>
                    <Link
                      to={`/app/clientes/${process.client.id}`}
                      className="text-xs text-primary hover:underline"
                      title="Ver cliente"
                    >
                      (ver perfil)
                    </Link>
                  </div>
                  {process.defendant && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>vs</span>
                      <Building2 className="h-4 w-4" />
                      <span>{process.defendant}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Dates */}
            {(process.start_date || process.end_date) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {process.start_date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Distrib: {formatShortDate(process.start_date)}</span>
                  </div>
                )}
                {process.end_date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Encerr: {formatShortDate(process.end_date)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Actions Menu */}
            <div className="relative" ref={actionsMenuRef}>
              <button
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                className="flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
                      Editar Processo
                    </button>
                    <button
                      onClick={handleArchiveProcess}
                      className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      Arquivar
                    </button>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => {
                        setShowDeleteModal(true)
                        setShowActionsMenu(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir Processo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50 group">
        <div className="absolute bottom-full right-0 mb-4 w-48 bg-popover border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
          <div className="py-1">
            <button
              onClick={() => {
                setEditingEvent(undefined)
                setShowEventDialog(true)
              }}
              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Novo Prazo
            </button>
            <button
              onClick={() => {
                setShowTimelineDialog(true)
              }}
              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Novo Andamento
            </button>
            <button
              onClick={() => {
                setEditingDocument(null)
                setShowDocumentDialog(true)
              }}
              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Novo Documento
            </button>
          </div>
        </div>
        <button
          className="flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border pb-1">
        <div className="flex gap-2 overflow-x-auto p-1">
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
              {tab.id === 'prazos' && process.overdue_deadlines_count > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {process.overdue_deadlines_count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pb-6">
        {activeTab === 'resumo' && (
          <div className="space-y-6">
            {/* Description */}
            {(process.notes || process.subject) && (
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-3">
                  {process.subject ? 'Assunto' : 'Observações'}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {process.subject || process.notes}
                </p>
              </div>
            )}

            {/* Upcoming Deadlines */}
            <div>
              <h3 className="font-semibold text-foreground mb-3">
                Próximos prazos ({process.deadlines_count})
              </h3>
              {process.deadlines.length === 0 ? (
                <div className="p-8 rounded-lg border border-dashed border-border text-center text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum prazo cadastrado</p>
                  <button
                    onClick={() => {
                      setEditingEvent(undefined)
                      setShowEventDialog(true)
                    }}
                    className="mt-2 text-primary hover:underline font-medium"
                  >
                    Adicionar Prazo
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {process.deadlines.map((deadline) => (
                    <div
                      key={deadline.id}
                      className={cn(
                        'p-4 rounded-lg border bg-card flex items-center justify-between',
                        deadline.days_until < 0
                          ? 'border-red-500/30 bg-red-500/5'
                          : deadline.days_until <= 3
                            ? 'border-orange-500/30 bg-orange-500/5'
                            : 'border-border'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <AlertCircle className={cn('h-5 w-5', getPriorityColor(deadline.priority))} />
                        <div>
                          <h4 className="font-medium text-foreground">{deadline.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {formatShortDate(deadline.due_date)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            deadline.days_until < 0
                              ? 'text-red-600 dark:text-red-400'
                              : deadline.days_until <= 3
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-muted-foreground'
                          )}
                        >
                          {deadline.days_until === 0
                            ? 'HOJE'
                            : deadline.days_until < 0
                              ? `${Math.abs(deadline.days_until)} dias atrás`
                              : `${deadline.days_until} ${deadline.days_until === 1 ? 'dia' : 'dias'}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'andamentos' && (
          <div className="space-y-4">
            {process.timeline.length === 0 ? (
              <div className="p-8 rounded-lg border border-dashed border-border text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Nenhum andamento registrado</p>
                <button
                  onClick={() => setShowTimelineDialog(true)}
                  className="mt-2 text-primary hover:underline font-medium"
                >
                  Adicionar Andamento
                </button>
              </div>
            ) : (
              process.timeline.map((event, index) => (
                <div key={event.id} className="flex gap-4">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div className={cn('h-3 w-3 rounded-full', getTimelineIcon(event.event_type))} />
                    {index < process.timeline.length - 1 && (
                      <div className="w-0.5 h-full bg-border mt-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="p-4 rounded-lg border border-border bg-card">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">{event.title}</h3>
                          <span className="text-xs text-muted-foreground">
                            {formatShortDate(event.event_date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditTimelineEvent(event)}
                            className="p-1.5 rounded hover:bg-accent transition-colors"
                            title="Editar andamento"
                          >
                            <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => {
                              setTimelineToDelete(event)
                              setShowDeleteTimelineModal(true)
                            }}
                            className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                            title="Excluir andamento"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                      )}
                      {event.documents && event.documents.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Documentos vinculados:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {event.documents.map((doc) => (
                              <button
                                key={doc.id}
                                onClick={async () => {
                                  try {
                                    // Get signed URL from backend
                                    const url = await documentsService.getDownloadUrl(doc.id)
                                    // Download from signed URL (no credentials needed)
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
                                  } catch {
                                    toast.error('Erro ao baixar documento')
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-xs transition-colors"
                              >
                                <FileText className="h-3 w-3" />
                                <span className="truncate max-w-[180px]">{doc.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'prazos' && (
          <div className="space-y-2">
            {process.deadlines.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum prazo cadastrado</p>
                <button
                  onClick={() => setShowEventDialog(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Cadastrar primeiro prazo
                </button>
              </div>
            ) : (
              process.deadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className={cn(
                    'p-4 rounded-lg border bg-card',
                    deadline.days_until < 0
                      ? 'border-red-500/30 bg-red-500/5'
                      : deadline.days_until <= 3
                        ? 'border-orange-500/30 bg-orange-500/5'
                        : 'border-border'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <Clock className={cn('h-4 w-4', getPriorityColor(deadline.priority))} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground truncate">{deadline.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Data: {formatShortDate(deadline.due_date)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Status: {deadline.status === 'pending' ? 'Pendente' : deadline.status}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span
                          className={cn(
                            'text-xs font-medium',
                            deadline.days_until < 0
                              ? 'text-red-600 dark:text-red-400'
                              : deadline.days_until <= 3
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-muted-foreground'
                          )}
                        >
                          {deadline.days_until === 0
                            ? 'HOJE'
                            : deadline.days_until < 0
                              ? `${Math.abs(deadline.days_until)} dias atrás`
                              : `${deadline.days_until} ${deadline.days_until === 1 ? 'dia' : 'dias'}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={async () => {
                            try {
                              const fullEvent = await calendarService.getEvent(deadline.id)
                              setEditingEvent(fullEvent)
                              setShowEventDialog(true)
                            } catch {
                              toast.error('Erro ao carregar prazo')
                            }
                          }}
                          className="p-1 rounded-md hover:bg-accent transition-colors"
                          title="Editar prazo"
                        >
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Tem certeza que deseja excluir este prazo?')) {
                              try {
                                await calendarService.deleteEvent(deadline.id)
                                toast.success('Prazo excluído com sucesso')
                                await fetchProcess()
                              } catch {
                                toast.error('Erro ao excluir prazo')
                              }
                            }
                          }}
                          className="p-1 rounded-md hover:bg-destructive/10 transition-colors"
                          title="Excluir prazo"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'documentos' && (
          <div className="space-y-3">
            {process.documents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum documento anexado</p>
                <button
                  onClick={() => {
                    setEditingDocument(null)
                    setShowDocumentDialog(true)
                  }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar primeiro documento
                </button>
              </div>
            ) : (
              <>
                {process.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <h3 className="font-medium text-foreground">{doc.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {doc.mime_type || 'Documento'} · {formatShortDate(doc.created_at)} ·{' '}
                            {formatFileSize(doc.file_size)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.file_url && (
                          <button
                            onClick={async () => {
                              try {
                                // Get signed URL from backend
                                const url = await documentsService.getDownloadUrl(doc.id)
                                // Download from signed URL (no credentials needed)
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
                              } catch {
                                toast.error('Erro ao baixar documento')
                              }
                            }}
                            className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                            title="Baixar arquivo"
                          >
                            <Download className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            try {
                              const fullDoc = await documentsService.get(doc.id)
                              setEditingDocument(fullDoc)
                              setShowDocumentDialog(true)
                            } catch {
                              toast.error('Erro ao carregar documento')
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                          title="Editar documento"
                        >
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Tem certeza que deseja excluir este documento?')) {
                              try {
                                await documentsService.delete(doc.id)
                                toast.success('Documento excluído com sucesso')
                                await fetchProcess()
                              } catch {
                                toast.error('Erro ao excluir documento')
                              }
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                          title="Excluir documento"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setEditingDocument(null)
                    setShowDocumentDialog(true)
                  }}
                  className="w-full p-4 rounded-lg border border-dashed border-border hover:bg-accent transition-colors text-sm text-muted-foreground"
                >
                  + Adicionar novo documento
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {process && (
        <>
          <CalendarEventFormDialog
            isOpen={showEventDialog}
            onClose={() => {
              setShowEventDialog(false)
              setEditingEvent(undefined)
            }}
            event={editingEvent}
            defaultProcessId={process.id}
            defaultClientId={process.client_id}
            defaultEventType="prazo"
            onSave={() => {
              setShowEventDialog(false)
              setEditingEvent(undefined)
              void fetchProcess()
            }}
          />
          <ProcessFormDialog
            isOpen={showEditDialog}
            onClose={() => setShowEditDialog(false)}
            process={processForDialog}
            onSave={async () => {
              setShowEditDialog(false)
              await fetchProcess()
              toast.success('Processo atualizado com sucesso')
            }}
          />
          <DocumentFormDialog
            isOpen={showDocumentDialog}
            onClose={() => {
              setShowDocumentDialog(false)
              setEditingDocument(null)
            }}
            preselectedProcessId={id}
            document={editingDocument ? {
              id: editingDocument.id,
              name: editingDocument.name,
              type: editingDocument.type,
              status: editingDocument.status,
              file_url: editingDocument.file_url,
              process_id: editingDocument.process_id,
              service_id: editingDocument.service_id,
              client_id: editingDocument.client_id,
              description: editingDocument.description,
            } : undefined}
            onSave={async (docData, file) => {
              try {
                if (editingDocument) {
                  await documentsService.update(editingDocument.id, {
                    name: docData.name,
                    type: docData.type,
                    status: docData.status,
                    process_id: docData.process_id || undefined,
                    client_id: docData.client_id || undefined,
                    description: docData.description || undefined,
                  })
                  toast.success('Documento atualizado com sucesso!')
                } else if (file) {
                  await documentsService.createWithFile({
                    name: docData.name,
                    type: docData.type,
                    status: docData.status,
                    process_id: id,
                    client_id: docData.client_id || undefined,
                    description: docData.description || undefined,
                  }, file)
                  toast.success('Documento enviado com sucesso!')
                } else {
                  await documentsService.create({
                    name: docData.name,
                    type: docData.type,
                    status: docData.status,
                    process_id: id,
                    client_id: docData.client_id || undefined,
                    description: docData.description || undefined,
                  })
                  toast.success('Documento criado com sucesso!')
                }
                setShowDocumentDialog(false)
                setEditingDocument(null)
                await fetchProcess()
              } catch (error) {
                console.error('Error saving document:', error)
                toast.error(editingDocument ? 'Erro ao atualizar documento' : 'Erro ao criar documento')
              }
            }}
          />
          <TimelineFormDialog
            isOpen={showTimelineDialog}
            onClose={() => {
              setShowTimelineDialog(false)
              setEditingTimelineEvent(undefined)
            }}
            processId={id || ''}
            event={editingTimelineEvent}
            onSave={() => {
              setShowTimelineDialog(false)
              setEditingTimelineEvent(undefined)
              void fetchProcess()
            }}
          />

          {/* Delete Timeline Event Modal */}
          <Dialog open={showDeleteTimelineModal} onOpenChange={setShowDeleteTimelineModal}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Excluir Andamento?
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Você está prestes a excluir o andamento: <strong className="text-foreground">"{timelineToDelete?.title}"</strong>
                </p>
                
                {timelineToDelete?.documents && timelineToDelete.documents.length > 0 && (
                  <>
                    <div className="rounded-lg border border-border bg-muted/50 p-3">
                      <p className="text-sm font-medium text-foreground mb-2">
                        Este andamento possui {timelineToDelete.documents.length} documento(s) vinculado(s):
                      </p>
                      <ul className="space-y-1">
                        {timelineToDelete.documents.map((doc) => (
                          <li key={doc.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <FileText className="h-3 w-3" />
                            {doc.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-lg border border-orange-500/50 bg-orange-500/10">
                      <div className="relative flex items-center justify-center mt-0.5">
                        <input
                          type="checkbox"
                          checked={deleteTimelineDocuments}
                          onChange={(e) => setDeleteTimelineDocuments(e.target.checked)}
                          className="h-4 w-4 rounded border-border text-destructive focus:ring-destructive focus:ring-offset-0"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-foreground block mb-1">
                          Excluir também os documentos vinculados
                        </span>
                        <span className="text-xs text-orange-700 dark:text-orange-300">
                          Os documentos serão permanentemente removidos do sistema
                        </span>
                      </div>
                    </label>
                  </>
                )}
                
                {(!timelineToDelete?.documents || timelineToDelete.documents.length === 0) && (
                  <p className="text-xs text-muted-foreground">
                    Este andamento não possui documentos vinculados.
                  </p>
                )}
              </div>
              <DialogFooter className="gap-2">
                <button
                  onClick={() => {
                    setShowDeleteTimelineModal(false)
                    setTimelineToDelete(null)
                    setDeleteTimelineDocuments(false)
                  }}
                  disabled={isDeletingTimeline}
                  className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteTimelineEvent}
                  disabled={isDeletingTimeline}
                  className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {isDeletingTimeline ? 'Excluindo...' : 'Excluir Andamento'}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Modal */}
          <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Excluir Processo {process.process_number}?
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Esta ação não pode ser desfeita. Ao excluir este processo, <strong className="text-foreground">todos os dados relacionados serão permanentemente removidos</strong>:
                </p>
                <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Prazos:</span>
                    <span className="font-semibold text-foreground">{process.deadlines_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Andamentos:</span>
                    <span className="font-semibold text-foreground">{process.timeline_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Documentos:</span>
                    <span className="font-semibold text-foreground">{process.documents_count || 0}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-3 text-xs text-orange-700 dark:text-orange-300">
                  <strong>Também serão excluídos em cascata:</strong>
                  <ul className="list-disc list-inside mt-1.5 space-y-0.5 ml-1">
                    <li>Eventos de calendário vinculados</li>
                    <li>Notas e observações do processo</li>
                    <li>Honorários vinculados</li>
                  </ul>
                </div>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center mt-0.5">
                    <input
                      type="checkbox"
                      checked={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-destructive focus:ring-destructive focus:ring-offset-0"
                    />
                  </div>
                  <span className="text-sm text-foreground group-hover:text-foreground/80">
                    Entendo as consequências e desejo excluir permanentemente este processo
                  </span>
                </label>
              </div>
              <DialogFooter className="gap-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeleteConfirmation(false)
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteProcess}
                  disabled={!deleteConfirmation || isDeleting}
                  className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Excluindo...' : 'Excluir Processo'}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
