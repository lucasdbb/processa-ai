import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Filter, FolderKanban, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
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
import { type Process, type ProcessListResponse } from '@/services/processes-service'
import { GenericKanban } from '@/components/kanban/generic-kanban'
import { ProcessCard } from '@/components/kanban/process-card'
import { PageLayout } from '@/components/layout/page-layout'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  pending: { label: 'Pendente', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  suspended: { label: 'Suspenso', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  concluded: { label: 'Concluído', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  archived: { label: 'Arquivado', className: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelado', className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
}

const PROCESS_COLUMNS: Record<string, string> = {
  active: 'Ativos',
  pending: 'Pendentes',
  suspended: 'Suspensos',
  concluded: 'Concluídos',
  archived: 'Arquivados',
  cancelled: 'Cancelados',
}

const PROCESS_COLUMN_ORDER: string[] = [
  'active',
  'pending',
  'suspended',
  'concluded',
  'archived',
  'cancelled',
]

export default function ProcessosPage() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all')
  const [tribunalFilter, setTribunalFilter] = useState<string>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)

  type EditingProcess =
    | (NonNullable<ComponentProps<typeof ProcessFormDialog>['process']> & { nextDeadline?: string | null })
    | undefined
  type SaveProcessPayload = Parameters<ComponentProps<typeof ProcessFormDialog>['onSave']>[0]

  const [editingProcess, setEditingProcess] = useState<EditingProcess>(undefined)

  const [processes, setProcesses] = useState<Process[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const fetchProcesses = useCallback(async (searchQuery: string, statusFilter: string, tribunal: string, mode: 'list' | 'kanban') => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      
      // In Kanban mode, we want all statuses to populate columns
      // In List mode, we respect the filter
      if (mode === 'list' && statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      
      if (tribunal !== 'all') params.set('tribunal', tribunal)
      
      // For Kanban, we might need more items or pagination per column
      // For now, let's just increase limit for Kanban to show a good overview
      params.set('limit', mode === 'kanban' ? '100' : '50')
      params.set('offset', '0')

      const res = await fetchWithCredentials(`${API_URL}/office/processes?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar processos')

      const data = (await res.json()) as ProcessListResponse
      setProcesses(data.processes)
      setTotal(data.total)
    } catch {
      setProcesses([])
      setTotal(0)
      toast.error('Erro ao carregar processos')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchProcesses(search, filter, tribunalFilter, viewMode)
    }, search ? 300 : 0)

    return () => clearTimeout(timeout)
  }, [search, filter, tribunalFilter, viewMode, fetchProcesses])

  const handleSaveProcess = async (processData: SaveProcessPayload) => {
    console.log('Salvando processo:', processData)
    setIsFormOpen(false)
    setEditingProcess(undefined)
    // Reload processes list
    await fetchProcesses(search, filter, tribunalFilter, viewMode)
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
    <PageLayout
      title="Processos"
      description="Acompanhe seus processos e prazos."
      isLoading={isLoading}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      actions={
        <button
          onClick={handleNewProcess}
          data-tour="new-process-btn"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Processo</span>
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
              placeholder="Buscar por numero, cliente ou tipo..."
              className="w-full pl-9 pr-3 py-2 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
          <div data-tour="process-filters" className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1 text-xs">
                  <Filter className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {tribunalFilter === 'all'
                      ? 'Todos tribunais'
                      : tribunalFilter}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
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

            {viewMode === 'list' && (
              <>
                <div className="w-px h-6 bg-border mx-1" />
                <div className="flex rounded-md border border-border overflow-hidden">
                  {(['all', 'active', 'archived'] as const).map((f) => (
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
                      {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Arquivados'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
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
              try {
                await fetchWithCredentials(`${API_URL}/office/processes/${item.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: newStatus }),
                })
                toast.success(`Processo movido para ${PROCESS_COLUMNS[newStatus]}`)
              } catch {
                toast.error('Erro ao atualizar status do processo')
                void fetchProcesses(search, filter, tribunalFilter, viewMode)
              }
            }}
            renderCard={(item, isDragging) => (
              <ProcessCard process={item} isDragging={isDragging} />
            )}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {processes.map((process) => (
            <Link key={process.id} to={`/app/processos/${process.id}`}>
              <div className="group p-4 bg-card border border-border rounded-lg hover:shadow-md hover:border-primary/50 transition-all duration-200">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-2.5 bg-primary/10 rounded-lg shrink-0 group-hover:bg-primary/20 transition-colors">
                      <FolderKanban className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h3 className="font-mono text-base font-bold text-foreground group-hover:text-primary transition-colors">
                          {process.process_number}
                        </h3>
                        <span
                          className={cn(
                            'px-2.5 py-0.5 text-xs font-medium rounded-full',
                            (STATUS_CONFIG[process.status] || STATUS_CONFIG['active']).className
                          )}
                        >
                          {(STATUS_CONFIG[process.status] || STATUS_CONFIG['active']).label}
                        </span>
                        {process.area && (
                          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            {process.area}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate mb-0.5">
                        {process.type} • {process.court}
                      </p>
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
                  <div className="flex items-center gap-6 shrink-0">
                    {process.next_deadline && (
                      <div className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-md text-xs font-semibold">
                        {process.next_deadline}
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-base font-bold text-foreground">
                        {formatCurrency(process.value || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Valor</p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination placeholder */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Mostrando {processes.length} de {total} processos</span>
      </div>

      {/* Process Form Dialog */}
      <ProcessFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        process={editingProcess}
        onSave={handleSaveProcess}
      />
    </PageLayout>
  )
}
