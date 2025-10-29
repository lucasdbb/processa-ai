/**
 * Endpoint de teste para Rate Limiting
 * Usado para verificar se as proteções estão funcionando
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors, compose } from '../../lib/auth.js';
import { withRateLimit, rateLimitConfigs, getRateLimitStats } from '../../lib/rate-limit.js';

interface TestRateLimitResponse {
  message: string;
  timestamp: string;
  ip: string;
  stats: {
    totalEntries: number;
    activeEntries: number;
    blockedEntries: number;
  };
}

const testRateLimitHandler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.socket?.remoteAddress || 
               'unknown';

    const response: TestRateLimitResponse = {
      message: 'Rate limiting is working! This endpoint allows 100 requests per 15 minutes.',
      timestamp: new Date().toISOString(),
      ip: Array.isArray(ip) ? ip[0] : ip,
      stats: getRateLimitStats()
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Test rate limit error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Aplicar Rate Limiting geral para testes
export default compose(
  withCors,
  withRateLimit(rateLimitConfigs.general)
)(testRateLimitHandler);