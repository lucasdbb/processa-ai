import { VercelResponse } from '@vercel/node';
import { withAuth, withCors, AuthenticatedRequest } from '../../middleware/auth';

interface UserResponse {
  user: {
    id: string;
    email: string;
    role: string;
    name?: string;
    created_at?: string;
    last_sign_in_at?: string;
  };
}

const meHandler = async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Método não permitido',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // O middleware withAuth já validou o token e populou req.user
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'UNAUTHORIZED'
      });
    }

    // Resposta com informações do usuário
    const response: UserResponse = {
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role || 'user'
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Unexpected me error:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

export default withCors(withAuth(meHandler));