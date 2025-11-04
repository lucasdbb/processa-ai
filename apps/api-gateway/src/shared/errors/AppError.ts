export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Não autorizado') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Acesso negado') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso não encontrado') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export const CommonErrors = {
  UNAUTHORIZED: () => ({
    error: 'Não autorizado. Token de autenticação necessário.',
    code: 'UNAUTHORIZED'
  }),

  INVALID_TOKEN: () => ({
    error: 'Token inválido ou expirado',
    code: 'INVALID_TOKEN'
  }),

  FORBIDDEN: () => ({
    error: 'Acesso negado',
    code: 'FORBIDDEN'
  }),

  NOT_FOUND: (resource: string = 'Recurso') => ({
    error: `${resource} não encontrado`,
    code: 'NOT_FOUND'
  }),

  MISSING_FIELDS: (fields: string[]) => ({
    error: `Campos obrigatórios ausentes: ${fields.join(', ')}`,
    code: 'MISSING_FIELDS',
    fields
  }),

  METHOD_NOT_ALLOWED: (allowed: string[]) => ({
    error: `Método não permitido. Use: ${allowed.join(', ')}`,
    code: 'METHOD_NOT_ALLOWED',
    allowed
  }),

  INTERNAL_ERROR: () => ({
    error: 'Erro interno do servidor',
    code: 'INTERNAL_ERROR'
  }),
};

/**
 * Mapeia erros do Supabase para formato padronizado
 */
export function mapSupabaseError(error: any): { error: string; code: string; details?: string } {
  const message = error.message || 'Erro desconhecido';
  const code = error.code || 'SUPABASE_ERROR';

  // Mensagens customizadas baseadas em códigos comuns
  const errorMap: Record<string, string> = {
    'invalid_credentials': 'Email ou senha inválidos',
    'email_exists': 'Este email já está cadastrado',
    'weak_password': 'Senha muito fraca. Use no mínimo 8 caracteres',
    'invalid_grant': 'Credenciais inválidas',
    'user_not_found': 'Usuário não encontrado',
  };

  return {
    error: errorMap[code] || message,
    code: code.toUpperCase(),
    details: message
  };
}
