import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getItemBySlug, getRankingsContainingItem } from '@/lib/queries/public'
import { ExternalLink, Tag, ShieldAlert, Award, ArrowLeft, Layers } from 'lucide-react'
import SafeImage from '@/components/SafeImage'

interface Props {
  params: Promise<{
    itemSlug: string
  }>
}

export default async function ItemDetailPage({ params }: Props) {
  const { itemSlug } = await params
  
  // 1. 아이템 데이터 조회
  const item = await getItemBySlug(itemSlug)
  
  if (!item) {
    notFound()
  }

  // 2. 이 아이템이 포함된 모든 published 랭킹 조회
  const rankings = await getRankingsContainingItem(item.id)

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a0a0f] to-[#07070a] text-slate-100">
      <div className="max-w-4xl mx-auto">
        
        {/* 뒤로가기 링크 */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white mb-8 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 px-3.5 py-2 rounded-xl transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          홈으로 돌아가기
        </Link>

        {/* 아이템 메인 헤더 카드 (글래스모피즘) */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-6 sm:p-8 md:p-10 mb-8 shadow-2xl shadow-indigo-950/10">
          {/* 장식용 그라데이션 광원 */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start relative z-10">
            {/* 아이템 이미지 */}
            <div className="w-48 h-48 sm:w-56 sm:h-56 relative rounded-2xl overflow-hidden border border-white/[0.08] bg-slate-900/50 flex items-center justify-center shrink-0">
              {item.image_url ? (
                <SafeImage 
                  src={item.image_url} 
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  fallbackSrc="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Layers className="w-10 h-10 text-slate-600" />
                  <span className="text-xs">이미지 없음</span>
                </div>
              )}
            </div>

            {/* 아이템 스펙 정보 */}
            <div className="flex-grow text-center md:text-left flex flex-col justify-between h-full min-h-[220px]">
              <div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wider uppercase bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                    {item.item_type}
                  </span>
                  {item.brand_or_creator && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wider bg-white/[0.04] border border-white/[0.06] text-slate-300">
                      {item.brand_or_creator}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-200">
                  {item.title}
                </h1>
                
                <p className="mt-4 text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl">
                  {item.description || '이 아이템에 대한 상세 설명이 등록되어 있지 않습니다.'}
                </p>
              </div>

              {/* 관련 Facet 태그 */}
              {item.facets && item.facets.length > 0 && (
                <div className="mt-6">
                  <div className="flex flex-wrap justify-center md:justify-start gap-1.5">
                    {item.facets.map((facet: any) => (
                      <span 
                        key={facet.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900/40 border border-white/5 text-slate-400"
                      >
                        <Tag className="w-3 h-3 text-slate-500" />
                        {facet.facet_groups?.name && (
                          <span className="text-slate-500 text-[10px] font-semibold mr-0.5">{facet.facet_groups.name}:</span>
                        )}
                        {facet.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 제휴 및 외부 링크 버튼 */}
              {(item.external_url || item.affiliate_url) && (
                <div className="mt-8 flex flex-wrap justify-center md:justify-start gap-3">
                  {item.affiliate_url && (
                    <a 
                      href={item.affiliate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 border border-indigo-500/30 text-white transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      최저가 비교 및 구매하기
                    </a>
                  )}
                  {item.external_url && (
                    <a 
                      href={item.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-slate-200 transition-all flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      공식 홈페이지 방문
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 랭킹 게재 내역 */}
        <div className="relative rounded-3xl border border-white/[0.06] bg-white/[0.01] p-6 sm:p-8">
          <h2 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            이 아이템이 포함된 랭킹 정보 ({rankings.length}건)
          </h2>

          {rankings.length > 0 ? (
            <div className="grid gap-4">
              {rankings.map((ranking: any) => (
                <Link
                  key={ranking.id}
                  href={`/rankings/${ranking.slug}`}
                  className="group relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-2xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/[0.02] transition-all"
                >
                  <div className="flex items-center gap-4">
                    {/* 순위 마크 */}
                    <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/10 group-hover:bg-indigo-600/20 group-hover:border-indigo-500/35 flex flex-col items-center justify-center transition-all shrink-0">
                      <span className="text-[10px] font-bold text-indigo-400 tracking-wider">RANK</span>
                      <span className="text-base font-extrabold text-white leading-none mt-0.5">{ranking.position}위</span>
                    </div>
                    
                    {/* 랭킹 제목 및 카테고리 */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          {ranking.categories?.name}
                        </span>
                        {ranking.subcategories?.name && (
                          <>
                            <span className="text-[10px] text-slate-600">•</span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              {ranking.subcategories?.name}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-200 group-hover:text-indigo-300 transition-colors">
                        {ranking.title}
                      </h3>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-0 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1">
                    랭킹 검증 결과 확인하기
                    <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-white/10 rounded-2xl text-slate-500 gap-3">
              <ShieldAlert className="w-8 h-8 text-slate-600" />
              <div className="text-center">
                <p className="text-sm font-semibold">진행 중인 랭킹 내역이 없습니다.</p>
                <p className="text-xs text-slate-600 mt-1">이 아이템은 아직 발행된 공개 랭킹에 등재되지 않았습니다.</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
