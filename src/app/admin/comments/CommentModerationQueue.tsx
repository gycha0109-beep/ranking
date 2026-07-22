'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  History,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import {
  loadCommentModerationQueue,
  reviewCommentModeration,
  type CommentModerationQueueItem,
} from '@/lib/actions/comment-admin'

type Props = {
  initialRows: CommentModerationQueueItem[]
  initialError?: string
}

const REASONS = [
  ['spam', '스팸'],
  ['hate', '혐오'],
  ['violence', '폭력'],
  ['privacy', '개인정보'],
  ['illegal', '불법'],
  ['explicit_sexual', '노골적 성적 콘텐츠'],
  ['minor_sexualization', '미성년자 성적 대상화'],
  ['real_person_sexualization', '실존 인물 성적 대상화'],
  ['system_error', '시스템 오류'],
] as const

type ReviewReason = typeof REASONS[number][0] | 'none' | 'sexual_suggestive'

export default function CommentModerationQueue({ initialRows, initialError }: Props) {
  const [rows, setRows] = useState(initialRows)
  const [error, setError] = useState(initialError || null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [reasons, setReasons] = useState<Record<string, ReviewReason>>({})

  const refresh = async () => {
    setError(null)
    const result = await loadCommentModerationQueue()
    setRows(result.data)
    setError(result.error || null)
  }

  const decide = async (
    row: CommentModerationQueueItem,
    decisionStatus: 'clean' | 'suggestive' | 'blocked',
  ) => {
    setBusyId(row.commentId)
    setError(null)

    const selectedReason = reasons[row.commentId]
    const decisionReason: ReviewReason = decisionStatus === 'clean'
      ? 'none'
      : decisionStatus === 'suggestive'
        ? 'sexual_suggestive'
        : selectedReason && selectedReason !== 'none' && selectedReason !== 'sexual_suggestive'
          ? selectedReason
          : 'spam'

    const result = await reviewCommentModeration({
      commentId: row.commentId,
      decisionStatus,
      decisionReason,
      note: notes[row.commentId],
    })

    if (result.error) {
      setError(result.error)
      setBusyId(null)
      return
    }

    await refresh()
    setBusyId(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          대기열 {rows.length.toLocaleString('ko-KR')}건 · 자동 판정 원문과 감사 이력을 관리자에게만 표시합니다.
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busyId !== null}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/[0.06] disabled:opacity-50"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          새로고침
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 py-20 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500/60" />
          <p className="mt-4 text-sm font-bold text-slate-300">검토할 댓글이 없습니다.</p>
          <p className="mt-1 text-xs text-slate-600">needs_review 및 blocked 댓글이 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {rows.map((row) => {
            const targetHref = row.targetType === 'ranking'
              ? `/rankings/${row.targetSlug}`
              : `/items/${row.targetSlug}`
            const isBusy = busyId === row.commentId
            const selectedReason = reasons[row.commentId]
              || (REASONS.some(([value]) => value === row.moderationReason)
                ? row.moderationReason as ReviewReason
                : 'spam')

            return (
              <article
                key={row.commentId}
                className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${
                        row.moderationStatus === 'blocked'
                          ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                          : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                      }`}>
                        {row.moderationStatus}
                      </span>
                      <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-bold text-slate-400">
                        {row.moderationReason}
                      </span>
                      <span className="text-[10px] text-slate-600">
                        {new Date(row.createdAt).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    <h2 className="text-sm font-bold text-slate-200">{row.authorDisplayName}</h2>
                    <p className="text-xs text-slate-500">
                      {row.targetType === 'ranking' ? '랭킹' : '아이템'} · {row.targetTitle}
                    </p>
                  </div>
                  <Link
                    href={targetHref}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300"
                  >
                    공개 대상 열기
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                <div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/25 p-4">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
                    {row.body}
                  </p>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      차단 사유
                    </label>
                    <select
                      value={selectedReason}
                      onChange={(event) => setReasons((current) => ({
                        ...current,
                        [row.commentId]: event.target.value as ReviewReason,
                      }))}
                      className="w-full rounded-xl border border-white/10 bg-[#0d0d13] px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500/30"
                    >
                      {REASONS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      검토 메모
                    </label>
                    <input
                      value={notes[row.commentId] || ''}
                      onChange={(event) => setNotes((current) => ({
                        ...current,
                        [row.commentId]: event.target.value,
                      }))}
                      maxLength={500}
                      placeholder="선택 사항"
                      className="w-full rounded-xl border border-white/10 bg-[#0d0d13] px-3 py-2.5 text-xs text-slate-200 outline-none placeholder:text-slate-700 focus:border-indigo-500/30"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void decide(row, 'clean')}
                    disabled={busyId !== null}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    정상 공개
                  </button>
                  <button
                    type="button"
                    onClick={() => void decide(row, 'suggestive')}
                    disabled={busyId !== null}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    제한적 공개
                  </button>
                  <button
                    type="button"
                    onClick={() => void decide(row, 'blocked')}
                    disabled={busyId !== null}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    차단 유지
                  </button>
                </div>

                <details className="mt-5 rounded-2xl border border-white/[0.05] bg-black/15 p-4">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-slate-400">
                    <History className="h-3.5 w-3.5" />
                    Moderation 이력 {row.reviews.length.toLocaleString('ko-KR')}건
                  </summary>
                  <div className="mt-3 space-y-2">
                    {row.reviews.length === 0 ? (
                      <p className="text-[10px] text-slate-600">기록된 이력이 없습니다.</p>
                    ) : row.reviews.slice(0, 8).map((review) => (
                      <div key={review.id} className="rounded-xl border border-white/[0.04] bg-white/[0.015] px-3 py-2 text-[10px] text-slate-500">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-300">{review.decisionStatus}</span>
                          <span>{review.decisionReason}</span>
                          <span>· {review.decisionSource}</span>
                          <time className="ml-auto">{new Date(review.reviewedAt).toLocaleString('ko-KR')}</time>
                        </div>
                        {review.reviewNote && <p className="mt-1 text-slate-500">{review.reviewNote}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
