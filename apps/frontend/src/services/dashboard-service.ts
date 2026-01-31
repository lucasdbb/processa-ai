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
};
