import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const wavePath = path.join(root, 'content/corpus-200/materialization/wave-1.json')
const publicPagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')
const EXPECTED_MANIFEST_SHA256 = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const EXPECTED_WAVE_SHA256 = 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION'

function fail(message) {
  console.error(`CONTENT-CORPUS-200 Wave 1 verification failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

assert(fs.existsSync(wavePath), 'wave-1.json must exist')
assert(fs.existsSync(publicPagePath), 'public ranking page must exist')

const raw = fs.readFileSync(wavePath, 'utf8')
const wave = JSON.parse(raw)
const publicPage = fs.readFileSync(publicPagePath, 'utf8')

assert(wave.version === 'content-corpus-200-wave-1-v1', 'wave version must be explicit')
assert(wave.manifestVersion === 'content-corpus-200-manifest-v1', 'manifest version must match the frozen authoring manifest')
assert(wave.manifestSha256 === EXPECTED_MANIFEST_SHA256, 'materialization must point to the exact frozen 200-manifest SHA')
assert(wave.status === 'SOURCE_EVIDENCE_PARTIALLY_MATERIALIZED', 'wave must remain a partial source-evidence materialization')
assert(/^2026-08-25T12:44:00\+09:00$/.test(wave.observedAt), 'Wave 1 observedAt must remain the frozen evidence observation time')

for (const [key, value] of Object.entries(wave.authorityBoundary || {})) {
  assert(value === false, `authority boundary ${key} must remain false`)
}
assert(wave.authorityBoundary.productionDatabaseWritesAuthorized === false, 'production DB writes must not be authorized')
assert(wave.authorityBoundary.publicPublicationAuthorized === false, 'public publication must not be authorized')
assert(wave.authorityBoundary.recommendationEvaluationAuthorized === false, 'recommendation evaluation must not be authorized')
assert(wave.authorityBoundary.taxonomyMutationAuthorized === false, 'taxonomy mutation must not be authorized')
assert(wave.authorityBoundary.editorialScoringAuthorized === false, 'editorial scoring must not be authorized')

const sourceSnapshots = wave.sourceSnapshots || []
assert(sourceSnapshots.length >= 10, 'Wave 1 must preserve explicit source snapshot provenance')
const sourceById = new Map(sourceSnapshots.map((source) => [source.id, source]))
assert(sourceById.size === sourceSnapshots.length, 'source snapshot IDs must be unique')
for (const source of sourceSnapshots) {
  assert(typeof source.id === 'string' && source.id.length >= 5, 'every source snapshot needs a stable ID')
  assert(typeof source.sourceKey === 'string' && source.sourceKey.length >= 3, `${source.id} must declare a sourceKey`)
  assert(typeof source.url === 'string' && source.url.startsWith('https://'), `${source.id} must use an explicit HTTPS source URL`)
  assert(typeof source.referencePeriod === 'string' && source.referencePeriod.length >= 4, `${source.id} must freeze a reference period`)
  assert(typeof source.note === 'string' && source.note.length >= 20, `${source.id} must explain evidence limits`)
}

const expectedFamilies = new Set(['steam-mainstream', 'korean-box-office', 'netflix-titles', 'smartphones', 'kbo-clubs'])
assert(wave.families?.length === 5, `Wave 1 must contain exactly five families; observed ${wave.families?.length}`)
assert(new Set(wave.families.map((family) => family.familyId)).size === 5, 'family IDs must be unique')
for (const family of wave.families) {
  assert(expectedFamilies.has(family.familyId), `unexpected Wave 1 family ${family.familyId}`)
  assert(family.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', `${family.familyId} candidate universe must be source-backed and frozen`)
  assert(Array.isArray(family.candidateUniverse.sourceSnapshotIds) && family.candidateUniverse.sourceSnapshotIds.length >= 1, `${family.familyId} must cite candidate-universe sources`)
  assert(Array.isArray(family.candidateUniverse.items) && family.candidateUniverse.items.length >= 5, `${family.familyId} must have a non-trivial candidate universe`)
  assert(new Set(family.candidateUniverse.items.map((item) => item.itemKey)).size === family.candidateUniverse.items.length, `${family.familyId} candidate item keys must be unique`)
  for (const sourceId of family.candidateUniverse.sourceSnapshotIds) {
    assert(sourceById.has(sourceId), `${family.familyId} references unknown candidate source ${sourceId}`)
  }
  assert(family.rankings?.length === 10, `${family.familyId} must map exactly ten frozen manifest rankings`)
}

const rankings = wave.families.flatMap((family) => family.rankings.map((ranking) => ({ familyId: family.familyId, ...ranking })))
assert(rankings.length === 50, `Wave 1 must map exactly 50 rankings; observed ${rankings.length}`)
assert(new Set(rankings.map((ranking) => ranking.manifestId)).size === 50, 'Wave 1 manifest IDs must be unique')

for (const familyId of expectedFamilies) {
  const familyRows = rankings.filter((ranking) => ranking.familyId === familyId)
  const expectedIds = Array.from({ length: 10 }, (_, index) => `cc200-${familyId}-${String(index + 1).padStart(2, '0')}`)
  assert(JSON.stringify(familyRows.map((ranking) => ranking.manifestId)) === JSON.stringify(expectedIds), `${familyId} must preserve exact frozen manifest ID sequence`)
  assert(familyRows.slice(0, 3).every((ranking) => ranking.kind === 'FACT'), `${familyId} rows 01-03 must remain FACT`)
  assert(familyRows.slice(3, 8).every((ranking) => ranking.kind === 'EDITORIAL_COMPOSITE'), `${familyId} rows 04-08 must remain EDITORIAL_COMPOSITE`)
  assert(familyRows.slice(8, 10).every((ranking) => ranking.kind === 'COMMUNITY_VOTE'), `${familyId} rows 09-10 must remain COMMUNITY_VOTE`)
}

const facts = rankings.filter((ranking) => ranking.kind === 'FACT')
const editorials = rankings.filter((ranking) => ranking.kind === 'EDITORIAL_COMPOSITE')
const votes = rankings.filter((ranking) => ranking.kind === 'COMMUNITY_VOTE')
const materializedFacts = facts.filter((ranking) => ranking.materializationStatus === 'MATERIALIZED_FACT')
const blockedFacts = facts.filter((ranking) => ranking.materializationStatus === 'BLOCKED_SOURCE_GAP')

assert(facts.length === 15, 'Wave 1 must contain exactly 15 FACT rankings')
assert(materializedFacts.length === 11, `Wave 1 must contain exactly 11 source-materialized FACT rankings; observed ${materializedFacts.length}`)
assert(blockedFacts.length === 4, `Wave 1 must contain exactly four explicitly blocked FACT rankings; observed ${blockedFacts.length}`)
assert(editorials.length === 25, 'Wave 1 must contain exactly 25 editorial rankings')
assert(votes.length === 10, 'Wave 1 must contain exactly 10 vote rankings')

for (const fact of materializedFacts) {
  assert(Array.isArray(fact.sourceSnapshotIds) && fact.sourceSnapshotIds.length >= 1, `${fact.manifestId} must cite a source snapshot`)
  for (const sourceId of fact.sourceSnapshotIds) {
    assert(sourceById.has(sourceId), `${fact.manifestId} references unknown source ${sourceId}`)
  }
  assert(Array.isArray(fact.entries) && fact.entries.length >= 5, `${fact.manifestId} must contain at least five source-backed entries`)
  assert(typeof fact.metric === 'string' && fact.metric.length >= 3, `${fact.manifestId} must name its metric`)
  assert(fact.direction === 'ASC' || fact.direction === 'DESC', `${fact.manifestId} must declare deterministic sort direction`)
  assert(!('blocker' in fact), `${fact.manifestId} cannot be both materialized and blocked`)

  for (const entry of fact.entries) {
    assert(typeof entry.itemKey === 'string' && entry.itemKey.length >= 2, `${fact.manifestId} entries need item keys`)
    assert(typeof entry.label === 'string' && entry.label.length >= 1, `${fact.manifestId} entries need labels`)
    if ('value' in entry) {
      assert(Number.isFinite(entry.value), `${fact.manifestId}/${entry.itemKey} value must be finite`)
    } else {
      assert(fact.derivation === 'admissions / screens', `${fact.manifestId}/${entry.itemKey} input-only fact must declare the reviewed derivation`)
      assert(Number.isFinite(entry.inputs?.admissions) && entry.inputs.admissions > 0, `${fact.manifestId}/${entry.itemKey} admissions must be positive`)
      assert(Number.isFinite(entry.inputs?.screens) && entry.inputs.screens > 0, `${fact.manifestId}/${entry.itemKey} screens must be positive`)
      const derived = entry.inputs.admissions / entry.inputs.screens
      assert(Number.isFinite(derived) && derived > 0, `${fact.manifestId}/${entry.itemKey} derived value must be finite and positive`)
    }
  }
}

for (const fact of blockedFacts) {
  assert(typeof fact.blocker === 'string' && fact.blocker.length >= 20, `${fact.manifestId} must preserve an explicit blocker`)
  assert(!('entries' in fact), `${fact.manifestId} blocked FACT must not fabricate entries`)
  assert(!('metric' in fact), `${fact.manifestId} blocked FACT must not pretend its metric is materialized`)
  for (const sourceId of fact.sourceSnapshotIds || []) {
    assert(sourceById.has(sourceId), `${fact.manifestId} blocker references unknown source ${sourceId}`)
  }
}

const expectedBlockedIds = new Set([
  'cc200-steam-mainstream-02',
  'cc200-steam-mainstream-03',
  'cc200-netflix-titles-03',
  'cc200-kbo-clubs-03',
])
assert(blockedFacts.every((fact) => expectedBlockedIds.has(fact.manifestId)), 'only the four reviewed source gaps may remain blocked in Wave 1')
assert(expectedBlockedIds.size === blockedFacts.length, 'all reviewed source gaps must remain explicitly blocked')

for (const editorial of editorials) {
  assert(editorial.materializationStatus === 'CANDIDATES_FROZEN_SCORING_UNASSIGNED', `${editorial.manifestId} must not have an editorial score`)
  assert(editorial.scoringStatus === 'UNASSIGNED_EVIDENCE_REVIEW_REQUIRED', `${editorial.manifestId} weights/scoring must stay unassigned`)
  assert(editorial.candidateUniverseRef === editorial.familyId, `${editorial.manifestId} must point to its source-backed family candidate universe`)
  assert(!('entries' in editorial), `${editorial.manifestId} must not encode a ranked editorial answer`)
  assert(!('weights' in editorial), `${editorial.manifestId} must not encode editorial weights`)
  assert(!('score' in editorial), `${editorial.manifestId} must not encode an editorial score`)
}

for (const vote of votes) {
  assert(vote.materializationStatus === 'CANDIDATES_FROZEN_NO_VOTES', `${vote.manifestId} must not fabricate vote outcomes`)
  assert(vote.voteCountStatus === 'NOT_STARTED_NO_FABRICATED_VOTES', `${vote.manifestId} must preserve no-vote state`)
  assert(vote.candidateUniverseRef === vote.familyId, `${vote.manifestId} must point to its source-backed family candidate universe`)
  assert(!('entries' in vote), `${vote.manifestId} must not encode vote ordering`)
  assert(!('voteCount' in vote), `${vote.manifestId} must not encode fabricated vote counts`)
}

const s26BenchmarkEntries = materializedFacts
  .filter((fact) => fact.manifestId === 'cc200-smartphones-01' || fact.manifestId === 'cc200-smartphones-02')
  .flatMap((fact) => fact.entries)
assert(!s26BenchmarkEntries.some((entry) => /s26/i.test(entry.itemKey)), 'Galaxy S26 benchmark scores must not be inferred while absent from the frozen Geekbench chart')

const kboBullpen = rankings.find((ranking) => ranking.manifestId === 'cc200-kbo-clubs-03')
assert(kboBullpen?.materializationStatus === 'BLOCKED_SOURCE_GAP', 'KBO bullpen ERA must remain blocked until a bullpen-only official source is reviewed')
assert(/WHOLE_TEAM_ERA_NOT_BULLPEN_ONLY/.test(kboBullpen.blocker), 'whole-team ERA must not be substituted for bullpen ERA')

const steamWeekly = rankings.find((ranking) => ranking.manifestId === 'cc200-steam-mainstream-02')
assert(/TITLE_LABELS_NOT_RELIABLY_EXPOSED/.test(steamWeekly.blocker), 'Steam weekly fact must preserve retrieval-rendering blocker')

assert(wave.closure?.selectedRankingCount === 50, 'closure must report 50 selected rankings')
assert(wave.closure?.factCount === 15, 'closure fact count must match')
assert(wave.closure?.materializedFactCount === 11, 'closure materialized fact count must match')
assert(wave.closure?.blockedFactCount === 4, 'closure blocked fact count must match')
assert(wave.closure?.editorialCount === 25, 'closure editorial count must match')
assert(wave.closure?.voteCount === 10, 'closure vote count must match')
assert(wave.closure?.fabricatedVoteRows === 0, 'fabricated vote rows must remain zero')
assert(wave.closure?.editorialWeightsAssigned === 0, 'editorial weights assigned must remain zero')
assert(wave.closure?.productionRowsWritten === 0, 'production rows written must remain zero')
assert(wave.closure?.recommendationRuns === 0, 'recommendation runs must remain zero')

assert(!publicPage.includes('content/corpus-200/materialization'), 'public ranking page must not import Wave 1 materialization evidence')
assert(!publicPage.includes('wave-1.json'), 'public ranking page must not consume Wave 1 data')

const waveSha256 = crypto.createHash('sha256').update(JSON.stringify(wave)).digest('hex')
const report = {
  version: wave.version,
  manifestSha256: wave.manifestSha256,
  waveSha256,
  selectedRankingCount: rankings.length,
  sourceSnapshotCount: sourceSnapshots.length,
  fact: {
    total: facts.length,
    materialized: materializedFacts.length,
    blocked: blockedFacts.length,
  },
  editorial: {
    total: editorials.length,
    weightsAssigned: wave.closure.editorialWeightsAssigned,
  },
  vote: {
    total: votes.length,
    fabricatedRows: wave.closure.fabricatedVoteRows,
  },
  authority: {
    productionDatabaseWritesAuthorized: wave.authorityBoundary.productionDatabaseWritesAuthorized,
    publicPublicationAuthorized: wave.authorityBoundary.publicPublicationAuthorized,
    recommendationEvaluationAuthorized: wave.authorityBoundary.recommendationEvaluationAuthorized,
  },
}

console.log('CONTENT-CORPUS-200 Wave 1 source materialization result:')
console.log(JSON.stringify(report, null, 2))

assert(EXPECTED_WAVE_SHA256 !== 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION', `Wave 1 must be frozen after first structurally valid execution; observed sha256=${waveSha256}`)
assert(waveSha256 === EXPECTED_WAVE_SHA256, `Wave 1 freeze mismatch: expected ${EXPECTED_WAVE_SHA256}, observed ${waveSha256}`)

console.log(`CONTENT-CORPUS-200 Wave 1 contracts: PASS (${waveSha256.slice(0, 16)})`)
