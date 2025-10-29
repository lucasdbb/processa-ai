import { VercelResponse } from '@vercel/node';
import { AuthenticatedRequest, compose, withAuth, withCors } from '../../lib/auth.js';
import { CommonErrors } from '../../lib/errors.js';
import { getUserData } from '../../lib/user-helper.js';

const meHandler = async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['GET']));
  }

  try {
    // O middleware withAuth já validou o token e populou req.user
    if (!req.user) {
      return res.status(401).json(CommonErrors.UNAUTHORIZED());
    }

    // Fetch complete user data including profile information
    const userData = await getUserData(req.user.id);

    // If unable to fetch user data, return error
    if (!userData) {
      console.error('[/me] Failed to fetch user data for:', req.user.id);
      return res.status(500).json({
        error: 'Erro ao carregar dados do usuário',
        code: 'USER_DATA_FETCH_FAILED'
      });
    }

    return res.status(200).json(userData);

  } catch (error) {
    console.error('Unexpected me error:', error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

// Usando a função compose para melhor legibilidade
export default compose(withCors, withAuth)(meHandler);