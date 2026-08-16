'use server'

import { createHmac, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPublicClient } from '@/lib/supabase/public'

type EngagementTargetType = 'ranking' | 'item'

type LikeSummary = {
  liked: boolean
  likeCount: number
}

type EngagementTarget = LikeSummary & {
  type: EngagementTargetType
  id: string
  title: string
  bookmarked: boolean
  authenticated: boolean
  uniqueViewCount: number
}

type EngagementTargetResult = {
  target: EngagementTarget | null
}

type LikeMutationResult = {
  success?: true
  liked?: boolean
  likeCount?: number
  error?: string
}

type BookmarkMutationResult = {
  success?: true
  bookmarked?: boolean
  error?: string
}

type ViewMutationResult = {
  success?: true
  inserted?: boolean
  uniqueViewCount?: number
  error?: string
}

export type BookmarkListItem = {
  targetType: EngagementTargetType
  targetId: string
  title: string
  slug: string
  summary: string | null
  imageUrl: string | null
  bookmarkedAt: string
}

const VIEWER_COOKIE = 'rw_viewer_v1'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseLikeSummary(data: unknown): LikeSummary {
  const value = (data || {}) as { liked?: unknown; like_count?: unknown }
  return {
    liked: value.liked === true,
    likeCount: Number.isFinite(Number(value.like_count)) ? Number(value.like_count) : 0,
  }
}

function parseCount(data: unknown) {
  return Number.isFinite(Number(data)) ? Math.max(0, Number(data)) : 0
}

function parseTargetPath(pathname: string): { type: EngagementTargetType; slug: string } | null {
  const match = pathname.match(/^\/(rankings|items)\/([^/?#]+)$/)
  if (!match) return null

  try {
    return {
      type: match[1] === 'rankings' ? 'ranking' : 'item',
      slug: decodeURIComponent(match[2]),
    }
  } catch {
    return null
  }
}

export async function getEngagementTargetByPath(pathname: string): Promise<EngagementTargetResult> {
  const parsed = parseTargetPath(pathname)
  if (!parsed) return { target: null }

  const supabase = await createClient()
  const publicSupabase = createPublicClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (parsed.type === 'ranking') {
    const { data: ranking, error } = await publicSupabase
      .from('rankings')
      .select('id, title')
      .eq('slug', parsed.slug)
      .eq('status', 'published')
      .in('moderation_status', ['clean', 'suggestive'])
      .in('image_moderation_status', ['clean', 'suggestive'])
      .maybeSingle()

    if (error || !ranking) return { target: null }

    const [likeResult, bookmarkResult, viewResult] = await Promise.all([
      supabase.rpc('get_ranking_like_summary', { p_ranking_id: ranking.id }),
      user
        ? supabase.rpc('get_ranking_bookmark_state', { p_ranking_id: ranking.id })
        : Promise.resolve({ data: false, error: null }),
      supabase.rpc('get_ranking_unique_view_count', { p_ranking_id: ranking.id }),
    ])

    if (likeResult.error || bookmarkResult.error) return { target: null }

    return {
      target: {
        type: parsed.type,
        id: ranking.id,
        title: ranking.title,
        ...parseLikeSummary(likeResult.data),
        bookmarked: bookmarkResult.data === true,
        authenticated: Boolean(user),
        uniqueViewCount: viewResult.error ? 0 : parseCount(viewResult.data),
      },
    }
  }

  const { data: item, error } = await publicSupabase
    .from('items')
    .select('id, title')
    .eq('slug', parsed.slug)
    .eq('status', 'active')
    .in('moderation_status', ['clean', 'suggestive'])
    .in('image_moderation_status', ['clean', 'suggestive'])
    .maybeSingle()

  if (error || !item) return { target: null }

  const [likeResult, bookmarkResult, viewResult] = await Promise.all([
    supabase.rpc('get_item_like_summary', { p_item_id: item.id }),
    user
      ? supabase.rpc('get_item_bookmark_state', { p_item_id: item.id })
      : Promise.resolve({ data: false, error: null }),
    supabase.rpc('get_item_unique_view_count', { p_item_id: item.id }),
  ])

  if (likeResult.error || bookmarkResult.error) return { target: null }

  return {
    target: {
      type: parsed.type,
      id: item.id,
      title: item.title,
      ...parseLikeSummary(likeResult.data),
      bookmarked: bookmarkResult.data === true,
      authenticated: Boolean(user),
      uniqueViewCount: viewResult.error ? 0 : parseCount(viewResult.data),
    },
  }
}

export async function getLikeTargetByPath(pathname: string): Promise<EngagementTargetResult> {
  return getEngagementTargetByPath(pathname)
}

function validateMutationPath(pathname: string, targetType: EngagementTargetType) {
  const parsed = parseTargetPath(pathname)
  return parsed?.type === targetType
}

export async function setContentLike(input: {
  targetType: EngagementTargetType
  targetId: string
  liked: boolean
  pathname: string
}): Promise<LikeMutationResult> {
  if (!validateMutationPath(input.pathname, input.targetType)) {
    return { error: '좋아요 요청 경로가 올바르지 않습니다.' }
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'AUTH_REQUIRED' }

  const rpcName = input.targetType === 'ranking' ? 'set_ranking_like' : 'set_item_like'
  const idParam = input.targetType === 'ranking' ? 'p_ranking_id' : 'p_item_id'
  const { data, error } = await supabase.rpc(rpcName, {
    [idParam]: input.targetId,
    p_liked: input.liked,
  })

  if (error) return { error: error.message }

  revalidatePath(input.pathname)
  return { success: true, ...parseLikeSummary(data) }
}

export async function setContentBookmark(input: {
  targetType: EngagementTargetType
  targetId: string
  bookmarked: boolean
  pathname: string
}): Promise<BookmarkMutationResult> {
  if (!validateMutationPath(input.pathname, input.targetType)) {
    return { error: '북마크 요청 경로가 올바르지 않습니다.' }
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'AUTH_REQUIRED' }

  const rpcName = input.targetType === 'ranking' ? 'set_ranking_bookmark' : 'set_item_bookmark'
  const idParam = input.targetType === 'ranking' ? 'p_ranking_id' : 'p_item_id'
  const { data, error } = await supabase.rpc(rpcName, {
    [idParam]: input.targetId,
    p_bookmarked: input.bookmarked,
  })

  if (error) return { error: error.message }

  const value = (data || {}) as { bookmarked?: unknown }
  revalidatePath(input.pathname)
  revalidatePath('/me/bookmarks')
  return { success: true, bookmarked: value.bookmarked === true }
}

function currentUtcDate() {
  return new Date().toISOString().slice(0, 10)
}

function deriveViewerHash(secret: string, dateBucket: string, kind: 'user' | 'anonymous', identity: string) {
  const input = ['ranking-wiki-view:v1', dateBucket, kind, identity].join('\n')
  return createHmac('sha256', secret).update(input).digest('hex')
}

async function verifyTargetMatchesPath(
  targetType: EngagementTargetType,
  targetId: string,
  pathname: string,
) {
  const parsed = parseTargetPath(pathname)
  if (!parsed || parsed.type !== targetType || !UUID_PATTERN.test(targetId)) return false

  const publicSupabase = createPublicClient()
  const table = targetType === 'ranking' ? 'rankings' : 'items'
  const status = targetType === 'ranking' ? 'published' : 'active'

  const { data, error } = await publicSupabase
    .from(table)
    .select('id')
    .eq('id', targetId)
    .eq('slug', parsed.slug)
    .eq('status', status)
    .in('moderation_status', ['clean', 'suggestive'])
    .in('image_moderation_status', ['clean', 'suggestive'])
    .maybeSingle()

  return !error && data?.id === targetId
}

export async function recordContentView(input: {
  targetType: EngagementTargetType
  targetId: string
  pathname: string
}): Promise<ViewMutationResult> {
  if (!(await verifyTargetMatchesPath(input.targetType, input.targetId, input.pathname))) {
    return { error: '조회수 요청 대상이 올바르지 않습니다.' }
  }

  const secret = process.env.VIEWER_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || secret.length < 32) {
    return { error: '조회수 기록 서버 설정이 완료되지 않았습니다.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const cookieStore = await cookies()

  let kind: 'user' | 'anonymous' = 'user'
  let identity = user?.id || ''

  if (!user) {
    kind = 'anonymous'
    const existing = cookieStore.get(VIEWER_COOKIE)?.value
    identity = existing && UUID_PATTERN.test(existing) ? existing : randomUUID()

    if (identity !== existing) {
      cookieStore.set(VIEWER_COOKIE, identity, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 400,
      })
    }
  }

  const admin = createAdminClient()
  const rpcName = input.targetType === 'ranking'
    ? 'record_ranking_daily_view'
    : 'record_item_daily_view'
  const idParam = targetType => targetType
  const rpcIdParam = input.targetType === 'ranking' ? 'p_ranking_id' : 'p_item_id'

  const execute = async (dateBucket: string) => admin.rpc(rpcName, {
    [rpcIdParam]: input.targetId,
    p_viewer_key_hash: deriveViewerHash(secret, dateBucket, kind, identity),
    p_viewed_on: dateBucket,
    p_key_version: 1,
  })

  let dateBucket = currentUtcDate()
  let result = await execute(dateBucket)

  const refreshedDate = currentUtcDate()
  if (result.error && refreshedDate !== dateBucket) {
    dateBucket = refreshedDate
    result = await execute(dateBucket)
  }

  if (result.error) return { error: '조회수를 기록하지 못했습니다.' }

  const value = (result.data || {}) as { inserted?: unknown; unique_view_count?: unknown }
  return {
    success: true,
    inserted: value.inserted === true,
    uniqueViewCount: parseCount(value.unique_view_count),
  }
}

export async function listMyBookmarks(): Promise<BookmarkListItem[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase.rpc('list_my_bookmarks', {
    p_limit: 100,
    p_offset: 0,
  })
  if (error) throw new Error(error.message)

  return (data || []).map((row: any) => ({
    targetType: row.target_type,
    targetId: row.target_id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    imageUrl: row.image_url,
    bookmarkedAt: row.bookmarked_at,
  }))
}
