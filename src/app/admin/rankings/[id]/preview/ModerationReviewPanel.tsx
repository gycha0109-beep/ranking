'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getRankingModerationWorkspace, reviewModerationTarget } from '@/lib/actions/admin'
import { AlertTriangle, Check, History, Image as ImageIcon, ShieldCheck } from 'lucide-react'

type Target = {
  entityType: 'ranking' | 'ranking_entry' | 'item' | 'ranking_image' | 'item_image'
  entityId: string
  label: string
  status: string
  reason: string
  sharedWarning?: boolean
  imageUrl?: string | null
}

type Review = {
  id: string
  entity_type: string
  entity_id: string
  previous_status: string
  decision_status: string
  decision_reason: string
  review_note?: string | null
  reviewed_at: string
}

export default function ModerationReviewPanel({ rankingId }: { rankingId: string }) {
  const router = useRouter()
  const [targets, setTargets] = useState<Target[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = async () => {
    const result = await getRankingModerationWorkspace(rankingId)
    if (result.error) setMessage(result.error)
    setTargets((result.targets || []) as Target[])
    setReviews((result.reviews || []) as Review[])
  }

  useEffect(() => { void load() }, [rankingId])

  const decide = (target: Target, decisionStatus: 'clean' | 'suggestive' | 'blocked') => {
    setMessage(null)
    startTransition(async () => {
      const note = notes[`${target.entityType}:${target.entityId}`] || ''
      const result = await reviewModerationTarget({
        entityType: target.entityType,
        entityId: target.entityId,
        decisionStatus,
        decisionReason: decisionStatus === 'suggestive' ? 'sexual_suggestive' : decisionStatus === 'blocked' ? (target.reason === 'none' ? 'system_error' : target.reason as never) : 'none',
        note,
        rankingId,
      })
      if (result.error) {
        setMessage(result.error)
        return
      }
      setMessage(`${target.label} 판정이 기록되었습니다.`)
      await load()
      router.refresh()
    })
  }

  const blockedTargets = targets.filter(target => target.status === 'blocked' || target.status === 'needs_review')

  return (
    <section className="rounded-3xl border border-white/[0.07] bg-white/[0.015] p-5 sm:p-6 space-y-6">
      <div>
        <h2 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> 엔티티별 Moderation 검토
        </h2>
        <p className="mt-1 text-[11px] text-slate-500">랭킹·엔트리·공유 아이템·이미지를 독립적으로 판정합니다.</p>
      </div>

      {message && <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-xs text-indigo-200">{message}</div>}

      <div className="space-y-3">
        {targets.map(target => {
          const key = `${target.entityType}:${target.entityId}`
          const requiresReview = target.status === 'blocked' || target.status === 'needs_review'
          return (
            <div key={key} className={`rounded-2xl border p-4 ${requiresReview ? 'border-amber-500/25 bg-amber-500/[0.06]' : 'border-white/[0.05] bg-black/10'}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {target.entityType.includes('image') && <ImageIcon className="w-3.5 h-3.5 text-sky-400" />}
                    <span className="text-xs font-bold text-slate-200">{target.label}</span>
                    <span className="rounded-lg bg-white/[0.05] px-2 py-1 text-[9px] font-bold text-slate-400">{target.status} / {target.reason}</span>
                  </div>
                  {target.sharedWarning && (
                    <p className="mt-2 flex items-start gap-1 text-[10px] text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> 이 아이템 판정은 이를 사용하는 모든 랭킹에 적용됩니다.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={notes[key] || ''}
                    onChange={event => setNotes(current => ({ ...current, [key]: event.target.value }))}
                    placeholder="검토 메모"
                    className="min-w-48 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500/40"
                  />
                  <div className="flex gap-1.5">
                    <button disabled={isPending} onClick={() => decide(target, 'clean')} className="rounded-xl bg-emerald-500/15 px-3 py-2 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/25">Clean</button>
                    <button disabled={isPending} onClick={() => decide(target, 'suggestive')} className="rounded-xl bg-purple-500/15 px-3 py-2 text-[10px] font-bold text-purple-300 hover:bg-purple-500/25">Suggestive</button>
                    <button disabled={isPending} onClick={() => decide(target, 'blocked')} className="rounded-xl bg-rose-500/15 px-3 py-2 text-[10px] font-bold text-rose-300 hover:bg-rose-500/25">Block</button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-white/[0.05] bg-black/10 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-300"><History className="h-4 w-4" /> 검토 이력</h3>
        {reviews.length === 0 ? (
          <p className="text-[10px] text-slate-600">기록된 검토 이력이 없습니다.</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {reviews.map(review => (
              <div key={review.id} className="flex items-start gap-2 border-b border-white/[0.04] pb-2 text-[10px] text-slate-400">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                <div>
                  <span className="font-bold text-slate-300">{review.entity_type}</span>: {review.previous_status} → {review.decision_status} ({review.decision_reason})
                  {review.review_note && <span className="block text-slate-500">{review.review_note}</span>}
                  <span className="block text-slate-600">{new Date(review.reviewed_at).toLocaleString('ko-KR')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {blockedTargets.length === 0 && <p className="text-center text-[10px] font-bold text-emerald-400">모든 발행 차단 대상의 검토가 완료되었습니다.</p>}
    </section>
  )
}
