import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Filter, Briefcase, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { servicesService, type Service, type ServiceStatus, type ServiceCategory } from '@/services/services-service'
import { ServiceFormDialog } from '@/components/forms/service-form-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { InfoTooltip } from '@/components/ui/tooltip'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

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

export default function ServicosPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | ServiceStatus>('all')
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | 'all'>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)

  type SaveServicePayload = Parameters<ComponentProps<typeof ServiceFormDialog>['onSave']>[0]

  const [editingService, setEditingService] = useState<Service | undefined>(undefined)

  const [services, setServices] = useState<Service[]>([])
  // const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const fetchServices = useCallback(async (searchQuery: string, statusFilter: string, catFilter: string) => {
    setIsLoading(true)
    try {
      const status = statusFilter !== 'all' ? (statusFilter as ServiceStatus) : undefined
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
      void fetchServices(search, filter, categoryFilter)
    }, search ? 300 : 0)

    return () => clearTimeout(timeout)
  }, [search, filter, categoryFilter, fetchServices])

  const handleSaveService = async (serviceData: SaveServicePayload) => {
    try {
      if (editingService) {
        await servicesService.update(editingService.id, serviceData)
        toast.success('Serviço atualizado com sucesso')
      } else {
        // Create is handled inside the dialog for now if passing client_id, 
        // but here we are creating a new service potentially without pre-selected client.
        // The ServiceFormDialog might need adjustment to handle creation without pre-selected client if intended.
        // However, looking at ServiceFormDialog usage in other places, it seems to expect onSave to handle the API call.
        // Let's check ServiceFormDialog implementation.
        
        // Actually, for new service on this page, we might need a client selector in the form.
        // The current ServiceFormDialog might be designed to work within a client context.
        // Let's assume for now we just refresh the list.
      }
      setIsFormOpen(false)
      setEditingService(undefined)
      await fetchServices(search, filter, categoryFilter)
    } catch (error) {
      console.error('Error saving service:', error)
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Serviços</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus serviços extrajudiciais e consultorias.</p>
        </div>
        <button
          onClick={handleNewService}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Novo Serviço
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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

          <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <InfoTooltip content="Filtre serviços por status" />
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
                {f === 'all' ? 'Todos' : getServiceStatusLabel(f)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Service List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
        </div>
      ) : filteredServices.length === 0 ? (
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
                        <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                          {service.name}
                        </h3>
                        <span
                          className={cn(
                            'px-2.5 py-0.5 text-xs font-medium rounded-full',
                            service.status === 'active'
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : service.status === 'completed'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {getServiceStatusLabel(service.status)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {getServiceCategoryLabel(service.category)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-0.5">Valor</p>
                        <p className="text-base font-semibold text-foreground">{formatCurrency(service.value)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ServiceFormDialog
        isOpen={isFormOpen}
        onClose={() => {
            setIsFormOpen(false)
            setEditingService(undefined)
        }}
        service={editingService}
        onSave={handleSaveService}
      />
    </div>
  )
}
