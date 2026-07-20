'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ModerationEntityType =
  | 'ranking'
  | 'ranking_entry'
  | 'item'
  | 'ranking_image'
  | 'item_image'
  | 'comment'

export type ModerationDecisionStatus = 'clean' | 'suggestive' | 'needs_review' | 'blocked'
export type ModerationDecisionReason =
  | 'sexual_suggestive'
  | 'explicit_sexual'
  | 'minor_sexualization'
  | 'real_person_sexualization'
  | 'hate'
  | 'violence'
  | 'privacy'
  | 'illegal'
  | 'spam'
  | 'none'
  | 'system_error'

const RPC_BY_ENTITY: Record<ModerationEntityType, string> = {
  ranking: 'review_ranking_moderation',
  ranking_entry: 'review_ranking_entry_moderation',
  item: 'review_item_moderation',
  ranking_image: 'review_ranking_image_moderation',
  item_image: 'review_item_image_moderation',
  comment: 'review_comment_moderation',
}

const ID_PARAM_BY_ENTITY: Record<ModerationEntityType, string> = {
  ranking: 'p_ranking_id',
  ranking_entry: 'p_entry_id',
  item: 'p_item_id',
  ranking_image: 'p_ranking_id',
  item_image: 'p_item_id',
  comment: 'p_comment_id',
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('로그인이 필요합니다.')

  const { data: role, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (roleError || !role) throw new Error('관리자 권한이 없습니다.')
  return supabase
}

export async function reviewModerationTarget(input: {
  entityType: ModerationEntityType
  entityId: string
  decisionStatus: ModerationDecisionStatus
  decisionReason: ModerationDecisionReason
  note?: string
  rankingId?: string
}) {
  try {
    const supabase = await requireAdmin()
    const rpcName = RPC_BY_ENTITY[input.entityType]
    const idParam = ID_PARAM_BY_ENTITY[input.entityType]
    const { error } = await supabase.rpc(rpcName, {
      [idParam]: input.entityId,
      p_decision_status: input.decisionStatus,
      p_decision_reason: input.decisionStatus === 'clean' ? 'none' : input.decisionReason,
      p_note: input.note?.trim() || null,
    })

    if (error) return { error: `Moderation 검토 실패: ${error.message}` }

    revalidatePath('/', 'layout')
    if (input.rankingId) revalidatePath(`/admin/rankings/${input.rankingId}/preview`)
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Moderation 검토에 실패했습니다.' }
  }
}

export async function listModerationReviews(entityIds: string[]) {
  try {
    const supabase = await requireAdmin()
    if (entityIds.length === 0) return { data: [] }

    const { data, error } = await supabase
      .from('moderation_reviews')
      .select('id, entity_type, entity_id, previous_status, previous_reason, decision_status, decision_reason, review_note, decision_source, reviewed_by, reviewed_at, metadata')
      .in('entity_id', entityIds)
      .order('reviewed_at', { ascending: false })
      .limit(100)

    if (error) return { error: error.message, data: [] }
    return { data: data || [] }
  } catch (error) {
    return { error: error instanceof Error ? error.message : '검토 이력을 불러오지 못했습니다.', data: [] }
  }
}
