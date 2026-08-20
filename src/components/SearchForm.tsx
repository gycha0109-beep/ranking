'use client'

import React, { useEffect, useRef } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import type { SearchKind, SearchSort } from '@/lib/search/contracts'

interface Props {
  defaultQuery?: string
  defaultKind?: SearchKind
  defaultSort?: SearchSort
  facetIds?: string[]
  compact?: boolean
  hero?: boolean
  showFilters?: boolean
  historySync?: boolean
  className?: string
}

const SEARCH_KINDS = new Set(['all', 'ranking', 'item'])
const SEARCH_SORTS = new Set(['relevance', 'latest', 'popular'])

export default function SearchForm({
  defaultQuery = '',
  defaultKind = 'all',
  defaultSort = 'relevance',
  facetIds = [],
  compact = false,
  hero = false,
  showFilters = false,
  historySync = false,
  className = '',
}: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const formKey = JSON.stringify([defaultQuery, defaultKind, defaultSort, facetIds])

  useEffect(() => {
    if (!historySync) return

    const restoreCanonicalControls = () => {
      const form = formRef.current
      if (!form) return

      form.reset()

      const params = new URLSearchParams(window.location.search)
      const queryControl = form.elements.namedItem('q')
      const kindControl = form.elements.namedItem('type')
      const sortControl = form.elements.namedItem('sort')

      if (queryControl instanceof HTMLInputElement) {
        queryControl.value = params.get('q') ?? ''
      }

      if (kindControl instanceof HTMLSelectElement) {
        const requestedKind = params.get('type') ?? 'all'
        kindControl.value = SEARCH_KINDS.has(requestedKind) ? requestedKind : 'all'
      }

      if (sortControl instanceof HTMLSelectElement) {
        const requestedSort = params.get('sort') ?? 'relevance'
        sortControl.value = SEARCH_SORTS.has(requestedSort) ? requestedSort : 'relevance'
      }
    }

    restoreCanonicalControls()
    window.addEventListener('pageshow', restoreCanonicalControls)
    window.addEventListener('popstate', restoreCanonicalControls)

    return () => {
      window.removeEventListener('pageshow', restoreCanonicalControls)
      window.removeEventListener('popstate', restoreCanonicalControls)
    }
  }, [formKey, historySync])

  if (hero) {
    return (
      <form ref={formRef} key={formKey} action="/search" method="get" role="search" className={className}>
        {facetIds.map((id) => (
          <input key={id} type="hidden" name="facet" value={id} />
        ))}
        <div className="flex items-center border border-[#c9cbc7] bg-white p-1.5 shadow-[0_8px_22px_rgba(28,33,40,0.05)] focus-within:border-[#3158e8] focus-within:ring-4 focus-within:ring-[#3158e8]/10">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#69717c]" />
            <input
              type="search"
              name="q"
              defaultValue={defaultQuery}
              minLength={2}
              maxLength={120}
              autoComplete="off"
              placeholder="랭킹, 아이템, 브랜드를 검색하세요"
              aria-label="랭킹위키 검색"
              className="w-full border-0 bg-transparent py-3 pl-10 pr-3 text-sm font-semibold text-[#171a1f] placeholder:font-medium placeholder:text-[#8a919a] focus:outline-none"
            />
          </div>
          <button type="submit" className="inline-flex h-11 shrink-0 items-center gap-2 bg-[#15191f] px-4 text-xs font-extrabold text-white transition hover:bg-[#3158e8] sm:px-5">
            검색 <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    )
  }

  return (
    <form ref={formRef} key={formKey} action="/search" method="get" role="search" className={className}>
      {facetIds.map((id) => (
        <input key={id} type="hidden" name="facet" value={id} />
      ))}
      <div className={compact ? 'flex items-center gap-2' : 'space-y-3'}>
        <div className="relative flex-1">
          <Search className={`pointer-events-none absolute left-3.5 ${compact ? 'top-2.5' : 'top-3.5'} h-4 w-4 text-[#69717c]`} />
          <input
            type="search"
            name="q"
            defaultValue={defaultQuery}
            minLength={2}
            maxLength={120}
            autoComplete="off"
            placeholder="랭킹, 아이템, 브랜드 검색"
            aria-label="랭킹위키 검색"
            className={`w-full border border-[#cfd2d6] bg-white pl-10 pr-4 text-sm text-[#171a1f] placeholder:text-[#7a828d] transition focus:border-[#3158e8] focus:outline-none focus:ring-4 focus:ring-[#3158e8]/10 ${compact ? 'rounded-lg py-2' : 'rounded-xl py-3.5'}`}
          />
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <select
              name="type"
              defaultValue={defaultKind}
              aria-label="검색 대상"
              className="rounded-lg border border-[#cfd2d6] bg-white px-3 py-2.5 text-xs font-semibold text-[#3f4752] focus:border-[#3158e8] focus:outline-none"
            >
              <option value="all">전체</option>
              <option value="ranking">랭킹 문서</option>
              <option value="item">아이템</option>
            </select>
            <select
              name="sort"
              defaultValue={defaultSort}
              aria-label="검색 정렬"
              className="rounded-lg border border-[#cfd2d6] bg-white px-3 py-2.5 text-xs font-semibold text-[#3f4752] focus:border-[#3158e8] focus:outline-none"
            >
              <option value="relevance">관련도순</option>
              <option value="latest">최신순</option>
              <option value="popular">인기순</option>
            </select>
            <button type="submit" className="rw-button-primary col-span-2 px-5 text-xs sm:col-span-1">
              검색
            </button>
          </div>
        )}

        {!showFilters && (
          <button type="submit" className={`${compact ? 'hidden lg:inline-flex' : 'mt-3 inline-flex'} rw-button-primary px-5 text-xs`}>
            검색
          </button>
        )}
      </div>
    </form>
  )
}
