/**
 * Rate Limiting Middleware
 * Protege contra ataques de força bruta e spam
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Handler } from './auth';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked?: boolean;
  blockUntil?: number;
}

interface RateLimitConfig {
  windowMs: number;        // Janela de tempo em ms
  maxRequests: number;     // Máximo de requisições por janela
  blockDurationMs?: number; // Tempo de bloqueio após exceder limite
  skipSuccessfulRequests?: boolean; // Não contar requisições bem-sucedidas
  keyGenerator?: (req: VercelRequest) => string; // Função para gerar chave única
}

// Cache em memória para armazenar contadores
const rateLimitCache = new Map<string, RateLimitEntry>();

// Limpeza automática do cache a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitCache.entries()) {
    // Remove entradas expiradas
    if (entry.resetTime < now && (!entry.blockUntil || entry.blockUntil < now)) {
      rateLimitCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Gera chave única baseada no IP e endpoint
 */
const defaultKeyGenerator = (req: VercelRequest): string => {
  const ip = getClientIP(req);
  const endpoint = req.url?.split('?')[0] || 'unknown';
  return `${ip}:${endpoint}`;
};

/**
 * Extrai o IP real do cliente considerando proxies
 */
const getClientIP = (req: VercelRequest): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
  
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  
  if (typeof realIP === 'string') {
    return realIP;
  }
  
  if (typeof cfConnectingIP === 'string') {
    return cfConnectingIP;
  }
  
  return req.socket?.remoteAddress || 'unknown';
};

/**
 * Middleware de Rate Limiting
 */
export const withRateLimit = (config: RateLimitConfig) => {
  return (handler: Handler): Handler => {
    return async (req: VercelRequest, res: VercelResponse) => {
      const now = Date.now();
      const keyGenerator = config.keyGenerator || defaultKeyGenerator;
      const key = keyGenerator(req);
      
      // Buscar entrada existente ou criar nova
      let entry = rateLimitCache.get(key);
      
      if (!entry) {
        entry = {
          count: 0,
          resetTime: now + config.windowMs
        };
        rateLimitCache.set(key, entry);
      }
      
      // Verificar se está bloqueado
      if (entry.blocked && entry.blockUntil && entry.blockUntil > now) {
        const remainingTime = Math.ceil((entry.blockUntil - now) / 1000);
        
        res.status(429).json({
          error: 'Too Many Requests',
          message: `IP bloqueado temporariamente. Tente novamente em ${remainingTime} segundos.`,
          retryAfter: remainingTime,
          type: 'RATE_LIMIT_BLOCKED'
        });
        return;
      }
      
      // Reset da janela se expirou
      if (entry.resetTime <= now) {
        entry.count = 0;
        entry.resetTime = now + config.windowMs;
        entry.blocked = false;
        entry.blockUntil = undefined;
      }
      
      // Incrementar contador
      entry.count++;
      
      // Verificar se excedeu o limite
      if (entry.count > config.maxRequests) {
        // Bloquear por tempo determinado se configurado
        if (config.blockDurationMs) {
          entry.blocked = true;
          entry.blockUntil = now + config.blockDurationMs;
        }
        
        const remainingTime = Math.ceil((entry.resetTime - now) / 1000);
        
        // Log de segurança
        console.warn(`Rate limit exceeded for ${key}:`, {
          ip: getClientIP(req),
          endpoint: req.url,
          count: entry.count,
          limit: config.maxRequests,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString()
        });
        
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Muitas tentativas. Tente novamente mais tarde.',
          retryAfter: remainingTime,
          type: 'RATE_LIMIT_EXCEEDED'
        });
        return;
      }
      
      // Adicionar headers informativos
      const remaining = Math.max(0, config.maxRequests - entry.count);
      const resetTime = Math.ceil((entry.resetTime - now) / 1000);
      
      res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', resetTime.toString());
      
      // Executar handler original
      const result = await handler(req, res);
      
      // Se configurado para não contar requisições bem-sucedidas
      if (config.skipSuccessfulRequests && res.statusCode < 400) {
        entry.count = Math.max(0, entry.count - 1);
      }
      
      return result;
    };
  };
};

/**
 * Configurações pré-definidas para diferentes tipos de endpoints
 */
export const rateLimitConfigs = {
  // Endpoints de autenticação (mais restritivo)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 5,            // 5 tentativas por IP
    blockDurationMs: 30 * 60 * 1000, // Bloquear por 30 minutos
    skipSuccessfulRequests: true
  },
  
  // Endpoints de registro (moderado)
  register: {
    windowMs: 60 * 60 * 1000, // 1 hora
    maxRequests: 3,           // 3 registros por hora
    blockDurationMs: 60 * 60 * 1000 // Bloquear por 1 hora
  },
  
  // Endpoints gerais (mais permissivo)
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 100,         // 100 requisições por IP
    skipSuccessfulRequests: true
  },
  
  // Upload de arquivos (restritivo)
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hora
    maxRequests: 10,          // 10 uploads por hora
    blockDurationMs: 30 * 60 * 1000
  }
} as const;

/**
 * Rate limiting específico por email para login
 */
export const withEmailRateLimit = (config: RateLimitConfig) => {
  return (handler: Handler): Handler => {
    return withRateLimit({
      ...config,
      keyGenerator: (req: VercelRequest) => {
        const body = req.body;
        const email = body?.email || 'unknown';
        const ip = getClientIP(req);
        return `email:${email}:${ip}`;
      }
    })(handler);
  };
};

/**
 * Limpar cache manualmente (útil para testes)
 */
export const clearRateLimitCache = (): void => {
  rateLimitCache.clear();
};

/**
 * Obter estatísticas do cache
 */
export const getRateLimitStats = () => {
  const now = Date.now();
  const active = Array.from(rateLimitCache.entries()).filter(
    ([, entry]) => entry.resetTime > now || (entry.blockUntil && entry.blockUntil > now)
  );
  
  return {
    totalEntries: rateLimitCache.size,
    activeEntries: active.length,
    blockedEntries: active.filter(([, entry]) => entry.blocked).length
  };
};