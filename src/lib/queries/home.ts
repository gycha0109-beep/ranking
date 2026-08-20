import { createPublicClient } from '@/lib/supabase/public'

const PUBLIC_MODERATION_STATUSES = ['clean', 'suggestive']
const HOME_CANDIDATE_LIMIT = 24
const HOME_FEATURED_LIMIT = 6

export type HomeLeadEntry = {
  position: number
  reason: string | null
  item: {
    id: string
    title: string
    slug: string
    brand_or_creator: string | null
  }
}

export type HomeRankingSummary = {
  id: string
  category_id: string | null
  subcategory_id: string | null
  title: string
  slug: string
  summary: string | null
  featured: boolean
  cover_image_url: string | null
  published_at: string | null
  updated_at: string
  categories: { name: string; slug: string } | null
  subcategories: { name: string; slug: string } | null
}

export type HomeFeaturedEntry = {
  position: number
  reason: string | null
  item: {
    id: string
    title: string
    slug: string
    brand_or_creator: string | null
    image_url: string | null
  }
}

export type HomeFeaturedSlide = HomeRankingSummary & {
  entries: HomeFeaturedEntry[]
  visual_image_url: string | null
}

export type HomeCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  ranking_count: number
}

function publishedTime(ranking: HomeRankingSummary) {
  return new Date(ranking.published_at || ranking.updated_at || 0).getTime()
}

function deterministicLatest(a: HomeRankingSummary, b: HomeRankingSummary) {
  const byDate = publishedTime(b) - publishedTime(a)
  if (byDate !== 0) return byDate
  return a.id.localeCompare(b.id)
}

export function selectHomeFeaturedRankings(
  candidates: HomeRankingSummary[],
  limit = HOME_FEATURED_LIMIT,
) {
  const ordered = [...candidates].sort(deterministicLatest)
  const selected: HomeRankingSummary[] = []
  const selectedIds = new Set<string>()

  const add = (ranking: HomeRankingSummary) => {
    if (selected.length >= limit || selectedIds.has(ranking.id)) return
    selected.push(ranking)
    selectedIds.add(ranking.id)
  }

  // Explicit editorial feature flags remain authoritative when present.
  for (const ranking of ordered) {
    if (ranking.featured) add(ranking)
  }

  // Then prefer one recent ranking per category so the carousel is not a single-topic feed.
  const representedCategories = new Set(selected.map((ranking) => ranking.category_id).filter(Boolean))
  for (const ranking of ordered) {
    if (selected.length >= limit) break
    if (!ranking.category_id || representedCategories.has(ranking.category_id)) continue
    add(ranking)
    representedCategories.add(ranking.category_id)
  }

  // Use unseen subcategories as the next deterministic diversity signal.
  const representedSubcategories = new Set(selected.map((ranking) => ranking.subcategory_id).filter(Boolean))
  for (const ranking of ordered) {
    if (selected.length >= limit) break
    if (!ranking.subcategory_id || representedSubcategories.has(ranking.subcategory_id)) continue
    add(ranking)
    representedSubcategories.add(ranking.subcategory_id)
  }

  // Fill any remaining slots strictly by latest published/update timestamp and stable id.
  for (const ranking of ordered) {
    add(ranking)
    if (selected.length >= limit) break
  }

  return selected
}

export async function getHomePresentationData() {
  const supabase = createPublicClient()
  const [rankingsResult, categoriesResult, categoryCountsResult] = await Promise.all([
    supabase
      .from('rankings')
      .select('id, category_id, subcategory_id, title, slug, summary, featured, cover_image_url, published_at, updated_at, categories(name, slug), subcategories(name, slug)')
      .eq('status', 'published')
      .in('moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('image_moderation_status', PUBLIC_MODERATION_STATUSES)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(HOME_CANDIDATE_LIMIT),
    supabase
      .from('categories')
      .select('id, name, slug, description, sort_order')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('rankings')
      .select('category_id')
      .eq('status', 'published')
      .in('moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('image_moderation_status', PUBLIC_MODERATION_STATUSES)
      .limit(1000),
  ])

  const candidates = ((rankingsResult.data || []) as unknown as HomeRankingSummary[])
    .sort(deterministicLatest)
  const selected = selectHomeFeaturedRankings(candidates)
  const selectedIds = selected.map((ranking) => ranking.id)
  const entriesByRanking = new Map<string, HomeFeaturedEntry[]>()

  if (selectedIds.length > 0) {
    const { data: entryRows } = await supabase
      .from('ranking_entries')
      .select('ranking_id, position, reason, items!inner(id, title, slug, brand_or_creator, image_url, status, moderation_status, image_moderation_status)')
      .in('ranking_id', selectedIds)
      .lte('position', 3)
      .in('moderation_status', PUBLIC_MODERATION_STATUSES)
      .eq('items.status', 'active')
      .in('items.moderation_status', PUBLIC_MODERATION_STATUSES)
      .in('items.image_moderation_status', PUBLIC_MODERATION_STATUSES)
      .order('position', { ascending: true })

    for (const row of (entryRows || []) as any[]) {
      if (!row.items) continue
      const bucket = entriesByRanking.get(row.ranking_id) || []
      bucket.push({
        position: row.position,
        reason: row.reason || null,
        item: {
          id: row.items.id,
          title: row.items.title,
          slug: row.items.slug,
          brand_or_creator: row.items.brand_or_creator || null,
          image_url: row.items.image_url || null,
        },
      })
      entriesByRanking.set(row.ranking_id, bucket)
    }
  }

  const featuredSlides: HomeFeaturedSlide[] = selected.map((ranking) => {
    const entries = (entriesByRanking.get(ranking.id) || []).sort((a, b) => a.position - b.position)
    return {
      ...ranking,
      entries,
      visual_image_url: ranking.cover_image_url || entries.find((entry) => entry.item.image_url)?.item.image_url || null,
    }
  })

  const categoryCounts = new Map<string, number>()
  for (const row of categoryCountsResult.data || []) {
    if (!row.category_id) continue
    categoryCounts.set(row.category_id, (categoryCounts.get(row.category_id) || 0) + 1)
  }

  const categories: HomeCategory[] = ((categoriesResult.data || []) as any[]).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description || null,
    sort_order: category.sort_order || 0,
    ranking_count: categoryCounts.get(category.id) || 0,
  }))

  return {
    featuredSlides,
    recentRankings: candidates.slice(0, 8),
    categories,
  }
}

export async function getHomeLeadEntries(rankingId?: string | null): Promise<HomeLeadEntry[]> {
  if (!rankingId) return []

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('ranking_entries')
    .select('position, reason, items!inner(id, title, slug, brand_or_creator, status, moderation_status, image_moderation_status)')
    .eq('ranking_id', rankingId)
    .in('moderation_status', PUBLIC_MODERATION_STATUSES)
    .eq('items.status', 'active')
    .in('items.moderation_status', PUBLIC_MODERATION_STATUSES)
    .in('items.image_moderation_status', PUBLIC_MODERATION_STATUSES)
    .order('position', { ascending: true })
    .limit(3)

  return (data || []).map((row: any) => ({
    position: row.position,
    reason: row.reason || null,
    item: {
      id: row.items.id,
      title: row.items.title,
      slug: row.items.slug,
      brand_or_creator: row.items.brand_or_creator || null,
    },
  }))
}
