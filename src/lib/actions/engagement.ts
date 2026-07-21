'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

export type BookmarkListItem = {
  targetType: EngagementTargetType
  targetId: string
  title: string
  slug: string
  summary: string | null
  imageUrl: string | null
  bookmarkedAt: string
}

function parseLikeSummary(data: unknown): LikeSummary {
  const value = (data || {}) as { liked?: unknown; like_count?: unknown }
  return {
    liked: value.liked === true,
    likeCount: Number.isFinite(Number(value.like_count)) ? Number(value.like_count) : 0,
  }
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
  const { data: { user } } = await supabase.auth.getUser()

  if (parsed.type === 'ranking') {
    const { data: ranking, error } = await supabase
      .from('rankings')
      .select('id, title')
      .eq('slug', parsed.slug)
      .eq('status', 'published')
      .in('moderation_status', ['clean', 'suggestive'])
      .in('image_moderation_status', ['clean', 'suggestive'])
      .maybeSingle()

    if (error || !ranking) return { target: null }

    const [{ data: likeSummary, error: likeError }, bookmarkResult] = await Promise.all([
      supabase.rpc('get_ranking_like_summary', { p_ranking_id: ranking.id }),
      user
        ? supabase.rpc('get_ranking_bookmark_state', { p_ranking_id: ranking.id })
        : Promise.resolve({ data: false, error: null }),
    ])

    if (likeError || bookmarkResult.error) return { target: null }

    return {
      target: {
        type: parsed.type,
        id: ranking.id,
        title: ranking.title,
        ...parseLikeSummary(likeSummary),
        bookmarked: bookmarkResult.data === true,
        authenticated: Boolean(user),
      },
    }
  }

  const { data: item, error } = await supabase
    .from('items')
    .select('id, title')
    .eq('slug', parsed.slug)
    .eq('status', 'active')
    .in('moderation_status', ['clean', 'suggestive'])
    .in('image_moderation_status', ['clean', 'suggestive'])
    .maybeSingle()

  if (error || !item) return { target: null }

  const [{ data: likeSummary, error: likeError }, bookmarkResult] = await Promise.all([
    supabase.rpc('get_item_like_summary', { p_item_id: item.id }),
    user
      ? supabase.rpc('get_item_bookmark_state', { p_item_id: item.id })
      : Promise.resolve({ data: false, error: null }),
  ])

  if (likeError || bookmarkResult.error) return { target: null }

  return {
    target: {
      type: parsed.type,
      id: item.id,
      title: item.title,
      ...parseLikeSummary(likeSummary),
      bookmarked: bookmarkResult.data === true,
      authenticated: Boolean(user),
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
