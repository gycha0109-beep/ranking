import { normalizeRouteSlug } from '@/lib/routing'
import {
  classifyRankingIdentity,
  compareRankingIdentityRelations,
  explainRankingIdentity,
  SEMANTIC_SUBJECT_CANDIDATE_LIMIT,
  type RankingSemanticProjection,
} from '@/lib/ranking-identity'
import {
  classifyRankingNeighbor,
  compareRankingNeighbors,
  explainRankingNeighbor,
  RELATED_RANKING_LIMIT,
  SAME_SUBCATEGORY_CANDIDATE_LIMIT,
  SHARED_ITEM_CANDIDATE_ROW_LIMIT,
} from '@/lib/ranking-neighborhood'
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

  const [
    { data: entries },
    { data: criteria },
    { data: sources },
    { data: facetsData },
    { data: semanticProjection },
  ] = await Promise.all([
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
    supabase
      .from('ranking_semantic_projections')
      .select('*')
      .eq('ranking_id', ranking.id)
      .maybeSingle(),
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
    semantic_projection: semanticProjection || null,
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
 * IA-2 identity-first neighborhood:
 * optional semantic projection이 있으면 같은 Subject를 bounded candidate source로 추가하고
 * Claim → Method/View → Version identity를 IA-1 contextual similarity보다 우선한다.
 * projection이 없거나 분류 실패면 기존 IA-1 경로가 그대로 동작한다.
 */
export async function getRelatedRankings(ranking: any) {
  const supabase = createPublicClient()
  const candidateMap = new Map<string, any>()
  const currentProjection = (ranking.semantic_projection || null) as RankingSemanticProjection | null
  const itemIds = [...new Set((ranking.entries || []).map((entry: any) => entry.item_id).filter(Boolean))]

  const addCandidate = (candidate: any) => {
    if (!candidate?.id || candidate.id === ranking.id) return
    if (!candidateMap.has(candidate.id)) candidateMap.set(candidate.id, candidate)
  }

  const candidateQueries: PromiseLike<any>[] = []

  if (currentProjection?.subject_key) {
    candidateQueries.push(
      supabase
        .from('ranking_semantic_projections')
        .select(`ranking_id, rankings!inner(${PUBLIC_RANKING_COLUMNS}, categories(name, slug), subcategories(name, slug))`)
        .eq('subject_key', currentProjection.subject_key)
        .neq('ranking_id', ranking.id)
        .eq('rankings.status', 'published')
        .in('rankings.moderation_status', PUBLIC_MODERATION_STATUSES)
        .in('rankings.image_moderation_status', PUBLIC_MODERATION_STATUSES)
        .order('ranking_id', { ascending: true })
        .limit(SEMANTIC_SUBJECT_CANDIDATE_LIMIT)
    )
  }

  if (ranking.subcategory_id) {
    candidateQueries.push(
      supabase
        .from('rankings')
        .select(`${PUBLIC_RANKING_COLUMNS}, categories(name, slug), subcategories(name, slug)`)
        .eq('subcategory_id', ranking.subcategory_id)
        .neq('id', ranking.id)
        .eq('status', 'published')
        .in('moderation_status', PUBLIC_MODERATION_STATUSES)
        .in('image_moderation_status', PUBLIC_MODERATION_STATUSES)
        .order('published_at', { ascending: false })
        .order('id', { ascending: true })
        .limit(SAME_SUBCATEGORY_CANDIDATE_LIMIT)
    )
  }

  if (itemIds.length > 0) {
    candidateQueries.push(
      supabase
        .from('ranking_entries')
        .select(`id, ranking_id, rankings!inner(${PUBLIC_RANKING_COLUMNS}, categories(name, slug), subcategories(name, slug))`)
        .in('item_id', itemIds)
        .neq('ranking_id', ranking.id)
        .in('moderation_status', PUBLIC_MODERATION_STATUSES)
        .eq('rankings.status', 'published')
        .in('rankings.moderation_status', PUBLIC_MODERATION_STATUSES)
        .in('rankings.image_moderation_status', PUBLIC_MODERATION_STATUSES)
        .order('ranking_id', { ascending: true })
        .order('id', { ascending: true })
        .limit(SHARED_ITEM_CANDIDATE_ROW_LIMIT)
    )
  }

  const candidateResults = await Promise.all(candidateQueries)
  for (const result of candidateResults) {
    for (const row of result.data || []) {
      addCandidate(row.rankings || row)
    }
  }

  const candidateIds = [...candidateMap.keys()].sort((left, right) => left.localeCompare(right))
  if (candidateIds.length === 0) return []

  const [{ data: candidateEntries }, { data: candidateProjectionRows }] = await Promise.all([
    supabase
      .from('ranking_entries')
      .select('id, ranking_id, item_id, position, items!inner(id)')
      .in('ranking_id', candidateIds)
      .in('moderation_status', PUBLIC_MODERATION_STATUSES)
      .eq('items.status', 'active')
      .in('items.moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('items.image_moderation_status', PUBLIC_MODERATION_STATUSES)
      .order('ranking_id', { ascending: true })
      .order('position', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('ranking_semantic_projections')
      .select('*')
      .in('ranking_id', candidateIds)
      .order('ranking_id', { ascending: true }),
  ])

  const candidateItemIds = new Map<string, string[]>()
  for (const entry of candidateEntries || []) {
    if (!entry.ranking_id || !entry.item_id) continue
    const ids = candidateItemIds.get(entry.ranking_id) || []
    ids.push(entry.item_id)
    candidateItemIds.set(entry.ranking_id, ids)
  }

  const candidateProjections = new Map<string, RankingSemanticProjection>()
  for (const projection of candidateProjectionRows || []) {
    if (!projection.ranking_id) continue
    candidateProjections.set(projection.ranking_id, projection as RankingSemanticProjection)
  }

  const currentNode = {
    id: ranking.id,
    categoryId: ranking.category_id || null,
    subcategoryId: ranking.subcategory_id || null,
    title: ranking.title || '',
    itemIds,
    publishedAt: ranking.published_at || ranking.updated_at || ranking.created_at || null,
  }

  const neighbors: any[] = []
  for (const candidateId of candidateIds) {
    const data = candidateMap.get(candidateId)
    if (!data) continue

    const relation = classifyRankingNeighbor(currentNode, {
      id: data.id,
      categoryId: data.category_id || null,
      subcategoryId: data.subcategory_id || null,
      title: data.title || '',
      itemIds: candidateItemIds.get(data.id) || [],
      publishedAt: data.published_at || data.updated_at || data.created_at || null,
    })
    const identityRelation = classifyRankingIdentity(
      currentProjection,
      candidateProjections.get(candidateId) || null
    )

    if (!identityRelation && !relation) continue
    neighbors.push({ data, relation, identityRelation })
  }

  return neighbors
    .sort((left, right) => {
      if (left.identityRelation && right.identityRelation) {
        const identityOrder = compareRankingIdentityRelations(left.identityRelation, right.identityRelation)
        if (identityOrder !== 0) return identityOrder
      } else if (left.identityRelation) {
        return -1
      } else if (right.identityRelation) {
        return 1
      }

      if (left.relation && right.relation) {
        return compareRankingNeighbors(left.relation, right.relation)
      }
      if (left.relation) return -1
      if (right.relation) return 1
      return left.data.id.localeCompare(right.data.id)
    })
    .slice(0, RELATED_RANKING_LIMIT)
    .map(({ data, relation, identityRelation }) => ({
      ...data,
      related_reason: identityRelation
        ? explainRankingIdentity(identityRelation)
        : explainRankingNeighbor(relation, data.subcategories?.name),
      related_match_count: relation?.sharedItemCount || 0,
      related_tier: identityRelation ? `IA2:${identityRelation.kind}` : relation?.tier,
      related_identity_relation: identityRelation?.kind || null,
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
