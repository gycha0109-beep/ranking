import { createPublicClient } from '@/lib/supabase/public'
import {
  SEARCH_PAGE_SIZE,
  groupFacetOptions,
  type FacetOptionRow,
  type PublicRankingListRow,
  type RankingBrowseSort,
  type SearchKind,
  type SearchResult,
  type SearchSort,
} from '@/lib/search/contracts'
import {
  createRankingBrowseFingerprint,
  createSearchFingerprint,
  decodeRankingBrowseCursor,
  decodeSearchCursor,
  encodeRankingBrowseCursor,
  encodeSearchCursor,
} from '@/lib/search/cursor'

export async function getPublicFacetOptions(args: {
  kind: SearchKind
  categorySlug?: string | null
  subcategorySlug?: string | null
}) {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('list_public_facet_options', {
    p_kind: args.kind,
    p_category_slug: args.categorySlug || null,
    p_subcategory_slug: args.subcategorySlug || null,
    p_limit: 200,
  })

  if (error) {
    throw new Error('공개 필터 옵션을 불러오지 못했습니다.')
  }

  const rows = (data || []) as FacetOptionRow[]
  return {
    rows,
    groups: groupFacetOptions(rows),
  }
}

export async function searchPublicContent(args: {
  query: string
  kind: SearchKind
  sort: SearchSort
  cursor?: string
  facetIds?: string[]
}) {
  const supabase = createPublicClient()
  const facetIds = args.facetIds || []
  const fingerprint = createSearchFingerprint(args.query, args.kind, args.sort, facetIds)
  const cursor = decodeSearchCursor(args.cursor, fingerprint, args.sort)

  const { data, error } = await supabase.rpc('search_public_content', {
    p_query: args.query,
    p_kind: args.kind,
    p_sort: args.sort,
    p_limit: SEARCH_PAGE_SIZE + 1,
    p_cursor_relevance: cursor?.relevance ?? null,
    p_cursor_views: cursor?.views ?? null,
    p_cursor_likes: cursor?.likes ?? null,
    p_cursor_time: cursor?.time ?? null,
    p_cursor_kind: cursor?.kind ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_facet_ids: facetIds,
  })

  if (error) {
    throw new Error('공개 검색 결과를 불러오지 못했습니다.')
  }

  const rows = (data || []) as SearchResult[]
  const hasNext = rows.length > SEARCH_PAGE_SIZE
  const items = hasNext ? rows.slice(0, SEARCH_PAGE_SIZE) : rows
  const last = items.at(-1)

  return {
    items,
    nextCursor: hasNext && last
      ? encodeSearchCursor({ fingerprint, sort: args.sort, row: last })
      : null,
    cursorAccepted: !args.cursor || cursor !== null,
  }
}

export async function listPublicRankings(args: {
  categorySlug: string
  subcategorySlug?: string | null
  sort: RankingBrowseSort
  cursor?: string
  facetIds?: string[]
}) {
  const supabase = createPublicClient()
  const subcategorySlug = args.subcategorySlug || null
  const facetIds = args.facetIds || []
  const fingerprint = createRankingBrowseFingerprint(args.categorySlug, subcategorySlug, args.sort, facetIds)
  const cursor = decodeRankingBrowseCursor(args.cursor, fingerprint, args.sort)

  const { data, error } = await supabase.rpc('list_public_rankings', {
    p_category_slug: args.categorySlug,
    p_subcategory_slug: subcategorySlug,
    p_sort: args.sort,
    p_limit: SEARCH_PAGE_SIZE + 1,
    p_cursor_views: cursor?.views ?? null,
    p_cursor_likes: cursor?.likes ?? null,
    p_cursor_time: cursor?.time ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_facet_ids: facetIds,
  })

  if (error) {
    throw new Error('공개 랭킹 목록을 불러오지 못했습니다.')
  }

  const rows = (data || []) as PublicRankingListRow[]
  const hasNext = rows.length > SEARCH_PAGE_SIZE
  const pageRows = hasNext ? rows.slice(0, SEARCH_PAGE_SIZE) : rows
  const last = pageRows.at(-1)

  const items = pageRows.map((row) => ({
    ...row,
    categories: {
      name: row.category_name,
      slug: row.category_slug,
    },
    subcategories: row.subcategory_name && row.subcategory_slug
      ? {
          name: row.subcategory_name,
          slug: row.subcategory_slug,
        }
      : null,
  }))

  return {
    items,
    nextCursor: hasNext && last
      ? encodeRankingBrowseCursor({ fingerprint, sort: args.sort, row: last })
      : null,
    cursorAccepted: !args.cursor || cursor !== null,
  }
}
