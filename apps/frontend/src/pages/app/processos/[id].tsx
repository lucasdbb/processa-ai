import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  User,
  Building2,
  DollarSign,
  FileText,
  Clock,
  AlertCircle,
  Edit,
  Download,
  Plus,
  Phone,
  Mail,
  Trash2,
  TrendingUp,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { DeadlineFormDialog } from '@/components/forms/deadline-form-dialog'
import { ProcessFormDialog } from '@/components/forms/process-form-dialog'
import { DocumentFormDialog } from '@/components/forms/document-form-dialog'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import {
  processesService,
  type Process,
  type ProcessDetail,
} from '@/services/processes-service'
import { deadlinesService } from '@/services/deadlines-service'
import { documentsService, type Document } from '@/services/documents-service'

type Tab = 'resumo' | 'andamentos' | 'prazos' | 'documentos'

export default function ProcessoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('resumo')
  const [showDeadlineDialog, setShowDeadlineDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingDeadline, setEditingDeadline] = useState<ProcessDetail['deadlines'][0] | null>(null)
  const [showDocumentDialog, setShowDocumentDialog] = useState(false)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)

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

  const processForDialog: (Process & { client_name?: string }) | undefined = process
    ? {
        id: process.id,
        user_id: process.user_id,
        client_id: process.client_id,
        process_number: process.process_number,
        type: process.type,
        court: process.court,
        defendant: process.defendant,
        subject: process.subject,
        value: process.value,
        status: process.status,
        notes: process.notes,
        start_date: process.start_date,
        end_date: process.end_date,
        created_at: process.created_at,
        updated_at: process.updated_at,
        client_name: process.client.name,
      }
    : undefined

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    } catch {
      return dateStr
    }
  }

  const formatShortDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR })
    } catch {
      return dateStr
    }
  }

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    }
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
    }
    return phone
  }

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  const formatCPFOrCNPJ = (doc: string) => {
    const cleaned = doc.replace(/\D/g, '')
    if (cleaned.length === 11) return formatCPF(cleaned)
    if (cleaned.length === 14) return formatCNPJ(cleaned)
    return doc
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-500/10 text-green-500',
      pending: 'bg-yellow-500/10 text-yellow-500',
      suspended: 'bg-orange-500/10 text-orange-500',
      archived: 'bg-gray-500/10 text-gray-500',
      concluded: 'bg-blue-500/10 text-blue-500',
      cancelled: 'bg-red-500/10 text-red-500',
    }
    const labels: Record<string, string> = {
      active: 'Ativo',
      pending: 'Pendente',
      suspended: 'Suspenso',
      archived: 'Arquivado',
      concluded: 'Concluído',
      cancelled: 'Cancelado',
    }
    return (
      <span className={cn('px-2 py-1 rounded text-xs font-medium', styles[status] || styles.active)}>
        {labels[status] || status}
      </span>
    )
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
      {/* Back Button */}
      <Link
        to="/app/processos"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar aos Processos
      </Link>

      {/* Process Header */}
      <div className="p-4 rounded-lg border border-border bg-card">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Left: Title + Info */}
          <div className="flex-1 space-y-3">
            {/* Title + Status */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{process.process_number}</h1>
              {getStatusBadge(process.status)}
            </div>
            
            {/* Metadata Chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                {process.type}
              </span>
              {process.value && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-600 dark:text-green-500 font-medium">
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(process.value)}
                </span>
              )}
              {process.court && (
                <span className="text-muted-foreground">{process.court}</span>
              )}
            </div>

            {/* Client + Defendant inline */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{process.client.name}</span>
                <Link
                  to={`/app/clientes/${process.client.id}`}
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
                  title="Ver cliente"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              {process.defendant && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>vs</span>
                  <Building2 className="h-4 w-4" />
                  <span>{process.defendant}</span>
                </div>
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
            <div className="relative group">
              <button
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="py-1">
                  <button
                    onClick={() => {
                      setEditingDeadline(null)
                      setShowDeadlineDialog(true)
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <Clock className="h-4 w-4" />
                    Novo Prazo
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Funcionalidade de andamentos em desenvolvimento')
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
            </div>
            <button
              onClick={() => setShowEditDialog(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-border bg-background hover:bg-accent transition-colors"
            >
              <Edit className="h-4 w-4" />
              Editar
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
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
                <div className="p-6 rounded-lg border border-border bg-card text-center text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum prazo cadastrado</p>
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
              <div className="p-6 rounded-lg border border-border bg-card text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Nenhum andamento registrado</p>
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
                        <h3 className="font-semibold text-foreground">{event.title}</h3>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatShortDate(event.event_date)}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground">{event.description}</p>
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
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum prazo cadastrado</p>
                <button
                  onClick={() => setShowDeadlineDialog(true)}
                  className="mt-4 text-primary hover:underline"
                >
                  Cadastrar primeiro prazo
                </button>
              </div>
            ) : (
              process.deadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className={cn(
                    'p-3 rounded-md border bg-card',
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
                        {deadline.description && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                            {deadline.description}
                          </p>
                        )}
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
                          onClick={() => {
                            setEditingDeadline(deadline)
                            setShowDeadlineDialog(true)
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
                                await deadlinesService.delete(deadline.id)
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
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum documento anexado</p>
                <button
                  onClick={() => {
                    setEditingDocument(null)
                    setShowDocumentDialog(true)
                  }}
                  className="mt-4 text-primary hover:underline"
                >
                  Adicionar primeiro documento
                </button>
              </div>
            ) : (
              <>
                {process.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-lg border border-border bg-card"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <h3 className="font-medium text-foreground">{doc.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {doc.file_type || 'Documento'} · {formatShortDate(doc.created_at)} ·{' '}
                            {formatFileSize(doc.file_size)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.file_url && (
                          <button className="p-1.5 rounded-lg hover:bg-accent transition-colors" title="Baixar">
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
      {processForDialog && (
        <>
          <DeadlineFormDialog
            isOpen={showDeadlineDialog}
            onClose={() => {
              setShowDeadlineDialog(false)
              setEditingDeadline(null)
            }}
            preselectedProcess={processForDialog}
            deadline={editingDeadline ? {
              id: editingDeadline.id,
              title: editingDeadline.title,
              processNumber: process?.process_number || '',
              processId: editingDeadline.process_id,
              date: editingDeadline.due_date.split('T')[0],
              time: editingDeadline.due_date.includes('T') 
                ? editingDeadline.due_date.split('T')[1].split(':').slice(0, 2).join(':') 
                : '',
              type: 'outros',
              priority: editingDeadline.priority === 'high' ? 'alta' : editingDeadline.priority === 'low' ? 'baixa' : 'media',
              description: editingDeadline.description || undefined,
              notifyBefore: editingDeadline.reminder_days_before,
            } : undefined}
            onSave={() => {
              setShowDeadlineDialog(false)
              setEditingDeadline(null)
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
              client_id: editingDocument.client_id,
              description: editingDocument.description,
            } : undefined}
            onSave={async (docData) => {
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
        </>
      )}
    </div>
  )
}
