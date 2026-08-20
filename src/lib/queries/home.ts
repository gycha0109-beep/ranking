import { createPublicClient } from '@/lib/supabase/public'

const PUBLIC_MODERATION_STATUSES = ['clean', 'suggestive']

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
