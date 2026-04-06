import { useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { SEO } from '@/components/seo'
import { Search, Plus, Filter, FolderKanban, ChevronDown, Scale, Building2, Handshake, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { ProcessListSkeleton } from '@/components/skeletons/process-list-skeleton'
import { ProcessFormDialog } from '@/components/forms/process-form-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { TRIBUNALS } from '@/lib/constants'
import { GenericKanban } from '@/components/kanban/generic-kanban'
import { ProcessCard } from '@/components/kanban/process-card'
import { PageLayout } from '@/components/layout/page-layout'
import { useProcesses } from '@/hooks/use-processes'
import { useDebounce } from '@/hooks/use-debounce'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { processesService } from '@/services/processes-service'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  concluded: { label: 'Concluído', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  cancelled: { label: 'Cancelado', className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
}

const PROCESS_COLUMNS: Record<string, string> = {
  active: 'Ativos',
  concluded: 'Concluídos',
  cancelled: 'Cancelados',
}

const PROCESS_COLUMN_ORDER: string[] = [
  'active',
  'concluded',
  'cancelled',
]

const CATEGORY_CONFIG = {
  judicial: {
    label: 'Judicial',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    icon: Scale,
  },
  administrative: {
    label: 'Administrativo',
    className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    icon: Building2,
  },
} as const

export default function ProcessosPage() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  
  const [filter, setFilter] = useState<'all' | 'active' | 'concluded' | 'cancelled'>('all')
  const [tribunalFilter, setTribunalFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'judicial' | 'administrative'>('all')
  const [partnershipFilter, setPartnershipFilter] = useState<'all' | 'partnership' | 'own'>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)

  type EditingProcess =
    | (NonNullable<ComponentProps<typeof ProcessFormDialog>['process']> & { nextDeadline?: string | null })
    | undefined

  const [editingProcess, setEditingProcess] = useState<EditingProcess>(undefined)
  const queryClient = useQueryClient()

  type ProcessStatus = 'active' | 'concluded' | 'cancelled'
  const isProcessStatus = (value: string): value is ProcessStatus =>
    value === 'active' || value === 'concluded' || value === 'cancelled'

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProcessStatus }) => {
      // Usando o service correto, já tipado no backend
      return processesService.update(id, { status })
    },
    onSuccess: (_, variables) => {
      toast.success(`Processo movido para ${PROCESS_COLUMNS[variables.status]}`)
      void queryClient.invalidateQueries({ queryKey: ['processes'] })
    },
    onError: () => {
      toast.error('Erro ao atualizar status do processo')
    },
  })

  const isPartnership = 
    partnershipFilter === 'partnership' ? true : 
    partnershipFilter === 'own' ? false : 
    undefined;

  const { data, isLoading } = useProcesses({
    search: debouncedSearch,
    status: viewMode === 'list' ? filter : 'all',
    tribunal: tribunalFilter,
    process_category: categoryFilter,
    is_partnership: isPartnership,
    limit: viewMode === 'kanban' ? 100 : 50,
    offset: 0,
  })

  const [exporting, setExporting] = useState(false)

  const processes = data?.processes ?? []
  const total = data?.total ?? 0

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetchWithCredentials(`${API_URL}/office/processes/export`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'processos.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Erro ao exportar processos.')
    } finally {
      setExporting(false)
    }
  }

  const handleSaveProcess = async () => {
    setIsFormOpen(false)
    setEditingProcess(undefined)
    // Invalidate queries to trigger a refetch
    await queryClient.invalidateQueries({ queryKey: ['processes'] })
  }

  const handleNewProcess = () => {
    setEditingProcess(undefined)
    setIsFormOpen(true)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  return (
    <>
    <SEO title="Processos" noindex />
    <PageLayout
      title="Processos"
      description="Acompanhe seus processos e prazos."
      isLoading={isLoading}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 bg-muted text-foreground border border-border rounded-md text-sm font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
          <button
            onClick={handleNewProcess}
            data-tour="new-process-btn"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Novo Processo
          </button>
        </div>
      }
      primaryFilter={
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por numero, cliente ou tipo..."
            className="w-full pl-9 pr-3 py-2 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
      }
      filters={
        <>
            {/* Tribunal */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
              <span className="text-xs text-muted-foreground font-medium sm:hidden">Tribunal</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1 text-xs w-full sm:w-auto justify-between sm:justify-center">
                    <span className="flex items-center gap-1">
                      <Filter className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate max-w-[140px]">
                        {tribunalFilter === 'all' ? 'Todos tribunais' : tribunalFilter}
                      </span>
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px] max-h-[300px] overflow-y-auto">
                  <DropdownMenuItem onClick={() => setTribunalFilter('all')}>
                    Todos tribunais
                  </DropdownMenuItem>
                  {TRIBUNALS.map((tribunal) => (
                    <DropdownMenuItem key={tribunal} onClick={() => setTribunalFilter(tribunal)}>
                      {tribunal}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Categoria */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
              <span className="text-xs text-muted-foreground font-medium sm:hidden">Categoria</span>
              <div className="flex rounded-md border border-border overflow-hidden w-full sm:w-auto">
                {(['all', 'judicial', 'administrative'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={cn(
                      'flex-1 sm:flex-none px-2.5 py-1.5 text-xs font-medium transition-colors',
                      categoryFilter === c
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {c === 'all' ? 'Todos' : c === 'judicial' ? 'Judicial' : 'Administrativo'}
                  </button>
                ))}
              </div>
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
                  {(['all', 'active', 'concluded', 'cancelled'] as const).map((f) => (
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
                      {f === 'all' ? 'Todos' : STATUS_CONFIG[f].label}
                    </button>
                  ))}
                </div>
              </div>
            )}
        </>
      }
    >
      {/* Process List or Kanban */}
      {isLoading ? (
        <ProcessListSkeleton />
      ) : processes.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Nenhum processo encontrado"
          description={
            search
              ? 'Tente buscar com outros termos.'
              : 'Comece cadastrando seu primeiro processo.'
          }
          action={!search ? { label: 'Novo Processo', onClick: handleNewProcess } : undefined}
        />
      ) : viewMode === 'kanban' ? (
        <div className="h-[calc(100vh-280px)] min-h-[500px]">
          <GenericKanban
            items={processes}
            columns={PROCESS_COLUMNS}
            columnOrder={PROCESS_COLUMN_ORDER}
            onStatusChange={async (item, newStatus) => {
              if (!isProcessStatus(newStatus)) return
              await updateStatusMutation.mutateAsync({ id: item.id, status: newStatus })
            }}
            renderCard={(item, isDragging) => (
              <ProcessCard process={item} isDragging={isDragging} />
            )}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {processes.map((process) => (
            <Link key={process.id} to={`/app/processos/${process.id}`} className="block">
              <div className="group p-4 bg-card border border-border rounded-lg hover:shadow-md hover:border-primary/50 transition-all duration-200">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-2.5 bg-primary/10 rounded-lg shrink-0 group-hover:bg-primary/20 transition-colors">
                      <FolderKanban className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Linha 1: número + status */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-mono text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {process.process_number}
                        </h3>
                        <span
                          className={cn(
                            'px-2 py-0.5 text-xs font-medium rounded-full shrink-0',
                            (STATUS_CONFIG[process.status] || STATUS_CONFIG['active']).className
                          )}
                        >
                          {(STATUS_CONFIG[process.status] || STATUS_CONFIG['active']).label}
                        </span>
                      </div>

                      {/* Linha 2: valor · natureza · área · parceria (+ categoria em desktop) */}
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-0.5">
                        {(process.value ?? 0) > 0 && (
                          <span className="font-semibold text-foreground">
                            {formatCurrency(process.value || 0)}
                          </span>
                        )}
                        {process.process_category && <span>{process.process_category}</span>}
                        {process.area && <span>{process.area}</span>}
                        {process.is_partnership && (
                          <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1">
                            <Handshake className="h-3 w-3" />
                            Parceria {process.partner_percentage}%
                          </span>
                        )}
                        {(() => {
                          const cat = CATEGORY_CONFIG[process.process_category] ?? CATEGORY_CONFIG.judicial
                          return (
                            <span className={cn('hidden sm:inline px-2 py-0.5 rounded-full font-medium', cat.className)}>
                              {cat.label}
                            </span>
                          )
                        })()}
                      </div>

                      {/* Linha 3: partes */}
                      <p className="text-sm text-muted-foreground truncate">
                        {process.client_role === 'defendant' ? (
                          <>
                            <span className="font-medium text-foreground">{process.defendant}</span>
                            {' vs '}
                            <span className="font-medium text-foreground">{process.client_name || process.client_id}</span>
                          </>
                        ) : (
                          <>
                            <span className="font-medium text-foreground">{process.client_name || process.client_id}</span>
                            {' vs '}
                            <span className="font-medium text-foreground">{process.defendant}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  {/* Prazo — apenas desktop */}
                  {process.next_deadline && (
                    <div className="hidden sm:flex items-center shrink-0">
                      <div className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-md text-xs font-semibold">
                        {process.next_deadline}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination placeholder */}
      <div className="flex items-center justify-between text-sm text-muted-foreground mt-3">
        <span>Mostrando {processes.length} de {total} processos</span>
      </div>

      {/* Floating Action Button — apenas mobile */}
      <div className="fixed bottom-22 right-4 z-50 sm:hidden">
        <button
          onClick={handleNewProcess}
          className="flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Process Form Dialog */}
      <ProcessFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        process={editingProcess}
        onSave={handleSaveProcess}
      />
    </PageLayout>
    </>
  )
}
