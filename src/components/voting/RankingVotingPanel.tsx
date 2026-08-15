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

export default function RankingVotingPanel({
  rankingId,
  pathname,
  candidates,
  initialVotingState,
  initialMyVoteItemId,
  isAuthenticated,
  canManageVoting,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [votingState, setVotingState] = useState<'open' | 'closed'>(initialVotingState)
  const [myVoteItemId, setMyVoteItemId] = useState<string | null>(initialMyVoteItemId)
  const [terminalReason, setTerminalReason] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const totalVotes = candidates.reduce((sum, candidate) => sum + candidate.voteCount, 0)
  const hasValidReason = terminalReason.trim().length >= 5 && terminalReason.trim().length <= 1000

  const requireLogin = () => {
    router.push(`/login?next=${encodeURIComponent(pathname)}`)
  }

  const voteFor = (itemId: string) => {
    if (!isAuthenticated) {
      requireLogin()
      return
    }
    if (votingState !== 'open' || isPending) return

    setErrorMessage(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const result = await castRankingVote(rankingId, itemId, pathname)
      if (result.error) {
        setErrorMessage(result.error)
        return
      }
      setMyVoteItemId(itemId)
      setSuccessMessage('투표가 반영되었습니다.')
      router.refresh()
    })
  }

  const clearVote = () => {
    if (!isAuthenticated) {
      requireLogin()
      return
    }
    if (votingState !== 'open' || isPending) return

    setErrorMessage(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const result = await clearRankingVote(rankingId, pathname)
      if (result.error) {
        setErrorMessage(result.error)
        return
      }
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
      if (result.error) {
        setErrorMessage(result.error)
        return
      }
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
      if (result.error) {
        setErrorMessage(result.error)
        return
      }
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
      if (result.error) {
        setErrorMessage(result.error)
        return
      }
      setMyVoteItemId(null)
      setTerminalReason('')
      setSuccessMessage(`투표 라운드를 폐기하고 이력에 기록했습니다. Revision #${result.revisionNumber}`)
      router.refresh()
    })
  }

  return (
    <section className="rounded-3xl border border-cyan-500/20 bg-cyan-950/10 p-5 sm:p-6 backdrop-blur-xl">
      <div className="flex flex-col gap-4 border-b border-white/5 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Vote className="h-5 w-5 text-cyan-300" />
            <h2 className="text-base font-black text-white">사용자 투표 순위</h2>
            <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase ${votingState === 'open' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-slate-500/20 bg-slate-500/10 text-slate-400'}`}>
              {votingState}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-400">
            이 패널은 현재 투표 라운드의 실시간 결과입니다. 확정 전에는 기존 공식 순위를 바꾸지 않으며, 관리자가 닫힌 라운드를 확정하면 결과가 공식 순위와 변경 이력에 원자적으로 반영됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-xs text-slate-300">
          <BarChart3 className="h-4 w-4 text-cyan-300" />
          총 {totalVotes.toLocaleString()}표
        </div>
      </div>

      {errorMessage && <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-300">{errorMessage}</div>}
      {successMessage && <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-300">{successMessage}</div>}

      <div className="mt-5 space-y-2">
        {candidates.map((candidate) => {
          const selected = myVoteItemId === candidate.itemId
          return (
            <div key={candidate.itemId} className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[48px_1fr_auto] sm:items-center ${selected ? 'border-cyan-400/35 bg-cyan-500/10' : 'border-white/[0.06] bg-black/10'}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-sm font-black text-white">
                {candidate.currentRank}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-bold text-slate-100">{candidate.title}</span>
                  {selected && <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/15 px-2 py-0.5 text-[10px] font-black text-cyan-200"><CheckCircle2 className="h-3 w-3" /> 내 선택</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  <span>{candidate.voteCount.toLocaleString()}표</span>
                  <span>{candidate.voteShare.toFixed(2)}%</span>
                  <span>seed #{candidate.seedPosition}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={votingState !== 'open' || isPending || selected}
                onClick={() => voteFor(candidate.itemId)}
                className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                {selected ? '선택됨' : isAuthenticated ? '투표' : '로그인 후 투표'}
              </button>
            </div>
          )
        })}
      </div>

      {candidates.length === 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">
          현재 공개 가능한 투표 후보가 없습니다.
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Lock className="h-3.5 w-3.5" />
          동일 계정은 랭킹당 1표이며, 투표가 열린 동안 선택 변경과 취소가 가능합니다.
        </div>
        {myVoteItemId && votingState === 'open' && (
          <button type="button" disabled={isPending} onClick={clearVote} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/[0.05] disabled:opacity-50">
            <RotateCcw className="h-3.5 w-3.5" /> 투표 취소
          </button>
        )}
      </div>

      {canManageVoting && (
        <div className="mt-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-black text-indigo-200"><ShieldCheck className="h-4 w-4" /> 관리자 투표 제어</div>
              <p className="mt-1 text-[11px] text-slate-400">투표 중에는 후보 구성이 잠깁니다. 닫힌 라운드는 사유와 함께 공식 확정하거나, 확정할 수 없는 경우 이력을 남기고 폐기할 수 있습니다.</p>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => changeVotingState(votingState === 'open' ? 'closed' : 'open')}
              className={`rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-50 ${votingState === 'open' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
            >
              {votingState === 'open' ? '투표 닫기' : '투표 열기'}
            </button>
          </div>

          {votingState === 'closed' && (
            <div className="mt-4 border-t border-indigo-500/15 pt-4">
              <label htmlFor={`vote-terminal-reason-${rankingId}`} className="text-[11px] font-black text-slate-300">라운드 종료 사유</label>
              <textarea
                id={`vote-terminal-reason-${rankingId}`}
                value={terminalReason}
                onChange={(event) => setTerminalReason(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="예: 2026년 8월 사용자 투표 결과를 공식 순위에 반영"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-indigo-400/40"
              />
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[10px] text-slate-500">5~1000자 · 확정/폐기 기록은 삭제할 수 없습니다.</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isPending || totalVotes < 1 || !hasValidReason}
                    onClick={finalizeVote}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                  >
                    <Trophy className="h-3.5 w-3.5" /> 투표 결과 확정
                  </button>
                  <button
                    type="button"
                    disabled={isPending || !hasValidReason}
                    onClick={voidVoteRound}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-200 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-slate-900 disabled:text-slate-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> 라운드 폐기
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
