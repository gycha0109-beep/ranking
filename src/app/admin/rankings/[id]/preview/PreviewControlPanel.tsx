'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { unpublishRanking } from '@/lib/actions/admin'
import {
  getRankingEditorialReadiness,
  publishRankingWithEditorialGate,
  type RankingEditorialReadiness,
} from '@/lib/actions/editorial-quality'
import { AlertTriangle, Check, Eye, FileEdit, RefreshCw, ShieldCheck, Sparkles, X } from 'lucide-react'
import ModerationReviewPanel from './ModerationReviewPanel'

interface Props {
  rankingId: string
  rankingSlug: string
  status: 'draft' | 'published' | 'archived'
  validation: {
    hasTitle: boolean
    hasCategory: boolean
    hasSummary: boolean
    hasScope: boolean
    hasEntries: boolean
    hasCriteria: boolean
  }
  isPublishable: boolean
  moderationStatus: string
  moderationReason: string
  moderationIssues: Array<{ label: string; status: string; reason: string }>
}

export default function PreviewControlPanel({
  rankingId,
  rankingSlug,
  status,
  validation,
  isPublishable,
  moderationStatus,
  moderationReason,
  moderationIssues,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [editorialReadiness, setEditorialReadiness] = useState<RankingEditorialReadiness | null>(null)
  const [editorialLoading, setEditorialLoading] = useState(true)

  const loadEditorialReadiness = async () => {
    setEditorialLoading(true)
    const result = await getRankingEditorialReadiness(rankingId)
    if (result.error) {
      setErrorMessage(`발행 품질 상태를 불러오지 못했습니다: ${result.error}`)
      setEditorialReadiness(null)
    } else {
      setEditorialReadiness(result.data[0] || null)
    }
    setEditorialLoading(false)
  }

  useEffect(() => {
    void loadEditorialReadiness()
  }, [rankingId])

  const run = (action: () => Promise<{ error?: string; success?: boolean }>, success: string) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const result = await action()
      if (result.error) setErrorMessage(result.error)
      else {
        setSuccessMessage(success)
        await loadEditorialReadiness()
        router.refresh()
      }
    })
  }

  const checks = [
    ['기본 정보 및 제목', validation.hasTitle],
    ['카테고리 매핑', validation.hasCategory],
    ['요약 작성', validation.hasSummary],
    ['조사 범위', validation.hasScope],
    ['선정 기준', validation.hasCriteria],
    ['순위 항목', validation.hasEntries],
  ] as const

  const editorialReady = editorialReadiness?.editorial_ready === true
  const canPublish = status === 'draft' && isPublishable && editorialReady && !editorialLoading

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-indigo-500/20 bg-indigo-950/10 p-5 sm:p-6 backdrop-blur-xl space-y-6">
        <div className="flex flex-col gap-4 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-indigo-300"><ShieldCheck className="h-4 w-4" /> E2E 최종 발행 통제 센터</h2>
            <p className="mt-1 text-[11px] text-slate-400">Moderation Gate와 OPS-1 Editorial Quality Gate를 모두 확인합니다.</p>
          </div>
          <span className={`rounded-xl border px-3.5 py-1.5 text-xs font-black ${status === 'published' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : status === 'archived' ? 'border-slate-500/20 bg-slate-500/10 text-slate-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-400'}`}>
            {status.toUpperCase()}
          </span>
        </div>

        {moderationStatus === 'suggestive' && (
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-4 text-xs text-purple-300">
            Suggestive 콘텐츠입니다. 감지 사유: {moderationReason}
          </div>
        )}

        {moderationIssues.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200">
            <div className="mb-2 flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> 발행 차단 요소 {moderationIssues.length}건</div>
            <ul className="space-y-1 pl-6 text-[10px] text-amber-300/90">
              {moderationIssues.map((issue, index) => <li key={`${issue.label}-${index}`}>{issue.label}: {issue.status} / {issue.reason}</li>)}
            </ul>
          </div>
        )}

        <div className={`rounded-2xl border p-4 ${editorialReady ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={`text-xs font-black ${editorialReady ? 'text-emerald-300' : 'text-rose-300'}`}>OPS-1 Editorial Quality</p>
              <p className="mt-1 text-[10px] text-slate-400">Draft는 자유롭게 저장할 수 있지만 공개 발행은 이 계약을 모두 통과해야 합니다.</p>
            </div>
            <button type="button" onClick={() => void loadEditorialReadiness()} disabled={editorialLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold text-slate-300 disabled:opacity-50">
              <RefreshCw className={`h-3 w-3 ${editorialLoading ? 'animate-spin' : ''}`} /> 다시 검사
            </button>
          </div>

          {editorialReadiness && (
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-slate-400">
              <span className="rounded-lg bg-black/20 px-2 py-1">Entries {editorialReadiness.entry_count}</span>
              <span className="rounded-lg bg-black/20 px-2 py-1">Criteria {editorialReadiness.criteria_count}</span>
              <span className="rounded-lg bg-black/20 px-2 py-1">Usable sources {editorialReadiness.public_source_count}</span>
              {editorialReadiness.expected_entry_count !== null && <span className="rounded-lg bg-black/20 px-2 py-1">Title promise TOP {editorialReadiness.expected_entry_count}</span>}
            </div>
          )}

          {!editorialLoading && editorialReadiness && editorialReadiness.blockers.length > 0 && (
            <ul className="mt-4 space-y-2">
              {editorialReadiness.blockers.map((blocker) => (
                <li key={blocker.code} className="flex items-start gap-2 text-[11px] text-rose-200">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                  <span><strong className="font-mono text-[9px] text-rose-400">{blocker.code}</strong> — {blocker.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {errorMessage && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-300">{errorMessage}</div>}
        {successMessage && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-300">{successMessage}</div>}

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-3 md:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">검증 체크리스트</span>
            <div className="grid gap-3 sm:grid-cols-2">
              {checks.map(([label, passed]) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  {passed ? <Check className="h-4 w-4 text-emerald-400" /> : <X className="h-4 w-4 text-rose-400" />}
                  <span className={passed ? 'text-slate-300' : 'text-rose-400'}>{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 border-t border-white/5 pt-3 text-xs sm:col-span-2">
                {moderationIssues.length === 0 ? <Check className="h-4 w-4 text-emerald-400" /> : <X className="h-4 w-4 text-rose-400" />}
                <span className={moderationIssues.length === 0 ? 'text-slate-300' : 'font-bold text-rose-400'}>
                  {moderationIssues.length === 0 ? '모든 Moderation Gate 통과' : `검토 또는 차단 상태 ${moderationIssues.length}건`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:col-span-2">
                {editorialReady ? <Check className="h-4 w-4 text-emerald-400" /> : <X className="h-4 w-4 text-rose-400" />}
                <span className={editorialReady ? 'text-slate-300' : 'font-bold text-rose-400'}>
                  {editorialReady ? 'OPS-1 발행 품질 계약 통과' : `OPS-1 품질 보완 ${editorialReadiness?.blockers.length ?? 0}건`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-3 border-t border-white/5 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            {status === 'draft' ? (
              <>
                <button type="button" onClick={() => run(() => publishRankingWithEditorialGate(rankingId), '랭킹이 발행되었습니다.')} disabled={!canPublish || isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">
                  {isPending || editorialLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} 최종 발행 승인
                </button>
                {!canPublish && <p className="text-center text-[10px] font-bold text-rose-400">Moderation과 OPS-1 발행 품질 기준을 모두 충족해야 합니다.</p>}
              </>
            ) : status === 'published' ? (
              <button type="button" onClick={() => run(() => unpublishRanking(rankingId), '발행이 취소되었습니다.')} disabled={isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">
                <FileEdit className="h-3.5 w-3.5" /> 발행 취소 후 수정
              </button>
            ) : (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-[10px] font-bold text-slate-400">Archived 문서는 다시 draft로 복원한 뒤 품질 검증을 진행해야 합니다.</p>
            )}
            {status === 'published' && <Link href={`/rankings/${rankingSlug}`} target="_blank" className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-300"><Eye className="h-3.5 w-3.5" /> 공개 화면</Link>}
          </div>
        </div>
      </section>

      <ModerationReviewPanel rankingId={rankingId} />
    </div>
  )
}
