/**
 * Authentication Service
 * Handles all authentication-related API calls
 */

import type { User, UserRole } from '../types/auth';
import { sanitizeName, sanitizeEmail, sanitizePhone, sanitizeDocument } from '../utils/sanitize';

// Base URL da API (sem /api no final)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// URL completa da API com /api
const API_URL = `${API_BASE_URL}/api`;

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
  documentType?: string;
  documentNumber?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

export interface UserResponse {
  id: string;
  email: string;
  confirmed_at: string | null;
  phone: string | null;
  name: string;
  role: string;
  avatar_url?: string | null;
  document_type?: string | null;
  document_number?: string | null;
}

export interface ApiError {
  error: string;
  code: string;
  details?: string;
}

export interface UpdateProfileData {
  name?: string;
  email?: string;
  avatar_url?: string;
  phone?: string | null;
  documentType?: string;
  documentNumber?: string | null;
}

export interface UpdateProfileResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatar_url?: string;
    phone?: string | null;
    createdAt: string;
    emailVerified: boolean;
  };
  message: string;
}

export interface UserDetailsResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatar?: string;
    createdAt: string;
    emailVerified: boolean;
    lastSignIn?: string;
    // Metadados completos
    userMetadata: Record<string, any>;
    rawUserMetadata: Record<string, any>;
    appMetadata: Record<string, any>;
  };
}

/**
 * Classe de erro customizada que preserva o código do erro da API
 */
export class AuthError extends Error {
  public readonly code: string;
  public readonly details?: string;

  constructor(message: string, code: string, details?: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.details = details;
  }
}

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    // Migração: ainda verificar localStorage para compatibilidade durante transição
    // mas priorizar cookies que são gerenciados automaticamente pelo navegador
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
    
    // Se encontrou tokens no localStorage, fazer migração para cookies
    if (this.accessToken || this.refreshToken) {
      this.migrateToSecureCookies();
    }
  }

  /**
   * Migra tokens do localStorage para cookies seguros (executado uma vez)
   */
  private migrateToSecureCookies(): void {
    // Limpar localStorage após migração
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    
    // Os tokens agora serão gerenciados via cookies httpOnly pela API
    // Não precisamos mais armazenar localmente
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * Cria headers padrão para requisições
   * Nota: Authorization header não é mais necessário pois usamos cookies httpOnly
   */
  private createHeaders(includeAuth: boolean = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Cookies são enviados automaticamente pelo navegador
    // Não precisamos mais do Authorization header
    // Mantido para compatibilidade durante transição
    if (includeAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Nota: Content-Length e Referer são adicionados automaticamente pelo navegador
    // Não precisamos defini-los manualmente (pode causar problemas CORS)

    return headers;
  }

  /**
   * Registra um novo usuário
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      // Sanitizar dados de entrada
      const sanitizedData: RegisterData = {
        email: sanitizeEmail(data.email),
        password: data.password, // Senha não precisa de sanitização (apenas validação)
        name: data.name ? sanitizeName(data.name) : undefined,
        documentType: data.documentType,
        documentNumber: data.documentNumber ? sanitizeDocument(data.documentNumber) : undefined,
      };

      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: this.createHeaders(false),
        credentials: 'include', // Incluir cookies automaticamente
        body: JSON.stringify(sanitizedData),
      });

      if (!response.ok) {
        const errorText = await response.text();
       
        let error: ApiError;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText || 'Erro ao criar conta', code: 'UNKNOWN_ERROR' };
        }

        throw new AuthError(error.error || 'Erro ao criar conta', error.code, error.details);
      }

      const result = await response.json();
      
      // Note: O endpoint de registro não retorna tokens automaticamente
      // O usuário precisa fazer login após o registro
      return result;
    } catch (error) {
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Erro de conexão com o servidor. Verifique sua internet ou se a API está online.');
      }
      throw error;
    }
  }

  /**
   * Faz login do usuário
   */
  async login(data: LoginData): Promise<AuthResponse> {
    try {
      // Sanitizar email
      const sanitizedData: LoginData = {
        email: sanitizeEmail(data.email),
        password: data.password, // Senha não precisa de sanitização
      };

      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: this.createHeaders(false),
        credentials: 'include', // Incluir cookies automaticamente
        body: JSON.stringify(sanitizedData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        let error: ApiError;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText || 'Erro ao fazer login', code: 'UNKNOWN_ERROR' };
        }

        throw new AuthError(error.error || 'Erro ao fazer login', error.code, error.details);
      }

      const result: AuthResponse = await response.json();
     
      // Salvar tokens
      this.setTokens(result.session.access_token, result.session.refresh_token);

      return result;
    } catch (error) {
     
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Erro de conexão com o servidor. Verifique sua internet ou se a API está online.');
      }
      throw error;
    }
  }

  /**
   * Faz logout do usuário no dispositivo atual
   */
  async logout(): Promise<void> {
    if (!this.accessToken) {
      this.clearTokens();
      return;
    }

    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: this.createHeaders(true),
        credentials: 'include', // Incluir cookies automaticamente
      });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      this.clearTokens();
    }
  }

  /**
   * Faz logout do usuário em TODOS os dispositivos
   * Invalida todas as sessões ativas
   */
  async logoutAll(): Promise<void> {
    if (!this.accessToken) {
      this.clearTokens();
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/logout-all`, {
        method: 'POST',
        headers: this.createHeaders(true),
        credentials: 'include', // Incluir cookies automaticamente
      });

      if (!response.ok) {
        throw new Error('Erro ao fazer logout em todos os dispositivos');
      }

      console.log('Logout realizado em todos os dispositivos');
    } catch (error) {
      console.error('Erro ao fazer logout global:', error);
      throw error;
    } finally {
      this.clearTokens();
    }
  }

  /**
   * Obtém informações do usuário atual
   */
  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      credentials: 'include', // Incluir cookies automaticamente
      headers: this.createHeaders(false), // Não incluir Authorization header, usar apenas cookies
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.error || 'Usuário não autenticado');
    }

    const userResponse: UserResponse = await response.json();

    // Validate that we received valid user data
    if (!userResponse || !userResponse.id || !userResponse.email) {
      console.error('Invalid user response:', userResponse);
      throw new Error('Dados do usuário inválidos');
    }

    // Convert UserResponse to User format
    return {
      id: userResponse.id,
      email: userResponse.email,
      name: userResponse.name || userResponse.email.split('@')[0],
      role: userResponse.role as UserRole,
      avatar_url: userResponse.avatar_url || null,
      createdAt: userResponse.confirmed_at || new Date().toISOString(),
      emailVerified: userResponse.confirmed_at !== null,
      phone: userResponse.phone,
      documentType: userResponse.document_type as 'cpf' | 'cnpj' | undefined,
      documentNumber: userResponse.document_number
    };
  }

  /**
   * Renova o access token usando o refresh token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('Refresh token não disponível');
    }

    const data = { refresh_token: this.refreshToken };

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: this.createHeaders(false),
      credentials: 'include', // Incluir cookies automaticamente
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      this.clearTokens();
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const result: AuthResponse = await response.json();
    this.setTokens(result.session.access_token, result.session.refresh_token);
  }

  /**
   * Busca detalhes completos do usuário incluindo metadados
   */
  async getUserDetails(): Promise<UserDetailsResponse> {
    if (!this.accessToken) {
      throw new AuthError('Usuário não autenticado', 'UNAUTHORIZED');
    }

    try {
      const response = await fetch(`${API_URL}/auth/get-user-details`, {
        method: 'GET',
        headers: this.createHeaders(true),
        credentials: 'include', // Incluir cookies automaticamente
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        let error: ApiError;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText || 'Erro ao buscar detalhes do usuário', code: 'UNKNOWN_ERROR' };
        }

        throw new AuthError(error.error || 'Erro ao buscar detalhes do usuário', error.code, error.details);
      }

      const result = await response.json();
      
      return result;
    } catch (error) {
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Erro de conexão com o servidor. Verifique sua internet ou se a API está online.');
      }
      throw error;
    }
  }

  /**
   * Atualiza o perfil do usuário
   */
  async updateProfile(data: UpdateProfileData): Promise<UpdateProfileResponse> {
    if (!this.accessToken) {
      throw new AuthError('Usuário não autenticado', 'UNAUTHORIZED');
    }

    try {
      // Sanitizar dados de entrada
      const sanitizedData: UpdateProfileData = {
        name: data.name ? sanitizeName(data.name) : undefined,
        email: data.email ? sanitizeEmail(data.email) : undefined,
        avatar_url: data.avatar_url, // URLs são validadas pelo backend
        phone: data.phone ? sanitizePhone(data.phone) : undefined,
        documentType: data.documentType,
        documentNumber: data.documentNumber ? sanitizeDocument(data.documentNumber) : undefined,
      };

      const response = await fetch(`${API_URL}/auth/update-profile`, {
        method: 'PUT',
        headers: this.createHeaders(true),
        credentials: 'include', // Incluir cookies automaticamente
        body: JSON.stringify(sanitizedData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        let error: ApiError;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText || 'Erro ao atualizar perfil', code: 'UNKNOWN_ERROR' };
        }

        throw new AuthError(error.error || 'Erro ao atualizar perfil', error.code, error.details);
      }

      const result = await response.json();
     
      return result;
    } catch (error) {

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Erro de conexão com o servidor. Verifique sua internet ou se a API está online.');
      }
      throw error;
    }
  }

  /**
   * Verifica se o usuário está autenticado
   * Com cookies seguros, fazemos uma verificação assíncrona
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Versão síncrona para compatibilidade (deprecated)
   * @deprecated Use isAuthenticated() async version instead
   */
  isAuthenticatedSync(): boolean {
    return !!this.accessToken;
  }

  /**
   * Obtém o access token atual
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Salva os tokens no localStorage e na memória
   */
  private setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  }

  /**
   * Remove os tokens do localStorage e da memória
   */
  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
}

// Exportar instância singleton
export const authService = new AuthService();
