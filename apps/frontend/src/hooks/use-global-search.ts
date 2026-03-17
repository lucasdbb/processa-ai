import { useMemo, useState, useEffect } from 'react'
import { Users, FolderKanban, Calculator, Bot, Briefcase } from 'lucide-react'
import { useAiTools } from '@/features/ai/context'
import { useCalculators } from '@/features/calculators/context'
import { clientsService } from '@/services/clients-service'
import { processesService } from '@/services/processes-service'
import { servicesService } from '@/services/services-service'
import { useDebounce } from '@/hooks/use-debounce'

export interface SearchResult {
  id: string
  type: 'client' | 'process' | 'calculation' | 'ai_tool' | 'service'
  title: string
  subtitle?: string
  icon: typeof Users
  href: string
}

export interface GroupedSearchResults {
  clients: SearchResult[]
  processes: SearchResult[]
  calculations: SearchResult[]
  ai_tools: SearchResult[]
  services: SearchResult[]
}

export function useGlobalSearch(query: string): GroupedSearchResults {
  const { tools: aiTools } = useAiTools()
  const { calculators } = useCalculators()
  const debouncedQuery = useDebounce(query, 300)
  
  const [clients, setClients] = useState<SearchResult[]>([])
  const [processes, setProcesses] = useState<SearchResult[]>([])
  const [services, setServices] = useState<SearchResult[]>([])

  useEffect(() => {
    async function fetchResults() {
      if (!debouncedQuery || debouncedQuery.trim().length < 2) {
        setClients([])
        setProcesses([])
        setServices([])
        return
      }

      try {
        const [clientsRes, processesRes, servicesRes] = await Promise.all([
          clientsService.list({ search: debouncedQuery, limit: 5 }),
          processesService.list({ search: debouncedQuery, limit: 5 }),
          servicesService.list({ search: debouncedQuery }),
        ])

        setClients(
          clientsRes.clients.map((client) => ({
            id: client.id,
            type: 'client' as const,
            title: client.name,
            subtitle: client.cpf_cnpj || client.email || undefined,
            icon: Users,
            href: `/app/clientes/${client.id}`,
          }))
        )

        setProcesses(
          processesRes.processes.map((process) => ({
            id: process.id,
            type: 'process' as const,
            title: process.process_number || `Processo sem número`,
            subtitle: `${process.type} ${process.client_name ? `• ${process.client_name}` : ''}`,
            icon: FolderKanban,
            href: `/app/processos/${process.id}`,
          }))
        )

        setServices(
            servicesRes.services.slice(0, 5).map((service) => ({
              id: service.id,
              type: 'service' as const,
              title: service.name,
              subtitle: `${service.category} ${service.client_name ? `• ${service.client_name}` : ''}`,
              icon: Briefcase,
              href: `/app/servicos/${service.id}`,
            }))
          )

      } catch (error) {
        console.error('Error fetching global search results:', error)
      }
    }

    fetchResults()
  }, [debouncedQuery])

  return useMemo(() => {
    // Return empty if query is too short
    if (!query || query.trim().length < 1) {
      return { clients: [], processes: [], calculations: [], ai_tools: [], services: [] }
    }

    const searchTerm = query.toLowerCase().trim()

    // Search calculations (Client-side filtering as we have all of them in context)
      const calculationsResults = calculators
        .filter((calc) => {
          return (
            !calc.locked && (
              calc.name.toLowerCase().includes(searchTerm) ||
              calc.description.toLowerCase().includes(searchTerm)
            )
          )
        })
        .map((calc) => ({
          id: calc.slug,
          type: 'calculation' as const,
          title: calc.name,
          subtitle: calc.description,
          icon: Calculator,
          href: calc.path,
        }))
  
      // Search AI Tools (Client-side filtering)
      const aiResults = aiTools
        .filter((tool) => {
          return (
            !tool.locked && (
              tool.name.toLowerCase().includes(searchTerm) ||
              tool.description.toLowerCase().includes(searchTerm)
            )
          )
        })
        .map((tool) => ({
          id: tool.slug,
          type: 'ai_tool' as const,
          title: tool.name,
          subtitle: tool.description,
          icon: Bot,
          href: `/app/ia/${tool.slug}`,
        }))

    return { 
      clients, 
      processes, 
      calculations: calculationsResults, 
      ai_tools: aiResults,
      services
    }
  }, [query, calculators, aiTools, clients, processes, services])
}
