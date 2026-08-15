'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function cleanPath(pathname: string) {
  return pathname.startsWith('/') ? pathname : '/'
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { supabase, error: '로그인이 필요합니다.' as string | null }
  return { supabase, error: null as string | null }
}

export async function finalizeRankingVote(rankingId: string, reason: string, pathname: string) {
  const { supabase, error: authError } = await requireUser()
  if (authError) return { error: authError }

  const cleanReason = reason.trim()
  if (cleanReason.length < 5 || cleanReason.length > 1000) {
    return { error: '확정 사유는 5자 이상 1000자 이하로 입력해 주세요.' }
  }

  const { data, error } = await supabase.rpc('finalize_ranking_vote', {
    p_ranking_id: rankingId,
    p_reason: cleanReason,
  })

  if (error) return { error: error.message }

  revalidatePath(cleanPath(pathname))
  return {
    success: true,
    revisionId: String((data as any)?.revision_id || ''),
    revisionNumber: Number((data as any)?.revision_number || 0),
    changedCount: Number((data as any)?.changed_count || 0),
  }
}

export async function voidRankingVoteRound(rankingId: string, reason: string, pathname: string) {
  const { supabase, error: authError } = await requireUser()
  if (authError) return { error: authError }

  const cleanReason = reason.trim()
  if (cleanReason.length < 5 || cleanReason.length > 1000) {
    return { error: '폐기 사유는 5자 이상 1000자 이하로 입력해 주세요.' }
  }

  const { data, error } = await supabase.rpc('void_ranking_vote_round', {
    p_ranking_id: rankingId,
    p_reason: cleanReason,
  })

  if (error) return { error: error.message }

  revalidatePath(cleanPath(pathname))
  return {
    success: true,
    revisionId: String((data as any)?.revision_id || ''),
    revisionNumber: Number((data as any)?.revision_number || 0),
  }
}
