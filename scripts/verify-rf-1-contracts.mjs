import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const corePath = path.join(root, 'src/lib/recommendation/rf1-core.ts')
const neighborhoodPath = path.join(root, 'src/lib/ranking-neighborhood.ts')
const publicQueryPath = path.join(root, 'src/lib/queries/public.ts')

function fail(message) {
  console.error(`RF-1 contract failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function approx(actual, expected, epsilon = 0.000001) {
  return Math.abs(actual - expected) <= epsilon
}

assert(fs.existsSync(corePath), 'src/lib/recommendation/rf1-core.ts must exist')
assert(fs.existsSync(neighborhoodPath), 'existing Ranking Neighborhood helper must remain present')
assert(fs.existsSync(publicQueryPath), 'public candidate retrieval authority must remain present')

const source = fs.readFileSync(corePath, 'utf8')
const neighborhoodSource = fs.readFileSync(neighborhoodPath, 'utf8')
const publicSource = fs.readFileSync(publicQueryPath, 'utf8')

assert(!source.includes('RANKING_FEED_POLICY_V1 ='), 'RF-1 must not ship uncalibrated production tuning constants')
assert(source.includes("'category' | 'subcategory' | 'rankingType' | 'item'"), 'profile vocabulary must stay within current RankingWiki schema authority')
assert(!source.includes("'geography'"), 'RF-1 must not invent a geography taxonomy')
assert(!source.includes("'rankingFamily'"), 'RF-1 must not invent a ranking-family schema')
assert(source.includes('recentExposureCount'), 'low-exposure scoring must accept bounded exposure evidence')
assert(source.includes('recommendationRunId'), 'outcome/exposure provenance must retain recommendationRunId')
assert(source.includes('scoreBreakdown'), 'exposure evidence must retain component score breakdown')
assert(source.includes('profileFingerprint'), 'ranking/exposure evidence must bind profile fingerprint')

assert(neighborhoodSource.includes("export type RankingNeighborTier = 'A' | 'B' | 'C' | 'D'"), 'existing Ranking Neighborhood tier contract must remain unchanged')
assert(publicSource.includes('export async function getRelatedRankings'), 'existing Ranking Neighborhood retrieval must remain the candidate-generation authority')
assert(publicSource.includes('classifyRankingNeighbor'), 'existing contextual candidate gate must remain active')

const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    strict: true,
  },
  fileName: corePath,
}).outputText

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
const rf1 = await import(moduleUrl)

const {
  RF1_BEHAVIOR_EVENT_TYPES,
  applyRf1Exploration,
  buildRf1BehaviorProfile,
  buildRf1SessionInterest,
  createRf1ExposureEvidence,
  rankRf1Feed,
  scoreRf1Neighborhood,
  stableFingerprint,
  validateRf1PolicyBundle,
} = rf1

assert(RF1_BEHAVIOR_EVENT_TYPES.join(',') === [
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
].join(','), 'behavior event vocabulary must match the approved RF-1 contract exactly')

// These numbers are verifier-only fixtures. They deliberately are not exported by production code.
const DAY = 86_400_000
const fixtureEventWeights = {
  FEED_IMPRESSION: 0,
  RANKING_VIEW: 0.25,
  QUICK_SKIP: -0.35,
  DWELL: 0.45,
  RANKING_EXPAND: 0.5,
  DETAIL_OPEN: 0.6,
  RELATED_OPEN: 0.4,
  SAVE: 0.8,
  UNSAVE: -0.8,
  SHARE: 0.9,
  HIDE: -1,
}
const fixtureHalfLives = Object.fromEntries(RF1_BEHAVIOR_EVENT_TYPES.map((eventType) => [eventType, 7 * DAY]))
const behaviorPolicy = {
  policyVersion: 'rf1-profile-fixture-v1',
  lookbackMs: 30 * DAY,
  eventWeights: fixtureEventWeights,
  eventHalfLifeMs: fixtureHalfLives,
  saturationScale: 1,
  minimumSignalStrength: 0.01,
  maximumEvents: 100,
}
const sessionPolicy = {
  ...behaviorPolicy,
  policyVersion: 'rf1-session-fixture-v1',
  lookbackMs: DAY,
}
const maturityPolicy = {
  policyVersion: 'rf1-maturity-fixture-v1',
  emergingAcceptedEventThreshold: 2,
  establishedAcceptedEventThreshold: 4,
  establishedAbsoluteWeightThreshold: 1,
}
const fixturePolicy = {
  policyBundleVersion: 'ranking-feed-policy-fixture-v1',
  profilePolicyVersion: behaviorPolicy.policyVersion,
  sessionPolicyVersion: sessionPolicy.policyVersion,
  scorePolicyVersion: 'rf1-score-fixture-v1',
  diversityPolicyVersion: 'rf1-diversity-fixture-v1',
  explorationPolicyVersion: 'rf1-exploration-fixture-v1',
  behavior: behaviorPolicy,
  sessionBehavior: sessionPolicy,
  maturity: maturityPolicy,
  neighborhood: {
    policyVersion: 'rf1-neighborhood-fixture-v1',
    tierBase: { A: 0.7, B: 0.55, C: 0.4, D: 0.25 },
    itemJaccardWeight: 1,
    lexicalJaccardWeight: 1,
  },
  score: {
    policyVersion: 'rf1-score-fixture-v1',
    componentWeightsByMaturity: {
      EMPTY: { neighborhood: 0.55, interest: 0.05, freshness: 0.25, popularity: 0.15 },
      EMERGING: { neighborhood: 0.45, interest: 0.15, freshness: 0.22, popularity: 0.18 },
      ESTABLISHED: { neighborhood: 0.35, interest: 0.3, freshness: 0.2, popularity: 0.15 },
    },
    userProfileInterestShare: 0.7,
    sessionInterestShare: 0.3,
    freshnessHalfLifeMs: 14 * DAY,
    popularityMetricWeights: { uniqueViews: 1, likes: 1, bookmarks: 1 },
    popularityCompressionExponent: 0.6,
    lowExposureWindowMs: 7 * DAY,
    lowExposureThreshold: 10,
    lowExposureMaximumBoost: 0.08,
    lowExposureMinimumNeighborhoodScore: 0.45,
  },
  diversity: {
    policyVersion: 'rf1-diversity-fixture-v1',
    windowSize: 3,
    caps: { category: 2, subcategory: 1, rankingType: 2 },
    relaxationOrder: ['rankingType', 'category', 'subcategory'],
    maxPromotionDistance: 3,
    maxDemotionDistance: 3,
  },
  exploration: {
    policyVersion: 'rf1-exploration-fixture-v1',
    slotIndexes: [3],
    maximumPromotions: 1,
    maxPromotionDistance: 3,
    minimumNeighborhoodScore: 0.45,
    minimumBaseScore: 0.35,
    minimumFreshnessScore: 0.2,
    positiveInterestBoundary: 0.2,
  },
}
validateRf1PolicyBundle(fixturePolicy)

const ref = '2026-08-24T00:00:00.000Z'
const feature = (kind, id) => ({ kind, id })
const event = (overrides = {}) => ({
  eventId: 'event-1',
  eventType: 'RANKING_VIEW',
  occurredAt: '2026-08-23T12:00:00.000Z',
  magnitude: 1,
  features: [feature('category', 'sports')],
  recommendationRunId: null,
  exposureId: null,
  ...overrides,
})

const duplicateProfile = buildRf1BehaviorProfile(
  [event(), event()],
  ref,
  behaviorPolicy,
  maturityPolicy,
)
assert(duplicateProfile.acceptedEventCount === 1, 'duplicate event must be accepted only once')
assert(duplicateProfile.duplicateEventCount === 1, 'duplicate event must be counted deterministically')

let conflictRejected = false
try {
  buildRf1BehaviorProfile(
    [event(), event({ magnitude: 0.5 })],
    ref,
    behaviorPolicy,
    maturityPolicy,
  )
} catch (error) {
  conflictRejected = String(error).includes('conflicting behavior event ID')
}
assert(conflictRejected, 'same event ID with conflicting payload must fail closed')

const filteredProfile = buildRf1BehaviorProfile([
  event({ eventId: 'future', occurredAt: '2026-08-25T00:00:00.000Z' }),
  event({ eventId: 'stale', occurredAt: '2026-06-01T00:00:00.000Z' }),
  event({ eventId: 'valid' }),
], ref, behaviorPolicy, maturityPolicy)
assert(filteredProfile.acceptedEventCount === 1, 'only in-window non-future events may be accepted')
assert(filteredProfile.ignoredEventCount === 2, 'future and lookback-expired events must be ignored')

const negativeProfile = buildRf1BehaviorProfile([
  event({ eventId: 'hide', eventType: 'HIDE' }),
], ref, behaviorPolicy, maturityPolicy)
assert(negativeProfile.signals.length === 1, 'negative behavior must still produce a profile signal')
assert(negativeProfile.signals[0].signedWeight < 0, 'HIDE fixture must produce a negative signed signal')

const repeated = Array.from({ length: 20 }, (_, index) => event({ eventId: `save-${index}`, eventType: 'SAVE' }))
const saturatedProfile = buildRf1BehaviorProfile(repeated, ref, behaviorPolicy, maturityPolicy)
assert(saturatedProfile.signals[0].strength < 1, 'bounded saturation must remain strictly below 1')
assert(saturatedProfile.signals[0].strength > 0.99, 'repeated positive evidence should approach the saturation bound')

const emptyProfile = buildRf1BehaviorProfile([], ref, behaviorPolicy, maturityPolicy)
assert(emptyProfile.maturity === 'EMPTY', 'no accepted behavior must yield EMPTY maturity')
const emergingProfile = buildRf1BehaviorProfile([
  event({ eventId: 'e1' }),
  event({ eventId: 'e2', features: [feature('subcategory', 'football')] }),
], ref, behaviorPolicy, maturityPolicy)
assert(emergingProfile.maturity === 'EMERGING', 'small accepted evidence should yield EMERGING maturity')
const establishedProfile = buildRf1BehaviorProfile([
  event({ eventId: 's1', eventType: 'SAVE' }),
  event({ eventId: 's2', eventType: 'SAVE' }),
  event({ eventId: 's3', eventType: 'DETAIL_OPEN' }),
  event({ eventId: 's4', eventType: 'RANKING_EXPAND' }),
], ref, behaviorPolicy, maturityPolicy)
assert(establishedProfile.maturity === 'ESTABLISHED', 'sufficient accepted evidence and mass should yield ESTABLISHED maturity')

const session = buildRf1SessionInterest([
  event({ eventId: 'session-airport', eventType: 'DWELL', features: [feature('category', 'travel')] }),
], ref, sessionPolicy)
assert(session.signals.some((signal) => signal.featureKey === 'category:travel'), 'session context must remain independent from the long-term profile')
assert(session.fingerprint !== establishedProfile.fingerprint, 'session and profile fingerprints must be independently bound')

const tierA = scoreRf1Neighborhood({ tier: 'A', itemJaccard: 0.5, lexicalJaccard: 0.5 }, fixturePolicy.neighborhood)
const tierD = scoreRf1Neighborhood({ tier: 'D', itemJaccard: 0.5, lexicalJaccard: 0.5 }, fixturePolicy.neighborhood)
assert(tierA > tierD, 'neighborhood score must preserve existing tier ordering')

const candidate = (overrides = {}) => ({
  rankingId: 'ranking-a',
  categoryId: 'sports',
  subcategoryId: 'football',
  rankingType: 'popularity',
  itemIds: ['item-a', 'item-b'],
  publishedAt: '2026-08-23T00:00:00.000Z',
  neighborhood: { tier: 'A', itemJaccard: 0.5, lexicalJaccard: 0.5 },
  uniqueViewCount: 10,
  likeCount: 2,
  bookmarkCount: 1,
  recentExposureCount: 20,
  ...overrides,
})

const deterministicCandidates = [
  candidate({ rankingId: 'ranking-c', categoryId: 'culture', subcategoryId: 'music', itemIds: ['c'] }),
  candidate({ rankingId: 'ranking-a', categoryId: 'sports', subcategoryId: 'football', itemIds: ['a'] }),
  candidate({ rankingId: 'ranking-b', categoryId: 'tech', subcategoryId: 'ai', itemIds: ['b'] }),
]
const deterministicA = rankRf1Feed({ candidates: deterministicCandidates, profile: emptyProfile, session: null, referenceTime: ref, seed: 'seed-1', policy: fixturePolicy })
const deterministicB = rankRf1Feed({ candidates: [...deterministicCandidates].reverse(), profile: emptyProfile, session: null, referenceTime: ref, seed: 'seed-1', policy: fixturePolicy })
assert(deterministicA.fingerprint === deterministicB.fingerprint, 'candidate input order must not change the RF-1 result fingerprint')
assert(deterministicA.candidates.map((entry) => entry.rankingId).join(',') === deterministicB.candidates.map((entry) => entry.rankingId).join(','), 'candidate input order must not change final ranking')

const tieResult = rankRf1Feed({
  candidates: [candidate({ rankingId: 'ranking-z' }), candidate({ rankingId: 'ranking-a' })],
  profile: emptyProfile,
  session: null,
  referenceTime: ref,
  seed: 'seed-tie',
  policy: { ...fixturePolicy, exploration: { ...fixturePolicy.exploration, slotIndexes: [], maximumPromotions: 0 } },
})
assert(tieResult.candidates[0].rankingId === 'ranking-a', 'stable rankingId tie-breaker must resolve exact score ties')

const coldStart = rankRf1Feed({
  candidates: [
    candidate({ rankingId: 'sports', categoryId: 'sports' }),
    candidate({ rankingId: 'travel', categoryId: 'travel' }),
  ],
  profile: emptyProfile,
  session: null,
  referenceTime: ref,
  seed: 'cold',
  policy: { ...fixturePolicy, exploration: { ...fixturePolicy.exploration, slotIndexes: [], maximumPromotions: 0 } },
})
assert(coldStart.candidates.every((entry) => approx(entry.breakdown.interestScore, 0.5)), 'EMPTY profile must not invent personalized interest')

const popularityResult = rankRf1Feed({
  candidates: [
    candidate({ rankingId: 'p-low', uniqueViewCount: 10, likeCount: 0, bookmarkCount: 0 }),
    candidate({ rankingId: 'p-high', uniqueViewCount: 1_000_000, likeCount: 0, bookmarkCount: 0 }),
  ],
  profile: emptyProfile,
  session: null,
  referenceTime: ref,
  seed: 'pop',
  policy: { ...fixturePolicy, exploration: { ...fixturePolicy.exploration, slotIndexes: [], maximumPromotions: 0 } },
})
const popById = Object.fromEntries(popularityResult.candidates.map((entry) => [entry.rankingId, entry.breakdown.popularityScore]))
assert(popById['p-high'] === 1, 'maximum compressed popularity should normalize to 1')
assert(popById['p-low'] > 0.1, 'logarithmic compression must prevent raw million-vs-ten counts from becoming a million-vs-ten score ratio')

const exposureResult = rankRf1Feed({
  candidates: [
    candidate({ rankingId: 'exposed', recentExposureCount: 20 }),
    candidate({ rankingId: 'low-exposure', recentExposureCount: 0 }),
    candidate({ rankingId: 'low-quality', recentExposureCount: 0, neighborhood: { tier: 'D', itemJaccard: 0, lexicalJaccard: 0 } }),
  ],
  profile: emptyProfile,
  session: null,
  referenceTime: ref,
  seed: 'exposure',
  policy: { ...fixturePolicy, exploration: { ...fixturePolicy.exploration, slotIndexes: [], maximumPromotions: 0 } },
})
const exposureById = Object.fromEntries(exposureResult.candidates.map((entry) => [entry.rankingId, entry.breakdown]))
assert(exposureById['low-exposure'].lowExposureBoost > 0, 'eligible low-exposure content should receive a discovery opportunity')
assert(exposureById['low-exposure'].lowExposureBoost <= fixturePolicy.score.lowExposureMaximumBoost, 'low-exposure boost must be bounded')
assert(exposureById['low-quality'].lowExposureBoost === 0, 'low exposure must not promote candidates below the neighborhood quality floor')

const diversityResult = rankRf1Feed({
  candidates: [
    candidate({ rankingId: 'fifa-1', categoryId: 'sports', subcategoryId: 'fifa', uniqueViewCount: 100 }),
    candidate({ rankingId: 'fifa-2', categoryId: 'sports', subcategoryId: 'fifa', uniqueViewCount: 90 }),
    candidate({ rankingId: 'kbo-1', categoryId: 'sports', subcategoryId: 'kbo', uniqueViewCount: 80 }),
    candidate({ rankingId: 'culture-1', categoryId: 'culture', subcategoryId: 'music', uniqueViewCount: 70 }),
  ],
  profile: emptyProfile,
  session: null,
  referenceTime: ref,
  seed: 'diversity',
  policy: { ...fixturePolicy, exploration: { ...fixturePolicy.exploration, slotIndexes: [], maximumPromotions: 0 } },
})
assert(diversityResult.candidates.slice(0, 2).filter((entry) => entry.subcategoryId === 'fifa').length <= 1, 'diversity reranking should suppress immediate same-subcategory repetition when alternatives exist')
assert(diversityResult.candidates.every((entry) => Math.abs(entry.finalRank - entry.baseRank) <= 3), 'diversity movement must remain within fixture promotion/demotion bounds')

const shortagePolicy = {
  ...fixturePolicy,
  diversity: {
    ...fixturePolicy.diversity,
    caps: { category: 1, subcategory: 1, rankingType: 1 },
    windowSize: 3,
  },
  exploration: { ...fixturePolicy.exploration, slotIndexes: [], maximumPromotions: 0 },
}
const shortageResult = rankRf1Feed({
  candidates: [
    candidate({ rankingId: 'same-1', categoryId: 'sports', subcategoryId: 'fifa' }),
    candidate({ rankingId: 'same-2', categoryId: 'sports', subcategoryId: 'fifa' }),
    candidate({ rankingId: 'same-3', categoryId: 'sports', subcategoryId: 'fifa' }),
  ],
  profile: emptyProfile,
  session: null,
  referenceTime: ref,
  seed: 'shortage',
  policy: shortagePolicy,
})
assert(shortageResult.candidates.length === 3, 'candidate shortage must not block feed completion')
assert(shortageResult.candidates.some((entry) => entry.appliedRelaxations.length > 0), 'candidate shortage must use progressive relaxation rather than fail')

const explorationProfile = buildRf1BehaviorProfile([
  event({ eventId: 'sports-save-1', eventType: 'SAVE', features: [feature('category', 'sports')] }),
  event({ eventId: 'sports-save-2', eventType: 'SAVE', features: [feature('category', 'sports')] }),
], ref, behaviorPolicy, maturityPolicy)
const explorationCandidates = [
  candidate({ rankingId: 'sports-1', categoryId: 'sports', subcategoryId: 'football', uniqueViewCount: 100 }),
  candidate({ rankingId: 'sports-2', categoryId: 'sports', subcategoryId: 'baseball', uniqueViewCount: 90 }),
  candidate({ rankingId: 'sports-3', categoryId: 'sports', subcategoryId: 'basketball', uniqueViewCount: 80 }),
  candidate({ rankingId: 'culture-discovery', categoryId: 'culture', subcategoryId: 'music', uniqueViewCount: 70 }),
  candidate({ rankingId: 'bad-discovery', categoryId: 'tech', subcategoryId: 'misc', uniqueViewCount: 60, neighborhood: { tier: 'D', itemJaccard: 0, lexicalJaccard: 0 } }),
]
const explorationA = rankRf1Feed({ candidates: explorationCandidates, profile: explorationProfile, session: null, referenceTime: ref, seed: 'explore-1', policy: fixturePolicy })
const explorationB = rankRf1Feed({ candidates: [...explorationCandidates].reverse(), profile: explorationProfile, session: null, referenceTime: ref, seed: 'explore-1', policy: fixturePolicy })
assert(explorationA.fingerprint === explorationB.fingerprint, 'exploration must be deterministic for the same seed/context/profile/candidate set')
assert(!explorationA.candidates.find((entry) => entry.rankingId === 'bad-discovery')?.explored, 'exploration candidate must pass the quality gate')
const exploredEntries = explorationA.candidates.filter((entry) => entry.explored)
assert(exploredEntries.length <= fixturePolicy.exploration.maximumPromotions, 'exploration promotions must be bounded')

const evidence = createRf1ExposureEvidence({
  recommendationRunId: 'run-123',
  profile: explorationProfile,
  session: null,
  result: explorationA,
  exposedAt: ref,
})
assert(evidence.length === explorationA.candidates.length, 'every final feed candidate must be representable as exposure evidence')
assert(evidence.every((entry) => entry.exposureId === `run-123:${entry.rankingId}`), 'exposure identity must deterministically bind run and ranking')
assert(evidence.every((entry) => entry.profileFingerprint === explorationProfile.fingerprint), 'exposure evidence must bind the exact profile fingerprint')
assert(evidence.every((entry) => entry.policyBundleVersion === fixturePolicy.policyBundleVersion), 'exposure evidence must bind the exact policy bundle version')
assert(evidence.every((entry) => typeof entry.scoreBreakdown.finalScore === 'number'), 'exposure evidence must retain score breakdown')

const stableA = stableFingerprint({ b: 2, a: 1 })
const stableB = stableFingerprint({ a: 1, b: 2 })
assert(stableA === stableB, 'canonical fingerprint must be independent of object key insertion order')

// Directly exercise exported exploration helper to ensure it cannot insert arbitrary unknown candidates.
const isolated = applyRf1Exploration([], emptyProfile, null, 'seed', fixturePolicy.exploration)
assert(Array.isArray(isolated) && isolated.length === 0, 'exploration must only reorder the supplied candidate pool')

console.log('RF-1 recommendation contracts: PASS')
