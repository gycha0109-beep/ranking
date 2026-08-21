export const SUBJECT_CONTEXT_MIN_SHARED_ITEMS = 2
export const SUBJECT_CONTEXT_MIN_ITEM_JACCARD = 0.25
export const SUBJECT_CONTEXT_MIN_SUPPORTING_RANKINGS = 2
export const SUBJECT_CONTEXT_SUGGESTION_LIMIT = 1

export type RankingSubjectContextCurrent = {
  ranking_id: string
  subcategory_id: string | null
  item_ids: string[]
}

export type RankingSubjectContextProjection = {
  ranking_id: string
  subject_key: string
  subcategory_id: string | null
  item_ids: string[]
}

export type RankingSubjectContextSuggestion = {
  subject_key: string
  supporting_ranking_count: number
  max_shared_item_count: number
  max_item_jaccard: number
  reason: 'repeated_item_neighborhood'
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function overlap(left: string[], right: string[]) {
  const leftSet = new Set(unique(left))
  const rightSet = new Set(unique(right))
  let shared = 0

  for (const item of leftSet) {
    if (rightSet.has(item)) shared += 1
  }

  const union = leftSet.size + rightSet.size - shared
  return {
    shared,
    jaccard: union > 0 ? shared / union : 0,
  }
}

export function rankRankingSubjectContextSuggestions(
  current: RankingSubjectContextCurrent,
  projections: RankingSubjectContextProjection[]
): RankingSubjectContextSuggestion[] {
  const currentItems = unique(current.item_ids)
  if (!current.subcategory_id || currentItems.length < SUBJECT_CONTEXT_MIN_SHARED_ITEMS) return []

  const supportBySubject = new Map<string, {
    rankingIds: Set<string>
    maxShared: number
    maxJaccard: number
  }>()

  for (const projection of projections) {
    if (!projection.subject_key || projection.ranking_id === current.ranking_id) continue
    if (!projection.subcategory_id || projection.subcategory_id !== current.subcategory_id) continue

    const candidateItems = unique(projection.item_ids)
    if (candidateItems.length < SUBJECT_CONTEXT_MIN_SHARED_ITEMS) continue

    const { shared, jaccard } = overlap(currentItems, candidateItems)
    if (shared < SUBJECT_CONTEXT_MIN_SHARED_ITEMS) continue
    if (jaccard < SUBJECT_CONTEXT_MIN_ITEM_JACCARD) continue

    const support = supportBySubject.get(projection.subject_key) || {
      rankingIds: new Set<string>(),
      maxShared: 0,
      maxJaccard: 0,
    }

    support.rankingIds.add(projection.ranking_id)
    support.maxShared = Math.max(support.maxShared, shared)
    support.maxJaccard = Math.max(support.maxJaccard, jaccard)
    supportBySubject.set(projection.subject_key, support)
  }

  // A graph fallback is allowed only when the qualifying neighborhood points to exactly
  // one Subject. Even a single competing Subject is enough to force abstention.
  if (supportBySubject.size !== 1) return []

  const [subjectKey, support] = [...supportBySubject.entries()][0]
  if (support.rankingIds.size < SUBJECT_CONTEXT_MIN_SUPPORTING_RANKINGS) return []

  return [{
    subject_key: subjectKey,
    supporting_ranking_count: support.rankingIds.size,
    max_shared_item_count: support.maxShared,
    max_item_jaccard: support.maxJaccard,
    reason: 'repeated_item_neighborhood' as const,
  }].slice(0, SUBJECT_CONTEXT_SUGGESTION_LIMIT)
}
