export const ITEM_JACCARD_MIN = 0.30
export const LEXICAL_JACCARD_MIN = 0.30
export const RELATED_RANKING_LIMIT = 6
export const SAME_SUBCATEGORY_CANDIDATE_LIMIT = 40
export const SHARED_ITEM_CANDIDATE_ROW_LIMIT = 120

const BOILERPLATE_TOKENS = new Set(['top', 'best', '랭킹', '순위'])

export type RankingNeighborTier = 'A' | 'B' | 'C' | 'D'

export type RankingNeighborhoodNode = {
  id: string
  categoryId: string | null
  subcategoryId: string | null
  title: string
  itemIds: readonly unknown[]
  publishedAt?: string | null
}

export type RankingNeighborRelation = {
  candidateId: string
  tier: RankingNeighborTier
  itemJaccard: number
  lexicalJaccard: number
  sharedItemCount: number
  sameCategory: boolean
  sameSubcategory: boolean
  publishedAt: string | null
}

function toUniqueSet(values: readonly unknown[]) {
  return new Set(
    values.filter((value): value is string => typeof value === 'string' && value.length > 0)
  )
}

function setJaccard(left: Set<string>, right: Set<string>) {
  if (left.size === 0 && right.size === 0) return 0

  let intersection = 0
  for (const value of left) {
    if (right.has(value)) intersection += 1
  }

  const union = left.size + right.size - intersection
  return union > 0 ? intersection / union : 0
}

function sharedCount(left: Set<string>, right: Set<string>) {
  let count = 0
  for (const value of left) {
    if (right.has(value)) count += 1
  }
  return count
}

export function normalizeRankingTokens(title: string) {
  const normalized = title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')

  return [...new Set(
    normalized
      .split(/\s+/)
      .map(token => token.trim())
      .filter(Boolean)
      .filter(token => !/^\d+$/.test(token))
      .filter(token => !/^\d{4}년$/.test(token))
      .filter(token => !/^\d{1,2}월$/.test(token))
      .filter(token => !BOILERPLATE_TOKENS.has(token))
  )]
}

export function calculateItemJaccard(leftItemIds: readonly unknown[], rightItemIds: readonly unknown[]) {
  return setJaccard(toUniqueSet(leftItemIds), toUniqueSet(rightItemIds))
}

export function calculateLexicalJaccard(leftTitle: string, rightTitle: string) {
  return setJaccard(
    new Set(normalizeRankingTokens(leftTitle)),
    new Set(normalizeRankingTokens(rightTitle))
  )
}

export function isSameNonNullSubcategory(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left === right)
}

export function classifyRankingNeighbor(
  current: RankingNeighborhoodNode,
  candidate: RankingNeighborhoodNode
): RankingNeighborRelation | null {
  if (!current.id || !candidate.id || current.id === candidate.id) return null

  const currentItems = toUniqueSet(current.itemIds)
  const candidateItems = toUniqueSet(candidate.itemIds)
  const itemJaccard = setJaccard(currentItems, candidateItems)
  const lexicalJaccard = calculateLexicalJaccard(current.title, candidate.title)
  const sharedItemCount = sharedCount(currentItems, candidateItems)
  const sameCategory = Boolean(current.categoryId && candidate.categoryId && current.categoryId === candidate.categoryId)
  const sameSubcategory = isSameNonNullSubcategory(current.subcategoryId, candidate.subcategoryId)

  let tier: RankingNeighborTier | null = null

  if (sameSubcategory && itemJaccard >= ITEM_JACCARD_MIN && lexicalJaccard >= LEXICAL_JACCARD_MIN) {
    tier = 'A'
  } else if (sameSubcategory && itemJaccard >= ITEM_JACCARD_MIN) {
    tier = 'B'
  } else if (sameSubcategory && lexicalJaccard >= LEXICAL_JACCARD_MIN) {
    tier = 'C'
  } else if (sameCategory && itemJaccard >= ITEM_JACCARD_MIN) {
    tier = 'D'
  }

  if (!tier) return null

  return {
    candidateId: candidate.id,
    tier,
    itemJaccard,
    lexicalJaccard,
    sharedItemCount,
    sameCategory,
    sameSubcategory,
    publishedAt: candidate.publishedAt || null,
  }
}

const TIER_ORDER: Record<RankingNeighborTier, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
}

function publishedTime(value: string | null) {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

export function compareRankingNeighbors(left: RankingNeighborRelation, right: RankingNeighborRelation) {
  const tierDiff = TIER_ORDER[left.tier] - TIER_ORDER[right.tier]
  if (tierDiff !== 0) return tierDiff

  if (left.itemJaccard !== right.itemJaccard) return right.itemJaccard - left.itemJaccard
  if (left.lexicalJaccard !== right.lexicalJaccard) return right.lexicalJaccard - left.lexicalJaccard
  if (left.sharedItemCount !== right.sharedItemCount) return right.sharedItemCount - left.sharedItemCount

  const publishedDiff = publishedTime(right.publishedAt) - publishedTime(left.publishedAt)
  if (publishedDiff !== 0) return publishedDiff

  return left.candidateId.localeCompare(right.candidateId)
}

export function explainRankingNeighbor(relation: RankingNeighborRelation, subcategoryLabel?: string | null) {
  const sameSubcategoryLabel = subcategoryLabel ? `같은 ${subcategoryLabel}` : '같은 세부 분류'

  if (relation.tier === 'A' || relation.tier === 'B') {
    return `${sameSubcategoryLabel} · ${relation.sharedItemCount}개 항목 공통`
  }

  if (relation.tier === 'C') {
    return sameSubcategoryLabel
  }

  return `${relation.sharedItemCount}개 항목 공통`
}
