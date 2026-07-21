'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type LikeTargetType = 'ranking' | 'item'

type LikeSummary = {
  liked: boolean
  likeCount: number
}

function parseLikeSummary(data: unknown): LikeSummary {
  const value = (data || {}) as { liked?: unknown; like_count?: unknown }
  return {
    liked: value.liked === true,
    likeCount: Number.isFinite(Number(value.like_count)) ? Number(value.like_count) : 0,
  }
}

export async function getLikeTargetByPath(pathname: string) {
  const match = pathname.match(/^\/(rankings|items)\/([^/?#]+)$/)
  if (!match) return { target: null }

  const targetType: LikeTargetType = match[1] === 'rankings' ? 'ranking' : 'item'
  const slug = decodeURIComponent(match[2])
  const supabase = await createClient()

  if (targetType === 'ranking') {
    const { data: ranking, error } = await supabase
      .from('rankings')
      .select('id, title')
      .eq('slug', slug)
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
        type: targetType,
        id: ranking.id,
        title: ranking.title,
        ...parseLikeSummary(summary),
      },
    }
  }

  const { data: item, error } = await supabase
    .from('items')
    .select('id, title')
    .eq('slug', slug)
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
      type: targetType,
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
}) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'AUTH_REQUIRED' as const }

  const rpcName = input.targetType === 'ranking' ? 'set_ranking_like' : 'set_item_like'
  const idParam = input.targetType === 'ranking' ? 'p_ranking_id' : 'p_item_id'
  const { data, error } = await supabase.rpc(rpcName, {
    [idParam]: input.targetId,
    p_liked: input.liked,
  })

  if (error) {
    return { error: error.message }
  }

  if (input.pathname.startsWith('/')) revalidatePath(input.pathname)
  return { success: true, ...parseLikeSummary(data) }
}
