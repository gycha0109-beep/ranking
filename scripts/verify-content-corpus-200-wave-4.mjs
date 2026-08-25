import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const p = (...x) => path.join(root, ...x)
const paths = {
  index: p('content/corpus-200/materialization/wave-4.json'),
  a: p('content/corpus-200/materialization/wave-4-families-a.json'),
  b: p('content/corpus-200/materialization/wave-4-families-b.json'),
  page: p('src/app/rankings/[rankingSlug]/page.tsx'),
}
const PRIOR = [1, 2, 3].map((n) => p(`content/corpus-200/materialization/wave-${n}.json`))
const MANIFEST = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const EXPECTED = 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION'
const fail = (m) => { console.error(`CONTENT-CORPUS-200 Wave 4 verification failed: ${m}`); process.exit(1) }
const ok = (v, m) => { if (!v) fail(m) }
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))

for (const f of [...Object.values(paths), ...PRIOR]) ok(fs.existsSync(f), `${path.basename(f)} must exist`)
const index = read(paths.index)
const a = read(paths.a)
const b = read(paths.b)
const wave = { ...index, families: [...a.families, ...b.families] }
const prior = PRIOR.map(read)
const page = fs.readFileSync(paths.page, 'utf8')

ok(index.version === 'content-corpus-200-wave-4-v1', 'version mismatch')
ok(index.manifestVersion === 'content-corpus-200-manifest-v1' && index.manifestSha256 === MANIFEST, 'manifest identity mismatch')
ok(index.status === 'SOURCE_EVIDENCE_PARTIALLY_MATERIALIZED', 'status must remain partial')
ok(index.observedAt === '2026-08-25T13:58:00+09:00', 'observation time mismatch')
ok(Object.values(index.authorityBoundary || {}).every((v) => v === false), 'authority flags must remain false')
ok(a.version === 'content-corpus-200-wave-4-families-a-v1' && b.version === 'content-corpus-200-wave-4-families-b-v1', 'family evidence version mismatch')
ok(JSON.stringify(index.familyFiles) === JSON.stringify([
  'content/corpus-200/materialization/wave-4-families-a.json',
  'content/corpus-200/materialization/wave-4-families-b.json',
]), 'family file index mismatch')

const sources = index.sourceSnapshots || []
const sourceIds = new Set(sources.map((s) => s.id))
ok(sources.length === 13 && sourceIds.size === 13, 'source snapshot count mismatch')
for (const s of sources) {
  ok(s.sourceKey && s.url?.startsWith('https://') && s.referencePeriod && s.note?.length >= 20, `${s.id} source contract invalid`)
}
const circle = sources.find((s) => s.id === 'circle-chart-wave4-manual-boundary')
ok(circle?.sourceKey === 'circle-chart' && /MANUAL_REFERENCE_ONLY/.test(circle.note) && /no automated chart-entry extraction/i.test(circle.note), 'Circle Chart boundary mismatch')

const spec = [
  ['kpop-songs', 5, 2],
  ['kpop-artists-albums', 5, 2],
  ['asian-cities', 4, 3],
  ['convenience-protein', 4, 3],
  ['skincare-serums', 4, 3],
]
ok(JSON.stringify(wave.families.map((f) => f.familyId)) === JSON.stringify(spec.map(([id]) => id)), 'family sequence mismatch')
for (const [id, ec, vc] of spec) {
  const f = wave.families.find((x) => x.familyId === id)
  ok(f.rankings?.length === 10, `${id} ranking count mismatch`)
  ok(JSON.stringify(f.rankings.map((r) => r.manifestId)) === JSON.stringify(Array.from({length:10}, (_,i) => `cc200-${id}-${String(i+1).padStart(2,'0')}`)), `${id} manifest sequence mismatch`)
  ok(f.rankings.slice(0,3).every((r) => r.kind === 'FACT'), `${id} FACT layout mismatch`)
  ok(f.rankings.slice(3,3+ec).every((r) => r.kind === 'EDITORIAL_COMPOSITE'), `${id} editorial layout mismatch`)
  ok(f.rankings.slice(3+ec).every((r) => r.kind === 'COMMUNITY_VOTE') && f.rankings.filter((r) => r.kind === 'COMMUNITY_VOTE').length === vc, `${id} vote layout mismatch`)
}

for (const id of ['kpop-songs','kpop-artists-albums']) {
  const f = wave.families.find((x) => x.familyId === id)
  ok(f.candidateUniverse.status === 'BLOCKED_SOURCE_GAP' && f.candidateUniverse.items.length === 0, `${id} must remain candidate-blocked`)
  ok(/CIRCLE_CHART_MANUAL_REFERENCE_ONLY/.test(f.candidateUniverse.blocker), `${id} Circle blocker missing`)
  ok(f.rankings.slice(0,3).every((r) => r.materializationStatus === 'BLOCKED_SOURCE_GAP'), `${id} FACTs must remain blocked`)
  ok(f.rankings.slice(3).every((r) => r.materializationStatus === 'BLOCKED_CANDIDATE_GAP'), `${id} dependent rows must remain blocked`)
}
for (const id of ['asian-cities','convenience-protein','skincare-serums']) {
  const f = wave.families.find((x) => x.familyId === id)
  ok(f.candidateUniverse.status === 'FROZEN_SOURCE_BACKED' && f.candidateUniverse.items.length >= 5, `${id} candidate freeze mismatch`)
  ok(new Set(f.candidateUniverse.items.map((x) => x.itemKey)).size === f.candidateUniverse.items.length, `${id} candidate keys must be unique`)
  for (const sid of f.candidateUniverse.sourceSnapshotIds) ok(sourceIds.has(sid), `${id} unknown source ${sid}`)
}

const rows = wave.families.flatMap((f) => f.rankings.map((r) => ({familyId:f.familyId,...r})))
const facts = rows.filter((r) => r.kind === 'FACT')
const ed = rows.filter((r) => r.kind === 'EDITORIAL_COMPOSITE')
const votes = rows.filter((r) => r.kind === 'COMMUNITY_VOTE')
const mat = facts.filter((r) => ['MATERIALIZED_FACT','MATERIALIZED_COMPARISON'].includes(r.materializationStatus))
const bf = facts.filter((r) => r.materializationStatus === 'BLOCKED_SOURCE_GAP')
const ef = ed.filter((r) => r.materializationStatus === 'CANDIDATES_FROZEN_SCORING_UNASSIGNED')
const eb = ed.filter((r) => r.materializationStatus === 'BLOCKED_CANDIDATE_GAP')
const vf = votes.filter((r) => r.materializationStatus === 'CANDIDATES_FROZEN_NO_VOTES')
const vb = votes.filter((r) => r.materializationStatus === 'BLOCKED_CANDIDATE_GAP')
ok(rows.length === 50 && new Set(rows.map((r) => r.manifestId)).size === 50, 'Wave 4 unique row count mismatch')
ok(facts.length === 15 && mat.length === 2 && bf.length === 13, 'FACT state mismatch')
ok(ed.length === 22 && ef.length === 12 && eb.length === 10, 'editorial state mismatch')
ok(votes.length === 13 && vf.length === 9 && vb.length === 4, 'vote state mismatch')
ok(JSON.stringify(mat.map((r) => r.manifestId)) === JSON.stringify(['cc200-skincare-serums-02','cc200-skincare-serums-03']), 'materialized FACT set mismatch')

for (const r of bf) ok(r.blocker?.length >= 30 && !('entries' in r) && !('metric' in r), `${r.manifestId} blocked FACT contract invalid`)
for (const r of ef) ok(r.scoringStatus === 'UNASSIGNED_EVIDENCE_REVIEW_REQUIRED' && !('weights' in r) && !('score' in r) && !('entries' in r), `${r.manifestId} editorial answer forbidden`)
for (const r of vf) ok(r.voteCountStatus === 'NOT_STARTED_NO_FABRICATED_VOTES' && !('voteCount' in r) && !('entries' in r), `${r.manifestId} fabricated votes forbidden`)
for (const r of [...eb,...vb]) ok(r.blocker?.length >= 20 && !('entries' in r) && !('weights' in r) && !('score' in r) && !('voteCount' in r), `${r.manifestId} blocked candidate outcome forbidden`)

const byId = new Map(rows.map((r) => [r.manifestId,r]))
const cities = wave.families.find((f) => f.familyId === 'asian-cities')
ok(cities.candidateUniverse.items.length === 5 && /not represented as all Asian cities/i.test(cities.candidateUniverse.note), 'city subset boundary missing')
ok(cities.rankings.slice(0,3).every((r) => /NO_SINGLE_COMPARABLE_OFFICIAL/.test(r.blocker)), 'city FACT comparability blockers missing')
const convenience = wave.families.find((f) => f.familyId === 'convenience-protein')
ok(convenience.candidateUniverse.items.length === 5 && /not a claim of current all-store availability/i.test(convenience.candidateUniverse.note), 'convenience scope boundary missing')
ok(convenience.rankings.slice(0,3).every((r) => r.materializationStatus === 'BLOCKED_SOURCE_GAP'), 'convenience FACTs require complete current labels')
const volume = byId.get('cc200-skincare-serums-02')
ok(volume.direction === 'DESC' && JSON.stringify(volume.entries.map((e) => e.value)) === JSON.stringify([100,60,50,30,20]), 'serum volume evidence mismatch')
const comparison = byId.get('cc200-skincare-serums-03')
ok(comparison.comparisonBoundary === 'DECLARATIONS_ONLY_NO_CROSS_ACTIVE_EFFICACY_ORDER_INFERRED', 'serum efficacy inference forbidden')
const centella = comparison.entries.find((e) => e.itemKey === 'skin1004-centella-ampoule-100ml')
ok(centella.declarationStatus === 'INGREDIENT_DECLARED_PERCENT_NOT_STATED' && !('amountPercent' in centella.declared[0]), 'Centella percentage must not be fabricated')
ok(/NO_SINGLE_COMPARABLE_CURRENT_KOREAN_RETAIL_PRICE_SNAPSHOT/.test(byId.get('cc200-skincare-serums-01').blocker), 'serum price blocker missing')

const c = index.closure
ok(c.selectedRankingCount===50 && c.sourceSnapshotCount===13 && c.factCount===15 && c.materializedFactCount===2 && c.blockedFactCount===13, 'closure size/FACT mismatch')
ok(c.editorialCount===22 && c.editorialCandidateFrozenCount===12 && c.editorialCandidateBlockedCount===10, 'closure editorial mismatch')
ok(c.voteCount===13 && c.voteCandidateFrozenCount===9 && c.voteCandidateBlockedCount===4, 'closure vote mismatch')
ok(c.fabricatedVoteRows===0 && c.editorialWeightsAssigned===0 && c.productionRowsWritten===0 && c.recommendationRuns===0 && c.corpusCoverageAfterWave===200, 'closure authority mismatch')

const all = [...prior,wave]
ok(all.every((x) => x.manifestSha256 === MANIFEST), 'cross-wave manifest SHA mismatch')
const allIds = all.flatMap((x) => x.families.flatMap((f) => f.rankings.map((r) => r.manifestId)))
ok(allIds.length === 200 && new Set(allIds).size === 200, 'Wave 1-4 must cover exactly 200 unique IDs')
ok(!['wave-4.json','wave-4-families-a.json','wave-4-families-b.json'].some((name) => page.includes(name)), 'public page must not consume Wave 4 evidence')

const sha = crypto.createHash('sha256').update(JSON.stringify({index,familyA:a,familyB:b})).digest('hex')
console.log('CONTENT-CORPUS-200 Wave 4 source materialization result:')
console.log(JSON.stringify({
  version:index.version, manifestSha256:index.manifestSha256, evidenceSha256:sha,
  selectedRankingCount:rows.length, sourceSnapshotCount:sources.length,
  fact:{total:facts.length,materialized:mat.length,blocked:bf.length},
  editorial:{total:ed.length,candidateFrozen:ef.length,candidateBlocked:eb.length,weightsAssigned:c.editorialWeightsAssigned},
  vote:{total:votes.length,candidateFrozen:vf.length,candidateBlocked:vb.length,fabricatedRows:c.fabricatedVoteRows},
  corpusCoverage:{totalAcrossWaves:allIds.length,uniqueAcrossWaves:new Set(allIds).size},
  authority:{productionDatabaseWritesAuthorized:index.authorityBoundary.productionDatabaseWritesAuthorized,publicPublicationAuthorized:index.authorityBoundary.publicPublicationAuthorized,recommendationEvaluationAuthorized:index.authorityBoundary.recommendationEvaluationAuthorized}
}, null, 2))
ok(EXPECTED !== 'TO_BE_FROZEN_AFTER_FIRST_STRUCTURALLY_VALID_EXECUTION', `Wave 4 evidence must be frozen after first structurally valid execution; observed sha256=${sha}`)
ok(sha === EXPECTED, `Wave 4 evidence freeze mismatch: expected ${EXPECTED}, observed ${sha}`)
console.log(`CONTENT-CORPUS-200 Wave 4 contracts: PASS (${sha.slice(0,16)})`)
