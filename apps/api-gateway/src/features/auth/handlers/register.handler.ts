import { Request, Response } from 'express';
import { supabaseAdmin, supabasePublic } from '../../../infrastructure/supabase/client.js';
import { ValidationError } from '../../../shared/errors/AppError.js';
import { mapSupabaseError } from '../../../shared/errors/AppError.js';
import { logger, createRequestContext } from '../../../infrastructure/monitoring/logger.js';
import { env } from '../../../config/env.js';

interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  documentType?: string;
  documentNumber?: string;
}

export async function registerHandler(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name, documentType, documentNumber }: RegisterRequest = req.body;

    // Validação de campos obrigatórios
    if (!email || !password) {
      throw new ValidationError('Email e senha são obrigatórios', ['email', 'password']);
    }

    if (!documentNumber || !documentType) {
      res.status(400).json({
        error: 'CPF ou CNPJ é obrigatório',
        code: 'DOCUMENT_REQUIRED'
      });
      return;
    }

    // Verificar se documento já existe
    const cleanDocument = documentNumber.replace(/\D/g, '');
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('document_number')
      .eq('document_number', cleanDocument)
      .single();

    if (existingProfile) {
      res.status(400).json({
        error: documentType === 'cpf' ? 'CPF já cadastrado' : 'CNPJ já cadastrado',
        code: 'DOCUMENT_ALREADY_EXISTS'
      });
      return;
    }

    // Criar usuário via signUp (dispara e-mail de confirmação automaticamente)
    const { data, error } = await supabasePublic.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: env.FRONTEND_URL
      }
    });

    if (error) {
      const context = createRequestContext(req);
      logger.warn('Registration failed', { ...context, email });
      res.status(400).json(mapSupabaseError(error));
      return;
    }

    if (!data.user) {
      res.status(400).json({
        error: 'Falha na criação do usuário',
        code: 'USER_CREATION_FAILED'
      });
      return;
    }

    // Salvar documento no perfil
    await supabaseAdmin
      .from('user_profiles')
      .upsert({
        user_id: data.user.id,
        full_name: name || email.split('@')[0],
        document_type: documentType,
        document_number: cleanDocument,
        role: 'user'
      }, {
        onConflict: 'user_id'
      });

    // Resposta de sucesso
    res.status(201).json({
      user: {
        id: data.user.id,
        email: data.user.email || '',
        email_confirmed: data.user.email_confirmed_at !== null
      },
      message: 'Usuário criado com sucesso. Verifique seu email para confirmar a conta.'
    });
  } catch (error) {
    throw error;
  }
}
