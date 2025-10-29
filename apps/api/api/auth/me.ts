import { VercelResponse } from '@vercel/node';
import { AuthenticatedRequest, compose, withAuth, withCors } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { CommonErrors } from '../../lib/errors.js';

interface UserResponse {
  email: string;
  confirmed_at: string | null;
  phone: string | null;
  name: string;
  role: string;
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

    // Buscar dados completos do usuário usando o admin client
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(req.user.id);

    if (error) {
      console.error('Error fetching user details in /me:', error);
      // Fallback para dados básicos se houver erro
      const response: UserResponse = {
        email: req.user.email,
        confirmed_at: null,
        phone: null,
        name: '',
        role: req.user.role
      };
      return res.status(200).json(response);
    }

    if (!data.user) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = data.user;

    // Resposta com apenas os campos solicitados
    const response: UserResponse = {
      email: user.email || '',
      confirmed_at: user.confirmed_at || null,
      phone: user.phone || null,
      name: user.user_metadata?.name || '',
      role: user.user_metadata?.role || 'user'
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Unexpected me error:', error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

// Usando a função compose para melhor legibilidade
export default compose(withCors, withAuth)(meHandler);