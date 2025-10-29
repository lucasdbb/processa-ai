import { VercelResponse } from '@vercel/node';
import { AuthenticatedRequest, compose, withAuth, withCors } from '../../lib/auth.js';
import { CommonErrors } from '../../lib/errors.js';

interface UserResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

const meHandler = async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['GET']));
  }

  try {
    // O middleware withAuth já validou o token e populou req.user
    if (!req.user) {
      return res.status(401).json(CommonErrors.UNAUTHORIZED());
    }

    // Resposta com informações do usuário
    const response: UserResponse = {
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Unexpected me error:', error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

// Usando a função compose para melhor legibilidade
export default compose(withCors, withAuth)(meHandler);