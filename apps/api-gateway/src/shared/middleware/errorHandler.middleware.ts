import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';
import { logger, createRequestContext } from '../../infrastructure/monitoring/logger.js';
import { env } from '../../config/env.js';

/**
 * Middleware global de tratamento de erros
 * Deve ser o último middleware adicionado
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  void next; // evitar erro de parâmetro não utilizado
  const context = createRequestContext(req);

  // Se é um AppError customizado, usa status e code definidos
  if (err instanceof AppError) {
    logger.error(err.message, context, err);

    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details && { details: err.details }),
      ...(env.NODE_ENV === 'development' && { stack: err.stack })
    });
    return;
  }

  // Erro genérico
  logger.error('Unhandled error', context, err);

  res.status(500).json({
    error: 'Erro interno do servidor',
    code: 'INTERNAL_ERROR',
    ...(env.NODE_ENV === 'development' && {
      message: err.message,
      stack: err.stack
    })
  });
}
