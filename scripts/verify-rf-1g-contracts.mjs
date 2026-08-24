import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const calibrationPath = path.join(root, 'src/lib/recommendation/rf1-calibration-evidence.ts')
const corePath = path.join(root, 'src/lib/recommendation/rf1-core.ts')
const shadowServerPath = path.join(root, 'src/lib/recommendation/rf1-shadow-evidence-server.ts')
const hypothesisPath = path.join(root, 'src/lib/recommendation/rf1-policy-hypothesis.ts')
const rankingPagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')

function fail(message) {
  console.error(`RF-1G contract failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function expectThrow(fn, message) {
  let threw = false
  try {
    fn()
  } catch {
    threw = true
  }
  assert(threw, message)
}

for (const requiredPath of [calibrationPath, corePath, shadowServerPath, hypothesisPath, rankingPagePath]) {
  assert(fs.existsSync(requiredPath), `${path.relative(root, requiredPath)} must exist`)
}

const source = fs.readFileSync(calibrationPath, 'utf8')
const coreSource = fs.readFileSync(corePath, 'utf8')
const shadowServerSource = fs.readFileSync(shadowServerPath, 'utf8')
const hypothesisSource = fs.readFileSync(hypothesisPath, 'utf8')
const rankingPageSource = fs.readFileSync(rankingPagePath, 'utf8')

assert(source.includes("productionPolicyAuthorized: false"), 'RF-1G worksheet must never authorize production policy')
assert(source.includes("automaticPolicyDerivation: 'FORBIDDEN'"), 'automatic policy derivation must be explicitly forbidden')
assert(source.includes('productionPolicyBundle: null'), 'RF-1G must not materialize a production policy bundle from sparse evidence')
assert(source.includes("'LONGITUDINAL_EVIDENCE_REQUIRED'"), 'behavior/maturity numerics must be able to require longitudinal evidence')
assert(source.includes("'OUTCOME_EVIDENCE_REQUIRED'"), 'ranking/scoring numerics must be able to require outcome evidence')
assert(source.includes("'STRUCTURAL_EVIDENCE_ONLY'"), 'structural observations must be distinguishable from outcome calibration evidence')
assert(source.includes('UNOBSERVED_NEIGHBORHOOD_TIERS:'), 'unobserved Neighborhood tiers must remain explicit')
assert(source.includes('UNOBSERVED_LIVE_POPULARITY_CHANNELS:'), 'unobserved popularity channels must remain explicit')
assert(source.includes('NO_RF1_USER_VISIBLE_EXPOSURE'), 'missing real RF-1 exposure must remain explicit')
assert(source.includes('NO_RF1_ATTRIBUTED_RELATED_OUTCOME'), 'missing exact RF-1 outcome must remain explicit')
assert(source.includes('NO_DURABLE_RF1_SHADOW_RUN'), 'missing durable SHADOW evidence must remain explicit')
assert(source.includes('rf1AttributedRelatedRankingClickCount'), 'RF-1G must consume the exact RF-1E attributed-outcome evidence dimension')
assert(source.includes('maximumNeighborhoodCandidateCount'), 'candidate depth must be an observed structural fact')
assert(source.includes('topUniqueViewShare'), 'popularity skew must be retained as an observed fact')
assert(!source.includes('DEFAULT_RF1_POLICY'), 'RF-1G must not embed a default RF-1 policy')
assert(!source.includes('PRODUCTION_RF1_POLICY'), 'RF-1G must not embed a production RF-1 policy')
assert(!source.includes('as Rf1PolicyBundle'), 'RF-1G must not cast a worksheet into an executable RF-1 policy')
assert(!source.includes('rankRf1Feed('), 'calibration worksheet construction must not execute ranking')
assert(!source.includes('recordRf1ShadowEvidence('), 'calibration worksheet construction must not fabricate SHADOW evidence')
assert(!source.includes('recordRf1RelatedExposureRecords('), 'calibration worksheet construction must not fabricate exposure evidence')
assert(coreSource.includes('export type Rf1PolicyBundle'), 'governed RF-1 policy bundle contract must remain defined in the core')
assert(hypothesisSource.includes('policy: Rf1PolicyBundle'), 'reviewed SHADOW hypothesis must still contain the complete caller-supplied RF-1 policy bundle')
assert(shadowServerSource.includes('hypothesis: Rf1ReviewedShadowPolicyHypothesis'), 'actual durable SHADOW capture must require an explicit reviewed hypothesis rather than deriving policy from RF-1G')
assert(shadowServerSource.includes('policy: reviewedHypothesis.policy'), 'actual SHADOW execution must receive the exact complete policy from the reviewed hypothesis')
assert(!rankingPageSource.includes('buildRf1CalibrationWorksheet'), 'public ranking page must remain outside RF-1G calibration logic')

const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    strict: true,
  },
  fileName: calibrationPath,
}).outputText
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
const calibration = await import(moduleUrl)

const sparseSnapshot = {
  capturedAt: '2026-08-24T07:10:00.000Z',
  publishedRankingCount: 16,
  categoryCount: 6,
  subcategoryCount: 9,
  rankingTypeCount: 1,
  publicationSpanHours: 69.88,
  oldestPublicationAgeHours: 126.52,
  newestPublicationAgeHours: 56.63,
  totalUniqueViews: 90,
  rankingsWithUniqueViews: 4,
  maximumUniqueViews: 87,
  topUniqueViewShare: 0.9667,
  liveLikeCount: 0,
  liveBookmarkCount: 0,
  changedBookmarkEventCount: 3,
  changedBookmarkUserCount: 2,
  saveEventCount: 2,
  unsaveEventCount: 1,
  neighborhoodDirectedPairCount: 18,
  neighborhoodTierCounts: { A: 14, B: 0, C: 4, D: 0 },
  sourcesWithNeighborhoodCandidate: 12,
  maximumNeighborhoodCandidateCount: 2,
  semanticEligibleProjectionCount: 13,
  semanticSharedSubjectCount: 4,
  identityDirectedPairCount: 16,
  identityRelationCounts: { same_version: 0, same_view: 0, same_claim: 0, same_subject: 16 },
  productUsageEventCount: 219,
  relatedRankingClickCount: 0,
  rf1AttributedRelatedRankingClickCount: 0,
  rf1ExposureCount: 0,
  durableShadowRunCount: 0,
}

const worksheet = calibration.buildRf1CalibrationWorksheet(sparseSnapshot)
assert(worksheet.productionPolicyAuthorized === false, 'sparse evidence must not authorize production policy')
assert(worksheet.automaticPolicyDerivation === 'FORBIDDEN', 'automatic policy derivation must remain forbidden')
assert(worksheet.productionPolicyBundle === null, 'sparse evidence must not produce an executable policy bundle')
assert(worksheet.directOutcomeEvidencePresent === false, 'zero exact attributed outcomes must remain false')
assert(worksheet.userVisibleExposureEvidencePresent === false, 'zero RF-1 exposures must remain false')
assert(worksheet.durableShadowEvidencePresent === false, 'zero durable SHADOW rows must remain false')
assert(worksheet.observedNeighborhoodTiers.join(',') === 'A,C', 'observed A/C tiers must remain explicit')
assert(worksheet.unobservedNeighborhoodTiers.join(',') === 'B,D', 'unobserved B/D tiers must remain explicit')
assert(worksheet.observedPopularityChannels.join(',') === 'uniqueViews', 'unique views must be the only observed live popularity channel in the fixture')
assert(worksheet.unobservedPopularityChannels.join(',') === 'likes,bookmarks', 'zero live likes/bookmarks must remain unobserved')
assert(worksheet.structuralGaps.includes('SINGLE_RANKING_TYPE_OBSERVED'), 'single ranking type must be surfaced as a diversity limitation')
assert(worksheet.structuralGaps.includes('NO_RF1_USER_VISIBLE_EXPOSURE'), 'missing exposure must be surfaced')
assert(worksheet.structuralGaps.includes('NO_RF1_ATTRIBUTED_RELATED_OUTCOME'), 'missing attributed outcome must be surfaced')
assert(worksheet.structuralGaps.includes('NO_DURABLE_RF1_SHADOW_RUN'), 'missing SHADOW evidence must be surfaced')

const byFamily = new Map(worksheet.assessments.map((entry) => [entry.family, entry]))
assert(byFamily.get('behavior_aggregation')?.state === 'LONGITUDINAL_EVIDENCE_REQUIRED', 'observed SAVE/UNSAVE evidence must not be mistaken for calibrated behavior timing')
assert(byFamily.get('neighborhood_scoring')?.state === 'OUTCOME_EVIDENCE_REQUIRED', 'observed candidate relations must still require outcomes for numeric scoring')
assert(byFamily.get('component_scoring')?.state === 'NO_DIRECT_EVIDENCE', 'zero exact RF-1 outcomes must block component-weight calibration')
assert(byFamily.get('freshness')?.state === 'STRUCTURAL_EVIDENCE_ONLY', 'publication ages without outcomes are structural evidence only')
assert(byFamily.get('popularity')?.state === 'STRUCTURAL_EVIDENCE_ONLY', 'popularity counts without outcomes are structural evidence only')
assert(byFamily.get('low_exposure')?.state === 'NO_DIRECT_EVIDENCE', 'zero real RF-1 exposures must block low-exposure calibration')
assert(byFamily.get('exploration')?.state === 'NO_DIRECT_EVIDENCE', 'zero exposure/outcome evidence must block exploration calibration')

expectThrow(() => calibration.buildRf1CalibrationWorksheet({
  ...sparseSnapshot,
  neighborhoodDirectedPairCount: 17,
}), 'inconsistent tier totals must fail closed')

expectThrow(() => calibration.buildRf1CalibrationWorksheet({
  ...sparseSnapshot,
  topUniqueViewShare: 1.01,
}), 'invalid popularity share must fail closed')

expectThrow(() => calibration.buildRf1CalibrationWorksheet({
  ...sparseSnapshot,
  rf1AttributedRelatedRankingClickCount: 1,
}), 'RF-1 attributed outcomes cannot exceed generic related-ranking outcomes')

console.log('RF-1G non-authorizing calibration evidence contracts: PASS')
