import { VercelResponse } from '@vercel/node';
import { AuthenticatedRequest, compose, withAuth, withCors } from '../../lib/auth.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { CommonErrors } from '../../lib/errors.js';

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

const listUsersHandler = async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json(CommonErrors.METHOD_NOT_ALLOWED(['GET']));
  }

  try {
    // Verificar se o usuário autenticado é admin
    const currentUser = req.user;
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({
        error: 'Acesso negado. Apenas administradores podem listar usuários.',
        code: 'FORBIDDEN'
      });
    }

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
      console.error('Error listing users:', authError);
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
      console.error('Error fetching profiles:', profileError);
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
    console.error('Unexpected list users error:', error);
    return res.status(500).json(CommonErrors.INTERNAL_ERROR());
  }
};

export default compose(withCors, withAuth)(listUsersHandler);
