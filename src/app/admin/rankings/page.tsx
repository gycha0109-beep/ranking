import React from 'react'
import Link from 'next/link'
import { listAdminRankings } from '@/lib/actions/admin'
import { getRankingEditorialReadiness, type RankingEditorialReadiness } from '@/lib/actions/editorial-quality'
import {
  getRankingRevalidationStatus,
  type RankingRevalidationStatus,
  type RevalidationFreshnessState,
} from '@/lib/actions/content-revalidation'
import {
  FileSpreadsheet,
  ArrowLeft,
  PlusCircle,
  FileEdit,
  Eye,
  FolderKanban,
  Layers,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Archive,
  RefreshCw,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const freshnessLabels: Record<RevalidationFreshnessState, string> = {
  not_applicable: '재검증 비대상',
  never_reviewed: '재검증 기록 없음',
  attention_required: '출처 조치 필요',
  overdue: '재검증 기한 초과',
  due_soon: '재검증 예정 임박',
  current: '재검증 유효',
}

const freshnessClasses: Record<RevalidationFreshnessState, string> = {
  not_applicable: 'border-slate-500/15 bg-slate-500/10 text-slate-400',
  never_reviewed: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  attention_required: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
  overdue: 'border-orange-500/20 bg-orange-500/10 text-orange-300',
  due_soon: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300',
  current: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
}

export default async function AdminRankingsPage() {
  let rankings: any[] = []
  let readinessById = new Map<string, RankingEditorialReadiness>()
  let revalidationById = new Map<string, RankingRevalidationStatus>()
  let errorMessage: string | null = null

  try {
    rankings = await listAdminRankings()
    const [readinessResult, revalidationResult] = await Promise.all([
      getRankingEditorialReadiness(),
      getRankingRevalidationStatus(),
    ])
    if (readinessResult.error) {
      throw new Error(`OPS-1 readiness 조회 실패: ${readinessResult.error}`)
    }
    if (revalidationResult.error) {
      throw new Error(`CONTENT-3 재검증 상태 조회 실패: ${revalidationResult.error}`)
    }
    readinessById = new Map(readinessResult.data.map((row) => [row.ranking_id, row]))
    revalidationById = new Map(revalidationResult.data.map((row) => [row.ranking_id, row]))
  } catch (err: any) {
    errorMessage = err.message
  }

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a0a0f] to-[#07070a] text-slate-100">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white mb-6 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 px-3 py-1.5 rounded-lg transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          대시보드로 돌아가기
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/[0.06]">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-purple-400" />
              랭킹 문서 통합 관리 (E2E)
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Draft는 빠르게 작성하고, 공개 전에는 OPS-1 Editorial Quality Gate와 Moderation Gate를 모두 통과시킵니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/rankings/quick/new"
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 border border-purple-500/30 text-white transition-all flex items-center gap-1.5 shadow-lg shadow-purple-600/15 shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              간편 작성
            </Link>
            <Link
              href="/admin/rankings/new"
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 border border-indigo-500/30 text-white transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/15 shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              새 랭킹 드래프트 생성
            </Link>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.04] p-4 text-[11px] leading-6 text-slate-400">
          <strong className="text-indigo-300">OPS-1 운영 원칙:</strong> 공개 중인 랭킹의 editorial field는 직접 수정하지 않습니다. 발행 취소 → draft 편집 → readiness 재검사 → 재발행 순서로 운영합니다. `TOP N` 제목과 실제 항목 수, Scope, Criteria, 공개 출처, 선정 사유를 DB가 최종 검증합니다.
          <br />
          <strong className="text-cyan-300">CONTENT-3 운영 원칙:</strong> 공개 랭킹은 authoritative source를 주기적으로 재검증하고, 검증 결과와 다음 검증일을 append-only 이력으로 남깁니다.
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-xs font-bold">
            에러가 발생했습니다: {errorMessage}
          </div>
        )}

        {rankings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-white/10 rounded-2xl text-slate-500 gap-4 bg-white/[0.01]">
            <ShieldAlert className="w-10 h-10 text-slate-600" />
            <div className="text-center">
              <p className="text-sm font-semibold">작성된 랭킹 문서가 존재하지 않습니다.</p>
              <p className="text-xs text-slate-600 mt-1">오른쪽 위의 새 랭킹 드래프트 생성 버튼을 눌러 첫 랭킹을 기획해보세요.</p>
            </div>
            <Link
              href="/admin/rankings/new"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 transition-all"
            >
              첫 드래프트 만들기
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {rankings.map((ranking) => {
              const readiness = readinessById.get(ranking.id)
              const revalidation = revalidationById.get(ranking.id)
              const blockerCount = readiness?.blockers.length ?? 0

              return (
                <div
                  key={ranking.id}
                  className="group relative overflow-hidden p-5 sm:p-6 rounded-2xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] hover:border-indigo-500/15 transition-all shadow-lg"
                >
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="flex-grow space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {ranking.status === 'published' ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> 공개 발행 (Published)
                          </span>
                        ) : ranking.status === 'archived' ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase bg-slate-500/10 border border-slate-500/20 text-slate-400 flex items-center gap-1">
                            <Archive className="w-2.5 h-2.5" /> 보관 (Archived)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase bg-amber-500/10 border border-amber-500/20 text-amber-400">
                            작성 대기 (Draft)
                          </span>
                        )}

                        {readiness?.editorial_ready ? (
                          <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-extrabold text-emerald-300">
                            <CheckCircle2 className="h-2.5 w-2.5" /> 발행 품질 준비됨
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[9px] font-extrabold text-rose-300">
                            <AlertTriangle className="h-2.5 w-2.5" /> 품질 보완 {blockerCount}건
                          </span>
                        )}

                        {ranking.status === 'published' && revalidation && (
                          <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-extrabold ${freshnessClasses[revalidation.freshness_state]}`}>
                            <RefreshCw className="h-2.5 w-2.5" /> {freshnessLabels[revalidation.freshness_state]}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-white/[0.03] border border-white/5 px-2 py-0.5 rounded">
                          <FolderKanban className="w-2.5 h-2.5 text-slate-500" />
                          {ranking.categories?.name}
                        </span>

                        {ranking.subcategories?.name && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-white/[0.03] border border-white/5 px-2 py-0.5 rounded">
                            <Layers className="w-2.5 h-2.5 text-slate-500" />
                            {ranking.subcategories?.name}
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/10">
                          {ranking.ranking_type}
                        </span>
                      </div>

                      <div>
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-100 group-hover:text-indigo-300 transition-colors">
                          {ranking.title}
                        </h2>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{ranking.summary}</p>
                        <p className="font-mono text-[9px] text-slate-600 mt-1">슬러그 경로: /rankings/{ranking.slug}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-semibold pt-1">
                        <span>순위 항목: <strong className="text-slate-300 font-bold">{readiness?.entry_count ?? ranking.ranking_entries?.length ?? 0}개</strong></span>
                        <span>Criteria: <strong className="text-slate-300 font-bold">{readiness?.criteria_count ?? 0}개</strong></span>
                        <span>검증 가능 공개 출처: <strong className="text-slate-300 font-bold">{readiness?.public_source_count ?? 0}개</strong></span>
                        {readiness?.expected_entry_count !== null && readiness?.expected_entry_count !== undefined && (
                          <span>제목 약속: <strong className="text-slate-300 font-bold">TOP {readiness.expected_entry_count}</strong></span>
                        )}
                        <span>작성일시: {new Date(ranking.created_at).toLocaleDateString('ko-KR')}</span>
                        {ranking.published_at && <span className="text-emerald-500">발행일시: {new Date(ranking.published_at).toLocaleDateString('ko-KR')}</span>}
                        {revalidation?.next_review_at && ranking.status === 'published' && (
                          <span className="text-cyan-500">다음 재검증: {new Date(revalidation.next_review_at).toLocaleDateString('ko-KR')}</span>
                        )}
                      </div>

                      {readiness && blockerCount > 0 && (
                        <div className="rounded-xl border border-rose-500/10 bg-rose-500/[0.04] p-3">
                          <ul className="space-y-1 text-[10px] text-rose-200/90">
                            {readiness.blockers.slice(0, 3).map((blocker) => (
                              <li key={blocker.code}>• {blocker.message}</li>
                            ))}
                            {blockerCount > 3 && <li className="text-rose-400">• 외 {blockerCount - 3}건 — 프리뷰에서 전체 확인</li>}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center border-t border-white/5 md:border-0 pt-4 md:pt-0 w-full md:w-auto justify-end">
                      <Link
                        href={`/admin/rankings/${ranking.id}/revalidation`}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-500/20 hover:border-cyan-500/35 text-cyan-300 transition-all flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        재검증
                      </Link>
                      <Link
                        href={`/admin/rankings/${ranking.id}/edit`}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 transition-all flex items-center gap-1.5"
                      >
                        <FileEdit className="w-3.5 h-3.5 text-slate-400" />
                        순위/기준 편집
                      </Link>

                      <Link
                        href={`/admin/rankings/${ranking.id}/preview`}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600/10 hover:bg-indigo-600/25 border border-indigo-500/20 hover:border-indigo-500/35 text-indigo-300 transition-all flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        프리뷰 & 발행 검증
                        <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
