import { Request, Response } from 'express';
import { supabasePublic } from '../../../infrastructure/supabase/client.js';
import { ValidationError } from '../../../shared/errors/AppError.js';
import { mapSupabaseError } from '../../../shared/errors/AppError.js';
import { logger, createRequestContext } from '../../../infrastructure/monitoring/logger.js';
import { env } from '../../../config/env.js';

interface ForgotPasswordRequest {
  email: string;
}

/**
 * Handler para solicitar recuperação de senha
 * Envia e-mail com link de reset via Supabase
 */
export async function forgotPasswordHandler(req: Request, res: Response): Promise<void> {
  try {
    const { email }: ForgotPasswordRequest = req.body;

    // Validação de campo obrigatório
    if (!email) {
      throw new ValidationError('Email é obrigatório', ['email']);
    }

    // Validação básica de formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Email inválido', ['email']);
    }

    // Enviar e-mail de recuperação de senha
    // O Supabase enviará automaticamente o e-mail com link de reset
    // O link redirecionará para /auth/callback que processará o token
    const { error } = await supabasePublic.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.FRONTEND_URL}/auth/callback`
    });

    if (error) {
      const context = createRequestContext(req);
      logger.warn('Password reset request failed', { ...context, email });
      res.status(400).json(mapSupabaseError(error));
      return;
    }

    // Por segurança, sempre retornar sucesso mesmo se o e-mail não existir
    // Isso previne que atacantes descubram quais e-mails estão cadastrados
    res.status(200).json({
      message: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.'
    });

    const context = createRequestContext(req);
    logger.info('Password reset email sent', { ...context, email });
  } catch (error) {
    throw error;
  }
}
