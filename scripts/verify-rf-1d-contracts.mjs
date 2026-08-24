import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const corePath = path.join(root, 'src/lib/recommendation/rf1-core.ts')
const shadowPath = path.join(root, 'src/lib/recommendation/rf1-shadow.ts')
const evidencePath = path.join(root, 'src/lib/recommendation/rf1-shadow-evidence.ts')
const serverPath = path.join(root, 'src/lib/recommendation/rf1-shadow-evidence-server.ts')
const migrationPath = path.join(root, 'supabase/migrations/20260824064000_rf_1d_shadow_evidence_readiness.sql')
const rankingPagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')

function fail(message) {
  console.error(`RF-1D contract failed: ${message}`)
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

for (const requiredPath of [corePath, shadowPath, evidencePath, serverPath, migrationPath, rankingPagePath]) {
  assert(fs.existsSync(requiredPath), `${path.relative(root, requiredPath)} must exist`)
}

const coreSource = fs.readFileSync(corePath, 'utf8')
const shadowSource = fs.readFileSync(shadowPath, 'utf8')
const evidenceSource = fs.readFileSync(evidencePath, 'utf8')
const serverSource = fs.readFileSync(serverPath, 'utf8')
const migration = fs.readFileSync(migrationPath, 'utf8')
const rankingPageSource = fs.readFileSync(rankingPagePath, 'utf8')

assert(shadowSource.includes('currentRankingId'), 'SHADOW result must bind evidence to the source ranking')
assert(shadowSource.includes('candidateCount'), 'SHADOW result must retain candidate count')
assert(evidenceSource.includes("domain: 'rankingwiki:rf1-shadow-run:v1'"), 'shadow run ID must use an explicit fingerprint domain')
assert(evidenceSource.includes('stableFingerprint'), 'shadow run ID must be deterministic')
assert(evidenceSource.includes('complete baseline candidate set'), 'shadow evidence must reject candidate-set mutation')
assert(evidenceSource.includes('changedPositionCount must match'), 'shadow evidence must validate reported ordering delta')

assert(serverSource.includes("admin.rpc('record_rf1_shadow_run'"), 'shadow evidence writes must use the governed service-role RPC')
assert(serverSource.includes("admin.rpc('get_rf1_calibration_evidence_summary'"), 'readiness must use the governed service-role RPC')
assert(serverSource.includes("production_policy_authorized: false"), 'server readiness type must never claim automatic production authorization')

assert(migration.includes('CREATE TABLE public.rf1_shadow_runs'), 'durable SHADOW evidence table must exist')
assert(migration.includes('CREATE OR REPLACE FUNCTION public.record_rf1_shadow_run'), 'atomic SHADOW evidence write RPC must exist')
assert(migration.includes('CREATE OR REPLACE FUNCTION public.get_rf1_calibration_evidence_summary'), 'calibration readiness readback RPC must exist')
assert(migration.includes('baseline_ranking_ids UUID[]'), 'SHADOW evidence must persist baseline order')
assert(migration.includes('shadow_ranking_ids UUID[]'), 'SHADOW evidence must persist shadow order')
assert(migration.includes('v_baseline_ranking_ids <@ v_shadow_ranking_ids'), 'database must verify candidate-set preservation')
assert(migration.includes('generate_subscripts(v_baseline_ranking_ids, 1)'), 'database must recompute changed-position count')
assert(migration.includes('conflicting RF-1 shadow replay'), 'conflicting deterministic replay must fail closed')
assert(migration.includes("'production_policy_authorized', FALSE"), 'readiness RPC must never automatically authorize production policy')
assert(migration.includes("'automatic_authorization', 'FORBIDDEN'"), 'automatic authorization must be explicitly forbidden')
assert(migration.includes("'NO_DURABLE_SHADOW_RUN_EVIDENCE'"), 'readiness must identify missing SHADOW evidence')
assert(migration.includes("'NO_RELATED_RANKING_CLICK_OUTCOME_EVIDENCE'"), 'readiness must identify missing related-click outcomes')
assert(migration.includes("'NO_USER_VISIBLE_RF1_EXPOSURE_EVIDENCE'"), 'readiness must identify missing real exposure evidence')
assert(migration.includes("'EVIDENCE_PRESENT_REVIEW_REQUIRED'"), 'non-empty evidence must still require review')
assert(migration.includes('REVOKE ALL ON TABLE public.rf1_shadow_runs FROM PUBLIC, anon, authenticated, service_role'), 'raw SHADOW evidence must remain inaccessible')
assert(migration.includes('GRANT EXECUTE ON FUNCTION public.record_rf1_shadow_run(JSONB)\nTO service_role'), 'SHADOW writes must be service-role-only')
assert(migration.includes('GRANT EXECUTE ON FUNCTION public.get_rf1_calibration_evidence_summary()\nTO service_role'), 'readiness readback must be service-role-only')
assert(!migration.includes('user_id UUID'), 'SHADOW evidence must not create a new durable user identity')
assert(!migration.includes('viewer_key_hash'), 'SHADOW evidence must not copy anonymous viewer identity')
assert(!migration.includes('minimum_sample'), 'RF-1D must not invent an unsupported numeric sample threshold')
assert(!rankingPageSource.includes('recordRf1ShadowEvidence'), 'public ranking page must not persist SHADOW runs implicitly')
assert(!rankingPageSource.includes('runRf1RelatedShadow'), 'public ranking page must remain outside RF-1 SHADOW execution')

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

const shadowFixture = {
  mode: 'SHADOW',
  currentRankingId: 'current-ranking',
  baselineRankingIds: ['ranking-a', 'ranking-b', 'ranking-c'],
  shadowRankingIds: ['ranking-a', 'ranking-c', 'ranking-b'],
  candidateCount: 3,
  changedPositionCount: 2,
  protectedIdentityCount: 1,
  profileMaturity: 'EMERGING',
  profileFingerprint: 'rf1-profile-fixture',
  sessionFingerprint: null,
  policyBundleVersion: 'rf1-policy-fixture',
  referenceTime: '2026-08-24T05:00:00.000Z',
  seed: 'shadow-seed',
}

const first = evidenceModule.createRf1ShadowEvidenceRecord(shadowFixture)
const second = evidenceModule.createRf1ShadowEvidenceRecord({ ...shadowFixture })
assert(first.shadowRunId === second.shadowRunId, 'identical SHADOW evidence must produce the same deterministic run ID')
assert(first.changedPositionCount === 2 && first.candidateCount === 3, 'SHADOW counts must survive materialization')
assert(first.baselineRankingIds.join(',') === 'ranking-a,ranking-b,ranking-c', 'baseline order must be preserved verbatim')
assert(first.shadowRankingIds.join(',') === 'ranking-a,ranking-c,ranking-b', 'shadow order must be preserved verbatim')

const changedSeed = evidenceModule.createRf1ShadowEvidenceRecord({ ...shadowFixture, seed: 'different-seed' })
assert(changedSeed.shadowRunId !== first.shadowRunId, 'material evidence changes must change the deterministic run ID')

expectThrow(() => evidenceModule.createRf1ShadowEvidenceRecord({
  ...shadowFixture,
  shadowRankingIds: ['ranking-a', 'ranking-c', 'ranking-x'],
}), 'candidate-set mutation must fail closed')

expectThrow(() => evidenceModule.createRf1ShadowEvidenceRecord({
  ...shadowFixture,
  changedPositionCount: 1,
}), 'incorrect changed-position count must fail closed')

expectThrow(() => evidenceModule.createRf1ShadowEvidenceRecord({
  ...shadowFixture,
  baselineRankingIds: ['ranking-a', 'ranking-a', 'ranking-c'],
}), 'duplicate baseline ranking IDs must fail closed')

console.log('RF-1D durable SHADOW evidence and readiness contracts: PASS')
