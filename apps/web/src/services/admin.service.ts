const API_URL = import.meta.env.VITE_API_URL;

/**
 * User list item interface
 */
export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'premium';
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

/**
 * Admin service for managing users and roles
 * All methods require admin authentication
 */
class AdminService {
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
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (role) params.append('role', role);
    if (search) params.append('search', search);

    const response = await fetch(`${API_URL}/api/auth/list-users?${params}`, {
      method: 'GET',
      headers: this.createHeaders(true),
      credentials: 'include', // Incluir cookies automaticamente
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao listar usuários');
    }

    return response.json();
  }

  /**
   * Update user role (admin only)
   * @param userId - User ID to update
   * @param role - New role
   */
  async updateUserRole(
    userId: string,
    role: 'user' | 'admin' | 'premium'
  ): Promise<UpdateRoleResponse> {
    const response = await fetch(`${API_URL}/api/auth/update-role`, {
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
    byRole: { user: number; admin: number; premium: number };
    verified: number;
    unverified: number;
    recentSignups: number; // Last 7 days
  }> {
    const response = await this.listUsers(1, 1000); // Get all users for stats
    const users = response.users;

    const stats = {
      total: users.length,
      byRole: {
        user: 0,
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
