const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

/**
 * User list item interface
 */
export interface UserListItem {
  id: string
  email: string
  name: string
  role: 'user' | 'author' | 'admin' | 'premium'
  status: string
  avatar_url: string | null
  document_type: string | null
  document_number: string | null
  phone: string | null
  email_verified: boolean
  created_at: string
  last_sign_in_at: string | null
}

/**
 * List users response
 */
export interface ListUsersResponse {
  users: UserListItem[]
  total: number
  page: number
  limit: number
}

export interface AdminPostListItem {
  id: string
  title: string
  slug: string
  excerpt?: string
  cover_image_url?: string
  category?: string
  author?: {
    id: string
    name?: string
  }
  status: 'draft' | 'published' | 'archived'
  published_at?: string
  created_at?: string
}

export interface ListAdminPostsResponse {
  items: AdminPostListItem[]
  page: number
  page_size: number
}

/**
 * Admin service for managing users and posts
 */
class AdminService {
  /**
   * List all posts (admin only, includes drafts)
   */
  async listPosts(
    page = 1,
    pageSize = 50,
    search?: string,
    status?: string
  ): Promise<ListAdminPostsResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    })
    if (search) params.append('search', search)
    if (status && status !== 'all') params.append('status', status)

    const response = await fetch(`${API_URL}/blog/admin/posts?${params.toString()}`, {
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao listar posts')
    }

    return response.json()
  }

  /**
   * Publish post (admin only)
   */
  async publishPost(postId: string): Promise<{ id: string; status: string }> {
    const response = await fetch(`${API_URL}/blog/posts/${postId}/publish`, {
      method: 'PATCH',
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao publicar post')
    }

    return response.json()
  }

  async restorePostToDraft(postId: string): Promise<{ id: string; status: string }> {
    const response = await fetch(`${API_URL}/blog/posts/${postId}/restore`, {
      method: 'PATCH',
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao restaurar post')
    }

    return response.json()
  }

  /**
   * Delete post (admin only) - soft delete (archives)
   */
  async deletePost(postId: string): Promise<{ id: string; deleted: boolean }> {
    const response = await fetch(`${API_URL}/blog/posts/${postId}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao arquivar post')
    }

    return response.json()
  }

  /**
   * List all users (admin only)
   */
  async listUsers(
    page = 1,
    limit = 50,
    role?: 'user' | 'admin' | 'premium',
    search?: string
  ): Promise<ListUsersResponse> {
    const offset = Math.max(0, (page - 1) * limit)
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })

    if (role) params.append('role', role)
    if (search) params.append('search', search)

    const url = `${API_URL}/users/${params.toString() ? `?${params.toString()}` : ''}`
    const response = await fetch(url, {
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erro ao listar usuários')
    }

    const raw = await response.json()
    const users: UserListItem[] = (Array.isArray(raw) ? raw : []).map((p: any) => ({
      id: p.id,
      email: p.email,
      name: p.name || p.full_name || '',
      role: p.role ?? 'user',
      status: p.status || 'active',
      avatar_url: p.avatar_url ?? null,
      document_type: p.document_type ?? null,
      document_number: p.document_number ?? null,
      phone: p.phone ?? null,
      email_verified: p.email_verified ?? false,
      created_at: p.created_at,
      last_sign_in_at: p.last_sign_in_at ?? null,
    }))

    return {
      users,
      total: users.length,
      page,
      limit,
    }
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(
    userId: string,
    role: 'user' | 'author' | 'admin' | 'premium'
  ): Promise<{ message: string; user: { id: string; email: string; role: string } }> {
    const response = await fetch(`${API_URL}/users/update-role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ userId, role }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erro ao atualizar role')
    }

    return response.json()
  }
}

export const adminService = new AdminService()
