import { VercelRequest, VercelResponse } from '@vercel/node';

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
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Responder a requisições OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Método não permitido',
      code: 'METHOD_NOT_ALLOWED',
      allowed_methods: ['GET']
    });
  }

  try {
    // Informações básicas do sistema
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();
    const environment = process.env.NODE_ENV || 'production';
    
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
      const { supabaseAdmin } = await import('../../lib/supabase');
      
      // Teste simples de conexão
      const { error } = await supabaseAdmin.from('auth.users').select('count').limit(1);
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
      environment: process.env.NODE_ENV || 'production',
      services: {
        database: 'unknown',
        api: 'down'
      },
      endpoints: []
    };

    return res.status(503).json(errorResponse);
  }
};

export default healthCheckHandler;