import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabase.js';
import { withCors, compose } from '../../lib/auth.js';
import { validateEmail, validatePassword } from '../../lib/validators.js';
import { CommonErrors, mapSupabaseError } from '../../lib/errors.js';
import { withRateLimit, rateLimitConfigs } from '../../lib/rate-limit.js';

interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  documentType?: string;
  documentNumber?: string;
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
    const { email, password, name, documentType, documentNumber }: RegisterRequest = req.body;

    // Validação de campos obrigatórios
    if (!email || !password) {
      return res.status(400).json(CommonErrors.MISSING_FIELDS(['email', 'password']));
    }

    // Validação de documento (obrigatório)
    if (!documentNumber || !documentType) {
      return res.status(400).json({
        error: 'CPF ou CNPJ é obrigatório',
        code: 'DOCUMENT_REQUIRED'
      });
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

    // Verificar se o documento já existe
    const cleanDocument = documentNumber.replace(/\D/g, ''); // Remove máscaras
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
      .from('user_profiles')
      .select('document_number')
      .eq('document_number', cleanDocument)
      .single();

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      // PGRST116 = not found, que é o que queremos
      console.error('Error checking document:', profileCheckError);
      return res.status(500).json({
        error: 'Erro ao verificar documento',
        code: 'DOCUMENT_CHECK_FAILED'
      });
    }

    if (existingProfile) {
      return res.status(400).json({
        error: documentType === 'cpf' ? 'CPF já cadastrado' : 'CNPJ já cadastrado',
        code: 'DOCUMENT_ALREADY_EXISTS'
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

    // Salvar/atualizar documento na tabela user_profiles
    // Usa UPSERT para atualizar se o trigger já criou o registro
    try {
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          user_id: data.user.id,
          full_name: name || email.split('@')[0],
          document_type: documentType,
          document_number: documentNumber.replace(/\D/g, ''), // Remove máscaras
          role: 'user' // Todos os novos registros começam como 'user'
        }, {
          onConflict: 'user_id' // Atualiza se já existir baseado no user_id
        });

      if (profileError) {
        console.error('Error creating/updating user profile:', profileError);
        // Não falhar o registro se o perfil não for criado/atualizado
      }
    } catch (profileErr) {
      console.error('Unexpected error creating/updating profile:', profileErr);
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

// Aplicar Rate Limiting específico para registro (mais restritivo)
export default compose(
  withCors,
  withRateLimit(rateLimitConfigs.register)
)(registerHandler);