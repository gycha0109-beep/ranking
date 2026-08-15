export const SEARCH_PAGE_SIZE = 20
export const SEARCH_QUERY_MAX_LENGTH = 120
export const FACET_FILTER_MAX = 12

export const SEARCH_KINDS = ['all', 'ranking', 'item'] as const
export const SEARCH_SORTS = ['relevance', 'latest', 'popular'] as const
export const RANKING_BROWSE_SORTS = ['latest', 'popular'] as const

export type SearchKind = (typeof SEARCH_KINDS)[number]
export type SearchSort = (typeof SEARCH_SORTS)[number]
export type RankingBrowseSort = (typeof RANKING_BROWSE_SORTS)[number]
export type FacetAppliesTo = 'ranking' | 'item' | 'both'

export type SearchResult = {
  content_kind: 'ranking' | 'item'
  id: string
  slug: string
  title: string
  description: string | null
  image_url: string | null
  category_name: string | null
  category_slug: string | null
  subcategory_name: string | null
  subcategory_slug: string | null
  item_type: string | null
  brand_or_creator: string | null
  sort_time: string
  relevance_score: number
  unique_view_count: number
  like_count: number
  match_reason: string
}

export type PublicRankingListRow = {
  id: string
  slug: string
  title: string
  summary: string
  ranking_type: string
  cover_image_url: string | null
  published_at: string | null
  sort_time: string
  category_name: string
  category_slug: string
  subcategory_name: string | null
  subcategory_slug: string | null
  unique_view_count: number
  like_count: number
}

export type FacetOptionRow = {
  group_id: string
  group_code: string
  group_name: string
  applies_to: FacetAppliesTo
  facet_id: string
  facet_slug: string
  facet_name: string
}

export type FacetGroupOption = {
  id: string
  code: string
  name: string
  appliesTo: FacetAppliesTo
  facets: Array<{
    id: string
    slug: string
    name: string
  }>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeSearchQuery(value: string) {
  return value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ')
}

export function resolveSearchKind(value: string | undefined): SearchKind {
  return SEARCH_KINDS.includes(value as SearchKind) ? (value as SearchKind) : 'all'
}

export function resolveSearchSort(value: string | undefined): SearchSort {
  return SEARCH_SORTS.includes(value as SearchSort) ? (value as SearchSort) : 'relevance'
}

export function resolveRankingBrowseSort(value: string | undefined): RankingBrowseSort {
  return RANKING_BROWSE_SORTS.includes(value as RankingBrowseSort)
    ? (value as RankingBrowseSort)
    : 'latest'
}

export function isSearchQueryLengthValid(query: string) {
  const length = Array.from(query).length
  return length >= 2 && length <= SEARCH_QUERY_MAX_LENGTH
}

export function resolveFacetIds(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : []
  const ids = new Set<string>()
  let accepted = true

  for (const raw of values) {
    const id = raw.trim().toLowerCase()
    if (!UUID_PATTERN.test(id)) {
      accepted = false
      continue
    }
    ids.add(id)
  }

  const canonical = [...ids].sort()
  if (canonical.length > FACET_FILTER_MAX) {
    accepted = false
    canonical.length = FACET_FILTER_MAX
  }

  return { ids: canonical, accepted }
}

export function canonicalizeFacetIds(ids: string[], options: FacetOptionRow[]) {
  const allowed = new Set(options.map((option) => option.facet_id.toLowerCase()))
  const canonical = ids.filter((id) => allowed.has(id)).sort()
  return {
    ids: canonical,
    accepted: canonical.length === ids.length,
  }
}

export function groupFacetOptions(rows: FacetOptionRow[]): FacetGroupOption[] {
  const groups = new Map<string, FacetGroupOption>()

  for (const row of rows) {
    let group = groups.get(row.group_id)
    if (!group) {
      group = {
        id: row.group_id,
        code: row.group_code,
        name: row.group_name,
        appliesTo: row.applies_to,
        facets: [],
      }
      groups.set(row.group_id, group)
    }

    group.facets.push({
      id: row.facet_id,
      slug: row.facet_slug,
      name: row.facet_name,
    })
  }

  return [...groups.values()]
}

export function appendFacetParams(params: URLSearchParams, facetIds: string[]) {
  for (const id of facetIds) {
    params.append('facet', id)
  }
  return params
}
