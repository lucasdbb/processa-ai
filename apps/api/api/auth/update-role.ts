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

    // Atualizar role diretamente no banco usando SQL (mais confiável)
    // Isso atualiza tanto auth.users.raw_user_meta_data quanto user_profiles.role
    const { error: updateError } = await supabaseAdmin.rpc('update_user_role', {
      target_user_id: userId,
      new_role: role
    });

    if (updateError) {
      // Se a função RPC não existir, tentar método alternativo
      console.log('RPC not found, using alternative method');

      // Atualizar user_profiles primeiro
      const { error: profileUpdateError } = await supabaseAdmin
        .from('user_profiles')
        .update({ role: role })
        .eq('user_id', userId);

      if (profileUpdateError) {
        console.error('Error updating role in user_profiles:', profileUpdateError);
        return res.status(500).json({
          error: 'Erro ao atualizar role do usuário',
          code: 'PROFILE_UPDATE_FAILED'
        });
      }

      // Atualizar auth.users via SQL direto
      const { error: authUpdateError } = await supabaseAdmin
        .rpc('update_auth_user_metadata', {
          user_id: userId,
          metadata_key: 'role',
          metadata_value: role
        });

      if (authUpdateError) {
        console.error('Error updating auth metadata:', authUpdateError);
        // Não falhar, pois a atualização no profile já foi feita
        // O trigger deve sincronizar automaticamente
      }
    }

    // Resposta de sucesso
    const response: UpdateRoleResponse = {
      message: `Role atualizada para '${role}' com sucesso`,
      user: {
        id: targetUser.user.id,
        email: targetUser.user.email || '',
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
