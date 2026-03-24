import { create } from 'zustand'
import { creditsService, type UserCredits, type FeatureCostItem, type CreditPackage } from '@/services/credits-service'
import { createClient } from '@/lib/supabase/client'
import { type RealtimeChannel } from '@supabase/supabase-js'

interface CreditsState {
  credits: UserCredits | null
  costs: FeatureCostItem[]
  packages: CreditPackage[]
  isLoading: boolean
  error: string | null
  
  fetchCredits: () => Promise<void>
  fetchCosts: () => Promise<void>
  fetchPackages: () => Promise<void>
  reset: () => void
  subscribeToCredits: (userId: string) => void
  unsubscribeFromCredits: () => void
}

let creditsChannel: RealtimeChannel | null = null

export const useCreditsStore = create<CreditsState>((set, get) => ({
  credits: null,
  costs: [],
  packages: [],
  isLoading: false,
  error: null,

  fetchCredits: async () => {
    const currentCredits = get().credits
    // Only set loading if we don't have credits yet (initial load)
    if (!currentCredits) {
      set({ isLoading: true, error: null })
    }
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user?.id) {
        throw new Error('User not authenticated')
      }

      const { data, error } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (error) throw error

      if (data) {
        const subscription_credits = data.subscription_credits || 0
        const purchased_credits = data.purchased_credits || 0

        const credits: UserCredits = {
          user_id: data.user_id,
          subscription_credits,
          purchased_credits,
          total_available: subscription_credits + purchased_credits,
          last_reset_at: data.last_reset_at,
        }
        set({ credits, isLoading: false })
      } else {
        // Handle case where user has no credits record yet (should be created by backend on registration, but just in case)
        set({ credits: null, isLoading: false })
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error)
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  fetchCosts: async () => {
    try {
      const costs = await creditsService.getFeatureCosts()
      set({ costs })
    } catch (error) {
      console.error('Failed to fetch costs:', error)
    }
  },

  fetchPackages: async () => {
    try {
      const packages = await creditsService.getPackages()
      set({ packages })
    } catch (error) {
      console.error('Failed to fetch packages:', error)
    }
  },

  reset: () => {
    get().unsubscribeFromCredits()
    set({ credits: null, costs: [], packages: [], isLoading: false, error: null })
  },

  subscribeToCredits: (userId: string) => {
    // If there's already a channel, unsubscribe first to avoid duplicates or stale listeners
    if (creditsChannel) {
      const supabase = createClient()
      supabase.removeChannel(creditsChannel)
      creditsChannel = null
    }

    const supabase = createClient()
    
    creditsChannel = supabase
      .channel(`credits-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
             set({ credits: null })
             return
          }

          // Update local state directly from payload to avoid extra API call
          const newRecord = payload.new as Record<string, unknown> | undefined
          
          if (newRecord) {
            const subscription_credits = Number(newRecord.subscription_credits) || 0
            const purchased_credits = Number(newRecord.purchased_credits) || 0

            const updatedCredits: UserCredits = {
              user_id: String(newRecord.user_id),
              subscription_credits,
              purchased_credits,
              total_available: subscription_credits + purchased_credits,
              last_reset_at: newRecord.last_reset_at as string | null,
            }
            
            set({ credits: updatedCredits })
          } else {
            // Fallback to fetch if payload is missing data
            get().fetchCredits()
          }
        }
      )
      .subscribe()
  },

  unsubscribeFromCredits: () => {
    if (creditsChannel) {
      const supabase = createClient()
      supabase.removeChannel(creditsChannel)
      creditsChannel = null
    }
  }
}))
