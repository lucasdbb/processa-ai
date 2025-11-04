import { Response } from 'express';
import { AuthenticatedRequest } from '../../../shared/middleware/authenticate.middleware.js';
import { supabaseAdmin } from '../../../infrastructure/supabase/client.js';
import { logger, createRequestContext } from '../../../infrastructure/monitoring/logger.js';

export async function listUsersHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Paginação
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

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
      res.status(500).json({
        error: 'Erro ao buscar usuários',
        code: 'USER_LIST_FAILED'
      });
      return;
    }

    // Buscar dados dos perfis
    const userIds = authUsers.users.map(u => u.id);

    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, document_type, document_number, phone, role')
      .in('user_id', userIds);

    // Criar mapa de perfis
    const profileMap = new Map();
    if (profiles) {
      profiles.forEach(p => profileMap.set(p.user_id, p));
    }

    // Combinar dados
    let users = authUsers.users.map(authUser => {
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
    res.status(200).json({
      users,
      total: users.length,
      page,
      limit
    });
  } catch (error) {
    throw error;
  }
}
