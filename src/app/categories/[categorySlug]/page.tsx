import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import FacetFilterPanel from '@/components/FacetFilterPanel'
import { getCategoryBySlug } from '@/lib/queries/public'
import { getPublicFacetOptions, listPublicRankings } from '@/lib/queries/search'
import {
  appendFacetParams,
  canonicalizeFacetIds,
  resolveFacetIds,
  resolveRankingBrowseSort,
} from '@/lib/search/contracts'
import { Layers, ChevronRight, Inbox, Calendar, Award, Flame } from 'lucide-react'

export const revalidate = 0

interface Props {
  params: Promise<{
    categorySlug: string
  }>
  searchParams: Promise<{
    sort?: string | string[]
    cursor?: string | string[]
    facet?: string | string[]
  }>
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function browseHref(path: string, sort: string, facetIds: string[], cursor?: string | null) {
  const params = new URLSearchParams({ sort })
  if (cursor) params.set('cursor', cursor)
  appendFacetParams(params, facetIds)
  return `${path}?${params.toString()}`
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ categorySlug }, query] = await Promise.all([params, searchParams])
  const category = await getCategoryBySlug(categorySlug)
  if (!category) {
    notFound()
  }

  const sort = resolveRankingBrowseSort(first(query.sort))
  const requestedFacets = resolveFacetIds(query.facet)
  const options = await getPublicFacetOptions({ kind: 'ranking', categorySlug })
  const canonicalFacets = canonicalizeFacetIds(requestedFacets.ids, options.rows)
  const facetIds = canonicalFacets.ids
  const facetStateAccepted = requestedFacets.accepted && canonicalFacets.accepted

  const page = await listPublicRankings({
    categorySlug,
    sort,
    cursor: first(query.cursor),
    facetIds,
  })
  const rankings = page.items
  const path = `/categories/${categorySlug}`
  const nextHref = page.nextCursor ? browseHref(path, sort, facetIds, page.nextCursor) : null

  return (
    <div className="relative min-h-screen pb-20 bg-[#07070a] font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[300px] bg-gradient-to-b from-indigo-950/10 via-transparent to-transparent rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 relative z-10 space-y-12">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link href="/" className="hover:text-white transition-colors">홈</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/categories" className="hover:text-white transition-colors">카테고리</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-indigo-400">{category.name}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
                  <Layers className="w-6 h-6" />
                </div>
                {category.name} 랭킹
              </h1>
              <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
                {category.description || `${category.name} 분야의 엄선된 비교 및 랭킹 정보 리스트입니다.`}
              </p>
            </div>
          </div>
        </div>

        {category.subcategories && category.subcategories.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">세부 분야 바로가기</h2>
            <div className="flex flex-wrap gap-2.5">
              {category.subcategories.map((sub: any) => (
                <Link
                  key={sub.id}
                  href={`/categories/${category.slug}/${sub.slug}`}
                  className="px-4 py-2 rounded-xl bg-white/[0.02] hover:bg-indigo-600/15 border border-white/5 hover:border-indigo-500/20 text-xs font-bold text-slate-300 hover:text-indigo-300 transition-all"
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <FacetFilterPanel
          action={path}
          groups={options.groups}
          selectedIds={facetIds}
          hiddenParams={{ sort }}
        />

        <div className="space-y-6 pt-6 border-t border-white/[0.04]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">등록된 랭킹 문서</h2>
              <span className="text-[10px] font-semibold text-slate-500">현재 페이지 {rankings.length}건</span>
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
              <Link
                href={browseHref(path, 'latest', facetIds)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${sort === 'latest' ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-500 hover:text-slate-300'}`}
              >
                최신순
              </Link>
              <Link
                href={browseHref(path, 'popular', facetIds)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${sort === 'popular' ? 'bg-amber-500/15 text-amber-300' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3" />인기순</span>
              </Link>
            </div>
          </div>

          {(!page.cursorAccepted || !facetStateAccepted) && (
            <p className="rounded-xl border border-amber-500/10 bg-amber-500/[0.04] px-3 py-2 text-[11px] text-amber-300">
              {!facetStateAccepted
                ? '존재하지 않거나 이 랭킹 탐색에 맞지 않는 Facet 필터를 제거했습니다.'
                : '유효하지 않은 페이지 위치를 초기화하고 첫 페이지를 표시했습니다.'}
            </p>
          )}

          {rankings.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rankings.map((ranking) => (
                  <div
                    key={ranking.id}
                    className="glass-card glass-card-hover rounded-2xl p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase">{category.name}</span>
                        {ranking.subcategories && (
                          <>
                            <span className="text-slate-800 text-xs">&bull;</span>
                            <span className="text-[10px] font-bold text-purple-400">{ranking.subcategories.name}</span>
                          </>
                        )}
                      </div>

                      <Link href={`/rankings/${ranking.slug}`}>
                        <h3 className="font-extrabold text-sm text-slate-100 hover:text-indigo-300 transition-colors line-clamp-1 leading-snug">
                          {ranking.title}
                        </h3>
                      </Link>
                      <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{ranking.summary}</p>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-white/[0.04] text-[10px] text-slate-500 font-semibold">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(ranking.published_at || ranking.sort_time).toLocaleDateString('ko-KR')}</span>
                        </div>
                        <Link href={`/rankings/${ranking.slug}`} className="text-indigo-400 hover:underline flex items-center gap-0.5">
                          보기 <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                      <div className="flex items-center gap-3 text-[9px] text-slate-600">
                        <span>고유 조회 {ranking.unique_view_count.toLocaleString()}</span>
                        <span>좋아요 {ranking.like_count.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {nextHref && (
                <div className="flex justify-center pt-2">
                  <Link
                    href={nextHref}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-xs font-bold text-slate-300 transition hover:border-indigo-500/25 hover:bg-indigo-500/10 hover:text-indigo-200"
                  >
                    다음 랭킹 보기
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="glass-card rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
              <div className="p-4 rounded-full bg-slate-900 border border-white/5">
                <Inbox className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="font-bold text-slate-300">조건에 맞는 발행 랭킹이 없습니다</h3>
              <p className="text-slate-500 text-xs max-w-sm leading-relaxed">
                선택한 Facet 조건을 줄이거나 다른 세부 분야를 확인해 보세요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
