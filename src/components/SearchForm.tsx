import React from 'react'
import { Search } from 'lucide-react'
import type { SearchKind, SearchSort } from '@/lib/search/contracts'

interface Props {
  defaultQuery?: string
  defaultKind?: SearchKind
  defaultSort?: SearchSort
  facetIds?: string[]
  compact?: boolean
  showFilters?: boolean
  className?: string
}

export default function SearchForm({
  defaultQuery = '',
  defaultKind = 'all',
  defaultSort = 'relevance',
  facetIds = [],
  compact = false,
  showFilters = false,
  className = '',
}: Props) {
  return (
    <form action="/search" method="get" role="search" className={className}>
      {facetIds.map((id) => (
        <input key={id} type="hidden" name="facet" value={id} />
      ))}
      <div className={compact ? 'flex items-center gap-2' : 'space-y-3'}>
        <div className="relative flex-1">
          <Search className={`pointer-events-none absolute left-3.5 ${compact ? 'top-2.5' : 'top-3.5'} h-4 w-4 text-[#8a94a3]`} />
          <input
            type="search"
            name="q"
            defaultValue={defaultQuery}
            minLength={2}
            maxLength={120}
            autoComplete="off"
            placeholder="랭킹, 아이템, 브랜드 검색"
            aria-label="랭킹위키 검색"
            className={`w-full border border-[#d8dee6] bg-white pl-10 pr-4 text-sm text-[#171a1f] placeholder:text-[#9aa3af] transition focus:border-[#7890df] focus:outline-none focus:ring-4 focus:ring-[#3457c8]/10 ${compact ? 'rounded-xl py-2' : 'rounded-2xl py-3.5'}`}
          />
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <select
              name="type"
              defaultValue={defaultKind}
              aria-label="검색 대상"
              className="rounded-xl border border-[#d8dee6] bg-white px-3 py-2.5 text-xs font-semibold text-[#3f4752] focus:border-[#7890df] focus:outline-none"
            >
              <option value="all">전체</option>
              <option value="ranking">랭킹 문서</option>
              <option value="item">아이템</option>
            </select>
            <select
              name="sort"
              defaultValue={defaultSort}
              aria-label="검색 정렬"
              className="rounded-xl border border-[#d8dee6] bg-white px-3 py-2.5 text-xs font-semibold text-[#3f4752] focus:border-[#7890df] focus:outline-none"
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
