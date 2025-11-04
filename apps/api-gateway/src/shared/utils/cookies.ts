import { Response } from 'express';
import { env } from '../../config/env.js';

const isProduction = env.NODE_ENV === 'production';

/**
 * Define cookies seguros para access_token e refresh_token
 */
export function setSecureCookies(res: Response, accessToken: string, refreshToken: string): void {
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' as const : 'lax' as const,
    path: '/',
  };

  // Access token (1 hora)
  res.cookie('access_token', accessToken, {
    ...cookieOptions,
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  // Refresh token (30 dias)
  res.cookie('refresh_token', refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

/**
 * Limpa cookies de autenticação
 */
export function clearSecureCookies(res: Response): void {
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' as const : 'lax' as const,
    path: '/',
  };

  res.clearCookie('access_token', cookieOptions);
  res.clearCookie('refresh_token', cookieOptions);
}

/**
 * Extrai refresh token do cookie
 */
export function extractRefreshToken(req: any): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) return null;

  const cookieMatch = cookies.match(/refresh_token=([^;]+)/);
  return cookieMatch ? cookieMatch[1] : null;
}
