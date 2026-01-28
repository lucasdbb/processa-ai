import { useCallback, useEffect, useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Filter, Users } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ClientFormDialog } from '@/components/forms/client-form-dialog'

type Client = {
  id: string
  name: string
  cpf: string
  phone: string | null
  email: string | null
  status: 'active' | 'archived'
  processes_count: number
  calculations_count: number
  last_activity: string | null
}

type ClientListResponse = {
  clients: Client[]
  total: number
}

export default function ClientesPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  type EditingClient = ComponentProps<typeof ClientFormDialog>['client']
  type SaveClientPayload = Parameters<ComponentProps<typeof ClientFormDialog>['onSave']>[0]

  const [editingClient, setEditingClient] = useState<EditingClient>(undefined)

  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const fetchClients = useCallback(async (searchQuery: string, statusFilter: string) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      params.set('limit', '50')
      params.set('offset', '0')

      const res = await fetchWithCredentials(`${API_URL}/office/clients?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar clientes')

      const data = (await res.json()) as ClientListResponse
      setClients(data.clients)
      setTotal(data.total)
    } catch {
      setClients([])
      setTotal(0)
      toast.error('Erro ao carregar clientes')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchClients(search, filter)
    }, search ? 300 : 0)

    return () => clearTimeout(timeout)
  }, [search, filter, fetchClients])

  const handleSaveClient = (clientData: SaveClientPayload) => {
    console.log('Salvando cliente:', clientData)
    // Aqui você implementaria a lógica de salvar no backend
  }

  const handleNewClient = () => {
    setEditingClient(undefined)
    setIsFormOpen(true)
  }

  const formatLastActivity = (dateStr: string | null) => {
    if (!dateStr) return 'Sem atividade'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'hoje'
    if (diffDays === 1) return 'ha 1 dia'
    if (diffDays < 7) return `ha ${diffDays} dias`
    if (diffDays < 30) return `ha ${Math.floor(diffDays / 7)} semana(s)`
    return `ha ${Math.floor(diffDays / 30)} mes(es)`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus clientes e seus dados.</p>
        </div>
        <button
          onClick={handleNewClient}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
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
            placeholder="Buscar por nome, CPF ou email..."
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

      {/* Client List */}
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhum cliente encontrado</h3>
          <p className="text-muted-foreground text-sm">
            {search
              ? 'Tente buscar com outros termos.'
              : 'Comece cadastrando seu primeiro cliente.'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {clients.map((client) => (
              <Link key={client.id} to={`/app/clientes/${client.id}`}>
                <div className="p-4 sm:p-5 hover:bg-accent/50 transition-all duration-200 cursor-pointer border-l-2 border-transparent hover:border-primary">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm font-medium shrink-0">
                      {client.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{client.name}</h3>
                        <span
                          className={cn(
                            'px-1.5 py-0.5 text-[10px] font-bold uppercase rounded',
                            client.status === 'active'
                              ? 'bg-green-500/10 text-green-600'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {client.status === 'active' ? 'Ativo' : 'Arquivado'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        CPF: {client.cpf} &middot; {client.phone || 'Sem telefone'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {client.processes_count} processos &middot; {client.calculations_count} calculos
                        &middot; Ultimo acesso: {formatLastActivity(client.last_activity)}
                      </p>
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
        <span>Mostrando {clients.length} de {total} clientes</span>
      </div>

      {/* Client Form Dialog */}
      <ClientFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        client={editingClient}
        onSave={handleSaveClient}
      />
    </div>
  )
}
