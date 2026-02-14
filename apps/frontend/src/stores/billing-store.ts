import { create } from 'zustand'
import { billingService, type SubscriptionStatus } from '@/services/billing-service'

interface BillingState {
  subscription: SubscriptionStatus | null
  isLoading: boolean
  error: string | null
  
  fetchSubscription: () => Promise<void>
  isPro: () => boolean
}

export const useBillingStore = create<BillingState>((set, get) => ({
  subscription: null,
  isLoading: false,
  error: null,

  fetchSubscription: async () => {
    // Avoid fetching if already loading or recently fetched (simple cache)
    if (get().isLoading) return

    set({ isLoading: true, error: null })
    try {
      const subscription = await billingService.getSubscription()
      set({ subscription, isLoading: false })
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
