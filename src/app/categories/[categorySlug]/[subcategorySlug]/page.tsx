import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSubcategoryBySlug, getPublishedRankingsBySubcategory } from '@/lib/queries/public'
import { Layers, ChevronRight, Inbox, Calendar, Award } from 'lucide-react'

export const revalidate = 0

interface Props {
  params: Promise<{
    categorySlug: string
    subcategorySlug: string
  }>
}

export default async function SubcategoryPage({ params }: Props) {
  const { categorySlug, subcategorySlug } = await params
  
  // 데이터 병렬 패치
  const subcategory = await getSubcategoryBySlug(categorySlug, subcategorySlug)
  if (!subcategory) {
    notFound()
  }
  
  const rankings = await getPublishedRankingsBySubcategory(categorySlug, subcategorySlug)

  return (
    <div className="relative min-h-screen pb-20 bg-[#07070a] font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[300px] bg-gradient-to-b from-indigo-950/10 via-transparent to-transparent rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 relative z-10 space-y-12">
        
        {/* 상위 브레드크럼 및 헤더 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link href="/" className="hover:text-white transition-colors">홈</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/categories" className="hover:text-white transition-colors">카테고리</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href={`/categories/${categorySlug}`} className="hover:text-white transition-colors">
              {subcategory.categories?.name}
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-indigo-400">{subcategory.name}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400">
                  <Layers className="w-6 h-6" />
                </div>
                {subcategory.name} 랭킹
              </h1>
              <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
                {subcategory.description || `${subcategory.name} 분야의 정밀 분석 및 공정 순위표 리스트입니다.`}
              </p>
            </div>
          </div>
        </div>

        {/* 랭킹 목록 */}
        <div className="space-y-6 pt-6 border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white">세부 분야 랭킹 문서 ({rankings.length})</h2>
          </div>

          {rankings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rankings.map((ranking) => (
                <div 
                  key={ranking.id}
                  className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">
                        {subcategory.categories?.name}
                      </span>
                      <span className="text-slate-800 text-xs">&bull;</span>
                      <span className="text-[10px] font-bold text-purple-400">
                        {subcategory.name}
                      </span>
                    </div>
                    
                    <Link href={`/rankings/${ranking.slug}`}>
                      <h3 className="font-extrabold text-sm text-slate-100 hover:text-indigo-300 transition-colors line-clamp-1 leading-snug">
                        {ranking.title}
                      </h3>
                    </Link>
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
                      {ranking.summary}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] text-[10px] text-slate-500 font-semibold">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(ranking.published_at || ranking.updated_at).toLocaleDateString()}</span>
                    </div>
                    <Link 
                      href={`/rankings/${ranking.slug}`} 
                      className="text-indigo-400 hover:underline flex items-center gap-0.5"
                    >
                      보기 <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
              <div className="p-4 rounded-full bg-slate-900 border border-white/5">
                <Inbox className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="font-bold text-slate-300">발행된 랭킹이 없습니다</h3>
              <p className="text-slate-500 text-xs max-w-sm leading-relaxed">
                현재 이 세부 분야에 등록되거나 공개 발행된 랭킹 문서가 존재하지 않습니다.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
