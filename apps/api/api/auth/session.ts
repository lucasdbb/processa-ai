import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, createSupabaseClient } from '../../lib/supabase.js';
import {
  withCors,
  compose,
  setSecureCookies,
  clearSecureCookies,
  extractRefreshToken,
  withAuth,
  AuthenticatedRequest
} from '../../lib/auth.js';
import { validateEmail, validatePassword, validateRefreshToken } from '../../lib/validators.js';
import { CommonErrors, mapSupabaseError } from '../../lib/errors.js';
import { withEmailRateLimit, withRateLimit, rateLimitConfigs } from '../../lib/rate-limit.js';
import { logger, createRequestContext } from '../../lib/logger.js';

// ==================== TYPES ====================

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  documentType?: string;
  documentNumber?: string;
}

interface RefreshRequest {
  refresh_token: string;
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

interface RegisterResponse {
  user: {
    id: string;
    email: string;
    email_confirmed: boolean;
  };
  message: string;
}

interface RefreshResponse {
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  user: {
    id: string;
    email: string;
    role: string;
  };
}

// ==================== HANDLERS ====================

/**
 * POST /auth/session?action=login
 * Login do usuário
 */
const handleLogin = async (req: VercelRequest, res: VercelResponse) => {
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
      const context = createRequestContext(req);
      logger.security('Login failed', { ...context, email }, { error: error.message });
      return res.status(401).json(mapSupabaseError(error));
    }

    if (!data.user || !data.session) {
      return res.status(401).json({
        error: 'Falha na autenticação',
        code: 'AUTH_FAILED'
      });
    }

    // Definir cookies seguros
    setSecureCookies(res, data.session.access_token, data.session.refresh_token);

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
    const context = createRequestContext(req);
    logger.error('Unexpected login error', context, error as Error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

/**
 * POST /auth/session?action=register
 * Registro de novo usuário
 */
const handleRegister = async (req: VercelRequest, res: VercelResponse) => {
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
    const cleanDocument = documentNumber.replace(/\D/g, '');
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
      .from('user_profiles')
      .select('document_number')
      .eq('document_number', cleanDocument)
      .single();

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      const context = createRequestContext(req);
      logger.error('Error checking document', context, profileCheckError as Error);
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
      email_confirm: false
    });

    if (error) {
      const context = createRequestContext(req);
      logger.security('Registration failed', { ...context, email }, { error: error.message });
      return res.status(400).json(mapSupabaseError(error));
    }

    if (!data.user) {
      return res.status(400).json({
        error: 'Falha na criação do usuário',
        code: 'USER_CREATION_FAILED'
      });
    }

    // Salvar documento na tabela user_profiles
    try {
      const { error: profileError } = await supabaseAdmin
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

      if (profileError) {
        const context = createRequestContext(req);
        logger.error('Error creating/updating user profile', context, profileError as Error);
      }
    } catch (profileErr) {
      const context = createRequestContext(req);
      logger.error('Unexpected error creating/updating profile', context, profileErr as Error);
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
    const context = createRequestContext(req);
    logger.error('Unexpected registration error', context, error as Error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

/**
 * POST /auth/session?action=refresh
 * Renovar access token usando refresh token
 */
const handleRefresh = async (req: VercelRequest, res: VercelResponse) => {
  try {
    // Tentar obter refresh token do cookie primeiro, depois do body
    let refresh_token = extractRefreshToken(req);
    if (!refresh_token) {
      const body: RefreshRequest = req.body;
      refresh_token = body.refresh_token;
    }

    // Validação de refresh token
    const tokenValidation = validateRefreshToken(refresh_token);
    if (!tokenValidation.valid) {
      return res.status(400).json({
        error: tokenValidation.error,
        code: tokenValidation.code
      });
    }

    // Renovar token com Supabase
    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token
    });

    if (error) {
      const context = createRequestContext(req);
      logger.security('Refresh token failed', context, { error: error.message });
      return res.status(401).json(mapSupabaseError(error));
    }

    if (!data.session || !data.user) {
      return res.status(401).json({
        error: 'Falha na renovação do token',
        code: 'REFRESH_FAILED'
      });
    }

    // Definir cookies seguros
    setSecureCookies(res, data.session.access_token, data.session.refresh_token);

    // Resposta de sucesso
    const response: RefreshResponse = {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at || 0
      },
      user: {
        id: data.user.id,
        email: data.user.email || '',
        role: data.user.user_metadata?.role || 'user'
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    const context = createRequestContext(req);
    logger.error('Unexpected refresh error', context, error as Error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

/**
 * POST /auth/session?action=logout
 * Logout do dispositivo atual
 */
const handleLogout = async (req: AuthenticatedRequest, res: VercelResponse) => {
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
      const context = createRequestContext(req);
      logger.error('Logout error', context, error as Error);
      return res.status(400).json(mapSupabaseError(error));
    }

    // Limpar cookies seguros
    clearSecureCookies(res);

    return res.status(200).json({
      message: 'Logout realizado com sucesso'
    });

  } catch (error) {
    const context = createRequestContext(req);
    logger.error('Unexpected logout error', context, error as Error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

/**
 * POST /auth/session?action=logout-all
 * Logout de todos os dispositivos
 */
const handleLogoutAll = async (req: AuthenticatedRequest, res: VercelResponse) => {
  try {
    if (!req.user) {
      return res.status(401).json(CommonErrors.UNAUTHORIZED());
    }

    const userId = req.user.id;
    const context = createRequestContext(req);

    // Usar Admin API para revogar TODAS as sessões do usuário
    const { error } = await supabaseAdmin.auth.admin.signOut(userId, 'global');

    if (error) {
      logger.error('Global logout error', context, error as Error, { userId });
      return res.status(500).json({
        error: 'Erro ao fazer logout em todos os dispositivos',
        code: 'GLOBAL_LOGOUT_FAILED',
        details: error.message
      });
    }

    // Limpar cookies seguros
    clearSecureCookies(res);

    // Log de segurança
    logger.security('Global logout', {
      ...context,
      userId,
      email: req.user.email
    });

    return res.status(200).json({
      message: 'Logout realizado em todos os dispositivos',
      success: true
    });

  } catch (error) {
    const context = createRequestContext(req);
    logger.error('Unexpected global logout error', context, error as Error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

// ==================== MAIN HANDLER ====================

const sessionHandler = async (req: VercelRequest | AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['POST']));
  }

  const action = (req.query.action as string) || 'login';

  switch (action) {
    case 'login':
      return handleLogin(req, res);
    case 'register':
      return handleRegister(req, res);
    case 'refresh':
      return handleRefresh(req, res);
    case 'logout':
      return handleLogout(req as AuthenticatedRequest, res);
    case 'logout-all':
      return handleLogoutAll(req as AuthenticatedRequest, res);
    default:
      return res.status(400).json({
        error: 'Ação inválida. Use: login, register, refresh, logout ou logout-all',
        code: 'INVALID_ACTION'
      });
  }
};

// ==================== MIDDLEWARE COMPOSITION ====================

// Aplicar middlewares apropriados baseado na ação
const conditionalMiddleware = async (req: VercelRequest | AuthenticatedRequest, res: VercelResponse) => {
  const action = (req.query.action as string) || 'login';

  // Ações que requerem autenticação
  if (action === 'logout' || action === 'logout-all') {
    return compose(withCors, withAuth)(sessionHandler)(req as AuthenticatedRequest, res);
  }

  // Login com rate limiting por email
  if (action === 'login') {
    return compose(
      withCors,
      withEmailRateLimit(rateLimitConfigs.auth)
    )(sessionHandler)(req, res);
  }

  // Register com rate limiting restritivo
  if (action === 'register') {
    return compose(
      withCors,
      withRateLimit(rateLimitConfigs.register)
    )(sessionHandler)(req, res);
  }

  // Refresh com rate limiting geral
  if (action === 'refresh') {
    return compose(
      withCors,
      withRateLimit(rateLimitConfigs.general)
    )(sessionHandler)(req, res);
  }

  // Fallback para outras ações
  return compose(withCors)(sessionHandler)(req, res);
};

export default conditionalMiddleware;
