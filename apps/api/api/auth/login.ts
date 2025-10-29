import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabase.js';
import { withCors, compose } from '../../lib/auth.js';
import { validateEmail } from '../../lib/validators.js';
import { CommonErrors, mapSupabaseError } from '../../lib/errors.js';
import { withEmailRateLimit, rateLimitConfigs } from '../../lib/rate-limit.js';

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
    return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['POST']));
  }

  try {
    const { email, password }: LoginRequest = req.body;

    // Validação de campos obrigatórios
    if (!email || !password) {
      return res.status(400).json(CommonErrors.MISSING_FIELDS(['email', 'password']));
    }

    // Validação de email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        error: emailValidation.error,
        code: emailValidation.code
      });
    }

    // Autenticar com Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Login error:', error);
      return res.status(401).json(mapSupabaseError(error));
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
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

// Aplicar Rate Limiting específico para login (por email + IP)
export default compose(
  withCors,
  withEmailRateLimit(rateLimitConfigs.auth)
)(loginHandler);