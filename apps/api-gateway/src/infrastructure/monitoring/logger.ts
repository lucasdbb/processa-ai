import pino from 'pino';
import { Request } from 'express';
import { env } from '../../config/env.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

export interface RequestContext {
  method?: string;
  url?: string;
  ip?: string;
  userAgent?: string;
}

export function createRequestContext(req: Request): RequestContext {
  return {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}
