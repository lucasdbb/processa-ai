import { useQuery } from '@tanstack/react-query'
import {  dashboardService } from '@/services/dashboard-service'
import { servicesService } from '@/services/services-service'
import { useUser } from '@/features/auth/hooks/use-user'

export function useDashboardData() {
  const { user } = useUser()

  // We only fetch if the user is authenticated
  const enabled = !!user

  const statsQuery = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardService.getStats(),
    enabled,
  })

  const deadlinesQuery = useQuery({
    queryKey: ['dashboard', 'deadlines'],
    queryFn: () => dashboardService.getUpcomingDeadlines(5),
    enabled,
  })

  const financialQuery = useQuery({
    queryKey: ['dashboard', 'financial'],
    queryFn: () => dashboardService.getFinancialStats(),
    enabled,
    retry: false, // Don't retry if financial data fails (e.g. permission issues)
  })

  const processesSummaryQuery = useQuery({
    queryKey: ['dashboard', 'processes-summary'],
    queryFn: () => dashboardService.getProcessesSummary(),
    enabled,
    retry: false,
  })

  const activityQuery = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => dashboardService.getRecentActivity(8),
    enabled,
    retry: false,
  })

  const servicesCountQuery = useQuery({
    queryKey: ['dashboard', 'services-count'],
    queryFn: () => servicesService.count(),
    enabled,
    retry: false,
  })

  const briefingQuery = useQuery({
    queryKey: ['dashboard', 'briefing'],
    queryFn: () => dashboardService.getDailyBriefing(),
    enabled,
    retry: false,
  })

  const isLoading =
    statsQuery.isLoading ||
    deadlinesQuery.isLoading ||
    financialQuery.isLoading ||
    processesSummaryQuery.isLoading ||
    activityQuery.isLoading ||
    servicesCountQuery.isLoading ||
    briefingQuery.isLoading

  return {
    stats: statsQuery.data ?? null,
    deadlines: deadlinesQuery.data ?? [],
    financial: financialQuery.data ?? null,
    processesSummary: processesSummaryQuery.data ?? null,
    activity: activityQuery.data ?? [],
    servicesCount: servicesCountQuery.data?.total ?? 0,
    briefing: briefingQuery.data ?? null,
    isLoading,
    isError: statsQuery.isError, // Consider stats as critical
  }
}
