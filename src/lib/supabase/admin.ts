import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdminKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
}

export function createAdminClient() {
  const secretKey = getSupabaseAdminKey()
  if (!secretKey) throw new Error('Supabase server key is required')

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
