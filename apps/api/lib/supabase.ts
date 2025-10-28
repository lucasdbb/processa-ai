import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Cliente para operações administrativas (server-side)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Cliente para operações do usuário
export const createSupabaseClient = (accessToken?: string) => {
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseAnonKey) {
    throw new Error('Missing Supabase anon key');
  }

  const client = createClient(supabaseUrl, supabaseAnonKey);
  
  if (accessToken) {
    client.auth.setSession({
      access_token: accessToken,
      refresh_token: '',
    });
  }
  
  return client;
};