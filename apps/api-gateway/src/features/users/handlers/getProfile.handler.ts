import { Response } from 'express';
import { AuthenticatedRequest } from '../../../shared/middleware/authenticate.middleware.js';
import { getUserData } from '../services/getUserData.js';
import { logger, createRequestContext } from '../../../infrastructure/monitoring/logger.js';

export async function getProfileHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Não autorizado',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    // Fetch complete user data
    const userData = await getUserData(req.user.id);

    if (!userData) {
      const context = createRequestContext(req);
      logger.error('Failed to fetch user data', context, undefined, { userId: req.user.id });
      res.status(500).json({
        error: 'Erro ao carregar dados do usuário',
        code: 'USER_DATA_FETCH_FAILED'
      });
      return;
    }

    res.status(200).json(userData);
  } catch (error) {
    throw error;
  }
}
