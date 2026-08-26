import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  review: p('content/corpus-200/editorial-scoring-review.json'),
  effective: p('content/corpus-200/effective-materialization-state.json'),
  preflight: p('content/corpus-200/publication-preflight.json'),
  overlap: p('content/corpus-200/current-production-overlap-review.json'),
  taxonomy: p('content/corpus-200/proposed-taxonomy-review.json'),
  schema: p('content/corpus-200/schema.ts'),
  manifest: p('content/corpus-200/manifest.ts'),
  families: [
    p('content/corpus-200/families-01-games-media.ts'),
    p('content/corpus-200/families-02-music-tech-sports.ts'),
    p('content/corpus-200/families-03-mobility-travel-food.ts'),
    p('content/corpus-200/families-04-beauty-subscriptions-consumer.ts'),
  ],
  wave1: p('content/corpus-200/materialization/wave-1.json'),
  wave2: p('content/corpus-200/materialization/wave-2.json'),
  wave3: p('content/corpus-200/materialization/wave-3.json'),
  wave4a: p('content/corpus-200/materialization/wave-4-families-a.json'),
  wave4b: p('content/corpus-200/materialization/wave-4-families-b.json'),
  page: p('src/app/rankings/[rankingSlug]/page.tsx'),
  pkg: p('package.json'),
  ci: p('.github/workflows/ci.yml'),
}

const MANIFEST_SHA = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const EFFECTIVE_SHA = 'e25f7ba735695f8171b22ce9ba0d6bb0e6e36dea1963d3596d3edbd9a5e14618'
const PREFLIGHT_SHA = 'a62c1c62e9ca68ce4598d67b9b2cb286bddd88c46214d7ab3d08e77c6e937175'
const OVERLAP_SHA = 'fb309dbb9d18514afbc9b01c3f573fd5b05eb06f84eafaa4fddaeb7e1e968205'
const TAXONOMY_SHA = '923571392c401674d64a21e3d9f96231f417c702100426a866df912306e57cad'
const EXPECTED = '107fdb5d026333b55b21f3ce5cb8fafb754c557e5691f7cb3f3f6b9b8e2bc496'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 editorial scoring review verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files).flat()) ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)

const review = readJson(files.review)
const effective = readJson(files.effective)
const preflight = readJson(files.preflight)
const overlap = readJson(files.overlap)
const taxonomy = readJson(files.taxonomy)
const wave1 = readJson(files.wave1)
const wave2 = readJson(files.wave2)
const wave3 = readJson(files.wave3)
const wave4a = readJson(files.wave4a)
const wave4b = readJson(files.wave4b)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(effective) === EFFECTIVE_SHA, 'frozen effective materialization state mutated')
ok(jsonSha(preflight) === PREFLIGHT_SHA, 'frozen publication preflight mutated')
ok(jsonSha(overlap) === OVERLAP_SHA, 'frozen production overlap review mutated')
ok(jsonSha(taxonomy) === TAXONOMY_SHA, 'frozen proposed taxonomy review mutated')
ok([wave1, wave2, wave3].every((wave) => wave.manifestSha256 === MANIFEST_SHA), 'Wave 1-3 manifest lineage mismatch')
ok(Object.values(wave1.authorityBoundary || {}).every((value) => value === false), 'Wave 1 authority must remain disabled')
ok(Object.values(wave2.authorityBoundary || {}).every((value) => value === false), 'Wave 2 authority must remain disabled')
ok(Object.values(wave3.authorityBoundary || {}).every((value) => value === false), 'Wave 3 authority must remain disabled')

ok(effective.effectiveSummary?.byContentType?.EDITORIAL_COMPOSITE?.total === 90, 'effective state must retain 90 editorial rows')
ok(effective.effectiveSummary?.byContentType?.EDITORIAL_COMPOSITE?.candidatesFrozenScoringUnassigned === 76, 'effective state must retain 76 frozen editorial candidate rows')
ok(effective.effectiveSummary?.byContentType?.EDITORIAL_COMPOSITE?.blockedCandidateGap === 14, 'effective state must retain 14 editorial candidate gaps')
ok(effective.derivationBoundary?.editorialWeightsAssigned === false, 'effective state must retain unassigned editorial weights')
ok(preflight.stages?.authoritativeOrdering?.editorialRowsPendingReviewedScoring === 76, 'publication preflight must retain 76 editorial rows pending reviewed scoring')
ok(preflight.stages?.publicationClearance?.fullyPublicationClearedRows === 0, 'publication preflight must remain non-cleared')
ok(overlap.reviewSummary?.overlapReviewCompleteRows === 200, 'production overlap review must remain complete')
ok(taxonomy.reviewSummary?.reviewedProposedManifestRowCount === 130, 'proposed taxonomy review must remain complete')
ok(taxonomy.nextGate === 'EDITORIAL_SCORING_REVIEW', 'taxonomy review must hand off to editorial scoring review')
ok(Object.values(taxonomy.authorityBoundary || {}).every((value) => value === false), 'taxonomy review authority must remain disabled')

function transpile(source, fileName) {
  return ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, strict: true },
    fileName,
  }).outputText
}
function dataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}

const schemaUrl = dataUrl(transpile(fs.readFileSync(files.schema, 'utf8'), files.schema))
const familyUrls = files.families.map((file) => dataUrl(transpile(fs.readFileSync(file, 'utf8'), file)))
let manifestJs = transpile(fs.readFileSync(files.manifest, 'utf8'), files.manifest)
manifestJs = manifestJs.replace("from './schema'", `from '${schemaUrl}'`)
files.families.forEach((file, index) => {
  const moduleName = `./${path.basename(file, '.ts')}`
  manifestJs = manifestJs.replace(`from '${moduleName}'`, `from '${familyUrls[index]}'`)
})
const manifestModule = await import(dataUrl(manifestJs))
const manifest = manifestModule.buildContentCorpus200Manifest()
const rows = manifest.rankings
const canonicalPayload = rows.map((row) => ({
  manifestId: row.manifestId,
  familyId: row.familyId,
  title: row.title,
  contentType: row.contentType,
  rankingType: row.rankingType,
  categorySlug: row.categorySlug,
  subcategorySlug: row.subcategorySlug,
  taxonomyStatus: row.taxonomyStatus,
  candidateUniverseStrategy: row.candidateUniverseStrategy,
  rankingBasis: row.rankingBasis,
  sourceKeys: row.sourceKeys,
  referencePeriod: row.referencePeriod,
  factDimensions: row.factDimensions,
  compositeDimensions: row.compositeDimensions,
  voteQuestion: row.voteQuestion,
  semanticPlan: row.semanticPlan,
}))
ok(crypto.createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex') === MANIFEST_SHA, 'frozen manifest canonical payload mutated')
ok(rows.length === 200 && new Set(rows.map((row) => row.manifestId)).size === 200, 'manifest must remain exactly 200 unique rows')

const manifestEditorials = rows.filter((row) => row.contentType === 'EDITORIAL_COMPOSITE')
ok(manifestEditorials.length === 90, 'manifest must retain exactly 90 editorial composite rows')
for (const row of manifestEditorials) {
  ok(typeof row.editorialQuestion === 'string' && row.editorialQuestion.trim().length > 0, `${row.manifestId} must retain an explicit editorial question`)
  ok(Array.isArray(row.compositeDimensions) && row.compositeDimensions.length > 0, `${row.manifestId} must retain declared composite dimensions`)
  ok(row.compositeDimensions.every((dimension) => typeof dimension.name === 'string' && dimension.name.trim().length > 0 && dimension.weightStatus === 'UNASSIGNED_PRE_MATERIALIZATION'), `${row.manifestId} dimensions must remain named with unassigned weights`)
  ok(row.compositeFormula === 'WEIGHTS_NOT_ASSIGNED_PRE_MATERIALIZATION', `${row.manifestId} formula must remain unassigned`)
  ok(row.rankingBasis === 'Declared multi-dimension editorial composite; weights are authored and reviewed only after source materialization.', `${row.manifestId} ranking basis must preserve review boundary`)
  ok(row.sourceExtractionMode === 'SOURCE_MATERIALIZATION_REQUIRED', `${row.manifestId} must retain source materialization requirement`)
  ok(row.publicationStatus === 'DRAFT_ONLY' && row.entryMaterializationStatus === 'NOT_STARTED' && row.algorithmEvaluationStatus === 'NOT_RUN', `${row.manifestId} must remain pre-publication and unevaluated`)
}

const waveSources = [
  { wave: 1, docs: [wave1] },
  { wave: 2, docs: [wave2] },
  { wave: 3, docs: [wave3] },
  { wave: 4, docs: [wave4a, wave4b] },
]
const expectedWaveCounts = {
  1: { total: 25, frozen: 25, blocked: 0 },
  2: { total: 20, frozen: 16, blocked: 4 },
  3: { total: 23, frozen: 23, blocked: 0 },
  4: { total: 22, frozen: 12, blocked: 10 },
}
const materializedEditorials = []
for (const { wave, docs } of waveSources) {
  const families = docs.flatMap((doc) => doc.families || [])
  const familyById = new Map(families.map((family) => [family.familyId, family]))
  const editorials = families
    .flatMap((family) => (family.rankings || []).map((ranking) => ({ wave, familyId: family.familyId, ...ranking })))
    .filter((ranking) => ranking.kind === 'EDITORIAL_COMPOSITE')
  const frozen = editorials.filter((ranking) => ranking.materializationStatus === 'CANDIDATES_FROZEN_SCORING_UNASSIGNED')
  const blocked = editorials.filter((ranking) => ranking.materializationStatus === 'BLOCKED_CANDIDATE_GAP')
  const expected = expectedWaveCounts[wave]
  ok(editorials.length === expected.total && frozen.length === expected.frozen && blocked.length === expected.blocked, `Wave ${wave} editorial state mismatch`)
  for (const editorial of frozen) {
    const family = familyById.get(editorial.familyId)
    ok(family?.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', `${editorial.manifestId} frozen row must bind a source-backed candidate universe`)
    ok(Array.isArray(family.candidateUniverse.items) && family.candidateUniverse.items.length > 0, `${editorial.manifestId} frozen candidate universe must contain reviewed items`)
    ok(editorial.candidateUniverseRef === editorial.familyId && editorial.scoringStatus === 'UNASSIGNED_EVIDENCE_REVIEW_REQUIRED', `${editorial.manifestId} scoring status/binding mismatch`)
    ok(!['entries', 'weights', 'score', 'scores', 'dimensionValues', 'rank'].some((key) => key in editorial), `${editorial.manifestId} must not encode scoring output`)
  }
  for (const editorial of blocked) {
    const family = familyById.get(editorial.familyId)
    ok(family?.candidateUniverse?.status === 'BLOCKED_SOURCE_GAP', `${editorial.manifestId} blocked row must bind a blocked family candidate universe`)
    ok(typeof editorial.blocker === 'string' && editorial.blocker.trim().length >= 20, `${editorial.manifestId} must preserve an explicit candidate blocker`)
    ok(!['entries', 'weights', 'score', 'scores', 'dimensionValues', 'rank'].some((key) => key in editorial), `${editorial.manifestId} blocked row must not encode an answer`)
  }
  materializedEditorials.push(...editorials)
}

ok(materializedEditorials.length === 90 && new Set(materializedEditorials.map((row) => row.manifestId)).size === 90, 'materialization evidence must cover exactly 90 unique editorial rows')
const manifestEditorialIds = new Set(manifestEditorials.map((row) => row.manifestId))
ok(materializedEditorials.every((row) => manifestEditorialIds.has(row.manifestId)), 'materialization contains an editorial row outside the manifest')
ok(manifestEditorials.every((row) => materializedEditorials.some((materialized) => materialized.manifestId === row.manifestId)), 'every manifest editorial row must appear in materialization evidence')
const frozenEditorials = materializedEditorials.filter((row) => row.materializationStatus === 'CANDIDATES_FROZEN_SCORING_UNASSIGNED')
const blockedEditorials = materializedEditorials.filter((row) => row.materializationStatus === 'BLOCKED_CANDIDATE_GAP')
ok(frozenEditorials.length === 76 && blockedEditorials.length === 14, 'editorial materialization state must remain 76 frozen / 14 blocked')

ok(review.version === 'content-corpus-200-editorial-scoring-review-v1', 'review version mismatch')
ok(review.manifestVersion === manifest.manifestVersion && review.manifestSha256 === MANIFEST_SHA, 'manifest lineage mismatch')
ok(review.effectiveMaterializationStateVersion === effective.version && review.effectiveMaterializationStateSha256 === EFFECTIVE_SHA, 'effective-state lineage mismatch')
ok(review.publicationPreflightVersion === preflight.version && review.publicationPreflightSha256 === PREFLIGHT_SHA, 'publication-preflight lineage mismatch')
ok(review.currentProductionOverlapReviewVersion === overlap.version && review.currentProductionOverlapReviewSha256 === OVERLAP_SHA, 'production-overlap lineage mismatch')
ok(review.proposedTaxonomyReviewVersion === taxonomy.version && review.proposedTaxonomyReviewSha256 === TAXONOMY_SHA, 'taxonomy-review lineage mismatch')
ok(review.status === 'REVIEWED_NON_AUTHORIZING_EDITORIAL_SCORING_READINESS', 'review status mismatch')
ok(review.reviewedAt === '2026-08-26T12:05:00+09:00', 'review timestamp mismatch')
ok(review.interpretation === 'CANDIDATE_UNIVERSE_FROZEN_DOES_NOT_MEAN_EDITORIAL_SCORING_EXECUTION_READY', 'review interpretation mismatch')

const policy = review.reviewPolicy || {}
ok(policy.scope === 'ALL_90_FROZEN_MANIFEST_EDITORIAL_COMPOSITE_ROWS_ARE_REVIEWED_AGAINST_CURRENT_MATERIALIZATION_STATE', 'review scope mismatch')
ok(policy.candidateFrozenOutcome === 'CANDIDATE_UNIVERSE_READY_BUT_SCORING_RUBRIC_DIMENSION_VALUES_AND_WEIGHTS_REMAIN_UNASSIGNED', 'candidate-frozen outcome mismatch')
ok(policy.candidateBlockedOutcome === 'BLOCKED_CANDIDATE_GAP_REMAINS_BLOCKED', 'candidate-blocked outcome mismatch')
ok(policy.dimensionContractRule === 'MANIFEST_DIMENSION_NAMES_ARE_A_DECLARED_CONTRACT_ONLY_AND_MUST_NOT_BE_TREATED_AS_MEASURED_VALUES', 'dimension contract rule mismatch')
ok(policy.scoringExecutionRule === 'NO_EDITORIAL_ROW_MAY_BE_SCORED_WITHOUT_A_SEPARATELY_REVIEWED_RUBRIC_PER_DIMENSION_VALUES_AND_EXPLICIT_WEIGHTS', 'scoring execution rule mismatch')
ok(policy.subjectiveJudgmentRule === 'NO_HIDDEN_EDITORIAL_JUDGMENT_MAY_BE_INSERTED_AS_A_NUMERIC_VALUE_WITHOUT_REVIEWED_EVIDENCE_OR_AN_EXPLICIT_REVIEWED_RUBRIC', 'subjective judgment rule mismatch')
ok(policy.candidateGapRule === 'A_BLOCKED_CANDIDATE_UNIVERSE_CANNOT_BE_PARTIALLY_SCORED_OR_COMPLETED_BY_INFERENCE', 'candidate gap rule mismatch')
ok(policy.scoringAuthorizationGranted === false && policy.weightAssignmentAuthorized === false && policy.dimensionValueMaterializationAuthorized === false, 'review policy must not authorize scoring execution')

const expectedWaveReviews = [
  { wave: 1, editorialRows: 25, candidateFrozenScoringUnassignedRows: 25, blockedCandidateGapRows: 0, scoringExecutionReadyRows: 0 },
  { wave: 2, editorialRows: 20, candidateFrozenScoringUnassignedRows: 16, blockedCandidateGapRows: 4, scoringExecutionReadyRows: 0 },
  { wave: 3, editorialRows: 23, candidateFrozenScoringUnassignedRows: 23, blockedCandidateGapRows: 0, scoringExecutionReadyRows: 0 },
  { wave: 4, editorialRows: 22, candidateFrozenScoringUnassignedRows: 12, blockedCandidateGapRows: 10, scoringExecutionReadyRows: 0 },
]
ok(JSON.stringify(review.waveReviews) === JSON.stringify(expectedWaveReviews), 'wave review summary mismatch')
const expectedSummary = {
  reviewedEditorialRows: 90,
  candidateFrozenScoringUnassignedRows: 76,
  blockedCandidateGapRows: 14,
  manifestRowsWithDeclaredCompositeDimensions: 90,
  rowsWithReviewedDimensionValueMatrix: 0,
  rowsWithReviewedWeights: 0,
  rowsWithMaterializedEditorialEntries: 0,
  scoringExecutionReadyRows: 0,
  fabricatedScores: 0,
  fabricatedWeights: 0,
  candidateGapOverrides: 0,
}
ok(JSON.stringify(review.reviewSummary) === JSON.stringify(expectedSummary), 'editorial scoring review summary mismatch')
ok(review.gateDisposition === 'EDITORIAL_SCORING_REVIEW_CLOSED_AS_READINESS_REVIEW_WITH_ZERO_EXECUTION_READY_ROWS', 'gate disposition mismatch')
ok(review.immediateNextGate === 'EDITORIAL_SCORING_RUBRIC_AND_DIMENSION_EVIDENCE_AUTHORIZATION', 'immediate next gate mismatch')
ok(review.preflightQueueAfterSuccessfulScoringExecution === 'COMMUNITY_VOTE_BOOTSTRAP_WITHOUT_FABRICATION', 'preflight queue handoff mismatch')
ok(Object.values(review.authorityBoundary || {}).every((value) => value === false), 'editorial scoring review must remain non-authorizing')
ok(!page.includes('editorial-scoring-review.json'), 'public ranking page must not consume editorial scoring review evidence')
ok(pkg.scripts?.['verify:content-corpus-200-editorial-scoring-review'] === 'node scripts/verify-content-corpus-200-editorial-scoring-review.mjs', 'package script wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-editorial-scoring-review'), 'CI must run editorial scoring review verifier')

const observedSha = jsonSha(review)
console.log(JSON.stringify({
  version: review.version,
  manifestSha256: MANIFEST_SHA,
  evidenceSha256: observedSha,
  editorialRows: manifestEditorials.length,
  candidateFrozenScoringUnassignedRows: frozenEditorials.length,
  blockedCandidateGapRows: blockedEditorials.length,
  scoringExecutionReadyRows: review.reviewSummary.scoringExecutionReadyRows,
  nextGate: review.immediateNextGate,
}, null, 2))
ok(observedSha === EXPECTED, `unsealed editorial scoring review evidence SHA: observed ${observedSha}; expected ${EXPECTED}`)
console.log('CONTENT-CORPUS-200 editorial scoring review verification passed')
