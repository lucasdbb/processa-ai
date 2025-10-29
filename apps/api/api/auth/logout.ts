import { VercelResponse } from '@vercel/node';
import { AuthenticatedRequest, compose, withAuth, withCors } from '../../lib/auth.js';
import { createSupabaseClient } from '../../lib/supabase.js';
import { CommonErrors, mapSupabaseError } from '../../lib/errors.js';

const logoutHandler = async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['POST']));
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(CommonErrors.UNAUTHORIZED());
    }

    const token = authHeader.split(' ')[1];
    const supabase = createSupabaseClient(token);

    // Fazer logout no Supabase
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      return res.status(400).json(mapSupabaseError(error));
    }

    return res.status(200).json({
      message: 'Logout realizado com sucesso'
    });

  } catch (error) {
    console.error('Unexpected logout error:', error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

// Usando a função compose para melhor legibilidade
export default compose(withCors, withAuth)(logoutHandler);