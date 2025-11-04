import { Response } from 'express';
import { AuthenticatedRequest } from '../../../shared/middleware/authenticate.middleware.js';
import { supabaseAdmin } from '../../../infrastructure/supabase/client.js';
import { ValidationError } from '../../../shared/errors/AppError.js';
import { logger, createRequestContext } from '../../../infrastructure/monitoring/logger.js';

interface UpdateRoleRequest {
  userId: string;
  role: 'user' | 'admin' | 'premium';
}

export async function updateRoleHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUser = req.user!;
    const { userId, role }: UpdateRoleRequest = req.body;

    // Validação de campos obrigatórios
    if (!userId || !role) {
      throw new ValidationError('userId e role são obrigatórios');
    }

    // Validação de role
    if (!['user', 'admin', 'premium'].includes(role)) {
      res.status(400).json({
        error: 'Role inválida. Use: user, admin ou premium',
        code: 'INVALID_ROLE'
      });
      return;
    }

    // Impedir que o usuário mude a própria role
    if (userId === currentUser.id) {
      res.status(400).json({
        error: 'Você não pode alterar sua própria role',
        code: 'SELF_ROLE_CHANGE_NOT_ALLOWED'
      });
      return;
    }

    // Buscar o usuário que terá a role alterada
    const { data: targetUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (getUserError || !targetUser) {
      res.status(404).json({
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    const context = createRequestContext(req);

    // Atualizar user_profiles
    const { error: profileUpdateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ role: role })
      .eq('user_id', userId);

    if (profileUpdateError) {
      logger.error('Error updating role in user_profiles', context, profileUpdateError as Error);
      res.status(500).json({
        error: 'Erro ao atualizar role do usuário',
        code: 'PROFILE_UPDATE_FAILED'
      });
      return;
    }

    // Atualizar user_metadata no auth
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          ...targetUser.user.user_metadata,
          role: role
        }
      }
    );

    if (authUpdateError) {
      logger.error('Error updating auth metadata', context, authUpdateError as Error);
    }

    // Log de segurança
    logger.info('User role updated', {
      ...context,
      targetUserId: userId,
      targetEmail: targetUser.user.email,
      oldRole: targetUser.user.user_metadata?.role || 'user',
      newRole: role,
      adminId: currentUser.id,
      adminEmail: currentUser.email
    });

    // Resposta de sucesso
    res.status(200).json({
      message: `Role atualizada para '${role}' com sucesso`,
      user: {
        id: targetUser.user.id,
        email: targetUser.user.email || '',
        role: role
      }
    });
  } catch (error) {
    throw error;
  }
}
