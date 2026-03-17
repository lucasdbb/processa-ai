import { useQuery } from '@tanstack/react-query'
import { processesService, type ProcessListParams } from '@/services/processes-service'
import { useUser } from '@/features/auth/hooks/use-user'

export function useProcesses(params: ProcessListParams) {
  const { user } = useUser()
  const enabled = !!user

  return useQuery({
    queryKey: ['processes', 'list', params],
    queryFn: () => processesService.list(params),
    enabled,
    // Keep previous data while fetching new filters to avoid layout thrashing
    placeholderData: (previousData) => previousData,
  })
}

export function useProcessDetail(id: string) {
  const { user } = useUser()
  const enabled = !!user && !!id

  return useQuery({
    queryKey: ['processes', 'detail', id],
    queryFn: () => processesService.getDetail(id),
    enabled,
  })
}
