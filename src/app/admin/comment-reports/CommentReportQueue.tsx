'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Flag,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import {
  loadCommentReportQueue,
  reviewCommentReportCase,
  type CommentReportAuthorAction,
  type CommentReportQueueItem,
  type CommentReportResolution,
} from '@/lib/actions/comment-report-admin'
import type { ModerationDecisionReason } from '@/lib/actions/moderation-reviews'

type Props = {
  initialRows: CommentReportQueueItem[]
  initialError?: string
}

const REPORT_REASON_LABELS: Record<string, string> = {
  spam: '스팸·도배',
  harassment: '괴롭힘·모욕',
  hate: '혐오 표현',
  sexual: '성적 콘텐츠',
  violence: '폭력·위협',
  privacy: '개인정보',
  illegal: '불법 정보',
  misinformation: '허위·오해 정보',
  other: '기타',
}

const MODERATION_REASONS: Array<{ value: ModerationDecisionReason; label: string }> = [
  { value: 'spam', label: '스팸' },
  { value: 'hate', label: '혐오·괴롭힘' },
  { value: 'violence', label: '폭력' },
  { value: 'privacy', label: '개인정보' },
  { value: 'illegal', label: '불법' },
  { value: 'sexual_suggestive', label: '선정적 콘텐츠' },
  { value: 'explicit_sexual', label: '노골적 성적 콘텐츠' },
  { value: 'minor_sexualization', label: '미성년자 성적 대상화' },
  { value: 'real_person_sexualization', label: '실존 인물 성적 대상화' },
  { value: 'system_error', label: '기타 정책 위반' },
]

function targetHref(row: CommentReportQueueItem) {
  return row.targetType === 'ranking'
    ? `/rankings/${row.targetSlug}`
    : `/items/${row.targetSlug}`
}

export default function CommentReportQueue({ initialRows, initialError }: Props) {
  const [rows, setRows] = useState(initialRows)
  const [error, setError] = useState(initialError || null)
  const [message, setMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [resolutions, setResolutions] = useState<Record<string, CommentReportResolution>>({})
  const [authorActions, setAuthorActions] = useState<Record<string, CommentReportAuthorAction>>({})
  const [reasons, setReasons] = useState<Record<string, ModerationDecisionReason>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  const refresh = async () => {
    setError(null)
    const result = await loadCommentReportQueue()
    setRows(result.data)
    setError(result.error || null)
  }

  const submit = async (row: CommentReportQueueItem) => {
    const resolution = resolutions[row.commentId] || 'kept'
    const authorAction = authorActions[row.commentId] || 'none'
    const decisionReason = resolution === 'hidden' || resolution === 'blocked'
      ? reasons[row.commentId] || 'system_error'
      : 'none'
    const note = notes[row.commentId] || ''

    if ((resolution === 'hidden' || resolution === 'blocked' || authorAction === 'warning') && note.trim().length < 10) {
      setError('숨김, 차단 또는 경고 조치에는 10자 이상의 관리자 메모가 필요합니다.')
      return
    }

    setBusyId(row.commentId)
    setError(null)
    setMessage(null)

    const result = await reviewCommentReportCase({
      commentId: row.commentId,
      expectedPendingCount: row.reportCount,
      resolution,
      authorAction,
      decisionReason,
      note,
    })

    if (result.error) {
      setError(result.error)
      setBusyId(null)
      if (result.code === 'CONFLICT') await refresh()
      return
    }

    setMessage(`${result.processedCount || row.reportCount}건의 신고 사건을 처리했습니다.`)
    setBusyId(null)
    await refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <Flag className="h-4 w-4 text-rose-400" />
          pending 사건 {rows.length.toLocaleString('ko-KR')}개
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-[10px] font-bold text-slate-400 hover:bg-white/[0.05] hover:text-white"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          새로고침
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] px-5 py-16 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-slate-700" />
          <p className="mt-3 text-sm font-bold text-slate-400">처리할 댓글 신고 사건이 없습니다.</p>
          <p className="mt-1 text-xs text-slate-600">신고 수만으로 댓글을 자동 숨김하지 않습니다.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {rows.map((row) => {
            const resolution = resolutions[row.commentId] || 'kept'
            const deleted = row.lifecycleStatus === 'deleted'
            const busy = busyId === row.commentId

            return (
              <article
                key={row.commentId}
                className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.018]"
              >
                <div className="border-b border-white/[0.05] px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] font-black text-rose-300">
                          <Flag className="h-3 w-3" />
                          신고 {row.reportCount.toLocaleString('ko-KR')}건
                        </span>
                        <span className="rounded-lg border border-white/10 bg-white/[0.025] px-2 py-1 text-[9px] font-bold text-slate-500">
                          댓글 {row.lifecycleStatus} · Moderation {row.moderationStatus}
                        </span>
                        {row.authorWarningCount > 0 && (
                          <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[9px] font-bold text-amber-300">
                            기존 경고 {row.authorWarningCount.toLocaleString('ko-KR')}회
                          </span>
                        )}
                      </div>

                      <Link
                        href={targetHref(row)}
                        target="_blank"
                        className="mt-3 inline-flex max-w-full items-center gap-1.5 text-xs font-bold text-indigo-300 hover:text-indigo-200"
                      >
                        <span className="truncate">{row.targetTitle}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </Link>
                    </div>

                    <div className="text-right text-[10px] text-slate-600">
                      <div className="flex items-center justify-end gap-1">
                        <Clock3 className="h-3 w-3" />
                        최초 {new Date(row.oldestReportedAt).toLocaleString('ko-KR')}
                      </div>
                      <div className="mt-1">최근 {new Date(row.newestReportedAt).toLocaleString('ko-KR')}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 px-5 py-5 sm:px-6">
                  <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                      <UserRound className="h-3.5 w-3.5" />
                      {row.authorDisplayName} · {new Date(row.commentCreatedAt).toLocaleString('ko-KR')}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">
                      {row.body}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">신고 사유 분포</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(row.reasonCounts).map(([reason, count]) => (
                        <span
                          key={reason}
                          className="rounded-lg border border-rose-500/15 bg-rose-500/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-rose-200"
                        >
                          {REPORT_REASON_LABELS[reason] || reason} {count.toLocaleString('ko-KR')}
                        </span>
                      ))}
                    </div>
                  </div>

                  {row.detailSamples.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">비식별 상세 사유 샘플</h3>
                      <div className="mt-2 space-y-2">
                        {row.detailSamples.map((sample, index) => (
                          <div
                            key={`${sample.createdAt}-${index}`}
                            className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5"
                          >
                            <div className="text-[9px] font-bold text-rose-300">
                              {REPORT_REASON_LABELS[sample.reason] || sample.reason} · {new Date(sample.createdAt).toLocaleString('ko-KR')}
                            </div>
                            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-400">
                              {sample.details}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {deleted && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-[10px] text-amber-200">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      삭제된 댓글은 신고 기각 또는 기록 유지 처리만 가능하며 숨김·차단할 수 없습니다.
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1.5 text-[10px] font-bold text-slate-500">
                      사건 처리
                      <select
                        value={resolution}
                        onChange={(event) => setResolutions((current) => ({
                          ...current,
                          [row.commentId]: event.target.value as CommentReportResolution,
                        }))}
                        disabled={busy}
                        className="w-full rounded-xl border border-white/10 bg-[#0c0c12] px-3 py-2.5 text-xs text-slate-200 outline-none disabled:opacity-50"
                      >
                        <option value="dismissed">신고 기각</option>
                        <option value="kept">신고 기록 유지·댓글 유지</option>
                        {!deleted && <option value="hidden">댓글 숨김·재검토</option>}
                        {!deleted && <option value="blocked">댓글 차단</option>}
                      </select>
                    </label>

                    <label className="space-y-1.5 text-[10px] font-bold text-slate-500">
                      Moderation 사유
                      <select
                        value={reasons[row.commentId] || 'system_error'}
                        onChange={(event) => setReasons((current) => ({
                          ...current,
                          [row.commentId]: event.target.value as ModerationDecisionReason,
                        }))}
                        disabled={busy || (resolution !== 'hidden' && resolution !== 'blocked')}
                        className="w-full rounded-xl border border-white/10 bg-[#0c0c12] px-3 py-2.5 text-xs text-slate-200 outline-none disabled:opacity-40"
                      >
                        {MODERATION_REASONS.map((reason) => (
                          <option key={reason.value} value={reason.value}>{reason.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="flex items-center gap-2 text-[11px] font-bold text-amber-200">
                    <input
                      type="checkbox"
                      checked={(authorActions[row.commentId] || 'none') === 'warning'}
                      onChange={(event) => setAuthorActions((current) => ({
                        ...current,
                        [row.commentId]: event.target.checked ? 'warning' : 'none',
                      }))}
                      disabled={busy}
                      className="h-4 w-4 rounded border-white/20 bg-black/30"
                    />
                    작성자 경고 감사 이벤트 기록
                  </label>

                  <textarea
                    value={notes[row.commentId] || ''}
                    onChange={(event) => setNotes((current) => ({
                      ...current,
                      [row.commentId]: event.target.value,
                    }))}
                    maxLength={2000}
                    rows={3}
                    disabled={busy}
                    placeholder="운영 판단 근거를 기록하세요. 숨김·차단·경고는 10자 이상 필수입니다."
                    className="w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-xs text-slate-100 outline-none placeholder:text-slate-700 disabled:opacity-50"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void submit(row)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/25 bg-indigo-500/15 px-4 py-2 text-xs font-bold text-indigo-100 hover:bg-indigo-500/25 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      사건 처리 확정
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
