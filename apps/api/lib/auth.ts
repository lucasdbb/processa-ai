import { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseClient } from './supabase.js';
import { CommonErrors } from './errors.js';
import { logger, createRequestContext } from './logger.js';

export interface AuthenticatedRequest extends VercelRequest {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export type Handler<T extends VercelRequest = VercelRequest> = (
  req: T,
  res: VercelResponse
) => Promise<VercelResponse | void>;

/**
 * Extrai token de autenticação do request (Bearer header ou cookie)
 */
const extractToken = (req: VercelRequest): string | null => {
  // Primeiro, tentar Bearer token no header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  // Segundo, tentar cookie
  const cookies = req.headers.cookie;
  if (cookies) {
    const cookieMatch = cookies.match(/access_token=([^;]+)/);
    if (cookieMatch) {
      return cookieMatch[1];
    }
  }

  return null;
};

/**
 * Middleware de autenticação
 * Valida o Bearer token ou cookie e popula req.user
 */
export const withAuth = (handler: Handler<AuthenticatedRequest>): Handler => {
  return async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const token = extractToken(req);

      if (!token) {
        return res.status(401).json(CommonErrors.UNAUTHORIZED());
      }

      const supabase = createSupabaseClient(token);

      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        return res.status(401).json(CommonErrors.INVALID_TOKEN());
      }

      req.user = {
        id: user.id,
        email: user.email || '',
        role: user.user_metadata?.role || 'user'
      };

      return handler(req, res);
    } catch (error) {
      const context = createRequestContext(req);
      logger.error('Auth middleware error', context, error as Error);
      return res.status(500).json(CommonErrors.INTERNAL_ERROR());
    }
  };
};

/**
 * Middleware de CORS
 * Configura headers CORS e trata requisições OPTIONS
 */
export const withCors = (handler: Handler): Handler => {
  return async (req: VercelRequest, res: VercelResponse) => {
    const origin = req.headers.origin;

    // Lista de origens permitidas baseada na variável de ambiente
    const envUrls = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',').map(url => url.trim()).filter(Boolean)
      : [];

    const allowedOrigins = [
      ...envUrls,
      'http://localhost:3000',
      'http://localhost:3001', // Vite dev server (porta alternativa)
      'http://localhost:5173', // Vite dev server
      'http://localhost:4173', // Vite preview
      'https://processa-ai.vercel.app', // Produção principal
    ].filter(Boolean);

    // Normalizar origem removendo espaços e caracteres invisíveis
    const normalizedOrigin = origin?.trim();

    // Verificar se a origem está na lista permitida
    if (normalizedOrigin && allowedOrigins.includes(normalizedOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', normalizedOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (normalizedOrigin && (normalizedOrigin.includes('localhost') || normalizedOrigin.includes('127.0.0.1'))) {
      // Em qualquer ambiente, permitir localhost para desenvolvimento
      res.setHeader('Access-Control-Allow-Origin', normalizedOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    // Não definir Access-Control-Allow-Origin para origens não permitidas

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight por 24h

    // Responder a requisições OPTIONS
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    return handler(req, res);
  };
};

/**
 * Composição de múltiplos middlewares
 * Uso: compose(withCors, withAuth)(handler)
 */
/**
 * Configurações de cookies seguros
 */
export const COOKIE_CONFIG = {
  ACCESS_TOKEN: {
    name: 'access_token',
    maxAge: 60 * 60, // 1 hora
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
    path: '/'
  },
  REFRESH_TOKEN: {
    name: 'refresh_token',
    maxAge: 7 * 24 * 60 * 60, // 7 dias
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
    path: '/'
  }
};

/**
 * Define cookies seguros na resposta
 */
export const setSecureCookies = (
  res: VercelResponse,
  accessToken: string,
  refreshToken: string
): void => {
  const accessCookieValue = `${COOKIE_CONFIG.ACCESS_TOKEN.name}=${accessToken}; Max-Age=${COOKIE_CONFIG.ACCESS_TOKEN.maxAge}; Path=${COOKIE_CONFIG.ACCESS_TOKEN.path}; ${COOKIE_CONFIG.ACCESS_TOKEN.httpOnly ? 'HttpOnly; ' : ''}${COOKIE_CONFIG.ACCESS_TOKEN.secure ? 'Secure; ' : ''}SameSite=${COOKIE_CONFIG.ACCESS_TOKEN.sameSite}`;
  
  const refreshCookieValue = `${COOKIE_CONFIG.REFRESH_TOKEN.name}=${refreshToken}; Max-Age=${COOKIE_CONFIG.REFRESH_TOKEN.maxAge}; Path=${COOKIE_CONFIG.REFRESH_TOKEN.path}; ${COOKIE_CONFIG.REFRESH_TOKEN.httpOnly ? 'HttpOnly; ' : ''}${COOKIE_CONFIG.REFRESH_TOKEN.secure ? 'Secure; ' : ''}SameSite=${COOKIE_CONFIG.REFRESH_TOKEN.sameSite}`;

  res.setHeader('Set-Cookie', [accessCookieValue, refreshCookieValue]);
};

/**
 * Remove cookies seguros da resposta
 */
export const clearSecureCookies = (res: VercelResponse): void => {
  const expiredAccessCookie = `${COOKIE_CONFIG.ACCESS_TOKEN.name}=; Max-Age=0; Path=${COOKIE_CONFIG.ACCESS_TOKEN.path}; ${COOKIE_CONFIG.ACCESS_TOKEN.httpOnly ? 'HttpOnly; ' : ''}${COOKIE_CONFIG.ACCESS_TOKEN.secure ? 'Secure; ' : ''}SameSite=${COOKIE_CONFIG.ACCESS_TOKEN.sameSite}`;
  
  const expiredRefreshCookie = `${COOKIE_CONFIG.REFRESH_TOKEN.name}=; Max-Age=0; Path=${COOKIE_CONFIG.REFRESH_TOKEN.path}; ${COOKIE_CONFIG.REFRESH_TOKEN.httpOnly ? 'HttpOnly; ' : ''}${COOKIE_CONFIG.REFRESH_TOKEN.secure ? 'Secure; ' : ''}SameSite=${COOKIE_CONFIG.REFRESH_TOKEN.sameSite}`;

  res.setHeader('Set-Cookie', [expiredAccessCookie, expiredRefreshCookie]);
};

/**
 * Extrai refresh token do cookie
 */
export const extractRefreshToken = (req: VercelRequest): string | null => {
  const cookies = req.headers.cookie;
  if (cookies) {
    const cookieMatch = cookies.match(/refresh_token=([^;]+)/);
    if (cookieMatch) {
      return cookieMatch[1];
    }
  }
  return null;
};

/**
 * Composição de múltiplos middlewares
 * Uso: compose(withCors, withAuth)(handler)
 */
export const compose = (...middlewares: ((handler: Handler) => Handler)[]) => {
  return (handler: Handler): Handler => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
};