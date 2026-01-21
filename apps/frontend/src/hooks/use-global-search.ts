import { useMemo } from 'react'
import { Users, FolderKanban, Calculator } from 'lucide-react'
import { mockClients } from '@/pages/app/clientes'
import { mockProcesses } from '@/pages/app/processos'

export interface SearchResult {
  id: string
  type: 'client' | 'process' | 'calculation'
  title: string
  subtitle?: string
  icon: typeof Users
  href: string
}

export interface GroupedSearchResults {
  clients: SearchResult[]
  processes: SearchResult[]
  calculations: SearchResult[]
}

const calculators = [
  {
    id: 'rescisao',
    name: 'Rescisao Trabalhista',
    category: 'Trabalhista',
    href: '/app/calculadoras/rescisao',
  },
  {
    id: 'aposentadoria',
    name: 'Aposentadoria',
    category: 'Previdenciario',
    href: '/app/calculadoras/aposentadoria',
  },
]

export function useGlobalSearch(query: string): GroupedSearchResults {
  return useMemo(() => {
    // Return empty if query is too short
    if (!query || query.trim().length < 1) {
      return { clients: [], processes: [], calculations: [] }
    }

    const searchTerm = query.toLowerCase().trim()

    // Search clients
    const clients = mockClients
      .filter((client) => {
        return (
          client.name.toLowerCase().includes(searchTerm) ||
          client.cpf.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, '')) ||
          client.email.toLowerCase().includes(searchTerm)
        )
      })
      .slice(0, 5) // Limit to 5 results
      .map((client) => ({
        id: client.id,
        type: 'client' as const,
        title: client.name,
        subtitle: client.cpf,
        icon: Users,
        href: '/app/clientes',
      }))

    // Search processes
    const processes = mockProcesses
      .filter((process) => {
        return (
          process.number.toLowerCase().includes(searchTerm) ||
          process.type.toLowerCase().includes(searchTerm) ||
          process.client.toLowerCase().includes(searchTerm) ||
          process.defendant.toLowerCase().includes(searchTerm)
        )
      })
      .slice(0, 5) // Limit to 5 results
      .map((process) => ({
        id: process.id,
        type: 'process' as const,
        title: process.number,
        subtitle: `${process.client} vs ${process.defendant}`,
        icon: FolderKanban,
        href: '/app/processos',
      }))

    // Search calculations
    const calculations = calculators
      .filter((calc) => {
        return (
          calc.name.toLowerCase().includes(searchTerm) ||
          calc.category.toLowerCase().includes(searchTerm)
        )
      })
      .map((calc) => ({
        id: calc.id,
        type: 'calculation' as const,
        title: calc.name,
        subtitle: calc.category,
        icon: Calculator,
        href: calc.href,
      }))

    return { clients, processes, calculations }
  }, [query])
}
