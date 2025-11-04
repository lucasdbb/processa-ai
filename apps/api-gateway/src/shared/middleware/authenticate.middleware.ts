import { Request, Response, NextFunction } from 'express';
import { createSupabaseClient } from '../../infrastructure/supabase/client.js';
import { UnauthorizedError } from '../errors/AppError.js';
import { logger, createRequestContext } from '../../infrastructure/monitoring/logger.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Extrai token de autenticação do request (Bearer header ou cookie)
 */
function extractToken(req: Request): string | null {
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
}

/**
 * Middleware de autenticação Express
 * Valida o Bearer token ou cookie e popula req.user
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError('Token de autenticação necessário');
    }

    const supabase = createSupabaseClient(token);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      throw new UnauthorizedError('Token inválido ou expirado');
    }

    // Adicionar informações do usuário ao request
    req.user = {
      id: user.id,
      email: user.email || '',
      role: user.user_metadata?.role || 'user'
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(401).json({
        error: error.message,
        code: error.code
      });
    } else {
      const context = createRequestContext(req);
      logger.error('Auth middleware error', context, error as Error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

/**
 * Middleware para verificar role específica
 */
export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Não autorizado',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Acesso negado. Permissões insuficientes.',
        code: 'FORBIDDEN'
      });
      return;
    }

    next();
  };
}
