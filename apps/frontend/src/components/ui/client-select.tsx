import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, User, X, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { clientsService, type Client } from '@/services/clients-service'

interface ClientSelectProps {
  value?: string // client_id
  onChange: (clientId: string | null, client: Client | null) => void
  placeholder?: string
  disabled?: boolean
  error?: string
  className?: string
  /** Cliente pré-selecionado (evita fetch inicial) */
  initialClient?: Client
  /** Callback para criar novo cliente inline */
  onCreateNew?: () => void
}

export function ClientSelect({
  value,
  onChange,
  placeholder = 'Buscar cliente...',
  disabled = false,
  error,
  className,
  initialClient,
  onCreateNew,
}: ClientSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(initialClient ?? null)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Buscar cliente inicial se temos value mas não initialClient
  useEffect(() => {
    if (value && !initialClient && !selectedClient) {
      clientsService.get(value).then(setSelectedClient).catch(() => {})
    }
  }, [value, initialClient, selectedClient])

  // Buscar clientes com debounce
  const fetchClients = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const data = await clientsService.list({
        search: query || undefined,
        status: 'active',
        limit: 10,
      })
      setClients(data.clients)
    } catch {
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const timeout = setTimeout(() => {
      fetchClients(search)
    }, 300)

    return () => clearTimeout(timeout)
  }, [search, isOpen, fetchClients])

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (client: Client) => {
    setSelectedClient(client)
    onChange(client.id, client)
    setIsOpen(false)
    setSearch('')
  }

  const handleClear = () => {
    setSelectedClient(null)
    onChange(null, null)
    setSearch('')
  }

  const handleOpen = () => {
    if (disabled) return
    setIsOpen(true)
    fetchClients('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Display selecionado ou input de busca */}
      {selectedClient && !isOpen ? (
        <div
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 bg-background border rounded-lg text-sm cursor-pointer',
            error ? 'border-destructive' : 'border-border',
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-muted-foreground/50'
          )}
          onClick={handleOpen}
        >
          <div className="w-7 h-7 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full flex items-center justify-center text-xs font-medium shrink-0">
            {selectedClient.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{selectedClient.name}</p>
            {selectedClient.cpf_cnpj && (
              <p className="text-xs text-muted-foreground">{selectedClient.cpf_cnpj}</p>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 bg-background border rounded-lg',
            error ? 'border-destructive' : 'border-border',
            isOpen && 'ring-2 ring-primary border-transparent',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onClick={handleOpen}
        >
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onFocus={() => setIsOpen(true)}
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {loading && clients.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Buscando clientes...
              </div>
            ) : clients.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                <User className="h-5 w-5 mx-auto mb-2 opacity-50" />
                {search ? 'Nenhum cliente encontrado' : 'Digite para buscar'}
              </div>
            ) : (
              clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelect(client)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-left transition-colors"
                >
                  <div className="w-8 h-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full flex items-center justify-center text-xs font-medium shrink-0">
                    {client.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[client.cpf_cnpj, client.email, client.phone].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Criar novo cliente */}
          {onCreateNew && (
            <div className="border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  onCreateNew()
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-accent transition-colors"
              >
                <Plus className="h-4 w-4" />
                Cadastrar novo cliente
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
