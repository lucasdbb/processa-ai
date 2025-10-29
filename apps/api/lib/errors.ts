// Gerenciamento de erros padronizados para respostas consistentes

export interface ApiError {
  error: string;
  code: string;
  details?: string;
}

/**
 * Cria uma resposta de erro padronizada
 */
export const createErrorResponse = (
  error: string,
  code: string,
  details?: string
): ApiError => {
  const response: ApiError = { error, code };

  // Apenas incluir detalhes em desenvolvimento
  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details;
  }

  return response;
};

/**
 * Mapeia erros do Supabase para mensagens amigáveis
 */
export const mapSupabaseError = (error: any): ApiError => {
  const message = error?.message || '';
  const code = error?.code || '';

  // Verificar primeiro pelo código específico do erro
  if (code === 'email_exists' || message.includes('A user with this email address has already been registered')) {
    return createErrorResponse(
      'Este email já está cadastrado. Tente fazer login ou use outro email.',
      'EMAIL_EXISTS'
    );
  }

  // Erros de autenticação
  if (message.includes('Invalid login credentials')) {
    return createErrorResponse(
      'Email ou senha incorretos',
      'INVALID_CREDENTIALS'
    );
  }

  if (message.includes('Email not confirmed')) {
    return createErrorResponse(
      'Email não confirmado. Verifique sua caixa de entrada.',
      'EMAIL_NOT_CONFIRMED'
    );
  }

  if (message.includes('User already registered')) {
    return createErrorResponse(
      'Usuário já existe com este email',
      'USER_EXISTS'
    );
  }

  if (message.includes('Invalid refresh token')) {
    return createErrorResponse(
      'Refresh token inválido ou expirado',
      'INVALID_REFRESH_TOKEN'
    );
  }

  // Erro genérico
  return createErrorResponse(
    'Erro ao processar a requisição',
    'SUPABASE_ERROR',
    message
  );
};

/**
 * Erros comuns pré-definidos
 */
export const CommonErrors = {
  METHOD_NOT_ALLOWED: (allowedMethods: string[] = []) =>
    createErrorResponse(
      'Método não permitido',
      'METHOD_NOT_ALLOWED',
      allowedMethods.length > 0 ? `Métodos permitidos: ${allowedMethods.join(', ')}` : undefined
    ),

  UNAUTHORIZED: () =>
    createErrorResponse(
      'Token de acesso não fornecido ou inválido',
      'UNAUTHORIZED'
    ),

  INVALID_TOKEN: () =>
    createErrorResponse(
      'Token inválido ou expirado',
      'INVALID_TOKEN'
    ),

  INTERNAL_ERROR: () =>
    createErrorResponse(
      'Erro interno do servidor',
      'INTERNAL_ERROR'
    ),

  MISSING_FIELDS: (fields: string[] = []) =>
    createErrorResponse(
      fields.length > 0
        ? `Campos obrigatórios ausentes: ${fields.join(', ')}`
        : 'Campos obrigatórios ausentes',
      'MISSING_FIELDS'
    ),
};
