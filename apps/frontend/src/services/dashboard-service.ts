import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export interface DashboardStats {
  total_clients: number;
  new_clients_this_month: number;
  active_processes: number;
  new_processes_this_month: number;
  deadlines_today: number;
  urgent_deadlines_today: number;
  calculations_this_month: number;
  calculations_change_percent: number;
  total_deadlines: number;
}

export interface UpcomingDeadline {
  id: string;
  type: string;
  title: string;
  process: string;
  client: string;
  days_left: number;
  urgent: boolean;
  due_date: string;
}

export interface MonthlyRevenue {
  month: string;
  received: number;
  pending: number;
}

export interface FeesByStatus {
  [status: string]: {
    count: number;
    total: number;
  };
}

export interface AgingReport {
  "0_30": number;
  "31_60": number;
  "61_90": number;
  "90_plus": number;
}

export interface FinancialStats {
  total_fees: number;
  total_received: number;
  total_pending: number;
  total_overdue: number;
  monthly_revenue: MonthlyRevenue[];
  by_status: FeesByStatus;
  aging: AgingReport;
}

export interface ProcessStatusItem {
  status: string;
  count: number;
  label: string;
}

export interface ProcessesSummary {
  by_status: ProcessStatusItem[];
  total: number;
}

export interface ActivityItem {
  type: string;
  description: string;
  detail: string;
  time: string;
  time_relative: string;
}

export interface AiCostTotals {
  total_jobs: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

export interface AiCostByModel {
  model: string;
  provider: string;
  job_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

export interface AiCostByEndpoint {
  endpoint_key: string;
  job_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

export interface AiCostDailyTrend {
  day: string;
  job_count: number;
  cost_usd: number;
}

export interface AiCostStats {
  all_time: AiCostTotals;
  last_30d: AiCostTotals;
  by_model: AiCostByModel[];
  by_endpoint: AiCostByEndpoint[];
  daily_trend: AiCostDailyTrend[];
}

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const res = await fetchWithCredentials(`${API_URL}/dashboard/stats`);
    if (!res.ok) throw new Error("Failed to get dashboard stats");
    return res.json();
  },

  async getUpcomingDeadlines(limit = 5): Promise<UpcomingDeadline[]> {
    const res = await fetchWithCredentials(
      `${API_URL}/dashboard/deadlines?limit=${limit}`,
    );
    if (!res.ok) throw new Error("Failed to get upcoming deadlines");
    return res.json();
  },

  async getFinancialStats(): Promise<FinancialStats> {
    const res = await fetchWithCredentials(`${API_URL}/dashboard/financial`);
    if (!res.ok) throw new Error("Failed to get financial stats");
    return res.json();
  },

  async getProcessesSummary(): Promise<ProcessesSummary> {
    const res = await fetchWithCredentials(
      `${API_URL}/dashboard/processes-summary`,
    );
    if (!res.ok) throw new Error("Failed to get processes summary");
    return res.json();
  },

  async getRecentActivity(limit = 10): Promise<ActivityItem[]> {
    const res = await fetchWithCredentials(
      `${API_URL}/dashboard/activity?limit=${limit}`,
    );
    if (!res.ok) throw new Error("Failed to get recent activity");
    return res.json();
  },

  async getAiCostStats(): Promise<AiCostStats> {
    const res = await fetchWithCredentials(`${API_URL}/dashboard/ai-costs`);
    if (!res.ok) throw new Error("Failed to get AI cost stats");
    return res.json();
  },
};
