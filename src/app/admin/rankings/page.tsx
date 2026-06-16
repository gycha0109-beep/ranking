import React from 'react'
import Link from 'next/link'
import { listAdminRankings } from '@/lib/actions/admin'
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
  Sparkles
} from 'lucide-react'

// Next.js 캐시 무효화 및 동적 렌더링 강제
export const dynamic = 'force-dynamic'

export default async function AdminRankingsPage() {
  let rankings: any[] = []
  let errorMessage: string | null = null

  try {
    rankings = await listAdminRankings()
  } catch (err: any) {
    errorMessage = err.message
  }

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a0a0f] to-[#07070a] text-slate-100">
      <div className="max-w-7xl mx-auto">
        
        {/* 뒤로가기 링크 */}
        <Link 
          href="/admin" 
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white mb-6 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 px-3 py-1.5 rounded-lg transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          대시보드로 돌아가기
        </Link>

        {/* 상단 타이틀 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/[0.06]">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-purple-400" />
              랭킹 문서 통합 관리 (E2E)
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              랭킹 문서를 생성하고, 평가 기준 및 상세 순위 엔트리를 작성하여 최종 검증 후 발행합니다.
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

        {/* 피드백 에러 */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-xs font-bold">
            에러가 발생했습니다: {errorMessage}
          </div>
        )}

        {/* 랭킹 문서 목록 카드 그리드 */}
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
              const hasEntries = ranking.ranking_entries && ranking.ranking_entries.length > 0
              
              return (
                <div 
                  key={ranking.id}
                  className="group relative overflow-hidden p-5 sm:p-6 rounded-2xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] hover:border-indigo-500/15 transition-all shadow-lg"
                >
                  {/* 배경 장식 광원 */}
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    
                    {/* 정보 영역 */}
                    <div className="flex-grow space-y-3">
                      
                      {/* 태그 정보 */}
                      <div className="flex flex-wrap items-center gap-2">
                        {ranking.status === 'published' ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            공개 발행 (Published)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase bg-amber-500/10 border border-amber-500/20 text-amber-400">
                            작성 대기 (Draft)
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

                      {/* 제목 및 요약 */}
                      <div>
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-100 group-hover:text-indigo-300 transition-colors">
                          {ranking.title}
                        </h2>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                          {ranking.summary}
                        </p>
                        <p className="font-mono text-[9px] text-slate-600 mt-1">
                          슬러그 경로: /rankings/{ranking.slug}
                        </p>
                      </div>

                      {/* 정보 수치 */}
                      <div className="flex items-center gap-4 text-[11px] text-slate-500 font-semibold pt-1">
                        <span>순위 항목: <strong className="text-slate-300 font-bold">{ranking.ranking_entries?.length || 0}개</strong></span>
                        <span>•</span>
                        <span>작성일시: {new Date(ranking.created_at).toLocaleDateString('ko-KR')}</span>
                        {ranking.published_at && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-500">발행일시: {new Date(ranking.published_at).toLocaleDateString('ko-KR')}</span>
                          </>
                        )}
                      </div>

                    </div>

                    {/* 액션 제어 영역 */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center border-t border-white/5 md:border-0 pt-4 md:pt-0 w-full md:w-auto justify-end">
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
