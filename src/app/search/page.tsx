import React from 'react'
import Link from 'next/link'
import { ArrowRight, Database, Eye, FileText, Heart, Inbox, Layers, Search, Sparkles } from 'lucide-react'
import FacetFilterPanel from '@/components/FacetFilterPanel'
import SafeImage from '@/components/SafeImage'
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

function SearchResultVisual({ result }: { result: SearchResult }) {
  if (result.image_url) {
    return (
      <SafeImage
        src={result.image_url}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
        fallbackSrc="/item-placeholder.svg"
      />
    )
  }

  const initials = result.title.trim().slice(0, 2) || 'RW'
  return (
    <div className={`absolute inset-0 ${result.content_kind === 'ranking'
      ? 'bg-[radial-gradient(circle_at_76%_18%,rgba(73,111,235,0.92),transparent_34%),linear-gradient(135deg,#111827_0%,#25324a_58%,#1d4ed8_100%)]'
      : 'bg-[radial-gradient(circle_at_76%_18%,rgba(34,197,139,0.64),transparent_34%),linear-gradient(135deg,#111827_0%,#1f3a38_58%,#087a54_100%)]'
    }`}>
      <span className="absolute bottom-3 right-4 text-[4.4rem] font-black leading-none tracking-[-0.08em] text-white/10">{initials}</span>
    </div>
  )
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

  const rankingCount = items.filter((item) => item.content_kind === 'ranking').length
  const itemCount = items.length - rankingCount

  return (
    <div className="rw-page bg-white pb-20">
      <header className="border-b border-[#e3e7ec] bg-white">
        <div className="rw-container py-10 sm:py-14 lg:py-16">
          <h1 className="rw-kicker flex items-center gap-2"><Search className="h-4 w-4" aria-hidden="true" /> 통합 검색</h1>
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_350px] lg:items-end">
            <p className="rw-display max-w-3xl text-[2.7rem] font-black leading-[1.02] tracking-[-0.055em] text-[#111318] sm:text-[4rem] lg:text-[4.7rem]">
              궁금한 순위와 항목을<br />바로 찾아보세요.
            </p>
            <p className="max-w-md text-sm font-medium leading-7 text-[#626b77] lg:pb-2">
              공개 랭킹과 아이템을 제목, 브랜드, 카테고리, Facet 기준으로 찾고 결과에서 곧바로 관련 문서로 이동합니다.
            </p>
          </div>

          <SearchForm
            defaultQuery={rawQuery}
            defaultKind={kind}
            defaultSort={sort}
            facetIds={facetIds}
            showFilters
            historySync
            className="mt-7 max-w-5xl rounded-[18px] border border-[#d9dee6] bg-[#f7f9fc] p-4 shadow-[0_14px_34px_rgba(17,24,39,0.05)] sm:p-5"
          />
        </div>
      </header>

      <div className="rw-container pt-8 sm:pt-10">
        {!hasQuery && (
          <section className="overflow-hidden rounded-[18px] border border-[#dfe3e8] bg-[#111827] px-6 py-14 text-center text-white sm:py-16">
            <Sparkles className="mx-auto h-7 w-7 text-[#8eb0ff]" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-black tracking-[-0.025em]">검색어를 입력해 주세요</h2>
            <p className="mx-auto mt-2 max-w-xl text-xs font-medium leading-6 text-white/62">2자 이상의 제목, 아이템명, 브랜드, 카테고리 또는 태그로 검색할 수 있습니다.</p>
            <Link href="/categories" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-[#172033] transition hover:bg-[#eef3ff]">
              <Layers className="h-4 w-4" aria-hidden="true" />카테고리부터 둘러보기
            </Link>
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
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#dde2e8] pb-4">
                <div>
                  <p className="rw-kicker">Search results</p>
                  <h2 className="mt-1 text-[1.7rem] font-black tracking-[-0.04em] text-[#171a1f]">“{query}”</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black">
                  <span className="rounded-full bg-[#f1f3f6] px-2.5 py-1.5 text-[#68717d]">현재 페이지 {items.length}건</span>
                  {rankingCount > 0 && <span className="rounded-full bg-[#eef3ff] px-2.5 py-1.5 text-[#1d4ed8]">랭킹 {rankingCount}</span>}
                  {itemCount > 0 && <span className="rounded-full bg-[#edf8f3] px-2.5 py-1.5 text-[#087a54]">아이템 {itemCount}</span>}
                  {!cursorAccepted && <span className="text-[#a16207]">페이지 위치를 초기화했습니다.</span>}
                </div>
              </div>

              {!facetStateAccepted && (
                <p className="mt-4 rounded-xl border border-[#ead9a7] bg-[#fffbeb] px-3 py-2 text-[11px] text-[#8a5a08]">현재 검색 대상에 맞지 않는 Facet 필터를 제거했습니다.</p>
              )}

              {items.length > 0 ? (
                <div className="mt-5 grid gap-4">
                  {items.map((result) => (
                    <Link
                      key={`${result.content_kind}:${result.id}`}
                      href={resultHref(result)}
                      className="group grid overflow-hidden rounded-[16px] border border-[#dfe3e8] bg-white transition hover:-translate-y-0.5 hover:border-[#bcc9e4] hover:shadow-[0_16px_38px_rgba(17,24,39,0.08)] sm:grid-cols-[180px_minmax(0,1fr)]"
                    >
                      <div className="relative min-h-[164px] overflow-hidden bg-[#151a22] sm:min-h-full">
                        <SearchResultVisual result={result} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/48 via-transparent to-transparent" />
                        <span className={`absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black ${result.content_kind === 'ranking' ? 'bg-white/94 text-[#1d4ed8]' : 'bg-white/94 text-[#087a54]'}`}>
                          {result.content_kind === 'ranking' ? <FileText className="h-3 w-3" aria-hidden="true" /> : <Database className="h-3 w-3" aria-hidden="true" />}
                          {result.content_kind === 'ranking' ? 'RANKING' : 'ITEM'}
                        </span>
                      </div>

                      <div className="flex min-w-0 flex-col p-5 sm:p-6">
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#8a94a3]">
                          {result.category_name && <span className={result.content_kind === 'ranking' ? 'text-[#2563eb]' : 'text-[#087a54]'}>{result.category_name}</span>}
                          {result.subcategory_name && <><span>·</span><span>{result.subcategory_name}</span></>}
                          {result.brand_or_creator && <><span>·</span><span>{result.brand_or_creator}</span></>}
                        </div>

                        <h3 className="mt-2 text-lg font-black leading-6 tracking-[-0.03em] text-[#1c2026] transition group-hover:text-[#1d4ed8] sm:text-xl">{result.title}</h3>
                        {result.description && <p className="mt-2 line-clamp-2 text-xs font-medium leading-6 text-[#69717c]">{result.description}</p>}

                        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#8a94a3]">
                            <span className="rounded-full bg-[#f1f3f6] px-2.5 py-1 text-[#59616c]">{matchLabel(result.match_reason)}</span>
                            <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden="true" />조회 {result.unique_view_count.toLocaleString('ko-KR')}</span>
                            <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" aria-hidden="true" />좋아요 {result.like_count.toLocaleString('ko-KR')}</span>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-[#a9b1bc] transition group-hover:translate-x-0.5 group-hover:text-[#2563eb]" aria-hidden="true" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rw-surface rw-card px-6 py-14 text-center">
                  <Inbox className="mx-auto h-7 w-7 text-[#a4acb7]" aria-hidden="true" />
                  <h3 className="mt-4 text-sm font-extrabold text-[#3f4752]">검색 결과가 없습니다</h3>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-[#8a94a3]">검색어나 Facet 조건을 줄이거나 카테고리에서 직접 탐색해 보세요.</p>
                  <Link href="/categories" className="rw-button-secondary mt-5 px-4 text-xs"><Layers className="h-4 w-4" aria-hidden="true" />카테고리 탐색</Link>
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
