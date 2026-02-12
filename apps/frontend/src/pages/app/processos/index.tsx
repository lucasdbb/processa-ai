import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Filter, FolderKanban, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { ProcessListSkeleton } from '@/components/skeletons/process-list-skeleton'
import { ProcessFormDialog } from '@/components/forms/process-form-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { InfoTooltip } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

const COURT_OPTIONS = [
  'TJAC',
  'TJAL',
  'TJAM',
  'TJAP',
  'TJBA',
  'TJCE',
  'TJDF',
  'TJES',
  'TJGO',
  'TJMA',
  'TJMG',
  'TJMS',
  'TJMT',
  'TJPA',
  'TJPB',
  'TJPE',
  'TJPI',
  'TJPR',
  'TJRJ',
  'TJRN',
  'TJRO',
  'TJRR',
  'TJRS',
  'TJSC',
  'TJSE',
  'TJSP',
  'TJTO',
  'TRF1',
  'TRF2',
  'TRF3',
  'TRF4',
  'TRF5',
  'TRF6',
  'TST',
  'STJ',
  'STF',
]

type Process = {
  id: string
  number: string
  type: string
  court: string
  client_id: string
  client_name: string
  defendant: string
  value: number
  status: 'active' | 'archived'
  next_deadline: string | null
}

type ProcessListResponse = {
  processes: Process[]
  total: number
}

export default function ProcessosPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all')
  const [courtFilter, setCourtFilter] = useState<string>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)

  type EditingProcess =
    | (NonNullable<ComponentProps<typeof ProcessFormDialog>['process']> & { nextDeadline?: string | null })
    | undefined
  type SaveProcessPayload = Parameters<ComponentProps<typeof ProcessFormDialog>['onSave']>[0]

  const [editingProcess, setEditingProcess] = useState<EditingProcess>(undefined)

  const [processes, setProcesses] = useState<Process[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const fetchProcesses = useCallback(async (searchQuery: string, statusFilter: string, court: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      // Note: Backend might need update to support court filtering if not already supported via search
      // Assuming search handles general text search, we can try passing court as part of search or separate param if supported
      // Looking at backend code (processes/router.py), it seems filtering is limited.
      // However, we can use search param to filter by court since search usually covers multiple fields.
      // But precise filtering is better. Let's assume for now we pass it as a search term if precise param is missing,
      // or implement it properly.
      // Actually, let's check backend router again.
      // Backend list_processes accepts: search, status, client_id.
      // Search covers: process_number, type, defendant, subject. It does NOT seem to cover court explicitly in the description?
      // Wait, let's check the service implementation in previous turn.
      // Service implementation: "(process_number ILIKE %s OR type ILIKE %s OR defendant ILIKE %s OR subject ILIKE %s)"
      // It seems court is NOT in the search fields!
      // We should probably add 'court' to the search fields in backend or add a specific filter.
      // For now, let's append it to search query if user selects a court, hoping it might work or we update backend.
      // Better: Update backend to support court filter.
      
      // Let's assume we will update backend to support 'court' param or include it in search.
      // For this step, I'll send it as 'court' param and will update backend in next step if needed.
      if (court !== 'all') params.set('court', court)
      
      params.set('limit', '50')
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
      void fetchProcesses(search, filter, courtFilter)
    }, search ? 300 : 0)

    return () => clearTimeout(timeout)
  }, [search, filter, courtFilter, fetchProcesses])

  const handleSaveProcess = async (processData: SaveProcessPayload) => {
    console.log('Salvando processo:', processData)
    setIsFormOpen(false)
    setEditingProcess(undefined)
    // Reload processes list
    await fetchProcesses(search, filter, courtFilter)
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Processos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Acompanhe seus processos e prazos.</p>
        </div>
        <button
          onClick={handleNewProcess}
          data-tour="new-process-btn"
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Processo
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
                  {courtFilter === 'all'
                    ? 'Todos tribunais'
                    : courtFilter}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px] max-h-[300px] overflow-y-auto">
              <DropdownMenuItem onClick={() => setCourtFilter('all')}>
                Todos tribunais
              </DropdownMenuItem>
              {COURT_OPTIONS.map((court) => (
                <DropdownMenuItem key={court} onClick={() => setCourtFilter(court)}>
                  {court}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <InfoTooltip content="Filtre processos por status: todos, apenas ativos ou arquivados" />
          <div className="flex rounded-md border border-border overflow-hidden">
            {(['all', 'active', 'archived'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-medium transition-colors',
                  filter === f
                    ? 'bg-slate-900 text-white'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Arquivados'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Process List */}
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
      ) : (
        <div className="space-y-3">
          {processes.map((process) => (
            <Link key={process.id} to={`/app/processos/${process.id}`}>
              <div className="group p-3.5 bg-card border border-border rounded-lg hover:shadow-sm hover:border-primary/50 transition-all duration-200">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-primary/10 rounded-md shrink-0 group-hover:bg-primary/20 transition-colors">
                      <FolderKanban className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className="font-mono text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                          {process.number}
                        </h3>
                        <span
                          className={cn(
                            'px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-full',
                            process.status === 'active'
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {process.status === 'active' ? 'Ativo' : 'Arquivado'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {process.type} • {process.court}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="font-medium text-foreground">{process.client_name}</span> vs{' '}
                        <span className="font-medium text-foreground">{process.defendant}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {process.next_deadline && (
                      <div className="px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded text-[10px] font-semibold">
                        {process.next_deadline}
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">
                        {formatCurrency(process.value)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Valor</p>
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
    </div>
  )
}
