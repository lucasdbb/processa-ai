import { API_URL, fetchWithCredentials } from '@/lib/fetch'

export interface FeedbackCreate {
  type: 'suggestion' | 'bug' | 'other'
  content: string
  path?: string
  user_agent?: string
}

export interface FeedbackUpdate {
  status: 'new' | 'in_progress' | 'done' | 'archived'
}

export interface FeedbackResponse {
  id: string
  user_id?: string
  type: 'suggestion' | 'bug' | 'other'
  content: string
  path?: string
  user_agent?: string
  status: 'new' | 'in_progress' | 'done' | 'archived'
  created_at: string
  updated_at: string
  user_email?: string
  user_name?: string
}

export interface FeedbackListResponse {
  items: FeedbackResponse[]
  total: number
}

export const feedbackService = {
  async create(data: FeedbackCreate): Promise<FeedbackResponse> {
    const res = await fetchWithCredentials(`${API_URL}/feedback/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to send feedback')
    return res.json()
  },

  async getAll(limit = 10, offset = 0, status?: string, sortOrder: 'asc' | 'desc' = 'desc'): Promise<FeedbackListResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      sort_order: sortOrder,
    })
    
    if (status && status !== 'all') {
      params.append('status', status)
    }

    const res = await fetchWithCredentials(`${API_URL}/feedback/?${params.toString()}`)
    if (!res.ok) throw new Error('Failed to fetch feedback')
    return res.json()
  },
  
  async update(id: string, data: FeedbackUpdate): Promise<FeedbackResponse> {
    const res = await fetchWithCredentials(`${API_URL}/feedback/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update feedback')
    return res.json()
  },
  
  async delete(id: string): Promise<void> {
    const res = await fetchWithCredentials(`${API_URL}/feedback/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error('Failed to delete feedback')
  }
}
