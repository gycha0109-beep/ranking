'use server'

import {
  isDiscoveryEligibleProjection,
  type RankingSemanticProjection,
} from '@/lib/ranking-identity'
import {
  rankRankingSubjectContextSuggestions,
  type RankingSubjectContextProjection,
  type RankingSubjectContextSuggestion,
} from '@/lib/ranking-subject-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const SUBJECT_CONTEXT_PROJECTION_LIMIT = 500
const SUBJECT_CONTEXT_ENTRY_LIMIT = 5000
const CURRENT_RANKING_ITEM_LIMIT = 100

async function ensureAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (!roleData) throw new Error('관리자 권한이 없습니다.')
}

function numericConfidence(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export async function getRankingSubjectContextSuggestions(
  rankingId: string
): Promise<RankingSubjectContextSuggestion[]> {
  await ensureAdmin()
  const admin = createAdminClient()

  const [currentRankingResult, currentEntryResult, projectionResult] = await Promise.all([
    admin
      .from('rankings')
      .select('id, subcategory_id')
      .eq('id', rankingId)
      .maybeSingle(),
    admin
      .from('ranking_entries')
      .select('item_id')
      .eq('ranking_id', rankingId)
      .not('item_id', 'is', null)
      .limit(CURRENT_RANKING_ITEM_LIMIT),
    admin
      .from('ranking_semantic_projections')
      .select('ranking_id, subject_key, classification_state, confidence')
      .order('ranking_id', { ascending: true })
      .limit(SUBJECT_CONTEXT_PROJECTION_LIMIT),
  ])

  if (currentRankingResult.error || !currentRankingResult.data) {
    throw new Error('랭킹 문서를 찾을 수 없습니다.')
  }
  if (currentEntryResult.error) {
    throw new Error(`현재 랭킹 Item context 조회 실패: ${currentEntryResult.error.message}`)
  }
  if (projectionResult.error) {
    throw new Error(`Semantic context 후보 조회 실패: ${projectionResult.error.message}`)
  }

  const eligibleProjectionRows = (projectionResult.data || []).filter(row => {
    const projection: RankingSemanticProjection = {
      subject_key: row.subject_key,
      classification_state: row.classification_state,
      confidence: numericConfidence(row.confidence),
    }
    return isDiscoveryEligibleProjection(projection)
  })

  const candidateRankingIds = [...new Set(
    eligibleProjectionRows
      .map(row => row.ranking_id)
      .filter((value): value is string => Boolean(value) && value !== rankingId)
  )]

  if (candidateRankingIds.length === 0) return []

  const [candidateRankingResult, candidateEntryResult] = await Promise.all([
    admin
      .from('rankings')
      .select('id, subcategory_id, status')
      .in('id', candidateRankingIds)
      .limit(SUBJECT_CONTEXT_PROJECTION_LIMIT),
    admin
      .from('ranking_entries')
      .select('ranking_id, item_id')
      .in('ranking_id', candidateRankingIds)
      .not('item_id', 'is', null)
      .limit(SUBJECT_CONTEXT_ENTRY_LIMIT),
  ])

  if (candidateRankingResult.error) {
    throw new Error(`Semantic context 랭킹 조회 실패: ${candidateRankingResult.error.message}`)
  }
  if (candidateEntryResult.error) {
    throw new Error(`Semantic context Item 조회 실패: ${candidateEntryResult.error.message}`)
  }

  const rankingMeta = new Map<string, { subcategory_id: string | null; status: string }>()
  for (const row of candidateRankingResult.data || []) {
    if (!row.id) continue
    rankingMeta.set(row.id, {
      subcategory_id: row.subcategory_id || null,
      status: row.status || 'unknown',
    })
  }

  const itemIdsByRanking = new Map<string, string[]>()
  for (const row of candidateEntryResult.data || []) {
    if (!row.ranking_id || !row.item_id) continue
    const current = itemIdsByRanking.get(row.ranking_id) || []
    current.push(row.item_id)
    itemIdsByRanking.set(row.ranking_id, current)
  }

  const contextProjections: RankingSubjectContextProjection[] = []
  for (const row of eligibleProjectionRows) {
    if (!row.ranking_id || !row.subject_key || row.ranking_id === rankingId) continue
    const meta = rankingMeta.get(row.ranking_id)
    if (!meta || meta.status === 'archived') continue

    contextProjections.push({
      ranking_id: row.ranking_id,
      subject_key: row.subject_key,
      subcategory_id: meta.subcategory_id,
      item_ids: itemIdsByRanking.get(row.ranking_id) || [],
    })
  }

  return rankRankingSubjectContextSuggestions({
    ranking_id: rankingId,
    subcategory_id: currentRankingResult.data.subcategory_id || null,
    item_ids: (currentEntryResult.data || [])
      .map(row => row.item_id)
      .filter((value): value is string => Boolean(value)),
  }, contextProjections)
}
