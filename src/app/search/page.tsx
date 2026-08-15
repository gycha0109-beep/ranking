import React from 'react'
import Link from 'next/link'
import { ArrowRight, Database, FileText, Inbox, Layers, Search, Sparkles } from 'lucide-react'
import SearchForm from '@/components/SearchForm'
import { searchPublicContent } from '@/lib/queries/search'
import {
  isSearchQueryLengthValid,
  normalizeSearchQuery,
  resolveSearchKind,
  resolveSearchSort,
  SEARCH_QUERY_MAX_LENGTH,
  type SearchResult,
} from '@/lib/search/contracts'

export const revalidate = 0

type SearchParams = Promise<{
  q?: string | string[]
  type?: string | string[]
  sort?: string | string[]
  cursor?: string | string[]
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
  return result.content_kind === 'ranking'
    ? `/rankings/${result.slug}`
    : `/items/${result.slug}`
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const rawQuery = first(params.q) || ''
  const query = normalizeSearchQuery(rawQuery)
  const kind = resolveSearchKind(first(params.type))
  const sort = resolveSearchSort(first(params.sort))
  const cursor = first(params.cursor)
  const hasQuery = query.length > 0
  const validQuery = isSearchQueryLengthValid(query)

  let items: SearchResult[] = []
  let nextCursor: string | null = null
  let cursorAccepted = true
  let loadError = false

  if (validQuery) {
    try {
      const result = await searchPublicContent({ query, kind, sort, cursor })
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
    return `/search?${next.toString()}`
  })()

  return (
    <main className="min-h-screen bg-[#07070a] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-400">
            <Search className="h-4 w-4" />
            Public Archive Search
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">랭킹위키 통합 검색</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              공개된 랭킹 문서와 아이템을 제목, 설명, 브랜드, 카테고리와 태그 기준으로 탐색합니다.
            </p>
          </div>
          <SearchForm
            defaultQuery={rawQuery}
            defaultKind={kind}
            defaultSort={sort}
            showFilters
            className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4"
          />
        </header>

        {!hasQuery && (
          <section className="rounded-3xl border border-dashed border-white/10 bg-white/[0.01] px-6 py-14 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-indigo-400" />
            <h2 className="mt-4 text-base font-bold text-slate-200">검색어를 입력해 주세요</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              2자 이상의 제목, 아이템명, 브랜드, 카테고리 또는 태그로 검색할 수 있습니다.
            </p>
          </section>
        )}

        {hasQuery && !validQuery && (
          <section className="rounded-3xl border border-amber-500/15 bg-amber-500/[0.04] px-6 py-10 text-center">
            <h2 className="text-sm font-bold text-amber-200">검색어 길이를 확인해 주세요</h2>
            <p className="mt-2 text-xs text-slate-400">
              정규화된 검색어는 2자 이상 {SEARCH_QUERY_MAX_LENGTH}자 이하여야 합니다.
            </p>
          </section>
        )}

        {validQuery && loadError && (
          <section className="rounded-3xl border border-rose-500/15 bg-rose-500/[0.04] px-6 py-10 text-center">
            <h2 className="text-sm font-bold text-rose-200">검색 결과를 불러오지 못했습니다</h2>
            <p className="mt-2 text-xs text-slate-400">검색 조건을 유지한 채 다시 시도해 주세요.</p>
          </section>
        )}

        {validQuery && !loadError && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">검색어</p>
                <h2 className="mt-1 text-lg font-black text-white">“{query}”</h2>
              </div>
              <div className="text-right text-[11px] font-semibold text-slate-500">
                <span>현재 페이지 {items.length}건</span>
                {!cursorAccepted && <span className="ml-2 text-amber-400">유효하지 않은 페이지 위치를 초기화했습니다.</span>}
              </div>
            </div>

            {items.length > 0 ? (
              <div className="grid gap-4">
                {items.map((result) => (
                  <Link
                    key={`${result.content_kind}:${result.id}`}
                    href={resultHref(result)}
                    className="group rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 transition hover:border-indigo-500/25 hover:bg-white/[0.03]"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5 rounded-xl border border-white/[0.06] bg-slate-950/60 p-2.5 text-indigo-300">
                        {result.content_kind === 'ranking'
                          ? <FileText className="h-5 w-5" />
                          : <Database className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                          <span className={result.content_kind === 'ranking' ? 'text-indigo-400' : 'text-emerald-400'}>
                            {result.content_kind === 'ranking' ? '랭킹 문서' : '아이템'}
                          </span>
                          {result.category_name && <span className="text-slate-600">{result.category_name}</span>}
                          {result.subcategory_name && <span className="text-slate-600">/ {result.subcategory_name}</span>}
                          {result.brand_or_creator && <span className="text-slate-600">{result.brand_or_creator}</span>}
                        </div>
                        <h3 className="mt-2 truncate text-base font-extrabold text-slate-100 transition group-hover:text-indigo-300">
                          {result.title}
                        </h3>
                        {result.description && (
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">{result.description}</p>
                        )}
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-500">
                          <span className="rounded-lg border border-indigo-500/15 bg-indigo-500/[0.06] px-2 py-1 text-indigo-300">
                            {matchLabel(result.match_reason)}
                          </span>
                          <span>고유 조회 {result.unique_view_count.toLocaleString()}</span>
                          <span>좋아요 {result.like_count.toLocaleString()}</span>
                        </div>
                      </div>
                      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-indigo-400" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.01] px-6 py-14 text-center">
                <Inbox className="mx-auto h-8 w-8 text-slate-600" />
                <h3 className="mt-4 text-sm font-bold text-slate-300">검색 결과가 없습니다</h3>
                <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500">
                  더 일반적인 표현이나 짧은 키워드로 바꿔보거나 카테고리 디렉터리에서 직접 탐색해 보세요.
                </p>
                <Link
                  href="/categories"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold text-slate-300 transition hover:border-indigo-500/25 hover:text-indigo-200"
                >
                  <Layers className="h-4 w-4" />카테고리 탐색
                </Link>
              </div>
            )}

            {nextHref && (
              <div className="flex justify-center pt-2">
                <Link
                  href={nextHref}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-xs font-bold text-slate-300 transition hover:border-indigo-500/25 hover:bg-indigo-500/10 hover:text-indigo-200"
                >
                  다음 결과 보기
                </Link>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
