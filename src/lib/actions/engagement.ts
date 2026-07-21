'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type LikeTargetType = 'ranking' | 'item'

type LikeSummary = {
  liked: boolean
  likeCount: number
}

type LikeTarget = LikeSummary & {
  type: LikeTargetType
  id: string
  title: string
}

type LikeTargetResult = {
  target: LikeTarget | null
}

type LikeMutationResult = {
  success?: true
  liked?: boolean
  likeCount?: number
  error?: string
}

function parseLikeSummary(data: unknown): LikeSummary {
  const value = (data || {}) as { liked?: unknown; like_count?: unknown }
  return {
    liked: value.liked === true,
    likeCount: Number.isFinite(Number(value.like_count)) ? Number(value.like_count) : 0,
  }
}

function parseTargetPath(pathname: string): { type: LikeTargetType; slug: string } | null {
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

export async function getLikeTargetByPath(pathname: string): Promise<LikeTargetResult> {
  const parsed = parseTargetPath(pathname)
  if (!parsed) return { target: null }

  const supabase = await createClient()

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

    const { data: summary, error: summaryError } = await supabase.rpc('get_ranking_like_summary', {
      p_ranking_id: ranking.id,
    })
    if (summaryError) return { target: null }

    return {
      target: {
        type: parsed.type,
        id: ranking.id,
        title: ranking.title,
        ...parseLikeSummary(summary),
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

  const { data: summary, error: summaryError } = await supabase.rpc('get_item_like_summary', {
    p_item_id: item.id,
  })
  if (summaryError) return { target: null }

  return {
    target: {
      type: parsed.type,
      id: item.id,
      title: item.title,
      ...parseLikeSummary(summary),
    },
  }
}

export async function setContentLike(input: {
  targetType: LikeTargetType
  targetId: string
  liked: boolean
  pathname: string
}): Promise<LikeMutationResult> {
  const expectedPrefix = input.targetType === 'ranking' ? '/rankings/' : '/items/'
  const parsedPath = parseTargetPath(input.pathname)
  if (!parsedPath || parsedPath.type !== input.targetType || !input.pathname.startsWith(expectedPrefix)) {
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
