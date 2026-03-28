import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/services/dashboard-service";
import { useUser } from "@/features/auth/hooks/use-user";

export function useDashboardData() {
  const { user } = useUser();

  // We only fetch if the user is authenticated
  const enabled = !!user;

  const statsQuery = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => dashboardService.getStats(),
    enabled,
  });

  const deadlinesQuery = useQuery({
    queryKey: ["dashboard", "deadlines"],
    queryFn: () => dashboardService.getUpcomingDeadlines(5),
    enabled,
  });

  const financialQuery = useQuery({
    queryKey: ["dashboard", "financial"],
    queryFn: () => dashboardService.getFinancialStats(),
    enabled,
    retry: false, // Don't retry if financial data fails (e.g. permission issues)
  });

  const processesSummaryQuery = useQuery({
    queryKey: ["dashboard", "processes-summary"],
    queryFn: () => dashboardService.getProcessesSummary(),
    enabled,
    retry: false,
  });

  const activityQuery = useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: () => dashboardService.getRecentActivity(8),
    enabled,
    retry: false,
  });

  const briefingQuery = useQuery({
    queryKey: ["dashboard", "briefing"],
    queryFn: () => dashboardService.getDailyBriefing(),
    enabled,
    retry: false,
  });

  const loading = {
    stats: statsQuery.isLoading,
    deadlines: deadlinesQuery.isLoading,
    financial: financialQuery.isLoading,
    processesSummary: processesSummaryQuery.isLoading,
    activity: activityQuery.isLoading,
    briefing: briefingQuery.isLoading,
  };

  const errors = {
    stats: statsQuery.isError,
    deadlines: deadlinesQuery.isError,
    financial: financialQuery.isError,
    processesSummary: processesSummaryQuery.isError,
    activity: activityQuery.isError,
    briefing: briefingQuery.isError,
  };

  const refetch = {
    stats: statsQuery.refetch,
    deadlines: deadlinesQuery.refetch,
    financial: financialQuery.refetch,
    processesSummary: processesSummaryQuery.refetch,
    activity: activityQuery.refetch,
    briefing: briefingQuery.refetch,
  };

  const isLoading =
    loading.stats ||
    loading.deadlines ||
    loading.financial ||
    loading.processesSummary ||
    loading.activity ||
    loading.briefing;

  return {
    stats: statsQuery.data ?? null,
    deadlines: deadlinesQuery.data ?? [],
    financial: financialQuery.data ?? null,
    processesSummary: processesSummaryQuery.data ?? null,
    activity: activityQuery.data ?? [],
    briefing: briefingQuery.data ?? null,
    loading,
    errors,
    refetch,
    isLoading,
    isError: statsQuery.isError, // Consider stats as critical
  };
}
