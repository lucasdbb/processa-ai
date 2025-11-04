import { Router } from 'express';
import { authenticate, requireRole } from '../shared/middleware/authenticate.middleware.js';
import { listUsersHandler } from '../features/users/handlers/listUsers.handler.js';
import { updateRoleHandler } from '../features/users/handlers/updateRole.handler.js';
import { getProfileHandler } from '../features/users/handlers/getProfile.handler.js';
import { updateProfileHandler } from '../features/users/handlers/updateProfile.handler.js';
import { uploadAvatarHandler } from '../features/users/handlers/uploadAvatar.handler.js';

const router = Router();

// ===== Admin Routes (require admin role) =====

// GET /api/users (list all users - admin only)
router.get('/', authenticate, requireRole(['admin']), listUsersHandler);

// PATCH /api/users/:userId/role (update user role - admin only)
router.patch('/:userId/role', authenticate, requireRole(['admin']), updateRoleHandler);

// ===== Profile Routes (require authentication) =====

// GET /api/users/profile (get current user profile)
router.get('/profile', authenticate, getProfileHandler);

// PUT /api/users/profile (update current user profile)
router.put('/profile', authenticate, updateProfileHandler);

// PATCH /api/users/profile (update current user profile)
router.patch('/profile', authenticate, updateProfileHandler);

// POST /api/users/profile/avatar (upload avatar)
router.post('/profile/avatar', authenticate, uploadAvatarHandler);

export default router;
