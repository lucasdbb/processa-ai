import { VercelResponse } from '@vercel/node';
import { AuthenticatedRequest, compose, withAuth, withCors } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { CommonErrors } from '../../lib/errors.js';

interface UserDetailsResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatar?: string;
    createdAt: string;
    emailVerified: boolean;
    lastSignIn?: string;
    // Metadados completos
    userMetadata: Record<string, any>;
    rawUserMetadata: Record<string, any>;
    appMetadata: Record<string, any>;
  };
}

const getUserDetailsHandler = async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['GET']));
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(CommonErrors.UNAUTHORIZED());
    }

    // Buscar dados completos do usuário usando o admin client
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error) {
      console.error('Error fetching user details:', error);
      return res.status(400).json({
        error: 'Erro ao buscar dados do usuário',
        code: 'FETCH_USER_ERROR'
      });
    }

    if (!data.user) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = data.user;

    // Formatar resposta com todos os metadados
    const response: UserDetailsResponse = {
      user: {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.name || '',
        role: user.user_metadata?.role || user.app_metadata?.role || 'user',
        avatar: user.user_metadata?.avatar,
        createdAt: user.created_at || '',
        emailVerified: user.email_confirmed_at !== null,
        lastSignIn: user.last_sign_in_at || undefined,
        
        // Todos os tipos de metadata
        userMetadata: user.user_metadata || {},
        rawUserMetadata: user.user_metadata || {}, // Usando user_metadata como fallback
        appMetadata: user.app_metadata || {}
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Unexpected error fetching user details:', error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

export default compose(withCors, withAuth)(getUserDetailsHandler);