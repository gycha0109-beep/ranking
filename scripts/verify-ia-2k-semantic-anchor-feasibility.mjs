import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const evidencePath = path.join(root, 'tests/ia-2k/hosted-anchor-audit.json')
const docsPath = path.join(root, 'docs/ia-2k-semantic-anchor-feasibility.md')
const pagePath = path.join(root, 'src/app/admin/rankings/[id]/edit/page.tsx')
const packagePath = path.join(root, 'package.json')
const ciPath = path.join(root, '.github/workflows/ci.yml')

const SEALED_HOSTED_EVIDENCE_BLOB_SHA = '8cc76d58efe04da51d42c6857b9ce34b7dad9a44'
const EXPECTED_STARTING_MAIN = '172d11fc17949db075f15c6001d3c08f87309cb8'
const EXPECTED_VERDICT = 'NO_SAFE_AUTOMATIC_INDEPENDENT_ANCHOR_FOUND'

function fail(message) {
  console.error(`IA-2K semantic anchor feasibility verification failed: ${message}`)
  process.exit(1)
}

function expect(condition, message) {
  if (!condition) fail(message)
}

function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`missing ${path.relative(root, filePath)}`)
  return fs.readFileSync(filePath, 'utf8')
}

function gitBlobSha1(buffer) {
  return crypto
    .createHash('sha1')
    .update(`blob ${buffer.length}\0`)
    .update(buffer)
    .digest('hex')
}

const evidenceRaw = fs.readFileSync(evidencePath)
expect(gitBlobSha1(evidenceRaw) === SEALED_HOSTED_EVIDENCE_BLOB_SHA, 'Hosted evidence snapshot changed after sealing')

const evidence = JSON.parse(evidenceRaw.toString('utf8'))
const docs = read(docsPath)
const pageSource = read(pagePath)
const packageJson = JSON.parse(read(packagePath))
const ciSource = read(ciPath)

expect(evidence.audit_id === 'ia-2k-hosted-semantic-anchor-feasibility-v1', 'audit id mismatch')
expect(evidence.provenance === 'HOSTED_READ_ONLY_SNAPSHOT', 'evidence must remain Hosted read-only')
expect(evidence.observed_main_sha === EXPECTED_STARTING_MAIN, 'starting main authority mismatch')
expect(evidence.project_ref === 'yjdubukqkcvkymabskzd', 'Hosted project ref mismatch')
expect(evidence.projected_rankings === 13, 'projected ranking count mismatch')
expect(evidence.reviewed_alias_count === 0, 'reviewed Alias count mismatch')

const pairwise = evidence.pairwise ?? {}
expect(pairwise.same_subject_pairs === 8, 'same-Subject pair count mismatch')
expect(pairwise.different_subject_pairs === 70, 'different-Subject pair count mismatch')
expect(pairwise.same_subject_pairs + pairwise.different_subject_pairs === 78, '13-ranking pairwise partition must total 78')
expect(pairwise.same_subject_same_method_pairs === 8, 'same-Subject method consistency observation mismatch')
expect(pairwise.same_subject_different_coordinates_pairs === 8, 'same-Subject coordinate variation observation mismatch')
expect(pairwise.same_subject_different_criteria_pairs === 8, 'same-Subject criteria variation observation mismatch')
expect(pairwise.same_subcategory_intent_different_subject_pairs === 1, 'subcategory+intent collision count mismatch')
expect(pairwise.same_subcategory_method_different_subject_pairs === 1, 'subcategory+method collision count mismatch')

const collision = evidence.known_collision ?? {}
expect(collision.left_slug === 'world-population-2024-top-5', 'known collision left ranking mismatch')
expect(collision.right_slug === 'world-nominal-gdp-2024-top-5', 'known collision right ranking mismatch')
expect(collision.left_subject !== collision.right_subject, 'collision Subjects must remain distinct')
expect(collision.shared_intent === 'metric-comparison', 'known collision intent mismatch')
expect(collision.shared_method === 'world-bank-wdi', 'known collision method mismatch')

const assessment = evidence.signal_assessment ?? {}
expect(assessment.item_overlap === 'REJECTED_BY_IA_2I_AS_SUBJECT_IDENTITY_AUTHORITY', 'Item overlap rejection evidence missing')
expect(assessment.subcategory === 'INSUFFICIENT', 'subcategory assessment mismatch')
expect(assessment.intent_key === 'INSUFFICIENT', 'intent assessment mismatch')
expect(assessment.method_key === 'INSUFFICIENT', 'method assessment mismatch')
expect(assessment.coordinates_exactness === 'TOO_NARROW_FOR_EXISTING_BROAD_SUBJECTS', 'coordinate exactness assessment mismatch')
expect(assessment.criteria_exactness === 'TOO_NARROW_FOR_EXISTING_BROAD_SUBJECTS', 'criteria exactness assessment mismatch')
expect(assessment.reviewed_alias === 'SAFE_EXPLICIT_EQUIVALENCE_BUT_ZERO_HOSTED_ROWS', 'reviewed Alias authority assessment mismatch')
expect(evidence.verdict === EXPECTED_VERDICT, 'IA-2K verdict mismatch')

expect(docs.includes(`**${EXPECTED_VERDICT}**`), 'documented verdict missing')
expect(docs.includes('Same-Subject pairs | 8'), 'same-Subject count not documented')
expect(docs.includes('Different-Subject pairs | 70'), 'different-Subject count not documented')
expect(docs.includes('world-population-2024-top-5'), 'known population collision not documented')
expect(docs.includes('world-nominal-gdp-2024-top-5'), 'known GDP collision not documented')
expect(docs.includes('Reviewed Alias'), 'explicit reviewed equivalence authority not documented')
expect(docs.includes('Hosted rows = 0'), 'zero Hosted Alias evidence not documented')
expect(docs.includes('IA-2H_OPERATIONAL_FALLBACK = QUARANTINED'), 'IA-2J quarantine boundary not documented')
expect(docs.includes('NEW_SUBJECT_PATH = ACTIVE_UNCHANGED'), 'open-world new Subject path not documented')
expect(docs.includes('No global ontology, embedding/vector system, LLM classifier, automatic merge/remap, or publication block'), 'forbidden semantic expansion not documented')

expect(pageSource.includes('const IA_2H_CONTEXT_FALLBACK_QUARANTINED = true'), 'IA-2J quarantine must remain active')
expect(pageSource.includes('<SemanticProjectionPanel initialWorkspace={semanticWorkspace} />'), 'existing lexical/manual semantic editor must remain active')

expect(packageJson.scripts?.['verify:ia-2k'] === 'node scripts/verify-ia-2k-semantic-anchor-feasibility.mjs', 'package verify:ia-2k wiring missing')
expect(ciSource.includes('npm run verify:ia-2k'), 'CI verify:ia-2k wiring missing')

console.log('IA-2K independent semantic anchor feasibility evidence: PASS')
console.log('verdict=NO_SAFE_AUTOMATIC_INDEPENDENT_ANCHOR_FOUND')
console.log('hosted_projected_rankings=13')
console.log('reviewed_alias_rows=0')
console.log('same_subject_pairs=8')
console.log('different_subject_pairs=70')
console.log('ia_2h_operational_fallback=QUARANTINED')
console.log('next=REVIEWED_EQUIVALENCE_EVIDENCE_ACCUMULATION')
