import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const corePath = path.join(root, 'src/lib/recommendation/rf1-core.ts')
const evidencePath = path.join(root, 'src/lib/recommendation/rf1-shadow-evidence.ts')
const serverPath = path.join(root, 'src/lib/recommendation/rf1-shadow-evidence-server.ts')
const migrationPath = path.join(root, 'supabase/migrations/20260824072000_rf_1f_shadow_capture_hardening.sql')
const rankingPagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')
const measureRoutePath = path.join(root, 'src/app/api/measure-1/route.ts')

function fail(message) {
  console.error(`RF-1F contract failed: ${message}`)
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

for (const requiredPath of [corePath, evidencePath, serverPath, migrationPath, rankingPagePath, measureRoutePath]) {
  assert(fs.existsSync(requiredPath), `${path.relative(root, requiredPath)} must exist`)
}

const coreSource = fs.readFileSync(corePath, 'utf8')
const evidenceSource = fs.readFileSync(evidencePath, 'utf8')
const serverSource = fs.readFileSync(serverPath, 'utf8')
const migration = fs.readFileSync(migrationPath, 'utf8')
const rankingPageSource = fs.readFileSync(rankingPagePath, 'utf8')
const measureRouteSource = fs.readFileSync(measureRoutePath, 'utf8')

assert(migration.includes('candidate_count >= 1'), 'durable SHADOW evidence must require a non-empty candidate ordering')
assert(migration.includes('current_ranking_id = ANY(baseline_ranking_ids)'), 'database must reject source ranking inside the baseline ordering')
assert(migration.includes('current_ranking_id = ANY(shadow_ranking_ids)'), 'database must reject source ranking inside the shadow ordering')
assert(migration.includes('pre-existing empty SHADOW runs'), 'migration must fail closed if invalid empty evidence already exists')
assert(!migration.includes('minimum_sample'), 'RF-1F must not invent a product calibration sample threshold')
assert(!migration.includes('policy_weight'), 'RF-1F must not invent production policy weights')

assert(evidenceSource.includes('candidateCount must be a positive integer'), 'pure evidence materialization must reject empty candidate sets')
assert(evidenceSource.includes('source ranking must not appear in SHADOW candidate orderings'), 'pure evidence materialization must reject source self-membership')
assert(serverSource.includes('runAndRecordRf1RelatedShadowEvidence'), 'server-only durable SHADOW capture harness must exist')
assert(serverSource.includes('hypothesis: Rf1ReviewedShadowPolicyHypothesis'), 'durable capture must require an explicitly reviewed SHADOW-only policy hypothesis')
assert(serverSource.includes('validateRf1ReviewedShadowPolicyHypothesis(input.hypothesis)'), 'capture harness must validate reviewed policy provenance before execution')
assert(serverSource.includes('policy: reviewedHypothesis.policy'), 'capture harness must execute the complete policy contained in the reviewed hypothesis')
assert(serverSource.includes('No default production tuning values are embedded here'), 'capture harness must explicitly document that it has no default tuning policy')
assert(serverSource.includes('runRf1RelatedShadow({'), 'capture harness must execute the governed SHADOW path')
assert(serverSource.includes('reviewedHypothesis.hypothesisFingerprint'), 'capture harness must bind durable evidence to the reviewed policy fingerprint')
assert(serverSource.includes('recordRf1ShadowEvidence(evidence)'), 'capture harness must persist through the governed evidence RPC')
assert(serverSource.includes('getRf1CalibrationEvidenceSummary()'), 'capture harness must read readiness after persistence')
assert(serverSource.includes('rf1_attributed_related_ranking_clicks: number'), 'TypeScript readiness shape must include the RF-1E exact attributed-click count')
assert(serverSource.includes('will not persist an empty SHADOW candidate ordering as evidence'), 'capture harness must fail before persisting empty evidence')
assert(!serverSource.includes('DEFAULT_RF1_POLICY'), 'RF-1F must not embed a default production policy')
assert(!serverSource.includes('PRODUCTION_RF1_POLICY'), 'RF-1F must not embed a production policy constant')

assert(!rankingPageSource.includes('runAndRecordRf1RelatedShadowEvidence'), 'public ranking page must not persist RF-1F SHADOW evidence')
assert(!rankingPageSource.includes('recordRf1ShadowEvidence'), 'public ranking page must remain outside durable SHADOW writes')
assert(!measureRouteSource.includes('runAndRecordRf1RelatedShadowEvidence'), 'MEASURE-1 telemetry route must not become a SHADOW execution surface')

const coreJs = ts.transpileModule(coreSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, strict: true },
  fileName: corePath,
}).outputText
const coreUrl = `data:text/javascript;base64,${Buffer.from(coreJs).toString('base64')}`

let evidenceJs = ts.transpileModule(evidenceSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, strict: true },
  fileName: evidencePath,
}).outputText
evidenceJs = evidenceJs.replace("from './rf1-core'", `from '${coreUrl}'`)
const evidenceUrl = `data:text/javascript;base64,${Buffer.from(evidenceJs).toString('base64')}`
const evidenceModule = await import(evidenceUrl)

const validFixture = {
  mode: 'SHADOW',
  currentRankingId: 'source-ranking',
  baselineRankingIds: ['ranking-a'],
  shadowRankingIds: ['ranking-a'],
  candidateCount: 1,
  changedPositionCount: 0,
  protectedIdentityCount: 0,
  profileMaturity: 'EMPTY',
  profileFingerprint: 'rf1-profile-fixture',
  sessionFingerprint: null,
  policyBundleVersion: 'caller-supplied-policy-v1',
  referenceTime: '2026-08-24T06:00:00.000Z',
  seed: 'shadow-capture-seed',
}
const hypothesisFingerprint = 'rf1-policy-hypothesis-fixture'

const materialized = evidenceModule.createRf1ShadowEvidenceRecord(validFixture, hypothesisFingerprint)
assert(materialized.candidateCount === 1, 'non-empty SHADOW evidence must remain valid')
assert(materialized.policyHypothesisFingerprint === hypothesisFingerprint, 'reviewed policy provenance must survive materialization')

expectThrow(() => evidenceModule.createRf1ShadowEvidenceRecord({
  ...validFixture,
  baselineRankingIds: [],
  shadowRankingIds: [],
  candidateCount: 0,
}, hypothesisFingerprint), 'empty SHADOW evidence must fail closed')

expectThrow(() => evidenceModule.createRf1ShadowEvidenceRecord({
  ...validFixture,
  baselineRankingIds: ['source-ranking'],
  shadowRankingIds: ['source-ranking'],
}, hypothesisFingerprint), 'source ranking inside candidate ordering must fail closed')

console.log('RF-1F durable SHADOW capture harness contracts: PASS')
