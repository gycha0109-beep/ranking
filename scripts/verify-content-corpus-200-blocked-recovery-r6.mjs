import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  recovery: p('content/corpus-200/recovery/blocked-evidence-r6.json'),
  r1: p('content/corpus-200/recovery/blocked-evidence-r1.json'),
  r2: p('content/corpus-200/recovery/blocked-evidence-r2.json'),
  r3: p('content/corpus-200/recovery/blocked-evidence-r3.json'),
  r4: p('content/corpus-200/recovery/blocked-evidence-r4.json'),
  r5: p('content/corpus-200/recovery/blocked-evidence-r5.json'),
  wave1: p('content/corpus-200/materialization/wave-1.json'),
  page: p('src/app/rankings/[rankingSlug]/page.tsx'),
  pkg: p('package.json'),
  ci: p('.github/workflows/ci.yml'),
}

const MANIFEST = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const WAVE1_SHA = '7e0c2b11cf9f6f5b4468d3ab112a2fa31d5ace2a55ef4bca0713771647562f6c'
const R1_SHA = '6e5897ef79dc7280e7da1e2b87a2f663f49d383f27a7d65885c84fa09381c42c'
const R2_SHA = '6ded2c4dc33993e223ffac3ed777a232ec40aa9d5a7556b6c25d1f28653474cc'
const R3_SHA = 'fe70b352fa329a1d230c87cb071b44e92b67e246758b62099aec7c7679505a9e'
const R4_SHA = 'efedcd57539a34169fc658b8b34a78006b031178e5ddbe15ef9f4042bf782d61'
const R5_SHA = '54d94c069c2ea8731330d3aa1b2d9620bd37559f4e4df9cdd42692352927ac37'
const EXPECTED = 'f2053d7fe208cc6bf658ddebd9c21a2ed3778ed84e90c73f2e94f43f3eeeab36'

const fail = (message) => { console.error(`CONTENT-CORPUS-200 blocked recovery R6 verification failed: ${message}`); process.exit(1) }
const ok = (value, message) => { if (!value) fail(message) }
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files)) ok(fs.existsSync(file), `${path.basename(file)} must exist`)

const recovery = read(files.recovery)
const r1 = read(files.r1)
const r2 = read(files.r2)
const r3 = read(files.r3)
const r4 = read(files.r4)
const r5 = read(files.r5)
const wave1 = read(files.wave1)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = read(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(wave1) === WAVE1_SHA, 'frozen Wave 1 evidence mutated')
ok(jsonSha(r1) === R1_SHA, 'frozen Recovery R1 evidence mutated')
ok(jsonSha(r2) === R2_SHA, 'frozen Recovery R2 evidence mutated')
ok(jsonSha(r3) === R3_SHA, 'frozen Recovery R3 evidence mutated')
ok(jsonSha(r4) === R4_SHA, 'frozen Recovery R4 evidence mutated')
ok(jsonSha(r5) === R5_SHA, 'frozen Recovery R5 evidence mutated')

ok(recovery.version === 'content-corpus-200-blocked-evidence-recovery-r6-v1', 'recovery version mismatch')
ok(recovery.manifestVersion === 'content-corpus-200-manifest-v1' && recovery.manifestSha256 === MANIFEST, 'manifest identity mismatch')
ok(recovery.status === 'BLOCKED_EVIDENCE_RECOVERY_PARTIALLY_MATERIALIZED', 'recovery status mismatch')
ok(recovery.observedAt === '2026-08-25T16:17:34+09:00', 'observation time mismatch')
ok(recovery.baseWave?.wave === 1 && recovery.baseWave?.evidenceSha256 === WAVE1_SHA, 'base Wave 1 identity mismatch')
ok(JSON.stringify(recovery.priorRecoveries?.map((row) => row.evidenceSha256)) === JSON.stringify([R1_SHA, R2_SHA, R3_SHA, R4_SHA, R5_SHA]), 'prior recovery identity mismatch')
ok(Object.values(recovery.authorityBoundary || {}).every((value) => value === false), 'all authority flags must remain false')

const sources = recovery.sourceSnapshots || []
ok(sources.length === 1, 'R6 must freeze exactly one Steam weekly source snapshot')
const source = sources[0]
ok(source.id === 'steam-global-weekly-top-sellers-2026-08-11-r6', 'R6 source ID mismatch')
ok(source.sourceKey === 'steam-official-charts', 'R6 source key mismatch')
ok(source.url === 'https://store.steampowered.com/charts/topsellers/global/2026-8-11', 'R6 must use the exact official Global weekly route')
ok(source.referencePeriod === '2026-08-11/2026-08-18-reviewed-2026-08-25', 'R6 source reference period mismatch')
ok(/Global Weekly Top Sellers/.test(source.note || ''), 'R6 source note must identify the Global weekly chart')
ok(/top 100 products by revenue/i.test(source.note || ''), 'R6 source note must preserve Steam chart definition')
ok(/title labels are directly exposed/i.test(source.note || ''), 'R6 source note must explain why the old retrieval blocker is resolved')
ok(/does not substitute a regional chart/i.test(source.note || ''), 'R6 source note must forbid regional substitution')

const family = wave1.families.find((item) => item.familyId === 'steam-mainstream')
ok(family?.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', 'frozen steam-mainstream candidate universe missing')
const frozenCandidates = family.candidateUniverse.items.map((item) => item.itemKey)
ok(JSON.stringify(frozenCandidates) === JSON.stringify(['counter-strike-2', 'dota-2', 'pubg-battlegrounds', 'palworld', 'fivem']), 'frozen steam-mainstream editorial/vote candidate universe mutated')

const baseFact = family.rankings.find((ranking) => ranking.manifestId === 'cc200-steam-mainstream-02')
ok(baseFact?.kind === 'FACT' && baseFact.materializationStatus === 'BLOCKED_SOURCE_GAP', 'base Wave 1 Steam weekly FACT must remain immutable and blocked')
ok(baseFact?.blocker === 'OFFICIAL_WEEKLY_ROUTE_TITLE_LABELS_NOT_RELIABLY_EXPOSED_BY_CURRENT_RETRIEVAL_SURFACE', 'base Steam weekly blocker changed unexpectedly')
ok(JSON.stringify(baseFact.sourceSnapshotIds) === JSON.stringify(['steam-weekly-2026-08-11']), 'base Steam weekly source binding changed unexpectedly')

const recovered = recovery.recoveredFacts || []
ok(recovered.length === 1, 'R6 must recover exactly one FACT')
const weekly = recovered[0]
ok(weekly.manifestId === 'cc200-steam-mainstream-02' && weekly.familyId === 'steam-mainstream', 'R6 recovered FACT identity mismatch')
ok(weekly.baseMaterializationStatus === 'BLOCKED_SOURCE_GAP' && weekly.materializationStatus === 'RECOVERED_MATERIALIZED_FACT', 'R6 recovered FACT state mismatch')
ok(weekly.metric === 'officialSteamGlobalWeeklyTopSellerRank' && weekly.direction === 'ASC', 'R6 weekly metric mismatch')
ok(JSON.stringify(weekly.sourceSnapshotIds) === JSON.stringify([source.id]), 'R6 source binding mismatch')
ok(weekly.chartDefinition === 'TOP_100_PRODUCTS_BY_REVENUE_PUBLISHED_TUESDAY_1AM_PACIFIC_TIME', 'R6 chart definition mismatch')
ok(weekly.scopeBoundary === 'OFFICIAL_STEAM_GLOBAL_WEEKLY_TOP10_FOR_2026_08_11_WEEK_NOT_CURRENT_LIVE_CHART', 'R6 scope boundary mismatch')
ok(weekly.candidateBoundary === 'SOURCE_RANKED_FACT_ENTRIES_DO_NOT_MUTATE_THE_FROZEN_FAMILY_EDITORIAL_OR_VOTE_CANDIDATE_UNIVERSE', 'R6 candidate boundary mismatch')

const expectedEntries = [
  ['counter-strike-2', 'Counter-Strike 2', 1],
  ['apex-legends', 'Apex Legends™', 2],
  ['phantom-blade-zero', 'Phantom Blade Zero', 3],
  ['helldivers-2', 'HELLDIVERS™ 2', 4],
  ['dota-2', 'Dota 2', 5],
  ['hell-let-loose-vietnam', 'Hell Let Loose: Vietnam', 6],
  ['big-walk', 'Big Walk', 7],
  ['marvel-rivals', 'Marvel Rivals', 8],
  ['kingdom-hearts-hd-1-5-2-5-remix', 'KINGDOM HEARTS -HD 1.5+2.5 ReMIX-', 9],
  ['pubg-battlegrounds', 'PUBG: BATTLEGROUNDS', 10],
]
ok(weekly.entries?.length === 10, 'R6 must freeze exactly the official Global weekly top 10')
ok(JSON.stringify(weekly.entries.map((entry) => [entry.itemKey, entry.label, entry.value])) === JSON.stringify(expectedEntries), 'R6 Steam weekly top-10 evidence mismatch')
ok(new Set(weekly.entries.map((entry) => entry.itemKey)).size === 10, 'R6 weekly item keys must be unique')
ok(weekly.entries.every((entry, index) => entry.value === index + 1), 'R6 weekly ranks must be exact 1-10 source ranks')
ok(weekly.entries.filter((entry) => frozenCandidates.includes(entry.itemKey)).map((entry) => entry.itemKey).join(',') === 'counter-strike-2,dota-2,pubg-battlegrounds', 'R6 must preserve natural overlap without forcing the five-item editorial candidate pool')

const originalBlocked = wave1.families.flatMap((item) => item.rankings).filter((ranking) => ranking.kind === 'FACT' && ranking.materializationStatus === 'BLOCKED_SOURCE_GAP')
ok(originalBlocked.length === 4, 'Wave 1 original blocked FACT count mismatch')
const expectedRemainingIds = originalBlocked.map((row) => row.manifestId).filter((id) => id !== weekly.manifestId).sort()
const remaining = recovery.remainingBlockedFacts || []
ok(remaining.length === 3, 'R6 remaining Wave 1 blocked FACT count mismatch')
ok(JSON.stringify(remaining.map((row) => row.manifestId).sort()) === JSON.stringify(expectedRemainingIds), 'R6 remaining Wave 1 blocked FACT set mismatch')
for (const row of remaining) ok(row.blocker?.length >= 40 && !('entries' in row) && !('metric' in row), `${row.manifestId} blocked outcome must not fabricate data`)

const priorRecoveredIds = new Set([r1, r2, r3, r4, r5].flatMap((artifact) => (artifact.recoveredFacts || []).map((row) => row.manifestId)))
ok(!priorRecoveredIds.has(weekly.manifestId), 'R6 must not duplicate a prior recovered FACT')

const closure = recovery.closure || {}
ok(closure.wave1BlockedFactsOriginally === 4 && closure.recoveredFactCount === 1 && closure.wave1BlockedFactsAfterR6 === 3, 'R6 closure counts mismatch')
ok(closure.manifestCoverage === 200, 'manifest coverage must remain 200')
ok(closure.productionRowsWritten === 0 && closure.publicRowsPublished === 0 && closure.recommendationRuns === 0, 'write/publication/recommendation authority violated')
ok(closure.editorialWeightsAssigned === 0 && closure.fabricatedVoteRows === 0, 'editorial/vote fabrication boundary violated')

ok(!page.includes('blocked-evidence-r6.json'), 'public ranking page must not consume R6 evidence')
ok(pkg.scripts?.['verify:content-corpus-200-blocked-recovery-r6'] === 'node scripts/verify-content-corpus-200-blocked-recovery-r6.mjs', 'package verifier wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-blocked-recovery-r6'), 'CI verifier wiring missing')

const sha = jsonSha(recovery)
console.log('CONTENT-CORPUS-200 blocked evidence recovery R6 result:')
console.log(JSON.stringify({
  version: recovery.version,
  manifestSha256: recovery.manifestSha256,
  baseWave1EvidenceSha256: jsonSha(wave1),
  priorRecoveryR1EvidenceSha256: jsonSha(r1),
  priorRecoveryR2EvidenceSha256: jsonSha(r2),
  priorRecoveryR3EvidenceSha256: jsonSha(r3),
  priorRecoveryR4EvidenceSha256: jsonSha(r4),
  priorRecoveryR5EvidenceSha256: jsonSha(r5),
  evidenceSha256: sha,
  sourceSnapshotCount: sources.length,
  recoveredFacts: recovered.map((row) => row.manifestId),
  wave1BlockedFactsOriginally: closure.wave1BlockedFactsOriginally,
  wave1BlockedFactsAfterR6: closure.wave1BlockedFactsAfterR6,
  authority: recovery.authorityBoundary,
}, null, 2))

ok(EXPECTED !== 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION', `R6 evidence must be frozen after first structurally valid execution; observed sha256=${sha}`)
ok(sha === EXPECTED, `R6 evidence freeze mismatch: expected ${EXPECTED}, observed ${sha}`)
console.log(`CONTENT-CORPUS-200 blocked recovery R6 contracts: PASS (${sha.slice(0, 16)})`)
