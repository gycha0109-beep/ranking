import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const corePath = path.join(root, 'src/lib/recommendation/rf1-core.ts')
const calibrationPath = path.join(root, 'src/lib/recommendation/rf1-calibration-evidence.ts')
const hypothesisPath = path.join(root, 'src/lib/recommendation/rf1-policy-hypothesis.ts')
const evidencePath = path.join(root, 'src/lib/recommendation/rf1-shadow-evidence.ts')
const serverPath = path.join(root, 'src/lib/recommendation/rf1-shadow-evidence-server.ts')
const migrationPath = path.join(root, 'supabase/migrations/20260824074000_rf_1h_shadow_policy_hypothesis_provenance.sql')
const rankingPagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')

function fail(message) {
  console.error(`RF-1H contract failed: ${message}`)
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

for (const requiredPath of [corePath, calibrationPath, hypothesisPath, evidencePath, serverPath, migrationPath, rankingPagePath]) {
  assert(fs.existsSync(requiredPath), `${path.relative(root, requiredPath)} must exist`)
}

const coreSource = fs.readFileSync(corePath, 'utf8')
const hypothesisSource = fs.readFileSync(hypothesisPath, 'utf8')
const evidenceSource = fs.readFileSync(evidencePath, 'utf8')
const serverSource = fs.readFileSync(serverPath, 'utf8')
const migration = fs.readFileSync(migrationPath, 'utf8')
const rankingPageSource = fs.readFileSync(rankingPagePath, 'utf8')

assert(hypothesisSource.includes("reviewStatus: 'REVIEWED_FOR_SHADOW_ONLY'"), 'reviewed policy hypothesis must be explicitly SHADOW-only')
assert(hypothesisSource.includes('productionActivationAuthorized: false'), 'reviewed policy hypothesis must never authorize production activation')
assert(hypothesisSource.includes('evidenceDocumentRefs'), 'reviewed policy hypothesis must bind evidence document references')
assert(hypothesisSource.includes('rationaleByFamily'), 'reviewed policy hypothesis must require rationale for each calibration family')
assert(hypothesisSource.includes("domain: 'rankingwiki:rf1-shadow-policy-hypothesis:v1'"), 'policy hypothesis must use an explicit deterministic fingerprint domain')
assert(hypothesisSource.includes('validateRf1PolicyBundle(hypothesis.policy)'), 'reviewed hypothesis must validate the complete governed RF-1 policy bundle')
assert(hypothesisSource.includes('stableFingerprint(fingerprintPayload)'), 'reviewed policy hypothesis must fingerprint actual policy content and review provenance')
assert(!hypothesisSource.includes('DEFAULT_RF1_POLICY'), 'RF-1H must not invent a default policy')
assert(!hypothesisSource.includes('PRODUCTION_RF1_POLICY'), 'RF-1H must not invent a production policy constant')

assert(evidenceSource.includes('policyHypothesisFingerprint'), 'durable SHADOW evidence type must bind reviewed policy provenance')
assert(evidenceSource.includes("domain: 'rankingwiki:rf1-shadow-run:v2'"), 'SHADOW run fingerprint must include reviewed policy provenance')
assert(serverSource.includes('validateRf1ReviewedShadowPolicyHypothesis(input.hypothesis)'), 'durable capture must validate review provenance before SHADOW execution')
assert(serverSource.includes('policy_hypothesis_fingerprint: record.policyHypothesisFingerprint'), 'service-role writer payload must persist the hypothesis fingerprint')
assert(serverSource.includes('shadow.policyBundleVersion !== reviewedHypothesis.policy.policyBundleVersion'), 'durable capture must verify SHADOW policy version matches reviewed hypothesis')

assert(migration.includes('ADD COLUMN policy_hypothesis_fingerprint TEXT'), 'RF-1H must add durable policy hypothesis provenance')
assert(migration.includes('ALTER COLUMN policy_hypothesis_fingerprint SET NOT NULL'), 'durable SHADOW rows must require policy hypothesis provenance')
assert(migration.includes('cannot infer policy hypothesis provenance for pre-existing SHADOW rows'), 'unknown historical SHADOW policy provenance must fail closed')
assert(migration.includes('v_policy_hypothesis_fingerprint := p_record ->> \'policy_hypothesis_fingerprint\''), 'DB writer must parse exact hypothesis fingerprint')
assert(migration.includes('s.policy_hypothesis_fingerprint = v_policy_hypothesis_fingerprint'), 'idempotent replay equality must include policy hypothesis provenance')
assert(migration.includes("'policy_hypothesis_fingerprint', v_policy_hypothesis_fingerprint"), 'write RPC response must expose persisted hypothesis provenance')
assert(migration.includes('v_candidate_count < 1'), 'RF-1F non-empty SHADOW invariant must remain enforced in the replacement writer')
assert(migration.includes('v_current_ranking_id = ANY(v_baseline_ranking_ids)'), 'RF-1F source exclusion invariant must remain enforced in the replacement writer')
assert(migration.includes('GRANT EXECUTE ON FUNCTION public.record_rf1_shadow_run(JSONB)\nTO service_role'), 'reviewed-policy SHADOW writer must remain service-role-only')
assert(!migration.includes('production_policy_authorized'), 'RF-1H provenance migration must not create a production authorization path')
assert(!rankingPageSource.includes('validateRf1ReviewedShadowPolicyHypothesis'), 'public ranking page must remain outside policy hypothesis review/admission')

const coreJs = ts.transpileModule(coreSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, strict: true },
  fileName: corePath,
}).outputText
const coreUrl = `data:text/javascript;base64,${Buffer.from(coreJs).toString('base64')}`

let hypothesisJs = ts.transpileModule(hypothesisSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, strict: true },
  fileName: hypothesisPath,
}).outputText
hypothesisJs = hypothesisJs.replace("from './rf1-core'", `from '${coreUrl}'`)
const hypothesisUrl = `data:text/javascript;base64,${Buffer.from(hypothesisJs).toString('base64')}`
const hypothesisModule = await import(hypothesisUrl)

const DAY = 86_400_000
const eventTypes = [
  'FEED_IMPRESSION', 'RANKING_VIEW', 'QUICK_SKIP', 'DWELL', 'RANKING_EXPAND',
  'DETAIL_OPEN', 'RELATED_OPEN', 'SAVE', 'UNSAVE', 'SHARE', 'HIDE',
]
const eventWeights = {
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
const halfLives = Object.fromEntries(eventTypes.map((eventType) => [eventType, 7 * DAY]))
const behavior = {
  policyVersion: 'rf1h-profile-fixture-v1',
  lookbackMs: 30 * DAY,
  eventWeights,
  eventHalfLifeMs: halfLives,
  saturationScale: 1,
  minimumSignalStrength: 0.01,
  maximumEvents: 100,
}
const sessionBehavior = { ...behavior, policyVersion: 'rf1h-session-fixture-v1', lookbackMs: DAY }
const policy = {
  policyBundleVersion: 'rf1h-policy-fixture-v1',
  profilePolicyVersion: behavior.policyVersion,
  sessionPolicyVersion: sessionBehavior.policyVersion,
  scorePolicyVersion: 'rf1h-score-fixture-v1',
  diversityPolicyVersion: 'rf1h-diversity-fixture-v1',
  explorationPolicyVersion: 'rf1h-exploration-fixture-v1',
  behavior,
  sessionBehavior,
  maturity: {
    policyVersion: 'rf1h-maturity-fixture-v1',
    emergingAcceptedEventThreshold: 2,
    establishedAcceptedEventThreshold: 4,
    establishedAbsoluteWeightThreshold: 1,
  },
  neighborhood: {
    policyVersion: 'rf1h-neighborhood-fixture-v1',
    tierBase: { A: 0.7, B: 0.55, C: 0.4, D: 0.25 },
    itemJaccardWeight: 1,
    lexicalJaccardWeight: 1,
  },
  score: {
    policyVersion: 'rf1h-score-fixture-v1',
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
    policyVersion: 'rf1h-diversity-fixture-v1',
    windowSize: 3,
    caps: { category: 2, subcategory: 1, rankingType: 2 },
    relaxationOrder: ['rankingType', 'category', 'subcategory'],
    maxPromotionDistance: 3,
    maxDemotionDistance: 3,
  },
  exploration: {
    policyVersion: 'rf1h-exploration-fixture-v1',
    slotIndexes: [3],
    maximumPromotions: 1,
    maxPromotionDistance: 3,
    minimumNeighborhoodScore: 0.45,
    minimumBaseScore: 0.35,
    minimumFreshnessScore: 0.2,
    positiveInterestBoundary: 0.2,
  },
}

const rationaleByFamily = Object.fromEntries(
  hypothesisModule.RF1_CALIBRATION_FAMILIES.map((family) => [family, `reviewed fixture rationale for ${family}`]),
)

const reviewed = {
  reviewStatus: 'REVIEWED_FOR_SHADOW_ONLY',
  productionActivationAuthorized: false,
  reviewReference: 'review-fixture-001',
  reviewedAt: '2026-08-24T07:30:00.000Z',
  evidenceDocumentRefs: ['docs/RF-1G_POLICY_CALIBRATION_EVIDENCE.md'],
  rationaleByFamily,
  policy,
}

const first = hypothesisModule.validateRf1ReviewedShadowPolicyHypothesis(reviewed)
const second = hypothesisModule.validateRf1ReviewedShadowPolicyHypothesis({ ...reviewed })
assert(first.hypothesisFingerprint === second.hypothesisFingerprint, 'identical reviewed policy hypotheses must fingerprint deterministically')
assert(first.productionActivationAuthorized === false, 'reviewed SHADOW hypothesis must remain non-authorizing')
assert(first.policy.policyBundleVersion === policy.policyBundleVersion, 'validated hypothesis must retain the exact governed policy bundle')

const changedPolicy = {
  ...reviewed,
  policy: {
    ...policy,
    score: { ...policy.score, popularityCompressionExponent: 0.61 },
  },
}
const changed = hypothesisModule.validateRf1ReviewedShadowPolicyHypothesis(changedPolicy)
assert(changed.hypothesisFingerprint !== first.hypothesisFingerprint, 'numeric policy content changes must change the policy hypothesis fingerprint')

expectThrow(() => hypothesisModule.validateRf1ReviewedShadowPolicyHypothesis({
  ...reviewed,
  reviewStatus: 'APPROVED_FOR_PRODUCTION',
}), 'non-SHADOW review status must fail closed')

expectThrow(() => hypothesisModule.validateRf1ReviewedShadowPolicyHypothesis({
  ...reviewed,
  productionActivationAuthorized: true,
}), 'policy hypothesis must never authorize production activation')

expectThrow(() => hypothesisModule.validateRf1ReviewedShadowPolicyHypothesis({
  ...reviewed,
  evidenceDocumentRefs: [],
}), 'reviewed hypothesis without evidence references must fail closed')

const missingRationale = { ...rationaleByFamily }
delete missingRationale.exploration
expectThrow(() => hypothesisModule.validateRf1ReviewedShadowPolicyHypothesis({
  ...reviewed,
  rationaleByFamily: missingRationale,
}), 'reviewed hypothesis missing a policy-family rationale must fail closed')

console.log('RF-1H reviewed SHADOW policy provenance contracts: PASS')
