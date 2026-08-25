import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  recovery: p('content/corpus-200/recovery/blocked-evidence-r7.json'),
  r1: p('content/corpus-200/recovery/blocked-evidence-r1.json'),
  r2: p('content/corpus-200/recovery/blocked-evidence-r2.json'),
  r3: p('content/corpus-200/recovery/blocked-evidence-r3.json'),
  r4: p('content/corpus-200/recovery/blocked-evidence-r4.json'),
  r5: p('content/corpus-200/recovery/blocked-evidence-r5.json'),
  r6: p('content/corpus-200/recovery/blocked-evidence-r6.json'),
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
const R6_SHA = 'f2053d7fe208cc6bf658ddebd9c21a2ed3778ed84e90c73f2e94f43f3eeeab36'
const EXPECTED = 'c84557fe19b4371c2ab2fcc093197ecb111f588b1693fea1b767f4fc0930d334'

const fail = (message) => { console.error(`CONTENT-CORPUS-200 blocked recovery R7 verification failed: ${message}`); process.exit(1) }
const ok = (value, message) => { if (!value) fail(message) }
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
const sorted = (values) => [...values].sort()
const sameSet = (left, right) => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right))

for (const file of Object.values(files)) ok(fs.existsSync(file), `${path.basename(file)} must exist`)

const recovery = read(files.recovery)
const r1 = read(files.r1)
const r2 = read(files.r2)
const r3 = read(files.r3)
const r4 = read(files.r4)
const r5 = read(files.r5)
const r6 = read(files.r6)
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
ok(jsonSha(r6) === R6_SHA, 'frozen Recovery R6 evidence mutated')

ok(recovery.version === 'content-corpus-200-blocked-evidence-recovery-r7-v1', 'recovery version mismatch')
ok(recovery.manifestVersion === 'content-corpus-200-manifest-v1' && recovery.manifestSha256 === MANIFEST, 'manifest identity mismatch')
ok(recovery.status === 'BLOCKED_EVIDENCE_RECOVERY_PARTIALLY_MATERIALIZED', 'recovery status mismatch')
ok(recovery.observedAt === '2026-08-25T16:30:00+09:00', 'observation time mismatch')
ok(recovery.baseWave?.wave === 1 && recovery.baseWave?.evidenceSha256 === WAVE1_SHA, 'base Wave 1 identity mismatch')
ok(JSON.stringify(recovery.priorRecoveries?.map((row) => row.evidenceSha256)) === JSON.stringify([R1_SHA, R2_SHA, R3_SHA, R4_SHA, R5_SHA, R6_SHA]), 'prior recovery identity mismatch')
ok(Object.values(recovery.authorityBoundary || {}).every((value) => value === false), 'all authority flags must remain false')

const sources = recovery.sourceSnapshots || []
ok(sources.length === 5, 'R7 must freeze exactly five official Netflix ranking/history source snapshots')
const sourceById = new Map(sources.map((row) => [row.id, row]))
const expectedSources = {
  'netflix-kr-film-2026-07-27-r7': ['https://www.netflix.com/tudum/top10/south-korea', '2026-07-27/2026-08-02'],
  'netflix-kr-tv-2026-07-27-r7': ['https://www.netflix.com/tudum/top10/south-korea/tv', '2026-07-27/2026-08-02'],
  'netflix-all-weeks-global-through-2026-08-02-r7': ['https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv', 'all-published-global-weeks-through-2026-08-02-reviewed-2026-08-25'],
  'netflix-global-film-non-english-2026-08-02-r7': ['https://www.netflix.com/tudum/top10/films-non-english', '2026-07-27/2026-08-02'],
  'netflix-global-tv-non-english-2026-08-02-r7': ['https://www.netflix.com/tudum/top10/tv-non-english', '2026-07-27/2026-08-02'],
}
for (const [id, [url, period]] of Object.entries(expectedSources)) {
  const source = sourceById.get(id)
  ok(source?.sourceKey === 'netflix-top10', `${id} source key mismatch`)
  ok(source?.url === url, `${id} URL mismatch`)
  ok(source?.referencePeriod === period, `${id} reference period mismatch`)
}
ok(/only rows with week on or before 2026-08-02/i.test(sourceById.get('netflix-all-weeks-global-through-2026-08-02-r7')?.note || ''), 'global TSV note must freeze the cutoff')
ok(/cumulative_weeks_in_top_10/.test(sourceById.get('netflix-all-weeks-global-through-2026-08-02-r7')?.note || ''), 'global TSV note must preserve the source metric field')

const family = wave1.families.find((item) => item.familyId === 'netflix-titles')
ok(family?.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', 'frozen netflix-titles candidate universe missing')
const frozenCandidates = family.candidateUniverse.items.map((item) => item.itemKey)
const expectedFrozenCandidates = [
  'demon-slayer-infinity-castle-i',
  'wild-sing',
  'the-debt-collector',
  'spider-man-homecoming',
  'hindsight',
  'the-beekeeper',
  'spider-man-far-from-home',
  'elize-shadows-of-a-woman',
  'roofman',
  'husbands-in-action',
  'the-east-palace',
  'agent-kim-reactivated',
  'spooky-in-love',
  'the-apartment-job',
  'better-late-than-single-after-service',
  'better-late-than-single-season-2',
  'agent-kim-reactivated-universe',
  'teach-you-a-lesson',
  'the-psychopath-i-met',
  'smoking-behind-the-supermarket-with-you',
]
ok(frozenCandidates.length === 20 && JSON.stringify(frozenCandidates) === JSON.stringify(expectedFrozenCandidates), 'frozen Netflix candidate universe mutated')
ok(JSON.stringify(family.candidateUniverse.sourceSnapshotIds) === JSON.stringify(['netflix-kr-film-2026-07-27', 'netflix-kr-tv-2026-07-27']), 'base Netflix candidate source binding mutated')

const baseFact = family.rankings.find((ranking) => ranking.manifestId === 'cc200-netflix-titles-03')
ok(baseFact?.kind === 'FACT' && baseFact.materializationStatus === 'BLOCKED_SOURCE_GAP', 'base Netflix global-history FACT must remain immutable and blocked')
ok(baseFact?.blocker === 'NO_FROZEN_TITLE_LEVEL_GLOBAL_TOP10_HISTORY_SET_FOR_COMPARABLE_KOREAN_TITLES_YET', 'base Netflix blocker changed unexpectedly')
ok(JSON.stringify(baseFact.sourceSnapshotIds) === JSON.stringify(['netflix-kr-film-2026-07-27', 'netflix-kr-tv-2026-07-27']), 'base Netflix FACT source binding changed unexpectedly')

const koreanEvidence = recovery.koreanTitleEvidence || []
const expectedKorean = [
  ['wild-sing', 'https://www.netflix.com/title/82821393'],
  ['hindsight', 'https://www.netflix.com/kr-en/title/70233305'],
  ['husbands-in-action', 'https://www.netflix.com/kr-en/title/82025112'],
  ['the-east-palace', 'https://www.netflix.com/kr-en/title/81778702'],
  ['agent-kim-reactivated', 'https://www.netflix.com/title/82682338'],
  ['spooky-in-love', 'https://www.netflix.com/title/82682401'],
  ['the-apartment-job', 'https://www.netflix.com/title/82755552'],
  ['better-late-than-single-after-service', 'https://www.netflix.com/kr-en/title/82991973'],
  ['better-late-than-single-season-2', 'https://www.netflix.com/kr-en/title/81788026'],
  ['agent-kim-reactivated-universe', 'https://www.netflix.com/kr-en/title/83103066'],
  ['teach-you-a-lesson', 'https://www.netflix.com/kr-en/title/81947300'],
  ['the-psychopath-i-met', 'https://www.netflix.com/kr-en/title/82979139'],
]
ok(koreanEvidence.length === 12, 'R7 must audit exactly twelve Korean frozen candidates')
ok(JSON.stringify(koreanEvidence.map((row) => [row.itemKey, row.officialNetflixTitleUrl])) === JSON.stringify(expectedKorean), 'R7 Korean-title evidence mismatch')
ok(koreanEvidence.every((row) => row.isKorean === true && frozenCandidates.includes(row.itemKey)), 'all Korean-title evidence must be explicit and inside frozen candidate universe')
const koreanKeys = koreanEvidence.map((row) => row.itemKey)

const audit = recovery.eligibilityAudit || []
ok(audit.length === 12 && sameSet(audit.map((row) => row.itemKey), koreanKeys), 'eligibility audit must cover all and only Korean frozen candidates')
const confirmed = audit.filter((row) => row.status === 'GLOBAL_TOP10_ENTRY_CONFIRMED')
const nonEntrants = audit.filter((row) => row.status === 'NO_GLOBAL_TOP10_ROW_THROUGH_CUTOFF')
ok(confirmed.length === 8 && nonEntrants.length === 4, 'R7 confirmed/non-entrant audit counts mismatch')
ok(nonEntrants.every((row) => !('cumulativeWeeksInTop10' in row) && !('value' in row) && !('category' in row) && !('lastGlobalWeekAtCutoff' in row)), 'non-entrants must not be assigned synthetic zero/metric values')
const expectedNoRows = ['hindsight', 'better-late-than-single-after-service', 'agent-kim-reactivated-universe', 'the-psychopath-i-met']
ok(sameSet(nonEntrants.map((row) => row.itemKey), expectedNoRows), 'R7 no-global-row audit set mismatch')

const expectedConfirmed = [
  ['teach-you-a-lesson', 'TV (Non-English)', '2026-08-02', 9],
  ['agent-kim-reactivated', 'TV (Non-English)', '2026-08-02', 6],
  ['the-apartment-job', 'TV (Non-English)', '2026-08-02', 4],
  ['husbands-in-action', 'Films (Non-English)', '2026-07-12', 4],
  ['spooky-in-love', 'TV (Non-English)', '2026-08-02', 3],
  ['the-east-palace', 'TV (Non-English)', '2026-08-02', 3],
  ['better-late-than-single-season-2', 'TV (Non-English)', '2026-07-12', 1],
  ['wild-sing', 'Films (Non-English)', '2026-08-02', 1],
]
ok(JSON.stringify(confirmed.map((row) => [row.itemKey, row.category, row.lastGlobalWeekAtCutoff, row.cumulativeWeeksInTop10])) === JSON.stringify(expectedConfirmed), 'R7 confirmed global-history audit mismatch')

const recovered = recovery.recoveredFacts || []
ok(recovered.length === 1, 'R7 must recover exactly one FACT')
const fact = recovered[0]
ok(fact.manifestId === 'cc200-netflix-titles-03' && fact.familyId === 'netflix-titles', 'R7 recovered FACT identity mismatch')
ok(fact.baseMaterializationStatus === 'BLOCKED_SOURCE_GAP' && fact.materializationStatus === 'RECOVERED_MATERIALIZED_FACT', 'R7 recovered FACT state mismatch')
ok(fact.metric === 'officialNetflixCumulativeWeeksInGlobalTop10AtCutoff' && fact.direction === 'DESC', 'R7 metric mismatch')
ok(fact.cutoffWeek === '2026-08-02', 'R7 cutoff mismatch')
ok(fact.eligibilityBoundary === 'KOREAN_TITLES_IN_FROZEN_KR_2026_07_27_TO_2026_08_02_CANDIDATE_UNIVERSE_WITH_AT_LEAST_ONE_OFFICIAL_GLOBAL_TOP10_ROW_ON_OR_BEFORE_2026_08_02', 'R7 eligibility boundary mismatch')
ok(fact.nonEntrantBoundary === 'KOREAN_FROZEN_CANDIDATES_WITH_NO_GLOBAL_ROW_THROUGH_CUTOFF_ARE_AUDITED_BUT_NOT_ASSIGNED_ZERO_AND_NOT_RANKED', 'R7 non-entrant boundary mismatch')
ok(fact.tiePolicy === 'NO_SECONDARY_ORDER_WITHIN_EQUAL_CUMULATIVE_WEEKS', 'R7 tie policy mismatch')
ok(JSON.stringify(fact.sourceSnapshotIds) === JSON.stringify(Object.keys(expectedSources)), 'R7 source bindings mismatch')

const expectedEntries = [
  ['teach-you-a-lesson', 'Teach You a Lesson: Limited Series', 9, '2026-08-02'],
  ['agent-kim-reactivated', 'Agent Kim Reactivated: Limited Series', 6, '2026-08-02'],
  ['the-apartment-job', 'The Apartment Job: Limited Series', 4, '2026-08-02'],
  ['husbands-in-action', 'Husbands in Action', 4, '2026-07-12'],
  ['spooky-in-love', 'Spooky in Love: Limited Series', 3, '2026-08-02'],
  ['the-east-palace', 'The East Palace: Limited Series', 3, '2026-08-02'],
  ['better-late-than-single-season-2', 'Better Late Than Single: Season 2', 1, '2026-07-12'],
  ['wild-sing', 'Wild Sing', 1, '2026-08-02'],
]
ok(fact.entries?.length === 8, 'R7 must rank exactly eight confirmed Korean global entrants')
ok(JSON.stringify(fact.entries.map((row) => [row.itemKey, row.label, row.value, row.lastGlobalWeekAtCutoff])) === JSON.stringify(expectedEntries), 'R7 ranking entries mismatch')
ok(fact.entries.every((row) => frozenCandidates.includes(row.itemKey) && koreanKeys.includes(row.itemKey) && !expectedNoRows.includes(row.itemKey)), 'R7 entries must remain inside frozen Korean entrant scope')
ok(fact.entries.every((row) => Number.isInteger(row.value) && row.value > 0), 'R7 entry values must be positive published cumulative weeks')

const entryByValue = new Map()
for (const row of fact.entries) entryByValue.set(row.value, [...(entryByValue.get(row.value) || []), row.itemKey])
ok(sameSet(entryByValue.get(4) || [], ['the-apartment-job', 'husbands-in-action']), '4-week tie group mismatch')
ok(sameSet(entryByValue.get(3) || [], ['spooky-in-love', 'the-east-palace']), '3-week tie group mismatch')
ok(sameSet(entryByValue.get(1) || [], ['better-late-than-single-season-2', 'wild-sing']), '1-week tie group mismatch')

const originalBlocked = wave1.families.flatMap((item) => item.rankings).filter((ranking) => ranking.kind === 'FACT' && ranking.materializationStatus === 'BLOCKED_SOURCE_GAP')
ok(originalBlocked.length === 4, 'Wave 1 original blocked FACT count mismatch')
const priorRecoveredIds = new Set([r1, r2, r3, r4, r5, r6].flatMap((artifact) => (artifact.recoveredFacts || []).map((row) => row.manifestId)))
ok(priorRecoveredIds.has('cc200-steam-mainstream-02'), 'R6 Wave 1 recovery identity missing')
ok(!priorRecoveredIds.has(fact.manifestId), 'R7 must not duplicate a prior recovered FACT')
const expectedRemainingIds = originalBlocked.map((row) => row.manifestId).filter((id) => id !== 'cc200-steam-mainstream-02' && id !== fact.manifestId).sort()
const remaining = recovery.remainingBlockedFacts || []
ok(remaining.length === 2 && JSON.stringify(remaining.map((row) => row.manifestId).sort()) === JSON.stringify(expectedRemainingIds), 'R7 remaining Wave 1 blocker set mismatch')
for (const row of remaining) ok(row.blocker?.length >= 40 && !('entries' in row) && !('metric' in row), `${row.manifestId} blocked outcome must not fabricate data`)

const closure = recovery.closure || {}
ok(closure.wave1BlockedFactsOriginally === 4 && closure.wave1RecoveredThroughR7 === 2 && closure.wave1BlockedFactsAfterR7 === 2, 'R7 Wave 1 closure counts mismatch')
ok(closure.koreanFrozenCandidateCount === 12 && closure.globalEntrantCount === 8 && closure.globalNonEntrantCount === 4, 'R7 Netflix eligibility closure counts mismatch')
ok(closure.manifestCoverage === 200, 'manifest coverage must remain 200')
ok(closure.productionRowsWritten === 0 && closure.publicRowsPublished === 0 && closure.recommendationRuns === 0, 'write/publication/recommendation authority violated')
ok(closure.editorialWeightsAssigned === 0 && closure.fabricatedVoteRows === 0, 'editorial/vote fabrication boundary violated')

ok(!page.includes('blocked-evidence-r7.json'), 'public ranking page must not consume R7 evidence')
ok(pkg.scripts?.['verify:content-corpus-200-blocked-recovery-r7'] === 'node scripts/verify-content-corpus-200-blocked-recovery-r7.mjs', 'package verifier wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-blocked-recovery-r7'), 'CI verifier wiring missing')

const sha = jsonSha(recovery)
console.log('CONTENT-CORPUS-200 blocked evidence recovery R7 result:')
console.log(JSON.stringify({
  version: recovery.version,
  manifestSha256: recovery.manifestSha256,
  baseWave1EvidenceSha256: jsonSha(wave1),
  priorRecoveryR1EvidenceSha256: jsonSha(r1),
  priorRecoveryR2EvidenceSha256: jsonSha(r2),
  priorRecoveryR3EvidenceSha256: jsonSha(r3),
  priorRecoveryR4EvidenceSha256: jsonSha(r4),
  priorRecoveryR5EvidenceSha256: jsonSha(r5),
  priorRecoveryR6EvidenceSha256: jsonSha(r6),
  evidenceSha256: sha,
  sourceSnapshotCount: sources.length,
  koreanFrozenCandidateCount: koreanEvidence.length,
  globalEntrantCount: fact.entries.length,
  globalNonEntrantCount: nonEntrants.length,
  recoveredFacts: recovered.map((row) => row.manifestId),
  wave1BlockedFactsOriginally: closure.wave1BlockedFactsOriginally,
  wave1BlockedFactsAfterR7: closure.wave1BlockedFactsAfterR7,
  authority: recovery.authorityBoundary,
}, null, 2))

ok(EXPECTED !== 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION', `R7 evidence must be frozen after first structurally valid execution; observed sha256=${sha}`)
ok(sha === EXPECTED, `R7 evidence freeze mismatch: expected ${EXPECTED}, observed ${sha}`)
console.log(`CONTENT-CORPUS-200 blocked recovery R7 contracts: PASS (${sha.slice(0, 16)})`)
