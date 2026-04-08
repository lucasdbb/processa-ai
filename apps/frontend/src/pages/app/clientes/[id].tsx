import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Mail,
  Phone,
  FileText,
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
  Briefcase,
  ChevronDown,
  ChevronRight,
  Check,
  Send,
  Shield,
  ShieldOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { analytics } from '@/lib/analytics'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ProcessFormDialog } from '@/components/forms/process-form-dialog'
import { ClientFormDialog } from '@/components/forms/client-form-dialog'
import { NoteFormDialog } from '@/components/forms/note-form-dialog'
import { FeesFormDialog } from '@/components/forms/fees-form-dialog'
import { ServiceFormDialog } from '@/components/forms/service-form-dialog'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import {
  clientsService,
  type Client,
  type ClientDetail,
} from '@/services/clients-service'
import { notesService, type Note } from '../../../services/notes-service'
import { type Fee } from '@/services/fees-service'
import { type Service } from '@/services/services-service'
import { inviteClient, revokeClientPortalAccess } from '@/services/portal-service'
import { useClientDetail } from '@/hooks/use-clients'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { feesService } from '@/services/fees-service'
import { servicesService } from '@/services/services-service'

type Tab = 'resumo' | 'atividades' | 'financeiro' | 'notas'

export default function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [activeTab, setActiveTab] = useState<Tab>('resumo')
  const [showProcessDialog, setShowProcessDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [showFeeDialog, setShowFeeDialog] = useState(false)
  const [showServiceDialog, setShowServiceDialog] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [editingFee, setEditingFee] = useState<Fee | null>(null)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [portalStatus, setPortalStatus] = useState<string | null>(null)
  const [portalInvitedAt, setPortalInvitedAt] = useState<string | null>(null)
  const [showPortalManageActions, setShowPortalManageActions] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [financeStatusFilter, setFinanceStatusFilter] = useState<'all' | Fee['status']>('all')
  const actionsMenuRef = useRef<HTMLDivElement>(null)
  const fabMenuRef = useRef<HTMLDivElement>(null)

  const { data: client, isLoading, isError } = useClientDetail(id || '')

  useEffect(() => {
    if (client) {
      setPortalStatus(client.portal_status ?? null)
      setPortalInvitedAt(client.portal_invited_at ?? null)
      setShowPortalManageActions(false)
    }
  }, [client])

  useEffect(() => {
    if (isError) {
      toast.error('Erro ao carregar cliente')
      navigate('/app/clientes')
    }
  }, [isError, navigate])

  const { data: fees = [], isLoading: isLoadingFees } = useQuery({
    queryKey: ['fees', 'client', id],
    queryFn: async () => {
      const pageSize = 100
      let offset = 0
      let allFees: Fee[] = []
      let total = 0

      do {
        const response = await feesService.list(id!, undefined, undefined, pageSize, offset)
        total = response.total
        allFees = [...allFees, ...response.fees]
        offset += response.fees.length

        if (response.fees.length === 0) {
          break
        }
      } while (allFees.length < total)

      return allFees
    },
    enabled: !!id && activeTab === 'financeiro',
  })

  const { data: servicesResponse, isLoading: isLoadingServices } = useQuery({
    queryKey: ['services', 'client', id],
    queryFn: () => servicesService.list({ clientId: id! }),
    enabled: !!id && (activeTab === 'financeiro' || activeTab === 'atividades' || activeTab === 'resumo'),
  })
  const services = servicesResponse?.services ?? []

  // Close actions menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false)
      }
      if (fabMenuRef.current && !fabMenuRef.current.contains(e.target as Node)) {
        setShowFabMenu(false)
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

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  type FeeGroupRef = ClientDetail['processes'][number] | Service | undefined

  const groupFeesBySource = (sourceFees: Fee[]) => {
    const groups = new Map<string, { type: 'process' | 'service' | 'unlinked'; ref: FeeGroupRef; fees: Fee[] }>()

    sourceFees.forEach((fee) => {
      if (fee.process_id) {
        const key = `process-${fee.process_id}`
        if (!groups.has(key)) {
          const process = client?.processes.find((p) => p.id === fee.process_id)
          groups.set(key, { type: 'process', ref: process, fees: [] })
        }
        groups.get(key)!.fees.push(fee)
      } else if (fee.service_id) {
        const key = `service-${fee.service_id}`
        if (!groups.has(key)) {
          const service = services.find((s) => s.id === fee.service_id)
          groups.set(key, { type: 'service', ref: service, fees: [] })
        }
        groups.get(key)!.fees.push(fee)
      } else {
        const key = 'unlinked'
        if (!groups.has(key)) {
          groups.set(key, { type: 'unlinked', ref: undefined, fees: [] })
        }
        groups.get(key)!.fees.push(fee)
      }
    })

    const getRefLabel = (type: 'process' | 'service' | 'unlinked', ref: FeeGroupRef) => {
      if (type === 'process') return (ref as ClientDetail['processes'][number] | undefined)?.number || 'Processo desconhecido'
      if (type === 'service') return (ref as Service | undefined)?.name || 'Serviço desconhecido'
      return 'Sem vínculo'
    }

    const typeOrder: Record<'process' | 'service' | 'unlinked', number> = {
      process: 0,
      service: 1,
      unlinked: 2,
    }

    return Array.from(groups.entries())
      .map(([key, value]) => ({
        key,
        ...value,
        fees: [...value.fees].sort((a, b) => {
          const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER
          const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER
          if (aDue !== bDue) return aDue - bDue
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }),
      }))
      .sort((a, b) => {
        if (typeOrder[a.type] !== typeOrder[b.type]) {
          return typeOrder[a.type] - typeOrder[b.type]
        }
        return getRefLabel(a.type, a.ref).localeCompare(getRefLabel(b.type, b.ref), 'pt-BR')
      })
  }

  const getProcessFeeStats = (processId: string) => {
    const processFees = fees.filter((f) => f.process_id === processId)
    const total = processFees.length
    const paid = processFees.filter((f) => Number(f.paid_amount ?? 0) >= Number(f.amount)).length
    const totalAmount = processFees.reduce((sum, f) => sum + Number(f.amount), 0)
    const paidAmount = processFees.reduce((sum, f) => sum + Number(f.paid_amount ?? 0), 0)
    return { total, paid, totalAmount, paidAmount }
  }

  const getServiceFeeStats = (serviceId: string) => {
    const serviceFees = fees.filter((f) => f.service_id === serviceId)
    const total = serviceFees.length
    const paid = serviceFees.filter((f) => Number(f.paid_amount ?? 0) >= Number(f.amount)).length
    const totalAmount = serviceFees.reduce((sum, f) => sum + Number(f.amount), 0)
    const paidAmount = serviceFees.reduce((sum, f) => sum + Number(f.paid_amount ?? 0), 0)
    return { total, paid, totalAmount, paidAmount }
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
          service_id: feeData.service_id || null,
          notes: feeData.notes || null,
        })
        toast.success('Honorário criado com sucesso')
      }
      await queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] })
      await queryClient.invalidateQueries({ queryKey: ['fees', 'client', id] })
      setShowFeeDialog(false)
      setEditingFee(null)
    } catch (error) {
      toast.error('Erro ao salvar honorário')
    }
  }

  const handleSaveBatchFees = async (feesList: Array<Partial<Fee>>) => {
    if (!id) return

    try {
      // Create all fees sequentially
      for (const feeData of feesList) {
        await feesService.create({
          client_id: id,
          fee_type: feeData.fee_type!,
          description: feeData.description!,
          amount: feeData.amount!,
          due_date: feeData.due_date || null,
          process_id: feeData.process_id || null,
          service_id: feeData.service_id || null,
          notes: feeData.notes || null,
        })
      }
      toast.success(`${feesList.length} parcelas criadas com sucesso`)
      await queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] })
      await queryClient.invalidateQueries({ queryKey: ['fees', 'client', id] })
      setShowFeeDialog(false)
      setEditingFee(null)
    } catch (error) {
      toast.error('Erro ao criar parcelas')
    }
  }

  const handleDeleteFee = async (feeId: string) => {
    if (!confirm('Tem certeza que deseja excluir este honorário?')) return

    try {
      await feesService.delete(feeId)
      analytics.track('office_action', { entity: 'fee', action: 'deleted' })
      toast.success('Honorário excluído com sucesso')
      await queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] })
      await queryClient.invalidateQueries({ queryKey: ['fees', 'client', id] })
    } catch (error) {
      toast.error('Erro ao excluir honorário')
    }
  }

  const handleMarkAsPaid = async (fee: Fee) => {
    try {
      await feesService.markAsPaid(fee.id)
      toast.success('Honorário marcado como pago')
      await queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] })
      await queryClient.invalidateQueries({ queryKey: ['fees', 'client', id] })
    } catch (error) {
      toast.error('Erro ao marcar como pago')
    }
  }

  const handleSaveService = async (serviceData: Partial<Service> & { id?: string }) => {
    if (!id) return

    try {
      if (serviceData.id) {
        // Update existing service
        await servicesService.update(serviceData.id, serviceData)
        toast.success('Serviço atualizado com sucesso')
      } else {
        // Create new service
        await servicesService.create({
          client_id: id,
          name: serviceData.name!,
          category: serviceData.category!,
          value: serviceData.value || null,
          notes: serviceData.notes || null,
        })
        toast.success('Serviço criado com sucesso')
      }
      await queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] })
      await queryClient.invalidateQueries({ queryKey: ['services', 'client', id] })
      setShowServiceDialog(false)
      setEditingService(null)
    } catch (error) {
      toast.error('Erro ao salvar serviço')
    }
  }

  const handleArchiveClient = async () => {
    if (!id) return
    try {
      await clientsService.update(id, { status: 'archived' })
      toast.success('Cliente arquivado com sucesso')
      await queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] })
      setShowActionsMenu(false)
    } catch (error) {
      toast.error('Erro ao arquivar cliente')
    }
  }

  const handleDeleteClient = async () => {
    if (!id || !deleteConfirmation) return
    setIsDeleting(true)
    try {
      await clientsService.delete(id)
      analytics.track('office_action', { entity: 'client', action: 'deleted' })
      toast.success('Cliente excluído com sucesso')
      await queryClient.invalidateQueries({ queryKey: ['clients', 'list'] })
      navigate('/app/clientes')
    } catch (error) {
      toast.error('Erro ao excluir cliente')
      setShowDeleteModal(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleInvitePortal = async () => {
    if (!id) return

    if (!client?.email) {
      toast.error('O cliente precisa ter um e-mail cadastrado para acessar o portal')
      return
    }

    setIsInviting(true)
    try {
      const result = await inviteClient(id)
      setPortalStatus(result.portal_status)
      setPortalInvitedAt(result.portal_invited_at)
      toast.success(result.message)
      setShowActionsMenu(false)
      await queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] })
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message ?? 'Erro ao enviar convite'
      toast.error(msg)
    } finally {
      setIsInviting(false)
    }
  }

  const handleRevokePortal = async () => {
    if (!id) return
    if (!confirm('Tem certeza que deseja revogar o acesso ao portal deste cliente?')) return
    try {
      const result = await revokeClientPortalAccess(id)
      setPortalStatus(result.portal_status)
      setPortalInvitedAt(null)
      toast.success('Acesso ao portal revogado')
      setShowActionsMenu(false)
      await queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] })
    } catch {
      toast.error('Erro ao revogar acesso')
    }
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

  const getServiceCategoryLabel = (category: string) => {
    const categories: Record<string, string> = {
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
    return categories[category] || category
  }

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-blue-600 dark:text-blue-400'
      case 'completed':
        return 'text-green-600 dark:text-green-400'
      case 'cancelled':
        return 'text-gray-600 dark:text-gray-400'
      default:
        return 'text-muted-foreground'
    }
  }

  const getServiceStatusLabel = (status: string) => {
    const statuses: Record<string, string> = {
      active: 'Ativo',
      completed: 'Concluído',
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

  const getPortalStatusLabel = (status: string | null) => {
    switch (status) {
      case 'active':
        return 'Acesso ativo'
      case 'invited':
        return 'Convite enviado'
      case 'revoked':
        return 'Acesso revogado'
      default:
        return 'Sem acesso'
    }
  }

  const getPortalStatusClass = (status: string | null) => {
    if (status === 'active') return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    if (status === 'invited') return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
    if (status === 'revoked') return 'bg-red-500/10 text-red-600 dark:text-red-400'
    return 'bg-muted text-muted-foreground'
  }

  const getPortalStatusDescription = (status: string | null, hasEmail: boolean) => {
    if (!hasEmail) {
      return 'Cadastre um e-mail para enviar convite e liberar acesso ao portal.'
    }
    if (status === 'active') {
      return 'Cliente com acesso ativo ao portal. Pode acompanhar processos, prazos e documentos.'
    }
    if (status === 'invited') {
      return 'Convite enviado e aguardando ativação do cliente.'
    }
    if (status === 'revoked') {
      return 'Acesso revogado. Envie um novo convite para reativar o portal.'
    }
    return 'Convide o cliente para acompanhar o caso no Portal do Cliente.'
  }

  const portalNeedsAttention = (status: string | null, hasEmail: boolean) => {
    if (!hasEmail) return true
    return !status || status === 'not_invited' || status === 'revoked'
  }

  const getPortalCompactSummary = (status: string | null) => {
    if (status === 'active') return 'Acesso ao portal ativo.'
    if (status === 'invited') return 'Convite enviado e aguardando ativacao.'
    return 'Portal sem acesso ativo.'
  }

  const tabs: { id: Tab; label: string; icon: typeof FolderKanban }[] = [
    { id: 'resumo', label: 'Resumo', icon: FileText },
    { id: 'atividades', label: 'Atividades', icon: FolderKanban },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'notas', label: 'Notas', icon: StickyNote },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
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
  const portalPreviewUrl = id ? `/portal?previewClientId=${encodeURIComponent(id)}` : '/portal'

  const filteredFees = financeStatusFilter === 'all'
    ? fees
    : fees.filter((fee) => fee.status === financeStatusFilter)

  const feeGroups = groupFeesBySource(filteredFees)

  return (
    <div className="space-y-4">
      {/* Client Header */}
      <div className="p-4 rounded-lg border border-border bg-card">
        {/* Top row: avatar + nome/status + botão 3 pontos (sempre na mesma linha) */}
        <div className="flex items-start gap-3 mb-3">
          {/* Avatar — visível em todos os tamanhos, ao lado do título */}
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarFallback className="bg-slate-900 text-white text-base">
              {getInitials(client.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground truncate">{client.name}</h1>
              <span
                className={cn(
                  'shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase',
                  client.status === 'active'
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                )}
              >
                {client.status === 'active' ? 'Ativo' : 'Inativo'}
              </span>
              <span
                className={cn(
                  'shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase flex items-center gap-1',
                  getPortalStatusClass(portalStatus)
                )}
              >
                <Shield className="h-3 w-3" />
                {getPortalStatusLabel(portalStatus)}
              </span>
            </div>
          </div>

          {/* Botão Adicionar — apenas desktop */}
          <div className="relative shrink-0 hidden sm:block" ref={fabMenuRef}>
            <button
              onClick={() => setShowFabMenu((v) => !v)}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
            {showFabMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg z-50">
                <div className="py-1">
                  <button
                    onClick={() => { setShowFabMenu(false); setShowProcessDialog(true) }}
                    className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <FolderKanban className="h-4 w-4" />
                    Novo Processo
                  </button>
                  <button
                    onClick={() => { setShowFabMenu(false); setEditingService(null); setShowServiceDialog(true) }}
                    className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <Briefcase className="h-4 w-4" />
                    Novo Serviço
                  </button>
                  <button
                    onClick={() => { setShowFabMenu(false); setEditingFee(null); setShowFeeDialog(true) }}
                    className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <DollarSign className="h-4 w-4" />
                    Novo Honorário
                  </button>
                  <button
                    onClick={() => { setShowFabMenu(false); setEditingNote(null); setShowNoteDialog(true) }}
                    className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <StickyNote className="h-4 w-4" />
                    Nova Nota
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions menu — sempre à direita, no topo */}
          <div className="relative shrink-0" ref={actionsMenuRef}>
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Mais ações"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {showActionsMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-popover shadow-lg z-50">
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowEditDialog(true)
                      setShowActionsMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Editar Cliente
                  </button>
                  <button
                    onClick={handleArchiveClient}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <Archive className="h-4 w-4" />
                    Arquivar Cliente
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteModal(true)
                      setShowActionsMenu(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir Cliente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informações de contato e endereço — cada item em sua própria linha */}
        <div className="space-y-1.5 text-sm text-muted-foreground">
          {client.cpf_cnpj && (
            <div className="flex items-center gap-1.5">
              <span>CPF/CNPJ: {formatCPFOrCNPJ(client.cpf_cnpj)}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{formatPhone(client.phone)}</span>
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span>{client.email}</span>
            </div>
          )}
          {fullAddress && (
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{fullAddress}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>Cliente desde {formatDate(client.created_at)}</span>
          </div>
        </div>

        {portalNeedsAttention(portalStatus, Boolean(client.email)) ? (
          <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <div
                className={cn(
                  'h-7 w-7 rounded-md flex items-center justify-center shrink-0',
                  getPortalStatusClass(portalStatus)
                )}
              >
                <Shield className="h-3.5 w-3.5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h2 className="text-sm font-semibold text-foreground">Acesso ao Portal do Cliente</h2>
                <p className="text-xs text-muted-foreground">
                  {getPortalStatusDescription(portalStatus, Boolean(client.email))}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {client.email && (
                <Link
                  to={portalPreviewUrl}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Shield className="h-4 w-4" />
                  Ver como cliente
                </Link>
              )}

              {(!portalStatus || portalStatus === 'not_invited' || portalStatus === 'revoked') && (
                <button
                  onClick={handleInvitePortal}
                  disabled={isInviting || !client.email}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-4 w-4" />
                  {isInviting ? 'Enviando...' : 'Convidar para o Portal'}
                </button>
              )}

              {!client.email && (
                <button
                  onClick={() => setShowEditDialog(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  Adicionar e-mail do cliente
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 border-t border-border/80 pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-muted-foreground">
                {getPortalCompactSummary(portalStatus)}{' '}
                {portalInvitedAt ? `Ultimo envio: ${formatShortDate(portalInvitedAt)}.` : ''}
              </div>
              <button
                onClick={() => setShowPortalManageActions((prev) => !prev)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {showPortalManageActions ? 'Ocultar acoes' : 'Gerenciar acesso'}
              </button>
            </div>

            {showPortalManageActions && (
              <div className="flex flex-wrap gap-2 pt-1">
                {client.email && (
                  <Link
                    to={portalPreviewUrl}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Shield className="h-4 w-4" />
                    Ver como cliente
                  </Link>
                )}

                {portalStatus === 'invited' && (
                  <button
                    onClick={handleInvitePortal}
                    disabled={isInviting || !client.email}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    {isInviting ? 'Enviando...' : 'Reenviar convite'}
                  </button>
                )}

                {(portalStatus === 'invited' || portalStatus === 'active') && (
                  <button
                    onClick={handleRevokePortal}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-border text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <ShieldOff className="h-4 w-4" />
                    Revogar acesso
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

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
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pb-6">
        {activeTab === 'resumo' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FolderKanban className="h-5 w-5" />
                  Processos Recentes
                </h3>
              </div>
              <div className="space-y-2">
                {client.processes.slice(0, 3).map((process) => {
                  const stats = getProcessFeeStats(process.id)
                  return (
                    <Link
                      key={process.id}
                      to={`/app/processos/${process.id}`}
                      className="block p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-foreground">{process.number}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{process.type}</p>
                        </div>
                        <span className={cn('text-xs font-medium', getStatusColor(process.status))}>
                          {getStatusLabel(process.status)}
                        </span>
                      </div>
                      {stats.total > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              {stats.paid}/{stats.total} parcelas pagas
                            </span>
                            <span className="font-medium">{formatCurrency(stats.paidAmount)}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 transition-all"
                              style={{
                                width: `${stats.total > 0 ? (stats.paid / stats.total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </Link>
                  )
                })}
                {client.processes.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum processo cadastrado</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Serviços Recentes
                </h3>
              </div>
              {isLoadingServices ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="sm" />
                </div>
              ) : services.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum serviço cadastrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {services.slice(0, 3).map((service) => {
                    const stats = getServiceFeeStats(service.id)
                    return (
                      <Link
                        key={service.id}
                        to={`/app/servicos/${service.id}`}
                        className="block p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-foreground">{service.name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {getServiceCategoryLabel(service.category)}
                            </p>
                          </div>
                          <span className={cn('text-xs font-medium', getServiceStatusColor(service.status))}>
                            {getServiceStatusLabel(service.status)}
                          </span>
                        </div>
                        {stats.total > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>
                                {stats.paid}/{stats.total} parcelas pagas
                              </span>
                              <span className="font-medium">{formatCurrency(stats.paidAmount)}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 transition-all"
                                style={{
                                  width: `${stats.total > 0 ? (stats.paid / stats.total) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'atividades' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Seção Processos */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FolderKanban className="h-5 w-5" />
                  Processos
                </h3>
              </div>
              <div className="space-y-2">
                {client.processes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum processo cadastrado</p>
                  </div>
                ) : (
                  client.processes.map((process) => {
                    const stats = getProcessFeeStats(process.id)
                    return (
                      <Link
                        key={process.id}
                        to={`/app/processos/${process.id}`}
                        className="block p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground">{process.number}</h4>
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
                        {stats.total > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>
                                {stats.paid}/{stats.total} parcelas pagas
                              </span>
                              <span className="font-medium">{formatCurrency(stats.paidAmount)}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 transition-all"
                                style={{
                                  width: `${stats.total > 0 ? (stats.paid / stats.total) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </Link>
                    )
                  })
                )}
              </div>
            </div>

            {/* Seção Serviços Extrajudiciais */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Serviços Extrajudiciais
                </h3>
              </div>
              {isLoadingServices ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : services.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum serviço cadastrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {services.map((service) => {
                    const stats = getServiceFeeStats(service.id)
                    return (
                      <Link
                        key={service.id}
                        to={`/app/servicos/${service.id}`}
                        className="block p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground">{service.name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {getServiceCategoryLabel(service.category)}
                            </p>
                            {service.value && (
                              <p className="text-sm text-muted-foreground">
                                Valor: {formatCurrency(service.value)}
                              </p>
                            )}
                          </div>
                          <span className={cn('text-xs font-medium', getServiceStatusColor(service.status))}>
                            {getServiceStatusLabel(service.status)}
                          </span>
                        </div>
                        {stats.total > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>
                                {stats.paid}/{stats.total} parcelas pagas
                              </span>
                              <span className="font-medium">{formatCurrency(stats.paidAmount)}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 transition-all"
                                style={{
                                  width: `${stats.total > 0 ? (stats.paid / stats.total) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'financeiro' && (
          <div className="space-y-6">
            {/* Dashboard Financeiro */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="text-sm text-muted-foreground mb-2">Total</h3>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(client.fees_summary.total_amount)}
                </p>
              </div>
              <div className="p-6 rounded-lg border border-green-500/20 bg-green-500/10">
                <h3 className="text-sm text-green-600 dark:text-green-400 mb-2">Recebido</h3>
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Total de {client.fees_summary.fees_count} honorário(s) cadastrado(s)
              </p>

              <div className="flex items-center gap-2">
                <label htmlFor="fees-status-filter" className="text-sm text-muted-foreground">
                  Status:
                </label>
                <select
                  id="fees-status-filter"
                  value={financeStatusFilter}
                  onChange={(e) => setFinanceStatusFilter(e.target.value as 'all' | Fee['status'])}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendente</option>
                  <option value="overdue">Vencido</option>
                  <option value="paid">Pago</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </div>

            {/* Lista de Honorários Agrupados */}
            {isLoadingFees ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : fees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum honorário cadastrado</p>
                <p className="text-sm mt-2">Use o botão Adicionar acima para criar honorários</p>
              </div>
            ) : filteredFees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum honorário encontrado para o filtro selecionado</p>
              </div>
            ) : (
              <div className="space-y-4">
                {feeGroups.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.key)
                  const total = group.fees.reduce((sum, fee) => sum + Number(fee.amount), 0)
                  const paid = group.fees.reduce((sum, fee) => sum + Number(fee.paid_amount ?? 0), 0)
                  const settledCount = group.fees.filter((f) => Number(f.paid_amount ?? 0) > 0).length
                  const totalCount = group.fees.length
                  const progressByValue = total > 0 ? Math.min((paid / total) * 100, 100) : 0

                  const badgeConfig =
                    group.type === 'process'
                      ? { label: 'Processo', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' }
                      : group.type === 'service'
                        ? { label: 'Serviço', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' }
                        : { label: 'Sem vínculo', className: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20' }

                  const groupName =
                    group.type === 'process'
                      ? (group.ref as ClientDetail['processes'][number] | undefined)?.number || 'Processo desconhecido'
                      : group.type === 'service'
                        ? (group.ref as Service | undefined)?.name || 'Serviço desconhecido'
                        : 'Honorários sem processo/serviço'

                  return (
                    <div key={group.key} className="rounded-lg border border-border bg-card overflow-hidden">
                      {/* Group Header */}
                      <button
                        onClick={() => toggleGroup(group.key)}
                        className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {isCollapsed ? (
                            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}

                          <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold uppercase border min-w-[70px] text-center inline-block', badgeConfig.className)}>
                            {badgeConfig.label}
                          </span>

                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-foreground">{groupName}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {settledCount}/{totalCount} com recebimento
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Total</p>
                            <p className="font-semibold text-foreground">{formatCurrency(total)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Pago</p>
                            <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(paid)}</p>
                          </div>
                        </div>
                      </button>

                      {/* Progress Bar */}
                      {!isCollapsed && (
                        <div className="px-4 pb-3">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 transition-all"
                              style={{ width: `${progressByValue}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Fees List */}
                      {!isCollapsed && (
                        <div className="border-t border-border bg-muted/20">
                          {group.fees.map((fee) => {
                            const feeAmount = Number(fee.amount)
                            const feePaid = Number(fee.paid_amount ?? 0)
                            const feeRemaining = Math.max(feeAmount - feePaid, 0)

                            return (
                            <div
                              key={fee.id}
                              className="p-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h5 className="text-sm font-medium text-foreground">{fee.description}</h5>
                                    <span className={cn('text-xs font-medium', getFeeStatusColor(fee.status))}>
                                      {getFeeStatusLabel(fee.status)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="font-semibold text-foreground">{formatCurrency(feeAmount)}</span>
                                    {fee.due_date && <span>Venc.: {formatShortDate(fee.due_date)}</span>}
                                    {feePaid > 0 && fee.status !== 'paid' && (
                                      <span>Pago: {formatCurrency(feePaid)} • Saldo: {formatCurrency(feeRemaining)}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 ml-3">
                                  {fee.status !== 'paid' && fee.status !== 'cancelled' && (
                                    <button
                                      onClick={() => handleMarkAsPaid(fee)}
                                      className="p-1.5 rounded-lg hover:bg-green-500/10 transition-colors"
                                      title="Marcar como pago"
                                    >
                                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    </button>
                                  )}
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
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
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
                          } catch (error) {
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
                          if (!confirm('Tem certeza que deseja excluir esta nota?')) return
                          try {
                            await notesService.delete(note.id)
                            toast.success('Nota excluída com sucesso')
                            await queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] })
                          } catch (error) {
                            toast.error('Erro ao excluir nota')
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
          </div>
        )}
      </div>

      {/* Floating Action Button (Adicionar) — apenas mobile */}
      <div className="fixed bottom-22 right-4 z-50 sm:hidden">
        <button
          onClick={() => setShowFabMenu((v) => !v)}
          className="flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
        >
          <Plus className="h-6 w-6" />
        </button>
        {showFabMenu && (
          <div className="absolute bottom-full right-0 mb-3 w-48 bg-popover border border-border rounded-lg shadow-lg">
            <div className="py-1">
              <button
                onClick={() => { setShowFabMenu(false); setShowProcessDialog(true) }}
                className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
              >
                <FolderKanban className="h-4 w-4" />
                Novo Processo
              </button>
              <button
                onClick={() => { setShowFabMenu(false); setEditingService(null); setShowServiceDialog(true) }}
                className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
              >
                <Briefcase className="h-4 w-4" />
                Novo Serviço
              </button>
              <button
                onClick={() => { setShowFabMenu(false); setEditingFee(null); setShowFeeDialog(true) }}
                className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
              >
                <DollarSign className="h-4 w-4" />
                Novo Honorário
              </button>
              <button
                onClick={() => { setShowFabMenu(false); setEditingNote(null); setShowNoteDialog(true) }}
                className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors flex items-center gap-2"
              >
                <StickyNote className="h-4 w-4" />
                Nova Nota
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog para adicionar processo */}
      {clientForDialog && (
        <ProcessFormDialog
          isOpen={showProcessDialog}
          onClose={() => setShowProcessDialog(false)}
          preselectedClient={clientForDialog}
          onSave={() => {
            setShowProcessDialog(false)
            void queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] })
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
            await queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] })
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
              await queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] })
            } catch (error) {
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
          services={services.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
          }))}
          onSave={handleSaveFee}
          onSaveBatch={handleSaveBatchFees}
        />
      )}

      {/* Dialog para adicionar/editar serviço */}
      {client && (
        <ServiceFormDialog
          isOpen={showServiceDialog}
          onClose={() => {
            setShowServiceDialog(false)
            setEditingService(null)
          }}
          service={editingService || undefined}
          clientId={client.id}
          onSave={handleSaveService}
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
                <span className="text-muted-foreground">Serviços:</span>
                <span className="font-semibold text-foreground">{client?.services_count || 0}</span>
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
