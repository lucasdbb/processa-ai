import { Request, Response } from 'express';
import { supabaseAdmin } from '../../../infrastructure/supabase/client.js';
import { ValidationError } from '../../../shared/errors/AppError.js';
import { mapSupabaseError } from '../../../shared/errors/AppError.js';
import { setSecureCookies, extractRefreshToken } from '../../../shared/utils/cookies.js';
import { logger, createRequestContext } from '../../../infrastructure/monitoring/logger.js';

interface RefreshRequest {
  refresh_token?: string;
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  try {
    // Tentar obter refresh token do cookie primeiro, depois do body
    let refresh_token: string | null = extractRefreshToken(req);

    if (!refresh_token) {
      const body: RefreshRequest = req.body;
      // body.refresh_token pode ser undefined; manter tipo string | null
      refresh_token = body.refresh_token ?? null;
    }

    // Validação de refresh token
    if (!refresh_token) {
      throw new ValidationError('Refresh token é obrigatório');
    }

    // Renovar token com Supabase
    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token
    });

    if (error) {
      const context = createRequestContext(req);
      logger.warn('Refresh token failed', context);
      res.status(401).json(mapSupabaseError(error));
      return;
    }

    if (!data.session || !data.user) {
      res.status(401).json({
        error: 'Falha na renovação do token',
        code: 'REFRESH_FAILED'
      });
      return;
    }

    // Definir cookies seguros
    setSecureCookies(res, data.session.access_token, data.session.refresh_token);

    // Resposta de sucesso
    res.status(200).json({
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
    });
  } catch (error) {
    throw error;
  }
}
