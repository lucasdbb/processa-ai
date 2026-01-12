import { API_URL, fetchWithCredentials } from '@/lib/fetch'

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

const userRoleValues = ['user', 'author', 'admin', 'premium'] as const

const isUserRole = (value: unknown): value is UserListItem['role'] =>
  typeof value === 'string' && (userRoleValues as readonly string[]).includes(value)

const toStringOrEmpty = (value: unknown): string => (typeof value === 'string' ? value : '')

const toStringOrNull = (value: unknown): string | null =>
  typeof value === 'string' ? value : null

const toBoolean = (value: unknown): boolean => (typeof value === 'boolean' ? value : false)

const toUserId = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''

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

export interface AdminMaterialListItem {
  id: string
  slug: string
  title: string
  description?: string | null
  group: string
  storage_bucket: string
  storage_path: string
  filename: string
  mime_type: 'pdf' | 'xls' | 'xlsx' | 'xlsm' | 'docx' | 'csv'
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface BlogPostDetail {
  id: string
  title: string
  slug: string
  excerpt?: string
  content: string
  cover_image_url?: string
  category_id?: string
  category_slug?: string
  tags?: string[]
  published_at?: string
  authors: Array<{
    id: string
    name?: string
  }>
}

export interface CreatePostRequest {
  title: string
  excerpt?: string
  content: string
  cover_image_url?: string
  category?: string
  tags?: string[]
}

export interface UpdatePostRequest {
  title?: string
  excerpt?: string
  content?: string
  cover_image_url?: string
  category?: string
  tags?: string[]
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

    const response = await fetchWithCredentials(`${API_URL}/blog/admin/posts?${params.toString()}`)

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
    const response = await fetchWithCredentials(`${API_URL}/blog/posts/${postId}/publish`, {
      method: 'PATCH',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao publicar post')
    }

    return response.json()
  }

  async restorePostToDraft(postId: string): Promise<{ id: string; status: string }> {
    const response = await fetchWithCredentials(`${API_URL}/blog/posts/${postId}/restore`, {
      method: 'PATCH',
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
    const response = await fetchWithCredentials(`${API_URL}/blog/posts/${postId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao arquivar post')
    }

    return response.json()
  }

  /**
   * Get post details (admin only)
   */
  async getPost(postId: string): Promise<BlogPostDetail> {
    const response = await fetchWithCredentials(`${API_URL}/blog/admin/posts/${postId}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao buscar post')
    }

    return response.json()
  }

  /**
   * Create new post (draft)
   */
  async createPost(data: CreatePostRequest): Promise<{ id: string; slug: string }> {
    const response = await fetchWithCredentials(`${API_URL}/blog/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao criar post')
    }

    return response.json()
  }

  /**
   * Update post
   */
  async updatePost(postId: string, data: UpdatePostRequest): Promise<{ id: string }> {
    const response = await fetchWithCredentials(`${API_URL}/blog/posts/${postId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao atualizar post')
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

    const url = `${API_URL}/users${params.toString() ? `?${params.toString()}` : ''}`
    const response = await fetchWithCredentials(url)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erro ao listar usuários')
    }

    const raw = await response.json()
    const users: UserListItem[] = (Array.isArray(raw) ? raw : []).map((p) => {
      const record = typeof p === 'object' && p !== null ? (p as Record<string, unknown>) : {}
      const name =
        typeof record.name === 'string'
          ? record.name
          : typeof record.full_name === 'string'
            ? record.full_name
            : ''

      return {
        id: toUserId(record.id),
        email: toStringOrEmpty(record.email),
        name,
        role: isUserRole(record.role) ? record.role : 'user',
        status: toStringOrEmpty(record.status) || 'active',
        avatar_url: toStringOrNull(record.avatar_url),
        document_type: toStringOrNull(record.document_type),
        document_number: toStringOrNull(record.document_number),
        phone: toStringOrNull(record.phone),
        email_verified: toBoolean(record.email_verified),
        created_at:
          typeof record.created_at === 'string' ? record.created_at : new Date().toISOString(),
        last_sign_in_at: toStringOrNull(record.last_sign_in_at),
      }
    })

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
    const response = await fetchWithCredentials(`${API_URL}/users/update-role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, role }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erro ao atualizar role')
    }

    return response.json()
  }

  async listMaterials(): Promise<AdminMaterialListItem[]> {
    const response = await fetchWithCredentials(`${API_URL}/materials/admin/list`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao listar materiais')
    }

    const raw = (await response.json()) as unknown
    const items = Array.isArray(raw) ? raw : []
    const allowedMime = ['pdf', 'xls', 'xlsx', 'xlsm', 'docx', 'csv'] as const
    const isAllowedMime = (value: unknown): value is AdminMaterialListItem['mime_type'] =>
      typeof value === 'string' && (allowedMime as readonly string[]).includes(value)

    return items.map((m) => {
      const record = typeof m === 'object' && m !== null ? (m as Record<string, unknown>) : {}
      return {
        id: toStringOrEmpty(record.id),
        slug: toStringOrEmpty(record.slug),
        title: toStringOrEmpty(record.title),
        description: toStringOrNull(record.description),
        group: toStringOrEmpty(record.group),
        storage_bucket: toStringOrEmpty(record.storage_bucket) || 'materials',
        storage_path: toStringOrEmpty(record.storage_path),
        filename: toStringOrEmpty(record.filename),
        mime_type: isAllowedMime(record.mime_type) ? record.mime_type : 'pdf',
        is_published: toBoolean(record.is_published),
        created_at:
          typeof record.created_at === 'string' ? record.created_at : new Date().toISOString(),
        updated_at:
          typeof record.updated_at === 'string' ? record.updated_at : new Date().toISOString(),
      }
    })
  }

  async createMaterial(formData: FormData): Promise<AdminMaterialListItem> {
    const response = await fetchWithCredentials(`${API_URL}/materials/admin`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao criar material')
    }

    return response.json()
  }

  async updateMaterial(materialId: string, formData: FormData): Promise<AdminMaterialListItem> {
    const response = await fetchWithCredentials(`${API_URL}/materials/admin/${materialId}`, {
      method: 'PATCH',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao atualizar material')
    }

    return response.json()
  }

  async deleteMaterial(materialId: string): Promise<{ id: string; deleted: boolean }> {
    const response = await fetchWithCredentials(`${API_URL}/materials/admin/${materialId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao deletar material')
    }

    return response.json()
  }
}

export const adminService = new AdminService()
