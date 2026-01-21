import { useMemo } from 'react'
import { Users, FolderKanban, Calculator } from 'lucide-react'

export const mockClients = [
  {
    id: '1',
    name: 'Joao Silva',
    cpf: '123.456.789-00',
    phone: '(11) 99999-0000',
    email: 'joao@email.com',
    processes: 2,
    calculations: 5,
    status: 'active' as const,
    lastActivity: 'ha 2 dias',
  },
  {
    id: '2',
    name: 'Maria Oliveira',
    cpf: '987.654.321-00',
    phone: '(11) 98888-0000',
    email: 'maria@email.com',
    processes: 1,
    calculations: 3,
    status: 'active' as const,
    lastActivity: 'ha 1 semana',
  },
  {
    id: '3',
    name: 'Carlos Santos',
    cpf: '111.222.333-00',
    phone: '(11) 97777-0000',
    email: 'carlos@email.com',
    processes: 1,
    calculations: 2,
    status: 'archived' as const,
    lastActivity: 'ha 1 mes',
  },
]

export const mockProcesses = [
  {
    id: '1',
    number: '0001234-12.2025.5.02.0001',
    type: 'Reclamacao Trabalhista',
    court: '2a Vara do Trabalho de Sao Paulo',
    client: 'Joao Silva',
    defendant: 'Empresa ABC Ltda',
    value: 45000,
    status: 'active' as const,
    nextDeadline: '3 dias',
  },
  {
    id: '2',
    number: '0005678-34.2025.5.02.0002',
    type: 'Recurso Ordinario',
    court: 'TRT 2a Regiao',
    client: 'Maria Oliveira',
    defendant: 'Empresa XYZ S.A.',
    value: 120000,
    status: 'active' as const,
    nextDeadline: '7 dias',
  },
  {
    id: '3',
    number: '1000567-89.2024.8.26.0100',
    type: 'Acao de Cobranca',
    court: '5a Vara Civel de Sao Paulo',
    client: 'Carlos Santos',
    defendant: 'Empresa DEF Ltda',
    value: 35000,
    status: 'archived' as const,
    nextDeadline: null,
  },
]

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
