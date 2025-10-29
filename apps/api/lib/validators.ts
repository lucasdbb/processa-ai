// Validadores compartilhados para reutilização em toda a API

export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

/**
 * Valida formato de email
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email || typeof email !== 'string') {
    return {
      valid: false,
      error: 'Email é obrigatório',
      code: 'MISSING_EMAIL'
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: 'Formato de email inválido',
      code: 'INVALID_EMAIL'
    };
  }

  return { valid: true };
};

/**
 * Valida senha com requisitos de segurança
 * - Mínimo 8 caracteres
 * - Pelo menos uma letra maiúscula
 * - Pelo menos uma letra minúscula
 * - Pelo menos um número
 */
export const validatePassword = (password: string): ValidationResult => {
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      error: 'Senha é obrigatória',
      code: 'MISSING_PASSWORD'
    };
  }

  if (password.length < 8) {
    return {
      valid: false,
      error: 'A senha deve ter pelo menos 8 caracteres',
      code: 'WEAK_PASSWORD'
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: 'A senha deve conter pelo menos uma letra maiúscula',
      code: 'WEAK_PASSWORD'
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: 'A senha deve conter pelo menos uma letra minúscula',
      code: 'WEAK_PASSWORD'
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: 'A senha deve conter pelo menos um número',
      code: 'WEAK_PASSWORD'
    };
  }

  return { valid: true };
};

/**
 * Valida refresh token
 */
export const validateRefreshToken = (token: string): ValidationResult => {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: 'Refresh token é obrigatório',
      code: 'MISSING_REFRESH_TOKEN'
    };
  }

  if (token.length < 10) {
    return {
      valid: false,
      error: 'Refresh token inválido',
      code: 'INVALID_REFRESH_TOKEN'
    };
  }

  return { valid: true };
};
