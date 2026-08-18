import { createPublicClient } from '@/lib/supabase/public'

export type SponsorshipPeriodState = 'upcoming' | 'current' | 'historical'

export type SponsorshipDisclosure = {
  id: string
  sponsor_name: string
  sponsor_website_url: string | null
  target_type: 'ranking' | 'item' | 'placement'
  ranking_id?: string | null
  item_id?: string | null
  relationship_type: string
  disclosure_text: string
  influence_scope: string
  influence_note: string | null
  starts_at: string
  ends_at: string | null
  published_at: string
  period_state: SponsorshipPeriodState
}

function parseDisclosures(value: unknown): SponsorshipDisclosure[] {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is SponsorshipDisclosure => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false
    const item = row as Record<string, unknown>
    return typeof item.id === 'string'
      && typeof item.sponsor_name === 'string'
      && ['ranking', 'item', 'placement'].includes(String(item.target_type))
      && typeof item.relationship_type === 'string'
      && typeof item.disclosure_text === 'string'
      && typeof item.influence_scope === 'string'
      && typeof item.starts_at === 'string'
      && typeof item.published_at === 'string'
      && ['upcoming', 'current', 'historical'].includes(String(item.period_state))
  })
}

export async function getRankingSponsorshipDisclosures(rankingId: string) {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_ranking_sponsorship_disclosures', {
    p_ranking_id: rankingId,
  })
  if (error) {
    console.error('Failed to load ranking sponsorship disclosures:', error)
    return []
  }
  return parseDisclosures(data)
}

export async function getItemSponsorshipDisclosures(itemId: string) {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_item_sponsorship_disclosures', {
    p_item_id: itemId,
  })
  if (error) {
    console.error('Failed to load item sponsorship disclosures:', error)
    return []
  }
  return parseDisclosures(data)
}
