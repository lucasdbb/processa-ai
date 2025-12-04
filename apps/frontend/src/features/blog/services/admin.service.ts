const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || '').trim();
const API_URL = API_BASE_URL ? `${API_BASE_URL}/api` : '/api';

/**
 * User list item interface
 */
export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'author' | 'admin' | 'premium';
  status: string;
  avatar_url: string | null;
  document_type: string | null;
  document_number: string | null;
  phone: string | null;
  email_verified: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

/**
 * List users response
 */
export interface ListUsersResponse {
  users: UserListItem[];
  total: number;
  page: number;
  limit: number;
}

type RawProfile = {
  id: string;
  email: string;
  name?: string;
  full_name?: string; // Backward compatibility if backend sends full_name
  role?: 'user' | 'author' | 'admin' | 'premium';
  status?: string;
  avatar_url?: string | null;
  document_type?: string | null;
  document_number?: string | null;
  phone?: string | null;
  created_at: string;
  last_sign_in_at?: string | null;
  email_verified?: boolean;
};

/**
 * Update role response
 */
export interface UpdateRoleResponse {
  message: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface AdminPostListItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  cover_image_url?: string;
  category_id?: string;
  author: {
    id: string;
    name?: string;
  };
  status: 'draft' | 'published' | 'archived';
  published_at?: string;
  created_at?: string;
}

export interface ListAdminPostsResponse {
  items: AdminPostListItem[];
  page: number;
  page_size: number;
}

/**
 * Admin service for managing users and roles
 * All methods require admin authentication
 */
class AdminService {
  private listFirstPagePromise: Promise<ListUsersResponse> | null = null;
  private getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  private createHeaders(includeAuth = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = this.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * List all posts (admin only, includes drafts)
   */
  async listPosts(
    page = 1,
    pageSize = 10,
    search?: string,
    status?: string
  ): Promise<ListAdminPostsResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    if (search) params.append('search', search);
    if (status && status !== 'all') params.append('status', status);

    const response = await fetch(`${API_URL}/blog/admin/posts?${params.toString()}`, {
      method: 'GET',
      headers: this.createHeaders(true),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erro ao listar posts');
    }

    return response.json();
  }

  /**
   * Publish post (admin only)
   */
  async publishPost(postId: string): Promise<{ id: string; status: string }> {
    const response = await fetch(`${API_URL}/blog/posts/${postId}/publish`, {
      method: 'PATCH',
      headers: this.createHeaders(true),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erro ao publicar post');
    }

    return response.json();
  }

  async restorePostToDraft(postId: string): Promise<{ id: string; status: string }> {
    const response = await fetch(`${API_URL}/blog/posts/${postId}/restore`, {
      method: 'PATCH',
      headers: this.createHeaders(true),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erro ao restaurar post');
    }

    return response.json();
  }

  /**
   * Delete post (admin only)
   */
  async deletePost(postId: string): Promise<{ id: string; deleted: boolean }> {
    const response = await fetch(`${API_URL}/blog/posts/${postId}`, {
      method: 'DELETE',
      headers: this.createHeaders(true),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erro ao excluir post');
    }

    return response.json();
  }

  /**
   * List all users (admin only)
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 50, max: 100)
   * @param role - Filter by role (optional)
   * @param search - Search query (optional)
   */
  async listUsers(
    page = 1,
    limit = 50,
    role?: 'user' | 'admin' | 'premium',
    search?: string
  ): Promise<ListUsersResponse> {
    if (page === 1 && !role && !search && this.listFirstPagePromise) {
      return this.listFirstPagePromise;
    }
    const offset = Math.max(0, (page - 1) * limit);
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (role) params.append('role', role);
    if (search) params.append('search', search);

    // Evitar 307 de trailing slash: backend expõe GET /users/ (com slash)
    const url = `${API_URL}/users/${params.toString() ? `?${params.toString()}` : ''}`;
    const fetchPromise = fetch(url, {
      method: 'GET',
      headers: this.createHeaders(true),
      credentials: 'include', // Incluir cookies automaticamente
    });

    if (page === 1 && !role && !search) {
      this.listFirstPagePromise = fetchPromise.then(async (response) => {
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao listar usuários');
        }
        const raw = await response.json();
        const users: UserListItem[] = (Array.isArray(raw) ? raw : []).map((p: RawProfile) => ({
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
        }));
        return { users, total: users.length, page, limit };
      });
      return this.listFirstPagePromise;
    }

    const response = await fetchPromise;
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao listar usuários');
    }

    const raw = await response.json();

    const users: UserListItem[] = (Array.isArray(raw) ? raw : []).map((p: RawProfile) => ({
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
    }));

    return {
      users,
      total: users.length,
      page,
      limit,
    };
  }

  /**
   * Update user role (admin only)
   * @param userId - User ID to update
   * @param role - New role
   */
  async updateUserRole(
    userId: string,
    role: 'user' | 'author' | 'admin' | 'premium'
  ): Promise<UpdateRoleResponse> {
    const response = await fetch(`${API_URL}/users/update-role`, {
      method: 'PATCH',
      headers: this.createHeaders(true),
      credentials: 'include', // Incluir cookies automaticamente
      body: JSON.stringify({ userId, role }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao atualizar role');
    }

    return response.json();
  }

  /**
   * Get user statistics (admin only)
   */
  async getUserStats(): Promise<{
    total: number;
    byRole: { user: number; author: number; admin: number; premium: number };
    verified: number;
    unverified: number;
    recentSignups: number; // Last 7 days
  }> {
    const allUsers: UserListItem[] = [];
    let page = 1;
    const pageLimit = 100;
    while (true) {
      const res = await this.listUsers(page, pageLimit);
      allUsers.push(...res.users);
      if (res.users.length < pageLimit) break;
      page++;
    }
    const users = allUsers;

    const stats = {
      total: users.length,
      byRole: {
        user: 0,
        author: 0,
        admin: 0,
        premium: 0,
      },
      verified: 0,
      unverified: 0,
      recentSignups: 0,
    };

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    users.forEach(user => {
      // Count by role
      stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1;

      // Count verified
      if (user.email_verified) {
        stats.verified++;
      } else {
        stats.unverified++;
      }

      // Count recent signups
      if (new Date(user.created_at) > sevenDaysAgo) {
        stats.recentSignups++;
      }
    });

    return stats;
  }
}

export const adminService = new AdminService();
