import { Request, Response } from 'express';
import { createSupabaseClient } from '../../../infrastructure/supabase/client.js';
import { ValidationError } from '../../../shared/errors/AppError.js';
import { mapSupabaseError } from '../../../shared/errors/AppError.js';
import { logger, createRequestContext } from '../../../infrastructure/monitoring/logger.js';

interface ResetPasswordRequest {
  password: string;
  access_token: string;
}

/**
 * Handler para redefinir senha após clicar no link de recuperação
 * Requer o access_token enviado no link de reset
 */
export async function resetPasswordHandler(req: Request, res: Response): Promise<void> {
  try {
    const { password, access_token }: ResetPasswordRequest = req.body;

    // Validação de campos obrigatórios
    if (!password) {
      throw new ValidationError('Senha é obrigatória', ['password']);
    }

    if (!access_token) {
      throw new ValidationError('Token de acesso é obrigatório', ['access_token']);
    }

    // Validação de senha forte
    if (password.length < 8) {
      throw new ValidationError('Senha deve ter pelo menos 8 caracteres', ['password']);
    }

    if (!/[A-Z]/.test(password)) {
      throw new ValidationError('Senha deve conter pelo menos uma letra maiúscula', ['password']);
    }

    if (!/[a-z]/.test(password)) {
      throw new ValidationError('Senha deve conter pelo menos uma letra minúscula', ['password']);
    }

    if (!/[0-9]/.test(password)) {
      throw new ValidationError('Senha deve conter pelo menos um número', ['password']);
    }

    // Criar cliente Supabase com o token de recuperação
    const supabaseWithToken = createSupabaseClient(access_token);

    // Atualizar senha do usuário
    const { data, error } = await supabaseWithToken.auth.updateUser({
      password
    });

    if (error) {
      const context = createRequestContext(req);
      logger.warn('Password reset failed', { ...context, error: error.message });
      res.status(400).json(mapSupabaseError(error));
      return;
    }

    if (!data.user) {
      res.status(400).json({
        error: 'Falha ao redefinir senha',
        code: 'PASSWORD_RESET_FAILED'
      });
      return;
    }

    res.status(200).json({
      message: 'Senha redefinida com sucesso',
      user: {
        id: data.user.id,
        email: data.user.email
      }
    });

    const context = createRequestContext(req);
    logger.info('Password reset successful', {
      ...context,
      userId: data.user.id
    });
  } catch (error) {
    throw error;
  }
}
