import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Filter, FolderKanban } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { ProcessListSkeleton } from '@/components/skeletons/process-list-skeleton'
import { ProcessFormDialog } from '@/components/forms/process-form-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { InfoTooltip } from '@/components/ui/tooltip'

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
  const [isFormOpen, setIsFormOpen] = useState(false)

  type EditingProcess =
    | (NonNullable<ComponentProps<typeof ProcessFormDialog>['process']> & { nextDeadline?: string | null })
    | undefined
  type SaveProcessPayload = Parameters<ComponentProps<typeof ProcessFormDialog>['onSave']>[0]

  const [editingProcess, setEditingProcess] = useState<EditingProcess>(undefined)

  const [processes, setProcesses] = useState<Process[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const fetchProcesses = useCallback(async (searchQuery: string, statusFilter: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
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
      void fetchProcesses(search, filter)
    }, search ? 300 : 0)

    return () => clearTimeout(timeout)
  }, [search, filter, fetchProcesses])

  const handleSaveProcess = async (processData: SaveProcessPayload) => {
    console.log('Salvando processo:', processData)
    setIsFormOpen(false)
    setEditingProcess(undefined)
    // Reload processes list
    await fetchProcesses(search, filter)
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
          <Filter className="h-4 w-4 text-muted-foreground" />
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
