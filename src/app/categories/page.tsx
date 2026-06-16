import React from 'react'
import Link from 'next/link'
import { getVisibleCategories } from '@/lib/queries/public'
import { Layers, ChevronRight, Inbox, Compass } from 'lucide-react'

export const revalidate = 0

export default async function CategoriesPage() {
  const categories = await getVisibleCategories()

  return (
    <div className="relative min-h-screen pb-20 bg-[#07070a] font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[300px] bg-gradient-to-b from-indigo-950/10 via-transparent to-transparent rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 relative z-10 space-y-12">
        {/* 헤더 */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold tracking-wider">
            <Compass className="w-3.5 h-3.5" />
            카테고리 탐색 허브
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            전체 주제별 카테고리
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
            관심 있는 대분류를 탐색하고, 서브카테고리로 더욱 좁혀 구체적이고 엄선된 랭킹 문서들을 탐험해 보세요.
          </p>
        </div>

        {/* 카테고리 목록 그리드 */}
        {categories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {categories.map((cat) => (
              <div 
                key={cat.id}
                className="glass-card rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6 hover:border-indigo-500/20 transition-all duration-300 relative group"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
                      <Layers className="w-5 h-5" />
                    </div>
                    <Link href={`/categories/${cat.slug}`}>
                      <h2 className="text-xl font-bold text-white hover:text-indigo-400 transition-colors">
                        {cat.name}
                      </h2>
                    </Link>
                  </div>
                  
                  <p className="text-slate-400 text-xs leading-relaxed">
                    {cat.description || '이 카테고리 하위의 다양한 전문 랭킹 정보와 아이템들을 확인하세요.'}
                  </p>
                </div>

                {/* 서브카테고리 매핑 리스트 */}
                <div className="space-y-3 pt-4 border-t border-white/[0.04]">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">하위 서브카테고리</h3>
                  {cat.subcategories && cat.subcategories.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {cat.subcategories.map((sub: any) => (
                        <Link
                          key={sub.id}
                          href={`/categories/${cat.slug}/${sub.slug}`}
                          className="px-3 py-1.5 rounded-lg bg-white/[0.02] hover:bg-indigo-600/10 border border-white/5 hover:border-indigo-500/20 text-xs font-semibold text-slate-300 hover:text-indigo-300 transition-all"
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-600 italic">등록된 하위 서브카테고리가 없습니다.</span>
                  )}
                </div>

                {/* 이동 링크 */}
                <div className="flex justify-end pt-2">
                  <Link 
                    href={`/categories/${cat.slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 group/link"
                  >
                    카테고리 전체보기
                    <ChevronRight className="w-4 h-4 transition-transform group-hover/link:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-16 text-center flex flex-col items-center justify-center space-y-4">
            <div className="p-4 rounded-full bg-slate-900 border border-white/5">
              <Inbox className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="font-bold text-slate-300">카테고리가 비어 있습니다</h3>
            <p className="text-slate-500 text-xs max-w-sm leading-relaxed">
              등록된 공개 대분류 카테고리가 존재하지 않습니다. 어드민에서 카테고리를 먼저 구성해 주십시오.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
