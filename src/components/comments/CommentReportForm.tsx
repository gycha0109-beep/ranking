'use client'

import { useState } from 'react'
import { AlertCircle, Flag, Loader2, Send, X } from 'lucide-react'
import {
  reportComment,
  type CommentReportReason,
} from '@/lib/actions/comment-reports'
import type { CommentTargetType } from '@/lib/actions/comments'

const REASONS: Array<{ value: CommentReportReason; label: string }> = [
  { value: 'spam', label: '스팸·도배' },
  { value: 'harassment', label: '괴롭힘·모욕' },
  { value: 'hate', label: '혐오 표현' },
  { value: 'sexual', label: '성적 콘텐츠' },
  { value: 'violence', label: '폭력·위협' },
  { value: 'privacy', label: '개인정보 노출' },
  { value: 'illegal', label: '불법 정보' },
  { value: 'misinformation', label: '허위·오해 유발 정보' },
  { value: 'other', label: '기타' },
]

type Props = {
  commentId: string
  targetType: CommentTargetType
  targetId: string
  pathname: string
  onCancel: () => void
  onRequireLogin: () => void
  onReported: (message: string) => Promise<void> | void
}

export default function CommentReportForm({
  commentId,
  targetType,
  targetId,
  pathname,
  onCancel,
  onRequireLogin,
  onReported,
}: Props) {
  const [reason, setReason] = useState<CommentReportReason>('spam')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)

    const result = await reportComment({
      commentId,
      targetType,
      targetId,
      pathname,
      reason,
      details,
    })

    if (result.code === 'AUTH_REQUIRED') {
      setSubmitting(false)
      onRequireLogin()
      return
    }

    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    await onReported('신고가 접수되었습니다. 운영 검토 전까지 댓글은 자동으로 숨겨지지 않습니다.')
    setSubmitting(false)
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-rose-500/15 bg-rose-500/[0.045] p-3 sm:ml-12">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-200">
          <Flag className="h-3.5 w-3.5" />
          댓글 신고
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="text-slate-600 hover:text-white disabled:opacity-50"
          aria-label="신고 취소"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <select
        value={reason}
        onChange={(event) => setReason(event.target.value as CommentReportReason)}
        disabled={submitting}
        className="w-full rounded-xl border border-white/10 bg-[#0c0c12] px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-rose-400/30 disabled:opacity-50"
      >
        {REASONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      <textarea
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        maxLength={500}
        rows={3}
        disabled={submitting}
        placeholder="운영자가 확인할 추가 설명이 있다면 입력해 주세요. 신고자 정보는 댓글 작성자에게 공개되지 않습니다."
        className="w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-xs text-slate-100 outline-none placeholder:text-slate-700 focus:border-rose-400/30 disabled:opacity-50"
      />

      {error && (
        <div className="flex items-start gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-2 text-[10px] text-rose-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-slate-600">{details.length.toLocaleString('ko-KR')} / 500</span>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/15 px-3 py-1.5 text-[10px] font-bold text-rose-100 hover:bg-rose-500/25 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          신고 제출
        </button>
      </div>
    </div>
  )
}
