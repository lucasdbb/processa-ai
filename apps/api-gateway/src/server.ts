import express from 'express';
import helmet from 'helmet';
import { corsMiddleware } from './shared/middleware/cors.middleware.js';
import { errorHandler } from './shared/middleware/errorHandler.middleware.js';
import { logger } from './infrastructure/monitoring/logger.js';
import { env } from './config/env.js';
import routes from './routes/index.js';

const app = express();
const PORT = parseInt(env.PORT);

// Security middleware
app.use(helmet());

// CORS
app.use(corsMiddleware);
// Responder automaticamente preflight requests
app.options('*', corsMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (simple)
app.use((req, res, next) => {
  void res; // evitar erro de parâmetro não utilizado
  logger.info(`${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  void req; // evitar erro de parâmetro não utilizado
  res.json({
    message: 'Processa AI - API Gateway',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*'
    }
  });
});

// Error handler (deve ser o último middleware)
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 API Gateway listening on port ${PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`CORS enabled for: ${env.FRONTEND_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, closing server gracefully');
  process.exit(0);
});
