import { useQuery } from '@tanstack/react-query'
import { servicesService, type ServicesListParams } from '@/services/services-service'
import { useUser } from '@/features/auth/hooks/use-user'

export function useServices(params?: ServicesListParams) {
  const { user } = useUser()
  const enabled = !!user

  return useQuery({
    queryKey: ['services', 'list', params],
    queryFn: () => servicesService.list(params),
    enabled,
    placeholderData: (previousData) => previousData,
  })
}

export function useServiceDetail(id: string) {
  const { user } = useUser()
  const enabled = !!user && !!id

  return useQuery({
    queryKey: ['services', 'detail', id],
    queryFn: () => servicesService.getDetail(id),
    enabled,
  })
}
