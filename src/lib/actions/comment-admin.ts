'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  reviewModerationTarget,
  type ModerationDecisionReason,
  type ModerationDecisionStatus,
} from '@/lib/actions/moderation-reviews'

export type CommentModerationReview = {
  id: string
  previousStatus: string
  previousReason: string
  decisionStatus: string
  decisionReason: string
  reviewNote: string | null
  decisionSource: string
  reviewedAt: string
}

export type CommentModerationQueueItem = {
  commentId: string
  body: string
  lifecycleStatus: string
  moderationStatus: string
  moderationReason: string
  createdAt: string
  updatedAt: string
  authorDisplayName: string
  authorAvatarUrl: string | null
  targetType: 'ranking' | 'item'
  targetId: string
  targetTitle: string
  reviews: CommentModerationReview[]
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

export async function loadCommentModerationQueue(): Promise<{
  data: CommentModerationQueueItem[]
  error?: string
}> {
  try {
    const supabase = await requireAdmin()
    const { data: queueData, error: queueError } = await supabase.rpc('list_comment_moderation_queue', {
      p_limit: 100,
      p_offset: 0,
    })

    if (queueError) return { data: [], error: queueError.message }

    const queueRows = Array.isArray(queueData) ? queueData : []
    const ids = queueRows
      .map((row) => (row as { comment_id?: unknown }).comment_id)
      .filter((id): id is string => typeof id === 'string')

    let reviewRows: Array<Record<string, unknown>> = []
    if (ids.length > 0) {
      const { data, error } = await supabase
        .from('moderation_reviews')
        .select('id, entity_id, previous_status, previous_reason, decision_status, decision_reason, review_note, decision_source, reviewed_at')
        .eq('entity_type', 'comment')
        .in('entity_id', ids)
        .order('reviewed_at', { ascending: false })
        .limit(500)

      if (error) return { data: [], error: error.message }
      reviewRows = (data || []) as Array<Record<string, unknown>>
    }

    const reviewsByComment = new Map<string, CommentModerationReview[]>()
    for (const row of reviewRows) {
      if (typeof row.entity_id !== 'string' || typeof row.id !== 'string') continue
      const reviews = reviewsByComment.get(row.entity_id) || []
      reviews.push({
        id: row.id,
        previousStatus: typeof row.previous_status === 'string' ? row.previous_status : '',
        previousReason: typeof row.previous_reason === 'string' ? row.previous_reason : '',
        decisionStatus: typeof row.decision_status === 'string' ? row.decision_status : '',
        decisionReason: typeof row.decision_reason === 'string' ? row.decision_reason : '',
        reviewNote: typeof row.review_note === 'string' ? row.review_note : null,
        decisionSource: typeof row.decision_source === 'string' ? row.decision_source : '',
        reviewedAt: typeof row.reviewed_at === 'string' ? row.reviewed_at : new Date(0).toISOString(),
      })
      reviewsByComment.set(row.entity_id, reviews)
    }

    const data: CommentModerationQueueItem[] = queueRows.flatMap((raw) => {
      const row = raw as Record<string, unknown>
      if (
        typeof row.comment_id !== 'string'
        || typeof row.body !== 'string'
        || typeof row.target_id !== 'string'
      ) return []

      return [{
        commentId: row.comment_id,
        body: row.body,
        lifecycleStatus: typeof row.lifecycle_status === 'string' ? row.lifecycle_status : '',
        moderationStatus: typeof row.moderation_status === 'string' ? row.moderation_status : '',
        moderationReason: typeof row.moderation_reason === 'string' ? row.moderation_reason : '',
        createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
        updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
        authorDisplayName: typeof row.author_display_name === 'string' ? row.author_display_name : '알 수 없는 사용자',
        authorAvatarUrl: typeof row.author_avatar_url === 'string' ? row.author_avatar_url : null,
        targetType: row.target_type === 'item' ? 'item' : 'ranking',
        targetId: row.target_id,
        targetTitle: typeof row.target_title === 'string' ? row.target_title : '제목 없음',
        reviews: reviewsByComment.get(row.comment_id) || [],
      }]
    })

    return { data }
  } catch (error) {
    return {
      data: [],
      error: error instanceof Error ? error.message : '댓글 Moderation 대기열을 불러오지 못했습니다.',
    }
  }
}

export async function reviewCommentModeration(input: {
  commentId: string
  decisionStatus: ModerationDecisionStatus
  decisionReason: ModerationDecisionReason
  note?: string
}) {
  const result = await reviewModerationTarget({
    entityType: 'comment',
    entityId: input.commentId,
    decisionStatus: input.decisionStatus,
    decisionReason: input.decisionReason,
    note: input.note,
  })

  if (!result.error) {
    revalidatePath('/admin/comments')
    revalidatePath('/', 'layout')
  }

  return result
}
