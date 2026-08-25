import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  recovery: p('content/corpus-200/recovery/blocked-evidence-r1.json'),
  wave4: p('content/corpus-200/materialization/wave-4.json'),
  wave4a: p('content/corpus-200/materialization/wave-4-families-a.json'),
  wave4b: p('content/corpus-200/materialization/wave-4-families-b.json'),
  page: p('src/app/rankings/[rankingSlug]/page.tsx'),
  pkg: p('package.json'),
  ci: p('.github/workflows/ci.yml'),
}
const MANIFEST = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const WAVE4_SHA = '7383ff4509bd4d2f254a511a80e313f625004231e6d615736375cae19cb89436'
const EXPECTED = 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION'
const fail = (message) => { console.error(`CONTENT-CORPUS-200 blocked recovery R1 verification failed: ${message}`); process.exit(1) }
const ok = (value, message) => { if (!value) fail(message) }
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

for (const file of Object.values(files)) ok(fs.existsSync(file), `${path.basename(file)} must exist`)
const recovery = read(files.recovery)
const wave4 = read(files.wave4)
const wave4a = read(files.wave4a)
const wave4b = read(files.wave4b)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = read(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

const wave4Sha = crypto.createHash('sha256').update(JSON.stringify({ index: wave4, familyA: wave4a, familyB: wave4b })).digest('hex')
ok(wave4Sha === WAVE4_SHA, `frozen Wave 4 evidence mutated: expected ${WAVE4_SHA}, observed ${wave4Sha}`)
ok(recovery.version === 'content-corpus-200-blocked-evidence-recovery-r1-v1', 'recovery version mismatch')
ok(recovery.manifestVersion === 'content-corpus-200-manifest-v1' && recovery.manifestSha256 === MANIFEST, 'manifest identity mismatch')
ok(recovery.status === 'BLOCKED_EVIDENCE_RECOVERY_PARTIALLY_MATERIALIZED', 'recovery status mismatch')
ok(recovery.observedAt === '2026-08-25T14:22:00+09:00', 'observation time mismatch')
ok(recovery.baseWave?.wave === 4 && recovery.baseWave?.combinedEvidenceSha256 === WAVE4_SHA, 'base Wave 4 identity mismatch')
ok(JSON.stringify(recovery.baseWave?.files) === JSON.stringify([
  'content/corpus-200/materialization/wave-4.json',
  'content/corpus-200/materialization/wave-4-families-a.json',
  'content/corpus-200/materialization/wave-4-families-b.json',
]), 'base Wave 4 file set mismatch')
ok(Object.values(recovery.authorityBoundary || {}).every((value) => value === false), 'all authority flags must remain false')

const sources = recovery.sourceSnapshots || []
ok(sources.length === 5 && new Set(sources.map((source) => source.id)).size === 5, 'source snapshot count mismatch')
for (const source of sources) {
  ok(source.sourceKey === 'cj-official-product', `${source.id} must use CJ official product authority`)
  ok(/^https:\/\/(?:www\.|m\.)?cjthemarket\.com\//.test(source.url || ''), `${source.id} must use CJ The Market official domain`)
  ok(source.referencePeriod === 'current-official-product-page-reviewed-2026-08-25', `${source.id} reference period mismatch`)
  ok(/250 mL/.test(source.note || '') && /declares? \d+ g protein/i.test(source.note || ''), `${source.id} source note must bind exact package and protein declaration`)
}

const convenience = wave4b.families.find((family) => family.familyId === 'convenience-protein')
ok(convenience?.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', 'base convenience candidate universe must remain frozen')
const baseProtein = convenience.rankings.find((ranking) => ranking.manifestId === 'cc200-convenience-protein-01')
ok(baseProtein?.materializationStatus === 'BLOCKED_SOURCE_GAP', 'base Wave 4 protein FACT must remain immutable and blocked')
ok(/COMPLETE_CURRENT_OFFICIAL_PER_FLAVOR_PROTEIN_LABEL_SET_NOT_FROZEN/.test(baseProtein.blocker || ''), 'base Wave 4 protein blocker changed unexpectedly')

const recovered = recovery.recoveredFacts || []
ok(recovered.length === 1, 'R1 must recover exactly one FACT')
const protein = recovered[0]
ok(protein.manifestId === 'cc200-convenience-protein-01' && protein.familyId === 'convenience-protein', 'recovered FACT identity mismatch')
ok(protein.baseMaterializationStatus === 'BLOCKED_SOURCE_GAP' && protein.materializationStatus === 'RECOVERED_MATERIALIZED_FACT', 'recovered FACT state mismatch')
ok(protein.metric === 'officialDeclaredProteinGramsPer250ml' && protein.direction === 'DESC', 'recovered protein metric mismatch')
ok(protein.scopeBoundary === 'EXACT_FROZEN_FIVE_FLAVOR_SUBSET_CJ_OFFICIAL_PRODUCT_SURFACES', 'recovery scope boundary mismatch')
ok(protein.tieBoundary === 'EQUAL_PROTEIN_VALUES_DO_NOT_IMPLY_SECONDARY_ORDER', 'tie boundary mismatch')
ok(new Set(protein.sourceSnapshotIds || []).size === 5 && protein.sourceSnapshotIds.every((id) => sources.some((source) => source.id === id)), 'recovered FACT source binding mismatch')

const expectedEntries = [
  ['altive-protein-chocolate-250ml', 21],
  ['altive-protein-banana-250ml', 21],
  ['altive-protein-chestnut-250ml', 21],
  ['altive-protein-pistachio-250ml', 21],
  ['altive-protein-royal-milk-tea-250ml', 20],
]
ok(JSON.stringify(protein.entries.map((entry) => [entry.itemKey, entry.value])) === JSON.stringify(expectedEntries), 'protein evidence values/order mismatch')
for (let index = 1; index < protein.entries.length; index += 1) ok(protein.entries[index - 1].value >= protein.entries[index].value, 'protein entries must be non-increasing')
const candidateKeys = convenience.candidateUniverse.items.map((item) => item.itemKey)
ok(JSON.stringify(protein.entries.map((entry) => entry.itemKey).sort()) === JSON.stringify([...candidateKeys].sort()), 'recovered FACT must cover exactly the frozen candidate universe')

const remaining = recovery.remainingBlockedFacts || []
ok(JSON.stringify(remaining.map((row) => row.manifestId)) === JSON.stringify(['cc200-convenience-protein-02', 'cc200-convenience-protein-03']), 'remaining blocked FACT set mismatch')
ok(/KCAL/.test(remaining[0].blocker) && /NOT_DERIVED/.test(remaining[0].blocker), 'protein-per-kcal must remain blocked without complete kcal labels')
ok(/SODIUM/.test(remaining[1].blocker), 'sodium FACT must remain blocked without complete sodium labels')
for (const row of remaining) ok(!('entries' in row) && !('metric' in row), `${row.manifestId} blocked outcome must not contain fabricated entries`)

const closure = recovery.closure || {}
ok(closure.blockedFactsBeforeRecovery === 13 && closure.recoveredFactCount === 1 && closure.blockedFactsAfterRecovery === 12, 'recovery closure counts mismatch')
ok(closure.manifestCoverage === 200, 'manifest coverage must remain 200')
ok(closure.productionRowsWritten === 0 && closure.publicRowsPublished === 0 && closure.recommendationRuns === 0, 'write/publication/recommendation authority boundary violated')
ok(closure.editorialWeightsAssigned === 0 && closure.fabricatedVoteRows === 0, 'editorial/vote fabrication boundary violated')

ok(!page.includes('blocked-evidence-r1.json'), 'public ranking page must not consume recovery evidence')
ok(pkg.scripts?.['verify:content-corpus-200-blocked-recovery-r1'] === 'node scripts/verify-content-corpus-200-blocked-recovery-r1.mjs', 'package verifier wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-blocked-recovery-r1'), 'CI verifier wiring missing')

const sha = crypto.createHash('sha256').update(JSON.stringify(recovery)).digest('hex')
console.log('CONTENT-CORPUS-200 blocked evidence recovery R1 result:')
console.log(JSON.stringify({
  version: recovery.version,
  manifestSha256: recovery.manifestSha256,
  baseWave4EvidenceSha256: wave4Sha,
  evidenceSha256: sha,
  sourceSnapshotCount: sources.length,
  recoveredFacts: recovered.map((row) => row.manifestId),
  blockedFactsBeforeRecovery: closure.blockedFactsBeforeRecovery,
  blockedFactsAfterRecovery: closure.blockedFactsAfterRecovery,
  authority: recovery.authorityBoundary,
}, null, 2))
ok(EXPECTED !== 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION', `R1 evidence must be frozen after first structurally valid execution; observed sha256=${sha}`)
ok(sha === EXPECTED, `R1 evidence freeze mismatch: expected ${EXPECTED}, observed ${sha}`)
console.log(`CONTENT-CORPUS-200 blocked recovery R1 contracts: PASS (${sha.slice(0, 16)})`)
