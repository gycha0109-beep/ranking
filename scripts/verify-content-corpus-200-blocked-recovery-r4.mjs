import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  recovery: p('content/corpus-200/recovery/blocked-evidence-r4.json'),
  r1: p('content/corpus-200/recovery/blocked-evidence-r1.json'),
  r2: p('content/corpus-200/recovery/blocked-evidence-r2.json'),
  r3: p('content/corpus-200/recovery/blocked-evidence-r3.json'),
  wave2: p('content/corpus-200/materialization/wave-2.json'),
  wave2Provenance: p('content/corpus-200/materialization/wave-2-provenance.json'),
  page: p('src/app/rankings/[rankingSlug]/page.tsx'),
  pkg: p('package.json'),
  ci: p('.github/workflows/ci.yml'),
}
const MANIFEST = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const WAVE2_SHA = 'dab9b2cde2b8bbf3e6eed3ddcdf166df408d2df30a20bbb3e38bbbf105276023'
const R1_SHA = '6e5897ef79dc7280e7da1e2b87a2f663f49d383f27a7d65885c84fa09381c42c'
const R2_SHA = '6ded2c4dc33993e223ffac3ed777a232ec40aa9d5a7556b6c25d1f28653474cc'
const R3_SHA = 'fe70b352fa329a1d230c87cb071b44e92b67e246758b62099aec7c7679505a9e'
const EXPECTED = 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION'
const fail = (message) => { console.error(`CONTENT-CORPUS-200 blocked recovery R4 verification failed: ${message}`); process.exit(1) }
const ok = (value, message) => { if (!value) fail(message) }
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files)) ok(fs.existsSync(file), `${path.basename(file)} must exist`)
const recovery = read(files.recovery)
const r1 = read(files.r1)
const r2 = read(files.r2)
const r3 = read(files.r3)
const wave2 = read(files.wave2)
const wave2Provenance = read(files.wave2Provenance)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = read(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')
const wave2EvidenceSha = jsonSha({ wave: wave2, provenance: wave2Provenance })

ok(wave2EvidenceSha === WAVE2_SHA, 'frozen Wave 2 evidence bundle mutated')
ok(jsonSha(r1) === R1_SHA, 'frozen Recovery R1 evidence mutated')
ok(jsonSha(r2) === R2_SHA, 'frozen Recovery R2 evidence mutated')
ok(jsonSha(r3) === R3_SHA, 'frozen Recovery R3 evidence mutated')
ok(recovery.version === 'content-corpus-200-blocked-evidence-recovery-r4-v1', 'recovery version mismatch')
ok(recovery.manifestVersion === 'content-corpus-200-manifest-v1' && recovery.manifestSha256 === MANIFEST, 'manifest identity mismatch')
ok(recovery.status === 'BLOCKED_EVIDENCE_RECOVERY_PARTIALLY_MATERIALIZED', 'recovery status mismatch')
ok(recovery.observedAt === '2026-08-25T15:24:00+09:00', 'observation time mismatch')
ok(recovery.baseWave?.wave === 2 && recovery.baseWave?.evidenceSha256 === WAVE2_SHA, 'base Wave 2 identity mismatch')
ok(JSON.stringify(recovery.priorRecoveries?.map((row) => row.evidenceSha256)) === JSON.stringify([R1_SHA, R2_SHA, R3_SHA]), 'prior recovery identity mismatch')
ok(Object.values(recovery.authorityBoundary || {}).every((value) => value === false), 'all authority flags must remain false')

const expectedUrls = new Map([
  ['tving-premium-price-r4', 'https://www.tving.com/bill/subscription/plan'],
  ['tving-premium-4k-r4', 'https://mkt.tving.com/2025twdouble/index.html'],
  ['netflix-premium-4k-r4', 'https://www.netflix.com/kr/title/80193549'],
  ['disneyplus-premium-4k-r4', 'https://www.disneyplus.com/ko-kr'],
  ['watcha-premium-4k-r4', 'https://watcha.com/ko-KR/promotions/ibk_narasarang_card'],
  ['apple-tv-membership-price-r4', 'https://www.apple.com/kr/apple-tv/'],
  ['apple-tv-4k-capability-r4', 'https://support.apple.com/ko-kr/guide/tvplus/welcome/web'],
])
const sources = recovery.sourceSnapshots || []
ok(sources.length === 7 && new Set(sources.map((source) => source.id)).size === 7, 'source snapshot count mismatch')
for (const source of sources) {
  ok(source.url === expectedUrls.get(source.id), `${source.id} exact official URL mismatch`)
  ok(/reviewed-2026-08-25/.test(source.referencePeriod || ''), `${source.id} reference period mismatch`)
  ok(source.note?.length >= 70, `${source.id} evidence note too weak`)
}
ok(sources.find((source) => source.id === 'tving-premium-price-r4')?.sourceKey === 'streaming-official-pricing', 'TVING price source key mismatch')
ok(sources.find((source) => source.id === 'tving-premium-4k-r4')?.sourceKey === 'streaming-official-features', 'TVING 4K source key mismatch')
ok(/KRW 17000/.test(sources.find((source) => source.id === 'tving-premium-price-r4')?.note || ''), 'TVING regular Premium price evidence missing')
ok(/some 4K quality on TV/.test(sources.find((source) => source.id === 'tving-premium-4k-r4')?.note || ''), 'TVING 4K capability evidence missing')
ok(/temporary KRW 9030 promotion price is explicitly excluded/.test(sources.find((source) => source.id === 'watcha-premium-4k-r4')?.note || ''), 'Watcha promotion exclusion missing')

const family = wave2.families.find((item) => item.familyId === 'streaming-services')
ok(family?.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', 'frozen streaming candidate universe missing')
const frozenCandidates = family.candidateUniverse.items.map((item) => item.itemKey)
ok(JSON.stringify(frozenCandidates) === JSON.stringify(['tving','netflix','disney-plus','watcha','apple-tv']), 'frozen streaming candidate sequence mismatch')
const baseFact = family.rankings.find((ranking) => ranking.manifestId === 'cc200-streaming-services-03')
ok(baseFact?.materializationStatus === 'BLOCKED_SOURCE_GAP', 'base Wave 2 streaming 4K FACT must remain immutable and blocked')
ok(baseFact?.blocker === 'LOWEST_4K_PLAN_NOT_EXACTLY_DETERMINED_FOR_ALL_FIVE_SERVICES_FROM_REVIEWED_OFFICIAL_SURFACES_TVING_REMAINS_UNRESOLVED', 'base streaming 4K blocker changed unexpectedly')

const recovered = recovery.recoveredFacts || []
ok(recovered.length === 1, 'R4 must recover exactly one FACT')
const plans = recovered[0]
ok(plans.manifestId === 'cc200-streaming-services-03' && plans.familyId === 'streaming-services', 'recovered FACT identity mismatch')
ok(plans.baseMaterializationStatus === 'BLOCKED_SOURCE_GAP' && plans.materializationStatus === 'RECOVERED_MATERIALIZED_FACT', 'recovered FACT state mismatch')
ok(plans.metric === 'lowestRegularMonthlyPlanWithDocumented4KCapabilityKrw' && plans.direction === 'ASC', '4K plan metric mismatch')
ok(plans.priceBoundary === 'REGULAR_MONTHLY_STANDALONE_PRICE_PROMOTIONS_BUNDLES_AND_ANNUAL_DISCOUNTS_EXCLUDED', 'price comparison boundary mismatch')
ok(plans.qualityBoundary === 'DOCUMENTED_4K_CAPABILITY_ON_SUPPORTED_CONTENT_DEVICES_NOT_EVERY_TITLE_OR_DEVICE_GUARANTEED_4K', '4K capability boundary mismatch')
ok(plans.tiePolicy === 'SOURCE_VALUE_TIE_PRESERVED_NO_INVENTED_TIEBREAKER', 'tie policy mismatch')
ok(plans.scopeBoundary === 'EXACT_WAVE2_FROZEN_FIVE_SERVICE_KOREA_AVAILABLE_STREAMING_POOL_NOT_ALL_STREAMING_SERVICES', 'streaming scope boundary mismatch')
ok(new Set(plans.sourceSnapshotIds || []).size === 7 && plans.sourceSnapshotIds.every((id) => expectedUrls.has(id)), 'recovered FACT source binding mismatch')

const expectedEntries = [
  ['apple-tv', 6500, '월간 멤버십'],
  ['watcha', 12900, '프리미엄'],
  ['disney-plus', 13900, '프리미엄'],
  ['netflix', 17000, '프리미엄'],
  ['tving', 17000, '프리미엄'],
]
ok(JSON.stringify(plans.entries.map((entry) => [entry.itemKey, entry.value, entry.plan])) === JSON.stringify(expectedEntries), 'streaming 4K regular monthly plan evidence mismatch')
for (const entry of plans.entries) ok(entry.documented4K === true && /4K/i.test(entry.note || ''), `${entry.itemKey} must retain explicit documented 4K boundary`)
for (let index = 1; index < plans.entries.length; index += 1) ok(plans.entries[index - 1].value <= plans.entries[index].value, 'streaming plan entries must be non-decreasing')
ok(plans.entries.at(-2).value === plans.entries.at(-1).value, 'Netflix/TVING regular monthly tie must be preserved')
ok(JSON.stringify(plans.entries.map((entry) => entry.itemKey).sort()) === JSON.stringify([...frozenCandidates].sort()), 'R4 must cover exactly the frozen five-service pool')

const priorRecoveredIds = new Set([r1, r2, r3].flatMap((artifact) => (artifact.recoveredFacts || []).map((row) => row.manifestId)))
ok(!priorRecoveredIds.has(plans.manifestId), 'R4 must not duplicate a prior recovered FACT')
const originalWave2Blocked = wave2.families.flatMap((item) => item.rankings).filter((ranking) => ranking.kind === 'FACT' && ranking.materializationStatus === 'BLOCKED_SOURCE_GAP')
ok(originalWave2Blocked.length === 6, 'Wave 2 original blocked FACT count mismatch')
const expectedRemainingIds = originalWave2Blocked.map((ranking) => ranking.manifestId).filter((id) => id !== plans.manifestId).sort()
const remaining = recovery.remainingBlockedFacts || []
ok(remaining.length === 5, 'R4 remaining Wave 2 blocked FACT count mismatch')
ok(JSON.stringify(remaining.map((row) => row.manifestId).sort()) === JSON.stringify(expectedRemainingIds), 'R4 remaining Wave 2 blocked FACT set mismatch')
for (const row of remaining) ok(row.blocker?.length >= 40 && !('entries' in row) && !('metric' in row), `${row.manifestId} blocked outcome must not fabricate data`)

const closure = recovery.closure || {}
ok(closure.wave2BlockedFactsOriginally === 6 && closure.recoveredFactCount === 1 && closure.wave2BlockedFactsAfterR4 === 5, 'R4 closure counts mismatch')
ok(closure.manifestCoverage === 200, 'manifest coverage must remain 200')
ok(closure.productionRowsWritten === 0 && closure.publicRowsPublished === 0 && closure.recommendationRuns === 0, 'write/publication/recommendation authority violated')
ok(closure.editorialWeightsAssigned === 0 && closure.fabricatedVoteRows === 0, 'editorial/vote fabrication boundary violated')

ok(!page.includes('blocked-evidence-r4.json'), 'public ranking page must not consume R4 evidence')
ok(pkg.scripts?.['verify:content-corpus-200-blocked-recovery-r4'] === 'node scripts/verify-content-corpus-200-blocked-recovery-r4.mjs', 'package verifier wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-blocked-recovery-r4'), 'CI verifier wiring missing')

const sha = jsonSha(recovery)
console.log('CONTENT-CORPUS-200 blocked evidence recovery R4 result:')
console.log(JSON.stringify({
  version: recovery.version,
  manifestSha256: recovery.manifestSha256,
  baseWave2EvidenceSha256: wave2EvidenceSha,
  priorRecoveryR1EvidenceSha256: jsonSha(r1),
  priorRecoveryR2EvidenceSha256: jsonSha(r2),
  priorRecoveryR3EvidenceSha256: jsonSha(r3),
  evidenceSha256: sha,
  sourceSnapshotCount: sources.length,
  recoveredFacts: recovered.map((row) => row.manifestId),
  wave2BlockedFactsOriginally: closure.wave2BlockedFactsOriginally,
  wave2BlockedFactsAfterR4: closure.wave2BlockedFactsAfterR4,
  authority: recovery.authorityBoundary,
}, null, 2))
ok(EXPECTED !== 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION', `R4 evidence must be frozen after first structurally valid execution; observed sha256=${sha}`)
ok(sha === EXPECTED, `R4 evidence freeze mismatch: expected ${EXPECTED}, observed ${sha}`)
console.log(`CONTENT-CORPUS-200 blocked recovery R4 contracts: PASS (${sha.slice(0, 16)})`)
