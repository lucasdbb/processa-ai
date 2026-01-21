import type {
  LoginCredentials,
  RegisterData,
  User,
  UpdateProfileData,
  ResetPasswordData,
  AuthTokenResponse,
  EmailConfirmationResponse,
} from '../types'
import { API_URL, fetchWithCredentials } from '@/lib/fetch'

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthTokenResponse> {
    const response = await fetchWithCredentials(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao fazer login')
    }

    return response.json()
  },

  async register(data: RegisterData): Promise<AuthTokenResponse | EmailConfirmationResponse> {
    const response = await fetchWithCredentials(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        full_name: data.name,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao criar conta')
    }

    return response.json()
  },

  async logout(): Promise<void> {
    const response = await fetchWithCredentials(`${API_URL}/auth/logout`, {
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error('Erro ao fazer logout')
    }
  },

  async getCurrentUser(accessToken?: string): Promise<User | null> {
    try {
      const response = await fetchWithCredentials(`${API_URL}/auth/me`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      })

      if (!response.ok) return null

      return response.json()
    } catch {
      return null
    }
  },

  async updateProfile(data: UpdateProfileData): Promise<User> {
    const response = await fetchWithCredentials(`${API_URL}/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao atualizar perfil')
    }

    return response.json()
  },

  async forgotPassword(email: string): Promise<void> {
    const response = await fetchWithCredentials(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao enviar email de recuperação')
    }
  },

  async resetPassword(data: ResetPasswordData): Promise<void> {
    const response = await fetchWithCredentials(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: data.access_token,
        new_password: data.password,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao redefinir senha')
    }
  },
}
