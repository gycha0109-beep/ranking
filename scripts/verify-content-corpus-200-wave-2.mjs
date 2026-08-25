import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const wavePath = path.join(root, 'content/corpus-200/materialization/wave-2.json')
const provenancePath = path.join(root, 'content/corpus-200/materialization/wave-2-provenance.json')
const publicPagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')
const EXPECTED_MANIFEST_SHA256 = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const EXPECTED_EVIDENCE_SHA256 = 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION'

function fail(message) {
  console.error(`CONTENT-CORPUS-200 Wave 2 verification failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

for (const required of [wavePath, provenancePath, publicPagePath]) {
  assert(fs.existsSync(required), `${path.relative(root, required)} must exist`)
}

const wave = JSON.parse(fs.readFileSync(wavePath, 'utf8'))
const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'))
const publicPage = fs.readFileSync(publicPagePath, 'utf8')

assert(wave.version === 'content-corpus-200-wave-2-v1', 'Wave 2 version must remain explicit')
assert(provenance.version === 'content-corpus-200-wave-2-provenance-v1', 'Wave 2 provenance version must remain explicit')
assert(wave.manifestVersion === 'content-corpus-200-manifest-v1', 'Wave 2 must bind the frozen manifest version')
assert(wave.manifestSha256 === EXPECTED_MANIFEST_SHA256, 'Wave 2 must bind the exact frozen manifest SHA')
assert(wave.status === 'SOURCE_EVIDENCE_PARTIALLY_MATERIALIZED', 'Wave 2 must remain partial source evidence')
assert(wave.observedAt === '2026-08-25T13:01:50+09:00', 'Wave 2 observation time must remain frozen')
assert(provenance.observedAt === wave.observedAt, 'supplemental provenance must share the frozen observation time')

for (const boundary of [wave.authorityBoundary, provenance.authorityBoundary]) {
  assert(boundary && Object.values(boundary).every((value) => value === false), 'all Wave 2 authority flags must remain false')
}

const sourceSnapshots = wave.sourceSnapshots || []
const sourceById = new Map(sourceSnapshots.map((source) => [source.id, source]))
assert(sourceSnapshots.length >= 15, 'Wave 2 must preserve at least 15 explicit source snapshots')
assert(sourceById.size === sourceSnapshots.length, 'Wave 2 source snapshot IDs must be unique')
for (const source of sourceSnapshots) {
  assert(typeof source.id === 'string' && source.id.length >= 5, 'each source snapshot needs a stable ID')
  assert(typeof source.sourceKey === 'string' && source.sourceKey.length >= 3, `${source.id} must bind a catalog sourceKey`)
  assert(typeof source.url === 'string' && source.url.startsWith('https://'), `${source.id} must use an explicit HTTPS URL`)
  assert(typeof source.referencePeriod === 'string' && source.referencePeriod.length >= 4, `${source.id} must freeze a reference period`)
  assert(typeof source.note === 'string' && source.note.length >= 20, `${source.id} must state source/evidence limits`)
}
assert(!sourceSnapshots.some((source) => source.sourceKey === 'headphone-review-lab'), 'license-review-gated third-party headphone lab must not be used in Wave 2')

const expectedFamilies = ['electric-vehicles', 'airports', 'instant-noodles', 'streaming-services', 'anc-headphones']
assert(wave.families?.length === expectedFamilies.length, `Wave 2 must contain exactly ${expectedFamilies.length} families`)
assert(JSON.stringify(wave.families.map((family) => family.familyId)) === JSON.stringify(expectedFamilies), 'Wave 2 family sequence must remain frozen')

for (const family of wave.families) {
  assert(Array.isArray(family.rankings) && family.rankings.length === 10, `${family.familyId} must map exactly ten manifest rankings`)
  for (const sourceId of family.candidateUniverse?.sourceSnapshotIds || []) {
    assert(sourceById.has(sourceId), `${family.familyId} candidate universe references unknown source ${sourceId}`)
  }
  if (family.familyId === 'instant-noodles') {
    assert(family.candidateUniverse.status === 'BLOCKED_SOURCE_GAP', 'instant-noodles candidate universe must remain blocked until broad-market coverage is sufficient')
    assert(Array.isArray(family.candidateUniverse.items) && family.candidateUniverse.items.length === 0, 'blocked instant-noodles candidate universe must not encode a partial market as complete')
    assert(typeof family.candidateUniverse.blocker === 'string' && family.candidateUniverse.blocker.length >= 30, 'instant-noodles candidate blocker must stay explicit')
  } else {
    assert(family.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', `${family.familyId} candidate universe must be source-backed and frozen`)
    assert(Array.isArray(family.candidateUniverse.items) && family.candidateUniverse.items.length >= 5, `${family.familyId} must freeze at least five candidate items`)
    assert(new Set(family.candidateUniverse.items.map((item) => item.itemKey)).size === family.candidateUniverse.items.length, `${family.familyId} candidate item keys must be unique`)
  }
}

const rankings = wave.families.flatMap((family) => family.rankings.map((ranking) => ({ familyId: family.familyId, ...ranking })))
assert(rankings.length === 50, `Wave 2 must map exactly 50 rankings; observed ${rankings.length}`)
assert(new Set(rankings.map((ranking) => ranking.manifestId)).size === 50, 'Wave 2 manifest IDs must be unique')

for (const familyId of expectedFamilies) {
  const familyRows = rankings.filter((ranking) => ranking.familyId === familyId)
  const expectedIds = Array.from({ length: 10 }, (_, index) => `cc200-${familyId}-${String(index + 1).padStart(2, '0')}`)
  assert(JSON.stringify(familyRows.map((ranking) => ranking.manifestId)) === JSON.stringify(expectedIds), `${familyId} must preserve exact manifest ID sequence`)
  assert(familyRows.slice(0, 3).every((ranking) => ranking.kind === 'FACT'), `${familyId} rows 01-03 must remain FACT`)
  assert(familyRows.slice(3, 7).every((ranking) => ranking.kind === 'EDITORIAL_COMPOSITE'), `${familyId} rows 04-07 must remain EDITORIAL_COMPOSITE`)
  assert(familyRows.slice(7, 10).every((ranking) => ranking.kind === 'COMMUNITY_VOTE'), `${familyId} rows 08-10 must remain COMMUNITY_VOTE`)
}

const facts = rankings.filter((ranking) => ranking.kind === 'FACT')
const editorials = rankings.filter((ranking) => ranking.kind === 'EDITORIAL_COMPOSITE')
const votes = rankings.filter((ranking) => ranking.kind === 'COMMUNITY_VOTE')
const materializedFacts = facts.filter((ranking) => ranking.materializationStatus === 'MATERIALIZED_FACT' || ranking.materializationStatus === 'MATERIALIZED_COMPARISON')
const blockedFacts = facts.filter((ranking) => ranking.materializationStatus === 'BLOCKED_SOURCE_GAP')
const frozenEditorials = editorials.filter((ranking) => ranking.materializationStatus === 'CANDIDATES_FROZEN_SCORING_UNASSIGNED')
const blockedEditorials = editorials.filter((ranking) => ranking.materializationStatus === 'BLOCKED_CANDIDATE_GAP')
const frozenVotes = votes.filter((ranking) => ranking.materializationStatus === 'CANDIDATES_FROZEN_NO_VOTES')
const blockedVotes = votes.filter((ranking) => ranking.materializationStatus === 'BLOCKED_CANDIDATE_GAP')

assert(facts.length === 15, 'Wave 2 must contain exactly 15 FACT rankings')
assert(materializedFacts.length === 9, `Wave 2 must materialize exactly nine FACT/comparison rows; observed ${materializedFacts.length}`)
assert(blockedFacts.length === 6, `Wave 2 must preserve exactly six FACT source gaps; observed ${blockedFacts.length}`)
assert(editorials.length === 20 && frozenEditorials.length === 16 && blockedEditorials.length === 4, 'Wave 2 editorial state must remain 20 total / 16 frozen / 4 candidate-blocked')
assert(votes.length === 15 && frozenVotes.length === 12 && blockedVotes.length === 3, 'Wave 2 vote state must remain 15 total / 12 frozen / 3 candidate-blocked')

const expectedBlockedFactIds = new Set([
  'cc200-electric-vehicles-03',
  'cc200-airports-03',
  'cc200-instant-noodles-01',
  'cc200-instant-noodles-02',
  'cc200-instant-noodles-03',
  'cc200-streaming-services-03',
])
assert(blockedFacts.every((fact) => expectedBlockedFactIds.has(fact.manifestId)), 'only the six reviewed Wave 2 FACT gaps may remain blocked')
assert(expectedBlockedFactIds.size === blockedFacts.length, 'all reviewed Wave 2 FACT gaps must be explicitly present')

for (const fact of materializedFacts) {
  assert(Array.isArray(fact.sourceSnapshotIds) && fact.sourceSnapshotIds.length >= 1, `${fact.manifestId} must cite reviewed source snapshots`)
  for (const sourceId of fact.sourceSnapshotIds) assert(sourceById.has(sourceId), `${fact.manifestId} references unknown source ${sourceId}`)
  assert(Array.isArray(fact.entries) && fact.entries.length >= 5, `${fact.manifestId} must materialize at least five entries`)
  assert(typeof fact.metric === 'string' && fact.metric.length >= 3, `${fact.manifestId} must name its materialized metric/comparison`)
  assert(!('blocker' in fact), `${fact.manifestId} cannot be both materialized and blocked`)

  if (fact.materializationStatus === 'MATERIALIZED_FACT') {
    assert(fact.direction === 'ASC' || fact.direction === 'DESC', `${fact.manifestId} numeric FACT must declare deterministic direction`)
    for (const entry of fact.entries) {
      assert(typeof entry.itemKey === 'string' && entry.itemKey.length >= 2, `${fact.manifestId} entries need item keys`)
      assert(typeof entry.label === 'string' && entry.label.length >= 1, `${fact.manifestId} entries need labels`)
      assert(Number.isFinite(entry.value), `${fact.manifestId}/${entry.itemKey} value must be finite`)
    }
  } else {
    assert(fact.manifestId === 'cc200-anc-headphones-03', 'only ANC codec support may use MATERIALIZED_COMPARISON in Wave 2')
    assert(typeof fact.comparisonBoundary === 'string' && fact.comparisonBoundary.includes('NO_CODEC_IS_INFERRED'), 'codec comparison must preserve no-inference boundary')
    for (const entry of fact.entries) {
      assert(Array.isArray(entry.declared), `${fact.manifestId}/${entry.itemKey} must preserve explicit declared codec array`)
      assert(entry.declarationStatus === 'DECLARED' || entry.declarationStatus === 'NOT_DECLARED_ON_REVIEWED_OFFICIAL_SPEC', `${fact.manifestId}/${entry.itemKey} must distinguish declaration from absence`)
    }
  }
}

for (const fact of blockedFacts) {
  assert(typeof fact.blocker === 'string' && fact.blocker.length >= 30, `${fact.manifestId} must preserve an explicit source blocker`)
  assert(!('entries' in fact), `${fact.manifestId} blocked FACT must not fabricate entries`)
  assert(!('metric' in fact), `${fact.manifestId} blocked FACT must not pretend a metric is materialized`)
  for (const sourceId of fact.sourceSnapshotIds || []) assert(sourceById.has(sourceId), `${fact.manifestId} blocker references unknown source ${sourceId}`)
}

for (const editorial of frozenEditorials) {
  assert(editorial.scoringStatus === 'UNASSIGNED_EVIDENCE_REVIEW_REQUIRED', `${editorial.manifestId} scoring must stay unassigned`)
  assert(editorial.candidateUniverseRef === editorial.familyId, `${editorial.manifestId} must bind its family candidate universe`)
  assert(!('entries' in editorial) && !('weights' in editorial) && !('score' in editorial), `${editorial.manifestId} must not encode editorial answers or weights`)
}
for (const editorial of blockedEditorials) {
  assert(editorial.familyId === 'instant-noodles', `${editorial.manifestId} candidate-blocked editorial must be instant-noodles in Wave 2`)
  assert(typeof editorial.blocker === 'string' && editorial.blocker.length >= 20, `${editorial.manifestId} must preserve candidate blocker`)
  assert(!('entries' in editorial) && !('weights' in editorial) && !('score' in editorial), `${editorial.manifestId} blocked editorial must not encode an answer`)
}

for (const vote of frozenVotes) {
  assert(vote.voteCountStatus === 'NOT_STARTED_NO_FABRICATED_VOTES', `${vote.manifestId} must remain no-vote`)
  assert(vote.candidateUniverseRef === vote.familyId, `${vote.manifestId} must bind its family candidate universe`)
  assert(!('entries' in vote) && !('voteCount' in vote), `${vote.manifestId} must not encode vote results`)
}
for (const vote of blockedVotes) {
  assert(vote.familyId === 'instant-noodles', `${vote.manifestId} candidate-blocked vote must be instant-noodles in Wave 2`)
  assert(typeof vote.blocker === 'string' && vote.blocker.length >= 20, `${vote.manifestId} must preserve candidate blocker`)
  assert(!('entries' in vote) && !('voteCount' in vote), `${vote.manifestId} blocked vote must not fabricate results`)
}

const evSafety = rankings.find((ranking) => ranking.manifestId === 'cc200-electric-vehicles-03')
assert(evSafety?.materializationStatus === 'BLOCKED_SOURCE_GAP' && /GOVERNMENT_SAFETY/.test(evSafety.blocker), 'EV government safety comparison must remain blocked until a single comparable government program is reviewed')
const airportDestinations = rankings.find((ranking) => ranking.manifestId === 'cc200-airports-03')
assert(airportDestinations?.materializationStatus === 'BLOCKED_SOURCE_GAP' && /DIRECT_DESTINATIONS/.test(airportDestinations.blocker), 'airport direct-destination comparison must remain blocked')
const streaming4k = rankings.find((ranking) => ranking.manifestId === 'cc200-streaming-services-03')
assert(streaming4k?.materializationStatus === 'BLOCKED_SOURCE_GAP' && /TVING_REMAINS_UNRESOLVED/.test(streaming4k.blocker), 'OTT lowest-4K-plan comparison must remain blocked while TVING tier is unresolved')

const noodleRows = rankings.filter((ranking) => ranking.familyId === 'instant-noodles')
assert(noodleRows.every((ranking) => ranking.materializationStatus === 'BLOCKED_SOURCE_GAP' || ranking.materializationStatus === 'BLOCKED_CANDIDATE_GAP'), 'instant-noodles must not materialize broad-market answers from incomplete source coverage')

const codecComparison = rankings.find((ranking) => ranking.manifestId === 'cc200-anc-headphones-03')
const appleCodec = codecComparison?.entries?.find((entry) => entry.itemKey === 'apple-airpods-max2')
assert(appleCodec?.declarationStatus === 'NOT_DECLARED_ON_REVIEWED_OFFICIAL_SPEC' && appleCodec.declared.length === 0, 'Apple codec support must not be inferred from non-declaration')

const boseWeight = rankings.find((ranking) => ranking.manifestId === 'cc200-anc-headphones-01')?.entries?.find((entry) => entry.itemKey === 'bose-qc-ultra2')
assert(boseWeight?.sourceOriginal?.value === 0.583 && boseWeight.sourceOriginal.unit === 'lb', 'Bose original 0.583 lb weight must be preserved')
assert(Math.abs(boseWeight.value - 0.583 * 453.59237) < 0.001, 'Bose grams conversion must be deterministic from the preserved source value')

const appleConcurrencyLink = provenance.links?.find((link) => link.manifestId === 'cc200-streaming-services-02' && link.itemKey === 'apple-tv')
assert(appleConcurrencyLink?.sourceId === 'apple-support-tvplus-concurrency', 'Apple TV concurrency must bind the dedicated Apple Support provenance')
assert(appleConcurrencyLink?.url === 'https://support.apple.com/ko-kr/118239', 'Apple TV concurrency provenance URL must remain exact')
assert(/6개의 스트리밍을 동시에/.test(appleConcurrencyLink?.evidence || ''), 'Apple TV concurrency evidence must explicitly distinguish six simultaneous streams from family sharing')

assert(wave.closure?.selectedRankingCount === 50, 'closure selected ranking count must be 50')
assert(wave.closure?.factCount === 15 && wave.closure.materializedFactCount === 9 && wave.closure.blockedFactCount === 6, 'closure FACT counts must match 15 / 9 materialized / 6 blocked')
assert(wave.closure?.editorialCount === 20 && wave.closure.editorialCandidateFrozenCount === 16 && wave.closure.editorialCandidateBlockedCount === 4, 'closure editorial counts must match')
assert(wave.closure?.voteCount === 15 && wave.closure.voteCandidateFrozenCount === 12 && wave.closure.voteCandidateBlockedCount === 3, 'closure vote counts must match')
assert(wave.closure?.fabricatedVoteRows === 0, 'fabricated vote rows must remain zero')
assert(wave.closure?.editorialWeightsAssigned === 0, 'editorial weights must remain zero')
assert(wave.closure?.productionRowsWritten === 0, 'production rows written must remain zero')
assert(wave.closure?.recommendationRuns === 0, 'recommendation runs must remain zero')

assert(!publicPage.includes('wave-2.json'), 'public ranking page must not consume Wave 2 evidence')
assert(!publicPage.includes('wave-2-provenance.json'), 'public ranking page must not consume Wave 2 supplemental provenance')

const evidenceSha256 = crypto.createHash('sha256').update(JSON.stringify({ wave, provenance })).digest('hex')
const report = {
  version: wave.version,
  manifestSha256: wave.manifestSha256,
  evidenceSha256,
  selectedRankingCount: rankings.length,
  sourceSnapshotCount: sourceSnapshots.length,
  supplementalProvenanceLinks: provenance.links?.length || 0,
  fact: { total: facts.length, materialized: materializedFacts.length, blocked: blockedFacts.length },
  editorial: { total: editorials.length, candidateFrozen: frozenEditorials.length, candidateBlocked: blockedEditorials.length, weightsAssigned: wave.closure.editorialWeightsAssigned },
  vote: { total: votes.length, candidateFrozen: frozenVotes.length, candidateBlocked: blockedVotes.length, fabricatedRows: wave.closure.fabricatedVoteRows },
  authority: {
    productionDatabaseWritesAuthorized: wave.authorityBoundary.productionDatabaseWritesAuthorized,
    publicPublicationAuthorized: wave.authorityBoundary.publicPublicationAuthorized,
    recommendationEvaluationAuthorized: wave.authorityBoundary.recommendationEvaluationAuthorized,
  },
}

console.log('CONTENT-CORPUS-200 Wave 2 source materialization result:')
console.log(JSON.stringify(report, null, 2))

assert(EXPECTED_EVIDENCE_SHA256 !== 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION', `Wave 2 evidence must be frozen after first structurally valid execution; observed sha256=${evidenceSha256}`)
assert(evidenceSha256 === EXPECTED_EVIDENCE_SHA256, `Wave 2 evidence freeze mismatch: expected ${EXPECTED_EVIDENCE_SHA256}, observed ${evidenceSha256}`)

console.log(`CONTENT-CORPUS-200 Wave 2 contracts: PASS (${evidenceSha256.slice(0, 16)})`)
