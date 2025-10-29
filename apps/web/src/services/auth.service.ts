/**
 * Authentication Service
 * Handles all authentication-related API calls
 */

// Base URL da API (sem /api no final)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// URL completa da API com /api
const API_URL = `${API_BASE_URL}/api`;

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
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
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface ApiError {
  error: string;
  code: string;
  details?: string;
}

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    // Recuperar tokens do localStorage ao inicializar
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  /**
   * Cria headers padrão para requisições
   */
  private createHeaders(includeAuth: boolean = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Adicionar token de autenticação se necessário
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
      console.log('[AUTH] Iniciando registro:', {
        email: data.email,
        url: `${API_URL}/auth/register`
      });

      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: this.createHeaders(false),
        body: JSON.stringify(data),
      });

      console.log('[AUTH] Resposta recebida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AUTH] Erro na resposta:', errorText);

        let error: ApiError;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText || 'Erro ao criar conta', code: 'UNKNOWN_ERROR' };
        }

        throw new Error(error.error || 'Erro ao criar conta');
      }

      const result = await response.json();
      console.log('[AUTH] Registro bem-sucedido');

      // Note: O endpoint de registro não retorna tokens automaticamente
      // O usuário precisa fazer login após o registro
      return result;
    } catch (error) {
      console.error('[AUTH] Erro capturado:', error);
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
      console.log('[AUTH] Iniciando login:', {
        email: data.email,
        url: `${API_URL}/auth/login`
      });

      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: this.createHeaders(false),
        body: JSON.stringify(data),
      });

      console.log('[AUTH] Resposta recebida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AUTH] Erro na resposta:', errorText);

        let error: ApiError;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText || 'Erro ao fazer login', code: 'UNKNOWN_ERROR' };
        }

        throw new Error(error.error || 'Erro ao fazer login');
      }

      const result: AuthResponse = await response.json();
      console.log('[AUTH] Login bem-sucedido');

      // Salvar tokens
      this.setTokens(result.session.access_token, result.session.refresh_token);

      return result;
    } catch (error) {
      console.error('[AUTH] Erro capturado:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Erro de conexão com o servidor. Verifique sua internet ou se a API está online.');
      }
      throw error;
    }
  }

  /**
   * Faz logout do usuário
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
      });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      this.clearTokens();
    }
  }

  /**
   * Obtém os dados do usuário autenticado
   */
  async getCurrentUser(): Promise<UserResponse> {
    if (!this.accessToken) {
      throw new Error('Usuário não autenticado');
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: this.createHeaders(true),
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expirado, tentar renovar
        await this.refreshAccessToken();
        return this.getCurrentUser(); // Tentar novamente
      }

      const error: ApiError = await response.json();
      throw new Error(error.error || 'Erro ao obter dados do usuário');
    }

    return response.json();
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
   * Verifica se o usuário está autenticado
   */
  isAuthenticated(): boolean {
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
