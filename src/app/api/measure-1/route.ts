import { createHmac, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, getSupabaseAdminKey } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const VIEWER_COOKIE = 'rw_viewer_v1'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TARGET_PATTERN = /^\/(rankings|items)\/([^/?#]+)$/
const CATEGORY_PATTERN = /^\/categories\/([^/?#]+)(?:\/[^/?#]+)?$/
const SENSITIVE_QUERY_PATTERNS = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /(?:https?:\/\/|www\.)/i,
  /\b\d{6}-?\d{7}\b/,
  /\b\d{2,4}[- .]?\d{3,4}[- .]?\d{4}\b/,
]

type Target = { rankingId: string | null; itemId: string | null }
type Source = {
  discoverySource: 'home' | 'category' | 'search' | 'related_ranking' | 'ranking_item' | 'item_ranking'
  sourceRankingId: string | null
  sourceItemId: string | null
  sourceCategoryId: string | null
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function utcDate() {
  return new Date().toISOString().slice(0, 10)
}

function telemetrySecret() {
  return process.env.VIEWER_HASH_SECRET || getSupabaseAdminKey() || null
}

function hashValue(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('hex')
}

function normalizePath(value: unknown) {
  if (typeof value !== 'string') return null
  const path = value.trim()
  if (!path.startsWith('/') || path.length > 240 || path.includes('://')) return null
  return path.split('?')[0].split('#')[0]
}

function normalizeQuery(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
  if (normalized.length < 2 || normalized.length > 120) return null
  return normalized
}

function retainedQueryText(query: string) {
  if (query.length > 80 || SENSITIVE_QUERY_PATTERNS.some((pattern) => pattern.test(query))) return null
  return query
}

function normalizeUuid(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return UUID_PATTERN.test(normalized) ? normalized : null
}

function normalizeRecommendationExposureId(value: unknown) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 320 || value.trim() !== value) return null
  return value
}

function normalizePosition(value: unknown) {
  const position = Number(value)
  return Number.isInteger(position) && position >= 1 && position <= 100 ? position : null
}

function normalizeResultCount(value: unknown) {
  const count = Number(value)
  return Number.isInteger(count) && count >= 0 && count <= 1000 ? count : null
}

async function resolveTarget(path: string): Promise<Target | null> {
  const match = path.match(TARGET_PATTERN)
  if (!match) return null

  let slug: string
  try {
    slug = decodeURIComponent(match[2])
  } catch {
    return null
  }

  const admin = createAdminClient()
  if (match[1] === 'rankings') {
    const { data, error } = await admin
      .from('rankings')
      .select('id')
      .eq('slug', slug)
      .eq('status', 'published')
      .in('moderation_status', ['clean', 'suggestive'])
      .in('image_moderation_status', ['clean', 'suggestive'])
      .maybeSingle()
    if (error || !data) return null
    return { rankingId: data.id, itemId: null }
  }

  const { data, error } = await admin
    .from('items')
    .select('id')
    .eq('slug', slug)
    .eq('status', 'active')
    .in('moderation_status', ['clean', 'suggestive'])
    .in('image_moderation_status', ['clean', 'suggestive'])
    .maybeSingle()
  if (error || !data) return null
  return { rankingId: null, itemId: data.id }
}

async function resolveSource(sourcePath: string, targetPath: string): Promise<Source | null> {
  if (sourcePath === '/') {
    return { discoverySource: 'home', sourceRankingId: null, sourceItemId: null, sourceCategoryId: null }
  }

  if (sourcePath === '/search') {
    return { discoverySource: 'search', sourceRankingId: null, sourceItemId: null, sourceCategoryId: null }
  }

  const categoryMatch = sourcePath.match(CATEGORY_PATTERN)
  if (categoryMatch) {
    const admin = createAdminClient()
    let slug: string
    try {
      slug = decodeURIComponent(categoryMatch[1])
    } catch {
      return null
    }
    const { data, error } = await admin.from('categories').select('id').eq('slug', slug).eq('is_visible', true).maybeSingle()
    if (error || !data) return null
    return {
      discoverySource: 'category',
      sourceRankingId: null,
      sourceItemId: null,
      sourceCategoryId: data.id,
    }
  }

  const sourceTarget = await resolveTarget(sourcePath)
  if (!sourceTarget) return null
  const targetMatch = targetPath.match(TARGET_PATTERN)
  if (!targetMatch) return null

  if (sourceTarget.rankingId) {
    return {
      discoverySource: targetMatch[1] === 'items' ? 'ranking_item' : 'related_ranking',
      sourceRankingId: sourceTarget.rankingId,
      sourceItemId: null,
      sourceCategoryId: null,
    }
  }

  if (sourceTarget.itemId && targetMatch[1] === 'rankings') {
    return {
      discoverySource: 'item_ranking',
      sourceRankingId: null,
      sourceItemId: sourceTarget.itemId,
      sourceCategoryId: null,
    }
  }

  return null
}

async function getViewerContext(secret: string) {
  const cookieStore = await cookies()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let anonymousId = cookieStore.get(VIEWER_COOKIE)?.value || ''
  if (!UUID_PATTERN.test(anonymousId)) {
    anonymousId = randomUUID()
    cookieStore.set(VIEWER_COOKIE, anonymousId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 400,
    })
  }

  const sourceIdentity = user ? `u:${user.id}` : `a:${anonymousId.toLowerCase()}`
  const occurredOn = utcDate()
  const viewerKeyHash = hashValue(secret, `${occurredOn}:${sourceIdentity}`)
  const explicitClass = typeof user?.app_metadata?.telemetry_class === 'string'
    ? user.app_metadata.telemetry_class
    : ''
  const email = (user?.email || '').toLowerCase()
  const trafficClass = explicitClass === 'qa_internal' || email.endsWith('@example.com')
    ? 'qa_internal'
    : 'unknown'

  return { viewerKeyHash, occurredOn, trafficClass }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin) {
    try {
      if (new URL(origin).host !== request.nextUrl.host) return jsonError('cross-origin telemetry is not accepted', 403)
    } catch {
      return jsonError('invalid origin', 403)
    }
  }

  const secret = telemetrySecret()
  if (!secret) return jsonError('telemetry server secret is unavailable', 503)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('invalid json body', 400)
  }
  if (!isPlainObject(body)) return jsonError('invalid event body', 400)

  const kind = typeof body.kind === 'string' ? body.kind : ''
  const clientEventId = normalizeUuid(body.clientEventId)
  if (!clientEventId) return jsonError('invalid client event id', 400)

  const viewer = await getViewerContext(secret)
  const admin = createAdminClient()
  let recommendationExposureId: string | null = null
  const args: Record<string, unknown> = {
    p_client_event_id: clientEventId,
    p_event_type: null,
    p_traffic_class: viewer.trafficClass,
    p_viewer_key_hash: viewer.viewerKeyHash,
    p_occurred_on: viewer.occurredOn,
    p_search_id: null,
    p_query_hash: null,
    p_query_text: null,
    p_result_count: null,
    p_zero_result: null,
    p_ranking_id: null,
    p_item_id: null,
    p_selected_position: null,
    p_discovery_source: null,
    p_source_ranking_id: null,
    p_source_item_id: null,
    p_source_category_id: null,
  }

  if (kind === 'search') {
    const query = normalizeQuery(body.query)
    const searchId = normalizeUuid(body.searchId)
    const resultCount = normalizeResultCount(body.resultCount)
    if (!query || !searchId || resultCount === null) return jsonError('invalid search event', 400)
    args.p_event_type = 'search'
    args.p_search_id = searchId
    args.p_query_hash = hashValue(secret, `q:${query}`)
    args.p_query_text = retainedQueryText(query)
    args.p_result_count = resultCount
    args.p_zero_result = resultCount === 0
  } else if (kind === 'content_view') {
    const targetPath = normalizePath(body.targetPath)
    if (!targetPath) return jsonError('invalid content target', 400)
    const target = await resolveTarget(targetPath)
    if (!target) return jsonError('public content target not found', 404)
    args.p_event_type = 'content_view'
    args.p_ranking_id = target.rankingId
    args.p_item_id = target.itemId
  } else if (kind === 'search_result_click') {
    const query = normalizeQuery(body.query)
    const searchId = normalizeUuid(body.searchId)
    const targetPath = normalizePath(body.targetPath)
    const sourcePath = normalizePath(body.sourcePath)
    const selectedPosition = normalizePosition(body.selectedPosition)
    if (!query || !searchId || !targetPath || sourcePath !== '/search' || selectedPosition === null) {
      return jsonError('invalid search click event', 400)
    }
    const target = await resolveTarget(targetPath)
    if (!target) return jsonError('public content target not found', 404)
    args.p_event_type = 'search_result_click'
    args.p_search_id = searchId
    args.p_query_hash = hashValue(secret, `q:${query}`)
    args.p_ranking_id = target.rankingId
    args.p_item_id = target.itemId
    args.p_selected_position = selectedPosition
    args.p_discovery_source = 'search'
  } else if (kind === 'content_discovery_click') {
    const targetPath = normalizePath(body.targetPath)
    const sourcePath = normalizePath(body.sourcePath)
    if (!targetPath || !sourcePath || targetPath === sourcePath) return jsonError('invalid discovery event', 400)
    const [target, source] = await Promise.all([
      resolveTarget(targetPath),
      resolveSource(sourcePath, targetPath),
    ])
    if (!target || !source || source.discoverySource === 'search') return jsonError('unsupported discovery path', 400)

    if (body.recommendationExposureId !== undefined) {
      recommendationExposureId = normalizeRecommendationExposureId(body.recommendationExposureId)
      if (!recommendationExposureId) return jsonError('invalid recommendation exposure id', 400)
      if (source.discoverySource !== 'related_ranking' || !target.rankingId || !source.sourceRankingId) {
        return jsonError('RF-1 exposure attribution requires a ranking-to-ranking discovery click', 400)
      }
    }

    args.p_event_type = 'content_discovery_click'
    args.p_ranking_id = target.rankingId
    args.p_item_id = target.itemId
    args.p_discovery_source = source.discoverySource
    args.p_source_ranking_id = source.sourceRankingId
    args.p_source_item_id = source.sourceItemId
    args.p_source_category_id = source.sourceCategoryId
  } else {
    return jsonError('unsupported event kind', 400)
  }

  if (recommendationExposureId) {
    const { data, error } = await admin.rpc('record_rf1_related_discovery_click', {
      p_client_event_id: clientEventId,
      p_traffic_class: viewer.trafficClass,
      p_viewer_key_hash: viewer.viewerKeyHash,
      p_occurred_on: viewer.occurredOn,
      p_ranking_id: args.p_ranking_id,
      p_source_ranking_id: args.p_source_ranking_id,
      p_exposure_id: recommendationExposureId,
    })
    if (error) {
      console.error('RF-1E attributed telemetry write failed', { code: error.code, eventType: args.p_event_type })
      return jsonError('telemetry write failed', 500)
    }
    return NextResponse.json(data || { inserted: false, attributed: false }, { status: 200 })
  }

  const { data, error } = await admin.rpc('record_product_usage_event', args)
  if (error) {
    console.error('MEASURE-1 telemetry write failed', { code: error.code, eventType: args.p_event_type })
    return jsonError('telemetry write failed', 500)
  }

  return NextResponse.json(data || { inserted: false }, { status: 200 })
}
