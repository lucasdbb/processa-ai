import { API_URL, fetchWithCredentials } from '@/lib/fetch'

export interface NotificationCreate {
  type: 'system' | 'blog' | 'feature' | 'deadline' | 'process' | 'calculation'
  title: string
  description?: string
  metadata?: Record<string, unknown>
  user_id?: string // Se não especificado, envia para todos
}

export interface NotificationItem {
  id: string
  user_id: string
  type: string
  title: string
  description?: string
  metadata?: Record<string, unknown>
  read: boolean
  read_at?: string
  created_at: string
  updated_at: string
}

export interface NotificationListResponse {
  items: NotificationItem[]
  total: number
  unread_count: number
}

export interface NotificationStatsResponse {
  total_sent: number
  total_read: number
  total_unread: number
}

export const notificationService = {
  // User endpoints
  async list(unreadOnly = false): Promise<NotificationListResponse> {
    const params = new URLSearchParams()
    if (unreadOnly) params.append('unread_only', 'true')

    const res = await fetchWithCredentials(
      `${API_URL}/notifications?${params.toString()}`
    )
    if (!res.ok) throw new Error('Failed to fetch notifications')
    return res.json()
  },

  async markAsRead(notificationId: string): Promise<NotificationItem> {
    const res = await fetchWithCredentials(
      `${API_URL}/notifications/${notificationId}/read`,
      {
        method: 'PATCH',
      }
    )
    if (!res.ok) throw new Error('Failed to mark notification as read')
    return res.json()
  },

  async markAllAsRead(): Promise<{ updated: number }> {
    const res = await fetchWithCredentials(
      `${API_URL}/notifications/read-all`,
      {
        method: 'PATCH',
      }
    )
    if (!res.ok) throw new Error('Failed to mark all notifications as read')
    return res.json()
  },

  async delete(notificationId: string): Promise<void> {
    const res = await fetchWithCredentials(
      `${API_URL}/notifications/${notificationId}`,
      {
        method: 'DELETE',
      }
    )
    if (!res.ok) throw new Error('Failed to delete notification')
  },

  // Admin endpoints
  async create(data: NotificationCreate): Promise<{ created: number; recipients: string[] }> {
    const res = await fetchWithCredentials(`${API_URL}/notifications/admin/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create notification')
    return res.json()
  },

  async getStats(): Promise<NotificationStatsResponse> {
    const res = await fetchWithCredentials(
      `${API_URL}/notifications/admin/notifications/stats`
    )
    if (!res.ok) throw new Error('Failed to fetch notification stats')
    return res.json()
  },

  async listAll(
    page = 1,
    pageSize = 50
  ): Promise<NotificationListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    })

    const res = await fetchWithCredentials(
      `${API_URL}/notifications/admin/notifications?${params.toString()}`
    )
    if (!res.ok) throw new Error('Failed to fetch all notifications')
    return res.json()
  },
}
