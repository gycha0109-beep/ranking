import type {
  Rf1BehaviorProfileSnapshot,
  Rf1FeedCandidate,
  Rf1RankingResult,
  Rf1ScoreBreakdown,
  Rf1SessionInterestSnapshot,
} from './rf1-core'

export type Rf1IdentityRelationKind =
  | 'same_version'
  | 'same_view'
  | 'same_claim'
  | 'same_subject'

export type Rf1ContextualNeighborhoodEvidence = {
  tier: 'A' | 'B' | 'C' | 'D'
  itemJaccard: number
  lexicalJaccard: number
}

export type Rf1RelatedCandidateEvidence = {
  sourceRank: number
  rankingId: string
  identityRelation: Rf1IdentityRelationKind | null
  contextualNeighborhood: Rf1ContextualNeighborhoodEvidence | null
  categoryId: string
  subcategoryId: string | null
  rankingType: string
  itemIds: string[]
  publishedAt: string
  uniqueViewCount: number
  likeCount: number
  bookmarkCount: number
  recentExposureCount: number
}

export type Rf1RelatedCandidatePlan = {
  protectedIdentity: Rf1RelatedCandidateEvidence[]
  rerankable: Rf1RelatedCandidateEvidence[]
}

export type Rf1RelatedRankedCandidate = {
  rankingId: string
  sourceRank: number
  finalRank: number
  mode: 'IA2_PROTECTED' | 'RF1_RERANKED'
  identityRelation: Rf1IdentityRelationKind | null
  breakdown: Rf1ScoreBreakdown | null
  explored: boolean
  diversityRelaxations: string[]
}

export type Rf1RelatedRankingResult = {
  policyBundleVersion: string
  profileFingerprint: string
  sessionFingerprint: string | null
  referenceTime: string
  seed: string
  candidates: Rf1RelatedRankedCandidate[]
}

export type Rf1RelatedExposureRecord = {
  exposureId: string
  recommendationRunId: string
  surface: 'related_rankings'
  sourceRankingId: string
  rankingId: string
  rankingMode: 'IA2_PROTECTED' | 'RF1_RERANKED'
  identityRelation: Rf1IdentityRelationKind | null
  sourceRank: number
  finalRank: number
  policyBundleVersion: string
  profileVersion: string
  profileFingerprint: string
  sessionFingerprint: string | null
  scoreBreakdown: Rf1ScoreBreakdown | null
  explored: boolean
  diversityRelaxations: string[]
  exposedAt: string
}

const IDENTITY_RELATIONS = new Set<Rf1IdentityRelationKind>([
  'same_version',
  'same_view',
  'same_claim',
  'same_subject',
])

function assertTrimmed(value: string, label: string) {
  if (!value || value.trim() !== value) throw new Error(`${label} must be a non-empty trimmed string`)
}

function assertSafeCount(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`)
}

function assertUnit(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be within [0, 1]`)
}

function validateEvidence(evidence: Rf1RelatedCandidateEvidence, expectedRank: number) {
  if (evidence.sourceRank !== expectedRank) throw new Error('RF-1 related candidate source ranks must be contiguous and preserve source order')
  assertTrimmed(evidence.rankingId, 'rankingId')
  assertTrimmed(evidence.categoryId, 'categoryId')
  assertTrimmed(evidence.rankingType, 'rankingType')
  if (evidence.subcategoryId !== null) assertTrimmed(evidence.subcategoryId, 'subcategoryId')
  if (!Number.isFinite(Date.parse(evidence.publishedAt))) throw new Error('publishedAt must be an ISO-compatible timestamp')
  if (evidence.identityRelation !== null && !IDENTITY_RELATIONS.has(evidence.identityRelation)) {
    throw new Error('unsupported IA-2 identity relation')
  }
  if (evidence.contextualNeighborhood) {
    assertUnit(evidence.contextualNeighborhood.itemJaccard, 'itemJaccard')
    assertUnit(evidence.contextualNeighborhood.lexicalJaccard, 'lexicalJaccard')
  }
  for (const [index, itemId] of evidence.itemIds.entries()) assertTrimmed(itemId, `itemIds[${index}]`)
  assertSafeCount(evidence.uniqueViewCount, 'uniqueViewCount')
  assertSafeCount(evidence.likeCount, 'likeCount')
  assertSafeCount(evidence.bookmarkCount, 'bookmarkCount')
  assertSafeCount(evidence.recentExposureCount, 'recentExposureCount')
}

export function planRf1RelatedCandidates(evidence: Rf1RelatedCandidateEvidence[]): Rf1RelatedCandidatePlan {
  const seen = new Set<string>()
  let contextualSuffixStarted = false

  evidence.forEach((candidate, index) => {
    validateEvidence(candidate, index + 1)
    if (seen.has(candidate.rankingId)) throw new Error(`duplicate RF-1 related rankingId: ${candidate.rankingId}`)
    seen.add(candidate.rankingId)

    if (candidate.identityRelation !== null) {
      if (contextualSuffixStarted) {
        throw new Error('IA-2 protected candidates must remain a contiguous prefix before RF-1 reranking')
      }
    } else {
      contextualSuffixStarted = true
      if (!candidate.contextualNeighborhood) {
        throw new Error('non-IA2 related candidate requires contextual Neighborhood evidence')
      }
    }
  })

  const prefixLength = evidence.findIndex((candidate) => candidate.identityRelation === null)
  const protectedCount = prefixLength === -1 ? evidence.length : prefixLength

  return {
    protectedIdentity: evidence.slice(0, protectedCount),
    rerankable: evidence.slice(protectedCount),
  }
}

export function toRf1FeedCandidates(plan: Rf1RelatedCandidatePlan): Rf1FeedCandidate[] {
  return plan.rerankable.map((candidate) => {
    if (!candidate.contextualNeighborhood) throw new Error('contextual Neighborhood evidence is required for RF-1 reranking')
    return {
      rankingId: candidate.rankingId,
      categoryId: candidate.categoryId,
      subcategoryId: candidate.subcategoryId,
      rankingType: candidate.rankingType,
      itemIds: [...new Set(candidate.itemIds)].sort(),
      publishedAt: candidate.publishedAt,
      neighborhood: {
        tier: candidate.contextualNeighborhood.tier,
        itemJaccard: candidate.contextualNeighborhood.itemJaccard,
        lexicalJaccard: candidate.contextualNeighborhood.lexicalJaccard,
      },
      uniqueViewCount: candidate.uniqueViewCount,
      likeCount: candidate.likeCount,
      bookmarkCount: candidate.bookmarkCount,
      recentExposureCount: candidate.recentExposureCount,
    }
  })
}

export function mergeRf1RelatedRankingResult(
  plan: Rf1RelatedCandidatePlan,
  rerankedResult: Rf1RankingResult,
): Rf1RelatedRankingResult {
  const expectedIds = new Set(plan.rerankable.map((candidate) => candidate.rankingId))
  if (rerankedResult.candidates.length !== expectedIds.size) {
    throw new Error('RF-1 reranked result must preserve the complete contextual candidate set')
  }

  const sourceById = new Map(plan.rerankable.map((candidate) => [candidate.rankingId, candidate]))
  const resultIds = new Set<string>()

  const protectedCandidates: Rf1RelatedRankedCandidate[] = plan.protectedIdentity.map((candidate) => ({
    rankingId: candidate.rankingId,
    sourceRank: candidate.sourceRank,
    finalRank: candidate.sourceRank,
    mode: 'IA2_PROTECTED',
    identityRelation: candidate.identityRelation,
    breakdown: null,
    explored: false,
    diversityRelaxations: [],
  }))

  const rerankedCandidates = rerankedResult.candidates.map<Rf1RelatedRankedCandidate>((candidate) => {
    if (!expectedIds.has(candidate.rankingId)) throw new Error(`RF-1 reranked result contains unexpected rankingId: ${candidate.rankingId}`)
    if (resultIds.has(candidate.rankingId)) throw new Error(`RF-1 reranked result contains duplicate rankingId: ${candidate.rankingId}`)
    resultIds.add(candidate.rankingId)
    const source = sourceById.get(candidate.rankingId)
    if (!source) throw new Error(`missing RF-1 source evidence for rankingId: ${candidate.rankingId}`)

    return {
      rankingId: candidate.rankingId,
      sourceRank: source.sourceRank,
      finalRank: plan.protectedIdentity.length + candidate.finalRank,
      mode: 'RF1_RERANKED',
      identityRelation: null,
      breakdown: candidate.breakdown,
      explored: candidate.explored,
      diversityRelaxations: [...candidate.appliedRelaxations],
    }
  })

  for (const expectedId of expectedIds) {
    if (!resultIds.has(expectedId)) throw new Error(`RF-1 reranked result dropped rankingId: ${expectedId}`)
  }

  const candidates = [...protectedCandidates, ...rerankedCandidates]
  candidates.forEach((candidate, index) => {
    if (candidate.finalRank !== index + 1) throw new Error('RF-1 related final ranks must be contiguous after protected-prefix merge')
  })

  return {
    policyBundleVersion: rerankedResult.policyBundleVersion,
    profileFingerprint: rerankedResult.profileFingerprint,
    sessionFingerprint: rerankedResult.sessionFingerprint,
    referenceTime: rerankedResult.referenceTime,
    seed: rerankedResult.seed,
    candidates,
  }
}

export function createRf1RelatedExposureRecords(input: {
  recommendationRunId: string
  sourceRankingId: string
  profile: Pick<Rf1BehaviorProfileSnapshot, 'profileVersion' | 'fingerprint'>
  session: Pick<Rf1SessionInterestSnapshot, 'fingerprint'> | null
  result: Rf1RelatedRankingResult
  exposedAt: string
}): Rf1RelatedExposureRecord[] {
  assertTrimmed(input.recommendationRunId, 'recommendationRunId')
  assertTrimmed(input.sourceRankingId, 'sourceRankingId')
  assertTrimmed(input.profile.profileVersion, 'profileVersion')
  assertTrimmed(input.profile.fingerprint, 'profileFingerprint')
  if (input.session) assertTrimmed(input.session.fingerprint, 'sessionFingerprint')
  if (!Number.isFinite(Date.parse(input.exposedAt))) throw new Error('exposedAt must be an ISO-compatible timestamp')
  const exposedAt = new Date(input.exposedAt).toISOString()

  if (input.result.profileFingerprint !== input.profile.fingerprint) {
    throw new Error('RF-1 related exposure profile fingerprint must match ranking result')
  }
  if (input.result.sessionFingerprint !== (input.session?.fingerprint ?? null)) {
    throw new Error('RF-1 related exposure session fingerprint must match ranking result')
  }

  return input.result.candidates.map((candidate) => {
    if (candidate.rankingId === input.sourceRankingId) {
      throw new Error('RF-1 related exposure source ranking must differ from target ranking')
    }
    return {
      exposureId: `${input.recommendationRunId}:${candidate.rankingId}`,
      recommendationRunId: input.recommendationRunId,
      surface: 'related_rankings',
      sourceRankingId: input.sourceRankingId,
      rankingId: candidate.rankingId,
      rankingMode: candidate.mode,
      identityRelation: candidate.identityRelation,
      sourceRank: candidate.sourceRank,
      finalRank: candidate.finalRank,
      policyBundleVersion: input.result.policyBundleVersion,
      profileVersion: input.profile.profileVersion,
      profileFingerprint: input.profile.fingerprint,
      sessionFingerprint: input.session?.fingerprint ?? null,
      scoreBreakdown: candidate.breakdown,
      explored: candidate.explored,
      diversityRelaxations: [...candidate.diversityRelaxations],
      exposedAt,
    }
  })
}
