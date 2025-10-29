import { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseClient } from './supabase.js';
import { CommonErrors } from './errors.js';

export interface AuthenticatedRequest extends VercelRequest {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

type Handler<T extends VercelRequest = VercelRequest> = (
  req: T,
  res: VercelResponse
) => Promise<VercelResponse | void>;

/**
 * Middleware de autenticação
 * Valida o Bearer token e popula req.user
 */
export const withAuth = (handler: Handler<AuthenticatedRequest>): Handler => {
  return async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json(CommonErrors.UNAUTHORIZED());
      }

      const token = authHeader.split(' ')[1];
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
      console.error('Auth middleware error:', error);
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
      'http://localhost:5173', // Vite dev server
      'http://localhost:4173', // Vite preview
      'https://processa-ai.vercel.app', // Produção principal
      'https://processa-4fb61znt9-marcelogcardozos-projects.vercel.app', // Deploy atual
    ].filter(Boolean);

    // Verificar se a origem está na lista permitida
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (process.env.NODE_ENV === 'development') {
      // Em desenvolvimento, permitir qualquer origem local
      if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }

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
export const compose = (...middlewares: ((handler: Handler) => Handler)[]) => {
  return (handler: Handler): Handler => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
};