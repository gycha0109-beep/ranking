import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdminKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
}

// Existing server-only consumers still read the legacy variable directly.
// Bridge the current Secret-key variable in-process until those call sites are
// migrated without requiring duplicate secret configuration in the host.
const configuredAdminKey = getSupabaseAdminKey()
if (configuredAdminKey && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = configuredAdminKey
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
