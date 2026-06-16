import { createClient } from '@/lib/supabase/server'

/**
 * 1. 홈 데이터 조회
 * - featured = true 이고 published 상태인 대표 랭킹
 * - 최신 published 랭킹 5개
 * - 공개 카테고리 목록
 */
export async function getHomeData() {
  const supabase = await createClient()

  // 대표 랭킹
  const { data: featuredRanking } = await supabase
    .from('rankings')
    .select('*, categories(name, slug), subcategories(name, slug)')
    .eq('status', 'published')
    .eq('featured', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 최신 랭킹
  const { data: recentRankings } = await supabase
    .from('rankings')
    .select('*, categories(name, slug), subcategories(name, slug)')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(6)

  // 공개 카테고리
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })

  return {
    featuredRanking: featuredRanking || null,
    recentRankings: recentRankings || [],
    categories: categories || [],
  }
}

/**
 * 2. 모든 공개 카테고리 조회
 */
export async function getVisibleCategories() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('*, subcategories(*)')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })
  return data || []
}

/**
 * 3. 슬러그로 카테고리 상세 정보 조회
 */
export async function getCategoryBySlug(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('*, subcategories(*)')
    .eq('slug', slug)
    .eq('is_visible', true)
    .maybeSingle()
  return data || null
}

/**
 * 4. 슬러그로 서브카테고리 상세 정보 조회
 */
export async function getSubcategoryBySlug(categorySlug: string, subcategorySlug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('subcategories')
    .select('*, categories!inner(*)')
    .eq('slug', subcategorySlug)
    .eq('categories.slug', categorySlug)
    .eq('is_visible', true)
    .maybeSingle()
  return data || null
}

/**
 * 5. 특정 카테고리에 속한 published 랭킹 목록 조회
 */
export async function getPublishedRankingsByCategory(categorySlug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rankings')
    .select('*, categories!inner(*), subcategories(*)')
    .eq('status', 'published')
    .eq('categories.slug', categorySlug)
    .order('published_at', { ascending: false })
  return data || []
}

/**
 * 6. 특정 서브카테고리에 속한 published 랭킹 목록 조회
 */
export async function getPublishedRankingsBySubcategory(categorySlug: string, subcategorySlug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rankings')
    .select('*, categories!inner(*), subcategories!inner(*)')
    .eq('status', 'published')
    .eq('categories.slug', categorySlug)
    .eq('subcategories.slug', subcategorySlug)
    .order('published_at', { ascending: false })
  return data || []
}

/**
 * 7. 슬러그로 published 랭킹 상세 및 하위 엔트리/기준/출처 조회
 * - entries는 position 순으로 오름차순 정렬
 */
export async function getPublishedRankingBySlug(slug: string) {
  const supabase = await createClient()

  // 랭킹 상세 및 카테고리 정보
  const { data: ranking } = await supabase
    .from('rankings')
    .select('*, categories(name, slug), subcategories(name, slug)')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!ranking) return null

  // 순위표 엔트리 및 연결된 아이템 정보
  const { data: entries } = await supabase
    .from('ranking_entries')
    .select('*, items(*)')
    .eq('ranking_id', ranking.id)
    .order('position', { ascending: true })

  // 선정 기준
  const { data: criteria } = await supabase
    .from('ranking_criteria')
    .select('*')
    .eq('ranking_id', ranking.id)
    .order('sort_order', { ascending: true })

  // 공개 출처 정보
  const { data: sources } = await supabase
    .from('ranking_sources')
    .select('*')
    .eq('ranking_id', ranking.id)
    .eq('is_public', true)

  // 관련 Facet
  const { data: facetsData } = await supabase
    .from('ranking_facets')
    .select('facets(id, name, slug, facet_groups(name, code))')
    .eq('ranking_id', ranking.id)

  const facets = (facetsData || [])
    .map((rf: any) => rf.facets)
    .filter(Boolean)

  return {
    ...ranking,
    entries: entries || [],
    criteria: criteria || [],
    sources: sources || [],
    facets,
  }
}

/**
 * 8. 슬러그로 아이템 정보 및 연결된 Facet 정보 조회
 */
export async function getItemBySlug(slug: string) {
  const supabase = await createClient()

  const { data: item } = await supabase
    .from('items')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (!item) return null

  // 아이템의 Facet 정보 조회
  const { data: facetsData } = await supabase
    .from('item_facets')
    .select('facets(id, name, slug, facet_groups(name, code))')
    .eq('item_id', item.id)

  const facets = (facetsData || [])
    .map((ifac: any) => ifac.facets)
    .filter(Boolean)

  return {
    ...item,
    facets,
  }
}

/**
 * 9. 특정 아이템이 포함된 모든 published 랭킹 목록 조회
 */
export async function getRankingsContainingItem(itemId: string) {
  const supabase = await createClient()

  const { data: entries } = await supabase
    .from('ranking_entries')
    .select('position, rankings(*, categories(name, slug), subcategories(name, slug))')
    .eq('item_id', itemId)
    .eq('rankings.status', 'published')
    .order('created_at', { ascending: false })

  const rankings = (entries || [])
    .map((entry: any) => {
      if (!entry.rankings) return null
      return {
        ...entry.rankings,
        position: entry.position,
      }
    })
    .filter(Boolean)

  return rankings
}
