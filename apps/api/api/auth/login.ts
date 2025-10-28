import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabase';
import { withCors } from '../../middleware/auth';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

const loginHandler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const { email, password }: LoginRequest = req.body;

    // Validação básica
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email e senha são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }

    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Formato de email inválido',
        code: 'INVALID_EMAIL'
      });
    }

    // Autenticar com Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Login error:', error);
      
      // Mapear erros específicos do Supabase
      if (error.message.includes('Invalid login credentials')) {
        return res.status(401).json({
          error: 'Credenciais inválidas',
          code: 'INVALID_CREDENTIALS'
        });
      }

      if (error.message.includes('Email not confirmed')) {
        return res.status(401).json({
          error: 'Email não confirmado',
          code: 'EMAIL_NOT_CONFIRMED'
        });
      }

      return res.status(400).json({
        error: 'Erro na autenticação',
        code: 'AUTH_ERROR',
        details: error.message
      });
    }

    if (!data.user || !data.session) {
      return res.status(401).json({
        error: 'Falha na autenticação',
        code: 'AUTH_FAILED'
      });
    }

    // Resposta de sucesso
    const response: LoginResponse = {
      user: {
        id: data.user.id,
        email: data.user.email || '',
        role: data.user.user_metadata?.role || 'user'
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at || 0
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Unexpected login error:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

export default withCors(loginHandler);