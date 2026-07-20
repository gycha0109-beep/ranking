'use server'

import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('로그인이 필요합니다.')

  const { data: role, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()
  if (roleError || !role) throw new Error('관리자 권한이 없습니다.')
  return supabase
}

export async function getRankingModerationWorkspace(rankingId: string) {
  try {
    const supabase = await requireAdmin()
    const { data: ranking, error } = await supabase
      .from('rankings')
      .select(`
        id, title, cover_image_url, moderation_status, moderation_reason,
        image_moderation_status, image_moderation_reason,
        ranking_entries(
          id, position, reason, moderation_status, moderation_reason,
          items(id, title, image_url, moderation_status, moderation_reason, image_moderation_status, image_moderation_reason)
        )
      `)
      .eq('id', rankingId)
      .maybeSingle()

    if (error || !ranking) return { error: error?.message || '랭킹을 찾을 수 없습니다.', targets: [], reviews: [] }

    const targets: Array<{
      entityType: 'ranking' | 'ranking_entry' | 'item' | 'ranking_image' | 'item_image'
      entityId: string
      label: string
      status: string
      reason: string
      sharedWarning?: boolean
      imageUrl?: string | null
    }> = [
      {
        entityType: 'ranking', entityId: ranking.id, label: '랭킹 본문',
        status: ranking.moderation_status, reason: ranking.moderation_reason,
      },
      {
        entityType: 'ranking_image', entityId: ranking.id, label: '랭킹 커버 이미지',
        status: ranking.image_moderation_status, reason: ranking.image_moderation_reason,
        imageUrl: ranking.cover_image_url,
      },
    ]

    const entityIds = new Set<string>([ranking.id])
    for (const entry of ranking.ranking_entries || []) {
      targets.push({
        entityType: 'ranking_entry', entityId: entry.id,
        label: `${entry.position}위 선정 사유`, status: entry.moderation_status, reason: entry.moderation_reason,
      })
      entityIds.add(entry.id)
      const item = Array.isArray(entry.items) ? entry.items[0] : entry.items
      if (item) {
        targets.push({
          entityType: 'item', entityId: item.id, label: `${entry.position}위 아이템: ${item.title}`,
          status: item.moderation_status, reason: item.moderation_reason, sharedWarning: true,
        })
        targets.push({
          entityType: 'item_image', entityId: item.id, label: `${entry.position}위 아이템 이미지: ${item.title}`,
          status: item.image_moderation_status, reason: item.image_moderation_reason,
          sharedWarning: true, imageUrl: item.image_url,
        })
        entityIds.add(item.id)
      }
    }

    const { data: reviews, error: reviewError } = await supabase
      .from('moderation_reviews')
      .select('id, entity_type, entity_id, previous_status, previous_reason, decision_status, decision_reason, review_note, reviewed_by, reviewed_at, metadata')
      .in('entity_id', [...entityIds])
      .order('reviewed_at', { ascending: false })
      .limit(100)

    return { targets, reviews: reviewError ? [] : reviews || [], error: reviewError?.message }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Moderation 작업 공간을 불러오지 못했습니다.', targets: [], reviews: [] }
  }
}
