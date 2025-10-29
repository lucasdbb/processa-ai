import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabase.js';
import { withCors } from '../../lib/auth.js';
import { validateRefreshToken } from '../../lib/validators.js';
import { CommonErrors, mapSupabaseError } from '../../lib/errors.js';

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
    return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['POST']));
  }

  try {
    const { refresh_token }: RefreshRequest = req.body;

    // Validação de refresh token
    const tokenValidation = validateRefreshToken(refresh_token);
    if (!tokenValidation.valid) {
      return res.status(400).json({
        error: tokenValidation.error,
        code: tokenValidation.code
      });
    }

    // Renovar token com Supabase
    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token
    });

    if (error) {
      console.error('Refresh token error:', error);
      return res.status(401).json(mapSupabaseError(error));
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
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

export default withCors(refreshHandler);