'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ChevronDown,
  Edit3,
  Flag,
  Loader2,
  Lock,
  MessageCircle,
  Reply,
  Send,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
  type CommentCursor,
  type CommentListRow,
  type CommentTargetType,
} from '@/lib/actions/comments'
import CommentReportForm from '@/components/comments/CommentReportForm'

type Props = {
  targetType: CommentTargetType
  targetId: string
  pathname: string
}

function mergeRows(current: CommentListRow[], incoming: CommentListRow[]) {
  const rows = new Map(current.map((row) => [row.id, row]))
  for (const row of incoming) rows.set(row.id, row)
  return Array.from(rows.values())
}

function statusLabel(status: CommentListRow['status']) {
  if (status === 'needs_review') return '검토 대기'
  if (status === 'blocked') return '정책 차단'
  if (status === 'deleted') return '삭제됨'
  return null
}

function resultMessage(visibility?: string, edit = false) {
  if (visibility === 'needs_review') return edit
    ? '수정된 댓글이 운영 검토를 기다리고 있습니다.'
    : '댓글이 등록되었으며 운영 검토를 기다리고 있습니다.'
  if (visibility === 'blocked') return edit
    ? '수정된 댓글이 운영 정책에 따라 공개되지 않았습니다.'
    : '댓글이 운영 정책에 따라 공개되지 않았습니다.'
  return edit ? '댓글을 수정했습니다.' : '댓글이 등록되었습니다.'
}

function statusClass(status: CommentListRow['status']) {
  if (status === 'needs_review') return 'border-[#ead9a7] bg-[#fffbeb] text-[#8a5a08]'
  if (status === 'blocked') return 'border-[#efc2ca] bg-[#fff1f2] text-[#a93449]'
  return 'border-[#dfe3e8] bg-[#f0f2f5] text-[#5f6875]'
}

export default function CommentSection({ targetType, targetId, pathname }: Props) {
  const router = useRouter()
  const [comments, setComments] = useState<CommentListRow[]>([])
  const [nextCursor, setNextCursor] = useState<CommentCursor | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [reportingId, setReportingId] = useState<string | null>(null)

  const loadFirstPage = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await listComments({ targetType, targetId, limit: 20 })
    setComments(result.data.comments)
    setNextCursor(result.data.nextCursor)
    setTotalCount(result.data.totalCount)
    setAuthenticated(result.data.authenticated)
    setError(result.error || null)
    setLoading(false)
  }, [targetId, targetType])

  useEffect(() => {
    void loadFirstPage()
  }, [loadFirstPage])

  const roots = useMemo(
    () => comments.filter((comment) => !comment.parentId),
    [comments],
  )

  const repliesByParent = useMemo(() => {
    const result = new Map<string, CommentListRow[]>()
    for (const comment of comments) {
      if (!comment.parentId) continue
      const replies = result.get(comment.parentId) || []
      replies.push(comment)
      result.set(comment.parentId, replies)
    }
    for (const replies of result.values()) {
      replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    }
    return result
  }, [comments])

  const requireLogin = () => {
    router.push(`/login?next=${encodeURIComponent(pathname)}`)
  }

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setError(null)
    const result = await listComments({ targetType, targetId, cursor: nextCursor, limit: 20 })
    setComments((current) => mergeRows(current, result.data.comments))
    setNextCursor(result.data.nextCursor)
    setTotalCount(result.data.totalCount)
    setAuthenticated(result.data.authenticated)
    setError(result.error || null)
    setLoadingMore(false)
  }

  const submitCreate = async (parentId: string | null) => {
    if (!authenticated) {
      requireLogin()
      return
    }

    const value = parentId ? replyBody : body
    if (!value.trim()) return

    setSubmitting(true)
    setError(null)
    setMessage(null)
    const result = await createComment({
      targetType,
      targetId,
      pathname,
      body: value,
      parentId,
    })

    if (result.code === 'AUTH_REQUIRED') {
      setSubmitting(false)
      requireLogin()
      return
    }
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    setMessage(resultMessage(result.visibility))
    if (parentId) {
      setReplyBody('')
      setReplyTo(null)
    } else {
      setBody('')
    }
    await loadFirstPage()
    setSubmitting(false)
  }

  const submitEdit = async (comment: CommentListRow) => {
    if (!editBody.trim()) return

    setSubmitting(true)
    setError(null)
    setMessage(null)
    const result = await updateComment({
      targetType,
      targetId,
      pathname,
      commentId: comment.id,
      expectedUpdatedAt: comment.updatedAt,
      body: editBody,
    })

    if (result.code === 'AUTH_REQUIRED') {
      setSubmitting(false)
      requireLogin()
      return
    }
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      if (result.code === 'CONFLICT') await loadFirstPage()
      return
    }

    setMessage(resultMessage(result.visibility, true))
    setEditingId(null)
    setEditBody('')
    await loadFirstPage()
    setSubmitting(false)
  }

  const submitDelete = async (comment: CommentListRow) => {
    if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return

    setSubmitting(true)
    setError(null)
    setMessage(null)
    const result = await deleteComment({
      targetType,
      targetId,
      pathname,
      commentId: comment.id,
      expectedUpdatedAt: comment.updatedAt,
    })

    if (result.code === 'AUTH_REQUIRED') {
      setSubmitting(false)
      requireLogin()
      return
    }
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      if (result.code === 'CONFLICT') await loadFirstPage()
      return
    }

    setMessage('댓글을 삭제했습니다.')
    setEditingId(null)
    setReplyTo(null)
    setReportingId(null)
    await loadFirstPage()
    setSubmitting(false)
  }

  const renderComment = (comment: CommentListRow, depth: 0 | 1) => {
    const label = statusLabel(comment.status)
    const canMutate = comment.isMine && comment.status !== 'deleted'
    const canReply = depth === 0 && comment.status === 'visible'
    const canReport = !comment.isMine && comment.status === 'visible'
    const authorName = comment.author.displayName
      || (comment.status === 'deleted' ? '삭제된 사용자' : '익명 사용자')

    return (
      <article
        key={comment.id}
        className={depth === 0
          ? 'rounded-2xl border border-[#dfe3e8] bg-white p-4 sm:p-5'
          : 'ml-5 rounded-xl border border-[#e0e5ee] border-l-2 border-l-[#b8c6f4] bg-[#f8faff] p-4 sm:ml-10'}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#dde2e8] bg-[#f0f2f5] text-[#667085]">
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs font-extrabold text-[#303640]">{authorName}</span>
              <time className="text-[10px] font-medium text-[#737c89]">
                {new Date(comment.createdAt).toLocaleString('ko-KR')}
              </time>
              {comment.edited && comment.status !== 'deleted' && (
                <span className="text-[9px] font-semibold text-[#737c89]">수정됨</span>
              )}
              {label && (
                <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${statusClass(comment.status)}`}>
                  {label}
                </span>
              )}
            </div>

            {editingId === comment.id ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={editBody}
                  onChange={(event) => setEditBody(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  aria-label="댓글 수정 내용"
                  className="w-full resize-y rounded-xl border border-[#cfd5dd] bg-[#fafbfc] px-3 py-2.5 text-sm text-[#303640] outline-none transition focus:border-[#3158e8] focus:ring-4 focus:ring-[#3158e8]/10"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-[#737c89]">{editBody.length.toLocaleString('ko-KR')} / 2,000</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null)
                        setEditBody('')
                      }}
                      disabled={submitting}
                      className="rounded-lg border border-[#cfd5dd] bg-white px-3 py-1.5 text-[10px] font-bold text-[#5f6875] transition hover:border-[#aeb3b9] hover:bg-[#f6f7f8] disabled:opacity-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitEdit(comment)}
                      disabled={submitting || !editBody.trim()}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#3158e8] px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#2445ad] disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Send className="h-3 w-3" aria-hidden="true" />}
                      수정 저장
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-7 ${
                comment.status === 'deleted' ? 'italic text-[#8a94a3]' : 'text-[#3f4752]'
              }`}>
                {comment.body}
              </p>
            )}

            {editingId !== comment.id && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {canReply && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!authenticated) {
                        requireLogin()
                        return
                      }
                      setReplyTo((current) => current === comment.id ? null : comment.id)
                      setReplyBody('')
                      setEditingId(null)
                      setReportingId(null)
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-[#5f6875] transition hover:text-[#2445ad]"
                  >
                    <Reply className="h-3 w-3" aria-hidden="true" />
                    답글
                  </button>
                )}

                {canMutate && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(comment.id)
                        setEditBody(comment.body)
                        setReplyTo(null)
                        setReportingId(null)
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[#5f6875] transition hover:text-[#2445ad]"
                    >
                      <Edit3 className="h-3 w-3" aria-hidden="true" />
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitDelete(comment)}
                      disabled={submitting}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[#5f6875] transition hover:text-[#a93449] disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                      삭제
                    </button>
                  </>
                )}

                {canReport && (
                  <button
                    type="button"
                    disabled={comment.reportedByMe}
                    onClick={() => {
                      if (!authenticated) {
                        requireLogin()
                        return
                      }
                      setReportingId((current) => current === comment.id ? null : comment.id)
                      setReplyTo(null)
                      setEditingId(null)
                    }}
                    className={`inline-flex items-center gap-1 text-[10px] font-bold transition disabled:cursor-default ${
                      comment.reportedByMe
                        ? 'text-[#b56a78]'
                        : 'text-[#5f6875] hover:text-[#a93449]'
                    }`}
                  >
                    <Flag className="h-3 w-3" aria-hidden="true" />
                    {comment.reportedByMe ? '신고됨' : '신고'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {replyTo === comment.id && (
          <div className="mt-4 ml-0 space-y-2 rounded-xl border border-[#dfe4ee] bg-white p-3 sm:ml-12">
            <textarea
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="답글을 입력해 주세요."
              aria-label="답글 내용"
              className="w-full resize-y rounded-xl border border-[#cfd5dd] bg-[#fafbfc] px-3 py-2.5 text-sm text-[#303640] outline-none transition placeholder:text-[#8a94a3] focus:border-[#3158e8] focus:ring-4 focus:ring-[#3158e8]/10"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-medium text-[#737c89]">{replyBody.length.toLocaleString('ko-KR')} / 2,000</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null)
                    setReplyBody('')
                  }}
                  disabled={submitting}
                  className="rounded-lg border border-[#cfd5dd] bg-white px-3 py-1.5 text-[10px] font-bold text-[#5f6875] transition hover:border-[#aeb3b9] hover:bg-[#f6f7f8] disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void submitCreate(comment.id)}
                  disabled={submitting || !replyBody.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#3158e8] px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-[#2445ad] disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Send className="h-3 w-3" aria-hidden="true" />}
                  답글 등록
                </button>
              </div>
            </div>
          </div>
        )}

        {reportingId === comment.id && !comment.reportedByMe && (
          <CommentReportForm
            commentId={comment.id}
            targetType={targetType}
            targetId={targetId}
            pathname={pathname}
            onCancel={() => setReportingId(null)}
            onRequireLogin={requireLogin}
            onReported={async (successMessage) => {
              setMessage(successMessage)
              setReportingId(null)
              await loadFirstPage()
            }}
          />
        )}
      </article>
    )
  }

  return (
    <section className="space-y-5 border-t border-[#d9dde3] pt-8 text-[#303640]" aria-labelledby="comments-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef2ff] text-[#3158e8]">
            <MessageCircle className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="comments-heading" className="text-xl font-black tracking-[-0.02em] text-[#303640]">
              댓글과 답글
              <span className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-[#eef2ff] px-1.5 py-0.5 text-[11px] font-extrabold text-[#3158e8]">
                {totalCount.toLocaleString('ko-KR')}
              </span>
            </h2>
            <p className="mt-1 text-[11px] leading-5 text-[#737c89]">콘텐츠에 대한 의견과 근거를 남길 수 있습니다.</p>
          </div>
        </div>
        <span className="inline-flex max-w-sm items-start gap-1.5 text-[10px] font-semibold leading-5 text-[#737c89]">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          댓글은 자동·수동 Moderation과 사용자 신고 대상입니다.
        </span>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-[#efc2ca] bg-[#fff1f2] px-3 py-2.5 text-xs text-[#a93449]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto rounded-md p-1 hover:bg-[#f8dfe4]" aria-label="오류 닫기">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {message && (
        <div aria-live="polite" className="flex items-start gap-2 rounded-xl border border-[#cdd8ff] bg-[#eef2ff] px-3 py-2.5 text-xs text-[#2445ad]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
          <button type="button" onClick={() => setMessage(null)} className="ml-auto rounded-md p-1 hover:bg-[#dfe6ff]" aria-label="알림 닫기">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-[#dfe3e8] bg-white p-4 sm:p-5" aria-busy={submitting}>
        {authenticated ? (
          <div className="space-y-3">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="이 콘텐츠에 대한 의견을 남겨 주세요. 일반 텍스트만 지원합니다."
              aria-label="댓글 내용"
              className="w-full resize-y rounded-xl border border-[#cfd5dd] bg-[#fafbfc] px-3 py-3 text-sm text-[#303640] outline-none transition placeholder:text-[#8a94a3] focus:border-[#3158e8] focus:ring-4 focus:ring-[#3158e8]/10"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[10px] font-medium text-[#737c89]">{body.length.toLocaleString('ko-KR')} / 2,000</span>
              <button
                type="button"
                onClick={() => void submitCreate(null)}
                disabled={submitting || !body.trim()}
                className="rw-button-primary px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
                댓글 등록
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={requireLogin}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#cfd5dd] bg-[#fafbfc] py-7 text-xs font-bold text-[#5f6875] transition hover:border-[#9eb0ef] hover:bg-[#f5f7ff] hover:text-[#2445ad]"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            로그인하고 댓글 작성하기
          </button>
        )}
      </div>

      {loading ? (
        <div role="status" aria-label="댓글 불러오는 중" className="flex items-center justify-center py-12 text-[#737c89]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : roots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d9dde3] bg-[#fafbfc] px-5 py-12 text-center">
          <MessageCircle className="mx-auto h-7 w-7 text-[#8a94a3]" aria-hidden="true" />
          <p className="mt-3 text-xs font-semibold text-[#5f6875]">아직 공개된 댓글이 없습니다.</p>
          <p className="mt-1 text-[10px] text-[#737c89]">첫 의견을 남겨 토론을 시작할 수 있습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {roots.map((root) => (
            <div key={root.id} className="space-y-2">
              {renderComment(root, 0)}
              {(repliesByParent.get(root.id) || []).map((reply) => renderComment(reply, 1))}
            </div>
          ))}
        </div>
      )}

      {nextCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rw-button-secondary px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
            댓글 더 보기
          </button>
        </div>
      )}
    </section>
  )
}
