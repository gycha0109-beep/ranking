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

export default function FacetFilterPanel({
  action,
  groups,
  selectedIds,
  hiddenParams = {},
}: Props) {
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

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-slate-200">
            <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
            Facet 필터
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            같은 그룹에서는 하나라도 일치하면 포함되고, 서로 다른 그룹은 모두 만족해야 합니다.
          </p>
        </div>
        {selectedIds.length > 0 && (
          <Link
            href={hrefFor([])}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 transition hover:border-rose-500/20 hover:text-rose-300"
          >
            전체 해제
          </Link>
        )}
      </div>

      {selectedEntries.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedEntries.map(({ id, group, facet }) => (
            <Link
              key={id}
              href={hrefFor(selectedIds.filter((selectedId) => selectedId !== id))}
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/[0.08] px-2.5 py-1 text-[10px] font-bold text-indigo-200 transition hover:border-rose-500/25 hover:bg-rose-500/[0.06] hover:text-rose-200"
              aria-label={`${group.name} ${facet.name} 필터 해제`}
            >
              <span className="text-indigo-400/70">{group.name}</span>
              {facet.name}
              <X className="h-3 w-3" />
            </Link>
          ))}
        </div>
      )}

      <form action={action} method="get" className="mt-5 space-y-5">
        {Object.entries(hiddenParams).map(([key, value]) => (
          value ? <input key={key} type="hidden" name={key} value={value} /> : null
        ))}

        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <fieldset key={group.id} className="rounded-xl border border-white/[0.05] bg-slate-950/30 p-3.5">
              <legend className="px-1 text-[11px] font-black text-slate-300">{group.name}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.facets.map((facet) => (
                  <label
                    key={facet.id}
                    className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${selected.has(facet.id) ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200' : 'border-white/[0.07] bg-white/[0.02] text-slate-500 hover:border-white/15 hover:text-slate-300'}`}
                  >
                    <input
                      type="checkbox"
                      name="facet"
                      value={facet.id}
                      defaultChecked={selected.has(facet.id)}
                      className="sr-only"
                    />
                    {facet.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-xl bg-indigo-500 px-4 py-2 text-xs font-black text-white transition hover:bg-indigo-400"
          >
            필터 적용
          </button>
        </div>
      </form>
    </section>
  )
}
