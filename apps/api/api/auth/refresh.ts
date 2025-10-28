import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabase';
import { withCors } from '../../middleware/auth';

interface RefreshRequest {
  refresh_token: string;
}

interface RefreshResponse {
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  user: {
    id: string;
    email: string;
    role: string;
  };
}

const refreshHandler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const { refresh_token }: RefreshRequest = req.body;

    // Validação básica
    if (!refresh_token) {
      return res.status(400).json({
        error: 'Refresh token é obrigatório',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    // Renovar token com Supabase
    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token
    });

    if (error) {
      console.error('Refresh token error:', error);
      
      if (error.message.includes('Invalid refresh token')) {
        return res.status(401).json({
          error: 'Refresh token inválido ou expirado',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }

      return res.status(400).json({
        error: 'Erro ao renovar token',
        code: 'REFRESH_ERROR',
        details: error.message
      });
    }

    if (!data.session || !data.user) {
      return res.status(401).json({
        error: 'Falha na renovação do token',
        code: 'REFRESH_FAILED'
      });
    }

    // Resposta de sucesso
    const response: RefreshResponse = {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at || 0
      },
      user: {
        id: data.user.id,
        email: data.user.email || '',
        role: data.user.user_metadata?.role || 'user'
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Unexpected refresh error:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

export default withCors(refreshHandler);