import { useQuery } from '@tanstack/react-query'
import { clientsService, type ClientListParams } from '@/services/clients-service'
import { useUser } from '@/features/auth/hooks/use-user'

export function useClients(params: ClientListParams) {
  const { user } = useUser()
  const enabled = !!user

  return useQuery({
    queryKey: ['clients', 'list', params],
    queryFn: () => clientsService.list(params),
    enabled,
    placeholderData: (previousData) => previousData,
  })
}

export function useClientDetail(id: string) {
  const { user } = useUser()
  const enabled = !!user && !!id

  return useQuery({
    queryKey: ['clients', 'detail', id],
    queryFn: () => clientsService.getDetail(id),
    enabled,
  })
}
