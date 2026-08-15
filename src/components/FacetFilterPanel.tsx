import React from 'react'
import Link from 'next/link'
import { SlidersHorizontal, X } from 'lucide-react'
import { appendFacetParams, type FacetGroupOption } from '@/lib/search/contracts'

type Props = {
  action: string
  groups: FacetGroupOption[]
  selectedIds: string[]
  hiddenParams?: Record<string, string>
}

export default function FacetFilterPanel({ action, groups, selectedIds, hiddenParams = {} }: Props) {
  if (groups.length === 0) return null

  const selected = new Set(selectedIds)
  const facetById = new Map(
    groups.flatMap((group) => group.facets.map((facet) => [facet.id, { group, facet }] as const))
  )
  const selectedEntries = selectedIds.flatMap((id) => {
    const entry = facetById.get(id)
    return entry ? [{ id, group: entry.group, facet: entry.facet }] : []
  })

  const hrefFor = (ids: string[]) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(hiddenParams)) {
      if (value) params.set(key, value)
    }
    appendFacetParams(params, ids)
    const query = params.toString()
    return query ? `${action}?${query}` : action
  }

  const filterForm = (suffix: string) => (
    <form action={action} method="get" className="space-y-5">
      {Object.entries(hiddenParams).map(([key, value]) => (
        value ? <input key={`${suffix}-${key}`} type="hidden" name={key} value={value} /> : null
      ))}

      {groups.map((group) => (
        <fieldset key={`${suffix}-${group.id}`} className="border-t border-[#edf0f3] pt-4 first:border-t-0 first:pt-0">
          <legend className="text-xs font-extrabold text-[#3f4752]">{group.name}</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {group.facets.map((facet) => (
              <label
                key={`${suffix}-${facet.id}`}
                className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${selected.has(facet.id) ? 'border-[#9caee9] bg-[#eef2ff] text-[#2445ad]' : 'border-[#dfe4ea] bg-white text-[#6b7280] hover:border-[#bcc7dc] hover:text-[#3f4752]'}`}
              >
                <input type="checkbox" name="facet" value={facet.id} defaultChecked={selected.has(facet.id)} className="sr-only" />
                {facet.name}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <button type="submit" className="rw-button-primary w-full px-4 text-xs">필터 적용</button>
    </form>
  )

  const selectedChips = selectedEntries.length > 0 && (
    <div className="flex flex-wrap gap-2">
      {selectedEntries.map(({ id, group, facet }) => (
        <Link
          key={id}
          href={hrefFor(selectedIds.filter((selectedId) => selectedId !== id))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9d3f4] bg-[#eef2ff] px-2.5 py-1.5 text-[10px] font-bold text-[#3457c8] hover:border-[#e5aab5] hover:bg-[#fff1f2] hover:text-[#be4057]"
          aria-label={`${group.name} ${facet.name} 필터 해제`}
        >
          <span className="text-[#7185c8]">{group.name}</span>
          {facet.name}
          <X className="h-3 w-3" />
        </Link>
      ))}
    </div>
  )

  const compositionHelp = '같은 그룹에서는 하나라도 일치하면 되고, 다른 그룹과는 모두 일치해야 합니다.'

  return (
    <>
      <aside className="hidden rounded-2xl border border-[#dde2e8] bg-white p-5 lg:block">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#20242a]">
              <SlidersHorizontal className="h-4 w-4 text-[#3457c8]" />필터
            </div>
            <p className="mt-1 text-[11px] leading-5 text-[#8a94a3]">{compositionHelp}</p>
          </div>
          {selectedIds.length > 0 && <Link href={hrefFor([])} className="text-[10px] font-bold text-[#8a94a3] hover:text-[#be4057]">전체 해제</Link>}
        </div>
        {selectedChips && <div className="mt-4">{selectedChips}</div>}
        <div className="mt-5">{filterForm('desktop')}</div>
      </aside>

      <details className="rounded-2xl border border-[#dde2e8] bg-white lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-extrabold text-[#20242a]">
          <span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-[#3457c8]" />필터 {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</span>
          <span className="text-[10px] font-bold text-[#8a94a3]">열기</span>
        </summary>
        <div className="border-t border-[#edf0f3] p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <p className="text-[11px] leading-5 text-[#8a94a3]">{compositionHelp}</p>
            {selectedIds.length > 0 && <Link href={hrefFor([])} className="shrink-0 text-[10px] font-bold text-[#8a94a3] hover:text-[#be4057]">전체 해제</Link>}
          </div>
          {selectedChips && <div className="mb-5">{selectedChips}</div>}
          {filterForm('mobile')}
        </div>
      </details>
    </>
  )
}
