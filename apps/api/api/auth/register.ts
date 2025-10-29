import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabase.js';
import { withCors } from '../../lib/auth.js';
import { validateEmail, validatePassword } from '../../lib/validators.js';
import { CommonErrors, mapSupabaseError } from '../../lib/errors.js';

interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

interface RegisterResponse {
  user: {
    id: string;
    email: string;
    email_confirmed: boolean;
  };
  message: string;
}

const registerHandler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['POST']));
  }

  try {
    const { email, password, name }: RegisterRequest = req.body;

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

    // Validação de senha
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: passwordValidation.error,
        code: passwordValidation.code
      });
    }

    // Criar usuário no Supabase
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        name: name || email.split('@')[0],
        role: 'user'
      },
      email_confirm: false // Requer confirmação por email
    });

    if (error) {
      console.error('Registration error:', error);
      return res.status(400).json(mapSupabaseError(error));
    }

    if (!data.user) {
      return res.status(400).json({
        error: 'Falha na criação do usuário',
        code: 'USER_CREATION_FAILED'
      });
    }

    // Resposta de sucesso
    const response: RegisterResponse = {
      user: {
        id: data.user.id,
        email: data.user.email || '',
        email_confirmed: data.user.email_confirmed_at !== null
      },
      message: 'Usuário criado com sucesso. Verifique seu email para confirmar a conta.'
    };

    return res.status(201).json(response);

  } catch (error) {
    console.error('Unexpected registration error:', error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

export default withCors(registerHandler);