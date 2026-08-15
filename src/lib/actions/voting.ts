'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function cleanPath(pathname: string) {
  return pathname.startsWith('/') ? pathname : '/'
}

export async function castRankingVote(rankingId: string, itemId: string, pathname: string) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) return { error: '로그인이 필요합니다.' }

  const { data, error } = await supabase.rpc('set_ranking_vote', {
    p_ranking_id: rankingId,
    p_item_id: itemId,
  })

  if (error) return { error: error.message }

  revalidatePath(cleanPath(pathname))
  return { success: true, itemId: (data as any)?.item_id || itemId }
}

export async function clearRankingVote(rankingId: string, pathname: string) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) return { error: '로그인이 필요합니다.' }

  const { error } = await supabase.rpc('clear_ranking_vote', {
    p_ranking_id: rankingId,
  })

  if (error) return { error: error.message }

  revalidatePath(cleanPath(pathname))
  return { success: true }
}

export async function setRankingVotingState(
  rankingId: string,
  state: 'open' | 'closed',
  pathname: string,
) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) return { error: '로그인이 필요합니다.' }

  const { data, error } = await supabase.rpc('set_ranking_voting_state', {
    p_ranking_id: rankingId,
    p_state: state,
  })

  if (error) return { error: error.message }

  revalidatePath(cleanPath(pathname))
  return { success: true, state: (data as any)?.state || state }
}
