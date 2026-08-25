import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  recovery: p('content/corpus-200/recovery/blocked-evidence-r2.json'),
  priorRecovery: p('content/corpus-200/recovery/blocked-evidence-r1.json'),
  wave3: p('content/corpus-200/materialization/wave-3.json'),
  page: p('src/app/rankings/[rankingSlug]/page.tsx'),
  pkg: p('package.json'),
  ci: p('.github/workflows/ci.yml'),
}
const MANIFEST = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const WAVE3_SHA = 'f366862c0b6d9edd881245dbaba35572faa4e7bbde8b10c4af4ac5872634e756'
const R1_SHA = '6e5897ef79dc7280e7da1e2b87a2f663f49d383f27a7d65885c84fa09381c42c'
const EXPECTED = '6ded2c4dc33993e223ffac3ed777a232ec40aa9d5a7556b6c25d1f28653474cc'
const fail = (message) => { console.error(`CONTENT-CORPUS-200 blocked recovery R2 verification failed: ${message}`); process.exit(1) }
const ok = (value, message) => { if (!value) fail(message) }
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files)) ok(fs.existsSync(file), `${path.basename(file)} must exist`)
const recovery = read(files.recovery)
const r1 = read(files.priorRecovery)
const wave3 = read(files.wave3)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = read(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

const wave3Sha = jsonSha(wave3)
const r1Sha = jsonSha(r1)
ok(wave3Sha === WAVE3_SHA, `frozen Wave 3 evidence mutated: expected ${WAVE3_SHA}, observed ${wave3Sha}`)
ok(r1Sha === R1_SHA, `frozen recovery R1 evidence mutated: expected ${R1_SHA}, observed ${r1Sha}`)
ok(recovery.version === 'content-corpus-200-blocked-evidence-recovery-r2-v1', 'recovery version mismatch')
ok(recovery.manifestVersion === 'content-corpus-200-manifest-v1' && recovery.manifestSha256 === MANIFEST, 'manifest identity mismatch')
ok(recovery.status === 'BLOCKED_EVIDENCE_RECOVERY_PARTIALLY_MATERIALIZED', 'recovery status mismatch')
ok(recovery.observedAt === '2026-08-25T14:22:00+09:00', 'observation time mismatch')
ok(recovery.baseWave?.wave === 3 && recovery.baseWave?.evidenceSha256 === WAVE3_SHA && recovery.baseWave?.file === 'content/corpus-200/materialization/wave-3.json', 'base Wave 3 identity mismatch')
ok(recovery.priorRecovery?.version === r1.version && recovery.priorRecovery?.evidenceSha256 === R1_SHA && recovery.priorRecovery?.file === 'content/corpus-200/recovery/blocked-evidence-r1.json', 'prior recovery identity mismatch')
ok(Object.values(recovery.authorityBoundary || {}).every((value) => value === false), 'all authority flags must remain false')

const sources = recovery.sourceSnapshots || []
ok(sources.length === 3 && new Set(sources.map((source) => source.id)).size === 3, 'source snapshot count mismatch')
for (const source of sources) {
  ok(source.url?.startsWith('https://www.fifa.com/'), `${source.id} must use official FIFA domain`)
  ok(source.referencePeriod?.includes('2026') && source.note?.length >= 60, `${source.id} source contract invalid`)
}
ok(sources.some((source) => source.id === 'fifa-2026-complete-results-r2' && /shootout tallies/i.test(source.note)), 'complete results source must state shootout boundary')
ok(sources.some((source) => source.id === 'fifa-2026-final-standings-r2'), 'final standings source missing')
ok(sources.some((source) => source.id === 'fifa-2026-stat-hub-r2'), 'statistics hub source missing')

const family = wave3.families.find((item) => item.familyId === 'fifa-national-teams')
ok(family?.candidateUniverse?.scope === '2026 FIFA World Cup final top-eight teams only', 'frozen FIFA pool scope mismatch')
const baseFact = family.rankings.find((ranking) => ranking.manifestId === 'cc200-fifa-national-teams-02')
ok(baseFact?.materializationStatus === 'BLOCKED_SOURCE_GAP', 'base Wave 3 FIFA conceded FACT must remain immutable and blocked')
ok(baseFact?.blocker === 'COMPLETE_GOALS_CONCEDED_VALUES_NOT_RECOVERED_FROM_REVIEWED_OFFICIAL_SURFACE_FOR_THE_FROZEN_TOP_EIGHT_POOL', 'base Wave 3 FIFA blocker changed unexpectedly')

const recovered = recovery.recoveredFacts || []
ok(recovered.length === 1, 'R2 must recover exactly one FACT')
const conceded = recovered[0]
ok(conceded.manifestId === 'cc200-fifa-national-teams-02' && conceded.familyId === 'fifa-national-teams', 'recovered FACT identity mismatch')
ok(conceded.baseMaterializationStatus === 'BLOCKED_SOURCE_GAP' && conceded.materializationStatus === 'RECOVERED_MATERIALIZED_FACT', 'recovered FACT state mismatch')
ok(conceded.metric === 'goalsConcededPerMatchWithinFrozenFinalTopEightPool' && conceded.direction === 'ASC', 'recovered conceded metric mismatch')
ok(conceded.derivationBoundary === 'SUM_OPPONENT_MATCH_GOALS_FROM_OFFICIAL_COMPLETED_RESULTS_THEN_DIVIDE_BY_FROZEN_MATCH_COUNT', 'derivation boundary mismatch')
ok(conceded.penaltyShootoutGoalsExcluded === true, 'penalty shootout goals must remain excluded')
ok(conceded.tieBoundary === 'EQUAL_GOALS_CONCEDED_PER_MATCH_VALUES_DO_NOT_IMPLY_SECONDARY_ORDER', 'tie boundary mismatch')
ok(conceded.scopeBoundary === 'EXACT_WAVE3_FROZEN_2026_WORLD_CUP_FINAL_TOP_EIGHT_POOL_NOT_ALL_48_TEAMS', 'scope boundary mismatch')
ok(new Set(conceded.sourceSnapshotIds || []).size === 3 && conceded.sourceSnapshotIds.every((id) => sources.some((source) => source.id === id)), 'recovered FACT source binding mismatch')

const expected = [
  ['spain', 1, 8, 0.125, [0,0,0,0,0,1,0,0]],
  ['argentina', 8, 8, 1, [0,0,1,2,2,1,1,1]],
  ['morocco', 6, 6, 1, [1,0,2,1,0,2]],
  ['switzerland', 6, 6, 1, [1,1,1,0,0,3]],
  ['belgium', 7, 6, 7/6, [1,0,1,2,1,2]],
  ['france', 10, 8, 1.25, [1,0,1,0,0,0,2,6]],
  ['england', 12, 8, 1.5, [2,0,0,1,2,1,2,4]],
  ['norway', 11, 6, 11/6, [1,2,4,1,1,2]],
]
ok(conceded.entries?.length === expected.length, 'recovered FIFA entry count mismatch')
for (let index = 0; index < expected.length; index += 1) {
  const entry = conceded.entries[index]
  const [itemKey, goals, matches, value, byMatch] = expected[index]
  ok(entry.itemKey === itemKey && entry.goalsConceded === goals && entry.matches === matches, `${itemKey} identity/totals mismatch`)
  ok(JSON.stringify(entry.goalsConcededByMatch) === JSON.stringify(byMatch), `${itemKey} match-by-match conceded evidence mismatch`)
  ok(entry.goalsConcededByMatch.length === matches && entry.goalsConcededByMatch.reduce((sum, current) => sum + current, 0) === goals, `${itemKey} conceded derivation sum mismatch`)
  ok(Math.abs(entry.value - value) < 1e-12 && Math.abs(entry.value - goals / matches) < 1e-12, `${itemKey} per-match derivation mismatch`)
  if (index > 0) ok(conceded.entries[index - 1].value <= entry.value, 'recovered FIFA entries must be non-decreasing')
}
const frozenCandidates = family.candidateUniverse.items.map((item) => item.itemKey).sort()
ok(JSON.stringify(conceded.entries.map((entry) => entry.itemKey).sort()) === JSON.stringify(frozenCandidates), 'recovered FACT must cover exactly the frozen final-top-eight candidate universe')
ok(conceded.entries.filter((entry) => entry.value === 1).length === 3, 'expected three-way 1.0 tie missing')

const baseBlocked = wave3.families.flatMap((item) => item.rankings).filter((ranking) => ranking.kind === 'FACT' && ranking.materializationStatus === 'BLOCKED_SOURCE_GAP')
ok(baseBlocked.length === 6, 'Wave 3 frozen blocked FACT count mismatch')
const expectedRemainingIds = baseBlocked.map((ranking) => ranking.manifestId).filter((id) => id !== conceded.manifestId).sort()
const remaining = recovery.remainingBlockedFacts || []
ok(remaining.length === 5, 'R2 remaining blocked FACT count mismatch')
ok(JSON.stringify(remaining.map((row) => row.manifestId).sort()) === JSON.stringify(expectedRemainingIds), 'R2 remaining blocked FACT set mismatch')
for (const row of remaining) ok(row.blocker?.length >= 40 && !('entries' in row) && !('metric' in row), `${row.manifestId} blocked outcome must not contain fabricated data`)

const priorRecoveredIds = new Set((r1.recoveredFacts || []).map((row) => row.manifestId))
ok(!priorRecoveredIds.has(conceded.manifestId), 'R2 must not duplicate a prior recovered FACT')
const closure = recovery.closure || {}
ok(closure.baseWaveBlockedFactsBeforeRecovery === 6 && closure.recoveredFactCount === 1 && closure.baseWaveBlockedFactsAfterRecovery === 5, 'R2 closure counts mismatch')
ok(closure.manifestCoverage === 200, 'manifest coverage must remain 200')
ok(closure.productionRowsWritten === 0 && closure.publicRowsPublished === 0 && closure.recommendationRuns === 0, 'write/publication/recommendation authority boundary violated')
ok(closure.editorialWeightsAssigned === 0 && closure.fabricatedVoteRows === 0, 'editorial/vote fabrication boundary violated')

ok(!page.includes('blocked-evidence-r2.json'), 'public ranking page must not consume R2 recovery evidence')
ok(pkg.scripts?.['verify:content-corpus-200-blocked-recovery-r2'] === 'node scripts/verify-content-corpus-200-blocked-recovery-r2.mjs', 'package verifier wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-blocked-recovery-r2'), 'CI verifier wiring missing')

const sha = jsonSha(recovery)
console.log('CONTENT-CORPUS-200 blocked evidence recovery R2 result:')
console.log(JSON.stringify({
  version: recovery.version,
  manifestSha256: recovery.manifestSha256,
  baseWave3EvidenceSha256: wave3Sha,
  priorRecoveryR1EvidenceSha256: r1Sha,
  evidenceSha256: sha,
  sourceSnapshotCount: sources.length,
  recoveredFacts: recovered.map((row) => row.manifestId),
  baseWaveBlockedFactsBeforeRecovery: closure.baseWaveBlockedFactsBeforeRecovery,
  baseWaveBlockedFactsAfterRecovery: closure.baseWaveBlockedFactsAfterRecovery,
  authority: recovery.authorityBoundary,
}, null, 2))
ok(EXPECTED !== 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION', `R2 evidence must be frozen after first structurally valid execution; observed sha256=${sha}`)
ok(sha === EXPECTED, `R2 evidence freeze mismatch: expected ${EXPECTED}, observed ${sha}`)
console.log(`CONTENT-CORPUS-200 blocked recovery R2 contracts: PASS (${sha.slice(0, 16)})`)
