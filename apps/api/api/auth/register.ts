import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabase';
import { withCors } from '../../middleware/auth';

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
    return res.status(405).json({
      error: 'Método não permitido',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    const { email, password, name }: RegisterRequest = req.body;

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

    // Validação de senha
    if (password.length < 8) {
      return res.status(400).json({
        error: 'A senha deve ter pelo menos 8 caracteres',
        code: 'WEAK_PASSWORD'
      });
    }

    // Verificar se o usuário já existe
    const { data: existingUser } = await supabaseAdmin
      .from('auth.users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({
        error: 'Usuário já existe com este email',
        code: 'USER_EXISTS'
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
      
      if (error.message.includes('User already registered')) {
        return res.status(409).json({
          error: 'Usuário já existe com este email',
          code: 'USER_EXISTS'
        });
      }

      return res.status(400).json({
        error: 'Erro no registro',
        code: 'REGISTRATION_ERROR',
        details: error.message
      });
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
    return res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

export default withCors(registerHandler);