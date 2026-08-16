import { normalizeRouteSlug } from '@/lib/routing'
import { createPublicClient } from '@/lib/supabase/public'

const PUBLIC_MODERATION_STATUSES = ['clean', 'suggestive']

const PUBLIC_RANKING_COLUMNS = 'id, category_id, subcategory_id, title, slug, summary, body, ranking_type, scope_json, status, featured, cover_image_url, seo_title, seo_description, published_at, created_at, updated_at, moderation_status, moderation_reason, image_moderation_status, image_moderation_reason'
const PUBLIC_ITEM_COLUMNS = 'id, title, slug, description, item_type, image_url, brand_or_creator, external_url, affiliate_url, status, metadata, created_at, updated_at, moderation_status, moderation_reason, image_moderation_status, image_moderation_reason'
const PUBLIC_ENTRY_COLUMNS = 'id, ranking_id, item_id, position, reason, editor_score, score_json, sponsor_flag, metadata, created_at, updated_at, moderation_status, moderation_reason'

type RelatedCandidate = {
  id: string
  priority: number
  matchCount: number
  reason: string
  data: any
}

function upsertCandidate(
  candidates: Map<string, RelatedCandidate>,
  data: any,
  priority: number,
  reason: string
) {
  if (!data?.id) return

  const current = candidates.get(data.id)
  if (!current) {
    candidates.set(data.id, { id: data.id, priority, matchCount: 1, reason, data })
    return
  }

  current.matchCount += 1
  if (priority < current.priority) {
    current.priority = priority
    current.reason = reason
  }
}

function sortCandidates(a: RelatedCandidate, b: RelatedCandidate) {
  if (a.priority !== b.priority) return a.priority - b.priority
  if (a.matchCount !== b.matchCount) return b.matchCount - a.matchCount

  const aDate = new Date(a.data.published_at || a.data.updated_at || a.data.created_at || 0).getTime()
  const bDate = new Date(b.data.published_at || b.data.updated_at || b.data.created_at || 0).getTime()
  if (aDate !== bDate) return bDate - aDate
  return a.id.localeCompare(b.id)
}

export async function getHomeData() {
  const supabase = createPublicClient()

  const { data: featuredRanking } = await supabase
    .from('rankings')
    .select(`${PUBLIC_RANKING_COLUMNS}, categories(name, slug), subcategories(name, slug)`)
    .eq('status', 'published')
    .in('moderation_status', PUBLIC_MODERATION_STATUSES)
    .in('image_moderation_status', PUBLIC_MODERATION_STATUSES)
    .eq('featured', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: recentRankings } = await supabase
    .from('rankings')
    .select(`${PUBLIC_RANKING_COLUMNS}, categories(name, slug), subcategories(name, slug)`)
    .eq('status', 'published')
    .in('moderation_status', PUBLIC_MODERATION_STATUSES)
    .in('image_moderation_status', PUBLIC_MODERATION_STATUSES)
    .order('published_at', { ascending: false })
    .limit(6)

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })

  return {
    featuredRanking: (featuredRanking as any) || null,
    recentRankings: (recentRankings || []) as any[],
    categories: categories || [],
  }
}

export async function getVisibleCategories() {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('categories')
    .select('*, subcategories(*)')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })
  return (data || []) as any[]
}

export async function getCategoryBySlug(slug: string) {
  const normalizedSlug = normalizeRouteSlug(slug)
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('categories')
    .select('*, subcategories(*)')
    .eq('slug', normalizedSlug)
    .eq('is_visible', true)
    .maybeSingle()
  return data || null
}

export async function getSubcategoryBySlug(categorySlug: string, subcategorySlug: string) {
  const normalizedCategorySlug = normalizeRouteSlug(categorySlug)
  const normalizedSubcategorySlug = normalizeRouteSlug(subcategorySlug)
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('subcategories')
    .select('*, categories!inner(id, name, slug)')
    .eq('slug', normalizedSubcategorySlug)
    .eq('categories.slug', normalizedCategorySlug)
    .eq('is_visible', true)
    .maybeSingle()
  return (data as any) || null
}

export async function getPublishedRankingBySlug(slug: string) {
  const normalizedSlug = normalizeRouteSlug(slug)
  const supabase = createPublicClient()

  const { data: ranking } = await supabase
    .from('rankings')
    .select(`${PUBLIC_RANKING_COLUMNS}, categories(name, slug), subcategories(name, slug)`)
    .eq('slug', normalizedSlug)
    .eq('status', 'published')
    .in('moderation_status', PUBLIC_MODERATION_STATUSES)
    .in('image_moderation_status', PUBLIC_MODERATION_STATUSES)
    .maybeSingle()

  if (!ranking) return null

  const [{ data: entries }, { data: criteria }, { data: sources }, { data: facetsData }] = await Promise.all([
    supabase
      .from('ranking_entries')
      .select(`${PUBLIC_ENTRY_COLUMNS}, items!inner(${PUBLIC_ITEM_COLUMNS})`)
      .eq('ranking_id', ranking.id)
      .in('moderation_status', PUBLIC_MODERATION_STATUSES)
      .eq('items.status', 'active')
      .in('items.moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('items.image_moderation_status', PUBLIC_MODERATION_STATUSES)
      .order('position', { ascending: true }),
    supabase
      .from('ranking_criteria')
      .select('*')
      .eq('ranking_id', ranking.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('ranking_sources')
      .select('*')
      .eq('ranking_id', ranking.id)
      .eq('is_public', true),
    supabase
      .from('ranking_facets')
      .select('facets(id, name, slug, facet_groups(name, code))')
      .eq('ranking_id', ranking.id),
  ])

  const facets = (facetsData || [])
    .map((rf: any) => rf.facets)
    .filter(Boolean)

  return {
    ...(ranking as any),
    entries: entries || [],
    criteria: criteria || [],
    sources: sources || [],
    facets,
  }
}

export async function getItemBySlug(slug: string) {
  const normalizedSlug = normalizeRouteSlug(slug)
  const supabase = createPublicClient()

  const { data: item } = await supabase
    .from('items')
    .select(PUBLIC_ITEM_COLUMNS)
    .eq('slug', normalizedSlug)
    .eq('status', 'active')
    .in('moderation_status', PUBLIC_MODERATION_STATUSES)
    .in('image_moderation_status', PUBLIC_MODERATION_STATUSES)
    .maybeSingle()

  if (!item) return null

  const { data: facetsData } = await supabase
    .from('item_facets')
    .select('facets(id, name, slug, facet_groups(name, code))')
    .eq('item_id', item.id)

  const facets = (facetsData || [])
    .map((ifac: any) => ifac.facets)
    .filter(Boolean)

  return {
    ...(item as any),
    facets,
  }
}

export async function getRankingsContainingItem(itemId: string) {
  const supabase = createPublicClient()

  const { data: entries } = await supabase
    .from('ranking_entries')
    .select(`position, rankings!inner(${PUBLIC_RANKING_COLUMNS}, categories(name, slug), subcategories(name, slug))`)
    .eq('item_id', itemId)
    .in('moderation_status', PUBLIC_MODERATION_STATUSES)
    .eq('rankings.status', 'published')
    .in('rankings.moderation_status', PUBLIC_MODERATION_STATUSES)
    .in('rankings.image_moderation_status', PUBLIC_MODERATION_STATUSES)
    .order('created_at', { ascending: false })

  return (entries || [])
    .map((entry: any) => entry.rankings ? { ...entry.rankings, position: entry.position } : null)
    .filter(Boolean)
}

/**
 * 관련 랭킹 우선순위:
 * 공유 아이템 > 동일 서브카테고리 > 동일 카테고리 > 공유 Facet > 최신 발행일 > ID.
 */
export async function getRelatedRankings(ranking: any) {
  const supabase = createPublicClient()
  const candidates = new Map<string, RelatedCandidate>()
  const itemIds = (ranking.entries || []).map((entry: any) => entry.item_id).filter(Boolean)
  const facetIds = (ranking.facets || []).map((facet: any) => facet.id).filter(Boolean)

  if (itemIds.length > 0) {
    const { data } = await supabase
      .from('ranking_entries')
      .select(`ranking_id, rankings!inner(${PUBLIC_RANKING_COLUMNS}, categories(name, slug), subcategories(name, slug))`)
      .in('item_id', itemIds)
      .neq('ranking_id', ranking.id)
      .in('moderation_status', PUBLIC_MODERATION_STATUSES)
      .eq('rankings.status', 'published')
      .in('rankings.moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('rankings.image_moderation_status', PUBLIC_MODERATION_STATUSES)
      .limit(60)

    for (const row of data || []) upsertCandidate(candidates, row.rankings, 1, '공유 아이템')
  }

  if (ranking.subcategory_id) {
    const { data } = await supabase
      .from('rankings')
      .select(`${PUBLIC_RANKING_COLUMNS}, categories(name, slug), subcategories(name, slug)`)
      .eq('subcategory_id', ranking.subcategory_id)
      .neq('id', ranking.id)
      .eq('status', 'published')
      .in('moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('image_moderation_status', PUBLIC_MODERATION_STATUSES)
      .order('published_at', { ascending: false })
      .limit(20)

    for (const row of data || []) upsertCandidate(candidates, row, 2, '같은 세부 분류')
  }

  if (ranking.category_id) {
    const { data } = await supabase
      .from('rankings')
      .select(`${PUBLIC_RANKING_COLUMNS}, categories(name, slug), subcategories(name, slug)`)
      .eq('category_id', ranking.category_id)
      .neq('id', ranking.id)
      .eq('status', 'published')
      .in('moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('image_moderation_status', PUBLIC_MODERATION_STATUSES)
      .order('published_at', { ascending: false })
      .limit(30)

    for (const row of data || []) upsertCandidate(candidates, row, 3, '같은 카테고리')
  }

  if (facetIds.length > 0) {
    const { data } = await supabase
      .from('ranking_facets')
      .select(`ranking_id, rankings!inner(${PUBLIC_RANKING_COLUMNS}, categories(name, slug), subcategories(name, slug))`)
      .in('facet_id', facetIds)
      .neq('ranking_id', ranking.id)
      .eq('rankings.status', 'published')
      .in('rankings.moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('rankings.image_moderation_status', PUBLIC_MODERATION_STATUSES)
      .limit(60)

    for (const row of data || []) upsertCandidate(candidates, row.rankings, 4, '공유 태그')
  }

  return [...candidates.values()]
    .sort(sortCandidates)
    .slice(0, 6)
    .map(candidate => ({
      ...candidate.data,
      related_reason: candidate.reason,
      related_match_count: candidate.matchCount,
    }))
}

/**
 * 관련 아이템 우선순위:
 * 같은 브랜드/제작자 > 공유 Facet > 같은 공개 랭킹·카테고리 > 최신 시각 > ID.
 */
export async function getRelatedItems(item: any) {
  const supabase = createPublicClient()
  const candidates = new Map<string, RelatedCandidate>()
  const facetIds = (item.facets || []).map((facet: any) => facet.id).filter(Boolean)

  if (item.brand_or_creator) {
    const { data } = await supabase
      .from('items')
      .select(PUBLIC_ITEM_COLUMNS)
      .eq('brand_or_creator', item.brand_or_creator)
      .neq('id', item.id)
      .eq('status', 'active')
      .in('moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('image_moderation_status', PUBLIC_MODERATION_STATUSES)
      .order('created_at', { ascending: false })
      .limit(20)

    for (const row of data || []) upsertCandidate(candidates, row, 1, '같은 브랜드·제작자')
  }

  if (facetIds.length > 0) {
    const { data } = await supabase
      .from('item_facets')
      .select(`item_id, items!inner(${PUBLIC_ITEM_COLUMNS})`)
      .in('facet_id', facetIds)
      .neq('item_id', item.id)
      .eq('items.status', 'active')
      .in('items.moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('items.image_moderation_status', PUBLIC_MODERATION_STATUSES)
      .limit(60)

    for (const row of data || []) upsertCandidate(candidates, row.items, 2, '공유 태그')
  }

  const { data: containingRows } = await supabase
    .from('ranking_entries')
    .select('ranking_id, rankings!inner(id, category_id)')
    .eq('item_id', item.id)
    .in('moderation_status', PUBLIC_MODERATION_STATUSES)
    .eq('rankings.status', 'published')
    .in('rankings.moderation_status', PUBLIC_MODERATION_STATUSES)
    .in('rankings.image_moderation_status', PUBLIC_MODERATION_STATUSES)

  const containingRankingIds = [...new Set((containingRows || []).map((row: any) => row.ranking_id).filter(Boolean))]
  const categoryIds = [...new Set((containingRows || []).map((row: any) => row.rankings?.category_id).filter(Boolean))]

  if (containingRankingIds.length > 0) {
    const { data } = await supabase
      .from('ranking_entries')
      .select(`item_id, items!inner(${PUBLIC_ITEM_COLUMNS})`)
      .in('ranking_id', containingRankingIds)
      .neq('item_id', item.id)
      .in('moderation_status', PUBLIC_MODERATION_STATUSES)
      .eq('items.status', 'active')
      .in('items.moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('items.image_moderation_status', PUBLIC_MODERATION_STATUSES)
      .limit(80)

    for (const row of data || []) upsertCandidate(candidates, row.items, 3, '같은 랭킹에 등장')
  }

  if (categoryIds.length > 0) {
    const { data: categoryRankings } = await supabase
      .from('rankings')
      .select('id')
      .in('category_id', categoryIds)
      .eq('status', 'published')
      .in('moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('image_moderation_status', PUBLIC_MODERATION_STATUSES)
      .order('published_at', { ascending: false })
      .limit(30)

    const categoryRankingIds = (categoryRankings || []).map(row => row.id)
    if (categoryRankingIds.length > 0) {
      const { data } = await supabase
        .from('ranking_entries')
        .select(`item_id, items!inner(${PUBLIC_ITEM_COLUMNS})`)
        .in('ranking_id', categoryRankingIds)
        .neq('item_id', item.id)
        .in('moderation_status', PUBLIC_MODERATION_STATUSES)
        .eq('items.status', 'active')
        .in('items.moderation_status', PUBLIC_MODERATION_STATUSES)
        .in('items.image_moderation_status', PUBLIC_MODERATION_STATUSES)
        .limit(100)

      for (const row of data || []) upsertCandidate(candidates, row.items, 4, '같은 카테고리')
    }
  }

  return [...candidates.values()]
    .sort(sortCandidates)
    .slice(0, 10)
    .map(candidate => ({
      ...candidate.data,
      related_reason: candidate.reason,
      related_match_count: candidate.matchCount,
    }))
}
