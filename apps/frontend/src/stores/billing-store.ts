import { create } from "zustand";
import {
  billingService,
  type SubscriptionStatus,
} from "@/services/billing-service";
import { analytics } from "@/lib/analytics";

/** Data is considered fresh for 2 minutes */
const STALE_TIME_MS = 2 * 60 * 1000;

interface BillingState {
  subscription: SubscriptionStatus | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  /** Fetch subscription if stale or not yet loaded */
  fetchSubscription: () => Promise<void>;
  /** Force refetch regardless of stale time (e.g. after plan change) */
  invalidate: () => Promise<void>;
  isPro: () => boolean;
}

let fetchPromise: Promise<void> | null = null;

export const useBillingStore = create<BillingState>((set, get) => ({
  subscription: null,
  isLoading: true,
  error: null,
  lastFetchedAt: null,

  fetchSubscription: async () => {
    const state = get();

    // Skip if data is fresh
    if (
      state.lastFetchedAt &&
      Date.now() - state.lastFetchedAt < STALE_TIME_MS
    ) {
      if (state.isLoading) set({ isLoading: false });
      return;
    }

    // Single inflight request check
    if (fetchPromise) return fetchPromise;

    set({ isLoading: true, error: null });

    fetchPromise = (async () => {
      try {
        const subscription = await billingService.getSubscription();
        set({ subscription, isLoading: false, lastFetchedAt: Date.now() });

        analytics.register({
          subscription_plan: subscription.plan_id,
          subscription_status: subscription.status,
        });
      } catch (error) {
        set({ error: (error as Error).message, isLoading: false });
      } finally {
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  },

  invalidate: async () => {
    // Clear stale time to force next fetch
    set({ lastFetchedAt: null });
    // Re-fetch immediately
    return get().fetchSubscription();
  },

  isPro: () => {
    const { subscription } = get();
    if (!subscription) return false;
    return subscription.status === "active" && subscription.plan_id !== "free";
  },
}));
