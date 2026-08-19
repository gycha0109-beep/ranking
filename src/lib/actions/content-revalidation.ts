'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type RevalidationOutcome =
  | 'verified_unchanged'
  | 'updated'
  | 'source_changed'
  | 'source_unavailable'

export type RevalidationFreshnessState =
  | 'not_applicable'
  | 'never_reviewed'
  | 'attention_required'
  | 'overdue'
  | 'due_soon'
  | 'current'

export type RankingRevalidationStatus = {
  ranking_id: string
  ranking_status: string
  latest_review_id: string | null
  outcome: RevalidationOutcome | null
  verified_at: string | null
  next_review_at: string | null
  freshness_state: RevalidationFreshnessState
  review_note: string | null
  source_snapshot: Array<Record<string, unknown>> | null
}

export type RankingRevalidation = {
  id: string
  ranking_id: string
  outcome: RevalidationOutcome
  verified_at: string
  next_review_at: string
  review_note: string
  source_snapshot: Array<Record<string, unknown>>
  actor_id: string | null
  created_at: string
}

export async function getRankingRevalidationStatus(rankingId?: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_get_ranking_revalidation_status', {
    p_ranking_id: rankingId || null,
  })

  if (error) {
    return { error: error.message, data: [] as RankingRevalidationStatus[] }
  }

  return { data: (data || []) as RankingRevalidationStatus[] }
}

export async function listRankingRevalidations(rankingId: string, limit = 20) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_list_ranking_revalidations', {
    p_ranking_id: rankingId,
    p_limit: limit,
  })

  if (error) {
    return { error: error.message, data: [] as RankingRevalidation[] }
  }

  return { data: (data || []) as RankingRevalidation[] }
}

export async function recordRankingRevalidation(input: {
  rankingId: string
  outcome: RevalidationOutcome
  nextReviewAt: string
  reviewNote: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_record_ranking_revalidation', {
    p_ranking_id: input.rankingId,
    p_outcome: input.outcome,
    p_next_review_at: input.nextReviewAt,
    p_review_note: input.reviewNote,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/rankings')
  revalidatePath(`/admin/rankings/${input.rankingId}/revalidation`)
  return { success: true, data }
}
