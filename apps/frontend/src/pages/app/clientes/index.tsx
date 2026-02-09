import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Mail, Phone, MapPin, FileText, User } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { clientsService, type Client } from '@/services/clients-service'
import { ClientListSkeleton } from '@/components/skeletons/client-list-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ClientFormDialog } from '@/components/forms/client-form-dialog'

export default function ClientesPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('all')
  const [showClientDialog, setShowClientDialog] = useState(false)

  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const fetchClients = useCallback(async (searchQuery: string, statusFilter: string) => {
    setIsLoading(true)
    try {
      const params: {
        limit: number
        offset: number
        search?: string
        status?: 'active' | 'inactive' | 'archived'
      } = {
        limit: 50,
        offset: 0,
      }
      
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (statusFilter !== 'all') params.status = statusFilter as 'active' | 'inactive' | 'archived'

      const data = await clientsService.list(params)
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchClients(search, filter)
    }, search ? 300 : 0)

    return () => clearTimeout(timeout)
  }, [search, filter, fetchClients])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Ativo',
      inactive: 'Inativo',
      archived: 'Arquivado',
    }
    return labels[status] || status
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie seus clientes e seus dados.</p>
        </div>
        <button
          onClick={() => setShowClientDialog(true)}
          data-tour="new-client-btn"
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-md text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div data-tour="search-clients" className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF ou email..."
            className="w-full pl-9 pr-3 py-2 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            {(['all', 'active', 'inactive', 'archived'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-medium transition-colors',
                  filter === f
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : f === 'inactive' ? 'Inativos' : 'Arquivados'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Client List */}
      {isLoading ? (
        <ClientListSkeleton />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={User}
          title="Nenhum cliente encontrado"
          description={
            search
              ? 'Tente buscar com outros termos.'
              : 'Comece cadastrando seu primeiro cliente.'
          }
          action={!search ? { label: 'Novo Cliente', onClick: () => setShowClientDialog(true) } : undefined}
        />
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <Link key={client.id} to={`/app/clientes/${client.id}`}>
              <div className="group p-3 bg-card border border-border rounded-lg hover:shadow-sm hover:border-primary/50 transition-all duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full flex items-center justify-center text-xs font-semibold shrink-0">
                    {client.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <h3 className="text-sm font-semibold text-foreground truncate">{client.name}</h3>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-full',
                          client.status === 'active'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : client.status === 'inactive'
                            ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {getStatusLabel(client.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
                      {client.cpf_cnpj && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {client.cpf_cnpj}
                        </span>
                      )}
                      {client.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {client.phone}
                        </span>
                      )}
                      {client.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" />
                          {client.email}
                        </span>
                      )}
                      {client.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {client.city}{client.state ? `, ${client.state}` : ''}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        Cadastrado em {formatDate(client.created_at)}
                      </span>
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
        <span>Mostrando {clients.length} de {total} clientes</span>
      </div>

      {/* Client Form Dialog */}
      <ClientFormDialog
        isOpen={showClientDialog}
        onClose={() => setShowClientDialog(false)}
        onSave={async () => {
          setShowClientDialog(false)
          await fetchClients(search, filter)
          toast.success('Cliente criado com sucesso!')
        }}
      />
    </div>
  )
}
