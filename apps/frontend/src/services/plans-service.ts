import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export type ApiPlanPrice = {
  currency: string;
  amount_cents: number;
  interval: string;
  stripe_price_id?: string;
};

export type ApiPlan = {
  slug: string;
  name: string;
  description: string | null;
  is_popular: boolean;
  is_visible: boolean;
  is_sellable: boolean;
  sort_order: number;
  price: ApiPlanPrice | null;
  features: string[];
};

export const plansQueryKey = ["plans"] as const;

export async function fetchPlans(): Promise<ApiPlan[]> {
  try {
    const res = await fetchWithCredentials(`${API_URL}/plans`, {
      method: "GET",
    });
    if (!res.ok) {
      const errorData = await res
        .json()
        .catch(() => ({ detail: "Unknown error" }));
      console.error("Error loading plans:", errorData);
      return [];
    }

    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as ApiPlan[]) : [];
  } catch (error) {
    console.error("Failed to load plans:", error);
    return [];
  }
}
