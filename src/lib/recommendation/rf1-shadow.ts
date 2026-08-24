import { getRelatedRankings } from '@/lib/queries/public'
import {
  buildRf1BehaviorProfile,
  buildRf1SessionInterest,
  rankRf1Feed,
  validateRf1PolicyBundle,
  type Rf1BehaviorEvent,
  type Rf1PolicyBundle,
} from './rf1-core'
import {
  mergeRf1RelatedRankingResult,
  planRf1RelatedCandidates,
  toRf1FeedCandidates,
} from './rf1-related-adapter'
import { loadRf1RelatedCandidateEvidence } from './rf1-related-server'
import { loadOptionalMyRf1ProfileEvents } from './rf1-profile-server'

export type Rf1ShadowResult = {
  mode: 'SHADOW'
  baselineRankingIds: string[]
  shadowRankingIds: string[]
  changedPositionCount: number
  protectedIdentityCount: number
  profileMaturity: 'EMPTY' | 'EMERGING' | 'ESTABLISHED'
  profileFingerprint: string
  sessionFingerprint: string | null
  policyBundleVersion: string
  referenceTime: string
  seed: string
}

function parseReferenceTime(value: string) {
  const millis = Date.parse(value)
  if (!Number.isFinite(millis)) throw new Error('RF-1 SHADOW referenceTime must be an ISO-compatible timestamp')
  return millis
}

export async function runRf1RelatedShadow(input: {
  currentRanking: any
  referenceTime: string
  seed: string
  policy: Rf1PolicyBundle
  sessionEvents?: Rf1BehaviorEvent[]
  profileEventLimit?: number
}): Promise<Rf1ShadowResult> {
  if (!input.currentRanking?.id) throw new Error('RF-1 SHADOW requires a current ranking')
  if (!input.seed || input.seed.trim() !== input.seed) throw new Error('RF-1 SHADOW seed must be a non-empty trimmed string')

  const policy = validateRf1PolicyBundle(input.policy)
  const referenceMs = parseReferenceTime(input.referenceTime)
  const referenceTime = new Date(referenceMs).toISOString()
  const profileSince = new Date(referenceMs - policy.behavior.lookbackMs).toISOString()
  const exposureSince = new Date(referenceMs - policy.score.lowExposureWindowMs).toISOString()
  const requestedProfileLimit = input.profileEventLimit ?? policy.behavior.maximumEvents
  if (!Number.isInteger(requestedProfileLimit) || requestedProfileLimit < 1) {
    throw new Error('RF-1 SHADOW profileEventLimit must be a positive integer')
  }
  const profileEventLimit = Math.min(requestedProfileLimit, policy.behavior.maximumEvents, 1000)

  const [relatedRankings, profileEvents] = await Promise.all([
    getRelatedRankings(input.currentRanking),
    loadOptionalMyRf1ProfileEvents({
      since: profileSince,
      limit: profileEventLimit,
    }),
  ])

  const profile = buildRf1BehaviorProfile(
    profileEvents,
    referenceTime,
    policy.behavior,
    policy.maturity,
  )

  const sessionEvents = input.sessionEvents || []
  const session = sessionEvents.length > 0
    ? buildRf1SessionInterest(sessionEvents, referenceTime, policy.sessionBehavior)
    : null

  const evidence = relatedRankings.length > 0
    ? await loadRf1RelatedCandidateEvidence({
        currentRanking: input.currentRanking,
        relatedRankings,
        exposureSince,
      })
    : []

  const plan = planRf1RelatedCandidates(evidence)
  const reranked = rankRf1Feed({
    candidates: toRf1FeedCandidates(plan),
    profile,
    session,
    referenceTime,
    seed: input.seed,
    policy,
  })
  const shadow = mergeRf1RelatedRankingResult(plan, reranked)

  const baselineRankingIds = relatedRankings.map((ranking: any) => String(ranking.id))
  const shadowRankingIds = shadow.candidates.map((candidate) => candidate.rankingId)
  if (baselineRankingIds.length !== shadowRankingIds.length) {
    throw new Error('RF-1 SHADOW must preserve the complete existing related-ranking candidate set')
  }

  const changedPositionCount = shadowRankingIds.reduce((count, rankingId, index) => (
    count + (baselineRankingIds[index] === rankingId ? 0 : 1)
  ), 0)

  return {
    mode: 'SHADOW',
    baselineRankingIds,
    shadowRankingIds,
    changedPositionCount,
    protectedIdentityCount: plan.protectedIdentity.length,
    profileMaturity: profile.maturity,
    profileFingerprint: profile.fingerprint,
    sessionFingerprint: session?.fingerprint ?? null,
    policyBundleVersion: policy.policyBundleVersion,
    referenceTime,
    seed: input.seed,
  }
}
