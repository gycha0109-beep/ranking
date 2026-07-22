'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type CommentTargetType = 'ranking' | 'item'
export type CommentPresentationStatus = 'visible' | 'needs_review' | 'blocked' | 'deleted'

export type CommentListRow = {
  id: string
  parentId: string | null
  body: string
  status: CommentPresentationStatus
  createdAt: string
  updatedAt: string
  edited: boolean
  isMine: boolean
  author: {
    displayName: string | null
    avatarUrl: string | null
  }
}

export type CommentCursor = {
  createdAt: string
  id: string
}

export type CommentPage = {
  comments: CommentListRow[]
  nextCursor: CommentCursor | null
  authenticated: boolean
  totalCount: number
}

type MutationResult = {
  success?: true
  commentId?: string
  visibility?: string
  updatedAt?: string
  error?: string
  code?: 'AUTH_REQUIRED' | 'FORBIDDEN' | 'INVALID_INPUT' | 'INVALID_TARGET' | 'CONFLICT' | 'RATE_LIMITED' | 'UNKNOWN'
}

type TargetPath = {
  targetType: CommentTargetType
  slug: string
}

function parseTargetPath(pathname: string): TargetPath | null {
  const match = pathname.match(/^\/(rankings|items)\/([^/?#]+)$/)
  if (!match) return null

  try {
    return {
      targetType: match[1] === 'rankings' ? 'ranking' : 'item',
      slug: decodeURIComponent(match[2]),
    }
  } catch {
    return null
  }
}

function normalizeBody(body: string) {
  return body.normalize('NFKC').trim().replace(/\s+/gu, ' ')
}

function mapRpcError(error: { code?: string | null; message?: string | null }): MutationResult {
  const message = error.message || '댓글 요청을 처리하지 못했습니다.'

  if (error.code === '40001') {
    return { error: '댓글이 다른 화면에서 변경되었습니다. 목록을 새로 불러온 뒤 다시 시도해 주세요.', code: 'CONFLICT' }
  }
  if (error.code === '42501') {
    if (message.includes('로그인')) return { error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' }
    return { error: '댓글을 변경할 권한이 없습니다.', code: 'FORBIDDEN' }
  }
  if (error.code === 'P0001' && message.includes('너무 많')) {
    return { error: message, code: 'RATE_LIMITED' }
  }
  if (error.code === 'P0002') {
    return { error: message, code: 'INVALID_TARGET' }
  }
  if (error.code === '22023') {
    return { error: message, code: 'INVALID_INPUT' }
  }

  return { error: message, code: 'UNKNOWN' }
}

async function validateTarget(input: {
  targetType: CommentTargetType
  targetId: string
  pathname: string
}) {
  const parsed = parseTargetPath(input.pathname)
  if (!parsed || parsed.targetType !== input.targetType) return false

  const supabase = await createClient()

  if (input.targetType === 'ranking') {
    const { data, error } = await supabase
      .from('rankings')
      .select('id')
      .eq('id', input.targetId)
      .eq('slug', parsed.slug)
      .eq('status', 'published')
      .in('moderation_status', ['clean', 'suggestive'])
      .in('image_moderation_status', ['clean', 'suggestive'])
      .maybeSingle()

    return !error && Boolean(data)
  }

  const { data, error } = await supabase
    .from('items')
    .select('id')
    .eq('id', input.targetId)
    .eq('slug', parsed.slug)
    .eq('status', 'active')
    .in('moderation_status', ['clean', 'suggestive'])
    .in('image_moderation_status', ['clean', 'suggestive'])
    .maybeSingle()

  return !error && Boolean(data)
}

function parseCommentPage(data: unknown, totalCount: number): CommentPage {
  const value = (data || {}) as {
    comments?: unknown
    next_cursor?: unknown
    authenticated?: unknown
  }

  const rows = Array.isArray(value.comments) ? value.comments : []
  const comments: CommentListRow[] = rows.flatMap((raw) => {
    const row = raw as Record<string, unknown>
    if (typeof row.id !== 'string' || typeof row.body !== 'string') return []

    const rawAuthor = (row.author || {}) as Record<string, unknown>
    const rawStatus = row.status
    const status: CommentPresentationStatus = rawStatus === 'needs_review'
      || rawStatus === 'blocked'
      || rawStatus === 'deleted'
      ? rawStatus
      : 'visible'

    return [{
      id: row.id,
      parentId: typeof row.parent_id === 'string' ? row.parent_id : null,
      body: row.body,
      status,
      createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
      edited: row.edited === true,
      isMine: row.is_mine === true,
      author: {
        displayName: typeof rawAuthor.display_name === 'string' ? rawAuthor.display_name : null,
        avatarUrl: typeof rawAuthor.avatar_url === 'string' ? rawAuthor.avatar_url : null,
      },
    }]
  })

  const cursorValue = value.next_cursor as Record<string, unknown> | null
  const nextCursor = cursorValue
    && typeof cursorValue.created_at === 'string'
    && typeof cursorValue.id === 'string'
    ? { createdAt: cursorValue.created_at, id: cursorValue.id }
    : null

  return {
    comments,
    nextCursor,
    authenticated: value.authenticated === true,
    totalCount,
  }
}

export async function listComments(input: {
  targetType: CommentTargetType
  targetId: string
  cursor?: CommentCursor | null
  limit?: number
}): Promise<{ data: CommentPage; error?: string }> {
  const empty: CommentPage = { comments: [], nextCursor: null, authenticated: false, totalCount: 0 }

  try {
    const supabase = await createClient()
    const listRpcName = input.targetType === 'ranking' ? 'list_ranking_comments' : 'list_item_comments'
    const countRpcName = input.targetType === 'ranking'
      ? 'get_ranking_public_comment_count'
      : 'get_item_public_comment_count'
    const idParam = input.targetType === 'ranking' ? 'p_ranking_id' : 'p_item_id'

    const [listResult, countResult] = await Promise.all([
      supabase.rpc(listRpcName, {
        [idParam]: input.targetId,
        p_cursor_created_at: input.cursor?.createdAt || null,
        p_cursor_id: input.cursor?.id || null,
        p_limit: Math.min(Math.max(input.limit || 20, 1), 50),
      }),
      supabase.rpc(countRpcName, {
        [idParam]: input.targetId,
      }),
    ])

    if (listResult.error) return { data: empty, error: listResult.error.message }
    if (countResult.error) return { data: empty, error: countResult.error.message }

    const parsedCount = Number(countResult.data)
    const totalCount = Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : 0
    return { data: parseCommentPage(listResult.data, totalCount) }
  } catch (error) {
    return {
      data: empty,
      error: error instanceof Error ? error.message : '댓글을 불러오지 못했습니다.',
    }
  }
}

export async function createComment(input: {
  targetType: CommentTargetType
  targetId: string
  pathname: string
  body: string
  parentId?: string | null
}): Promise<MutationResult> {
  const body = normalizeBody(input.body)
  if (body.length < 1 || body.length > 2000) {
    return { error: '댓글은 1자 이상 2,000자 이하로 입력해 주세요.', code: 'INVALID_INPUT' }
  }

  if (!await validateTarget(input)) {
    return { error: '댓글 대상 경로가 올바르지 않습니다.', code: 'INVALID_TARGET' }
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' }

  const rpcName = input.targetType === 'ranking' ? 'create_ranking_comment' : 'create_item_comment'
  const idParam = input.targetType === 'ranking' ? 'p_ranking_id' : 'p_item_id'
  const { data, error } = await supabase.rpc(rpcName, {
    [idParam]: input.targetId,
    p_body: body,
    p_parent_id: input.parentId || null,
  })

  if (error) return mapRpcError(error)

  const value = (data || {}) as { comment_id?: unknown; visibility?: unknown; updated_at?: unknown }
  revalidatePath(input.pathname)
  return {
    success: true,
    commentId: typeof value.comment_id === 'string' ? value.comment_id : undefined,
    visibility: typeof value.visibility === 'string' ? value.visibility : undefined,
    updatedAt: typeof value.updated_at === 'string' ? value.updated_at : undefined,
  }
}

export async function updateComment(input: {
  targetType: CommentTargetType
  targetId: string
  pathname: string
  commentId: string
  expectedUpdatedAt: string
  body: string
}): Promise<MutationResult> {
  const body = normalizeBody(input.body)
  if (body.length < 1 || body.length > 2000) {
    return { error: '댓글은 1자 이상 2,000자 이하로 입력해 주세요.', code: 'INVALID_INPUT' }
  }

  if (!await validateTarget(input)) {
    return { error: '댓글 대상 경로가 올바르지 않습니다.', code: 'INVALID_TARGET' }
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' }

  const { data, error } = await supabase.rpc('update_own_comment', {
    p_comment_id: input.commentId,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_body: body,
  })

  if (error) return mapRpcError(error)

  const value = (data || {}) as { comment_id?: unknown; visibility?: unknown; updated_at?: unknown }
  revalidatePath(input.pathname)
  return {
    success: true,
    commentId: typeof value.comment_id === 'string' ? value.comment_id : undefined,
    visibility: typeof value.visibility === 'string' ? value.visibility : undefined,
    updatedAt: typeof value.updated_at === 'string' ? value.updated_at : undefined,
  }
}

export async function deleteComment(input: {
  targetType: CommentTargetType
  targetId: string
  pathname: string
  commentId: string
  expectedUpdatedAt: string
}): Promise<MutationResult> {
  if (!await validateTarget(input)) {
    return { error: '댓글 대상 경로가 올바르지 않습니다.', code: 'INVALID_TARGET' }
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' }

  const { data, error } = await supabase.rpc('delete_own_comment', {
    p_comment_id: input.commentId,
    p_expected_updated_at: input.expectedUpdatedAt,
  })

  if (error) return mapRpcError(error)

  const value = (data || {}) as { comment_id?: unknown; visibility?: unknown; updated_at?: unknown }
  revalidatePath(input.pathname)
  return {
    success: true,
    commentId: typeof value.comment_id === 'string' ? value.comment_id : undefined,
    visibility: typeof value.visibility === 'string' ? value.visibility : undefined,
    updatedAt: typeof value.updated_at === 'string' ? value.updated_at : undefined,
  }
}
