import React from 'react'
import Link from 'next/link'
import { getHomeData } from '@/lib/queries/public'
import { createPublicClient } from '@/lib/supabase/public'
import { 
  Award, 
  Layers, 
  Sparkles, 
  ChevronRight, 
  Inbox, 
  Calendar, 
  Flame, 
  Database, 
  Search, 
  FileText, 
  Bookmark,
  ShieldCheck
} from 'lucide-react'

export const revalidate = 0 // 실시간 상태 확인을 위해 캐싱 비활성화

export default async function HomePage() {
  const { featuredRanking, recentRankings, categories } = await getHomeData()

  // 랭킹위키 아카이브 실시간 통계 조회 (Wiki 감성 강화)
  let totalRankingsCount = 0
  let totalItemsCount = 0
  
  try {
    const supabase = createPublicClient()
    const [rankingsRes, itemsRes] = await Promise.all([
      supabase.from('rankings').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'active')
    ])
    totalRankingsCount = rankingsRes.count || 0
    totalItemsCount = itemsRes.count || 0
  } catch (e) {
    // Fail-safe
  }

  return (
    <div className="relative min-h-screen pb-20 overflow-hidden bg-[#07070a]">
      {/* 백그라운드 오로라 빛 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] bg-gradient-to-b from-indigo-900/10 via-purple-900/5 to-transparent rounded-full blur-[100px] pointer-events-none" />

      {/* 전체 페이지 간격 조정 (space-y-16 -> space-y-10 으로 단축하여 랭킹 및 카테고리가 더 빨리 보이게 유도) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 relative z-10 space-y-10">
        
        {/* 1. 히어로 영역 (Wiki 아카이브 지향적인 문구 및 간결한 구성) */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Database className="w-3.5 h-3.5" />
            OPEN RANKING DATABASE
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-white">
            세상의 순위를 기준과 이유까지 <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-300">
              모아보는 랭킹 아카이브
            </span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto">
            광고와 주관적 주장에서 벗어난 투명한 지식 저장소. 랭킹위키는 검증된 후보 범위(Scope)와 명확한 평가 기준(Criteria), 상세한 선정 이유를 기록하여 모든 순위를 체계적으로 분류하는 개방형 위키입니다.
          </p>

          {/* 1-1. 아카이브 통합 검색 바 장식 (P0 스펙에 영향이 없도록 스타일만 구성) */}
          <div className="max-w-md mx-auto pt-2 relative group">
            <div className="relative">
              <input
                type="text"
                disabled
                placeholder="아카이브 문서 제목, 아이템, 태그 검색... (P1 준비중)"
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-white/[0.02] border border-white/10 rounded-2xl focus:outline-none text-slate-400 cursor-not-allowed group-hover:border-white/20 transition-all"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 -top-8 bg-slate-900 border border-white/10 text-[10px] text-slate-300 px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 shadow-2xl">
              검색 및 복잡 필터링은 P1 단계에서 활성화됩니다.
            </div>
          </div>

          {/* 1-2. 위키 아카이브 실시간 통계 보드 */}
          <div className="flex justify-center items-center gap-3 sm:gap-6 pt-4 max-w-lg mx-auto">
            <div className="flex-1 py-2 px-3 rounded-2xl bg-white/[0.01] border border-white/[0.04] text-center">
              <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">아카이브 문서</span>
              <span className="text-base sm:text-lg font-black text-white mt-0.5 inline-flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                {totalRankingsCount}개
              </span>
            </div>
            <div className="flex-1 py-2 px-3 rounded-2xl bg-white/[0.01] border border-white/[0.04] text-center">
              <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">검증 완료 아이템</span>
              <span className="text-base sm:text-lg font-black text-white mt-0.5 inline-flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {totalItemsCount}개
              </span>
            </div>
            <div className="flex-1 py-2 px-3 rounded-2xl bg-white/[0.01] border border-white/[0.04] text-center">
              <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">배점 기준 검증</span>
              <span className="text-base sm:text-lg font-black text-white mt-0.5 inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                100% 공개
              </span>
            </div>
          </div>
        </div>

        {/* 2. 대표 랭킹 (Featured Ranking) */}
        {featuredRanking && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.04] pb-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">이달의 대표 아카이브 문서</h2>
            </div>
            
            <div className="glass-card rounded-3xl overflow-hidden p-6 sm:p-8 flex flex-col lg:flex-row gap-6 relative group hover:border-indigo-500/20 transition-all duration-300">
              {/* 반사 라인 이펙트 */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-indigo-500/30 transition-all duration-300" />
              
              {/* 내용 */}
              <div className="flex-1 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 uppercase">
                      {featuredRanking.categories?.name}
                    </span>
                    {featuredRanking.subcategories && (
                      <span className="px-2.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider bg-purple-500/10 border border-purple-500/20 text-purple-300 uppercase">
                        {featuredRanking.subcategories.name}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono">DOC-ID: #{featuredRanking.id.slice(0, 4)}</span>
                  </div>
                  
                  <Link href={`/rankings/${featuredRanking.slug}`}>
                    <h3 className="text-xl sm:text-2xl font-black text-white hover:text-indigo-300 transition-colors leading-tight">
                      {featuredRanking.title}
                    </h3>
                  </Link>
                  <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-2xl">
                    {featuredRanking.summary}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/[0.04]">
                  <div className="flex items-center gap-2 text-slate-500 text-[10px] font-semibold">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>발행 일자: {new Date(featuredRanking.published_at || featuredRanking.updated_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                  
                  <Link 
                    href={`/rankings/${featuredRanking.slug}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-slate-950 hover:bg-indigo-50 text-xs font-bold transition-all"
                  >
                    아카이브 확인
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 3. 카테고리 그리드 (디렉토리 인덱스 형태로 변형) */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-white/[0.04] pb-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">카테고리 디렉토리</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <Link 
                key={cat.id} 
                href={`/categories/${cat.slug}`}
                className="glass-card glass-card-hover rounded-2xl p-5 block relative group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-extrabold text-sm text-slate-200 group-hover:text-indigo-300 transition-colors flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-indigo-500/60" />
                    {cat.name}
                  </h3>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-2">
                  {cat.description || '이 카테고리 내의 신뢰할 수 있는 랭킹들을 확인해 보세요.'}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* 4. 최신 랭킹 (최신 아카이브 문서로 표현 변경) */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-white/[0.04] pb-2">
            <Award className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">최근 업데이트 아카이브 문서</h2>
          </div>

          {recentRankings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentRankings.map((ranking) => (
                <div 
                  key={ranking.id}
                  className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                      <div className="flex items-center gap-1">
                        <span className="text-indigo-400 uppercase">
                          {ranking.categories?.name}
                        </span>
                        {ranking.subcategories && (
                          <>
                            <span>&bull;</span>
                            <span className="text-purple-400">
                              {ranking.subcategories.name}
                            </span>
                          </>
                        )}
                      </div>
                      <span className="font-mono text-[9px]">ID: #{ranking.id.slice(0, 4)}</span>
                    </div>
                    <Link href={`/rankings/${ranking.slug}`}>
                      <h3 className="font-extrabold text-sm text-slate-100 hover:text-indigo-300 transition-colors line-clamp-1 leading-snug">
                        {ranking.title}
                      </h3>
                    </Link>
                    <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-2">
                      {ranking.summary}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] text-[10px] text-slate-500 font-semibold">
                    <span>{new Date(ranking.published_at || ranking.updated_at).toLocaleDateString('ko-KR')}</span>
                    <Link href={`/rankings/${ranking.slug}`} className="text-indigo-400 hover:underline flex items-center gap-0.5">
                      자료 열람 <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-4">
              <div className="p-3 rounded-full bg-slate-900 border border-white/5">
                <Inbox className="w-6 h-6 text-slate-600" />
              </div>
              <h3 className="font-bold text-xs text-slate-300">발행된 랭킹 문서가 없습니다</h3>
              <p className="text-slate-500 text-[11px] max-w-sm leading-relaxed">
                현재 등록되거나 공개 발행된 랭킹 정보가 존재하지 않습니다. <br />
                관리자 계정으로 로그인하여 첫 아카이브 문서를 등록해 주세요.
              </p>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
