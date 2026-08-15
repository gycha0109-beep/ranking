import Link from 'next/link'
import { ArrowDown, ArrowUp, Ban, History, Minus, Trophy } from 'lucide-react'
import type { RankingHistoryRevision } from '@/lib/queries/ranking-history'

type Props = { revisions: RankingHistoryRevision[] }

function Movement({ direction, delta }: { direction: 'up' | 'down' | 'same'; delta: number }) {
  if (direction === 'up') return <span className="inline-flex items-center gap-1 font-bold text-[#087a54]"><ArrowUp className="h-3.5 w-3.5" />{Math.abs(delta)}</span>
  if (direction === 'down') return <span className="inline-flex items-center gap-1 font-bold text-[#be4057]"><ArrowDown className="h-3.5 w-3.5" />{Math.abs(delta)}</span>
  return <span className="inline-flex items-center gap-1 text-[#8a94a3]"><Minus className="h-3.5 w-3.5" />유지</span>
}

export default function RankingHistoryPanel({ revisions }: Props) {
  if (revisions.length === 0) return null

  return (
    <section className="rounded-[20px] border border-[#dde2e8] bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3 border-b border-[#edf0f3] pb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#3457c8]"><History className="h-4 w-4" /></div>
        <div>
          <h2 className="text-base font-black text-[#20242a]">공식 순위 변경 이력</h2>
          <p className="mt-1 text-xs leading-6 text-[#7b8491]">공식 순위에 반영된 사용자 투표와 운영상 폐기된 라운드 기록입니다. 투표자 신원은 공개하지 않습니다.</p>
        </div>
      </div>

      <div className="mt-5 space-y-6">
        {revisions.map((revision) => {
          const finalized = revision.changeType === 'vote_finalization'
          return (
            <article key={revision.revisionId} className="relative border-l-2 border-[#e3e7ec] pl-5">
              <span className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white ${finalized ? 'bg-[#087a54]' : 'bg-[#a16207]'}`} />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-[#303640]">Revision #{revision.revisionNumber}</span>
                    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-black ${finalized ? 'bg-[#ecfdf5] text-[#087a54]' : 'bg-[#fffbeb] text-[#9a6206]'}`}>{finalized ? <Trophy className="h-3 w-3" /> : <Ban className="h-3 w-3" />}{finalized ? '투표 결과 확정' : '라운드 폐기'}</span>
                    <span className="text-[10px] font-bold text-[#9aa3af]">Round {revision.voteRound}</span>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-[#5f6875]">{revision.reason}</p>
                </div>
                <time className="shrink-0 text-[10px] font-semibold text-[#9aa3af]">{new Date(revision.createdAt).toLocaleString('ko-KR')}</time>
              </div>

              {finalized ? (
                <div className="mt-4">
                  <div className="mb-2 text-[10px] font-bold text-[#8a94a3]">유효 투표 {revision.eligibleVoteCount.toLocaleString('ko-KR')}표</div>
                  <div className="overflow-hidden rounded-xl border border-[#e3e7ec]">
                    {revision.changes.map((change, index) => (
                      <div key={change.itemId} className={`grid gap-2 bg-[#fafbfc] px-3 py-3 sm:grid-cols-[44px_1fr_auto] sm:items-center ${index > 0 ? 'border-t border-[#edf0f3]' : ''}`}>
                        <div className="text-xs font-black text-[#303640]">#{change.afterPosition}</div>
                        <div className="min-w-0"><Link href={`/items/${change.slug}`} className="truncate text-xs font-extrabold text-[#3f4752] hover:text-[#2445ad]">{change.title}</Link><div className="mt-0.5 text-[10px] text-[#8a94a3]">{change.voteCount.toLocaleString('ko-KR')}표 · {change.voteShare.toFixed(2)}%</div></div>
                        <div className="flex items-center gap-2 text-[10px] font-bold"><span className="text-[#8a94a3]">#{change.beforePosition} → #{change.afterPosition}</span><Movement direction={change.direction} delta={change.delta} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-[#ead9a7] bg-[#fffbeb] px-3 py-2.5 text-[11px] leading-6 text-[#7a6c4e]">이 라운드는 공식 순위에 반영되지 않았습니다. 폐기된 라운드의 후보별 상세 투표 정보는 공개하지 않습니다.</div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
