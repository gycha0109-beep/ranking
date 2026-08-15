import Link from 'next/link'
import { ArrowDown, ArrowUp, Ban, History, Minus, Trophy } from 'lucide-react'
import type { RankingHistoryRevision } from '@/lib/queries/ranking-history'

type Props = {
  revisions: RankingHistoryRevision[]
}

function Movement({ direction, delta }: { direction: 'up' | 'down' | 'same'; delta: number }) {
  if (direction === 'up') {
    return <span className="inline-flex items-center gap-1 text-emerald-300"><ArrowUp className="h-3.5 w-3.5" />{Math.abs(delta)}</span>
  }
  if (direction === 'down') {
    return <span className="inline-flex items-center gap-1 text-rose-300"><ArrowDown className="h-3.5 w-3.5" />{Math.abs(delta)}</span>
  }
  return <span className="inline-flex items-center gap-1 text-slate-500"><Minus className="h-3.5 w-3.5" />유지</span>
}

export default function RankingHistoryPanel({ revisions }: Props) {
  if (revisions.length === 0) return null

  return (
    <section className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6">
      <div className="flex items-start gap-3 border-b border-white/5 pb-4">
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-2 text-violet-300">
          <History className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-black text-white">공식 순위 변경 이력</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            사용자 투표 라운드가 공식 순위에 반영되거나 운영상 폐기된 기록입니다. 투표자 신원은 공개하지 않습니다.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {revisions.map((revision) => {
          const finalized = revision.changeType === 'vote_finalization'
          return (
            <article key={revision.revisionId} className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-slate-200">Revision #{revision.revisionNumber}</span>
                    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-black ${finalized ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}>
                      {finalized ? <Trophy className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                      {finalized ? '투표 결과 확정' : '투표 라운드 폐기'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">Round {revision.voteRound}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">{revision.reason}</p>
                </div>
                <div className="shrink-0 text-[10px] text-slate-500">
                  {new Date(revision.createdAt).toLocaleString('ko-KR')}
                </div>
              </div>

              {finalized ? (
                <div className="mt-4 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500">유효 투표 {revision.eligibleVoteCount.toLocaleString()}표</div>
                  {revision.changes.map((change) => (
                    <div key={change.itemId} className="grid gap-2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 sm:grid-cols-[52px_1fr_auto] sm:items-center">
                      <div className="text-xs font-black text-white">#{change.afterPosition}</div>
                      <div className="min-w-0">
                        <Link href={`/items/${change.slug}`} className="truncate text-xs font-bold text-slate-200 hover:text-violet-300">
                          {change.title}
                        </Link>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          {change.voteCount.toLocaleString()}표 · {change.voteShare.toFixed(2)}%
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-bold">
                        <span className="text-slate-500">#{change.beforePosition} → #{change.afterPosition}</span>
                        <Movement direction={change.direction} delta={change.delta} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.04] px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
                  이 라운드는 공식 순위에 반영되지 않았습니다. 폐기된 라운드의 후보별 상세 투표 정보는 공개하지 않습니다.
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
