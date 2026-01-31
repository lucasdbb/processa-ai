import { API_URL, fetchWithCredentials } from '@/lib/fetch'

export interface UserCredits {
  user_id: string
  total_credits: number
  used_credits: number
  available_credits: number
  last_reset_at: string | null
  created_at: string
  updated_at: string
}

export const creditsService = {
  async getCredits(): Promise<UserCredits> {
    const res = await fetchWithCredentials(`${API_URL}/credits/balance`)
    if (!res.ok) throw new Error('Failed to get credits')
    return res.json()
  },
}
