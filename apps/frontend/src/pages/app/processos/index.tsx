import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Filter, FolderKanban } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { ProcessListSkeleton } from '@/components/skeletons/process-list-skeleton'
import { ProcessFormDialog } from '@/components/forms/process-form-dialog'

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

  const handleSaveProcess = (processData: SaveProcessPayload) => {
    console.log('Salvando processo:', processData)
    // Aqui você implementaria a lógica de salvar no backend
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Processos</h1>
          <p className="text-muted-foreground mt-1">Acompanhe seus processos e prazos.</p>
        </div>
        <button
          onClick={handleNewProcess}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Processo
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por numero, cliente ou tipo..."
            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['all', 'active', 'archived'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-2 text-sm font-medium transition-colors',
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
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <FolderKanban className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhum processo encontrado</h3>
          <p className="text-muted-foreground text-sm">
            {search
              ? 'Tente buscar com outros termos.'
              : 'Comece cadastrando seu primeiro processo.'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {processes.map((process) => (
              <Link key={process.id} to={`/app/processos/${process.id}`}>
                <div className="p-4 sm:p-5 hover:bg-accent/50 transition-all duration-200 cursor-pointer border-l-2 border-transparent hover:border-primary">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-muted rounded-lg shrink-0">
                          <FolderKanban className="h-5 w-5 text-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-mono text-sm font-medium text-foreground">
                              {process.number}
                            </h3>
                            <span
                              className={cn(
                                'px-1.5 py-0.5 text-[10px] font-bold uppercase rounded',
                                process.status === 'active'
                                  ? 'bg-green-500/10 text-green-600'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {process.status === 'active' ? 'Ativo' : 'Arquivado'}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-foreground mt-1">{process.type}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {process.court}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            <span className="text-foreground">{process.client_name}</span> vs{' '}
                            {process.defendant}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-4 sm:gap-2">
                      <div className="text-right">
                        <p className="text-lg font-semibold text-foreground">
                          {formatCurrency(process.value)}
                        </p>
                        <p className="text-xs text-muted-foreground">Valor da causa</p>
                      </div>
                      {process.next_deadline && (
                        <div className="px-2 py-1 bg-yellow-500/10 text-yellow-600 rounded text-xs font-medium">
                          Prazo em {process.next_deadline}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
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
