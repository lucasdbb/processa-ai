import { VercelResponse } from '@vercel/node';
import { AuthenticatedRequest, compose, withAuth, withCors } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { CommonErrors } from '../../lib/errors.js';

interface UpdateRoleRequest {
  userId: string;
  role: 'user' | 'admin' | 'premium';
}

interface UpdateRoleResponse {
  message: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

const updateRoleHandler = async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'PATCH' && req.method !== 'PUT') {
    return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['PATCH', 'PUT']));
  }

  try {
    // Verificar se o usuário autenticado é admin
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({
        error: 'Acesso negado. Apenas administradores podem alterar roles.',
        code: 'FORBIDDEN'
      });
    }

    const { userId, role }: UpdateRoleRequest = req.body;

    // Validação de campos obrigatórios
    if (!userId || !role) {
      return res.status(400).json(CommonErrors.MISSING_FIELDS(['userId', 'role']));
    }

    // Validação de role
    if (!['user', 'admin', 'premium'].includes(role)) {
      return res.status(400).json({
        error: 'Role inválida. Use: user, admin ou premium',
        code: 'INVALID_ROLE'
      });
    }

    // Impedir que o usuário mude a própria role
    if (userId === currentUser.id) {
      return res.status(400).json({
        error: 'Você não pode alterar sua própria role',
        code: 'SELF_ROLE_CHANGE_NOT_ALLOWED'
      });
    }

    // Buscar o usuário que terá a role alterada
    const { data: targetUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (getUserError || !targetUser) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Atualizar role no auth.users (user_metadata)
    const { data: updatedAuthData, error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          ...targetUser.user.user_metadata,
          role: role
        }
      }
    );

    if (updateAuthError) {
      console.error('Error updating role in auth.users:', updateAuthError);
      return res.status(500).json({
        error: 'Erro ao atualizar role no sistema de autenticação',
        code: 'AUTH_UPDATE_FAILED'
      });
    }

    // Atualizar role na tabela user_profiles (para backup/auditoria)
    const { error: profileUpdateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ role: role })
      .eq('user_id', userId);

    if (profileUpdateError) {
      console.error('Error updating role in user_profiles:', profileUpdateError);
      // Não falhar se a atualização no perfil falhar, já que o auth foi atualizado
    }

    // Resposta de sucesso
    const response: UpdateRoleResponse = {
      message: `Role atualizada para '${role}' com sucesso`,
      user: {
        id: updatedAuthData.user.id,
        email: updatedAuthData.user.email || '',
        role: role
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Unexpected update role error:', error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

export default compose(withCors, withAuth)(updateRoleHandler);
