import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const INVALID_TARGET_ID = '00000000-0000-4000-8000-000000000000'

function classifyFailure(error: unknown) {
  if (!(error instanceof Error)) return 'unknown'
  const message = error.message.toLowerCase()
  if (message.includes('supabaseurl') || message.includes('url is required')) return 'missing-url'
  if (message.includes('supabasekey') || message.includes('key is required')) return 'missing-key'
  return error.name || 'unknown'
}

export async function GET() {
  if (process.env.VERCEL_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }

  try {
    const admin = createAdminClient()
    const restrictedRead = await admin
      .from('content_daily_views')
      .select('id', { head: true, count: 'exact' })

    const rpcProbe = await admin.rpc('record_ranking_daily_view', {
      p_ranking_id: INVALID_TARGET_ID,
      p_viewer_key_hash: 'a'.repeat(64),
      p_viewed_on: new Date().toISOString().slice(0, 10),
      p_key_version: 1,
    })

    return NextResponse.json({
      restrictedReadOk: !restrictedRead.error,
      restrictedReadCode: restrictedRead.error?.code || null,
      rpcReachedDatabase: rpcProbe.error?.code === 'P0002',
      rpcCode: rpcProbe.error?.code || null,
    })
  } catch (error) {
    return NextResponse.json({
      restrictedReadOk: false,
      rpcReachedDatabase: false,
      failure: classifyFailure(error),
    }, { status: 503 })
  }
}
