import { createPublicClient } from '@/lib/supabase/public'
import {
  SEARCH_PAGE_SIZE,
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

export async function searchPublicContent(args: {
  query: string
  kind: SearchKind
  sort: SearchSort
  cursor?: string
}) {
  const supabase = createPublicClient()
  const fingerprint = createSearchFingerprint(args.query, args.kind, args.sort)
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
}) {
  const supabase = createPublicClient()
  const subcategorySlug = args.subcategorySlug || null
  const fingerprint = createRankingBrowseFingerprint(args.categorySlug, subcategorySlug, args.sort)
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
