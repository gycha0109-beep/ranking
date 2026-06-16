import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublishedRankingBySlug } from '@/lib/queries/public'
import { 
  ChevronRight, Award, Scale, HelpCircle, Calendar, ExternalLink, 
  Tag, Info, Star, ShieldCheck, Compass, AlertCircle
} from 'lucide-react'

export const revalidate = 0

interface Props {
  params: Promise<{
    rankingSlug: string
  }>
}

// 랭킹 타입 한글 매핑 헬퍼
function getRankingTypeName(type: string) {
  const map: { [key: string]: string } = {
    editor_pick: '운영자 추천 (Editor Pick)',
    popularity: '인기 지표 분석 (Popularity)',
    quality: '품질 지표 평가 (Quality)',
    purpose: '특수 목적 타겟 (Purpose)',
    user_vote: '사용자 투표 반영 (User Vote)',
    sponsored: '스폰서쉽 제휴 (Sponsored)',
  }
  return map[type] || type
}

export default async function RankingDetailPage({ params }: Props) {
  const { rankingSlug } = await params
  
  const ranking = await getPublishedRankingBySlug(rankingSlug)
  
  // draft인 경우 getPublishedRankingBySlug에서 null이 오므로 404 처리
  if (!ranking) {
    notFound()
  }

  // scope_json을 파싱하여 렌더링하기 쉽게 포맷팅
  const scopeItems = Object.entries(ranking.scope_json || {}).map(([key, val]) => ({
    label: key.toUpperCase(),
    value: String(val)
  }))

  return (
    <div className="relative min-h-screen pb-24 bg-[#07070a] font-sans text-slate-200 overflow-hidden">
      {/* 랭킹 상세 전용 백그라운드 오로라 이펙트 */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-purple-900/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 relative z-10 space-y-10">
        
        {/* 1. 브레드크럼 */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-white transition-colors">홈</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href={`/categories/${ranking.categories?.slug}`} className="hover:text-white transition-colors">
            {ranking.categories?.name}
          </Link>
          {ranking.subcategories && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link 
                href={`/categories/${ranking.categories?.slug}/${ranking.subcategories.slug}`} 
                className="hover:text-white transition-colors"
              >
                {ranking.subcategories.name}
              </Link>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-indigo-400 line-clamp-1">{ranking.title}</span>
        </div>

        {/* 2. 헤더 영역 (제목, 요약, 메타 정보) */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
              {getRankingTypeName(ranking.ranking_type)}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold ml-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>최종 업데이트: {new Date(ranking.published_at || ranking.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            {ranking.title}
          </h1>
          
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed border-l-2 border-indigo-500 pl-4 bg-white/[0.01] py-2 rounded-r-xl">
            {ranking.summary}
          </p>
        </div>

        {/* 3. 본문 및 Scope, Facet 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* 본문/설명 (좌측 2열) */}
          <div className="md:col-span-2 space-y-6">
            {ranking.body && (
              <div className="glass-card rounded-2xl p-6 space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-400" />
                  에디터 서문 / 분석 리포트
                </h2>
                <div className="text-slate-300 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                  {ranking.body}
                </div>
              </div>
            )}
            
            {/* 4. 선정 기준 (Criteria) */}
            <div className="glass-card rounded-2xl p-6 space-y-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-purple-400" />
                순위 배점 및 선별 기준 (Criteria)
              </h2>
              
              <div className="divide-y divide-white/[0.04] space-y-4">
                {ranking.criteria.map((c: any, index: number) => (
                  <div key={c.id} className={`flex items-start gap-4 ${index > 0 ? 'pt-4' : ''}`}>
                    <div className="w-8 h-8 rounded-lg bg-purple-600/10 border border-purple-500/20 text-purple-400 font-extrabold text-xs flex items-center justify-center shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-200 text-sm">{c.name}</h4>
                        {c.weight && (
                          <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
                            가중치: {c.weight}%
                          </span>
                        )}
                      </div>
                      {c.description && (
                        <p className="text-slate-400 text-xs leading-relaxed">{c.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scope & Facet (우측 1열) */}
          <div className="space-y-6">
            
            {/* Scope 정보 */}
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-amber-400" />
                후보 범위 (Ranking Scope)
              </h2>
              
              {scopeItems.length > 0 ? (
                <div className="space-y-3">
                  {scopeItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-white/[0.03]">
                      <span className="text-slate-500 font-semibold">{item.label}</span>
                      <span className="font-bold text-slate-200">{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">정해진 후보 범위 설명이 없습니다.</p>
              )}
            </div>

            {/* Facets 정보 */}
            {ranking.facets && ranking.facets.length > 0 && (
              <div className="glass-card rounded-2xl p-5 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  연결된 분류 태그 (Facets)
                </h2>
                
                <div className="flex flex-wrap gap-1.5">
                  {ranking.facets.map((facet: any) => (
                    <span 
                      key={facet.id}
                      className="px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 text-[10px] font-bold text-slate-300"
                    >
                      {facet.facet_groups?.name}: {facet.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* 출처 정보 */}
            {ranking.sources && ranking.sources.length > 0 && (
              <div className="glass-card rounded-2xl p-5 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-blue-400" />
                  참고 근거 및 출처 (Sources)
                </h2>
                
                <div className="space-y-3">
                  {ranking.sources.map((src: any) => (
                    <div key={src.id} className="space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-slate-200">{src.label}</span>
                        {src.url && (
                          <a 
                            href={src.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {src.note && (
                        <p className="text-slate-500 text-[10px] leading-relaxed">{src.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 5. 순위 리스트 에어리어 (Position 순서) */}
        <section className="space-y-6 pt-6 border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-black text-white">순위표 리스트</h2>
          </div>

          <div className="space-y-6">
            {ranking.entries.map((entry: any) => {
              const item = entry.items
              if (!item) return null

              // 프리미엄 순위별 테두리 하이라이팅 효과
              let borderStyle = 'border-white/5 bg-white/[0.01]'
              let badgeColor = 'bg-slate-800 text-slate-400 border-slate-700'
              
              if (entry.position === 1) {
                borderStyle = 'border-amber-500/20 bg-amber-500/[0.02] shadow-[0_0_20px_0_rgba(245,158,11,0.03)]'
                badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              } else if (entry.position === 2) {
                borderStyle = 'border-slate-400/20 bg-slate-400/[0.01]'
                badgeColor = 'bg-slate-400/10 text-slate-300 border-slate-400/35'
              } else if (entry.position === 3) {
                borderStyle = 'border-amber-700/20 bg-amber-700/[0.01]'
                badgeColor = 'bg-amber-700/10 text-amber-600 border-amber-700/30'
              }

              return (
                <div 
                  key={entry.id}
                  className={`glass-card rounded-3xl p-6 sm:p-8 border ${borderStyle} transition-all duration-300 flex flex-col md:flex-row gap-6 relative group`}
                >
                  {/* 스폰서십 리본 뱃지 */}
                  {entry.sponsor_flag && (
                    <div className="absolute -top-2.5 right-6 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/35 text-[9px] font-bold text-indigo-300 uppercase tracking-wider">
                      <ShieldCheck className="w-3 h-3 text-indigo-400" />
                      스폰서 추천
                    </div>
                  )}

                  {/* 1. 순위 빅 뱃지 */}
                  <div className="md:w-16 flex md:flex-col items-center justify-center shrink-0">
                    <div className={`w-12 h-12 rounded-2xl border font-black text-xl flex items-center justify-center ${badgeColor}`}>
                      {entry.position}
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold tracking-wider mt-1 ml-2 md:ml-0">RANK</span>
                  </div>

                  {/* 2. 아이템 정보 */}
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <Link href={`/items/${item.slug}`}>
                            <h3 className="text-lg font-bold text-white hover:text-indigo-400 transition-colors leading-tight">
                              {item.title}
                            </h3>
                          </Link>
                          {item.brand_or_creator && (
                            <span className="text-xs text-slate-500 font-semibold">{item.brand_or_creator}</span>
                          )}
                        </div>

                        {/* 별점 또는 스코어 */}
                        {entry.editor_score && (
                          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-900 border border-white/5">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span className="text-xs font-bold text-amber-400">{Number(entry.editor_score).toFixed(1)}</span>
                          </div>
                        )}
                      </div>

                      {/* 선정 이유 */}
                      <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                        {entry.reason}
                      </p>
                    </div>

                    {/* 기준별 상세 가중 배점 정보가 있는 경우 노출 (score_json) */}
                    {entry.score_json?.scores && entry.score_json.scores.length > 0 && (
                      <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 space-y-2">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">세부 기준별 배점 평가</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {entry.score_json.scores.map((scoreObj: any, sIdx: number) => (
                            <div key={sIdx} className="flex justify-between items-center text-xs py-1 px-2.5 rounded-lg bg-white/[0.01] border border-white/[0.02]">
                              <span className="text-slate-400">{scoreObj.criterion}</span>
                              <span className="font-bold text-slate-200">{scoreObj.score}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 아이템 외부 링크 아웃라인 카드 */}
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <Link 
                        href={`/items/${item.slug}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-indigo-400 transition-colors"
                      >
                        상세 스펙 & 관련 랭킹 보기
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>

                      {item.external_url && (
                        <a 
                          href={item.external_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] font-semibold text-slate-300 hover:text-white transition-all ml-auto"
                        >
                          공식 홈페이지
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                        </a>
                      )}

                      {item.affiliate_url && (
                        <a 
                          href={item.affiliate_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-bold text-indigo-300 hover:bg-indigo-500/20 transition-all"
                        >
                          최저가 구매
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

      </div>
    </div>
  )
}
