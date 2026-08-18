import React from 'react'
import Link from 'next/link'
import { ArrowRight, Database, FileText, Inbox, Layers, Search, Sparkles } from 'lucide-react'
import FacetFilterPanel from '@/components/FacetFilterPanel'
import SearchForm from '@/components/SearchForm'
import { getPublicFacetOptions, searchPublicContent } from '@/lib/queries/search'
import {
  appendFacetParams,
  canonicalizeFacetIds,
  isSearchQueryLengthValid,
  normalizeSearchQuery,
  resolveFacetIds,
  resolveSearchKind,
  resolveSearchSort,
  SEARCH_QUERY_MAX_LENGTH,
  type FacetGroupOption,
  type SearchResult,
} from '@/lib/search/contracts'

export const revalidate = 0

type SearchParams = Promise<{
  q?: string | string[]
  type?: string | string[]
  sort?: string | string[]
  cursor?: string | string[]
  facet?: string | string[]
}>

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function matchLabel(reason: string) {
  const labels: Record<string, string> = {
    title_exact: '제목 정확히 일치',
    title_prefix: '제목 앞부분 일치',
    title: '제목 일치',
    category: '카테고리 일치',
    subcategory: '세부 카테고리 일치',
    facet: '태그 일치',
    summary: '요약 일치',
    body: '본문 일치',
    brand: '브랜드·제작자 일치',
    item_type: '아이템 유형 일치',
    description: '설명 일치',
    fuzzy: '유사 표현 일치',
  }
  return labels[reason] || '검색어 관련 결과'
}

function resultHref(result: SearchResult) {
  return result.content_kind === 'ranking' ? `/rankings/${result.slug}` : `/items/${result.slug}`
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const rawQuery = first(params.q) || ''
  const query = normalizeSearchQuery(rawQuery)
  const kind = resolveSearchKind(first(params.type))
  const sort = resolveSearchSort(first(params.sort))
  const cursor = first(params.cursor)
  const requestedFacets = resolveFacetIds(params.facet)
  const hasQuery = query.length > 0
  const validQuery = isSearchQueryLengthValid(query)

  let items: SearchResult[] = []
  let facetGroups: FacetGroupOption[] = []
  let facetIds: string[] = []
  let facetStateAccepted = requestedFacets.accepted
  let nextCursor: string | null = null
  let cursorAccepted = true
  let loadError = false

  if (validQuery) {
    try {
      const options = await getPublicFacetOptions({ kind })
      facetGroups = options.groups
      const canonicalFacets = canonicalizeFacetIds(requestedFacets.ids, options.rows)
      facetIds = canonicalFacets.ids
      facetStateAccepted = facetStateAccepted && canonicalFacets.accepted

      const result = facetIds.length > 0
        ? await searchPublicContent({ query, kind, sort, cursor, facetIds })
        : await searchPublicContent({ query, kind, sort, cursor })
      items = result.items
      nextCursor = result.nextCursor
      cursorAccepted = result.cursorAccepted
    } catch {
      loadError = true
    }
  }

  const nextHref = (() => {
    if (!nextCursor) return null
    const next = new URLSearchParams({ q: query, type: kind, sort, cursor: nextCursor })
    appendFacetParams(next, facetIds)
    return `/search?${next.toString()}`
  })()

  return (
    <div className="rw-page pb-20">
      <header className="border-b border-[#e3e7ec] bg-white">
        <div className="rw-container py-10 sm:py-12">
          <p className="rw-kicker flex items-center gap-2"><Search className="h-4 w-4" /> Search</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#171a1f] sm:text-4xl">통합 검색</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b7280]">공개 랭킹과 아이템을 제목, 브랜드, 카테고리, Facet 기준으로 찾습니다.</p>
          <SearchForm
            defaultQuery={rawQuery}
            defaultKind={kind}
            defaultSort={sort}
            facetIds={facetIds}
            showFilters
            historySync
            className="mt-6 max-w-4xl rounded-2xl border border-[#dde2e8] bg-[#f8f9fb] p-4"
          />
        </div>
      </header>

      <div className="rw-container pt-8">
        {!hasQuery && (
          <section className="rw-surface rw-card px-6 py-16 text-center">
            <Sparkles className="mx-auto h-7 w-7 text-[#3457c8]" />
            <h2 className="mt-4 text-base font-extrabold text-[#20242a]">검색어를 입력해 주세요</h2>
            <p className="mt-2 text-xs leading-6 text-[#8a94a3]">2자 이상의 제목, 아이템명, 브랜드, 카테고리 또는 태그로 검색할 수 있습니다.</p>
          </section>
        )}

        {hasQuery && !validQuery && (
          <section className="rounded-2xl border border-[#ead9a7] bg-[#fffbeb] px-6 py-10 text-center">
            <h2 className="text-sm font-extrabold text-[#8a5a08]">검색어 길이를 확인해 주세요</h2>
            <p className="mt-2 text-xs text-[#7a6c4e]">정규화된 검색어는 2자 이상 {SEARCH_QUERY_MAX_LENGTH}자 이하여야 합니다.</p>
          </section>
        )}

        {validQuery && loadError && (
          <section className="rounded-2xl border border-[#efc2ca] bg-[#fff1f2] px-6 py-10 text-center">
            <h2 className="text-sm font-extrabold text-[#a93449]">검색 결과를 불러오지 못했습니다</h2>
            <p className="mt-2 text-xs text-[#7e6168]">검색 조건을 유지한 채 다시 시도해 주세요.</p>
          </section>
        )}

        {validQuery && !loadError && (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
            <FacetFilterPanel action="/search" groups={facetGroups} selectedIds={facetIds} hiddenParams={{ q: query, type: kind, sort }} />

            <section className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#dde2e8] pb-4">
                <div>
                  <p className="text-xs font-semibold text-[#8a94a3]">검색 결과</p>
                  <h2 className="mt-1 text-xl font-black tracking-[-0.025em] text-[#171a1f]">“{query}”</h2>
                </div>
                <div className="text-right text-[11px] font-semibold text-[#8a94a3]">
                  <span>현재 페이지 {items.length}건</span>
                  {!cursorAccepted && <span className="ml-2 text-[#a16207]">페이지 위치를 초기화했습니다.</span>}
                </div>
              </div>

              {!facetStateAccepted && (
                <p className="mt-4 rounded-xl border border-[#ead9a7] bg-[#fffbeb] px-3 py-2 text-[11px] text-[#8a5a08]">현재 검색 대상에 맞지 않는 Facet 필터를 제거했습니다.</p>
              )}

              {items.length > 0 ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-[#dde2e8] bg-white">
                  {items.map((result, index) => (
                    <Link
                      key={`${result.content_kind}:${result.id}`}
                      href={resultHref(result)}
                      className={`group grid gap-4 p-5 transition hover:bg-[#f8f9fb] sm:grid-cols-[44px_1fr_auto] sm:items-start ${index > 0 ? 'border-t border-[#edf0f3]' : ''}`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${result.content_kind === 'ranking' ? 'bg-[#eef2ff] text-[#3457c8]' : 'bg-[#eef8f4] text-[#087a54]'}`}>
                        {result.content_kind === 'ranking' ? <FileText className="h-4.5 w-4.5" /> : <Database className="h-4.5 w-4.5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#8a94a3]">
                          <span className={result.content_kind === 'ranking' ? 'text-[#3457c8]' : 'text-[#087a54]'}>{result.content_kind === 'ranking' ? '랭킹' : '아이템'}</span>
                          {result.category_name && <span>{result.category_name}</span>}
                          {result.subcategory_name && <span>· {result.subcategory_name}</span>}
                          {result.brand_or_creator && <span>· {result.brand_or_creator}</span>}
                        </div>
                        <h3 className="mt-1.5 truncate text-base font-extrabold text-[#20242a] transition group-hover:text-[#2445ad]">{result.title}</h3>
                        {result.description && <p className="mt-1.5 line-clamp-2 text-xs leading-6 text-[#6b7280]">{result.description}</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-[#8a94a3]">
                          <span className="rounded-md bg-[#f0f2f5] px-2 py-1 text-[#5f6875]">{matchLabel(result.match_reason)}</span>
                          <span>조회 {result.unique_view_count.toLocaleString('ko-KR')}</span>
                          <span>좋아요 {result.like_count.toLocaleString('ko-KR')}</span>
                        </div>
                      </div>
                      <ArrowRight className="hidden h-4 w-4 text-[#b1b8c2] transition group-hover:translate-x-0.5 group-hover:text-[#3457c8] sm:block" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rw-surface rw-card px-6 py-14 text-center">
                  <Inbox className="mx-auto h-7 w-7 text-[#a4acb7]" />
                  <h3 className="mt-4 text-sm font-extrabold text-[#3f4752]">검색 결과가 없습니다</h3>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-[#8a94a3]">검색어나 Facet 조건을 줄이거나 카테고리에서 직접 탐색해 보세요.</p>
                  <Link href="/categories" className="rw-button-secondary mt-5 px-4 text-xs"><Layers className="h-4 w-4" />카테고리 탐색</Link>
                </div>
              )}

              {nextHref && (
                <div className="flex justify-center pt-6">
                  <Link href={nextHref} className="rw-button-secondary px-5 text-xs">다음 결과 보기</Link>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
