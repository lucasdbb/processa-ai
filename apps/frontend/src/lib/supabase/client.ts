import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase env vars ausentes: VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY'
    )
  }

  return createSupabaseClient(
    supabaseUrl,
    supabaseAnonKey
  )
}
