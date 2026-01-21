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
