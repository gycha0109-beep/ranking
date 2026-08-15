'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, CheckCircle2, Lock, RotateCcw, ShieldCheck, Trash2, Trophy, Vote } from 'lucide-react'
import { castRankingVote, clearRankingVote, setRankingVotingState } from '@/lib/actions/voting'
import { finalizeRankingVote, voidRankingVoteRound } from '@/lib/actions/ranking-history'

type Candidate = {
  itemId: string
  title: string
  slug: string
  seedPosition: number
  voteCount: number
  voteShare: number
  currentRank: number
}

type Props = {
  rankingId: string
  pathname: string
  candidates: Candidate[]
  initialVotingState: 'open' | 'closed'
  initialMyVoteItemId: string | null
  isAuthenticated: boolean
  canManageVoting: boolean
}

export default function RankingVotingPanel({ rankingId, pathname, candidates, initialVotingState, initialMyVoteItemId, isAuthenticated, canManageVoting }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [votingState, setVotingState] = useState<'open' | 'closed'>(initialVotingState)
  const [myVoteItemId, setMyVoteItemId] = useState<string | null>(initialMyVoteItemId)
  const [terminalReason, setTerminalReason] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const totalVotes = candidates.reduce((sum, candidate) => sum + candidate.voteCount, 0)
  const hasValidReason = terminalReason.trim().length >= 5 && terminalReason.trim().length <= 1000
  const requireLogin = () => router.push(`/login?next=${encodeURIComponent(pathname)}`)

  const voteFor = (itemId: string) => {
    if (!isAuthenticated) return requireLogin()
    if (votingState !== 'open' || isPending) return
    setErrorMessage(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const result = await castRankingVote(rankingId, itemId, pathname)
      if (result.error) return setErrorMessage(result.error)
      setMyVoteItemId(itemId)
      setSuccessMessage('투표가 반영되었습니다.')
      router.refresh()
    })
  }

  const clearVote = () => {
    if (!isAuthenticated) return requireLogin()
    if (votingState !== 'open' || isPending) return
    setErrorMessage(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const result = await clearRankingVote(rankingId, pathname)
      if (result.error) return setErrorMessage(result.error)
      setMyVoteItemId(null)
      setSuccessMessage('투표를 취소했습니다.')
      router.refresh()
    })
  }

  const changeVotingState = (nextState: 'open' | 'closed') => {
    if (!canManageVoting || isPending) return
    setErrorMessage(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const result = await setRankingVotingState(rankingId, nextState, pathname)
      if (result.error) return setErrorMessage(result.error)
      setVotingState(nextState)
      setTerminalReason('')
      setSuccessMessage(nextState === 'open' ? '사용자 투표를 열었습니다.' : '사용자 투표를 닫았습니다.')
      router.refresh()
    })
  }

  const finalizeVote = () => {
    if (!canManageVoting || votingState !== 'closed' || isPending || totalVotes < 1 || !hasValidReason) return
    setErrorMessage(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const result = await finalizeRankingVote(rankingId, terminalReason, pathname)
      if (result.error) return setErrorMessage(result.error)
      setMyVoteItemId(null)
      setTerminalReason('')
      setSuccessMessage(`투표 결과를 공식 순위로 확정했습니다. Revision #${result.revisionNumber}`)
      router.refresh()
    })
  }

  const voidVoteRound = () => {
    if (!canManageVoting || votingState !== 'closed' || isPending || !hasValidReason) return
    if (!window.confirm('현재 투표 라운드를 공식 순위에 반영하지 않고 폐기하시겠습니까? 이 작업은 변경 이력에 영구 기록됩니다.')) return
    setErrorMessage(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const result = await voidRankingVoteRound(rankingId, terminalReason, pathname)
      if (result.error) return setErrorMessage(result.error)
      setMyVoteItemId(null)
      setTerminalReason('')
      setSuccessMessage(`투표 라운드를 폐기하고 이력에 기록했습니다. Revision #${result.revisionNumber}`)
      router.refresh()
    })
  }

  return (
    <section className="rounded-[20px] border border-[#d7dfea] bg-white p-5 shadow-[0_8px_30px_rgba(20,30,50,0.05)] sm:p-6">
      <div className="flex flex-col gap-4 border-b border-[#edf0f3] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Vote className="h-4.5 w-4.5 text-[#3457c8]" />
            <h2 className="text-base font-black text-[#20242a]">사용자 투표 순위</h2>
            <span className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase ${votingState === 'open' ? 'bg-[#ecfdf5] text-[#087a54]' : 'bg-[#f0f2f5] text-[#6b7280]'}`}>{votingState}</span>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-6 text-[#7b8491]">현재 라운드의 실시간 결과입니다. 공식 순위는 관리자가 닫힌 라운드를 확정할 때만 변경됩니다.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl bg-[#f6f7f9] px-3 py-2 text-xs font-bold text-[#5f6875]"><BarChart3 className="h-4 w-4 text-[#3457c8]" />총 {totalVotes.toLocaleString('ko-KR')}표</div>
      </div>

      {errorMessage && <div className="mt-4 rounded-xl border border-[#efc2ca] bg-[#fff1f2] p-3 text-xs font-bold text-[#a93449]">{errorMessage}</div>}
      {successMessage && <div className="mt-4 rounded-xl border border-[#b9e5d2] bg-[#ecfdf5] p-3 text-xs font-bold text-[#087a54]">{successMessage}</div>}

      <div className="mt-5 overflow-hidden rounded-2xl border border-[#e3e7ec]">
        {candidates.map((candidate, index) => {
          const selected = myVoteItemId === candidate.itemId
          return (
            <div key={candidate.itemId} className={`grid gap-3 bg-white p-4 sm:grid-cols-[44px_1fr_auto] sm:items-center ${index > 0 ? 'border-t border-[#edf0f3]' : ''} ${selected ? 'bg-[#f6f8ff]' : ''}`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${candidate.currentRank <= 3 ? 'bg-[#171a1f] text-white' : 'bg-[#f0f2f5] text-[#667085]'}`}>{candidate.currentRank}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-extrabold text-[#303640]">{candidate.title}</span>{selected && <span className="inline-flex items-center gap-1 rounded-lg bg-[#eef2ff] px-2 py-1 text-[9px] font-black text-[#3457c8]"><CheckCircle2 className="h-3 w-3" />내 선택</span>}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-[#8a94a3]"><span>{candidate.voteCount.toLocaleString('ko-KR')}표</span><span>{candidate.voteShare.toFixed(2)}%</span><span>seed #{candidate.seedPosition}</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf0f3]"><div className="h-full rounded-full bg-[#3457c8]" style={{ width: `${Math.min(100, Math.max(0, candidate.voteShare))}%` }} /></div>
              </div>
              <button type="button" disabled={votingState !== 'open' || isPending || selected} onClick={() => voteFor(candidate.itemId)} className="rounded-xl bg-[#3457c8] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#2445ad] disabled:cursor-not-allowed disabled:bg-[#e5e8ed] disabled:text-[#9aa3af]">{selected ? '선택됨' : isAuthenticated ? '투표' : '로그인 후 투표'}</button>
            </div>
          )
        })}
      </div>

      {candidates.length === 0 && <div className="mt-5 rounded-2xl border border-dashed border-[#dfe4ea] p-6 text-center text-xs text-[#8a94a3]">현재 공개 가능한 투표 후보가 없습니다.</div>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0f3] pt-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-[#8a94a3]"><Lock className="h-3.5 w-3.5" />동일 계정은 랭킹당 1표이며 열린 동안 변경·취소할 수 있습니다.</div>
        {myVoteItemId && votingState === 'open' && <button type="button" disabled={isPending} onClick={clearVote} className="rw-button-secondary min-h-9 px-3 text-xs disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />투표 취소</button>}
      </div>

      {canManageVoting && (
        <details className="mt-5 rounded-2xl border border-[#cfd8ef] bg-[#f8f9ff]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-black text-[#3457c8]"><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" />관리자 투표 제어</span><span className="text-[10px] text-[#7c8bb7]">열기</span></summary>
          <div className="border-t border-[#dfe5f4] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-5 text-[#69748e]">투표 중에는 후보 구성이 잠깁니다. 닫힌 라운드는 사유와 함께 확정하거나 이력을 남기고 폐기할 수 있습니다.</p><button type="button" disabled={isPending} onClick={() => changeVotingState(votingState === 'open' ? 'closed' : 'open')} className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-50 ${votingState === 'open' ? 'bg-[#a16207]' : 'bg-[#087a54]'}`}>{votingState === 'open' ? '투표 닫기' : '투표 열기'}</button></div>

            {votingState === 'closed' && (
              <div className="mt-4 border-t border-[#dfe5f4] pt-4">
                <label htmlFor={`vote-terminal-reason-${rankingId}`} className="text-[11px] font-black text-[#4f5864]">라운드 종료 사유</label>
                <textarea id={`vote-terminal-reason-${rankingId}`} value={terminalReason} onChange={(event) => setTerminalReason(event.target.value)} maxLength={1000} rows={3} placeholder="예: 2026년 8월 사용자 투표 결과를 공식 순위에 반영" className="mt-2 w-full rounded-xl border border-[#d8dee6] bg-white px-3 py-2.5 text-xs text-[#303640] outline-none placeholder:text-[#a0a8b3] focus:border-[#7890df] focus:ring-4 focus:ring-[#3457c8]/10" />
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span className="text-[10px] text-[#8a94a3]">5~1000자 · 확정/폐기 기록은 삭제할 수 없습니다.</span><div className="flex flex-wrap gap-2"><button type="button" disabled={isPending || totalVotes < 1 || !hasValidReason} onClick={finalizeVote} className="inline-flex items-center gap-1.5 rounded-xl bg-[#3457c8] px-3 py-2 text-xs font-black text-white hover:bg-[#2445ad] disabled:bg-[#e5e8ed] disabled:text-[#9aa3af]"><Trophy className="h-3.5 w-3.5" />투표 결과 확정</button><button type="button" disabled={isPending || !hasValidReason} onClick={voidVoteRound} className="inline-flex items-center gap-1.5 rounded-xl border border-[#efc2ca] bg-white px-3 py-2 text-xs font-black text-[#be4057] hover:bg-[#fff1f2] disabled:border-[#e5e8ed] disabled:text-[#a0a8b3]"><Trash2 className="h-3.5 w-3.5" />라운드 폐기</button></div></div>
              </div>
            )}
          </div>
        </details>
      )}
    </section>
  )
}
