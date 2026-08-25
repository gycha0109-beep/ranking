import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  recovery: p('content/corpus-200/recovery/blocked-evidence-r5.json'),
  r1: p('content/corpus-200/recovery/blocked-evidence-r1.json'),
  r2: p('content/corpus-200/recovery/blocked-evidence-r2.json'),
  r3: p('content/corpus-200/recovery/blocked-evidence-r3.json'),
  r4: p('content/corpus-200/recovery/blocked-evidence-r4.json'),
  wave3: p('content/corpus-200/materialization/wave-3.json'),
  page: p('src/app/rankings/[rankingSlug]/page.tsx'),
  pkg: p('package.json'),
  ci: p('.github/workflows/ci.yml'),
}
const MANIFEST = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const WAVE3_SHA = 'f366862c0b6d9edd881245dbaba35572faa4e7bbde8b10c4af4ac5872634e756'
const R1_SHA = '6e5897ef79dc7280e7da1e2b87a2f663f49d383f27a7d65885c84fa09381c42c'
const R2_SHA = '6ded2c4dc33993e223ffac3ed777a232ec40aa9d5a7556b6c25d1f28653474cc'
const R3_SHA = 'fe70b352fa329a1d230c87cb071b44e92b67e246758b62099aec7c7679505a9e'
const R4_SHA = 'efedcd57539a34169fc658b8b34a78006b031178e5ddbe15ef9f4042bf782d61'
const EXPECTED = 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION'
const fail = (message) => { console.error(`CONTENT-CORPUS-200 blocked recovery R5 verification failed: ${message}`); process.exit(1) }
const ok = (value, message) => { if (!value) fail(message) }
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
const close = (a, b, epsilon = 1e-9) => Math.abs(a - b) <= epsilon

for (const file of Object.values(files)) ok(fs.existsSync(file), `${path.basename(file)} must exist`)
const recovery = read(files.recovery)
const r1 = read(files.r1)
const r2 = read(files.r2)
const r3 = read(files.r3)
const r4 = read(files.r4)
const wave3 = read(files.wave3)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = read(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(wave3) === WAVE3_SHA, 'frozen Wave 3 evidence mutated')
ok(jsonSha(r1) === R1_SHA, 'frozen Recovery R1 evidence mutated')
ok(jsonSha(r2) === R2_SHA, 'frozen Recovery R2 evidence mutated')
ok(jsonSha(r3) === R3_SHA, 'frozen Recovery R3 evidence mutated')
ok(jsonSha(r4) === R4_SHA, 'frozen Recovery R4 evidence mutated')
ok(recovery.version === 'content-corpus-200-blocked-evidence-recovery-r5-v1', 'recovery version mismatch')
ok(recovery.manifestVersion === 'content-corpus-200-manifest-v1' && recovery.manifestSha256 === MANIFEST, 'manifest identity mismatch')
ok(recovery.status === 'BLOCKED_EVIDENCE_RECOVERY_PARTIALLY_MATERIALIZED', 'recovery status mismatch')
ok(recovery.observedAt === '2026-08-25T15:24:00+09:00', 'observation time mismatch')
ok(recovery.baseWave?.wave === 3 && recovery.baseWave?.evidenceSha256 === WAVE3_SHA, 'base Wave 3 identity mismatch')
ok(JSON.stringify(recovery.priorRecoveries?.map((row) => row.evidenceSha256)) === JSON.stringify([R1_SHA, R2_SHA, R3_SHA, R4_SHA]), 'prior recovery identity mismatch')
ok(Object.values(recovery.authorityBoundary || {}).every((value) => value === false), 'all authority flags must remain false')

const expectedSources = new Map([
  ['drg-green-mild-sun-list-price-r5', ['https://www.dr-g.co.kr/item/4415', 24000, 35, 'beauty-official-products']],
  ['innisfree-vitamin-c-peach-list-price-r5', ['https://m.innisfree.com/kr/ko/dp/product/100331', 26000, 50, 'beauty-official-products']],
  ['hera-uv-protector-fresh-list-price-r5', ['https://www.amoremall.com/kr/ko/product/detail?onlineProdCode=111070001630&onlineProdSn=56400', 47000, 50, 'beauty-retail-pricing']],
  ['iope-uv-shield-list-price-r5', ['https://www.amoremall.com/kr/ko/product/detail?onlineProdCode=111130000888&onlineProdSn=46079', 38000, 50, 'beauty-retail-pricing']],
  ['laneige-water-bank-uv-list-price-r5', ['https://www.amoremall.com/kr/ko/product/detail?onlineProdCode=111970001870&onlineProdSn=64558', 28000, 50, 'beauty-retail-pricing']],
])
const sources = recovery.sourceSnapshots || []
ok(sources.length === 5 && new Set(sources.map((source) => source.id)).size === 5, 'source snapshot count mismatch')
for (const source of sources) {
  const expected = expectedSources.get(source.id)
  ok(expected, `${source.id} is not an allowed R5 price source`)
  ok(source.url === expected[0], `${source.id} exact source URL mismatch`)
  ok(source.regularListPriceKrw === expected[1] && source.volumeMl === expected[2], `${source.id} price/volume mismatch`)
  ok(source.sourceKey === expected[3], `${source.id} sourceKey mismatch`)
  ok(/reviewed-2026-08-25/.test(source.referencePeriod || ''), `${source.id} reference period mismatch`)
  ok(/undiscounted|regular price|list price/i.test(source.note || ''), `${source.id} must identify regular/list price`)
  ok(/exclude|excludes|only/i.test(source.note || ''), `${source.id} must preserve discount exclusion boundary`)
}

const family = wave3.families.find((item) => item.familyId === 'sunscreens')
ok(family?.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', 'frozen sunscreen candidate universe missing')
const frozenCandidates = family.candidateUniverse.items.map((item) => item.itemKey)
const expectedFrozenCandidates = [
  'drg-green-mild-up-sun-plus-35',
  'innisfree-vitamin-c-peach-toneup-50',
  'hera-uv-protector-fresh-50',
  'iope-uv-shield-sun-protector-50',
  'laneige-water-bank-uv-barrier-50',
]
ok(JSON.stringify(frozenCandidates) === JSON.stringify(expectedFrozenCandidates), 'frozen sunscreen candidate sequence mismatch')
const volumeFact = family.rankings.find((ranking) => ranking.manifestId === 'cc200-sunscreens-02')
ok(volumeFact?.materializationStatus === 'MATERIALIZED_FACT' && volumeFact.metric === 'officialPackageVolumeMl', 'frozen sunscreen volume authority missing')
const frozenVolumeByItem = new Map(volumeFact.entries.map((entry) => [entry.itemKey, entry.value]))
const baseFact = family.rankings.find((ranking) => ranking.manifestId === 'cc200-sunscreens-01')
ok(baseFact?.materializationStatus === 'BLOCKED_SOURCE_GAP', 'base Wave 3 sunscreen price FACT must remain immutable and blocked')
ok(baseFact?.blocker === 'NO_SINGLE_COMPARABLE_CURRENT_KOREAN_RETAIL_PRICE_SNAPSHOT_ACROSS_ALL_FIVE_FROZEN_PRODUCTS', 'base sunscreen price blocker changed unexpectedly')

const recovered = recovery.recoveredFacts || []
ok(recovered.length === 1, 'R5 must recover exactly one FACT')
const prices = recovered[0]
ok(prices.manifestId === 'cc200-sunscreens-01' && prices.familyId === 'sunscreens', 'recovered FACT identity mismatch')
ok(prices.baseMaterializationStatus === 'BLOCKED_SOURCE_GAP' && prices.materializationStatus === 'RECOVERED_MATERIALIZED_FACT', 'recovered FACT state mismatch')
ok(prices.metric === 'regularListPriceKrwPerMlAtFrozenSnapshot' && prices.direction === 'ASC', 'price-per-ml metric mismatch')
ok(prices.priceBoundary === 'UNDISCOUNTED_REGULAR_LIST_PRICE_ONLY_TEMPORARY_SALE_MEMBER_COUPON_AND_BUNDLE_PRICES_EXCLUDED', 'price boundary mismatch')
ok(prices.derivationBoundary === 'REGULAR_LIST_PRICE_KRW_DIVIDED_BY_EXACT_FROZEN_OFFICIAL_PACKAGE_VOLUME_ML', 'price derivation boundary mismatch')
ok(prices.scopeBoundary === 'EXACT_WAVE3_FROZEN_FIVE_PRODUCT_KOREAN_MARKET_SUNSCREEN_POOL_NOT_ALL_SUNSCREENS', 'sunscreen scope boundary mismatch')
ok(new Set(prices.sourceSnapshotIds || []).size === 5 && prices.sourceSnapshotIds.every((id) => expectedSources.has(id)), 'recovered FACT source binding mismatch')

const expectedEntries = [
  ['innisfree-vitamin-c-peach-toneup-50', 26000, 50, 520],
  ['laneige-water-bank-uv-barrier-50', 28000, 50, 560],
  ['drg-green-mild-up-sun-plus-35', 24000, 35, 24000 / 35],
  ['iope-uv-shield-sun-protector-50', 38000, 50, 760],
  ['hera-uv-protector-fresh-50', 47000, 50, 940],
]
ok(prices.entries.length === expectedEntries.length, 'price entry count mismatch')
for (let index = 0; index < expectedEntries.length; index += 1) {
  const entry = prices.entries[index]
  const expected = expectedEntries[index]
  ok(entry.itemKey === expected[0], `price order mismatch at ${index}`)
  ok(entry.regularListPriceKrw === expected[1] && entry.volumeMl === expected[2], `${entry.itemKey} price/volume mismatch`)
  ok(frozenVolumeByItem.get(entry.itemKey) === entry.volumeMl, `${entry.itemKey} volume must match frozen Wave 3 volume authority`)
  ok(close(entry.value, expected[3]) && close(entry.value, entry.regularListPriceKrw / entry.volumeMl), `${entry.itemKey} KRW/ml derivation mismatch`)
  ok(entry.unit === 'KRW/ml', `${entry.itemKey} unit mismatch`)
}
for (let index = 1; index < prices.entries.length; index += 1) ok(prices.entries[index - 1].value <= prices.entries[index].value, 'price-per-ml entries must be non-decreasing')
ok(JSON.stringify(prices.entries.map((entry) => entry.itemKey).sort()) === JSON.stringify([...frozenCandidates].sort()), 'R5 must cover exactly the frozen five-product pool')

const priorRecoveredIds = new Set([r1, r2, r3, r4].flatMap((artifact) => (artifact.recoveredFacts || []).map((row) => row.manifestId)))
ok(!priorRecoveredIds.has(prices.manifestId), 'R5 must not duplicate a prior recovered FACT')
const originalWave3Blocked = wave3.families.flatMap((item) => item.rankings).filter((ranking) => ranking.kind === 'FACT' && ranking.materializationStatus === 'BLOCKED_SOURCE_GAP')
ok(originalWave3Blocked.length === 6, 'Wave 3 original blocked FACT count mismatch')
const recoveredWave3Ids = new Set([r2, r3, recovery].flatMap((artifact) => (artifact.recoveredFacts || []).map((row) => row.manifestId)))
const expectedRemainingIds = originalWave3Blocked.map((ranking) => ranking.manifestId).filter((id) => !recoveredWave3Ids.has(id)).sort()
const remaining = recovery.remainingBlockedFacts || []
ok(remaining.length === 3, 'R5 remaining Wave 3 blocked FACT count mismatch')
ok(JSON.stringify(remaining.map((row) => row.manifestId).sort()) === JSON.stringify(expectedRemainingIds), 'R5 remaining Wave 3 blocked FACT set mismatch')
for (const row of remaining) ok(row.blocker?.length >= 40 && !('entries' in row) && !('metric' in row), `${row.manifestId} blocked outcome must not fabricate data`)

const closure = recovery.closure || {}
ok(closure.wave3BlockedFactsOriginally === 6 && closure.priorRecoveredFactsFromWave3 === 2 && closure.recoveredFactCount === 1 && closure.wave3BlockedFactsAfterR5 === 3, 'R5 closure counts mismatch')
ok(closure.manifestCoverage === 200, 'manifest coverage must remain 200')
ok(closure.productionRowsWritten === 0 && closure.publicRowsPublished === 0 && closure.recommendationRuns === 0, 'write/publication/recommendation authority violated')
ok(closure.editorialWeightsAssigned === 0 && closure.fabricatedVoteRows === 0, 'editorial/vote fabrication boundary violated')

ok(!page.includes('blocked-evidence-r5.json'), 'public ranking page must not consume R5 evidence')
ok(pkg.scripts?.['verify:content-corpus-200-blocked-recovery-r5'] === 'node scripts/verify-content-corpus-200-blocked-recovery-r5.mjs', 'package verifier wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-blocked-recovery-r5'), 'CI verifier wiring missing')

const sha = jsonSha(recovery)
console.log('CONTENT-CORPUS-200 blocked evidence recovery R5 result:')
console.log(JSON.stringify({
  version: recovery.version,
  manifestSha256: recovery.manifestSha256,
  baseWave3EvidenceSha256: jsonSha(wave3),
  priorRecoveryR1EvidenceSha256: jsonSha(r1),
  priorRecoveryR2EvidenceSha256: jsonSha(r2),
  priorRecoveryR3EvidenceSha256: jsonSha(r3),
  priorRecoveryR4EvidenceSha256: jsonSha(r4),
  evidenceSha256: sha,
  sourceSnapshotCount: sources.length,
  recoveredFacts: recovered.map((row) => row.manifestId),
  wave3BlockedFactsOriginally: closure.wave3BlockedFactsOriginally,
  wave3BlockedFactsAfterR5: closure.wave3BlockedFactsAfterR5,
  authority: recovery.authorityBoundary,
}, null, 2))
ok(EXPECTED !== 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION', `R5 evidence must be frozen after first structurally valid execution; observed sha256=${sha}`)
ok(sha === EXPECTED, `R5 evidence freeze mismatch: expected ${EXPECTED}, observed ${sha}`)
console.log(`CONTENT-CORPUS-200 blocked recovery R5 contracts: PASS (${sha.slice(0, 16)})`)
