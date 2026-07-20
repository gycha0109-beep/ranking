'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { publishRanking, unpublishRanking } from '@/lib/actions/admin'
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

  const run = (action: () => Promise<{ error?: string; success?: boolean }>, success: string) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const result = await action()
      if (result.error) setErrorMessage(result.error)
      else {
        setSuccessMessage(success)
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

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-indigo-500/20 bg-indigo-950/10 p-5 sm:p-6 backdrop-blur-xl space-y-6">
        <div className="flex flex-col gap-4 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-indigo-300"><ShieldCheck className="h-4 w-4" /> E2E 최종 발행 통제 센터</h2>
            <p className="mt-1 text-[11px] text-slate-400">비즈니스 유효성, 텍스트 및 이미지 Moderation Gate를 확인합니다.</p>
          </div>
          <span className={`rounded-xl border px-3.5 py-1.5 text-xs font-black ${status === 'published' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-400'}`}>
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
            </div>
          </div>

          <div className="flex flex-col justify-center gap-3 border-t border-white/5 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            {status === 'draft' ? (
              <>
                <button type="button" onClick={() => run(() => publishRanking(rankingId), '랭킹이 발행되었습니다.')} disabled={!isPublishable || isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">
                  {isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} 최종 발행 승인
                </button>
                {!isPublishable && <p className="text-center text-[10px] font-bold text-rose-400">모든 검증과 개별 Moderation 검토를 완료해야 합니다.</p>}
              </>
            ) : (
              <button type="button" onClick={() => run(() => unpublishRanking(rankingId), '발행이 취소되었습니다.')} disabled={isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">
                <FileEdit className="h-3.5 w-3.5" /> 발행 취소
              </button>
            )}
            {status === 'published' && <Link href={`/rankings/${rankingSlug}`} target="_blank" className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-300"><Eye className="h-3.5 w-3.5" /> 공개 화면</Link>}
          </div>
        </div>
      </section>

      <ModerationReviewPanel rankingId={rankingId} />
    </div>
  )
}
