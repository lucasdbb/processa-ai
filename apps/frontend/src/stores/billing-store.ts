import { create } from 'zustand'
import { billingService, type SubscriptionStatus } from '@/services/billing-service'
import { analytics } from '@/lib/analytics'

/** Data is considered fresh for 2 minutes */
const STALE_TIME_MS = 2 * 60 * 1000

interface BillingState {
  subscription: SubscriptionStatus | null
  isLoading: boolean
  error: string | null
  lastFetchedAt: number | null

  /** Fetch subscription if stale or not yet loaded */
  fetchSubscription: () => Promise<void>
  /** Force refetch regardless of stale time (e.g. after plan change) */
  invalidate: () => Promise<void>
  isPro: () => boolean
}

export const useBillingStore = create<BillingState>((set, get) => ({
  subscription: null,
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  fetchSubscription: async () => {
    const state = get()
    if (state.isLoading) return

    // Skip if data is fresh
    if (state.lastFetchedAt && Date.now() - state.lastFetchedAt < STALE_TIME_MS) {
      return
    }

    set({ isLoading: true, error: null })
    try {
      const subscription = await billingService.getSubscription()
      set({ subscription, isLoading: false, lastFetchedAt: Date.now() })

      analytics.register({
        subscription_plan: subscription.plan_id,
        subscription_status: subscription.status,
      })
    } catch (error) {
      console.error('Failed to fetch subscription:', error)
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  invalidate: async () => {
    // Clear stale time to force next fetch
    set({ lastFetchedAt: null })
    // Re-fetch immediately
    const state = get()
    if (state.isLoading) return

    set({ isLoading: true, error: null })
    try {
      const subscription = await billingService.getSubscription()
      set({ subscription, isLoading: false, lastFetchedAt: Date.now() })

      analytics.register({
        subscription_plan: subscription.plan_id,
        subscription_status: subscription.status,
      })
    } catch (error) {
      console.error('Failed to fetch subscription:', error)
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  isPro: () => {
    const { subscription } = get()
    if (!subscription) return false
    return subscription.status === 'active' && subscription.plan_id !== 'free'
  }
}))
