import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import FacetFilterPanel from '@/components/FacetFilterPanel'
import RankingBrowseCollectionCard from '@/components/RankingBrowseCollectionCard'
import { getCategoryBySlug } from '@/lib/queries/public'
import { getPublicFacetOptions, listPublicRankings } from '@/lib/queries/search'
import { appendFacetParams, canonicalizeFacetIds, resolveFacetIds, resolveRankingBrowseSort } from '@/lib/search/contracts'
import { ChevronRight, Flame, Inbox } from 'lucide-react'

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
    <div className="rw-page bg-white pb-20">
      <header className="border-b border-[#e3e7ec] bg-white">
        <div className="rw-container py-8 sm:py-11 lg:py-12">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#8a94a3]">
            <Link href="/" className="hover:text-[#2445ad]">홈</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <Link href="/categories" className="hover:text-[#2445ad]">카테고리</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-[#3457c8]">{category.name}</span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <p className="rw-kicker">Ranking collection</p>
              <h1 className="rw-display mt-2 text-[2.7rem] font-black leading-[1.02] tracking-[-0.055em] text-[#111318] sm:text-[4rem]">{category.name} 랭킹</h1>
            </div>
            <p className="max-w-md text-sm font-medium leading-7 text-[#626b77] lg:pb-1">{category.description || `${category.name} 분야의 공개 랭킹을 비교하고 탐색합니다.`}</p>
          </div>

          {category.subcategories && category.subcategories.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {category.subcategories.map((sub: any) => (
                <Link key={sub.id} href={`/categories/${category.slug}/${sub.slug}`} className="rounded-full border border-[#dfe4ea] bg-[#fafbfc] px-3 py-1.5 text-xs font-bold text-[#5f6875] transition hover:border-[#aebfe9] hover:bg-[#eff4ff] hover:text-[#1d4ed8]">{sub.name}</Link>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="rw-container grid gap-6 pt-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <FacetFilterPanel action={path} groups={options.groups} selectedIds={facetIds} hiddenParams={{ sort }} />

        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#dde2e8] pb-4">
            <div>
              <p className="rw-kicker">Browse rankings</p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.025em] text-[#20242a]">공개 랭킹</h2>
              <p className="mt-1 text-[11px] font-semibold text-[#8a94a3]">현재 페이지 {rankings.length}건</p>
            </div>
            <div className="inline-flex rounded-full border border-[#dde2e8] bg-white p-1">
              <Link href={browseHref(path, 'latest', facetIds)} className={`rounded-full px-3.5 py-1.5 text-[11px] font-extrabold transition ${sort === 'latest' ? 'bg-[#1f2937] text-white' : 'text-[#7b8491] hover:bg-[#f4f6f8]'}`}>최신순</Link>
              <Link href={browseHref(path, 'popular', facetIds)} className={`rounded-full px-3.5 py-1.5 text-[11px] font-extrabold transition ${sort === 'popular' ? 'bg-[#eff4ff] text-[#1d4ed8]' : 'text-[#7b8491] hover:bg-[#f4f6f8]'}`}><span className="inline-flex items-center gap-1"><Flame className="h-3 w-3" aria-hidden="true" />인기순</span></Link>
            </div>
          </div>

          {(!page.cursorAccepted || !facetStateAccepted) && (
            <p className="mt-4 rounded-xl border border-[#ead9a7] bg-[#fffbeb] px-3 py-2 text-[11px] text-[#8a5a08]">{!facetStateAccepted ? '현재 탐색에 맞지 않는 Facet 필터를 제거했습니다.' : '유효하지 않은 페이지 위치를 초기화했습니다.'}</p>
          )}

          {rankings.length > 0 ? (
            <div className="mt-5 grid gap-4">
              {rankings.map((ranking) => (
                <RankingBrowseCollectionCard key={ranking.id} ranking={ranking} categoryName={category.name} />
              ))}
            </div>
          ) : (
            <div className="mt-5 rw-surface rw-card flex flex-col items-center justify-center px-6 py-14 text-center">
              <Inbox className="h-7 w-7 text-[#a4acb7]" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-extrabold text-[#3f4752]">조건에 맞는 랭킹이 없습니다</h3>
              <p className="mt-2 text-xs text-[#8a94a3]">Facet 조건을 줄이거나 다른 세부 분야를 확인해 보세요.</p>
            </div>
          )}

          {nextHref && <div className="flex justify-center pt-6"><Link href={nextHref} className="rw-button-secondary px-5 text-xs">다음 랭킹 보기</Link></div>}
        </section>
      </div>
    </div>
  )
}
