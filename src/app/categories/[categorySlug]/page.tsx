import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import FacetFilterPanel from '@/components/FacetFilterPanel'
import { getCategoryBySlug } from '@/lib/queries/public'
import { getPublicFacetOptions, listPublicRankings } from '@/lib/queries/search'
import { appendFacetParams, canonicalizeFacetIds, resolveFacetIds, resolveRankingBrowseSort } from '@/lib/search/contracts'
import { CalendarDays, ChevronRight, Flame, Inbox } from 'lucide-react'

export const revalidate = 0

interface Props {
  params: Promise<{ categorySlug: string }>
  searchParams: Promise<{ sort?: string | string[]; cursor?: string | string[]; facet?: string | string[] }>
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
  if (!category) notFound()

  const sort = resolveRankingBrowseSort(first(query.sort))
  const requestedFacets = resolveFacetIds(query.facet)
  const options = await getPublicFacetOptions({ kind: 'ranking', categorySlug })
  const canonicalFacets = canonicalizeFacetIds(requestedFacets.ids, options.rows)
  const facetIds = canonicalFacets.ids
  const facetStateAccepted = requestedFacets.accepted && canonicalFacets.accepted
  const page = await listPublicRankings({ categorySlug, sort, cursor: first(query.cursor), facetIds })
  const rankings = page.items
  const path = `/categories/${categorySlug}`
  const nextHref = page.nextCursor ? browseHref(path, sort, facetIds, page.nextCursor) : null

  return (
    <div className="rw-page pb-20">
      <header className="border-b border-[#e3e7ec] bg-white">
        <div className="rw-container py-9 sm:py-11">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#8a94a3]">
            <Link href="/" className="hover:text-[#2445ad]">홈</Link><ChevronRight className="h-3.5 w-3.5" />
            <Link href="/categories" className="hover:text-[#2445ad]">카테고리</Link><ChevronRight className="h-3.5 w-3.5" />
            <span className="text-[#3457c8]">{category.name}</span>
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#171a1f] sm:text-4xl">{category.name} 랭킹</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#6b7280]">{category.description || `${category.name} 분야의 공개 랭킹을 비교하고 탐색합니다.`}</p>
          {category.subcategories && category.subcategories.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {category.subcategories.map((sub: any) => (
                <Link key={sub.id} href={`/categories/${category.slug}/${sub.slug}`} className="rounded-lg border border-[#dfe4ea] bg-[#fafbfc] px-3 py-1.5 text-xs font-bold text-[#5f6875] hover:border-[#b9c5dc] hover:bg-[#eef2ff] hover:text-[#2445ad]">{sub.name}</Link>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="rw-container grid gap-6 pt-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <FacetFilterPanel action={path} groups={options.groups} selectedIds={facetIds} hiddenParams={{ sort }} />

        <section className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dde2e8] pb-4">
            <div>
              <h2 className="text-lg font-black text-[#20242a]">공개 랭킹</h2>
              <p className="mt-1 text-[11px] font-semibold text-[#8a94a3]">현재 페이지 {rankings.length}건</p>
            </div>
            <div className="inline-flex rounded-xl border border-[#dde2e8] bg-white p-1">
              <Link href={browseHref(path, 'latest', facetIds)} className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold ${sort === 'latest' ? 'bg-[#eef2ff] text-[#2445ad]' : 'text-[#7b8491] hover:bg-[#f4f6f8]'}`}>최신순</Link>
              <Link href={browseHref(path, 'popular', facetIds)} className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold ${sort === 'popular' ? 'bg-[#fff7e6] text-[#9a6206]' : 'text-[#7b8491] hover:bg-[#f4f6f8]'}`}><span className="inline-flex items-center gap-1"><Flame className="h-3 w-3" />인기순</span></Link>
            </div>
          </div>

          {(!page.cursorAccepted || !facetStateAccepted) && (
            <p className="mt-4 rounded-xl border border-[#ead9a7] bg-[#fffbeb] px-3 py-2 text-[11px] text-[#8a5a08]">{!facetStateAccepted ? '현재 탐색에 맞지 않는 Facet 필터를 제거했습니다.' : '유효하지 않은 페이지 위치를 초기화했습니다.'}</p>
          )}

          {rankings.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#dde2e8] bg-white">
              {rankings.map((ranking, index) => (
                <Link key={ranking.id} href={`/rankings/${ranking.slug}`} className={`group grid gap-3 px-5 py-5 transition hover:bg-[#f8f9fb] sm:grid-cols-[1fr_auto] sm:items-center sm:px-6 ${index > 0 ? 'border-t border-[#edf0f3]' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#8a94a3]"><span className="text-[#3457c8]">{category.name}</span>{ranking.subcategories && <><span>·</span><span>{ranking.subcategories.name}</span></>}</div>
                    <h3 className="mt-1.5 truncate text-base font-extrabold text-[#20242a] transition group-hover:text-[#2445ad]">{ranking.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-6 text-[#6b7280]">{ranking.summary}</p>
                    <div className="mt-2 flex gap-3 text-[10px] font-semibold text-[#929ba6]"><span>조회 {ranking.unique_view_count.toLocaleString('ko-KR')}</span><span>좋아요 {ranking.like_count.toLocaleString('ko-KR')}</span></div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-[#8a94a3]"><CalendarDays className="h-3.5 w-3.5" />{new Date(ranking.published_at || ranking.sort_time).toLocaleDateString('ko-KR')}<ChevronRight className="h-4 w-4 text-[#b1b8c2] transition group-hover:translate-x-0.5 group-hover:text-[#3457c8]" /></div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-4 rw-surface rw-card flex flex-col items-center justify-center px-6 py-14 text-center"><Inbox className="h-7 w-7 text-[#a4acb7]" /><h3 className="mt-4 text-sm font-extrabold text-[#3f4752]">조건에 맞는 랭킹이 없습니다</h3><p className="mt-2 text-xs text-[#8a94a3]">Facet 조건을 줄이거나 다른 세부 분야를 확인해 보세요.</p></div>
          )}

          {nextHref && <div className="flex justify-center pt-6"><Link href={nextHref} className="rw-button-secondary px-5 text-xs">다음 랭킹 보기</Link></div>}
        </section>
      </div>
    </div>
  )
}
