import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Filter, Briefcase, ChevronDown, Handshake } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { servicesService, type Service, type ServiceStatus, type ServiceCategory } from '@/services/services-service'
import { ServiceFormDialog } from '@/components/forms/service-form-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { GenericKanban } from '@/components/kanban/generic-kanban'
import { ServiceCard } from '@/components/kanban/service-card'
import { PageLayout } from '@/components/layout/page-layout'
import { ClientSelect } from '@/components/ui/client-select'

const CATEGORIES: ServiceCategory[] = [
  'previdenciario',
  'trabalhista',
  'civel',
  'tributario',
  'familiar',
  'empresarial',
  'imobiliario',
  'administrativo',
  'consultoria',
  'outro',
]

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

const getServiceStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    active: 'Ativo',
    completed: 'Concluído',
    cancelled: 'Cancelado',
  }
  return labels[status] || status
}

const SERVICE_COLUMNS: Record<string, string> = {
  active: 'Ativos',
  completed: 'Concluídos',
  cancelled: 'Cancelados',
}

const SERVICE_COLUMN_ORDER: string[] = [
  'active',
  'completed',
  'cancelled',
]

export default function ServicosPage() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | ServiceStatus>('all')
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | 'all'>('all')
  const [partnershipFilter, setPartnershipFilter] = useState<'all' | 'partnership' | 'own'>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  type SaveServicePayload = Parameters<ComponentProps<typeof ServiceFormDialog>['onSave']>[0]

  const [editingService, setEditingService] = useState<Service | undefined>(undefined)

  const [services, setServices] = useState<Service[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const fetchServices = useCallback(async (searchQuery: string, statusFilter: string, catFilter: string, partnership: string, mode: 'list' | 'kanban') => {
    setIsLoading(true)
    try {
      // In Kanban mode, we want all statuses to populate columns
      // In List mode, we respect the filter
      const status = (mode === 'list' && statusFilter !== 'all') ? (statusFilter as ServiceStatus) : undefined
      const category = catFilter !== 'all' ? (catFilter as ServiceCategory) : undefined
      const isPartnership = partnership === 'partnership' ? true : partnership === 'own' ? false : undefined

      const res = await servicesService.list(undefined, category, status, searchQuery.trim(), isPartnership)

      setServices(res.services)
      setTotal(res.total)
    } catch {
      setServices([])
      setTotal(0)
      toast.error('Erro ao carregar serviços')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchServices(search, filter, categoryFilter, partnershipFilter, viewMode)
    }, search ? 300 : 0)

    return () => clearTimeout(timeout)
  }, [search, filter, categoryFilter, partnershipFilter, viewMode, fetchServices])

  const handleSaveService = async (serviceData: SaveServicePayload) => {
    try {
      if (editingService) {
        await servicesService.update(editingService.id, serviceData)
        toast.success('Serviço atualizado com sucesso!')
      } else {
        const clientIdToUse = (serviceData as { client_id?: string }).client_id ?? selectedClientId
        const name = (serviceData as any).name as string | undefined
        const category = (serviceData as any).category as ServiceCategory | undefined
        const value = (serviceData as any).value as number | null | undefined
        const notes = (serviceData as any).notes as string | null | undefined
        const isPartnership = (serviceData as any).is_partnership as boolean | undefined
        const partnerLawyer = (serviceData as any).partner_lawyer as string | null | undefined
        const partnerPercentage = (serviceData as any).partner_percentage as number | null | undefined

        if (!clientIdToUse || !name || !category) return

        await servicesService.create({
          client_id: clientIdToUse,
          name,
          category,
          value: typeof value === 'number' ? value : null,
          notes: notes ?? null,
          is_partnership: isPartnership,
          partner_lawyer: partnerLawyer ?? null,
          partner_percentage: partnerPercentage ?? null,
        })
        toast.success('Serviço criado com sucesso!')
      }
      setIsFormOpen(false)
      setEditingService(undefined)
      void fetchServices(search, filter, categoryFilter, partnershipFilter, viewMode)
    } catch {
      toast.error('Erro ao salvar serviço')
    }
  }

  const handleNewService = () => {
    setEditingService(undefined)
    setIsFormOpen(true)
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'A definir'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  // Client-side filtering removed since we now support server-side search
  const filteredServices = services

  return (
    <PageLayout
      title="Serviços"
      description="Gerencie seus serviços extrajudiciais e consultorias."
      isLoading={isLoading}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      actions={
        <button
          onClick={handleNewService}
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Novo Serviço
        </button>
      }
      primaryFilter={
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou categoria..."
            className="w-full pl-9 pr-3 py-2 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
      }
      filters={
        <>
            {/* Cliente */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
              <span className="text-xs text-muted-foreground font-medium sm:hidden">Cliente</span>
              <ClientSelect
                value={selectedClientId ?? undefined}
                onChange={(id) => setSelectedClientId(id)}
                placeholder="Selecione um cliente..."
              />
            </div>

            {/* Categoria */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
              <span className="text-xs text-muted-foreground font-medium sm:hidden">Categoria</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1 text-xs w-full sm:w-auto justify-between sm:justify-center">
                    <span className="flex items-center gap-1">
                      <Filter className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate max-w-[140px]">
                        {categoryFilter === 'all' ? 'Todas categorias' : getServiceCategoryLabel(categoryFilter)}
                      </span>
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuItem onClick={() => setCategoryFilter('all')}>
                    Todas categorias
                  </DropdownMenuItem>
                  {CATEGORIES.map((cat) => (
                    <DropdownMenuItem key={cat} onClick={() => setCategoryFilter(cat)}>
                      {getServiceCategoryLabel(cat)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Parceria */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
              <span className="text-xs text-muted-foreground font-medium sm:hidden">Parceria</span>
              <div className="flex rounded-md border border-border overflow-hidden w-full sm:w-auto">
                {([
                  { value: 'all', label: 'Todos' },
                  { value: 'partnership', label: 'Parcerias' },
                  { value: 'own', label: 'Próprios' },
                ] as const).map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setPartnershipFilter(f.value)}
                    className={cn(
                      'flex-1 sm:flex-none px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1',
                      partnershipFilter === f.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {f.value === 'partnership' && <Handshake className="h-3 w-3" />}
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status — só na view lista */}
            {viewMode === 'list' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
                <span className="text-xs text-muted-foreground font-medium sm:hidden">Status</span>
                <div className="flex rounded-md border border-border overflow-hidden w-full sm:w-auto">
                  {(['all', 'active', 'completed', 'cancelled'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        'flex-1 sm:flex-none px-2.5 py-1.5 text-xs font-medium transition-colors',
                        filter === f
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {getServiceStatusLabel(f === 'all' ? 'Todos' : f)}
                    </button>
                  ))}
                </div>
              </div>
            )}
        </>
      }
    >
      {/* Services List or Kanban */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/20 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nenhum serviço encontrado"
          description={
            search
              ? 'Tente buscar com outros termos.'
              : 'Comece cadastrando seu primeiro serviço.'
          }
          action={!search ? { label: 'Novo Serviço', onClick: handleNewService } : undefined}
        />
      ) : viewMode === 'kanban' ? (
        <div className="h-[calc(100vh-280px)] min-h-[500px]">
          <GenericKanban
            items={services}
            columns={SERVICE_COLUMNS}
            columnOrder={SERVICE_COLUMN_ORDER}
            onStatusChange={async (item, newStatus) => {
              try {
                await servicesService.update(item.id, { status: newStatus as any })
                toast.success(`Serviço movido para ${SERVICE_COLUMNS[newStatus]}`)
              } catch {
                toast.error('Erro ao atualizar status do serviço')
                void fetchServices(search, filter, categoryFilter, partnershipFilter, viewMode)
              }
            }}
            renderCard={(item, isDragging) => (
              <ServiceCard service={item} isDragging={isDragging} />
            )}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredServices.map((service) => (
            <Link key={service.id} to={`/app/servicos/${service.id}`} className="block">
              <div className="group p-4 bg-card border border-border rounded-lg hover:shadow-md hover:border-primary/50 transition-all duration-200">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-2.5 bg-primary/10 rounded-lg shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Linha 1: nome + status */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {service.name}
                        </h3>
                        <span
                          className={cn(
                            'px-2 py-0.5 text-xs font-medium rounded-full shrink-0',
                            service.status === 'active'
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : service.status === 'completed'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          )}
                        >
                          {getServiceStatusLabel(service.status)}
                        </span>
                      </div>

                      {/* Linha 2: valor · categoria · parceria */}
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-0.5">
                        {service.value !== null && (
                          <span className="font-semibold text-foreground">
                            {formatCurrency(service.value)}
                          </span>
                        )}
                        <span>{getServiceCategoryLabel(service.category)}</span>
                        {service.is_partnership && (
                          <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1">
                            <Handshake className="h-3 w-3" />
                            Parceria {service.partner_percentage}%
                          </span>
                        )}
                      </div>

                      {/* Linha 3: cliente */}
                      <p className="text-sm text-muted-foreground truncate">
                        {service.client_name || 'Sem cliente vinculado'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Legenda */}
      <div className="flex items-center justify-between text-sm text-muted-foreground mt-3">
        <span>Mostrando {services.length} de {total} serviços</span>
      </div>

      {/* Floating Action Button — apenas mobile */}
      <div className="fixed bottom-22 right-4 z-50 sm:hidden">
        <button
          onClick={handleNewService}
          className="flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Service Form Dialog */}
      <ServiceFormDialog
        isOpen={isFormOpen}
        onClose={() => {
            setIsFormOpen(false)
            setEditingService(undefined)
        }}
        service={editingService}
        onSave={handleSaveService}
      />
    </PageLayout>
  )
}
