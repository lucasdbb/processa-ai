import { useState, useEffect, useCallback, useRef } from 'react'
import { User, Search, X, ChevronDown } from 'lucide-react'
import { clientsService, type Client } from '@/services/clients-service'

interface ClientSelectorProps {
  value: string | null
  onChange: (clientId: string | null, clientName?: string) => void
  className?: string
  placeholder?: string
  label?: string
}

export function ClientSelector({
  value,
  onChange,
  className = '',
  placeholder = 'Selecionar cliente (opcional)',
  label,
}: ClientSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedName, setSelectedName] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load clients on first open
  const loadClients = useCallback(async (searchTerm?: string) => {
    setIsLoading(true)
    try {
      const { clients: data } = await clientsService.list({
        search: searchTerm || undefined,
        status: 'active',
        limit: 20,
      })
      setClients(data)
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Resolve selected client name on mount
  useEffect(() => {
    if (value && !selectedName) {
      clientsService.list({ limit: 100 }).then(({ clients: data }) => {
        const found = data.find((c) => c.id === value)
        if (found) setSelectedName(found.name)
      }).catch(() => {})
    }
  }, [value, selectedName])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when opening
  useEffect(() => {
    if (isOpen) {
      loadClients()
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [isOpen, loadClients])

  // Search debounce
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      loadClients(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, isOpen, loadClients])

  const handleSelect = (client: Client) => {
    onChange(client.id, client.name)
    setSelectedName(client.name)
    setIsOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    setSelectedName('')
    setSearch('')
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {label}
        </label>
      )}
      
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 border border-input rounded-lg text-sm text-left hover:bg-muted/70 transition-colors focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
      >
        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className={`flex-1 truncate ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
          {value ? selectedName : placeholder}
        </span>
        {value ? (
          <X
            className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer flex-shrink-0"
            onClick={handleClear}
          />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full pl-8 pr-3 py-1.5 bg-muted/50 border border-input rounded-md text-sm focus:ring-1 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto py-1">
            {isLoading ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : clients.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
              </div>
            ) : (
              clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelect(client)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${
                    value === client.id ? 'bg-primary/10 text-primary' : 'text-foreground'
                  }`}
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium">{client.name}</span>
                    {client.cpf_cnpj && (
                      <span className="block text-xs text-muted-foreground truncate">
                        {client.cpf_cnpj}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
