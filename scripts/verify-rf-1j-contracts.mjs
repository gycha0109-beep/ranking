import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const corePath = path.join(root, 'src/lib/recommendation/rf1-core.ts')
const calibrationPath = path.join(root, 'src/lib/recommendation/rf1-initial-policy-calibration.ts')
const pagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')

function fail(message) {
  console.error(`RF-1J contract failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

for (const requiredPath of [corePath, calibrationPath, pagePath]) {
  assert(fs.existsSync(requiredPath), `${path.relative(root, requiredPath)} must exist`)
}

const coreSource = fs.readFileSync(corePath, 'utf8')
const calibrationSource = fs.readFileSync(calibrationPath, 'utf8')
const pageSource = fs.readFileSync(pagePath, 'utf8')

assert(calibrationSource.includes("calibrationStatus: typeof RF1J_CALIBRATION_STATUS"), 'calibration must expose an explicit non-production status')
assert(calibrationSource.includes('shadowExecutionAuthorized: false'), 'initial calibration must not self-authorize SHADOW execution')
assert(calibrationSource.includes('productionActivationAuthorized: false'), 'initial calibration must not authorize production activation')
assert(calibrationSource.includes('lowExposureMaximumBoost: 0'), 'low-exposure boost must remain disabled without exposure evidence')
assert(calibrationSource.includes('maximumPromotions: 0'), 'exploration must remain disabled without outcome evidence')
assert(calibrationSource.includes('slotIndexes: []'), 'disabled exploration must not reserve a production slot')
assert(calibrationSource.includes('QUICK_SKIP: 0'), 'QUICK_SKIP must remain zero-weight until raw visibility evidence is classified')
assert(calibrationSource.includes('DWELL: 0'), 'DWELL must remain zero-weight until raw visibility evidence is classified')
assert(calibrationSource.includes('SAVE: 1'), 'authenticated SAVE must remain the positive long-term profile authority')
assert(calibrationSource.includes('UNSAVE: -1'), 'authenticated UNSAVE must remain the negative long-term profile authority')
assert(!calibrationSource.includes('productionActivationAuthorized: true'), 'RF-1J must contain no production activation authorization')
assert(!calibrationSource.includes("reviewStatus: 'REVIEWED_FOR_SHADOW_ONLY'"), 'synthetic calibration must not impersonate a reviewed SHADOW hypothesis')
assert(!pageSource.includes('RF1_INITIAL_POLICY_CANDIDATE_V1'), 'public ranking page must not consume the initial policy candidate')
assert(!pageSource.includes('RF1_INITIAL_POLICY_CALIBRATION_V1'), 'public ranking page must remain outside RF-1J calibration')

const coreJs = ts.transpileModule(coreSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, strict: true },
  fileName: corePath,
}).outputText
const coreUrl = `data:text/javascript;base64,${Buffer.from(coreJs).toString('base64')}`
const coreModule = await import(coreUrl)

let calibrationJs = ts.transpileModule(calibrationSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, strict: true },
  fileName: calibrationPath,
}).outputText
calibrationJs = calibrationJs.replace("from './rf1-core'", `from '${coreUrl}'`)
const calibrationUrl = `data:text/javascript;base64,${Buffer.from(calibrationJs).toString('base64')}`
const calibrationModule = await import(calibrationUrl)

const calibration = calibrationModule.buildRf1InitialPolicyCalibration()
const repeatedCalibration = calibrationModule.buildRf1InitialPolicyCalibration()
const policy = coreModule.validateRf1PolicyBundle(calibration.policy)

assert(calibration.calibrationStatus === 'SYNTHETICALLY_VALIDATED_CANDIDATE', 'calibration status must remain candidate-only')
assert(calibration.shadowExecutionAuthorized === false, 'calibration candidate must require separate SHADOW review')
assert(calibration.productionActivationAuthorized === false, 'calibration candidate must never activate production')
assert(calibration.candidateFingerprint === repeatedCalibration.candidateFingerprint, 'calibration fingerprint must be deterministic')
assert(calibration.observedCorpus.publishedRankingCount === 16, 'RF-1J corpus snapshot must bind the observed 16-ranking production corpus')
assert(calibration.observedCorpus.rankingTypeCount === 1, 'RF-1J must retain the single-ranking-type structural limitation')
assert(calibration.observedCorpus.maximumNeighborhoodCandidateCount === 2, 'RF-1J must retain shallow observed Neighborhood depth')
assert(calibration.observedCorpus.totalUniqueViews === 90, 'RF-1J must bind the observed popularity total')
assert(calibration.observedCorpus.maximumUniqueViews === 87, 'RF-1J must bind observed popularity concentration')
assert(calibration.observedCorpus.rf1ExposureCount === 0, 'RF-1J must not invent RF-1 exposure evidence')
assert(calibration.observedCorpus.durableShadowRunCount === 0, 'RF-1J must not invent durable SHADOW evidence')
assert(calibration.observedCorpus.rawRelatedVisibilityObservationCount === 0, 'RF-1J must not invent raw visibility evidence')
assert(policy.score.componentWeightsByMaturity.EMPTY.neighborhood > policy.score.componentWeightsByMaturity.EMPTY.popularity, 'cold-start policy must prefer Neighborhood over sparse popularity')
assert(policy.score.componentWeightsByMaturity.ESTABLISHED.interest > policy.score.componentWeightsByMaturity.EMPTY.interest, 'interest contribution must rise with profile maturity')
assert(policy.score.lowExposureMaximumBoost === 0, 'validated policy must keep low-exposure boost disabled')
assert(policy.exploration.maximumPromotions === 0 && policy.exploration.slotIndexes.length === 0, 'validated policy must keep exploration disabled')
assert(policy.behavior.eventWeights.QUICK_SKIP === 0 && policy.behavior.eventWeights.DWELL === 0, 'long-term raw visibility judgments must remain unclassified')
assert(policy.sessionBehavior.eventWeights.QUICK_SKIP === 0 && policy.sessionBehavior.eventWeights.DWELL === 0, 'session raw visibility judgments must remain unclassified')

const HOUR = 3_600_000
const DAY = 24 * HOUR
const referenceTime = '2026-08-24T08:00:00.000Z'
const referenceMs = Date.parse(referenceTime)
const isoBefore = (millis) => new Date(referenceMs - millis).toISOString()

const candidates = [
  {
    rankingId: 'a-neighborhood',
    categoryId: 'sports',
    subcategoryId: 'kbo',
    rankingType: 'metric',
    itemIds: ['lg-twins', 'samsung-lions'],
    publishedAt: isoBefore(DAY),
    neighborhood: { tier: 'A', itemJaccard: 0.5, lexicalJaccard: 0.3 },
    uniqueViewCount: 4,
    likeCount: 0,
    bookmarkCount: 0,
    recentExposureCount: 0,
  },
  {
    rankingId: 'b-affinity',
    categoryId: 'sports',
    subcategoryId: 'kbo',
    rankingType: 'metric',
    itemIds: ['doosan-bears'],
    publishedAt: isoBefore(2 * DAY),
    neighborhood: { tier: 'A', itemJaccard: 0.4, lexicalJaccard: 0.4 },
    uniqueViewCount: 0,
    likeCount: 0,
    bookmarkCount: 0,
    recentExposureCount: 0,
  },
  {
    rankingId: 'c-popularity-outlier',
    categoryId: 'education',
    subcategoryId: 'pisa',
    rankingType: 'metric',
    itemIds: ['singapore'],
    publishedAt: isoBefore(DAY / 2),
    neighborhood: { tier: 'C', itemJaccard: 0, lexicalJaccard: 0.5 },
    uniqueViewCount: 87,
    likeCount: 0,
    bookmarkCount: 0,
    recentExposureCount: 0,
  },
  {
    rankingId: 'd-fresh-weak',
    categoryId: 'sports',
    subcategoryId: 'fifa',
    rankingType: 'metric',
    itemIds: ['argentina'],
    publishedAt: isoBefore(HOUR),
    neighborhood: { tier: 'D', itemJaccard: 0, lexicalJaccard: 0.2 },
    uniqueViewCount: 0,
    likeCount: 0,
    bookmarkCount: 0,
    recentExposureCount: 0,
  },
]

const emptyProfile = coreModule.buildRf1BehaviorProfile([], referenceTime, policy.behavior, policy.maturity)
assert(emptyProfile.maturity === 'EMPTY', 'empty replay profile must remain EMPTY')

const cold = coreModule.rankRf1Feed({
  candidates,
  profile: emptyProfile,
  session: null,
  referenceTime,
  seed: 'rf1j-cold',
  policy,
})
const coldReversed = coreModule.rankRf1Feed({
  candidates: [...candidates].reverse(),
  profile: emptyProfile,
  session: null,
  referenceTime,
  seed: 'rf1j-cold',
  policy,
})
assert(cold.candidates.map((candidate) => candidate.rankingId).join('|') === coldReversed.candidates.map((candidate) => candidate.rankingId).join('|'), 'initial policy replay must be candidate-order independent')
assert(cold.fingerprint === coldReversed.fingerprint, 'candidate-order-independent replay must fingerprint identically')
assert(cold.candidates[0].rankingId === 'a-neighborhood', 'strong Neighborhood relevance must beat the sparse popularity outlier at cold start')
assert(cold.candidates.findIndex((candidate) => candidate.rankingId === 'c-popularity-outlier') > 0, '87/90 observed-view concentration must not become the primary relevance authority')
assert(cold.candidates.every((candidate) => candidate.breakdown.lowExposureBoost === 0), 'no synthetic replay candidate may receive low-exposure boost')
assert(cold.candidates.every((candidate) => candidate.explored === false), 'no synthetic replay candidate may be explored')

const saveEvents = Array.from({ length: 5 }, (_, index) => ({
  eventId: `save-${index + 1}`,
  eventType: 'SAVE',
  occurredAt: isoBefore(index * HOUR),
  magnitude: 1,
  features: [{ kind: 'item', id: 'doosan-bears' }],
}))
const establishedProfile = coreModule.buildRf1BehaviorProfile(saveEvents, referenceTime, policy.behavior, policy.maturity)
assert(establishedProfile.maturity === 'ESTABLISHED', 'five durable SAVE events must reach the initial established-profile gate')
const personalized = coreModule.rankRf1Feed({
  candidates,
  profile: establishedProfile,
  session: null,
  referenceTime,
  seed: 'rf1j-personalized',
  policy,
})
const personalizedAffinity = personalized.candidates.find((candidate) => candidate.rankingId === 'b-affinity')
const coldAffinity = cold.candidates.find((candidate) => candidate.rankingId === 'b-affinity')
assert(personalizedAffinity && coldAffinity, 'affinity candidate must exist in replay outputs')
assert(personalizedAffinity.breakdown.interestScore > coldAffinity.breakdown.interestScore, 'durable SAVE affinity must raise candidate interest score')
assert(personalized.candidates[0].rankingId === 'b-affinity', 'established item affinity must be able to outrank a nearby neutral candidate')

const unsaveEvents = Array.from({ length: 5 }, (_, index) => ({
  eventId: `unsave-${index + 1}`,
  eventType: 'UNSAVE',
  occurredAt: isoBefore(index * HOUR),
  magnitude: 1,
  features: [{ kind: 'item', id: 'doosan-bears' }],
}))
const negativeProfile = coreModule.buildRf1BehaviorProfile(unsaveEvents, referenceTime, policy.behavior, policy.maturity)
const negative = coreModule.rankRf1Feed({
  candidates,
  profile: negativeProfile,
  session: null,
  referenceTime,
  seed: 'rf1j-negative',
  policy,
})
const negativeAffinity = negative.candidates.find((candidate) => candidate.rankingId === 'b-affinity')
assert(negativeAffinity && negativeAffinity.breakdown.interestScore < 0.5, 'UNSAVE evidence must produce negative affinity rather than a positive preference')
assert(negativeAffinity.finalRank > personalizedAffinity.finalRank, 'negative affinity must rank below the same candidate under established SAVE affinity')

const rawVisibilitySession = coreModule.buildRf1SessionInterest([
  {
    eventId: 'quick-skip-unclassified',
    eventType: 'QUICK_SKIP',
    occurredAt: isoBefore(5 * 60_000),
    magnitude: 1,
    features: [{ kind: 'item', id: 'doosan-bears' }],
  },
  {
    eventId: 'dwell-unclassified',
    eventType: 'DWELL',
    occurredAt: isoBefore(4 * 60_000),
    magnitude: 1,
    features: [{ kind: 'item', id: 'doosan-bears' }],
  },
], referenceTime, policy.sessionBehavior)
assert(rawVisibilitySession.acceptedEventCount === 0, 'QUICK_SKIP/DWELL must remain ignored until RF-1I observations support a reviewed classifier')
assert(rawVisibilitySession.signals.length === 0, 'unclassified raw visibility events must not influence session interest')

const relatedSession = coreModule.buildRf1SessionInterest([
  {
    eventId: 'related-open-1',
    eventType: 'RELATED_OPEN',
    occurredAt: isoBefore(5 * 60_000),
    magnitude: 1,
    features: [{ kind: 'item', id: 'doosan-bears' }],
  },
], referenceTime, policy.sessionBehavior)
const sessionRanked = coreModule.rankRf1Feed({
  candidates,
  profile: emptyProfile,
  session: relatedSession,
  referenceTime,
  seed: 'rf1j-session',
  policy,
})
const sessionAffinity = sessionRanked.candidates.find((candidate) => candidate.rankingId === 'b-affinity')
assert(sessionAffinity && sessionAffinity.breakdown.interestScore > coldAffinity.breakdown.interestScore, 'explicit RELATED_OPEN session evidence must be able to raise short-term affinity')

console.log('RF-1J initial policy calibration + synthetic replay contracts: PASS')
