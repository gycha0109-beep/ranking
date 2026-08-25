import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  recovery: p('content/corpus-200/recovery/blocked-evidence-r3.json'),
  r1: p('content/corpus-200/recovery/blocked-evidence-r1.json'),
  r2: p('content/corpus-200/recovery/blocked-evidence-r2.json'),
  wave3: p('content/corpus-200/materialization/wave-3.json'),
  page: p('src/app/rankings/[rankingSlug]/page.tsx'),
  pkg: p('package.json'),
  ci: p('.github/workflows/ci.yml'),
}
const MANIFEST = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const WAVE3_SHA = 'f366862c0b6d9edd881245dbaba35572faa4e7bbde8b10c4af4ac5872634e756'
const R1_SHA = '6e5897ef79dc7280e7da1e2b87a2f663f49d383f27a7d65885c84fa09381c42c'
const R2_SHA = '6ded2c4dc33993e223ffac3ed777a232ec40aa9d5a7556b6c25d1f28653474cc'
const EXPECTED = 'fe70b352fa329a1d230c87cb071b44e92b67e246758b62099aec7c7679505a9e'
const fail = (message) => { console.error(`CONTENT-CORPUS-200 blocked recovery R3 verification failed: ${message}`); process.exit(1) }
const ok = (value, message) => { if (!value) fail(message) }
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files)) ok(fs.existsSync(file), `${path.basename(file)} must exist`)
const recovery = read(files.recovery)
const r1 = read(files.r1)
const r2 = read(files.r2)
const wave3 = read(files.wave3)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = read(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(wave3) === WAVE3_SHA, 'frozen Wave 3 evidence mutated')
ok(jsonSha(r1) === R1_SHA, 'frozen Recovery R1 evidence mutated')
ok(jsonSha(r2) === R2_SHA, 'frozen Recovery R2 evidence mutated')
ok(recovery.version === 'content-corpus-200-blocked-evidence-recovery-r3-v1', 'recovery version mismatch')
ok(recovery.manifestVersion === 'content-corpus-200-manifest-v1' && recovery.manifestSha256 === MANIFEST, 'manifest identity mismatch')
ok(recovery.status === 'BLOCKED_EVIDENCE_RECOVERY_PARTIALLY_MATERIALIZED', 'recovery status mismatch')
ok(recovery.observedAt === '2026-08-25T14:22:00+09:00', 'observation time mismatch')
ok(recovery.baseWave?.wave === 3 && recovery.baseWave?.evidenceSha256 === WAVE3_SHA, 'base Wave 3 identity mismatch')
ok(JSON.stringify(recovery.priorRecoveries?.map((row) => row.evidenceSha256)) === JSON.stringify([R1_SHA, R2_SHA]), 'prior recovery identity mismatch')
ok(Object.values(recovery.authorityBoundary || {}).every((value) => value === false), 'all authority flags must remain false')

const expectedUrls = new Map([
  ['steam-palworld-review-all-r3', 'https://store.steampowered.com/app/1623730/Palworld/'],
  ['steam-rust-review-all-r3', 'https://store.steampowered.com/app/252490/Rust/'],
  ['steam-project-zomboid-review-all-r3', 'https://store.steampowered.com/app/108600/Project_Zomboid/'],
  ['steam-7dtd-review-all-r3', 'https://store.steampowered.com/app/251570/7_Days_to_Die/'],
  ['steam-dst-review-all-r3', 'https://store.steampowered.com/app/322330/Dont_Starve_Together/'],
  ['steam-valheim-review-all-r3', 'https://store.steampowered.com/app/892970/Valheim/'],
])
const sources = recovery.sourceSnapshots || []
ok(sources.length === 6 && new Set(sources.map((source) => source.id)).size === 6, 'source snapshot count mismatch')
for (const source of sources) {
  ok(source.sourceKey === 'steam-store-pages', `${source.id} sourceKey mismatch`)
  ok(source.url === expectedUrls.get(source.id), `${source.id} exact official Steam URL mismatch`)
  ok(source.referencePeriod === 'official-store-review-snapshot-reviewed-2026-08-25', `${source.id} reference period mismatch`)
  ok(/Review Type > All/.test(source.note || ''), `${source.id} must bind Review Type > All field`)
  ok(/not the review-score count|off-topic-filtered review-score count/i.test(source.note || ''), `${source.id} review-score exclusion note missing`)
}

const family = wave3.families.find((item) => item.familyId === 'steam-coop-survival')
ok(family?.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', 'frozen Steam candidate universe missing')
const frozenCandidates = family.candidateUniverse.items.map((item) => item.itemKey)
ok(JSON.stringify(frozenCandidates) === JSON.stringify(['palworld','rust','project-zomboid','7-days-to-die','dont-starve-together','valheim']), 'frozen Steam candidate sequence mismatch')
const baseFact = family.rankings.find((ranking) => ranking.manifestId === 'cc200-steam-coop-survival-02')
ok(baseFact?.materializationStatus === 'BLOCKED_SOURCE_GAP', 'base Wave 3 Steam review FACT must remain immutable and blocked')
ok(baseFact?.blocker === 'NO_SINGLE_SAME_SCOPE_OFFICIAL_REVIEW_COUNT_SNAPSHOT_ACROSS_FULL_FROZEN_POOL', 'base Steam review blocker changed unexpectedly')

const recovered = recovery.recoveredFacts || []
ok(recovered.length === 1, 'R3 must recover exactly one FACT')
const reviews = recovered[0]
ok(reviews.manifestId === 'cc200-steam-coop-survival-02' && reviews.familyId === 'steam-coop-survival', 'recovered FACT identity mismatch')
ok(reviews.baseMaterializationStatus === 'BLOCKED_SOURCE_GAP' && reviews.materializationStatus === 'RECOVERED_MATERIALIZED_FACT', 'recovered FACT state mismatch')
ok(reviews.metric === 'officialSteamReviewTypeAllRawCountAtFrozenReviewedSnapshot' && reviews.direction === 'DESC', 'review metric mismatch')
ok(reviews.reviewCountField === 'REVIEW_TYPE_ALL_RAW_SUBMITTED_REVIEWS', 'review field boundary mismatch')
ok(reviews.reviewScoreCountExcluded === true && reviews.recentReviewCountExcluded === true, 'review-score/recent-count exclusions must remain explicit')
ok(reviews.offTopicReviewScoreFilteringIrrelevantToMetric === true, '7DTD off-topic review-score boundary missing')
ok(reviews.scopeBoundary === 'EXACT_WAVE3_FROZEN_SIX_TITLE_STEAM_COOP_SURVIVAL_POOL_NOT_ALL_STEAM_GAMES', 'Steam pool scope boundary mismatch')
ok(reviews.snapshotBoundary === 'FROZEN_OFFICIAL_STORE_REVIEW_SURFACES_NOT_LIVE_TO_SECOND_COUNTS', 'snapshot boundary mismatch')
ok(new Set(reviews.sourceSnapshotIds || []).size === 6 && reviews.sourceSnapshotIds.every((id) => expectedUrls.has(id)), 'recovered FACT source binding mismatch')

const expectedEntries = [
  ['rust', 1390192],
  ['dont-starve-together', 541307],
  ['valheim', 539957],
  ['palworld', 472845],
  ['project-zomboid', 470222],
  ['7-days-to-die', 407330],
]
ok(JSON.stringify(reviews.entries.map((entry) => [entry.itemKey, entry.value])) === JSON.stringify(expectedEntries), 'Steam review count evidence mismatch')
for (let index = 1; index < reviews.entries.length; index += 1) ok(reviews.entries[index - 1].value >= reviews.entries[index].value, 'Steam review entries must be non-increasing')
ok(JSON.stringify(reviews.entries.map((entry) => entry.itemKey).sort()) === JSON.stringify([...frozenCandidates].sort()), 'R3 must cover exactly the frozen six-title pool')

const priorRecoveredIds = new Set([...(r1.recoveredFacts || []), ...(r2.recoveredFacts || [])].map((row) => row.manifestId))
ok(!priorRecoveredIds.has(reviews.manifestId), 'R3 must not duplicate a prior recovered FACT')
const originalWave3Blocked = wave3.families.flatMap((item) => item.rankings).filter((ranking) => ranking.kind === 'FACT' && ranking.materializationStatus === 'BLOCKED_SOURCE_GAP')
ok(originalWave3Blocked.length === 6, 'Wave 3 original blocked FACT count mismatch')
const recoveredWave3Ids = new Set([r2, recovery].flatMap((artifact) => (artifact.recoveredFacts || []).map((row) => row.manifestId)))
const expectedRemainingIds = originalWave3Blocked.map((ranking) => ranking.manifestId).filter((id) => !recoveredWave3Ids.has(id)).sort()
const remaining = recovery.remainingBlockedFacts || []
ok(remaining.length === 4, 'R3 remaining blocked FACT count mismatch')
ok(JSON.stringify(remaining.map((row) => row.manifestId).sort()) === JSON.stringify(expectedRemainingIds), 'R3 remaining blocked FACT set mismatch')
for (const row of remaining) ok(row.blocker?.length >= 40 && !('entries' in row) && !('metric' in row), `${row.manifestId} blocked outcome must not fabricate data`)

const closure = recovery.closure || {}
ok(closure.wave3BlockedFactsOriginally === 6 && closure.priorRecoveredFactsFromWave3 === 1 && closure.recoveredFactCount === 1 && closure.wave3BlockedFactsAfterR3 === 4, 'R3 closure counts mismatch')
ok(closure.manifestCoverage === 200, 'manifest coverage must remain 200')
ok(closure.productionRowsWritten === 0 && closure.publicRowsPublished === 0 && closure.recommendationRuns === 0, 'write/publication/recommendation authority violated')
ok(closure.editorialWeightsAssigned === 0 && closure.fabricatedVoteRows === 0, 'editorial/vote fabrication boundary violated')

ok(!page.includes('blocked-evidence-r3.json'), 'public ranking page must not consume R3 evidence')
ok(pkg.scripts?.['verify:content-corpus-200-blocked-recovery-r3'] === 'node scripts/verify-content-corpus-200-blocked-recovery-r3.mjs', 'package verifier wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-blocked-recovery-r3'), 'CI verifier wiring missing')

const sha = jsonSha(recovery)
console.log('CONTENT-CORPUS-200 blocked evidence recovery R3 result:')
console.log(JSON.stringify({
  version: recovery.version,
  manifestSha256: recovery.manifestSha256,
  baseWave3EvidenceSha256: jsonSha(wave3),
  priorRecoveryR1EvidenceSha256: jsonSha(r1),
  priorRecoveryR2EvidenceSha256: jsonSha(r2),
  evidenceSha256: sha,
  sourceSnapshotCount: sources.length,
  recoveredFacts: recovered.map((row) => row.manifestId),
  wave3BlockedFactsOriginally: closure.wave3BlockedFactsOriginally,
  wave3BlockedFactsAfterR3: closure.wave3BlockedFactsAfterR3,
  authority: recovery.authorityBoundary,
}, null, 2))
ok(EXPECTED !== 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION', `R3 evidence must be frozen after first structurally valid execution; observed sha256=${sha}`)
ok(sha === EXPECTED, `R3 evidence freeze mismatch: expected ${EXPECTED}, observed ${sha}`)
console.log(`CONTENT-CORPUS-200 blocked recovery R3 contracts: PASS (${sha.slice(0, 16)})`)
