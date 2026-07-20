import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PreviewControlPanel from './PreviewControlPanel'
import SafeImage from '@/components/SafeImage'
import { 
  ArrowLeft, 
  Award, 
  Tag, 
  BookOpen, 
  Layers, 
  ExternalLink, 
  BadgeCheck, 
  CheckCircle,
  HelpCircle,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Link2
} from 'lucide-react'

interface Props {
  params: Promise<{
    id: string
  }>
}

export const dynamic = 'force-dynamic'

export default async function AdminRankingPreviewPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // 1. 랭킹 정보 조회 (상태 무관 전체 조회 가능)
  const { data: ranking, error: rankingError } = await supabase
    .from('rankings')
    .select('*, categories(name, slug), subcategories(name, slug)')
    .eq('id', id)
    .maybeSingle()

  if (rankingError || !ranking) {
    notFound()
  }

  // 2. 랭킹에 매핑된 상세 데이터들 조회 (criteria, sources, entries, facets)
  const [
    { data: criteria },
    { data: sources },
    { data: entriesData },
    { data: rankingFacetsData }
  ] = await Promise.all([
    supabase.from('ranking_criteria').select('*').eq('ranking_id', id).order('sort_order', { ascending: true }),
    supabase.from('ranking_sources').select('*').eq('ranking_id', id),
    supabase.from('ranking_entries').select('*, items(*)').eq('ranking_id', id).order('position', { ascending: true }),
    supabase.from('ranking_facets').select('facets(id, name, slug, facet_groups(name, code))').eq('ranking_id', id)
  ])

  const entries = entriesData || []
  const sourcesList = sources || []
  const criteriaList = criteria || []
  const facets = (rankingFacetsData || []).map((rf: any) => rf.facets).filter(Boolean)

  // 3. 자가 점검 체크리스트 빌드 (프리뷰 제어용)
  const validation = {
    hasTitle: !!ranking.title,
    hasCategory: !!ranking.category_id,
    hasSummary: !!ranking.summary,
    hasScope: !!ranking.scope_json && Object.keys(ranking.scope_json).length > 0 && !!ranking.scope_json.target,
    hasEntries: entries.length >= 1,
    hasCriteria: criteriaList.length >= 1,
  }

  const moderationIssues: Array<{ label: string; status: string; reason: string }> = []
  const addIssue = (label: string, status?: string | null, reason?: string | null) => {
    if (status === 'blocked' || status === 'needs_review') {
      moderationIssues.push({ label, status, reason: reason || 'none' })
    }
  }

  addIssue('랭킹 본문', ranking.moderation_status, ranking.moderation_reason)
  addIssue('랭킹 커버 이미지', ranking.image_moderation_status, ranking.image_moderation_reason)

  entries.forEach((entry: any) => {
    addIssue(`${entry.position}위 선정 사유`, entry.moderation_status, entry.moderation_reason)
    addIssue(`${entry.position}위 아이템`, entry.items?.moderation_status, entry.items?.moderation_reason)
    addIssue(`${entry.position}위 아이템 이미지`, entry.items?.image_moderation_status, entry.items?.image_moderation_reason)
  })

  const isPublishable = Object.values(validation).every(Boolean) && moderationIssues.length === 0

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a0a0f] to-[#07070a] text-slate-100">
      <div className="max-w-6xl mx-auto">
        
        {/* 상단 네비게이션 제어바 */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <Link 
            href="/admin/rankings" 
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 px-3.5 py-2 rounded-xl transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            랭킹 목록으로 돌아가기
          </Link>
          
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/rankings/${ranking.id}/edit`}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 transition-all"
            >
              순위/기준 즉시 수정
            </Link>
          </div>
        </div>

        {/* 1. 발행 제어 본부 컨트롤 패널 (클라이언트 컴포넌트 마운트) */}
        <PreviewControlPanel 
          rankingId={ranking.id}
          rankingSlug={ranking.slug}
          status={ranking.status}
          validation={validation}
          isPublishable={isPublishable}
          moderationStatus={ranking.moderation_status || 'clean'}
          moderationReason={ranking.moderation_reason || 'none'}
          moderationIssues={moderationIssues}
        />

        {/* 구분선 */}
        <div className="border-t border-white/[0.06] my-10 pt-6">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">
            실제 공개 화면 레이아웃 미리보기 (Preview Area)
          </span>
        </div>

        {/* ==============================================================
         * 2. 공개 페이지 레이아웃 프리뷰 시작 (실제 랭킹 상세와 100% 동일 구현)
         * ============================================================== */}
        
        <div className="space-y-10">
          
          {/* A. 랭킹 메인 헤더 */}
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6 sm:p-8 md:p-12 shadow-2xl">
            {/* 배경 그라데이션 원 */}
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 uppercase">
                  {ranking.categories?.name}
                </span>
                {ranking.subcategories?.name && (
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wider bg-white/[0.04] border border-white/[0.06] text-slate-300 uppercase">
                    {ranking.subcategories?.name}
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wider bg-purple-500/10 border border-purple-500/20 text-purple-300 uppercase">
                  {ranking.ranking_type}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-200">
                {ranking.title}
              </h1>

              <p className="text-sm sm:text-base text-slate-400 max-w-3xl leading-relaxed">
                {ranking.summary}
              </p>

              {/* Facet 해시태그 목록 */}
              {facets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {facets.map((facet: any, idx) => (
                    <span 
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900/60 border border-white/5 text-slate-400"
                    >
                      <Tag className="w-3 h-3 text-slate-500" />
                      {facet.facet_groups?.name && (
                        <span className="text-slate-500 text-[10px] mr-0.5">{facet.facet_groups.name}:</span>
                      )}
                      {facet.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* B. 조사 개요 (Scope) & 선정 기준 (Criteria) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* 조사 범위 (Scope) */}
            <div className="lg:col-span-1 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                조사 범위 (Scope)
              </h3>
              
              {ranking.scope_json && ranking.scope_json.target ? (
                <div className="space-y-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5">
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">분석 및 조사 대상</span>
                    <span className="text-slate-200 font-semibold">{ranking.scope_json.target}</span>
                  </div>
                  {ranking.scope_json.period && (
                    <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5">
                      <span className="text-[10px] text-slate-500 font-bold block mb-1">데이터 수집 기간</span>
                      <span className="text-slate-200 font-semibold">{ranking.scope_json.period}</span>
                    </div>
                  )}
                  {ranking.scope_json.method && (
                    <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5">
                      <span className="text-[10px] text-slate-500 font-bold block mb-1">판정 분석 방법론</span>
                      <span className="text-slate-200 font-semibold leading-relaxed">{ranking.scope_json.method}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">등록된 조사 범위 정보가 부족합니다.</p>
              )}
            </div>

            {/* 평가 선정 기준 (Criteria) */}
            <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-400" />
                순위 판정 선정 기준 (Criteria)
              </h3>

              {criteriaList.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {criteriaList.map((crit: any) => (
                    <div 
                      key={crit.id}
                      className="p-4 rounded-xl border border-white/[0.04] bg-[#0c0c12] hover:border-purple-500/10 transition-colors flex flex-col justify-between gap-2"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-200">{crit.name}</span>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{crit.description || '세부 안내 없음'}</p>
                      </div>
                      {crit.weight && (
                        <div className="text-right">
                          <span className="text-[10px] font-black text-purple-400 bg-purple-500/10 border border-purple-500/25 px-2 py-0.5 rounded">
                            반영 비중: {crit.weight}%
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">평가 선정 기준이 아직 등록되지 않았습니다.</p>
              )}
            </div>

          </div>

          {/* C. 랭킹 종합 본문 설명 (Body) */}
          {ranking.body && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6 sm:p-8 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-400" />
                기획 종합 판정서 리포트
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {ranking.body}
              </p>
            </div>
          )}

          {/* D. 순위표 리스트 (Gold, Silver, Bronze 등 차별화 보더 효과) */}
          <div className="space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              순위 분석 결과표 (Entries)
            </h3>

            {entries.length > 0 ? (
              <div className="grid gap-6">
                {entries.map((entry: any) => {
                  const isGold = entry.position === 1
                  const isSilver = entry.position === 2
                  const isBronze = entry.position === 3

                  // 순위에 따른 화려한 다크 테마 보더 정의
                  const borderClass = isGold
                    ? 'border-amber-500/30 bg-gradient-to-r from-amber-500/[0.03] to-transparent shadow-lg shadow-amber-500/[0.02]'
                    : isSilver
                    ? 'border-slate-300/30 bg-gradient-to-r from-slate-300/[0.03] to-transparent'
                    : isBronze
                    ? 'border-amber-700/30 bg-gradient-to-r from-amber-700/[0.03] to-transparent'
                    : 'border-white/[0.05]'

                  const rankColorClass = isGold
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-md'
                    : isSilver
                    ? 'bg-slate-300/10 border-slate-300/20 text-slate-300'
                    : isBronze
                    ? 'bg-amber-700/10 border-amber-700/20 text-amber-600'
                    : 'bg-white/[0.02] border-white/5 text-slate-400'

                  return (
                    <div 
                      key={entry.id}
                      className={`relative overflow-hidden rounded-3xl border p-5 sm:p-6 transition-all ${borderClass}`}
                    >
                      {/* 스폰서십 배지 */}
                      {entry.sponsor_flag && (
                        <div className="absolute top-0 right-0">
                          <span className="px-3 py-1 rounded-bl-xl text-[9px] font-black bg-indigo-600 text-white tracking-widest uppercase">
                            Sponsored
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col md:flex-row gap-6 relative z-10">
                        {/* 왼쪽: 순위 배지 & 이미지 */}
                        <div className="flex items-center md:items-start gap-4 shrink-0">
                          <div className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center shrink-0 ${rankColorClass}`}>
                            <span className="text-[8px] font-black tracking-widest">RANK</span>
                            <span className="text-xl font-black leading-none mt-0.5">{entry.position}</span>
                          </div>

                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-white/5 bg-slate-900 shrink-0 flex items-center justify-center relative">
                            {entry.items?.image_url ? (
                              <SafeImage 
                                src={entry.items.image_url} 
                                alt={entry.items.title} 
                                className="w-full h-full object-cover" 
                                fallbackSrc="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=100"
                              />
                            ) : (
                              <Award className="w-6 h-6 text-slate-700" />
                            )}
                          </div>
                        </div>

                        {/* 오른쪽: 상세 평가 및 스펙 */}
                        <div className="flex-grow flex flex-col justify-between space-y-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-[10px] font-bold text-slate-500">
                                {entry.items?.brand_or_creator || '기타 제조사'}
                              </span>
                              <span className="text-[10px] text-slate-700">•</span>
                              <span className="text-[10px] text-slate-500 font-mono uppercase">
                                {entry.items?.item_type}
                              </span>
                              {entry.editor_score && (
                                <span className="ml-auto md:ml-0 px-2 py-0.5 rounded text-[9px] font-extrabold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                                  에디터 평점: {entry.editor_score} / 10
                                </span>
                              )}
                            </div>

                            <h4 className="text-base sm:text-lg font-bold text-slate-200">
                              {entry.items?.title}
                            </h4>

                            <p className="mt-3 text-xs sm:text-sm text-slate-300 leading-relaxed bg-white/[0.01] border border-white/[0.03] p-3.5 rounded-2xl">
                              {entry.reason}
                            </p>
                          </div>

                          {/* 제품 외부 링크 */}
                          {(entry.items?.affiliate_url || entry.items?.external_url) && (
                            <div className="flex flex-wrap gap-2 pt-1.5">
                              {entry.items.affiliate_url && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400">
                                  최저가 확인 링크 탑재됨
                                  <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />
                                </span>
                              )}
                              {entry.items.external_url && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                                  공식몰 정보 탑재됨
                                  <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">순위 결과표 엔트리가 비어 있습니다.</p>
            )}
          </div>

          {/* E. 근거 출처 목록 */}
          {sourcesList.length > 0 && (
            <div className="rounded-2xl border border-white/[0.06] bg-[#050508] p-6 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Link2 className="w-4 h-4 text-amber-400" />
                평가 검정 데이터 근거 (Sources)
              </h4>
              <ul className="space-y-2 text-xs text-slate-400 pl-1">
                {sourcesList.map((source: any) => (
                  <li key={source.id} className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 uppercase font-mono shrink-0">
                      {source.source_type}
                    </span>
                    {source.url ? (
                      <a 
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-indigo-400 hover:underline inline-flex items-center gap-1 font-semibold"
                      >
                        {source.label}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="font-semibold">{source.label}</span>
                    )}
                    {source.note && (
                      <span className="text-slate-600">({source.note})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

      </div>
    </div>
  )
}
