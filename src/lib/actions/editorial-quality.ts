'use server'

import { createClient } from '@/lib/supabase/server'
import { publishRanking } from '@/lib/actions/admin'

export type EditorialBlocker = {
  code: string
  message: string
}

export type RankingEditorialReadiness = {
  ranking_id: string
  ranking_status: string
  editorial_ready: boolean
  blockers: EditorialBlocker[]
  entry_count: number
  criteria_count: number
  public_source_count: number
  expected_entry_count: number | null
}

export async function getRankingEditorialReadiness(rankingId?: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_get_ranking_editorial_readiness', {
    p_ranking_id: rankingId || null,
  })

  if (error) {
    return { error: error.message, data: [] as RankingEditorialReadiness[] }
  }

  return { data: (data || []) as RankingEditorialReadiness[] }
}

export async function publishRankingWithEditorialGate(id: string) {
  const readinessResult = await getRankingEditorialReadiness(id)
  if (readinessResult.error) {
    return { error: `발행 품질 상태를 확인할 수 없습니다: ${readinessResult.error}` }
  }

  const readiness = readinessResult.data[0]
  if (!readiness) {
    return { error: '발행 품질 상태를 찾을 수 없습니다.' }
  }

  if (!readiness.editorial_ready) {
    const messages = readiness.blockers.map((blocker) => blocker.message).join(' / ')
    return { error: `OPS-1 발행 품질 기준을 충족하지 못했습니다: ${messages}` }
  }

  return publishRanking(id)
}
