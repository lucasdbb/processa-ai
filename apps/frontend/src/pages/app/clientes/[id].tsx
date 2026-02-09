import { useCallback, useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  Phone,
  FileText,
  Calculator,
  FolderKanban,
  DollarSign,
  StickyNote,
  Edit,
  Plus,
  MapPin,
  Calendar,
  Pin,
  Trash2,
  MoreVertical,
  Archive,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ProcessFormDialog } from '@/components/forms/process-form-dialog'
import { ClientFormDialog } from '@/components/forms/client-form-dialog'
import { NoteFormDialog } from '@/components/forms/note-form-dialog'
import { FeesFormDialog } from '@/components/forms/fees-form-dialog'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import {
  clientsService,
  type Client,
  type ClientDetail,
} from '@/services/clients-service'
import { notesService, type Note } from '../../../services/notes-service'
import { feesService, type Fee } from '@/services/fees-service'

type Tab = 'resumo' | 'processos' | 'honorarios' | 'notas'

export default function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('resumo')
  const [showProcessDialog, setShowProcessDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [showFeeDialog, setShowFeeDialog] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [editingFee, setEditingFee] = useState<Fee | null>(null)
  const [fees, setFees] = useState<Fee[]>([])
  const [isLoadingFees, setIsLoadingFees] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const actionsMenuRef = useRef<HTMLDivElement>(null)

  const [client, setClient] = useState<ClientDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchClient = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const data = await clientsService.getDetail(id)
      setClient(data)
    } catch (error) {
      console.error('Error fetching client:', error)
      toast.error('Erro ao carregar cliente')
      navigate('/app/clientes')
    } finally {
      setIsLoading(false)
    }
  }, [id, navigate])

  const fetchFees = useCallback(async () => {
    if (!id) return
    setIsLoadingFees(true)
    try {
      const response = await feesService.list(id)
      setFees(response.fees)
    } catch (error) {
      console.error('Error fetching fees:', error)
      toast.error('Erro ao carregar honorários')
    } finally {
      setIsLoadingFees(false)
    }
  }, [id])

  useEffect(() => {
    void fetchClient()
  }, [fetchClient])

  useEffect(() => {
    if (activeTab === 'honorarios') {
      void fetchFees()
    }
  }, [activeTab, fetchFees])

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

  const clientForDialog: Client | undefined = client
    ? {
        id: client.id,
        user_id: client.user_id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        cpf_cnpj: client.cpf_cnpj,
        address: client.address,
        city: client.city,
        state: client.state,
        zip_code: client.zip_code,
        notes: client.notes,
        status: client.status,
        created_at: client.created_at,
        updated_at: client.updated_at,
      }
    : undefined

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

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
      return format(new Date(dateStr), 'dd/MM/yyyy')
    } catch {
      return dateStr
    }
  }

  const handleSaveFee = async (feeData: Partial<Fee> & { id?: string }) => {
    if (!id) return

    try {
      if (feeData.id) {
        // Update existing fee
        await feesService.update(feeData.id, feeData)
        toast.success('Honorário atualizado com sucesso')
      } else {
        // Create new fee
        await feesService.create({
          client_id: id,
          fee_type: feeData.fee_type!,
          description: feeData.description!,
          amount: feeData.amount!,
          due_date: feeData.due_date || null,
          process_id: feeData.process_id || null,
          notes: feeData.notes || null,
        })
        toast.success('Honorário criado com sucesso')
      }
      await Promise.all([fetchClient(), fetchFees()])
      setShowFeeDialog(false)
      setEditingFee(null)
    } catch (error) {
      console.error('Error saving fee:', error)
      toast.error('Erro ao salvar honorário')
    }
  }

  const handleDeleteFee = async (feeId: string) => {
    if (!confirm('Tem certeza que deseja excluir este honorário?')) return

    try {
      await feesService.delete(feeId)
      toast.success('Honorário excluído com sucesso')
      await Promise.all([fetchClient(), fetchFees()])
    } catch (error) {
      console.error('Error deleting fee:', error)
      toast.error('Erro ao excluir honorário')
    }
  }

  const handleArchiveClient = async () => {
    if (!id) return
    try {
      await clientsService.update(id, { status: 'archived' })
      toast.success('Cliente arquivado com sucesso')
      await fetchClient()
      setShowActionsMenu(false)
    } catch (error) {
      console.error('Error archiving client:', error)
      toast.error('Erro ao arquivar cliente')
    }
  }

  const handleDeleteClient = async () => {
    if (!id || !deleteConfirmation) return
    setIsDeleting(true)
    try {
      await clientsService.delete(id)
      toast.success('Cliente excluído com sucesso')
      navigate('/app/clientes')
    } catch (error) {
      console.error('Error deleting client:', error)
      toast.error('Erro ao excluir cliente')
      setShowDeleteModal(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const getFeeTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      initial: 'Honorários Iniciais',
      success: 'Honorários de Êxito',
      monthly: 'Mensalidade',
      hourly: 'Por Hora',
      hearing: 'Por Audiência',
      petition: 'Por Petição',
      other: 'Outros',
    }
    return types[type] || type
  }

  const getFeeStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-600 dark:text-green-400'
      case 'pending':
        return 'text-orange-600 dark:text-orange-400'
      case 'overdue':
        return 'text-red-600 dark:text-red-400'
      case 'partial':
        return 'text-blue-600 dark:text-blue-400'
      case 'cancelled':
        return 'text-gray-600 dark:text-gray-400'
      default:
        return 'text-muted-foreground'
    }
  }

  const getFeeStatusLabel = (status: string) => {
    const statuses: Record<string, string> = {
      pending: 'Pendente',
      paid: 'Pago',
      overdue: 'Vencido',
      partial: 'Parcial',
      cancelled: 'Cancelado',
    }
    return statuses[status] || status
  }

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
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

  const formatCPFOrCNPJ = (doc: string) => {
    const cleaned = doc.replace(/\D/g, '')
    if (cleaned.length === 11) return formatCPF(cleaned)
    if (cleaned.length === 14) return formatCNPJ(cleaned)
    return doc
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-600 dark:text-green-400'
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
      case 'archived':
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
      case 'concluded':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Ativo'
      case 'pending':
        return 'Pendente'
      case 'archived':
        return 'Arquivado'
      case 'concluded':
        return 'Concluído'
      case 'suspended':
        return 'Suspenso'
      case 'cancelled':
        return 'Cancelado'
      default:
        return status
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof FolderKanban }[] = [
    { id: 'resumo', label: 'Resumo', icon: FileText },
    { id: 'processos', label: 'Processos', icon: FolderKanban },
    { id: 'honorarios', label: 'Honorários', icon: DollarSign },
    { id: 'notas', label: 'Notas', icon: StickyNote },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Link to="/app/clientes" className="text-primary hover:underline mt-2 inline-block">
          Voltar aos Clientes
        </Link>
      </div>
    )
  }

  const fullAddress = [client.address, client.city, client.state].filter(Boolean).join(', ')

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <Link
        to="/app/clientes"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar aos Clientes
      </Link>

      {/* Client Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 rounded-lg border border-border bg-card">
        <div className="flex items-start gap-3">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-slate-900 text-white text-base">
              {getInitials(client.name)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{client.name}</h1>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase',
                  client.status === 'active'
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                )}
              >
                {client.status === 'active' ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              {/* Linha 1: CPF, Telefone, Email */}
              <div className="flex flex-wrap items-center gap-3">
                {client.cpf_cnpj && <span>CPF/CNPJ: {formatCPFOrCNPJ(client.cpf_cnpj)}</span>}
                {client.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {formatPhone(client.phone)}
                  </span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {client.email}
                  </span>
                )}
              </div>
              {/* Linha 2: Endereço */}
              {fullAddress && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {fullAddress}
                </div>
              )}
              {/* Linha 3: Cliente desde */}
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Cliente desde: {formatDate(client.created_at)}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Dropdown Adicionar */}
          <div className="relative group">
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="py-1">
                <button
                  onClick={() => setShowProcessDialog(true)}
                  className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <FolderKanban className="h-4 w-4" />
                  Novo Processo
                </button>
                <button
                  onClick={() => {
                    setEditingFee(null)
                    setShowFeeDialog(true)
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <DollarSign className="h-4 w-4" />
                  Novo Honorário
                </button>
                <button
                  onClick={() => {
                    setEditingNote(null)
                    setShowNoteDialog(true)
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <StickyNote className="h-4 w-4" />
                  Nova Nota
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowEditDialog(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-muted text-foreground hover:bg-muted/80 transition-colors"
          >
            <Edit className="h-4 w-4" />
            Editar
          </button>
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
                    onClick={handleArchiveClient}
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
                    Excluir Cliente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-primary text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pb-6">
        {activeTab === 'resumo' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2.5 mb-2">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Processos</h3>
              </div>
              <p className="text-2xl font-bold text-foreground">{client.processes_count}</p>
              <p className="text-sm text-muted-foreground">Cadastrados</p>
            </div>
            <div className="p-6 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2.5 mb-2">
                <Calculator className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Honorários</h3>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(client.fees_summary.total_amount)}
              </p>
              <p className="text-sm text-muted-foreground">Total contratado</p>
            </div>
            <div className="p-6 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2.5 mb-2">
                <StickyNote className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Notas</h3>
              </div>
              <p className="text-2xl font-bold text-foreground">{client.notes_count}</p>
              <p className="text-sm text-muted-foreground">Anotações</p>
            </div>

            {/* Recent Processes */}
            {client.processes.length > 0 && (
              <div className="md:col-span-3">
                <h3 className="font-semibold mb-2">Processos Recentes</h3>
                <div className="space-y-2">
                  {client.processes.slice(0, 3).map((process) => (
                    <Link
                      key={process.id}
                      to={`/app/processos/${process.id}`}
                      className="block p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-foreground">{process.number}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{process.type}</p>
                        </div>
                        <div className="text-right">
                          <span className={cn('px-2 py-1 rounded text-xs', getStatusColor(process.status))}>
                            {getStatusLabel(process.status)}
                          </span>
                          {process.next_deadline && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Próximo prazo: {process.next_deadline}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'processos' && (
          <div className="space-y-2">
            {client.processes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum processo cadastrado</p>
                <button
                  onClick={() => setShowProcessDialog(true)}
                  className="mt-4 text-primary hover:underline"
                >
                  Cadastrar primeiro processo
                </button>
              </div>
            ) : (
              client.processes.map((process) => (
                <Link
                  key={process.id}
                  to={`/app/processos/${process.id}`}
                  className="block p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{process.number}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{process.type}</p>
                      {process.court && (
                        <p className="text-sm text-muted-foreground">{process.court}</p>
                      )}
                      {process.value && (
                        <p className="text-sm text-muted-foreground">
                          Valor: {formatCurrency(process.value)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={cn('px-2 py-1 rounded text-xs', getStatusColor(process.status))}>
                        {getStatusLabel(process.status)}
                      </span>
                      {process.next_deadline && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Próximo prazo: {process.next_deadline}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {activeTab === 'honorarios' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="text-sm text-muted-foreground mb-2">Total</h3>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(client.fees_summary.total_amount)}
                </p>
              </div>
              <div className="p-6 rounded-lg border border-green-500/20 bg-green-500/10">
                <h3 className="text-sm text-green-600 dark:text-green-400 mb-2">Pago</h3>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(client.fees_summary.total_paid)}
                </p>
              </div>
              <div className="p-6 rounded-lg border border-orange-500/20 bg-orange-500/10">
                <h3 className="text-sm text-orange-600 dark:text-orange-400 mb-2">Pendente</h3>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(client.fees_summary.total_pending)}
                </p>
              </div>
              <div className="p-6 rounded-lg border border-red-500/20 bg-red-500/10">
                <h3 className="text-sm text-red-600 dark:text-red-400 mb-2">Vencido</h3>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(client.fees_summary.total_overdue)}
                </p>
              </div>
            </div>

            {/* Summary count */}
            <p className="text-sm text-muted-foreground">
              Total de {client.fees_summary.fees_count} honorário(s) cadastrado(s)
            </p>

            {/* Fees List */}
            {isLoadingFees ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : fees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum honorário cadastrado</p>
                <p className="text-sm mt-2">Clique no botão acima para adicionar o primeiro</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fees.map((fee) => (
                  <div
                    key={fee.id}
                    className="p-4 rounded-lg border border-border bg-card"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground">{fee.description}</h3>
                          <span className={cn('text-xs font-medium', getFeeStatusColor(fee.status))}>
                            {getFeeStatusLabel(fee.status)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {getFeeTypeLabel(fee.fee_type)}
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-semibold text-foreground">
                            {formatCurrency(fee.amount)}
                          </span>
                          {fee.paid_amount > 0 && (
                            <span className="text-green-600 dark:text-green-400">
                              Pago: {formatCurrency(fee.paid_amount)}
                            </span>
                          )}
                          {fee.due_date && (
                            <span className="text-muted-foreground">
                              Venc.: {formatShortDate(fee.due_date)}
                            </span>
                          )}
                        </div>
                        {fee.notes && (
                          <p className="text-sm text-muted-foreground mt-2">{fee.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => {
                            setEditingFee(fee)
                            setShowFeeDialog(true)
                          }}
                          className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                          title="Editar honorário"
                        >
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDeleteFee(fee.id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                          title="Excluir honorário"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'notas' && (
          <div className="space-y-3">
            {client.recent_notes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <StickyNote className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma nota cadastrada</p>
              </div>
            ) : (
              client.recent_notes.map((note) => (
                <div
                  key={note.id}
                  className={cn(
                    'p-4 rounded-lg border bg-card',
                    note.is_pinned ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{note.title}</h3>
                        {note.is_pinned && <Pin className="h-3 w-3 text-yellow-500" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {note.note_type} · {formatDate(note.updated_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={async () => {
                          try {
                            const fullNote = await notesService.get(note.id)
                            setEditingNote(fullNote)
                            setShowNoteDialog(true)
                          } catch {
                            toast.error('Erro ao carregar nota')
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                        title="Editar nota"
                      >
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('Tem certeza que deseja excluir esta nota?')) {
                            try {
                              await notesService.delete(note.id)
                              toast.success('Nota excluída com sucesso')
                              await fetchClient()
                            } catch {
                              toast.error('Erro ao excluir nota')
                            }
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                        title="Excluir nota"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
            <button
              onClick={() => {
                setEditingNote(null)
                setShowNoteDialog(true)
              }}
              className="w-full p-4 rounded-lg border border-dashed border-border hover:bg-accent transition-colors text-sm text-muted-foreground"
            >
              + Adicionar nova nota
            </button>
          </div>
        )}
      </div>

      {/* Dialog para criar processo */}
      {clientForDialog && (
        <ProcessFormDialog
          isOpen={showProcessDialog}
          onClose={() => setShowProcessDialog(false)}
          preselectedClient={clientForDialog}
          onSave={() => {
            setShowProcessDialog(false)
            void fetchClient()
          }}
        />
      )}

      {/* Dialog para editar cliente */}
      {clientForDialog && (
        <ClientFormDialog
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          client={clientForDialog}
          onSave={async () => {
            setShowEditDialog(false)
            await fetchClient()
          }}
        />
      )}

      {/* Dialog para adicionar/editar nota */}
      {client && (
        <NoteFormDialog
          isOpen={showNoteDialog}
          onClose={() => {
            setShowNoteDialog(false)
            setEditingNote(null)
          }}
          clientId={client.id}
          note={editingNote || undefined}
          onSave={async (noteData) => {
            try {
              if (editingNote) {
                await notesService.update(editingNote.id, {
                  title: noteData.title,
                  content: noteData.content,
                  note_type: noteData.note_type,
                  is_pinned: noteData.is_pinned,
                })
                toast.success('Nota atualizada com sucesso!')
              } else {
                await notesService.create({
                  client_id: client.id,
                  title: noteData.title,
                  content: noteData.content,
                  note_type: noteData.note_type,
                  is_pinned: noteData.is_pinned,
                })
                toast.success('Nota criada com sucesso!')
              }
              setShowNoteDialog(false)
              setEditingNote(null)
              await fetchClient()
            } catch (error) {
              console.error('Error saving note:', error)
              toast.error(editingNote ? 'Erro ao atualizar nota' : 'Erro ao criar nota')
            }
          }}
        />
      )}

      {/* Dialog para adicionar/editar honorário */}
      {client && (
        <FeesFormDialog
          isOpen={showFeeDialog}
          onClose={() => {
            setShowFeeDialog(false)
            setEditingFee(null)
          }}
          clientId={client.id}
          fee={editingFee || undefined}
          processes={client.processes.map((p) => ({
            id: p.id,
            number: p.number,
            title: `${p.type} - ${p.court || 'Sem comarca'}`,
          }))}
          onSave={handleSaveFee}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir {client?.name}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Esta ação não pode ser desfeita. Ao excluir este cliente, <strong className="text-foreground">todos os dados relacionados serão permanentemente removidos</strong>:
            </p>
            <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Processos:</span>
                <span className="font-semibold text-foreground">{client?.processes_count || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Honorários:</span>
                <span className="font-semibold text-foreground">{fees.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Notas:</span>
                <span className="font-semibold text-foreground">{client?.notes_count || 0}</span>
              </div>
            </div>
            <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-3 text-xs text-orange-700 dark:text-orange-300">
              <strong>Também serão excluídos em cascata:</strong>
              <ul className="list-disc list-inside mt-1.5 space-y-0.5 ml-1">
                <li>Todos os prazos e deadlines dos processos</li>
                <li>Histórico completo da timeline dos processos</li>
                <li>Eventos de calendário vinculados</li>
                <li>Documentos anexados</li>
              </ul>
            </div>
            {client && client.processes_count > 0 && (
              <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-yellow-700 dark:text-yellow-300">
                  <strong>Atenção:</strong> Este cliente possui processos ativos. Considere arquivar em vez de excluir.
                </div>
              </div>
            )}
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
                Entendo as consequências e desejo excluir permanentemente este cliente
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
              onClick={handleDeleteClient}
              disabled={!deleteConfirmation || isDeleting}
              className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir Cliente'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
