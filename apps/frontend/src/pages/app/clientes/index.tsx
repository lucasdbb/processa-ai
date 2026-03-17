import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Mail, Phone, MapPin, User, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { phoneMask, cpfMask, cnpjMask, removeDocumentMask } from '@/lib/masks'
import { ClientListSkeleton } from '@/components/skeletons/client-list-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ClientFormDialog } from '@/components/forms/client-form-dialog'
import { useClients } from '@/hooks/use-clients'
import { useDebounce } from '@/hooks/use-debounce'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export default function ClientesPage() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showClientDialog, setShowClientDialog] = useState(false)

  const queryClient = useQueryClient()

  const { data, isLoading } = useClients({
    search: debouncedSearch,
    status: filter,
    limit: 50,
    offset: 0,
  })

  const clients = data?.clients ?? []
  const total = data?.total ?? 0

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
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus clientes e seus dados.</p>
        </div>
        <button
          onClick={() => setShowClientDialog(true)}
          data-tour="new-client-btn"
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {/* Busca + botão Filtros */}
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium transition-colors shrink-0',
              filtersOpen
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </button>
        </div>

        {/* Filtros secundários — painel colapsável */}
        <div
          className={cn(
            'rounded-lg border border-border bg-card p-3',
            filtersOpen ? 'block' : 'hidden'
          )}
        >
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">Status</span>
            <div className="flex rounded-md border border-border overflow-hidden w-full">
              {(['all', 'active', 'inactive'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'flex-1 px-2.5 py-1.5 text-xs font-medium transition-colors',
                    filter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  )}
                >
                  {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Inativos'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Client List */}
      <div>
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
        <div className="flex flex-col gap-2">
          {clients.map((client) => (
            <Link key={client.id} to={`/app/clientes/${client.id}`} className="block">
              <div className="group p-4 bg-card border border-border rounded-lg hover:shadow-md hover:border-primary/50 transition-all duration-200">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-sm font-semibold shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {client.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {client.name}
                        </h3>
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
                      <span className="text-[10px] text-muted-foreground hidden sm:block">
                        Cadastrado em {formatDate(client.created_at)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {/* Telefone — visível em mobile */}
                      {client.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3" />
                          {phoneMask(client.phone)}
                        </span>
                      )}
                      {/* CPF/CNPJ — visível em mobile */}
                      {client.cpf_cnpj && (
                        <span className="flex items-center gap-1.5">
                          CPF/CNPJ: {removeDocumentMask(client.cpf_cnpj).length <= 11 ? cpfMask(client.cpf_cnpj) : cnpjMask(client.cpf_cnpj)}
                        </span>
                      )}
                      {/* Email — só em sm+ */}
                      {client.email && (
                        <span className="hidden sm:flex items-center gap-1.5 truncate">
                          <Mail className="h-3 w-3" />
                          {client.email}
                        </span>
                      )}
                      {/* Cidade — só em sm+ */}
                      {client.city && (
                        <span className="hidden sm:flex items-center gap-1.5 truncate">
                          <MapPin className="h-3 w-3" />
                          {client.city}{client.state ? `, ${client.state}` : ''}
                        </span>
                      )}
                      {/* Fallback se não tiver nenhum contato */}
                      {!client.phone && !client.cpf_cnpj && !client.email && (
                        <span className="italic opacity-50">Sem contato cadastrado</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination placeholder */}
      <div className="flex items-center justify-between text-sm text-muted-foreground mt-3">
        <span>Mostrando {clients.length} de {total} clientes</span>
      </div>
      </div>

      {/* Floating Action Button — apenas mobile */}
      <div className="fixed bottom-22 right-4 z-50 sm:hidden">
        <button
          onClick={() => setShowClientDialog(true)}
          className="flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Client Form Dialog */}
      <ClientFormDialog
        isOpen={showClientDialog}
        onClose={() => setShowClientDialog(false)}
        onSave={async () => {
          setShowClientDialog(false)
          await queryClient.invalidateQueries({ queryKey: ['clients'] })
          toast.success('Cliente criado com sucesso!')
        }}
      />
    </div>
  )
}
