import type {
  LoginCredentials,
  RegisterData,
  User,
  UpdateProfileData,
  ResetPasswordData,
} from '../types'
import { fetchWithCredentials } from '@/lib/fetch'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
const API_URL = `${BACKEND_URL}/api`

/**
 * Authentication Service
 * Handles all API calls related to authentication
 * Uses httpOnly cookies for secure token management
 * No localStorage needed - cookies are automatically sent with requests
 */
export const authService = {
  /**
   * Login user with email and password
   * Backend sets httpOnly cookies automatically
   */
  async login(credentials: LoginCredentials): Promise<{ user: User; access_token: string; refresh_token: string; token_type: string; expires_in: number }> {
    const response = await fetchWithCredentials(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao fazer login')
    }

    return response.json()
  },

  /**
   * Register new user
   * Backend sets httpOnly cookies automatically
   */
  async register(data: RegisterData): Promise<{ user: User; access_token: string; refresh_token: string; token_type: string; expires_in: number }> {
    const response = await fetchWithCredentials(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao criar conta')
    }

    return response.json()
  },

  /**
   * Logout current user
   * Backend clears httpOnly cookies automatically
   */
  async logout(): Promise<void> {
    const response = await fetchWithCredentials(`${API_URL}/auth/logout`, {
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error('Erro ao fazer logout')
    }
  },

  /**
   * Get current user via /auth/me endpoint
   * Uses httpOnly cookie automatically sent by browser
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await fetchWithCredentials(`${API_URL}/auth/me`, {
        method: 'GET',
      })

      if (!response.ok) {
        return null
      }

      return response.json()
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  },

  /**
   * Update user profile
   * Uses httpOnly cookie automatically sent by browser
   */
  async updateProfile(data: UpdateProfileData): Promise<User> {
    const response = await fetchWithCredentials(`${API_URL}/users/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao atualizar perfil')
    }

    return response.json()
  },

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao enviar email de recuperação')
    }
  },

  /**
   * Reset password with token
   */
  async resetPassword(data: ResetPasswordData): Promise<void> {
    const response = await fetchWithCredentials(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.access_token}`,
      },
      body: JSON.stringify({ password: data.password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao redefinir senha')
    }
  },

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_URL}/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao verificar email')
    }
  },
}
