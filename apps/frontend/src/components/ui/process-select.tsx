import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, FolderKanban, X, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { processesService, type Process } from '@/services/processes-service'
import { clientsService, type Client } from '@/services/clients-service'

interface ProcessWithClient extends Process {
  client_name?: string
}

interface ProcessSelectProps {
  value?: string // process_id
  onChange: (processId: string | null, process: ProcessWithClient | null) => void
  placeholder?: string
  disabled?: boolean
  error?: string
  className?: string
  /** Processo pré-selecionado (evita fetch inicial) */
  initialProcess?: ProcessWithClient
  /** Filtrar por cliente específico */
  clientId?: string
  /** Callback para criar novo processo inline */
  onCreateNew?: () => void
}

export function ProcessSelect({
  value,
  onChange,
  placeholder = 'Buscar processo...',
  disabled = false,
  error,
  className,
  initialProcess,
  clientId,
  onCreateNew,
}: ProcessSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [processes, setProcesses] = useState<ProcessWithClient[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedProcess, setSelectedProcess] = useState<ProcessWithClient | null>(initialProcess ?? null)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Buscar processo inicial se temos value mas não initialProcess
  useEffect(() => {
    if (value && !initialProcess && !selectedProcess) {
      processesService.get(value).then(async (process) => {
        // Buscar nome do cliente
        try {
          const client = await clientsService.get(process.client_id)
          setSelectedProcess({ ...process, client_name: client.name })
        } catch {
          setSelectedProcess(process)
        }
      }).catch(() => {})
    }
  }, [value, initialProcess, selectedProcess])

  // Buscar processos com debounce
  const fetchProcesses = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const data = await processesService.list({
        search: query || undefined,
        client_id: clientId,
        status: 'active',
        limit: 10,
      })

      // Buscar nomes dos clientes
      const clientIds = [...new Set(data.processes.map(p => p.client_id))]
      const clientsMap: Record<string, Client> = {}

      await Promise.all(
        clientIds.map(async (id) => {
          try {
            clientsMap[id] = await clientsService.get(id)
          } catch {
            // Ignora erros
          }
        })
      )

      const processesWithClients: ProcessWithClient[] = data.processes.map(p => ({
        ...p,
        client_name: clientsMap[p.client_id]?.name,
      }))

      setProcesses(processesWithClients)
    } catch {
      setProcesses([])
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    if (!isOpen) return

    const timeout = setTimeout(() => {
      fetchProcesses(search)
    }, 300)

    return () => clearTimeout(timeout)
  }, [search, isOpen, fetchProcesses])

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

  const handleSelect = (process: ProcessWithClient) => {
    setSelectedProcess(process)
    onChange(process.id, process)
    setIsOpen(false)
    setSearch('')
  }

  const handleClear = () => {
    setSelectedProcess(null)
    onChange(null, null)
    setSearch('')
  }

  const handleOpen = () => {
    if (disabled) return
    setIsOpen(true)
    fetchProcesses('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Display selecionado ou input de busca */}
      {selectedProcess && !isOpen ? (
        <div
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 bg-background border rounded-lg text-sm cursor-pointer',
            error ? 'border-destructive' : 'border-border',
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-muted-foreground/50'
          )}
          onClick={handleOpen}
        >
          <div className="p-1.5 bg-muted rounded shrink-0">
            <FolderKanban className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-sm font-medium text-foreground truncate">
              {selectedProcess.process_number}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {selectedProcess.type}
              {selectedProcess.client_name && ` • ${selectedProcess.client_name}`}
            </p>
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
            {loading && processes.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Buscando processos...
              </div>
            ) : processes.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                <FolderKanban className="h-5 w-5 mx-auto mb-2 opacity-50" />
                {search ? 'Nenhum processo encontrado' : 'Digite para buscar'}
              </div>
            ) : (
              processes.map((process) => (
                <button
                  key={process.id}
                  type="button"
                  onClick={() => handleSelect(process)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-left transition-colors"
                >
                  <div className="p-1.5 bg-muted rounded shrink-0">
                    <FolderKanban className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-medium text-foreground truncate">
                      {process.process_number}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {process.type}
                      {process.client_name && ` • ${process.client_name}`}
                      {process.court && ` • ${process.court}`}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Criar novo processo */}
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
                Cadastrar novo processo
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}
