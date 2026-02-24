import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Filter, Briefcase, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { servicesService, type Service, type ServiceStatus, type ServiceCategory } from '@/services/services-service'
import { ServiceFormDialog } from '@/components/forms/service-form-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { InfoTooltip } from '@/components/ui/tooltip'
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
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  type SaveServicePayload = Parameters<ComponentProps<typeof ServiceFormDialog>['onSave']>[0]

  const [editingService, setEditingService] = useState<Service | undefined>(undefined)

  const [services, setServices] = useState<Service[]>([])
  // const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const fetchServices = useCallback(async (searchQuery: string, statusFilter: string, catFilter: string, mode: 'list' | 'kanban') => {
    setIsLoading(true)
    try {
      // In Kanban mode, we want all statuses to populate columns
      // In List mode, we respect the filter
      const status = (mode === 'list' && statusFilter !== 'all') ? (statusFilter as ServiceStatus) : undefined
      const category = catFilter !== 'all' ? (catFilter as ServiceCategory) : undefined
      
      const res = await servicesService.list(undefined, category, status, searchQuery.trim())
      
      setServices(res.services)
      // setTotal(res.total)
    } catch {
      setServices([])
      // setTotal(0)
      toast.error('Erro ao carregar serviços')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchServices(search, filter, categoryFilter, viewMode)
    }, search ? 300 : 0)

    return () => clearTimeout(timeout)
  }, [search, filter, categoryFilter, viewMode, fetchServices])

  const handleSaveService = async (serviceData: SaveServicePayload) => {
    try {
      if (editingService) {
        await servicesService.update(editingService.id, serviceData)
        toast.success('Serviço atualizado com sucesso!')
      } else {
        if (!selectedClientId) {
          toast.error('Selecione um cliente para criar o serviço')
          return
        }
        const name = (serviceData as any).name as string | undefined
        const category = (serviceData as any).category as ServiceCategory | undefined
        const value = (serviceData as any).value as number | null | undefined
        const notes = (serviceData as any).notes as string | null | undefined

        if (!name || !category) {
          toast.error('Preencha os campos obrigatórios do serviço')
          return
        }

        await servicesService.create({
          client_id: selectedClientId,
          name,
          category,
          value: typeof value === 'number' ? value : null,
          notes: notes ?? null,
        })
        toast.success('Serviço criado com sucesso!')
      }
      setIsFormOpen(false)
      setEditingService(undefined)
      void fetchServices(search, filter, categoryFilter, viewMode)
    } catch {
      toast.error('Erro ao salvar serviço')
    }
  }

  const handleNewService = () => {
    if (!selectedClientId) {
      toast.error('Selecione um cliente antes de criar um serviço')
      return
    }
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
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Serviço</span>
        </button>
      }
      filters={
        <>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou categoria..."
              className="w-full pl-9 pr-3 py-2 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <ClientSelect
              value={selectedClientId ?? undefined}
              onChange={(id) => setSelectedClientId(id)}
              placeholder="Selecione um cliente..."
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1 text-xs">
                  <Filter className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {categoryFilter === 'all'
                      ? 'Todas categorias'
                      : getServiceCategoryLabel(categoryFilter)}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
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

            {viewMode === 'list' && (
              <>
                <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
                <InfoTooltip content="Filtre serviços por status: todos, apenas ativos, concluídos ou cancelados" />
                <div className="flex rounded-md border border-border overflow-hidden">
                  {(['all', 'active', 'completed', 'cancelled'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        'px-2.5 py-1.5 text-xs font-medium transition-colors',
                        filter === f
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {getServiceStatusLabel(f === 'all' ? 'Todos' : f)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
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
                void fetchServices(search, filter, categoryFilter, viewMode)
              }
            }}
            renderCard={(item, isDragging) => (
              <ServiceCard service={item} isDragging={isDragging} />
            )}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredServices.map((service) => (
            <Link key={service.id} to={`/app/servicos/${service.id}`}>
              <div className="group p-4 bg-card border border-border rounded-lg hover:shadow-md hover:border-primary/50 transition-all duration-200">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-2.5 bg-primary/10 rounded-lg shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h3 className="font-mono text-base font-bold text-foreground group-hover:text-primary transition-colors">
                          {service.name}
                        </h3>
                        <span
                          className={cn(
                            'px-2.5 py-0.5 text-xs font-medium rounded-full',
                            service.status === 'active'
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : service.status === 'completed'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          )}
                        >
                          {getServiceStatusLabel(service.status)}
                        </span>
                        <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground border border-border">
                          {getServiceCategoryLabel(service.category)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {service.client_name || 'Sem cliente vinculado'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-foreground">
                      {formatCurrency(service.value)}
                    </p>
                    <p className="text-xs text-muted-foreground">Valor</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

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
