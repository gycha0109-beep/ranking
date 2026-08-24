export const RF1_BEHAVIOR_EVENT_TYPES = [
  'FEED_IMPRESSION',
  'RANKING_VIEW',
  'QUICK_SKIP',
  'DWELL',
  'RANKING_EXPAND',
  'DETAIL_OPEN',
  'RELATED_OPEN',
  'SAVE',
  'UNSAVE',
  'SHARE',
  'HIDE',
] as const

export type Rf1BehaviorEventType = (typeof RF1_BEHAVIOR_EVENT_TYPES)[number]
export type Rf1ProfileMaturity = 'EMPTY' | 'EMERGING' | 'ESTABLISHED'
export type Rf1FeatureKind = 'category' | 'subcategory' | 'rankingType' | 'item'
export type Rf1DiversityDimension = 'category' | 'subcategory' | 'rankingType'
export type Rf1NeighborhoodTier = 'A' | 'B' | 'C' | 'D'

export type Rf1Feature = {
  kind: Rf1FeatureKind
  id: string
}

export type Rf1BehaviorEvent = {
  eventId: string
  eventType: Rf1BehaviorEventType
  occurredAt: string
  magnitude: number
  features: Rf1Feature[]
  recommendationRunId?: string | null
  exposureId?: string | null
}

export type Rf1Signal = {
  featureKey: string
  signedWeight: number
  strength: number
}

export type Rf1BehaviorAggregationPolicy = {
  policyVersion: string
  lookbackMs: number
  eventWeights: Record<Rf1BehaviorEventType, number>
  eventHalfLifeMs: Record<Rf1BehaviorEventType, number>
  saturationScale: number
  minimumSignalStrength: number
  maximumEvents: number
}

export type Rf1MaturityPolicy = {
  policyVersion: string
  emergingAcceptedEventThreshold: number
  establishedAcceptedEventThreshold: number
  establishedAbsoluteWeightThreshold: number
}

export type Rf1NeighborhoodPolicy = {
  policyVersion: string
  tierBase: Record<Rf1NeighborhoodTier, number>
  itemJaccardWeight: number
  lexicalJaccardWeight: number
}

export type Rf1ComponentWeights = {
  neighborhood: number
  interest: number
  freshness: number
  popularity: number
}

export type Rf1ScorePolicy = {
  policyVersion: string
  componentWeightsByMaturity: Record<Rf1ProfileMaturity, Rf1ComponentWeights>
  userProfileInterestShare: number
  sessionInterestShare: number
  freshnessHalfLifeMs: number
  popularityMetricWeights: {
    uniqueViews: number
    likes: number
    bookmarks: number
  }
  popularityCompressionExponent: number
  lowExposureWindowMs: number
  lowExposureThreshold: number
  lowExposureMaximumBoost: number
  lowExposureMinimumNeighborhoodScore: number
}

export type Rf1DiversityPolicy = {
  policyVersion: string
  windowSize: number
  caps: Record<Rf1DiversityDimension, number>
  relaxationOrder: Rf1DiversityDimension[]
  maxPromotionDistance: number
  maxDemotionDistance: number
}

export type Rf1ExplorationPolicy = {
  policyVersion: string
  slotIndexes: number[]
  maximumPromotions: number
  maxPromotionDistance: number
  minimumNeighborhoodScore: number
  minimumBaseScore: number
  minimumFreshnessScore: number
  positiveInterestBoundary: number
}

export type Rf1PolicyBundle = {
  policyBundleVersion: string
  profilePolicyVersion: string
  sessionPolicyVersion: string
  scorePolicyVersion: string
  diversityPolicyVersion: string
  explorationPolicyVersion: string
  behavior: Rf1BehaviorAggregationPolicy
  sessionBehavior: Rf1BehaviorAggregationPolicy
  maturity: Rf1MaturityPolicy
  neighborhood: Rf1NeighborhoodPolicy
  score: Rf1ScorePolicy
  diversity: Rf1DiversityPolicy
  exploration: Rf1ExplorationPolicy
}

export type Rf1BehaviorProfileSnapshot = {
  profileVersion: string
  referenceTime: string
  maturity: Rf1ProfileMaturity
  inputEventCount: number
  acceptedEventCount: number
  ignoredEventCount: number
  duplicateEventCount: number
  acceptedAbsoluteWeight: number
  signals: Rf1Signal[]
  fingerprint: string
}

export type Rf1SessionInterestSnapshot = {
  sessionVersion: string
  referenceTime: string
  inputEventCount: number
  acceptedEventCount: number
  ignoredEventCount: number
  duplicateEventCount: number
  signals: Rf1Signal[]
  fingerprint: string
}

export type Rf1NeighborhoodEvidence = {
  tier: Rf1NeighborhoodTier
  itemJaccard: number
  lexicalJaccard: number
}

export type Rf1FeedCandidate = {
  rankingId: string
  categoryId: string
  subcategoryId: string | null
  rankingType: string
  itemIds: string[]
  publishedAt: string
  neighborhood: Rf1NeighborhoodEvidence
  uniqueViewCount: number
  likeCount: number
  bookmarkCount: number
  recentExposureCount: number
}

export type Rf1ScoreBreakdown = {
  neighborhoodScore: number
  interestScore: number
  freshnessScore: number
  popularityScore: number
  lowExposureBoost: number
  baseScore: number
  finalScore: number
}

export type Rf1RankedCandidate = {
  rankingId: string
  baseRank: number
  finalRank: number
  explored: boolean
  appliedRelaxations: Rf1DiversityDimension[]
  breakdown: Rf1ScoreBreakdown
  categoryId: string
  subcategoryId: string | null
  rankingType: string
}

export type Rf1RankingResult = {
  policyBundleVersion: string
  profileFingerprint: string
  sessionFingerprint: string | null
  referenceTime: string
  seed: string
  candidates: Rf1RankedCandidate[]
  fingerprint: string
}

export type Rf1ExposureEvidence = {
  exposureId: string
  recommendationRunId: string
  policyBundleVersion: string
  profileVersion: string
  profileFingerprint: string
  sessionFingerprint: string | null
  rankingId: string
  baseRank: number
  finalRank: number
  scoreBreakdown: Rf1ScoreBreakdown
  exposedAt: string
}

type AggregationResult = {
  inputEventCount: number
  acceptedEventCount: number
  ignoredEventCount: number
  duplicateEventCount: number
  acceptedAbsoluteWeight: number
  signals: Rf1Signal[]
}

type InternalScored = {
  candidate: Rf1FeedCandidate
  featureKeys: string[]
  baseRank: number
  explored: boolean
  appliedRelaxations: Rf1DiversityDimension[]
  breakdown: Rf1ScoreBreakdown
}

const EVENT_TYPE_SET = new Set<string>(RF1_BEHAVIOR_EVENT_TYPES)
const DIVERSITY_DIMENSIONS: Rf1DiversityDimension[] = ['category', 'subcategory', 'rankingType']

function assertFinite(value: number, label: string) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`)
}

function assertNonNegative(value: number, label: string) {
  assertFinite(value, label)
  if (value < 0) throw new Error(`${label} must be non-negative`)
}

function assertPositive(value: number, label: string) {
  assertFinite(value, label)
  if (value <= 0) throw new Error(`${label} must be positive`)
}

function assertUnit(value: number, label: string) {
  assertFinite(value, label)
  if (value < 0 || value > 1) throw new Error(`${label} must be within [0, 1]`)
}

function assertInteger(value: number, label: string, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${label} must be an integer >= ${minimum}`)
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function parseTimestamp(value: string, label: string) {
  const millis = Date.parse(value)
  if (!Number.isFinite(millis)) throw new Error(`${label} must be an ISO-compatible timestamp`)
  return millis
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(record).sort()) {
      if (record[key] !== undefined) result[key] = canonicalize(record[key])
    }
    return result
  }
  if (typeof value === 'number' && Object.is(value, -0)) return 0
  return value
}

export function canonicalStringify(value: unknown) {
  return JSON.stringify(canonicalize(value))
}

export function stableFingerprint(value: unknown) {
  const text = canonicalStringify(value)
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  for (const character of text) {
    hash ^= BigInt(character.codePointAt(0) ?? 0)
    hash = BigInt.asUintN(64, hash * prime)
  }
  return `rf1-${hash.toString(16).padStart(16, '0')}`
}

export function featureKey(feature: Rf1Feature) {
  if (!feature.id || feature.id.trim() !== feature.id) throw new Error('feature id must be a non-empty trimmed string')
  return `${feature.kind}:${feature.id}`
}

export function rankingFeatureKeys(candidate: Pick<Rf1FeedCandidate, 'categoryId' | 'subcategoryId' | 'rankingType' | 'itemIds'>) {
  const keys = [
    `category:${candidate.categoryId}`,
    `rankingType:${candidate.rankingType}`,
    ...candidate.itemIds.map((id) => `item:${id}`),
  ]
  if (candidate.subcategoryId) keys.push(`subcategory:${candidate.subcategoryId}`)
  return [...new Set(keys)].sort()
}

export function validateRf1PolicyBundle(bundle: Rf1PolicyBundle) {
  const versions = [
    bundle.policyBundleVersion,
    bundle.profilePolicyVersion,
    bundle.sessionPolicyVersion,
    bundle.scorePolicyVersion,
    bundle.diversityPolicyVersion,
    bundle.explorationPolicyVersion,
    bundle.behavior.policyVersion,
    bundle.sessionBehavior.policyVersion,
    bundle.maturity.policyVersion,
    bundle.neighborhood.policyVersion,
    bundle.score.policyVersion,
    bundle.diversity.policyVersion,
    bundle.exploration.policyVersion,
  ]
  if (versions.some((version) => !version || version.trim() !== version)) throw new Error('all RF-1 policy versions must be explicit trimmed strings')
  if (bundle.profilePolicyVersion !== bundle.behavior.policyVersion) throw new Error('profilePolicyVersion must match behavior policy version')
  if (bundle.sessionPolicyVersion !== bundle.sessionBehavior.policyVersion) throw new Error('sessionPolicyVersion must match session behavior policy version')
  if (bundle.scorePolicyVersion !== bundle.score.policyVersion) throw new Error('scorePolicyVersion must match score policy version')
  if (bundle.diversityPolicyVersion !== bundle.diversity.policyVersion) throw new Error('diversityPolicyVersion must match diversity policy version')
  if (bundle.explorationPolicyVersion !== bundle.exploration.policyVersion) throw new Error('explorationPolicyVersion must match exploration policy version')

  for (const [name, policy] of [['behavior', bundle.behavior], ['sessionBehavior', bundle.sessionBehavior]] as const) {
    assertPositive(policy.lookbackMs, `${name}.lookbackMs`)
    assertPositive(policy.saturationScale, `${name}.saturationScale`)
    assertUnit(policy.minimumSignalStrength, `${name}.minimumSignalStrength`)
    assertInteger(policy.maximumEvents, `${name}.maximumEvents`, 1)
    for (const eventType of RF1_BEHAVIOR_EVENT_TYPES) {
      assertFinite(policy.eventWeights[eventType], `${name}.eventWeights.${eventType}`)
      assertPositive(policy.eventHalfLifeMs[eventType], `${name}.eventHalfLifeMs.${eventType}`)
    }
  }

  assertInteger(bundle.maturity.emergingAcceptedEventThreshold, 'maturity.emergingAcceptedEventThreshold', 1)
  assertInteger(bundle.maturity.establishedAcceptedEventThreshold, 'maturity.establishedAcceptedEventThreshold', 1)
  assertPositive(bundle.maturity.establishedAbsoluteWeightThreshold, 'maturity.establishedAbsoluteWeightThreshold')
  if (bundle.maturity.establishedAcceptedEventThreshold < bundle.maturity.emergingAcceptedEventThreshold) {
    throw new Error('established event threshold cannot be below emerging threshold')
  }

  for (const tier of ['A', 'B', 'C', 'D'] as Rf1NeighborhoodTier[]) assertUnit(bundle.neighborhood.tierBase[tier], `neighborhood.tierBase.${tier}`)
  assertNonNegative(bundle.neighborhood.itemJaccardWeight, 'neighborhood.itemJaccardWeight')
  assertNonNegative(bundle.neighborhood.lexicalJaccardWeight, 'neighborhood.lexicalJaccardWeight')
  if (!(bundle.neighborhood.tierBase.A >= bundle.neighborhood.tierBase.B
    && bundle.neighborhood.tierBase.B >= bundle.neighborhood.tierBase.C
    && bundle.neighborhood.tierBase.C >= bundle.neighborhood.tierBase.D)) {
    throw new Error('neighborhood tier base must preserve A >= B >= C >= D')
  }

  const maturityOrder: Rf1ProfileMaturity[] = ['EMPTY', 'EMERGING', 'ESTABLISHED']
  for (const maturity of maturityOrder) {
    const weights = bundle.score.componentWeightsByMaturity[maturity]
    for (const [component, weight] of Object.entries(weights)) assertNonNegative(weight, `score.${maturity}.${component}`)
    if (Object.values(weights).every((weight) => weight === 0)) throw new Error(`score weights for ${maturity} cannot all be zero`)
  }
  if (bundle.score.componentWeightsByMaturity.EMPTY.interest > bundle.score.componentWeightsByMaturity.EMERGING.interest
    || bundle.score.componentWeightsByMaturity.EMERGING.interest > bundle.score.componentWeightsByMaturity.ESTABLISHED.interest) {
    throw new Error('interest weight must not decrease as profile maturity increases')
  }
  assertNonNegative(bundle.score.userProfileInterestShare, 'score.userProfileInterestShare')
  assertNonNegative(bundle.score.sessionInterestShare, 'score.sessionInterestShare')
  if (bundle.score.userProfileInterestShare + bundle.score.sessionInterestShare <= 0) throw new Error('at least one interest source share must be positive')
  assertPositive(bundle.score.freshnessHalfLifeMs, 'score.freshnessHalfLifeMs')
  for (const [metric, weight] of Object.entries(bundle.score.popularityMetricWeights)) assertNonNegative(weight, `score.popularityMetricWeights.${metric}`)
  if (Object.values(bundle.score.popularityMetricWeights).every((weight) => weight === 0)) throw new Error('at least one popularity metric weight must be positive')
  assertPositive(bundle.score.popularityCompressionExponent, 'score.popularityCompressionExponent')
  assertPositive(bundle.score.lowExposureWindowMs, 'score.lowExposureWindowMs')
  assertInteger(bundle.score.lowExposureThreshold, 'score.lowExposureThreshold', 1)
  assertUnit(bundle.score.lowExposureMaximumBoost, 'score.lowExposureMaximumBoost')
  assertUnit(bundle.score.lowExposureMinimumNeighborhoodScore, 'score.lowExposureMinimumNeighborhoodScore')

  assertInteger(bundle.diversity.windowSize, 'diversity.windowSize', 1)
  assertInteger(bundle.diversity.maxPromotionDistance, 'diversity.maxPromotionDistance')
  assertInteger(bundle.diversity.maxDemotionDistance, 'diversity.maxDemotionDistance')
  for (const dimension of DIVERSITY_DIMENSIONS) assertInteger(bundle.diversity.caps[dimension], `diversity.caps.${dimension}`, 1)
  if (new Set(bundle.diversity.relaxationOrder).size !== bundle.diversity.relaxationOrder.length) throw new Error('diversity relaxation order cannot contain duplicates')
  if (bundle.diversity.relaxationOrder.some((dimension) => !DIVERSITY_DIMENSIONS.includes(dimension))) throw new Error('diversity relaxation order contains unsupported dimension')

  assertInteger(bundle.exploration.maximumPromotions, 'exploration.maximumPromotions')
  assertInteger(bundle.exploration.maxPromotionDistance, 'exploration.maxPromotionDistance')
  assertUnit(bundle.exploration.minimumNeighborhoodScore, 'exploration.minimumNeighborhoodScore')
  assertUnit(bundle.exploration.minimumBaseScore, 'exploration.minimumBaseScore')
  assertUnit(bundle.exploration.minimumFreshnessScore, 'exploration.minimumFreshnessScore')
  assertUnit(bundle.exploration.positiveInterestBoundary, 'exploration.positiveInterestBoundary')
  const uniqueSlots = new Set(bundle.exploration.slotIndexes)
  if (uniqueSlots.size !== bundle.exploration.slotIndexes.length) throw new Error('exploration slots cannot contain duplicates')
  for (const slot of bundle.exploration.slotIndexes) assertInteger(slot, 'exploration slot', 1)

  return bundle
}

function canonicalEvent(event: Rf1BehaviorEvent) {
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    occurredAt: new Date(parseTimestamp(event.occurredAt, 'event.occurredAt')).toISOString(),
    magnitude: event.magnitude,
    features: event.features.map(featureKey).sort(),
    recommendationRunId: event.recommendationRunId ?? null,
    exposureId: event.exposureId ?? null,
  }
}

function aggregateEvents(events: Rf1BehaviorEvent[], referenceTime: string, policy: Rf1BehaviorAggregationPolicy): AggregationResult {
  if (events.length > policy.maximumEvents) throw new Error('behavior event count exceeds policy maximum')
  const referenceMs = parseTimestamp(referenceTime, 'referenceTime')
  const earliestMs = referenceMs - policy.lookbackMs
  const ordered = [...events].sort((left, right) => {
    const timeDelta = parseTimestamp(left.occurredAt, 'event.occurredAt') - parseTimestamp(right.occurredAt, 'event.occurredAt')
    return timeDelta || left.eventId.localeCompare(right.eventId)
  })
  const unique = new Map<string, string>()
  const signedWeights = new Map<string, number>()
  let accepted = 0
  let ignored = 0
  let duplicates = 0
  let absoluteWeight = 0

  for (const event of ordered) {
    if (!event.eventId || event.eventId.trim() !== event.eventId) throw new Error('behavior event ID must be a non-empty trimmed string')
    if (!EVENT_TYPE_SET.has(event.eventType)) throw new Error(`unsupported behavior event type: ${event.eventType}`)
    assertUnit(event.magnitude, `event ${event.eventId} magnitude`)
    const canonical = canonicalStringify(canonicalEvent(event))
    const previous = unique.get(event.eventId)
    if (previous !== undefined) {
      if (previous !== canonical) throw new Error(`conflicting behavior event ID: ${event.eventId}`)
      duplicates++
      continue
    }
    unique.set(event.eventId, canonical)

    const occurredMs = parseTimestamp(event.occurredAt, 'event.occurredAt')
    if (occurredMs > referenceMs || occurredMs < earliestMs || event.magnitude === 0) {
      ignored++
      continue
    }
    const eventWeight = policy.eventWeights[event.eventType]
    if (eventWeight === 0 || event.features.length === 0) {
      ignored++
      continue
    }
    const ageMs = Math.max(0, referenceMs - occurredMs)
    const decay = Math.pow(0.5, ageMs / policy.eventHalfLifeMs[event.eventType])
    const contribution = eventWeight * event.magnitude * decay
    const keys = [...new Set(event.features.map(featureKey))].sort()
    if (keys.length === 0) {
      ignored++
      continue
    }
    for (const key of keys) signedWeights.set(key, (signedWeights.get(key) ?? 0) + contribution)
    accepted++
    absoluteWeight += Math.abs(contribution)
  }

  const signals = [...signedWeights.entries()]
    .map(([key, signedWeight]) => ({
      featureKey: key,
      signedWeight,
      strength: 1 - Math.exp(-Math.abs(signedWeight) / policy.saturationScale),
    }))
    .filter((signal) => signal.strength >= policy.minimumSignalStrength)
    .sort((left, right) => left.featureKey.localeCompare(right.featureKey))

  return {
    inputEventCount: events.length,
    acceptedEventCount: accepted,
    ignoredEventCount: ignored,
    duplicateEventCount: duplicates,
    acceptedAbsoluteWeight: absoluteWeight,
    signals,
  }
}

export function buildRf1BehaviorProfile(
  events: Rf1BehaviorEvent[],
  referenceTime: string,
  policy: Rf1BehaviorAggregationPolicy,
  maturityPolicy: Rf1MaturityPolicy,
): Rf1BehaviorProfileSnapshot {
  const aggregated = aggregateEvents(events, referenceTime, policy)
  let maturity: Rf1ProfileMaturity = 'EMPTY'
  if (aggregated.acceptedEventCount >= maturityPolicy.establishedAcceptedEventThreshold
    && aggregated.acceptedAbsoluteWeight >= maturityPolicy.establishedAbsoluteWeightThreshold) {
    maturity = 'ESTABLISHED'
  } else if (aggregated.acceptedEventCount >= maturityPolicy.emergingAcceptedEventThreshold) {
    maturity = 'EMERGING'
  }
  const payload = {
    domain: 'rankingwiki:rf1-profile:v1',
    profileVersion: policy.policyVersion,
    referenceTime: new Date(parseTimestamp(referenceTime, 'referenceTime')).toISOString(),
    maturity,
    ...aggregated,
  }
  return { ...payload, fingerprint: stableFingerprint(payload) }
}

export function buildRf1SessionInterest(
  events: Rf1BehaviorEvent[],
  referenceTime: string,
  policy: Rf1BehaviorAggregationPolicy,
): Rf1SessionInterestSnapshot {
  const aggregated = aggregateEvents(events, referenceTime, policy)
  const payload = {
    domain: 'rankingwiki:rf1-session:v1',
    sessionVersion: policy.policyVersion,
    referenceTime: new Date(parseTimestamp(referenceTime, 'referenceTime')).toISOString(),
    ...aggregated,
  }
  return { ...payload, fingerprint: stableFingerprint(payload) }
}

export function scoreRf1Neighborhood(evidence: Rf1NeighborhoodEvidence, policy: Rf1NeighborhoodPolicy) {
  assertUnit(evidence.itemJaccard, 'neighborhood itemJaccard')
  assertUnit(evidence.lexicalJaccard, 'neighborhood lexicalJaccard')
  const additiveWeight = policy.itemJaccardWeight + policy.lexicalJaccardWeight
  if (additiveWeight === 0) return policy.tierBase[evidence.tier]
  const similarity = (
    evidence.itemJaccard * policy.itemJaccardWeight
    + evidence.lexicalJaccard * policy.lexicalJaccardWeight
  ) / additiveWeight
  return clamp01(policy.tierBase[evidence.tier] + (1 - policy.tierBase[evidence.tier]) * similarity)
}

function signedSignalValue(signals: Rf1Signal[]) {
  return new Map(signals.map((signal) => [signal.featureKey, Math.sign(signal.signedWeight) * signal.strength]))
}

function interestAgainst(featureKeys: string[], signalMap: Map<string, number>) {
  const matches = featureKeys.map((key) => signalMap.get(key)).filter((value): value is number => value !== undefined)
  if (matches.length === 0) return 0.5
  const average = matches.reduce((sum, value) => sum + value, 0) / matches.length
  return clamp01(0.5 + average / 2)
}

function combinedInterest(
  featureKeys: string[],
  profile: Rf1BehaviorProfileSnapshot,
  session: Rf1SessionInterestSnapshot | null,
  policy: Rf1ScorePolicy,
) {
  const userScore = interestAgainst(featureKeys, signedSignalValue(profile.signals))
  const sessionScore = session ? interestAgainst(featureKeys, signedSignalValue(session.signals)) : 0.5
  const userShare = policy.userProfileInterestShare
  const sessionShare = session ? policy.sessionInterestShare : 0
  const denominator = userShare + sessionShare
  return denominator === 0 ? 0.5 : clamp01((userScore * userShare + sessionScore * sessionShare) / denominator)
}

function rawPopularity(candidate: Rf1FeedCandidate, policy: Rf1ScorePolicy) {
  const metrics = [
    [candidate.uniqueViewCount, policy.popularityMetricWeights.uniqueViews],
    [candidate.likeCount, policy.popularityMetricWeights.likes],
    [candidate.bookmarkCount, policy.popularityMetricWeights.bookmarks],
  ] as const
  let total = 0
  for (const [count, weight] of metrics) {
    assertInteger(count, 'engagement count')
    total += Math.log1p(count) * weight
  }
  return total
}

function componentWeightedScore(breakdown: Omit<Rf1ScoreBreakdown, 'lowExposureBoost' | 'baseScore' | 'finalScore'>, weights: Rf1ComponentWeights) {
  const denominator = weights.neighborhood + weights.interest + weights.freshness + weights.popularity
  if (denominator <= 0) throw new Error('component weight denominator must be positive')
  return clamp01((
    breakdown.neighborhoodScore * weights.neighborhood
    + breakdown.interestScore * weights.interest
    + breakdown.freshnessScore * weights.freshness
    + breakdown.popularityScore * weights.popularity
  ) / denominator)
}

function scoreCandidates(
  candidates: Rf1FeedCandidate[],
  profile: Rf1BehaviorProfileSnapshot,
  session: Rf1SessionInterestSnapshot | null,
  referenceTime: string,
  bundle: Rf1PolicyBundle,
) {
  const referenceMs = parseTimestamp(referenceTime, 'referenceTime')
  const identities = new Set<string>()
  for (const candidate of candidates) {
    if (!candidate.rankingId || candidate.rankingId.trim() !== candidate.rankingId) throw new Error('rankingId must be a non-empty trimmed string')
    if (identities.has(candidate.rankingId)) throw new Error(`duplicate candidate rankingId: ${candidate.rankingId}`)
    identities.add(candidate.rankingId)
    assertInteger(candidate.recentExposureCount, 'recentExposureCount')
  }
  const popularityRaw = new Map(candidates.map((candidate) => [candidate.rankingId, rawPopularity(candidate, bundle.score)]))
  const maximumPopularity = Math.max(0, ...popularityRaw.values())
  const weights = bundle.score.componentWeightsByMaturity[profile.maturity]

  const scored = candidates.map<InternalScored>((candidate) => {
    const featureKeys = rankingFeatureKeys(candidate)
    const neighborhoodScore = scoreRf1Neighborhood(candidate.neighborhood, bundle.neighborhood)
    const interestScore = combinedInterest(featureKeys, profile, session, bundle.score)
    const ageMs = Math.max(0, referenceMs - parseTimestamp(candidate.publishedAt, 'candidate.publishedAt'))
    const freshnessScore = clamp01(Math.pow(0.5, ageMs / bundle.score.freshnessHalfLifeMs))
    const normalizedPopularity = maximumPopularity === 0 ? 0 : (popularityRaw.get(candidate.rankingId) ?? 0) / maximumPopularity
    const popularityScore = clamp01(Math.pow(normalizedPopularity, bundle.score.popularityCompressionExponent))
    const partial = { neighborhoodScore, interestScore, freshnessScore, popularityScore }
    const baseScore = componentWeightedScore(partial, weights)
    const exposureDeficit = Math.max(0, bundle.score.lowExposureThreshold - candidate.recentExposureCount)
    const lowExposureBoost = neighborhoodScore < bundle.score.lowExposureMinimumNeighborhoodScore
      ? 0
      : bundle.score.lowExposureMaximumBoost * exposureDeficit / bundle.score.lowExposureThreshold
    const finalScore = clamp01(baseScore + lowExposureBoost)
    return {
      candidate,
      featureKeys,
      baseRank: 0,
      explored: false,
      appliedRelaxations: [],
      breakdown: { ...partial, lowExposureBoost, baseScore, finalScore },
    }
  })

  scored.sort((left, right) => (
    right.breakdown.finalScore - left.breakdown.finalScore
    || right.breakdown.baseScore - left.breakdown.baseScore
    || right.breakdown.neighborhoodScore - left.breakdown.neighborhoodScore
    || left.candidate.rankingId.localeCompare(right.candidate.rankingId)
  ))
  return scored.map((candidate, index) => ({ ...candidate, baseRank: index + 1 }))
}

function dimensionValue(candidate: Rf1FeedCandidate, dimension: Rf1DiversityDimension) {
  if (dimension === 'category') return candidate.categoryId
  if (dimension === 'subcategory') return candidate.subcategoryId
  return candidate.rankingType
}

function fitsDiversity(
  candidate: InternalScored,
  selected: InternalScored[],
  policy: Rf1DiversityPolicy,
  relaxed: Set<Rf1DiversityDimension>,
) {
  const window = selected.slice(Math.max(0, selected.length - policy.windowSize + 1))
  for (const dimension of DIVERSITY_DIMENSIONS) {
    if (relaxed.has(dimension)) continue
    const value = dimensionValue(candidate.candidate, dimension)
    if (value === null) continue
    const count = window.filter((selectedCandidate) => dimensionValue(selectedCandidate.candidate, dimension) === value).length
    if (count >= policy.caps[dimension]) return false
  }
  return true
}

function forcedDemotionIndex(remaining: InternalScored[], targetRank: number, maxDemotionDistance: number) {
  return remaining.findIndex((candidate) => targetRank >= candidate.baseRank + maxDemotionDistance)
}

function selectDiversityIndex(
  remaining: InternalScored[],
  selected: InternalScored[],
  policy: Rf1DiversityPolicy,
  relaxed: Set<Rf1DiversityDimension>,
  targetRank: number,
  forcedIndex: number,
) {
  if (forcedIndex >= 0) return fitsDiversity(remaining[forcedIndex], selected, policy, relaxed) ? forcedIndex : -1
  const latestPromotable = targetRank + policy.maxPromotionDistance
  for (let index = 0; index < remaining.length; index++) {
    if (remaining[index].baseRank > latestPromotable) break
    if (fitsDiversity(remaining[index], selected, policy, relaxed)) return index
  }
  return -1
}

export function diversifyRf1Candidates(base: InternalScored[], policy: Rf1DiversityPolicy) {
  const remaining = [...base]
  const selected: InternalScored[] = []
  while (remaining.length > 0) {
    const targetRank = selected.length + 1
    const forcedIndex = forcedDemotionIndex(remaining, targetRank, policy.maxDemotionDistance)
    const relaxed = new Set<Rf1DiversityDimension>()
    let selectedIndex = selectDiversityIndex(remaining, selected, policy, relaxed, targetRank, forcedIndex)
    for (const dimension of policy.relaxationOrder) {
      if (selectedIndex >= 0) break
      relaxed.add(dimension)
      selectedIndex = selectDiversityIndex(remaining, selected, policy, relaxed, targetRank, forcedIndex)
    }
    if (selectedIndex < 0) {
      for (const dimension of DIVERSITY_DIMENSIONS) relaxed.add(dimension)
      selectedIndex = selectDiversityIndex(remaining, selected, policy, relaxed, targetRank, forcedIndex)
    }
    if (selectedIndex < 0) throw new Error('diversity reranking could not select a candidate even after full relaxation')
    const [chosen] = remaining.splice(selectedIndex, 1)
    selected.push({ ...chosen, appliedRelaxations: [...relaxed] })
  }
  return selected
}

function candidateOutsideInterest(
  candidate: InternalScored,
  profile: Rf1BehaviorProfileSnapshot,
  session: Rf1SessionInterestSnapshot | null,
  positiveBoundary: number,
) {
  const signalMaps = [signedSignalValue(profile.signals)]
  if (session) signalMaps.push(signedSignalValue(session.signals))
  for (const key of candidate.featureKeys) {
    for (const map of signalMaps) {
      const value = map.get(key)
      if (value !== undefined && value >= positiveBoundary) return false
    }
  }
  return true
}

function explorationKey(seed: string, rankingId: string) {
  return stableFingerprint({ domain: 'rankingwiki:rf1-exploration:v1', seed, rankingId })
}

export function applyRf1Exploration(
  diversified: InternalScored[],
  profile: Rf1BehaviorProfileSnapshot,
  session: Rf1SessionInterestSnapshot | null,
  seed: string,
  policy: Rf1ExplorationPolicy,
) {
  if (!seed) throw new Error('exploration seed is required')
  const result = [...diversified]
  let promotions = 0
  for (const slot of [...policy.slotIndexes].sort((a, b) => a - b)) {
    if (promotions >= policy.maximumPromotions || slot > result.length) break
    const targetIndex = slot - 1
    const eligible = result
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate, index }) => (
        index > targetIndex
        && index - targetIndex <= policy.maxPromotionDistance
        && candidate.breakdown.neighborhoodScore >= policy.minimumNeighborhoodScore
        && candidate.breakdown.baseScore >= policy.minimumBaseScore
        && candidate.breakdown.freshnessScore >= policy.minimumFreshnessScore
        && candidateOutsideInterest(candidate, profile, session, policy.positiveInterestBoundary)
      ))
      .sort((left, right) => (
        explorationKey(seed, left.candidate.candidate.rankingId).localeCompare(explorationKey(seed, right.candidate.candidate.rankingId))
        || left.candidate.candidate.rankingId.localeCompare(right.candidate.candidate.rankingId)
      ))
    const selected = eligible[0]
    if (!selected) continue
    const [candidate] = result.splice(selected.index, 1)
    result.splice(targetIndex, 0, { ...candidate, explored: true })
    promotions++
  }
  return result
}

export function rankRf1Feed(input: {
  candidates: Rf1FeedCandidate[]
  profile: Rf1BehaviorProfileSnapshot
  session: Rf1SessionInterestSnapshot | null
  referenceTime: string
  seed: string
  policy: Rf1PolicyBundle
}): Rf1RankingResult {
  const bundle = validateRf1PolicyBundle(input.policy)
  if (input.profile.profileVersion !== bundle.profilePolicyVersion) throw new Error('profile policy version does not match RF-1 bundle')
  if (input.session && input.session.sessionVersion !== bundle.sessionPolicyVersion) throw new Error('session policy version does not match RF-1 bundle')
  const scored = scoreCandidates(input.candidates, input.profile, input.session, input.referenceTime, bundle)
  const diversified = diversifyRf1Candidates(scored, bundle.diversity)
  const explored = applyRf1Exploration(diversified, input.profile, input.session, input.seed, bundle.exploration)
  const candidates = explored.map<Rf1RankedCandidate>((candidate, index) => ({
    rankingId: candidate.candidate.rankingId,
    baseRank: candidate.baseRank,
    finalRank: index + 1,
    explored: candidate.explored,
    appliedRelaxations: candidate.appliedRelaxations,
    breakdown: candidate.breakdown,
    categoryId: candidate.candidate.categoryId,
    subcategoryId: candidate.candidate.subcategoryId,
    rankingType: candidate.candidate.rankingType,
  }))
  const payload = {
    domain: 'rankingwiki:rf1-ranking:v1',
    policyBundleVersion: bundle.policyBundleVersion,
    profileFingerprint: input.profile.fingerprint,
    sessionFingerprint: input.session?.fingerprint ?? null,
    referenceTime: new Date(parseTimestamp(input.referenceTime, 'referenceTime')).toISOString(),
    seed: input.seed,
    candidates,
  }
  return { ...payload, fingerprint: stableFingerprint(payload) }
}

export function createRf1ExposureEvidence(input: {
  recommendationRunId: string
  profile: Rf1BehaviorProfileSnapshot
  session: Rf1SessionInterestSnapshot | null
  result: Rf1RankingResult
  exposedAt: string
}) {
  if (!input.recommendationRunId || input.recommendationRunId.trim() !== input.recommendationRunId) throw new Error('recommendationRunId must be a non-empty trimmed string')
  const exposedAt = new Date(parseTimestamp(input.exposedAt, 'exposedAt')).toISOString()
  return input.result.candidates.map<Rf1ExposureEvidence>((candidate) => ({
    exposureId: `${input.recommendationRunId}:${candidate.rankingId}`,
    recommendationRunId: input.recommendationRunId,
    policyBundleVersion: input.result.policyBundleVersion,
    profileVersion: input.profile.profileVersion,
    profileFingerprint: input.profile.fingerprint,
    sessionFingerprint: input.session?.fingerprint ?? null,
    rankingId: candidate.rankingId,
    baseRank: candidate.baseRank,
    finalRank: candidate.finalRank,
    scoreBreakdown: candidate.breakdown,
    exposedAt,
  }))
}
