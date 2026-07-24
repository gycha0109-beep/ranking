'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminCapability } from '@/lib/actions/admin-access'
import type { ModerationDecisionReason } from '@/lib/actions/moderation-reviews'

export type CommentReportResolution = 'dismissed' | 'kept' | 'hidden' | 'blocked'
export type CommentReportAuthorAction = 'none' | 'warning'

export type CommentReportDetailSample = {
  reason: string
  details: string
  createdAt: string
}

export type CommentReportQueueItem = {
  commentId: string
  body: string
  lifecycleStatus: string
  moderationStatus: string
  moderationReason: string
  commentCreatedAt: string
  authorDisplayName: string
  targetType: 'ranking' | 'item'
  targetId: string
  targetSlug: string
  targetTitle: string
  reportCount: number
  reasonCounts: Record<string, number>
  detailSamples: CommentReportDetailSample[]
  oldestReportedAt: string
  newestReportedAt: string
  authorWarningCount: number
}

type ReviewResult = {
  success?: true
  processedCount?: number
  decisionId?: number
  error?: string
  code?: 'AUTH_REQUIRED' | 'INVALID_INPUT' | 'INVALID_TARGET' | 'CONFLICT' | 'UNKNOWN'
}

function parseNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function parseReasonCounts(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((result, [key, raw]) => {
    const count = parseNumber(raw)
    if (count > 0) result[key] = count
    return result
  }, {})
}

function parseDetailSamples(value: unknown): CommentReportDetailSample[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((raw) => {
    const row = raw as Record<string, unknown>
    if (typeof row.reason !== 'string' || typeof row.details !== 'string') return []
    return [{
      reason: row.reason,
      details: row.details,
      createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    }]
  })
}

export async function loadCommentReportQueue(): Promise<{
  data: CommentReportQueueItem[]
  error?: string
}> {
  try {
    const supabase = await requireAdminCapability('report_review')
    const { data, error } = await supabase.rpc('list_comment_report_queue', {
      p_limit: 100,
      p_offset: 0,
    })

    if (error) return { data: [], error: error.message }

    const rows = Array.isArray(data) ? data : []
    const parsed: CommentReportQueueItem[] = rows.flatMap((raw) => {
      const row = raw as Record<string, unknown>
      if (
        typeof row.comment_id !== 'string'
        || typeof row.body !== 'string'
        || typeof row.target_id !== 'string'
        || typeof row.target_slug !== 'string'
      ) return []

      return [{
        commentId: row.comment_id,
        body: row.body,
        lifecycleStatus: typeof row.lifecycle_status === 'string' ? row.lifecycle_status : '',
        moderationStatus: typeof row.moderation_status === 'string' ? row.moderation_status : '',
        moderationReason: typeof row.moderation_reason === 'string' ? row.moderation_reason : '',
        commentCreatedAt: typeof row.comment_created_at === 'string' ? row.comment_created_at : new Date(0).toISOString(),
        authorDisplayName: typeof row.author_display_name === 'string' ? row.author_display_name : '알 수 없는 사용자',
        targetType: row.target_type === 'item' ? 'item' : 'ranking',
        targetId: row.target_id,
        targetSlug: row.target_slug,
        targetTitle: typeof row.target_title === 'string' ? row.target_title : '제목 없음',
        reportCount: parseNumber(row.report_count),
        reasonCounts: parseReasonCounts(row.reason_counts),
        detailSamples: parseDetailSamples(row.detail_samples),
        oldestReportedAt: typeof row.oldest_reported_at === 'string' ? row.oldest_reported_at : new Date(0).toISOString(),
        newestReportedAt: typeof row.newest_reported_at === 'string' ? row.newest_reported_at : new Date(0).toISOString(),
        authorWarningCount: parseNumber(row.author_warning_count),
      }]
    })

    return { data: parsed }
  } catch (error) {
    return {
      data: [],
      error: error instanceof Error ? error.message : '댓글 신고 대기열을 불러오지 못했습니다.',
    }
  }
}

export async function reviewCommentReportCase(input: {
  commentId: string
  expectedPendingCount: number
  resolution: CommentReportResolution
  authorAction: CommentReportAuthorAction
  decisionReason: ModerationDecisionReason
  note?: string
}): Promise<ReviewResult> {
  try {
    const supabase = await requireAdminCapability('report_review')
    const note = input.note?.normalize('NFKC').trim().replace(/\s+/gu, ' ') || null

    if (note && note.length > 2000) {
      return { error: '관리자 메모는 2,000자 이하로 입력해 주세요.', code: 'INVALID_INPUT' }
    }

    const { data, error } = await supabase.rpc('review_comment_report_case', {
      p_comment_id: input.commentId,
      p_expected_pending_count: input.expectedPendingCount,
      p_resolution: input.resolution,
      p_author_action: input.authorAction,
      p_decision_reason: input.decisionReason,
      p_note: note,
    })

    if (error) {
      if (error.code === '40001') return { error: '신고 사건이 다른 화면에서 변경되었습니다. 대기열을 새로 불러와 주세요.', code: 'CONFLICT' }
      if (error.code === '42501') return { error: error.message, code: 'AUTH_REQUIRED' }
      if (error.code === '22023') return { error: error.message, code: 'INVALID_INPUT' }
      if (error.code === 'P0002') return { error: error.message, code: 'INVALID_TARGET' }
      return { error: error.message, code: 'UNKNOWN' }
    }

    const value = (data || {}) as { decision_id?: unknown; processed_count?: unknown }
    revalidatePath('/admin/comment-reports')
    revalidatePath('/admin')
    revalidatePath('/', 'layout')

    return {
      success: true,
      decisionId: parseNumber(value.decision_id),
      processedCount: parseNumber(value.processed_count),
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '댓글 신고 사건을 처리하지 못했습니다.',
      code: 'UNKNOWN',
    }
  }
}
