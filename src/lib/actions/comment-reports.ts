'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CommentTargetType } from '@/lib/actions/comments'

export type CommentReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'violence'
  | 'privacy'
  | 'illegal'
  | 'misinformation'
  | 'other'

export type CommentReportResult = {
  success?: true
  reportId?: string
  status?: string
  createdAt?: string
  error?: string
  code?: 'AUTH_REQUIRED' | 'INVALID_INPUT' | 'INVALID_TARGET' | 'RATE_LIMITED' | 'UNKNOWN'
}

const REPORT_REASONS = new Set<CommentReportReason>([
  'spam',
  'harassment',
  'hate',
  'sexual',
  'violence',
  'privacy',
  'illegal',
  'misinformation',
  'other',
])

function normalizeDetails(details?: string | null) {
  const normalized = (details || '').normalize('NFKC').trim().replace(/\s+/gu, ' ')
  return normalized || null
}

function isValidPath(pathname: string, targetType: CommentTargetType) {
  const expected = targetType === 'ranking' ? '/rankings/' : '/items/'
  return pathname.startsWith(expected) && !pathname.startsWith(`${expected}/`)
}

function mapRpcError(error: { code?: string | null; message?: string | null }): CommentReportResult {
  const message = error.message || '댓글 신고를 처리하지 못했습니다.'

  if (error.code === '42501') {
    return { error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' }
  }
  if (error.code === 'P0001') {
    return { error: message, code: 'RATE_LIMITED' }
  }
  if (error.code === 'P0002') {
    return { error: message, code: 'INVALID_TARGET' }
  }
  if (error.code === '22023' || error.code === '23505') {
    return { error: message, code: 'INVALID_INPUT' }
  }

  return { error: message, code: 'UNKNOWN' }
}

export async function reportComment(input: {
  targetType: CommentTargetType
  targetId: string
  pathname: string
  commentId: string
  reason: CommentReportReason
  details?: string | null
}): Promise<CommentReportResult> {
  if (!REPORT_REASONS.has(input.reason)) {
    return { error: '신고 사유를 선택해 주세요.', code: 'INVALID_INPUT' }
  }

  if (!isValidPath(input.pathname, input.targetType)) {
    return { error: '댓글 신고 대상 경로가 올바르지 않습니다.', code: 'INVALID_TARGET' }
  }

  const details = normalizeDetails(input.details)
  if (details && details.length > 500) {
    return { error: '상세 신고 사유는 500자 이하로 입력해 주세요.', code: 'INVALID_INPUT' }
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' }

    const { data, error } = await supabase.rpc('report_content_comment', {
      p_comment_id: input.commentId,
      p_ranking_id: input.targetType === 'ranking' ? input.targetId : null,
      p_item_id: input.targetType === 'item' ? input.targetId : null,
      p_reason: input.reason,
      p_details: details,
    })

    if (error) return mapRpcError(error)

    const value = (data || {}) as {
      report_id?: unknown
      status?: unknown
      created_at?: unknown
    }

    revalidatePath(input.pathname)
    return {
      success: true,
      reportId: typeof value.report_id === 'string' ? value.report_id : undefined,
      status: typeof value.status === 'string' ? value.status : undefined,
      createdAt: typeof value.created_at === 'string' ? value.created_at : undefined,
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '댓글 신고를 처리하지 못했습니다.',
      code: 'UNKNOWN',
    }
  }
}
