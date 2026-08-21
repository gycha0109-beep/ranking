export const SEMANTIC_SUBJECT_CANDIDATE_LIMIT = 40
export const SEMANTIC_DISCOVERY_CONFIDENCE_MIN = 0.90

export type RankingIdentityRelationKind =
  | 'same_version'
  | 'same_view'
  | 'same_claim'
  | 'same_subject'

export type RankingSemanticProjection = {
  ranking_id?: string | null
  subject_key?: string | null
  intent_key?: string | null
  coordinates?: Record<string, unknown> | null
  method_key?: string | null
  version_coordinates?: Record<string, unknown> | null
  classification_state?: 'inferred' | 'reviewed' | string | null
  confidence?: number | null
  projection_version?: string | null
  claim_signature?: string | null
  view_signature?: string | null
  version_signature?: string | null
}

export type DiscoveryEligibleRankingProjection = RankingSemanticProjection & {
  subject_key: string
}

export type RankingIdentityRelation = {
  kind: RankingIdentityRelationKind
  priority: number
}

const RELATION_PRIORITY: Record<RankingIdentityRelationKind, number> = {
  same_version: 1,
  same_view: 2,
  same_claim: 3,
  same_subject: 4,
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isDiscoveryEligibleProjection(
  projection?: RankingSemanticProjection | null
): projection is DiscoveryEligibleRankingProjection {
  if (!projection || !nonEmpty(projection.subject_key)) return false
  if (projection.classification_state === 'reviewed') return true
  return typeof projection.confidence === 'number'
    && projection.confidence >= SEMANTIC_DISCOVERY_CONFIDENCE_MIN
}

export function classifyRankingIdentity(
  current?: RankingSemanticProjection | null,
  candidate?: RankingSemanticProjection | null
): RankingIdentityRelation | null {
  if (!isDiscoveryEligibleProjection(current)) return null
  if (!isDiscoveryEligibleProjection(candidate)) return null
  if (current.subject_key !== candidate.subject_key) return null

  if (
    nonEmpty(current.version_signature) &&
    nonEmpty(candidate.version_signature) &&
    current.version_signature === candidate.version_signature
  ) {
    return { kind: 'same_version', priority: RELATION_PRIORITY.same_version }
  }

  if (
    nonEmpty(current.view_signature) &&
    nonEmpty(candidate.view_signature) &&
    current.view_signature === candidate.view_signature
  ) {
    return { kind: 'same_view', priority: RELATION_PRIORITY.same_view }
  }

  if (
    nonEmpty(current.claim_signature) &&
    nonEmpty(candidate.claim_signature) &&
    current.claim_signature === candidate.claim_signature
  ) {
    return { kind: 'same_claim', priority: RELATION_PRIORITY.same_claim }
  }

  return { kind: 'same_subject', priority: RELATION_PRIORITY.same_subject }
}

export function compareRankingIdentityRelations(
  left: RankingIdentityRelation,
  right: RankingIdentityRelation
) {
  return left.priority - right.priority
}

export function explainRankingIdentity(relation: RankingIdentityRelation) {
  switch (relation.kind) {
    case 'same_version':
      return '같은 랭킹 정의 · 동일 시점'
    case 'same_view':
      return '같은 랭킹 시리즈 · 다른 시점'
    case 'same_claim':
      return '같은 랭킹 질문 · 다른 산정 방식'
    case 'same_subject':
      return '같은 주제 · 다른 조건'
  }
}
