/**
 * HTML Sanitization Utilities
 * Uses DOMPurify to prevent XSS attacks by sanitizing user input
 */

import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';

/**
 * Configuração padrão para sanitização
 */
const DEFAULT_CONFIG: Config = {
  ALLOWED_TAGS: [], // Remove todas as tags HTML por padrão
  ALLOWED_ATTR: [], // Remove todos os atributos
  KEEP_CONTENT: true, // Mantém o conteúdo de texto, apenas remove as tags
};

/**
 * Configuração permissiva para rich text (usado em blog posts, etc.)
 */
const RICH_TEXT_CONFIG: Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'hr'
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

/**
 * Sanitiza uma string de texto simples
 * Remove todas as tags HTML e atributos
 *
 * @param input - String a ser sanitizada
 * @returns String sanitizada sem HTML
 *
 * @example
 * sanitizeText('<script>alert("xss")</script>Hello') // 'Hello'
 * sanitizeText('Name<img onerror="alert(1)" src=x>') // 'Name'
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';

  // Forçar retorno como string para compatibilidade com tipos
  return DOMPurify.sanitize(input.trim(), DEFAULT_CONFIG) as string;
}

/**
 * Sanitiza uma string de rich text (HTML)
 * Permite tags HTML básicas e seguras para formatação
 *
 * @param input - HTML a ser sanitizado
 * @returns HTML sanitizado com tags permitidas
 *
 * @example
 * sanitizeRichText('<p>Hello <strong>world</strong></p>') // '<p>Hello <strong>world</strong></p>'
 * sanitizeRichText('<p>Hello <script>alert(1)</script></p>') // '<p>Hello </p>'
 */
export function sanitizeRichText(input: string | null | undefined): string {
  if (!input) return '';

  // Forçar retorno como string para compatibilidade com tipos
  return DOMPurify.sanitize(input.trim(), RICH_TEXT_CONFIG) as string;
}

/**
 * Sanitiza um nome de usuário
 * Remove HTML e limita comprimento
 *
 * @param name - Nome a ser sanitizado
 * @param maxLength - Comprimento máximo (padrão: 255)
 * @returns Nome sanitizado
 */
export function sanitizeName(name: string | null | undefined, maxLength: number = 255): string {
  if (!name) return '';

  const sanitized = sanitizeText(name);
  return sanitized.slice(0, maxLength);
}

/**
 * Sanitiza um email
 * Remove HTML e valida formato básico
 *
 * @param email - Email a ser sanitizado
 * @returns Email sanitizado
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email) return '';

  // Remove HTML
  const sanitized = sanitizeText(email);

  // Remove espaços em branco
  return sanitized.toLowerCase().trim();
}

/**
 * Sanitiza um número de telefone
 * Remove HTML e caracteres não numéricos (exceto +, -, (), espaços)
 *
 * @param phone - Telefone a ser sanitizado
 * @returns Telefone sanitizado
 */
export function sanitizePhone(phone: string | null | undefined): string {
  if (!phone) return '';

  // Remove HTML
  const sanitized = sanitizeText(phone);

  // Permite apenas dígitos, +, -, (, ), espaços
  return sanitized.replace(/[^\d\s+()-]/g, '').trim();
}

/**
 * Sanitiza um documento (CPF/CNPJ)
 * Remove HTML e caracteres não numéricos (exceto ., -, /)
 *
 * @param document - Documento a ser sanitizado
 * @returns Documento sanitizado
 */
export function sanitizeDocument(document: string | null | undefined): string {
  if (!document) return '';

  // Remove HTML
  const sanitized = sanitizeText(document);

  // Permite apenas dígitos, pontos, traços e barras
  return sanitized.replace(/[^\d.\-/]/g, '').trim();
}

/**
 * Sanitiza uma URL
 * Remove HTML e valida protocolo seguro
 *
 * @param url - URL a ser sanitizada
 * @returns URL sanitizada ou string vazia se inválida
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';

  // Remove HTML
  const sanitized = sanitizeText(url).trim();

  try {
    const parsedUrl = new URL(sanitized);

    // Permite apenas protocolos seguros
    if (['http:', 'https:'].includes(parsedUrl.protocol)) {
      return parsedUrl.href;
    }
  } catch {
    // URL inválida
  }

  return '';
}

/**
 * Sanitiza um objeto recursivamente
 * Aplica sanitização em todos os campos de string
 *
 * @param obj - Objeto a ser sanitizado
 * @param fieldConfig - Configuração de sanitização por campo
 * @returns Objeto sanitizado
 *
 * @example
 * sanitizeObject({
 *   name: '<script>alert(1)</script>John',
 *   email: 'john@example.com'
 * }, {
 *   name: sanitizeName,
 *   email: sanitizeEmail
 * })
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  fieldConfig?: Partial<Record<keyof T, (value: any) => any>>
): T {
  const sanitized = { ...obj };

  for (const key in sanitized) {
    const value = sanitized[key];

    if (value === null || value === undefined) {
      continue;
    }

    // Se há configuração específica para este campo, usa ela
    if (fieldConfig && fieldConfig[key]) {
      sanitized[key] = fieldConfig[key]!(value);
    }
    // Se é string, aplica sanitização padrão
    else if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value) as any;
    }
    // Se é objeto, sanitiza recursivamente
    else if (typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    }
    // Se é array, sanitiza cada elemento
    else if (Array.isArray(value)) {
      sanitized[key] = (value as any[]).map((item: any) =>
        typeof item === 'string' ? sanitizeText(item) :
        typeof item === 'object' ? sanitizeObject(item as Record<string, any>) :
        item
      ) as any;
    }
  }

  return sanitized;
}

/**
 * Hook para sanitizar valores de formulário
 * Útil para usar com React Hook Form ou formulários controlados
 *
 * @example
 * const sanitized = useSanitize(formData, {
 *   name: sanitizeName,
 *   email: sanitizeEmail,
 *   phone: sanitizePhone
 * });
 */
export function useSanitizedForm<T extends Record<string, any>>(
  data: T,
  config?: Partial<Record<keyof T, (value: any) => any>>
): T {
  return sanitizeObject(data, config);
}
