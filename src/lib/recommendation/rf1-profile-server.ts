import { createClient } from '@/lib/supabase/server'
import { adaptRf1ProfileEventRows, type Rf1ProfileEventRow } from './rf1-profile-adapter'

export async function loadOptionalMyRf1ProfileEvents(input: {
  since: string
  limit?: number
}) {
  if (!Number.isFinite(Date.parse(input.since))) throw new Error('RF-1 profile since must be an ISO-compatible timestamp')
  const limit = input.limit ?? 500
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('RF-1 profile limit must be an integer between 1 and 1000')

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return []

  const { data, error } = await supabase.rpc('get_rf1_my_profile_events', {
    p_since: new Date(input.since).toISOString(),
    p_limit: limit,
  })
  if (error) throw new Error(`failed to load RF-1 profile evidence: ${error.message}`)

  return adaptRf1ProfileEventRows((data || []) as Rf1ProfileEventRow[])
}
