import { Router } from 'express';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';

const router = Router();

// Rotas de autenticação
router.use('/auth', authRoutes);

// Rotas de usuários (admin + profile)
router.use('/users', usersRoutes);

// Health check
router.get('/health', (req, res) => {
  void req; // evitar erro de parâmetro não utilizado
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'api-gateway',
    version: '1.0.0'
  });
});

export default router;
