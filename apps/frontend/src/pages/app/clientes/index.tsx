import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Mail, Phone, MapPin, FileText, User } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { clientsService, type Client } from '@/services/clients-service'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function ClientesPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('all')

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus clientes e seus dados.</p>
        </div>
        <Link
          to="/app/clientes/novo"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Link>
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
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['all', 'active', 'inactive', 'archived'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-2 text-sm font-medium transition-colors',
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
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <User className="h-6 w-6 text-muted-foreground" />
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
                    <div className="w-10 h-10 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full flex items-center justify-center text-sm font-medium shrink-0">
                      {client.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-foreground">{client.name}</h3>
                        <span
                          className={cn(
                            'px-1.5 py-0.5 text-[10px] font-bold uppercase rounded',
                            client.status === 'active'
                              ? 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-500'
                              : client.status === 'inactive'
                              ? 'bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-500'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {getStatusLabel(client.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
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
                          <span className="flex items-center gap-1">
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
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Cadastrado em {formatDate(client.created_at)}
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
    </div>
  )
}
