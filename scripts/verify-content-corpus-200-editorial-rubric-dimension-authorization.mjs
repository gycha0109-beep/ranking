import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  authorization: p('content/corpus-200/editorial-rubric-dimension-authorization.json'),
  review: p('content/corpus-200/editorial-scoring-review.json'),
  schema: p('content/corpus-200/schema.ts'),
  manifest: p('content/corpus-200/manifest.ts'),
  families: [
    p('content/corpus-200/families-01-games-media.ts'),
    p('content/corpus-200/families-02-music-tech-sports.ts'),
    p('content/corpus-200/families-03-mobility-travel-food.ts'),
    p('content/corpus-200/families-04-beauty-subscriptions-consumer.ts'),
  ],
  page: p('src/app/rankings/[rankingSlug]/page.tsx'),
  pkg: p('package.json'),
  ci: p('.github/workflows/ci.yml'),
}

const MANIFEST_SHA = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const REVIEW_SHA = '107fdb5d026333b55b21f3ce5cb8fafb754c557e5691f7cb3f3f6b9b8e2bc496'
const EXPECTED = 'e923fc17e84030f79d402ccd1188e940bd4482ca4547a0ea6f81202bc360afe0'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 editorial rubric/dimension authorization verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files).flat()) ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)

const authorization = readJson(files.authorization)
const review = readJson(files.review)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(review) === REVIEW_SHA, 'sealed editorial scoring review evidence mutated')
ok(review.version === 'content-corpus-200-editorial-scoring-review-v1', 'editorial scoring review version mismatch')
ok(review.manifestSha256 === MANIFEST_SHA, 'editorial scoring review manifest lineage mismatch')
ok(review.reviewSummary?.reviewedEditorialRows === 90, 'editorial scoring review must retain 90 reviewed editorial rows')
ok(review.reviewSummary?.candidateFrozenScoringUnassignedRows === 76, 'editorial scoring review must retain 76 candidate-frozen rows')
ok(review.reviewSummary?.blockedCandidateGapRows === 14, 'editorial scoring review must retain 14 candidate-gap rows')
ok(review.reviewSummary?.scoringExecutionReadyRows === 0, 'editorial scoring review must retain zero scoring-ready rows')
ok(review.immediateNextGate === 'EDITORIAL_SCORING_RUBRIC_AND_DIMENSION_EVIDENCE_AUTHORIZATION', 'previous review must hand off to this authorization gate')
ok(Object.values(review.authorityBoundary || {}).every((value) => value === false), 'previous review authority boundary must remain disabled')

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
  manifestJs = manifestJs.replace(`from './${path.basename(file, '.ts')}'`, `from '${familyUrls[index]}'`)
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

const editorialRows = rows.filter((row) => row.contentType === 'EDITORIAL_COMPOSITE')
ok(rows.length === 200 && editorialRows.length === 90, 'manifest must remain 200 rows with exactly 90 editorials')
ok(new Set(editorialRows.map((row) => row.manifestId)).size === 90, 'editorial manifest IDs must remain unique')
let declaredDimensionSlots = 0
const uniqueDimensionNames = new Set()
for (const row of editorialRows) {
  ok(typeof row.editorialQuestion === 'string' && row.editorialQuestion.trim().length > 0, `${row.manifestId} must retain editorialQuestion`)
  ok(Array.isArray(row.compositeDimensions) && row.compositeDimensions.length > 0, `${row.manifestId} must retain composite dimensions`)
  ok(row.compositeFormula === 'WEIGHTS_NOT_ASSIGNED_PRE_MATERIALIZATION', `${row.manifestId} formula must remain unassigned`)
  ok(row.compositeDimensions.every((dimension) => dimension.weightStatus === 'UNASSIGNED_PRE_MATERIALIZATION'), `${row.manifestId} weights must remain unassigned`)
  ok(row.publicationStatus === 'DRAFT_ONLY' && row.algorithmEvaluationStatus === 'NOT_RUN', `${row.manifestId} must remain draft and unevaluated`)
  declaredDimensionSlots += row.compositeDimensions.length
  row.compositeDimensions.forEach((dimension) => uniqueDimensionNames.add(dimension.name))
}
ok(declaredDimensionSlots > 90, 'editorial rows must retain multi-dimension contracts')
ok(uniqueDimensionNames.size > 0, 'editorial dimension vocabulary must remain non-empty')

ok(authorization.version === 'content-corpus-200-editorial-rubric-dimension-authorization-v1', 'authorization version mismatch')
ok(authorization.manifestVersion === manifest.manifestVersion && authorization.manifestSha256 === MANIFEST_SHA, 'authorization manifest lineage mismatch')
ok(authorization.editorialScoringReviewVersion === review.version && authorization.editorialScoringReviewSha256 === REVIEW_SHA, 'authorization review lineage mismatch')
ok(authorization.status === 'AUTHORIZED_PREPARATION_ONLY_NO_EDITORIAL_SCORING_EXECUTION', 'authorization status mismatch')
ok(authorization.authorizedAt === '2026-08-26T12:25:00+09:00', 'authorization timestamp mismatch')
ok(JSON.stringify(authorization.scope) === JSON.stringify({
  editorialRows: 90,
  candidateFrozenRowsEligibleForPreparation: 76,
  candidateGapRowsExcludedFromPreparation: 14,
  scoringExecutionReadyRows: 0,
}), 'authorization scope mismatch')

const contract = authorization.dimensionEvidenceContract || {}
const expectedClasses = ['SOURCE_MEASURABLE', 'DETERMINISTIC_DERIVED', 'EXPLICIT_EDITORIAL_RUBRIC', 'MIXED_EVIDENCE_AND_RUBRIC']
ok(JSON.stringify(contract.allowedEvidenceClasses) === JSON.stringify(expectedClasses), 'allowed dimension evidence classes mismatch')
ok(contract.classificationRequiredPerDimension === true, 'every dimension must require evidence classification')
ok(contract.sourceMeasurableRule === 'VALUE_MUST_BIND_TO_A_REVIEWED_SOURCE_SNAPSHOT_OR_EXACT_OFFICIAL_PRODUCT_OR_STATISTICAL_SURFACE', 'source measurable rule mismatch')
ok(contract.deterministicDerivedRule === 'DERIVATION_MUST_USE_DECLARED_INPUTS_AND_A_REPRODUCIBLE_FORMULA_WITH_NO_HIDDEN_JUDGMENT', 'deterministic derived rule mismatch')
ok(contract.explicitEditorialRubricRule === 'SUBJECTIVE_DIMENSIONS_REQUIRE_EXPLICIT_ANCHORED_CRITERIA_BEFORE_ANY_PER_CANDIDATE_VALUE_IS_AUTHORED', 'editorial rubric rule mismatch')
ok(contract.mixedEvidenceAndRubricRule === 'MIXED_DIMENSIONS_MUST_SEPARATE_OBSERVED_INPUTS_FROM_EDITORIAL_JUDGMENT_AND_DOCUMENT_THE_JOIN_RULE', 'mixed evidence/rubric rule mismatch')
ok(contract.normalizationRule === 'CROSS_CANDIDATE_VALUES_MUST_SHARE_SCOPE_UNIT_REFERENCE_PERIOD_AND_DIRECTION_OR_DECLARE_A_REVIEWED_NORMALIZATION', 'normalization rule mismatch')
ok(contract.missingEvidenceRule === 'A_REQUIRED_DIMENSION_WITHOUT_A_REVIEWED_VALUE_OR_RUBRIC_OUTCOME_BLOCKS_THE_ROW_FROM_SCORING_EXECUTION', 'missing evidence rule mismatch')
ok(contract.candidateGapRule === 'BLOCKED_CANDIDATE_GAP_ROWS_REMAIN_EXCLUDED_UNTIL_THEIR_CANDIDATE_UNIVERSE_IS_SEPARATELY_RECOVERED', 'candidate gap rule mismatch')

const prep = authorization.authorizedPreparation || {}
ok(prep.dimensionContractClassification === true, 'dimension contract classification must be authorized')
ok(prep.rubricSpecificationDrafting === true, 'rubric specification drafting must be authorized')
ok(prep.objectiveSourceEvidenceCollection === true, 'objective source evidence collection must be authorized')
ok(prep.deterministicDerivedMetricDefinition === true, 'deterministic metric definition must be authorized')
ok(prep.normalizationPlanDrafting === true, 'normalization planning must be authorized')
ok(prep.rowLevelEvidenceMatrixDrafting === true, 'row-level evidence matrix drafting must be authorized')
ok(Object.keys(prep).length === 6, 'authorized preparation surface must remain bounded')

const prohibited = authorization.stillProhibited || {}
for (const [key, value] of Object.entries(prohibited)) ok(value === true, `${key} must remain explicitly prohibited`)
ok(Object.keys(prohibited).length === 10, 'prohibition surface must remain explicit and bounded')

const weightBoundary = authorization.weightBoundary || {}
ok(weightBoundary.weightsRemainUnassigned === true, 'weights must remain unassigned')
ok(weightBoundary.weightDraftingAuthorizedAtThisGate === false, 'weight drafting must remain unauthorized')
ok(weightBoundary.weightReviewMayBeginOnlyAfterDimensionEvidenceMatrixReview === true, 'weight review sequencing mismatch')
ok(weightBoundary.compositeFormulaRemainsUnassigned === true, 'composite formula must remain unassigned')

ok(authorization.gateDisposition === 'EDITORIAL_SCORING_RUBRIC_AND_DIMENSION_EVIDENCE_AUTHORIZATION_GRANTED_FOR_PREPARATION_ONLY', 'gate disposition mismatch')
ok(authorization.nextGate === 'EDITORIAL_DIMENSION_CONTRACT_REGISTRY_AND_EVIDENCE_PLAN', 'next gate mismatch')
ok(Object.values(authorization.authorityBoundary || {}).every((value) => value === false), 'execution/public authority must remain disabled')
ok(!page.includes('editorial-rubric-dimension-authorization.json'), 'public ranking page must not consume authorization evidence')
ok(pkg.scripts?.['verify:content-corpus-200-editorial-rubric-dimension-authorization'] === 'node scripts/verify-content-corpus-200-editorial-rubric-dimension-authorization.mjs', 'package script wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-editorial-rubric-dimension-authorization'), 'CI must run rubric/dimension authorization verifier')

const observedSha = jsonSha(authorization)
console.log(JSON.stringify({
  version: authorization.version,
  manifestSha256: MANIFEST_SHA,
  evidenceSha256: observedSha,
  editorialRows: editorialRows.length,
  declaredDimensionSlots,
  uniqueDimensionNames: uniqueDimensionNames.size,
  preparationEligibleRows: authorization.scope.candidateFrozenRowsEligibleForPreparation,
  excludedCandidateGapRows: authorization.scope.candidateGapRowsExcludedFromPreparation,
  nextGate: authorization.nextGate,
}, null, 2))
ok(observedSha === EXPECTED, `unsealed editorial rubric/dimension authorization evidence SHA: observed ${observedSha}; expected ${EXPECTED}`)
console.log('CONTENT-CORPUS-200 editorial rubric/dimension authorization verification passed')
