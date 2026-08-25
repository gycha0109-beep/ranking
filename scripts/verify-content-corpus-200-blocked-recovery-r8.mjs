import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  recovery: p('content/corpus-200/recovery/blocked-evidence-r8.json'),
  r1: p('content/corpus-200/recovery/blocked-evidence-r1.json'),
  r2: p('content/corpus-200/recovery/blocked-evidence-r2.json'),
  r3: p('content/corpus-200/recovery/blocked-evidence-r3.json'),
  r4: p('content/corpus-200/recovery/blocked-evidence-r4.json'),
  r5: p('content/corpus-200/recovery/blocked-evidence-r5.json'),
  r6: p('content/corpus-200/recovery/blocked-evidence-r6.json'),
  r7: p('content/corpus-200/recovery/blocked-evidence-r7.json'),
  wave4: p('content/corpus-200/materialization/wave-4.json'),
  wave4a: p('content/corpus-200/materialization/wave-4-families-a.json'),
  wave4b: p('content/corpus-200/materialization/wave-4-families-b.json'),
  page: p('src/app/rankings/[rankingSlug]/page.tsx'),
  pkg: p('package.json'),
  ci: p('.github/workflows/ci.yml'),
}

const MANIFEST = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const WAVE4_SHA = '7383ff4509bd4d2f254a511a80e313f625004231e6d615736375cae19cb89436'
const PRIOR = [
  ['r1', '6e5897ef79dc7280e7da1e2b87a2f663f49d383f27a7d65885c84fa09381c42c'],
  ['r2', '6ded2c4dc33993e223ffac3ed777a232ec40aa9d5a7556b6c25d1f28653474cc'],
  ['r3', 'fe70b352fa329a1d230c87cb071b44e92b67e246758b62099aec7c7679505a9e'],
  ['r4', 'efedcd57539a34169fc658b8b34a78006b031178e5ddbe15ef9f4042bf782d61'],
  ['r5', '54d94c069c2ea8731330d3aa1b2d9620bd37559f4e4df9cdd42692352927ac37'],
  ['r6', 'f2053d7fe208cc6bf658ddebd9c21a2ed3778ed84e90c73f2e94f43f3eeeab36'],
  ['r7', 'c84557fe19b4371c2ab2fcc093197ecb111f588b1693fea1b767f4fc0930d334'],
]
const EXPECTED = 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION'

const fail = (message) => { console.error(`CONTENT-CORPUS-200 blocked recovery R8 verification failed: ${message}`); process.exit(1) }
const ok = (value, message) => { if (!value) fail(message) }
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
const sameSet = (left, right) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())

for (const file of Object.values(files)) ok(fs.existsSync(file), `${path.basename(file)} must exist`)

const recovery = read(files.recovery)
const priorDocs = [read(files.r1), read(files.r2), read(files.r3), read(files.r4), read(files.r5), read(files.r6), read(files.r7)]
const wave4 = read(files.wave4)
const wave4a = read(files.wave4a)
const wave4b = read(files.wave4b)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = read(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

for (let index = 0; index < PRIOR.length; index += 1) {
  const [id, expectedSha] = PRIOR[index]
  ok(jsonSha(priorDocs[index]) === expectedSha, `frozen Recovery ${id.toUpperCase()} evidence mutated`)
}
const wave4Sha = crypto.createHash('sha256').update(JSON.stringify({ index: wave4, familyA: wave4a, familyB: wave4b })).digest('hex')
ok(wave4Sha === WAVE4_SHA, `frozen Wave 4 evidence mutated: expected ${WAVE4_SHA}, observed ${wave4Sha}`)

ok(recovery.version === 'content-corpus-200-blocked-evidence-recovery-r8-v1', 'recovery version mismatch')
ok(recovery.manifestVersion === 'content-corpus-200-manifest-v1' && recovery.manifestSha256 === MANIFEST, 'manifest identity mismatch')
ok(recovery.status === 'BLOCKED_EVIDENCE_RECOVERY_PARTIALLY_MATERIALIZED', 'recovery status mismatch')
ok(recovery.observedAt === '2026-08-25T18:10:00+09:00', 'observation time mismatch')
ok(recovery.baseWave?.wave === 4 && recovery.baseWave?.combinedEvidenceSha256 === WAVE4_SHA, 'base Wave 4 identity mismatch')
ok(JSON.stringify(recovery.baseWave?.files) === JSON.stringify([
  'content/corpus-200/materialization/wave-4.json',
  'content/corpus-200/materialization/wave-4-families-a.json',
  'content/corpus-200/materialization/wave-4-families-b.json',
]), 'base Wave 4 file set mismatch')
ok(JSON.stringify(recovery.priorRecoveries?.map((row) => [row.id, row.evidenceSha256])) === JSON.stringify(PRIOR), 'prior recovery identity/order mismatch')
ok(Object.values(recovery.authorityBoundary || {}).every((value) => value === false), 'all authority flags must remain false')

const sources = recovery.sourceSnapshots || []
ok(sources.length === 5 && new Set(sources.map((row) => row.id)).size === 5, 'R8 must freeze exactly five CJ official nutrition snapshots')
const expectedSourceRows = [
  ['cj-altive-chocolate-nutrition-r8', 'https://www.cjthemarket.com/the/product/product-main?prdCd=40211089', 21, 125, 330],
  ['cj-altive-banana-nutrition-r8', 'https://www.cjthemarket.com/the/product/product-main?prdCd=40205295', 21, 115, 450],
  ['cj-altive-chestnut-nutrition-r8', 'https://www.cjthemarket.com/the/product/product-main?prdCd=40211091', 21, 115, 320],
  ['cj-altive-pistachio-nutrition-r8', 'https://www.cjthemarket.com/the/product/product-main?prdCd=40218775', 21, 115, 420],
  ['cj-altive-royal-milk-tea-nutrition-r8', 'https://www.cjthemarket.com/the/product/product-main?prdCd=40218774', 20, 115, 380],
]
for (const [id, url, proteinGrams, kcal, sodiumMg] of expectedSourceRows) {
  const source = sources.find((row) => row.id === id)
  ok(source?.sourceKey === 'cj-official-product', `${id} must use CJ official product authority`)
  ok(source?.url === url, `${id} URL mismatch`)
  ok(source?.referencePeriod === 'current-official-product-page-and-label-reviewed-2026-08-25', `${id} reference period mismatch`)
  ok(source?.nutrition?.proteinGrams === proteinGrams && source?.nutrition?.kcal === kcal && source?.nutrition?.sodiumMg === sodiumMg, `${id} nutrition tuple mismatch`)
  ok(/250 mL/i.test(source?.note || '') && /protein/i.test(source?.note || '') && /kcal/i.test(source?.note || '') && /sodium/i.test(source?.note || ''), `${id} note must bind package, protein, kcal and sodium`)
}

const convenience = wave4b.families.find((family) => family.familyId === 'convenience-protein')
ok(convenience?.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', 'base convenience candidate universe must remain frozen')
const candidateKeys = convenience.candidateUniverse.items.map((row) => row.itemKey)
const expectedCandidateKeys = [
  'altive-protein-chocolate-250ml',
  'altive-protein-banana-250ml',
  'altive-protein-chestnut-250ml',
  'altive-protein-pistachio-250ml',
  'altive-protein-royal-milk-tea-250ml',
]
ok(JSON.stringify(candidateKeys) === JSON.stringify(expectedCandidateKeys), 'frozen convenience candidate universe mutated')

const baseProteinPerKcal = convenience.rankings.find((row) => row.manifestId === 'cc200-convenience-protein-02')
const baseSodium = convenience.rankings.find((row) => row.manifestId === 'cc200-convenience-protein-03')
ok(baseProteinPerKcal?.kind === 'FACT' && baseProteinPerKcal.materializationStatus === 'BLOCKED_SOURCE_GAP', 'base protein-per-kcal FACT must remain immutable and blocked')
ok(baseProteinPerKcal?.blocker === 'COMPLETE_CURRENT_OFFICIAL_PROTEIN_AND_KCAL_LABEL_SET_NOT_FROZEN_FOR_THE_EXACT_RECENT_GS25_CANDIDATE_SUBSET', 'base protein-per-kcal blocker changed unexpectedly')
ok(baseSodium?.kind === 'FACT' && baseSodium.materializationStatus === 'BLOCKED_SOURCE_GAP', 'base sodium FACT must remain immutable and blocked')
ok(baseSodium?.blocker === 'COMPLETE_CURRENT_OFFICIAL_SODIUM_LABEL_SET_NOT_FROZEN_FOR_THE_EXACT_RECENT_GS25_CANDIDATE_SUBSET', 'base sodium blocker changed unexpectedly')

const r1Protein = priorDocs[0].recoveredFacts?.find((row) => row.manifestId === 'cc200-convenience-protein-01')
ok(r1Protein?.materializationStatus === 'RECOVERED_MATERIALIZED_FACT', 'R1 recovered protein FACT must remain present')
ok(sameSet(r1Protein.entries.map((row) => row.itemKey), candidateKeys), 'R1 recovered protein FACT candidate set mismatch')

const labels = recovery.labelEvidence || []
ok(labels.length === 5 && sameSet(labels.map((row) => row.itemKey), candidateKeys), 'R8 label evidence must cover exact frozen five candidates')
const expectedLabelRows = [
  ['altive-protein-chocolate-250ml', 'cj-altive-chocolate-nutrition-r8', 21, 125, 330],
  ['altive-protein-banana-250ml', 'cj-altive-banana-nutrition-r8', 21, 115, 450],
  ['altive-protein-chestnut-250ml', 'cj-altive-chestnut-nutrition-r8', 21, 115, 320],
  ['altive-protein-pistachio-250ml', 'cj-altive-pistachio-nutrition-r8', 21, 115, 420],
  ['altive-protein-royal-milk-tea-250ml', 'cj-altive-royal-milk-tea-nutrition-r8', 20, 115, 380],
]
ok(JSON.stringify(labels.map((row) => [row.itemKey, row.sourceSnapshotId, row.proteinGrams, row.kcal, row.sodiumMg])) === JSON.stringify(expectedLabelRows), 'R8 label evidence tuple mismatch')
for (const row of labels) {
  const source = sources.find((item) => item.id === row.sourceSnapshotId)
  ok(source && JSON.stringify(source.nutrition) === JSON.stringify({ proteinGrams: row.proteinGrams, kcal: row.kcal, sodiumMg: row.sodiumMg }), `${row.itemKey} label/source nutrition mismatch`)
}

const recovered = recovery.recoveredFacts || []
ok(recovered.length === 2, 'R8 must recover exactly two FACTs')
const proteinPerKcal = recovered.find((row) => row.manifestId === 'cc200-convenience-protein-02')
const sodium = recovered.find((row) => row.manifestId === 'cc200-convenience-protein-03')
const allSourceIds = expectedSourceRows.map(([id]) => id)
for (const fact of recovered) {
  ok(fact.familyId === 'convenience-protein', `${fact.manifestId} family mismatch`)
  ok(fact.baseMaterializationStatus === 'BLOCKED_SOURCE_GAP' && fact.materializationStatus === 'RECOVERED_MATERIALIZED_FACT', `${fact.manifestId} recovered state mismatch`)
  ok(JSON.stringify(fact.sourceSnapshotIds) === JSON.stringify(allSourceIds), `${fact.manifestId} source bindings mismatch`)
  ok(fact.scopeBoundary === 'EXACT_WAVE4_FROZEN_FIVE_ALTIVE_250ML_FLAVOR_SUBSET_NOT_ALL_CONVENIENCE_PROTEIN_PRODUCTS', `${fact.manifestId} scope boundary mismatch`)
  ok(sameSet(fact.entries.map((row) => row.itemKey), candidateKeys), `${fact.manifestId} must cover exact frozen candidate universe`)
}

ok(proteinPerKcal.metric === 'officialDeclaredProteinGramsPer100Kcal' && proteinPerKcal.direction === 'DESC', 'protein-per-kcal metric mismatch')
ok(proteinPerKcal.derivationBoundary === 'PROTEIN_GRAMS_DIVIDED_BY_KCAL_TIMES_100_USING_EXACT_250ML_LABEL_VALUES', 'protein-per-kcal derivation boundary mismatch')
ok(proteinPerKcal.tiePolicy === 'NO_SECONDARY_ORDER_WITHIN_EQUAL_DERIVED_VALUES', 'protein-per-kcal tie policy mismatch')
const expectedProteinEntries = [
  ['altive-protein-banana-250ml', 21, 115, 18.26087],
  ['altive-protein-chestnut-250ml', 21, 115, 18.26087],
  ['altive-protein-pistachio-250ml', 21, 115, 18.26087],
  ['altive-protein-royal-milk-tea-250ml', 20, 115, 17.391304],
  ['altive-protein-chocolate-250ml', 21, 125, 16.8],
]
ok(JSON.stringify(proteinPerKcal.entries.map((row) => [row.itemKey, row.proteinGrams, row.kcal, row.value])) === JSON.stringify(expectedProteinEntries), 'protein-per-kcal entries mismatch')
for (const row of proteinPerKcal.entries) {
  const derived = (row.proteinGrams / row.kcal) * 100
  ok(Math.abs(row.value - derived) < 0.000001, `${row.itemKey} protein-per-kcal derivation mismatch`)
}
for (let index = 1; index < proteinPerKcal.entries.length; index += 1) ok(proteinPerKcal.entries[index - 1].value >= proteinPerKcal.entries[index].value, 'protein-per-kcal entries must be non-increasing')
ok(proteinPerKcal.entries[0].value === proteinPerKcal.entries[1].value && proteinPerKcal.entries[1].value === proteinPerKcal.entries[2].value, 'top three protein-per-kcal entries must preserve exact tie')

ok(sodium.metric === 'officialDeclaredSodiumMgPer250ml' && sodium.direction === 'ASC', 'sodium metric mismatch')
ok(sodium.tiePolicy === 'NO_SECONDARY_ORDER_IF_EQUAL_SOURCE_VALUES_OCCUR', 'sodium tie policy mismatch')
const expectedSodiumEntries = [
  ['altive-protein-chestnut-250ml', 320],
  ['altive-protein-chocolate-250ml', 330],
  ['altive-protein-royal-milk-tea-250ml', 380],
  ['altive-protein-pistachio-250ml', 420],
  ['altive-protein-banana-250ml', 450],
]
ok(JSON.stringify(sodium.entries.map((row) => [row.itemKey, row.value])) === JSON.stringify(expectedSodiumEntries), 'sodium entries mismatch')
for (let index = 1; index < sodium.entries.length; index += 1) ok(sodium.entries[index - 1].value <= sodium.entries[index].value, 'sodium entries must be non-decreasing')

ok(Array.isArray(recovery.remainingTargetFamilyBlockedFacts) && recovery.remainingTargetFamilyBlockedFacts.length === 0, 'convenience-protein target family must have no remaining blocked FACTs after R8')
const closure = recovery.closure || {}
ok(closure.wave4BlockedFactsOriginally === 13 && closure.wave4RecoveredThroughR8 === 3 && closure.wave4BlockedFactsAfterR8 === 10, 'Wave 4 recovery closure counts mismatch')
ok(closure.convenienceProteinFactCount === 3 && closure.convenienceProteinRecoveredFactCount === 3 && closure.remainingConvenienceProteinBlockedFacts === 0, 'convenience-protein closure counts mismatch')
ok(closure.manifestCoverage === 200, 'manifest coverage must remain 200')
ok(closure.productionRowsWritten === 0 && closure.publicRowsPublished === 0 && closure.recommendationRuns === 0, 'write/publication/recommendation authority boundary violated')
ok(closure.editorialWeightsAssigned === 0 && closure.fabricatedVoteRows === 0, 'editorial/vote fabrication boundary violated')

ok(!page.includes('blocked-evidence-r8.json'), 'public ranking page must not consume R8 recovery evidence')
ok(pkg.scripts?.['verify:content-corpus-200-blocked-recovery-r8'] === 'node scripts/verify-content-corpus-200-blocked-recovery-r8.mjs', 'package R8 verifier wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-blocked-recovery-r7\n      - run: npm run verify:content-corpus-200-blocked-recovery-r8'), 'CI R8 verifier must follow R7')

const sha = jsonSha(recovery)
console.log('CONTENT-CORPUS-200 blocked evidence recovery R8 result:')
console.log(JSON.stringify({
  version: recovery.version,
  manifestSha256: recovery.manifestSha256,
  baseWave4EvidenceSha256: wave4Sha,
  evidenceSha256: sha,
  sourceSnapshotCount: sources.length,
  recoveredFacts: recovered.map((row) => row.manifestId),
  convenienceProteinRecoveredFactCount: closure.convenienceProteinRecoveredFactCount,
  remainingConvenienceProteinBlockedFacts: closure.remainingConvenienceProteinBlockedFacts,
  authority: recovery.authorityBoundary,
}, null, 2))
ok(EXPECTED !== 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION', `R8 evidence must be frozen after first structurally valid execution; observed sha256=${sha}`)
ok(sha === EXPECTED, `R8 evidence freeze mismatch: expected ${EXPECTED}, observed ${sha}`)
console.log(`CONTENT-CORPUS-200 blocked recovery R8 contracts: PASS (${sha.slice(0, 16)})`)
