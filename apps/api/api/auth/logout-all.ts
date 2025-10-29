import { VercelResponse } from '@vercel/node';
import { AuthenticatedRequest, compose, withAuth, withCors, clearSecureCookies } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { CommonErrors } from '../../lib/errors.js';
import { logger, createRequestContext } from '../../lib/logger.js';

/**
 * Endpoint de logout global
 * Invalida TODAS as sessões do usuário em todos os dispositivos
 */
const logoutAllHandler = async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['POST']));
  }

  try {
    // req.user é populado pelo middleware withAuth
    if (!req.user) {
      return res.status(401).json(CommonErrors.UNAUTHORIZED());
    }

    const userId = req.user.id;
    const context = createRequestContext(req);

    // Usar Admin API para revogar TODAS as sessões do usuário
    // Isso invalida todos os refresh tokens em todos os dispositivos
    const { error } = await supabaseAdmin.auth.admin.signOut(userId, 'global');

    if (error) {
      logger.error('Global logout error', context, error as Error, { userId });
      return res.status(500).json({
        error: 'Erro ao fazer logout em todos os dispositivos',
        code: 'GLOBAL_LOGOUT_FAILED',
        details: error.message
      });
    }

    // Limpar cookies seguros do dispositivo atual
    clearSecureCookies(res);

    // Log de segurança
    logger.security('Global logout', {
      ...context,
      userId,
      email: req.user.email
    });

    return res.status(200).json({
      message: 'Logout realizado em todos os dispositivos',
      success: true
    });

  } catch (error) {
    const context = createRequestContext(req);
    logger.error('Unexpected global logout error', context, error as Error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

// Aplicar middlewares
export default compose(withCors, withAuth)(logoutAllHandler);
