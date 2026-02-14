import { create } from 'zustand'
import { creditsService, type UserCredits, type FeatureCostItem, type CreditPackage } from '@/services/credits-service'

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
}

export const useCreditsStore = create<CreditsState>((set) => ({
  credits: null,
  costs: [],
  packages: [],
  isLoading: false,
  error: null,

  fetchCredits: async () => {
    set({ isLoading: true, error: null })
    try {
      const credits = await creditsService.getCredits()
      set({ credits, isLoading: false })
    } catch (error) {
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

  reset: () => set({ credits: null, costs: [], packages: [], isLoading: false, error: null })
}))
