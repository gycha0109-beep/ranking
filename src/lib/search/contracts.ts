export const SEARCH_PAGE_SIZE = 20
export const SEARCH_QUERY_MAX_LENGTH = 120

export const SEARCH_KINDS = ['all', 'ranking', 'item'] as const
export const SEARCH_SORTS = ['relevance', 'latest', 'popular'] as const
export const RANKING_BROWSE_SORTS = ['latest', 'popular'] as const

export type SearchKind = (typeof SEARCH_KINDS)[number]
export type SearchSort = (typeof SEARCH_SORTS)[number]
export type RankingBrowseSort = (typeof RANKING_BROWSE_SORTS)[number]

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
