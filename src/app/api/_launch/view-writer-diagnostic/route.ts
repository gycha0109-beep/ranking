import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const INVALID_TARGET_ID = '00000000-0000-4000-8000-000000000000'

export async function GET() {
  if (process.env.VERCEL_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }

  const adminKeyConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!adminKeyConfigured) {
    return NextResponse.json({ adminKeyConfigured, restrictedRead: 'not-run', rpcProbe: 'not-run' })
  }

  const admin = createAdminClient()
  const restrictedReadResult = await admin
    .from('content_daily_views')
    .select('id', { head: true, count: 'exact' })

  const rpcProbeResult = await admin.rpc('record_ranking_daily_view', {
    p_ranking_id: INVALID_TARGET_ID,
    p_viewer_key_hash: 'a'.repeat(64),
    p_viewed_on: new Date().toISOString().slice(0, 10),
    p_key_version: 1,
  })

  return NextResponse.json({
    adminKeyConfigured,
    restrictedRead: restrictedReadResult.error
      ? { ok: false, code: restrictedReadResult.error.code || null }
      : { ok: true, count: restrictedReadResult.count ?? null },
    rpcProbe: rpcProbeResult.error
      ? { ok: false, code: rpcProbeResult.error.code || null }
      : { ok: true },
  })
}
