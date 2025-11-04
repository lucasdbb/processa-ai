import { supabaseAdmin } from '../../../infrastructure/supabase/client.js';

export async function getUserData(userId: string) {
  try {
    // Buscar dados do usuário usando admin client
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error || !data.user) {
      return null;
    }

    const user = data.user;

    // Buscar dados do perfil
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('document_type, document_number, phone, role, full_name')
      .eq('user_id', userId)
      .single();

    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || profile?.full_name || '',
      role: user.user_metadata?.role || profile?.role || 'user',
      avatar: user.user_metadata?.avatar,
      phone: user.user_metadata?.phone || profile?.phone,
      document_type: profile?.document_type,
      document_number: profile?.document_number,
      created_at: user.created_at,
      email_verified: user.email_confirmed_at !== null,
      last_sign_in: user.last_sign_in_at
    };
  } catch (error) {
    return null;
  }
}
