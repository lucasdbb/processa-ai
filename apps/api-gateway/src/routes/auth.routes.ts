import { Router } from 'express';
import { loginHandler } from '../features/auth/handlers/login.handler.js';
import { registerHandler } from '../features/auth/handlers/register.handler.js';
import { refreshHandler } from '../features/auth/handlers/refresh.handler.js';
import { forgotPasswordHandler } from '../features/auth/handlers/forgotPassword.handler.js';
import { resetPasswordHandler } from '../features/auth/handlers/resetPassword.handler.js';
import { authenticate } from '../shared/middleware/authenticate.middleware.js';
import { clearSecureCookies } from '../shared/utils/cookies.js';

const router = Router();

// POST /api/auth/login
router.post('/login', loginHandler);

// POST /api/auth/register
router.post('/register', registerHandler);

// POST /api/auth/refresh
router.post('/refresh', refreshHandler);

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPasswordHandler);

// POST /api/auth/reset-password
router.post('/reset-password', resetPasswordHandler);

// POST /api/auth/logout (requer autenticação)
router.post('/logout', authenticate, (req, res) => {
  void req; // evitar erro de parâmetro não utilizado
  clearSecureCookies(res);
  res.status(200).json({
    message: 'Logout realizado com sucesso'
  });
});

// GET /api/auth/me (requer autenticação)
router.get('/me', authenticate, (req: any, res) => {
  res.status(200).json({
    user: req.user
  });
});

export default router;
