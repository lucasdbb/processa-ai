import { VercelResponse } from '@vercel/node';
import { withAuth, withCors, AuthenticatedRequest } from '../../middleware/auth';
import { createSupabaseClient } from '../../lib/supabase';

const logoutHandler = async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

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

    // Fazer logout no Supabase
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      return res.status(400).json({
        error: 'Erro ao fazer logout',
        code: 'LOGOUT_ERROR',
        details: error.message
      });
    }

    return res.status(200).json({
      message: 'Logout realizado com sucesso'
    });

  } catch (error) {
    console.error('Unexpected logout error:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

export default withCors(withAuth(logoutHandler));