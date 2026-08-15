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
          <Search className={`absolute left-3.5 ${compact ? 'top-2.5' : 'top-3'} w-4 h-4 text-slate-500 pointer-events-none`} />
          <input
            type="search"
            name="q"
            defaultValue={defaultQuery}
            minLength={2}
            maxLength={120}
            autoComplete="off"
            placeholder="문서 제목, 아이템, 브랜드, 태그 검색"
            aria-label="랭킹위키 검색"
            className={`w-full pl-10 pr-4 text-xs bg-white/[0.025] border border-white/10 focus:border-indigo-500/40 focus:bg-white/[0.04] focus:outline-none text-slate-200 placeholder:text-slate-600 transition-all ${compact ? 'py-2 rounded-xl' : 'py-3 rounded-2xl'}`}
          />
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:flex gap-2">
            <select
              name="type"
              defaultValue={defaultKind}
              aria-label="검색 대상"
              className="rounded-xl border border-white/10 bg-[#0b0b11] px-3 py-2.5 text-xs font-semibold text-slate-300 focus:border-indigo-500/40 focus:outline-none"
            >
              <option value="all">전체</option>
              <option value="ranking">랭킹 문서</option>
              <option value="item">아이템</option>
            </select>
            <select
              name="sort"
              defaultValue={defaultSort}
              aria-label="검색 정렬"
              className="rounded-xl border border-white/10 bg-[#0b0b11] px-3 py-2.5 text-xs font-semibold text-slate-300 focus:border-indigo-500/40 focus:outline-none"
            >
              <option value="relevance">관련도순</option>
              <option value="latest">최신순</option>
              <option value="popular">인기순</option>
            </select>
            <button
              type="submit"
              className="col-span-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-black text-white transition hover:bg-indigo-400 sm:col-span-1"
            >
              검색
            </button>
          </div>
        )}

        {!showFilters && (
          <button
            type="submit"
            className={`${compact ? 'hidden lg:inline-flex' : 'mt-3 inline-flex'} items-center justify-center rounded-xl bg-indigo-500 px-4 py-2 text-xs font-black text-white transition hover:bg-indigo-400`}
          >
            검색
          </button>
        )}
      </div>
    </form>
  )
}
