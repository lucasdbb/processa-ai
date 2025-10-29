/**
 * Sistema de Logging Estruturado para Produção
 * Substitui console.log/error por logging apropriado baseado no ambiente
 */

import { env } from './env.js';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

class Logger {
  private currentLogLevel: LogLevel;
  private isProduction: boolean;

  constructor() {
    this.isProduction = env.NODE_ENV === 'production';
    
    // Em produção, apenas ERROR e WARN
    // Em desenvolvimento, todos os níveis
    this.currentLogLevel = this.isProduction ? LogLevel.WARN : LogLevel.DEBUG;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLogLevel;
  }

  private formatLogEntry(entry: LogEntry): string {
    if (this.isProduction) {
      // Em produção, formato JSON estruturado
      return JSON.stringify({
        timestamp: entry.timestamp,
        level: LogLevel[entry.level],
        message: entry.message,
        context: entry.context,
        error: entry.error,
        metadata: entry.metadata
      });
    } else {
      // Em desenvolvimento, formato legível
      const levelName = LogLevel[entry.level];
      const contextStr = entry.context ? ` [${JSON.stringify(entry.context)}]` : '';
      const errorStr = entry.error ? `\nError: ${entry.error.message}\nStack: ${entry.error.stack}` : '';
      const metadataStr = entry.metadata ? `\nMetadata: ${JSON.stringify(entry.metadata, null, 2)}` : '';
      
      return `[${entry.timestamp}] ${levelName}: ${entry.message}${contextStr}${errorStr}${metadataStr}`;
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error, metadata?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: this.isProduction ? undefined : error.stack
      } : undefined,
      metadata
    };

    const formattedLog = this.formatLogEntry(entry);

    // Em produção, usar apenas console.error para logs críticos
    // Em desenvolvimento, usar console apropriado
    if (this.isProduction) {
      if (level === LogLevel.ERROR) {
        console.error(formattedLog);
      } else if (level === LogLevel.WARN) {
        console.warn(formattedLog);
      }
      // INFO e DEBUG são suprimidos em produção
    } else {
      switch (level) {
        case LogLevel.ERROR:
          console.error(formattedLog);
          break;
        case LogLevel.WARN:
          console.warn(formattedLog);
          break;
        case LogLevel.INFO:
          console.info(formattedLog);
          break;
        case LogLevel.DEBUG:
          console.log(formattedLog);
          break;
      }
    }
  }

  /**
   * Log de erro crítico - sempre exibido
   */
  error(message: string, context?: LogContext, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error, metadata);
  }

  /**
   * Log de aviso - exibido em produção e desenvolvimento
   */
  warn(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context, undefined, metadata);
  }

  /**
   * Log informativo - apenas em desenvolvimento
   */
  info(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context, undefined, metadata);
  }

  /**
   * Log de debug - apenas em desenvolvimento
   */
  debug(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context, undefined, metadata);
  }

  /**
   * Cria um logger com contexto específico
   */
  withContext(context: LogContext): ContextLogger {
    return new ContextLogger(this, context);
  }

  /**
   * Log de auditoria para ações sensíveis
   */
  audit(action: string, context: LogContext, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, `AUDIT: ${action}`, context, undefined, {
      ...metadata,
      audit: true,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log de segurança para eventos de segurança
   */
  security(event: string, context: LogContext, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, `SECURITY: ${event}`, context, undefined, {
      ...metadata,
      security: true,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Logger com contexto pré-definido
 */
class ContextLogger {
  constructor(
    private logger: Logger,
    private context: LogContext
  ) {}

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.logger.error(message, this.context, error, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.logger.warn(message, this.context, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.logger.info(message, this.context, metadata);
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.logger.debug(message, this.context, metadata);
  }

  audit(action: string, metadata?: Record<string, any>): void {
    this.logger.audit(action, this.context, metadata);
  }

  security(event: string, metadata?: Record<string, any>): void {
    this.logger.security(event, this.context, metadata);
  }
}

// Instância singleton do logger
export const logger = new Logger();

// Utilitários para extrair contexto de requisições
export const createRequestContext = (req: any): LogContext => {
  return {
    requestId: req.headers['x-request-id'] || generateRequestId(),
    ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
    endpoint: req.url,
    method: req.method,
    userId: req.user?.id
  };
};

export const createUserContext = (userId: string, additionalContext?: Partial<LogContext>): LogContext => {
  return {
    userId,
    ...additionalContext
  };
};

// Gerador simples de ID de requisição
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Middleware para adicionar contexto de logging às requisições
export const withLogging = (handler: Function) => {
  return async (req: any, res: any) => {
    const context = createRequestContext(req);
    const contextLogger = logger.withContext(context);
    
    // Adicionar logger ao request para uso nos handlers
    req.logger = contextLogger;
    
    // Log da requisição (apenas em desenvolvimento)
    contextLogger.debug('Request received');
    
    try {
      const result = await handler(req, res);
      
      // Log de sucesso (apenas em desenvolvimento)
      contextLogger.debug('Request completed successfully');
      
      return result;
    } catch (error) {
      // Log de erro (sempre)
      contextLogger.error('Request failed', error as Error);
      throw error;
    }
  };
};