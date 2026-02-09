import { useCallback, useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CalendarClock,
  Calculator,
  Bot,
  FileText,
  BookOpen,
  Settings,
  Plus,
  Search,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCommandPaletteStore } from '@/stores/command-palette-store'
import { useGlobalSearch, type SearchResult } from '@/hooks/use-global-search'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  name: string
  description?: string
  icon: typeof LayoutDashboard
  action: () => void
  category: 'navigation' | 'action' | 'recent'
}

export function CommandPalette() {
  const { isOpen, close } = useCommandPaletteStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchResults = useGlobalSearch(search)

  const closeAndReset = useCallback(() => {
    close()
    setSearch('')
    setSelectedIndex(0)
  }, [close])

  const allCommands: CommandItem[] = useMemo(
    () => [
      // Acoes rapidas
      {
        id: 'new-client',
        name: 'Novo cliente',
        description: 'Cadastrar um novo cliente',
        icon: Plus,
        category: 'action',
        action: () => {
          navigate('/app/clientes?new=true')
          closeAndReset()
        },
      },
      {
        id: 'new-process',
        name: 'Novo processo',
        description: 'Cadastrar um novo processo',
        icon: Plus,
        category: 'action',
        action: () => {
          navigate('/app/processos?new=true')
          closeAndReset()
        },
      },
      {
        id: 'open-calculator',
        name: 'Abrir calculadora',
        description: 'Acessar calculadoras juridicas',
        icon: Calculator,
        category: 'action',
        action: () => {
          navigate('/app/calculadoras')
          closeAndReset()
        },
      },
      {
        id: 'open-ai',
        name: 'Abrir IA',
        description: 'Acessar ferramentas de IA',
        icon: Bot,
        category: 'action',
        action: () => {
          navigate('/app/ia')
          closeAndReset()
        },
      },

      // Navegacao
      {
        id: 'go-dashboard',
        name: 'Dashboard',
        description: 'Ir para o dashboard',
        icon: LayoutDashboard,
        category: 'navigation',
        action: () => {
          navigate('/app')
          closeAndReset()
        },
      },
      {
        id: 'go-clients',
        name: 'Clientes',
        description: 'Gerenciar clientes',
        icon: Users,
        category: 'navigation',
        action: () => {
          navigate('/app/clientes')
          closeAndReset()
        },
      },
      {
        id: 'go-processes',
        name: 'Processos',
        description: 'Gerenciar processos',
        icon: FolderKanban,
        category: 'navigation',
        action: () => {
          navigate('/app/processos')
          closeAndReset()
        },
      },
      {
        id: 'go-calendar',
        name: 'Calendário',
        description: 'Ver calendario e prazos',
        icon: CalendarClock,
        category: 'navigation',
        action: () => {
          navigate('/app/calendario')
          closeAndReset()
        },
      },
      {
        id: 'go-calculators',
        name: 'Calculadoras',
        description: 'Calculadoras juridicas',
        icon: Calculator,
        category: 'navigation',
        action: () => {
          navigate('/app/calculadoras')
          closeAndReset()
        },
      },
      {
        id: 'go-ai',
        name: 'IA Juridica',
        description: 'Ferramentas de inteligencia artificial',
        icon: Bot,
        category: 'navigation',
        action: () => {
          navigate('/app/ia')
          closeAndReset()
        },
      },
      {
        id: 'go-documents',
        name: 'Documentos',
        description: 'Meus documentos gerados',
        icon: FileText,
        category: 'navigation',
        action: () => {
          navigate('/app/documentos')
          closeAndReset()
        },
      },
      {
        id: 'go-materials',
        name: 'Materiais',
        description: 'Downloads disponiveis',
        icon: BookOpen,
        category: 'navigation',
        action: () => {
          navigate('/app/materiais')
          closeAndReset()
        },
      },
      {
        id: 'go-settings',
        name: 'Configuracoes',
        description: 'Preferencias da conta',
        icon: Settings,
        category: 'navigation',
        action: () => {
          navigate('/app/configuracoes')
          closeAndReset()
        },
      },
    ],
    [navigate, closeAndReset]
  )

  const filteredCommands = useMemo(() => {
    if (!search.trim()) return allCommands

    const query = search.toLowerCase()
    return allCommands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(query) ||
        cmd.description?.toLowerCase().includes(query)
    )
  }, [search, allCommands])

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      action: [],
      navigation: [],
      recent: [],
    }

    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd)
    })

    return groups
  }, [filteredCommands])

  // Flatten search results for navigation
  const flatSearchResults = useMemo(() => {
    return [
      ...searchResults.clients,
      ...searchResults.processes,
      ...searchResults.calculations,
    ]
  }, [searchResults])

  // Total items for keyboard navigation
  const totalItems = useMemo(() => {
    return flatSearchResults.length + filteredCommands.length
  }, [flatSearchResults.length, filteredCommands.length])

  // Has search results
  const hasSearchResults = useMemo(() => {
    return (
      searchResults.clients.length > 0 ||
      searchResults.processes.length > 0 ||
      searchResults.calculations.length > 0
    )
  }, [searchResults])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => (i + 1) % totalItems)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => (i - 1 + totalItems) % totalItems)
          break
        case 'Enter':
          e.preventDefault()
          // Check if selecting a search result
          if (selectedIndex < flatSearchResults.length) {
            const result = flatSearchResults[selectedIndex]
            navigate(result.href)
            closeAndReset()
          } else {
            // Selecting a command
            const commandIndex = selectedIndex - flatSearchResults.length
            if (filteredCommands[commandIndex]) {
              filteredCommands[commandIndex].action()
            }
          }
          break
        case 'Escape':
          e.preventDefault()
          closeAndReset()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, totalItems, flatSearchResults, filteredCommands, selectedIndex, closeAndReset, navigate])

  const renderGroup = (title: string, items: CommandItem[], startIndex: number) => {
    if (items.length === 0) return null

    return (
      <div className="py-2">
        <div className="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </div>
        {items.map((item, idx) => {
          const globalIndex = startIndex + idx
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={item.action}
              onMouseEnter={() => setSelectedIndex(globalIndex)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-colors',
                globalIndex === selectedIndex
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.name}</div>
                {item.description && (
                  <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  const renderSearchGroup = (title: string, items: SearchResult[], startIndex: number) => {
    if (items.length === 0) return null

    return (
      <div className="py-2">
        <div className="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title} ({items.length})
        </div>
        {items.map((item, idx) => {
          const globalIndex = startIndex + idx
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={() => {
                navigate(item.href)
                closeAndReset()
              }}
              onMouseEnter={() => setSelectedIndex(globalIndex)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-colors',
                globalIndex === selectedIndex
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.title}</div>
                {item.subtitle && (
                  <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  // Calculate indices for keyboard navigation
  let currentIndex = 0

  // Search results come first
  const clientsStartIndex = currentIndex
  currentIndex += searchResults.clients.length
  const processesStartIndex = currentIndex
  currentIndex += searchResults.processes.length
  const calculationsStartIndex = currentIndex
  currentIndex += searchResults.calculations.length

  // Then commands
  const actionStartIndex = currentIndex
  currentIndex += groupedCommands.action.length
  const navigationStartIndex = currentIndex

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAndReset()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Paleta de comandos</DialogTitle>
        </DialogHeader>
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Buscar clientes, processos, cálculos ou digite um comando"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto px-2 py-1">
          {!hasSearchResults && filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado
            </div>
          ) : (
            <>
              {/* Search Results */}
              {renderSearchGroup('Clientes', searchResults.clients, clientsStartIndex)}
              {renderSearchGroup('Processos', searchResults.processes, processesStartIndex)}
              {renderSearchGroup('Calculos', searchResults.calculations, calculationsStartIndex)}

              {/* Separator if both search results and commands exist */}
              {hasSearchResults && filteredCommands.length > 0 && (
                <div className="px-3 py-2">
                  <div className="border-t border-border" />
                </div>
              )}

              {/* Commands */}
              {renderGroup('Acoes Rapidas', groupedCommands.action, actionStartIndex)}
              {renderGroup('Navegacao', groupedCommands.navigation, navigationStartIndex)}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-background">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-background">↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-background">Enter</kbd>
              selecionar
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-border bg-background">Esc</kbd>
            fechar
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
