import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const wavePath = path.join(root, 'content/corpus-200/materialization/wave-3.json')
const publicPagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')
const EXPECTED_MANIFEST_SHA256 = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const EXPECTED_EVIDENCE_SHA256 = 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION'

function fail(message) {
  console.error(`CONTENT-CORPUS-200 Wave 3 verification failed: ${message}`)
  process.exit(1)
}
function assert(condition, message) {
  if (!condition) fail(message)
}

assert(fs.existsSync(wavePath), 'Wave 3 evidence file must exist')
assert(fs.existsSync(publicPagePath), 'public ranking page must exist')
const wave = JSON.parse(fs.readFileSync(wavePath, 'utf8'))
const publicPage = fs.readFileSync(publicPagePath, 'utf8')

assert(wave.version === 'content-corpus-200-wave-3-v1', 'Wave 3 version must remain explicit')
assert(wave.manifestVersion === 'content-corpus-200-manifest-v1', 'Wave 3 must bind the frozen manifest version')
assert(wave.manifestSha256 === EXPECTED_MANIFEST_SHA256, 'Wave 3 must bind the exact frozen manifest SHA')
assert(wave.status === 'SOURCE_EVIDENCE_PARTIALLY_MATERIALIZED', 'Wave 3 must remain partial source evidence')
assert(wave.observedAt === '2026-08-25T13:30:48+09:00', 'Wave 3 observation time must remain frozen')
assert(wave.authorityBoundary && Object.values(wave.authorityBoundary).every((value) => value === false), 'all Wave 3 authority flags must remain false')

const sources = wave.sourceSnapshots || []
const sourceIds = new Set(sources.map((source) => source.id))
assert(sources.length === 21 && sourceIds.size === 21, 'Wave 3 must preserve exactly 21 unique source snapshots')
for (const source of sources) {
  assert(typeof source.id === 'string' && source.id.length >= 5, 'every source needs a stable ID')
  assert(typeof source.sourceKey === 'string' && source.sourceKey.length >= 3, `${source.id} must bind a sourceKey`)
  assert(typeof source.url === 'string' && source.url.startsWith('https://'), `${source.id} must use HTTPS`)
  assert(typeof source.referencePeriod === 'string' && source.referencePeriod.length >= 4, `${source.id} must freeze a reference period`)
  assert(typeof source.note === 'string' && source.note.length >= 20, `${source.id} must preserve evidence limits`)
}

const familySpec = [
  ['steam-coop-survival', 5, 2],
  ['laptops', 5, 2],
  ['fifa-national-teams', 5, 2],
  ['sunscreens', 4, 3],
  ['fast-food', 4, 3],
]
assert(JSON.stringify(wave.families?.map((family) => family.familyId)) === JSON.stringify(familySpec.map(([id]) => id)), 'Wave 3 family sequence must remain frozen')

for (const [familyId, editorialCount, voteCount] of familySpec) {
  const family = wave.families.find((row) => row.familyId === familyId)
  assert(family?.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', `${familyId} candidates must remain source-backed and frozen`)
  assert(Array.isArray(family.candidateUniverse.items) && family.candidateUniverse.items.length >= 5, `${familyId} needs at least five frozen candidates`)
  assert(new Set(family.candidateUniverse.items.map((item) => item.itemKey)).size === family.candidateUniverse.items.length, `${familyId} candidate keys must be unique`)
  for (const sourceId of family.candidateUniverse.sourceSnapshotIds || []) assert(sourceIds.has(sourceId), `${familyId} references unknown source ${sourceId}`)
  assert(family.rankings?.length === 10, `${familyId} must map exactly ten manifest rankings`)
  const expectedIds = Array.from({ length: 10 }, (_, index) => `cc200-${familyId}-${String(index + 1).padStart(2, '0')}`)
  assert(JSON.stringify(family.rankings.map((ranking) => ranking.manifestId)) === JSON.stringify(expectedIds), `${familyId} must preserve manifest ID sequence`)
  assert(family.rankings.slice(0, 3).every((ranking) => ranking.kind === 'FACT'), `${familyId} rows 01-03 must be FACT`)
  assert(family.rankings.slice(3, 3 + editorialCount).every((ranking) => ranking.kind === 'EDITORIAL_COMPOSITE'), `${familyId} editorial layout must remain frozen`)
  assert(family.rankings.slice(3 + editorialCount).every((ranking) => ranking.kind === 'COMMUNITY_VOTE'), `${familyId} vote layout must remain frozen`)
  assert(family.rankings.filter((ranking) => ranking.kind === 'COMMUNITY_VOTE').length === voteCount, `${familyId} vote count mismatch`)
}

const rankings = wave.families.flatMap((family) => family.rankings.map((ranking) => ({ familyId: family.familyId, ...ranking })))
const facts = rankings.filter((ranking) => ranking.kind === 'FACT')
const editorials = rankings.filter((ranking) => ranking.kind === 'EDITORIAL_COMPOSITE')
const votes = rankings.filter((ranking) => ranking.kind === 'COMMUNITY_VOTE')
const materialized = facts.filter((ranking) => ranking.materializationStatus === 'MATERIALIZED_FACT' || ranking.materializationStatus === 'MATERIALIZED_COMPARISON')
const blocked = facts.filter((ranking) => ranking.materializationStatus === 'BLOCKED_SOURCE_GAP')
assert(rankings.length === 50 && new Set(rankings.map((ranking) => ranking.manifestId)).size === 50, 'Wave 3 must map 50 unique rankings')
assert(facts.length === 15 && materialized.length === 9 && blocked.length === 6, 'Wave 3 FACT state must remain 15 / 9 materialized / 6 blocked')
assert(editorials.length === 23 && editorials.every((ranking) => ranking.materializationStatus === 'CANDIDATES_FROZEN_SCORING_UNASSIGNED'), 'Wave 3 editorial state must remain 23 frozen candidates')
assert(votes.length === 12 && votes.every((ranking) => ranking.materializationStatus === 'CANDIDATES_FROZEN_NO_VOTES'), 'Wave 3 vote state must remain 12 frozen no-vote rows')

const expectedBlocked = new Set([
  'cc200-steam-coop-survival-02',
  'cc200-steam-coop-survival-03',
  'cc200-laptops-02',
  'cc200-laptops-03',
  'cc200-fifa-national-teams-02',
  'cc200-sunscreens-01',
])
assert(blocked.length === expectedBlocked.size && blocked.every((ranking) => expectedBlocked.has(ranking.manifestId)), 'only reviewed Wave 3 FACT source gaps may remain blocked')

for (const ranking of materialized) {
  assert(Array.isArray(ranking.sourceSnapshotIds) && ranking.sourceSnapshotIds.length >= 1, `${ranking.manifestId} must cite sources`)
  for (const sourceId of ranking.sourceSnapshotIds) assert(sourceIds.has(sourceId), `${ranking.manifestId} references unknown source ${sourceId}`)
  assert(Array.isArray(ranking.entries) && ranking.entries.length >= 5, `${ranking.manifestId} must materialize at least five entries`)
  assert(typeof ranking.metric === 'string' && ranking.metric.length >= 3, `${ranking.manifestId} must name its metric`)
  if (ranking.materializationStatus === 'MATERIALIZED_FACT') {
    assert(['ASC', 'DESC'].includes(ranking.direction), `${ranking.manifestId} numeric FACT needs direction`)
    const values = ranking.entries.map((entry) => entry.value)
    assert(values.every(Number.isFinite), `${ranking.manifestId} values must be finite`)
    for (let i = 1; i < values.length; i += 1) {
      assert(ranking.direction === 'ASC' ? values[i - 1] <= values[i] : values[i - 1] >= values[i], `${ranking.manifestId} entries must preserve deterministic order`)
    }
  } else {
    assert(ranking.manifestId === 'cc200-sunscreens-03', 'only sunscreen declaration comparison may be categorical in Wave 3')
    assert(ranking.comparisonBoundary === 'DECLARATIONS_ONLY_NO_EFFICACY_ORDER_INFERRED', 'sunscreen comparison must preserve no-efficacy-inference boundary')
    assert(ranking.entries.every((entry) => entry.declared?.spf === 'SPF50+' && entry.declared?.pa === 'PA++++'), 'sunscreen declarations must remain exact')
  }
}
for (const ranking of blocked) {
  assert(typeof ranking.blocker === 'string' && ranking.blocker.length >= 30, `${ranking.manifestId} needs explicit blocker`)
  assert(!('entries' in ranking) && !('metric' in ranking), `${ranking.manifestId} blocked FACT must not fabricate an answer`)
}
for (const ranking of editorials) {
  assert(ranking.scoringStatus === 'UNASSIGNED_EVIDENCE_REVIEW_REQUIRED', `${ranking.manifestId} scoring must remain unassigned`)
  assert(ranking.candidateUniverseRef === ranking.familyId, `${ranking.manifestId} must bind its family candidate universe`)
  assert(!('entries' in ranking) && !('weights' in ranking) && !('score' in ranking), `${ranking.manifestId} must not encode editorial answers`)
}
for (const ranking of votes) {
  assert(ranking.voteCountStatus === 'NOT_STARTED_NO_FABRICATED_VOTES', `${ranking.manifestId} must remain no-vote`)
  assert(ranking.candidateUniverseRef === ranking.familyId, `${ranking.manifestId} must bind its family candidate universe`)
  assert(!('entries' in ranking) && !('voteCount' in ranking), `${ranking.manifestId} must not fabricate vote results`)
}

const byId = new Map(rankings.map((ranking) => [ranking.manifestId, ranking]))
assert(/PEAK_TODAY_NOT_ALL_TIME_PEAK/.test(byId.get('cc200-steam-coop-survival-03')?.blocker || ''), 'Steam all-time peak must remain blocked')
assert(byId.get('cc200-laptops-01')?.entries?.find((entry) => entry.itemKey === 'lg-gram-16-16z90t-touch')?.configuration === 'touchscreen', 'LG gram weight must stay bound to touchscreen configuration')
assert(/TEST_METHODS_ARE_NOT_COMPARABLE/.test(byId.get('cc200-laptops-03')?.blocker || ''), 'laptop battery-hours must remain blocked without comparable methods')
const fifaFamily = wave.families.find((family) => family.familyId === 'fifa-national-teams')
assert(fifaFamily?.candidateUniverse?.items?.length === 8 && /not all 48/i.test(fifaFamily.candidateUniverse.note || ''), 'FIFA candidate universe must remain explicit top-eight subset')
for (const entry of byId.get('cc200-fifa-national-teams-01')?.entries || []) assert(Math.abs(entry.value - entry.goals / entry.matches) < 1e-12, `FIFA ${entry.itemKey} goals/match must be deterministic`)
assert(/NO_SINGLE_COMPARABLE_CURRENT_KOREAN_RETAIL_PRICE_SNAPSHOT/.test(byId.get('cc200-sunscreens-01')?.blocker || ''), 'sunscreen price/ml must remain blocked')
const fastFood = wave.families.find((family) => family.familyId === 'fast-food')
assert(/not represented as the complete Korean fast-food market/i.test(fastFood?.candidateUniverse?.note || ''), 'fast-food candidate scope must remain explicit')
assert(fastFood.rankings.slice(0, 3).every((ranking) => ranking.materializationStatus === 'MATERIALIZED_FACT'), 'all three reviewed fast-food FACT rows must remain materialized')

const closure = wave.closure || {}
assert(closure.selectedRankingCount === 50 && closure.sourceSnapshotCount === 21, 'Wave 3 closure size mismatch')
assert(closure.factCount === 15 && closure.materializedFactCount === 9 && closure.blockedFactCount === 6, 'Wave 3 closure FACT mismatch')
assert(closure.editorialCount === 23 && closure.editorialCandidateFrozenCount === 23 && closure.editorialCandidateBlockedCount === 0, 'Wave 3 closure editorial mismatch')
assert(closure.voteCount === 12 && closure.voteCandidateFrozenCount === 12 && closure.voteCandidateBlockedCount === 0, 'Wave 3 closure vote mismatch')
assert(closure.fabricatedVoteRows === 0 && closure.editorialWeightsAssigned === 0 && closure.productionRowsWritten === 0 && closure.recommendationRuns === 0, 'Wave 3 authority/zero-write closure must remain intact')
assert(!publicPage.includes('wave-3.json'), 'public ranking page must not consume Wave 3 evidence')

const evidenceSha256 = crypto.createHash('sha256').update(JSON.stringify(wave)).digest('hex')
console.log('CONTENT-CORPUS-200 Wave 3 source materialization result:')
console.log(JSON.stringify({
  version: wave.version,
  manifestSha256: wave.manifestSha256,
  evidenceSha256,
  selectedRankingCount: rankings.length,
  sourceSnapshotCount: sources.length,
  fact: { total: facts.length, materialized: materialized.length, blocked: blocked.length },
  editorial: { total: editorials.length, candidateFrozen: editorials.length, candidateBlocked: 0, weightsAssigned: closure.editorialWeightsAssigned },
  vote: { total: votes.length, candidateFrozen: votes.length, candidateBlocked: 0, fabricatedRows: closure.fabricatedVoteRows },
  authority: {
    productionDatabaseWritesAuthorized: wave.authorityBoundary.productionDatabaseWritesAuthorized,
    publicPublicationAuthorized: wave.authorityBoundary.publicPublicationAuthorized,
    recommendationEvaluationAuthorized: wave.authorityBoundary.recommendationEvaluationAuthorized,
  },
}, null, 2))
assert(EXPECTED_EVIDENCE_SHA256 !== 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION', `Wave 3 evidence must be frozen after first structurally valid execution; observed sha256=${evidenceSha256}`)
assert(evidenceSha256 === EXPECTED_EVIDENCE_SHA256, `Wave 3 evidence freeze mismatch: expected ${EXPECTED_EVIDENCE_SHA256}, observed ${evidenceSha256}`)
console.log(`CONTENT-CORPUS-200 Wave 3 contracts: PASS (${evidenceSha256.slice(0, 16)})`)
