import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env.js';

/**
 * Supabase Admin Client (service key)
 * Use apenas em operações server-side que precisam de privilégios elevados
 */
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Cria cliente Supabase com access token do usuário
 * Use para operações que devem respeitar RLS policies
 */
export function createSupabaseClient(accessToken: string): SupabaseClient {
  return createClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
