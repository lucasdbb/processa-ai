import { API_URL, fetchWithCredentials } from '@/lib/fetch'

export interface CreditBreakdown {
  total: number
  used: number
  available: number
}

export interface UserCredits {
  user_id: string
  subscription: CreditBreakdown
  purchased: CreditBreakdown
  total_available: number
  last_reset_at: string | null
}

export const creditsService = {
  async getCredits(): Promise<UserCredits> {
    const res = await fetchWithCredentials(`${API_URL}/credits/balance`)
    if (!res.ok) throw new Error('Failed to get credits')
    return res.json()
  },
}
