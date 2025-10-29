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
    // Permitir qualquer origem para desenvolvimento/testes
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // Nota: Access-Control-Allow-Credentials não pode ser usado com '*'
    // res.setHeader('Access-Control-Allow-Credentials', 'true');

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