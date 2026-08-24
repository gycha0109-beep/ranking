import { classifyRankingNeighbor } from '@/lib/ranking-neighborhood'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Rf1RelatedCandidateEvidence, Rf1RelatedExposureRecord, Rf1IdentityRelationKind } from './rf1-related-adapter'

const IDENTITY_RELATIONS = new Set<Rf1IdentityRelationKind>([
  'same_version',
  'same_view',
  'same_claim',
  'same_subject',
])

type CurrentRankingForRf1 = {
  id: string
  category_id?: string | null
  subcategory_id?: string | null
  title?: string | null
  published_at?: string | null
  updated_at?: string | null
  created_at?: string | null
  entries?: Array<{ item_id?: string | null }>
}

type RelatedRankingForRf1 = {
  id: string
  category_id?: string | null
  subcategory_id?: string | null
  ranking_type?: string | null
  title?: string | null
  published_at?: string | null
  updated_at?: string | null
  created_at?: string | null
  related_identity_relation?: string | null
}

type CandidateSignalRow = {
  ranking_id: string
  item_ids: string[] | null
  unique_view_count: number | string | null
  like_count: number | string | null
  bookmark_count: number | string | null
  recent_exposure_count: number | string | null
}

function requiredTrimmed(value: unknown, label: string) {
  if (typeof value !== 'string' || !value || value.trim() !== value) {
    throw new Error(`${label} must be a non-empty trimmed string`)
  }
  return value
}

function parseIdentityRelation(value: unknown): Rf1IdentityRelationKind | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !IDENTITY_RELATIONS.has(value as Rf1IdentityRelationKind)) {
    throw new Error(`unsupported IA-2 identity relation: ${String(value)}`)
  }
  return value as Rf1IdentityRelationKind
}

function safeCount(value: unknown, label: string) {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative safe integer`)
  return parsed
}

function publicationTime(row: RelatedRankingForRf1) {
  const value = row.published_at || row.updated_at || row.created_at
  if (!value || !Number.isFinite(Date.parse(value))) throw new Error(`related ranking ${row.id} is missing a valid publication timestamp`)
  return new Date(value).toISOString()
}

function currentItemIds(ranking: CurrentRankingForRf1) {
  return [...new Set(
    (ranking.entries || [])
      .map((entry) => entry.item_id)
      .filter((itemId): itemId is string => typeof itemId === 'string' && itemId.length > 0)
  )].sort()
}

export async function loadRf1RelatedCandidateEvidence(input: {
  currentRanking: CurrentRankingForRf1
  relatedRankings: RelatedRankingForRf1[]
  exposureSince: string
}): Promise<Rf1RelatedCandidateEvidence[]> {
  if (input.relatedRankings.length === 0) return []
  if (!Number.isFinite(Date.parse(input.exposureSince))) throw new Error('RF-1 exposureSince must be an ISO-compatible timestamp')

  const currentRankingId = requiredTrimmed(input.currentRanking.id, 'current ranking ID')
  const currentCategoryId = input.currentRanking.category_id || null
  const currentSubcategoryId = input.currentRanking.subcategory_id || null
  const currentTitle = input.currentRanking.title || ''
  const currentItems = currentItemIds(input.currentRanking)
  const rankingIds = input.relatedRankings.map((ranking) => requiredTrimmed(ranking.id, 'related ranking ID'))

  if (new Set(rankingIds).size !== rankingIds.length) throw new Error('RF-1 related ranking IDs must be unique')

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_rf1_candidate_signals', {
    p_ranking_ids: rankingIds,
    p_exposure_since: new Date(input.exposureSince).toISOString(),
  })
  if (error) throw new Error(`failed to hydrate RF-1 candidate signals: ${error.message}`)

  const signalsByRankingId = new Map<string, CandidateSignalRow>()
  for (const rawRow of (data || []) as CandidateSignalRow[]) {
    const rankingId = requiredTrimmed(rawRow.ranking_id, 'candidate signal ranking ID')
    if (signalsByRankingId.has(rankingId)) throw new Error(`duplicate RF-1 candidate signal row: ${rankingId}`)
    signalsByRankingId.set(rankingId, rawRow)
  }

  return input.relatedRankings.map((ranking, index) => {
    const rankingId = requiredTrimmed(ranking.id, 'related ranking ID')
    const categoryId = requiredTrimmed(ranking.category_id, `related ranking ${rankingId} category_id`)
    const rankingType = requiredTrimmed(ranking.ranking_type, `related ranking ${rankingId} ranking_type`)
    const signal = signalsByRankingId.get(rankingId)
    if (!signal) throw new Error(`missing RF-1 candidate signal row for public related ranking ${rankingId}`)

    const itemIds = [...new Set((signal.item_ids || []).map((itemId) => requiredTrimmed(itemId, 'candidate item ID')))].sort()
    const relation = classifyRankingNeighbor(
      {
        id: currentRankingId,
        categoryId: currentCategoryId,
        subcategoryId: currentSubcategoryId,
        title: currentTitle,
        itemIds: currentItems,
        publishedAt: input.currentRanking.published_at || input.currentRanking.updated_at || input.currentRanking.created_at || null,
      },
      {
        id: rankingId,
        categoryId,
        subcategoryId: ranking.subcategory_id || null,
        title: ranking.title || '',
        itemIds,
        publishedAt: publicationTime(ranking),
      }
    )

    const identityRelation = parseIdentityRelation(ranking.related_identity_relation)
    if (!identityRelation && !relation) {
      throw new Error(`related ranking ${rankingId} has neither IA-2 identity evidence nor contextual Neighborhood evidence`)
    }

    return {
      sourceRank: index + 1,
      rankingId,
      identityRelation,
      contextualNeighborhood: relation
        ? {
            tier: relation.tier,
            itemJaccard: relation.itemJaccard,
            lexicalJaccard: relation.lexicalJaccard,
          }
        : null,
      categoryId,
      subcategoryId: ranking.subcategory_id || null,
      rankingType,
      itemIds,
      publishedAt: publicationTime(ranking),
      uniqueViewCount: safeCount(signal.unique_view_count, 'uniqueViewCount'),
      likeCount: safeCount(signal.like_count, 'likeCount'),
      bookmarkCount: safeCount(signal.bookmark_count, 'bookmarkCount'),
      recentExposureCount: safeCount(signal.recent_exposure_count, 'recentExposureCount'),
    }
  })
}

export async function recordRf1RelatedExposureRecords(records: Rf1RelatedExposureRecord[]) {
  if (records.length === 0) throw new Error('RF-1 exposure persistence requires at least one record')

  const payload = records.map((record) => ({
    exposure_id: record.exposureId,
    recommendation_run_id: record.recommendationRunId,
    surface: record.surface,
    source_ranking_id: record.sourceRankingId,
    ranking_id: record.rankingId,
    ranking_mode: record.rankingMode,
    identity_relation: record.identityRelation,
    source_rank: record.sourceRank,
    final_rank: record.finalRank,
    policy_bundle_version: record.policyBundleVersion,
    profile_version: record.profileVersion,
    profile_fingerprint: record.profileFingerprint,
    session_fingerprint: record.sessionFingerprint,
    score_breakdown: record.scoreBreakdown,
    explored: record.explored,
    diversity_relaxations: record.diversityRelaxations,
    exposed_at: record.exposedAt,
  }))

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('record_rf1_recommendation_exposures', {
    p_records: payload,
  })
  if (error) throw new Error(`failed to persist RF-1 exposure evidence: ${error.message}`)
  return data
}
