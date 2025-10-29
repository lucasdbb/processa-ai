import { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors } from '../lib/auth.js';
import { CommonErrors } from '../lib/errors.js';
import { env } from '../lib/env.js';

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  environment: string;
  services: {
    database: 'connected' | 'disconnected' | 'unknown';
    api: 'operational' | 'degraded' | 'down';
  };
  endpoints: string[];
}

const healthCheckHandler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['GET']));
  }

  try {
    // Informações básicas do sistema
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();
    const environment = env.NODE_ENV;
    
    // Lista de endpoints disponíveis
    const endpoints = [
      'GET /',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'POST /api/auth/refresh',
      'POST /api/auth/logout'
    ];

    // Verificação básica de saúde dos serviços
    let databaseStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';
    let apiStatus: 'operational' | 'degraded' | 'down' = 'operational';

    // Tentativa simples de verificar se o Supabase está acessível
    try {
      // Importação dinâmica para evitar problemas de inicialização
      const { supabaseAdmin } = await import('../lib/supabase.js');

      // Teste simples de conexão usando a API de administração
      const { error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1 });
      databaseStatus = error ? 'disconnected' : 'connected';
    } catch (error) {
      console.warn('Health check - Database connection test failed:', error);
      databaseStatus = 'disconnected';
      apiStatus = 'degraded';
    }

    // Determinar status geral
    const overallStatus: 'healthy' | 'unhealthy' = 
      databaseStatus === 'connected' && apiStatus === 'operational' 
        ? 'healthy' 
        : 'unhealthy';

    const healthResponse: HealthCheckResponse = {
      status: overallStatus,
      timestamp,
      version: '1.0.0',
      uptime: Math.round(uptime),
      environment,
      services: {
        database: databaseStatus,
        api: apiStatus
      },
      endpoints
    };

    // Status code baseado na saúde geral
    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    return res.status(statusCode).json(healthResponse);

  } catch (error) {
    console.error('Health check error:', error);

    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: Math.round(process.uptime()),
      environment: env.NODE_ENV,
      services: {
        database: 'unknown',
        api: 'down'
      },
      endpoints: []
    };

    return res.status(503).json(errorResponse);
  }
};

export default withCors(healthCheckHandler);