import { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseClient } from '../lib/supabase';

export interface AuthenticatedRequest extends VercelRequest {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

export const withAuth = (
  handler: (req: AuthenticatedRequest, res: VercelResponse) => Promise<VercelResponse | void>
) => {
  return async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Token de acesso não fornecido',
          code: 'UNAUTHORIZED'
        });
      }

      const token = authHeader.split(' ')[1];
      const supabase = createSupabaseClient(token);
      
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        return res.status(401).json({
          error: 'Token inválido ou expirado',
          code: 'INVALID_TOKEN'
        });
      }

      req.user = {
        id: user.id,
        email: user.email || '',
        role: user.user_metadata?.role || 'user'
      };

      return handler(req, res);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

export const withCors = (
  handler: (req: VercelRequest, res: VercelResponse) => Promise<VercelResponse | void>
) => {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Responder a requisições OPTIONS
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    return handler(req, res);
  };
};