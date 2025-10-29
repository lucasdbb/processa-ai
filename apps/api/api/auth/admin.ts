import { VercelResponse } from '@vercel/node';
import { AuthenticatedRequest, compose, withAuth, withCors } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { CommonErrors } from '../../lib/errors.js';
import { logger, createRequestContext } from '../../lib/logger.js';

// ==================== TYPES ====================

interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar_url: string | null;
  document_type: string | null;
  document_number: string | null;
  phone: string | null;
  email_verified: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

interface ListUsersResponse {
  users: UserListItem[];
  total: number;
  page: number;
  limit: number;
}

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

// ==================== MIDDLEWARE ====================

/**
 * Middleware para verificar se usuário é admin
 */
const requireAdmin = (handler: (req: AuthenticatedRequest, res: VercelResponse) => Promise<any>) => {
  return async (req: AuthenticatedRequest, res: VercelResponse) => {
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({
        error: 'Acesso negado. Apenas administradores podem acessar este recurso.',
        code: 'FORBIDDEN'
      });
    }
    return handler(req, res);
  };
};

// ==================== HANDLERS ====================

/**
 * GET /auth/admin?action=list-users
 * Lista todos os usuários (apenas admin)
 */
const handleListUsers = async (req: AuthenticatedRequest, res: VercelResponse) => {
  try {
    // Paginação (query params)
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100

    // Filtros opcionais
    const roleFilter = req.query.role as string | undefined;
    const searchQuery = req.query.search as string | undefined;

    // Buscar usuários do auth.users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: limit
    });

    if (authError) {
      const context = createRequestContext(req);
      logger.error('Error listing users', context, authError as Error);
      return res.status(500).json({
        error: 'Erro ao buscar usuários',
        code: 'USER_LIST_FAILED'
      });
    }

    // Buscar dados dos perfis
    const userIds = authUsers.users.map(u => u.id);

    let profileQuery = supabaseAdmin
      .from('user_profiles')
      .select('user_id, document_type, document_number, phone, role')
      .in('user_id', userIds);

    const { data: profiles, error: profileError } = await profileQuery;

    if (profileError) {
      const context = createRequestContext(req);
      logger.error('Error fetching profiles', context, profileError as Error);
    }

    // Criar mapa de perfis para acesso rápido
    const profileMap = new Map();
    if (profiles) {
      profiles.forEach(p => profileMap.set(p.user_id, p));
    }

    // Combinar dados
    let users: UserListItem[] = authUsers.users.map(authUser => {
      const profile = profileMap.get(authUser.id);
      const role = authUser.user_metadata?.role || profile?.role || 'user';

      return {
        id: authUser.id,
        email: authUser.email || '',
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || '',
        role: role,
        avatar_url: authUser.user_metadata?.avatar_url || null,
        document_type: profile?.document_type || null,
        document_number: profile?.document_number || null,
        phone: authUser.user_metadata?.phone || profile?.phone || null,
        email_verified: authUser.email_confirmed_at !== null,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at || null
      };
    });

    // Aplicar filtros
    if (roleFilter) {
      users = users.filter(u => u.role === roleFilter);
    }

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      users = users.filter(u =>
        u.email.toLowerCase().includes(searchLower) ||
        u.name.toLowerCase().includes(searchLower)
      );
    }

    // Resposta
    const response: ListUsersResponse = {
      users,
      total: users.length,
      page,
      limit
    };

    return res.status(200).json(response);

  } catch (error) {
    const context = createRequestContext(req);
    logger.error('Unexpected list users error', context, error as Error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

/**
 * PATCH/PUT /auth/admin?action=update-role
 * Atualiza role de um usuário (apenas admin)
 */
const handleUpdateRole = async (req: AuthenticatedRequest, res: VercelResponse) => {
  try {
    const currentUser = req.user!;
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

    const context = createRequestContext(req);

    // Atualizar role diretamente no banco usando SQL (mais confiável)
    const { error: updateError } = await supabaseAdmin.rpc('update_user_role', {
      target_user_id: userId,
      new_role: role
    });

    if (updateError) {
      // Se a função RPC não existir, tentar método alternativo
      logger.info('RPC not found, using alternative method', context);

      // Atualizar user_profiles primeiro
      const { error: profileUpdateError } = await supabaseAdmin
        .from('user_profiles')
        .update({ role: role })
        .eq('user_id', userId);

      if (profileUpdateError) {
        logger.error('Error updating role in user_profiles', context, profileUpdateError as Error);
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
        logger.error('Error updating auth metadata', context, authUpdateError as Error);
        // Não falhar, pois a atualização no profile já foi feita
      }
    }

    // Log de segurança
    logger.security('User role updated', {
      ...context,
      targetUserId: userId,
      targetEmail: targetUser.user.email,
      oldRole: targetUser.user.user_metadata?.role || 'user',
      newRole: role,
      adminId: currentUser.id,
      adminEmail: currentUser.email
    });

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
    const context = createRequestContext(req);
    logger.error('Unexpected update role error', context, error as Error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

// ==================== MAIN HANDLER ====================

const adminHandler = async (req: AuthenticatedRequest, res: VercelResponse) => {
  const action = (req.query.action as string) || 'list-users';

  switch (action) {
    case 'list-users':
      if (req.method !== 'GET') {
        return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['GET']));
      }
      return handleListUsers(req, res);

    case 'update-role':
      if (req.method !== 'PATCH' && req.method !== 'PUT') {
        return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['PATCH', 'PUT']));
      }
      return handleUpdateRole(req, res);

    default:
      return res.status(400).json({
        error: 'Ação inválida. Use: list-users ou update-role',
        code: 'INVALID_ACTION'
      });
  }
};

// ==================== EXPORT ====================

export default compose(withCors, withAuth, requireAdmin)(adminHandler);
