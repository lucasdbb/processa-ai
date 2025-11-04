import { Request, Response } from 'express';
import { supabaseAdmin } from '../../../infrastructure/supabase/client.js';
import { ValidationError } from '../../../shared/errors/AppError.js';
import { mapSupabaseError } from '../../../shared/errors/AppError.js';
import { setSecureCookies } from '../../../shared/utils/cookies.js';
import { logger, createRequestContext } from '../../../infrastructure/monitoring/logger.js';

interface LoginRequest {
  email: string;
  password: string;
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  try {
    const { email, password }: LoginRequest = req.body;

    // Validação de campos obrigatórios
    if (!email || !password) {
      throw new ValidationError('Email e senha são obrigatórios', ['email', 'password']);
    }

    // Autenticar com Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      const context = createRequestContext(req);
      logger.warn('Login failed', { ...context, email });
      res.status(401).json(mapSupabaseError(error));
      return;
    }

    if (!data.user || !data.session) {
      res.status(401).json({
        error: 'Falha na autenticação',
        code: 'AUTH_FAILED'
      });
      return;
    }

    // Definir cookies seguros
    setSecureCookies(res, data.session.access_token, data.session.refresh_token);

    // Resposta de sucesso
    res.status(200).json({
      user: {
        id: data.user.id,
        email: data.user.email || '',
        role: data.user.user_metadata?.role || 'user'
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at || 0
      }
    });
  } catch (error) {
    throw error; // Será capturado pelo errorHandler middleware
  }
}
