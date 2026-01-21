export type UserRole = 'admin' | 'author' | 'user' | 'premium'
export type DocumentType = 'cpf' | 'cnpj'

export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
  phone?: string
  document_type?: DocumentType
  document_number?: string
  newsletter_opt_in?: boolean
  role: UserRole
  created_at: string
  updated_at?: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  name: string
  newsletter_opt_in?: boolean
}

export interface UpdateProfileData {
  name?: string
  email?: string
  avatar_url?: string
  phone?: string
  document_type?: DocumentType
  document_number?: string
  newsletter_opt_in?: boolean
}

export interface ResetPasswordData {
  password: string
  access_token: string
}

export interface AuthTokenUser {
  id: string
  email: string
  role?: UserRole
}

export interface AuthTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: AuthTokenUser
}

export interface EmailConfirmationResponse {
  message: string
  email_confirmation_required: boolean
  user: {
    id: string
    email: string
  }
}
