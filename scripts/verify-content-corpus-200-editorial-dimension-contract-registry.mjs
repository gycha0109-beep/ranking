import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  registry: p('content/corpus-200/editorial-dimension-contract-registry-and-evidence-plan.json'),
  authorization: p('content/corpus-200/editorial-rubric-dimension-authorization.json'),
  schema: p('content/corpus-200/schema.ts'),
  manifest: p('content/corpus-200/manifest.ts'),
  families: [
    p('content/corpus-200/families-01-games-media.ts'),
    p('content/corpus-200/families-02-music-tech-sports.ts'),
    p('content/corpus-200/families-03-mobility-travel-food.ts'),
    p('content/corpus-200/families-04-beauty-subscriptions-consumer.ts'),
  ],
  materialization: [
    p('content/corpus-200/materialization/wave-1.json'),
    p('content/corpus-200/materialization/wave-2.json'),
    p('content/corpus-200/materialization/wave-3.json'),
    p('content/corpus-200/materialization/wave-4-families-a.json'),
    p('content/corpus-200/materialization/wave-4-families-b.json'),
  ],
  page: p('src/app/rankings/[rankingSlug]/page.tsx'),
  pkg: p('package.json'),
  ci: p('.github/workflows/ci.yml'),
}

const MANIFEST_SHA = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'
const AUTHORIZATION_SHA = 'e923fc17e84030f79d402ccd1188e940bd4482ca4547a0ea6f81202bc360afe0'
const EXPECTED = 'UNSEALED_EDITORIAL_DIMENSION_CONTRACT_REGISTRY'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 editorial dimension contract registry verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files).flat()) ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)

const registry = readJson(files.registry)
const authorization = readJson(files.authorization)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(authorization) === AUTHORIZATION_SHA, 'sealed rubric/dimension authorization evidence mutated')
ok(authorization.version === 'content-corpus-200-editorial-rubric-dimension-authorization-v1', 'authorization version mismatch')
ok(authorization.manifestSha256 === MANIFEST_SHA, 'authorization manifest lineage mismatch')
ok(authorization.nextGate === 'EDITORIAL_DIMENSION_CONTRACT_REGISTRY_AND_EVIDENCE_PLAN', 'authorization must hand off to this registry gate')
ok(authorization.scope?.editorialRows === 90, 'authorization must retain 90 editorial rows')
ok(authorization.scope?.candidateFrozenRowsEligibleForPreparation === 76, 'authorization must retain 76 preparation-eligible rows')
ok(authorization.scope?.candidateGapRowsExcludedFromPreparation === 14, 'authorization must retain 14 candidate-gap rows')
ok(authorization.scope?.scoringExecutionReadyRows === 0, 'authorization must retain zero scoring-ready rows')
ok(authorization.weightBoundary?.weightsRemainUnassigned === true, 'authorization weights must remain unassigned')
ok(authorization.weightBoundary?.weightDraftingAuthorizedAtThisGate === false, 'authorization must not grant weight drafting')
ok(Object.values(authorization.authorityBoundary || {}).every((value) => value === false), 'authorization execution/public authority must remain disabled')

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
  ok(Array.isArray(row.compositeDimensions) && row.compositeDimensions.length > 0, `${row.manifestId} must retain composite dimensions`)
  ok(row.compositeFormula === 'WEIGHTS_NOT_ASSIGNED_PRE_MATERIALIZATION', `${row.manifestId} formula must remain unassigned`)
  ok(row.compositeDimensions.every((dimension) => dimension.weightStatus === 'UNASSIGNED_PRE_MATERIALIZATION'), `${row.manifestId} weights must remain unassigned`)
  ok(row.publicationStatus === 'DRAFT_ONLY' && row.algorithmEvaluationStatus === 'NOT_RUN', `${row.manifestId} must remain draft and unevaluated`)
  declaredDimensionSlots += row.compositeDimensions.length
  row.compositeDimensions.forEach((dimension) => uniqueDimensionNames.add(dimension.name))
}
ok(declaredDimensionSlots === 394, `declared editorial dimension slot count changed: ${declaredDimensionSlots}`)
ok(uniqueDimensionNames.size === 312, `unique editorial dimension name count changed: ${uniqueDimensionNames.size}`)

const materializedRankings = []
for (const file of files.materialization) {
  const data = readJson(file)
  for (const family of data.families || []) {
    for (const ranking of family.rankings || []) materializedRankings.push(ranking)
  }
}
const blockedEditorialIds = [...new Set(materializedRankings
  .filter((ranking) => ranking.kind === 'EDITORIAL_COMPOSITE' && ranking.materializationStatus === 'BLOCKED_CANDIDATE_GAP')
  .map((ranking) => ranking.manifestId))].sort()
const frozenEditorialIds = [...new Set(materializedRankings
  .filter((ranking) => ranking.kind === 'EDITORIAL_COMPOSITE' && ranking.materializationStatus === 'CANDIDATES_FROZEN_SCORING_UNASSIGNED')
  .map((ranking) => ranking.manifestId))].sort()
ok(blockedEditorialIds.length === 14, `materialization must retain 14 blocked editorial rows, got ${blockedEditorialIds.length}`)
ok(frozenEditorialIds.length === 76, `materialization must retain 76 candidate-frozen editorial rows, got ${frozenEditorialIds.length}`)
ok(new Set([...blockedEditorialIds, ...frozenEditorialIds]).size === 90, 'materialization editorial status partition must cover all 90 rows exactly once')

ok(registry.version === 'content-corpus-200-editorial-dimension-contract-registry-and-evidence-plan-v1', 'registry version mismatch')
ok(registry.manifestVersion === manifest.manifestVersion && registry.manifestSha256 === MANIFEST_SHA, 'registry manifest lineage mismatch')
ok(registry.authorizationVersion === authorization.version && registry.authorizationSha256 === AUTHORIZATION_SHA, 'registry authorization lineage mismatch')
ok(registry.status === 'REVIEWED_DIMENSION_CONTRACT_REGISTRY_AND_EVIDENCE_PLAN_NO_VALUES', 'registry status mismatch')
ok(registry.reviewedAt === '2026-08-26T12:49:00+09:00', 'registry timestamp mismatch')
ok(JSON.stringify(registry.scope) === JSON.stringify({
  editorialRows: 90,
  declaredDimensionSlots: 394,
  uniqueDimensionNames: 312,
  candidateFrozenRowsEligibleForEvidencePreparation: 76,
  candidateGapRowsExcludedFromEvidenceExecution: 14,
  materializedDimensionValues: 0,
  reviewedWeights: 0,
  scoringExecutionReadyRows: 0,
}), 'registry scope mismatch')

const derivation = registry.registryDerivation || {}
ok(derivation.mode === 'DERIVE_ONE_SLOT_RECORD_FOR_EVERY_FROZEN_MANIFEST_EDITORIAL_COMPOSITE_DIMENSION', 'registry derivation mode mismatch')
ok(derivation.slotIdentity === 'manifestId + dimensionIndex + exactDimensionName', 'slot identity mismatch')
ok(JSON.stringify(derivation.classificationPriority) === JSON.stringify([
  'BLOCKED_ROW_EXECUTION_EXCLUSION',
  'SOURCE_MEASURABLE_EXACT_NAME',
  'MIXED_EVIDENCE_AND_RUBRIC_EXACT_NAME',
  'DETERMINISTIC_DERIVED_EXACT_NAME',
  'DEFAULT_EXPLICIT_EDITORIAL_RUBRIC',
]), 'classification priority mismatch')
ok(derivation.defaultEvidenceClass === 'EXPLICIT_EDITORIAL_RUBRIC', 'ambiguous dimensions must default to explicit editorial rubric')
ok(derivation.defaultReason === 'CONSERVATIVE_NO_OBJECTIVE_MEASURABILITY_INFERRED_FROM_A_DIMENSION_LABEL', 'default classification reason mismatch')
ok(derivation.noTokenOrSubstringPromotion === true, 'token/substring evidence-class promotion must remain forbidden')
ok(derivation.noLlmSemanticPromotion === true, 'LLM semantic evidence-class promotion must remain forbidden')

const sourceNames = new Set(derivation.sourceMeasurableExactDimensionNames || [])
const mixedNames = new Set(derivation.mixedEvidenceAndRubricExactDimensionNames || [])
const derivedNames = new Set(derivation.deterministicDerivedExactDimensionNames || [])
ok(sourceNames.size === (derivation.sourceMeasurableExactDimensionNames || []).length, 'source-measurable exact-name registry must not contain duplicates')
ok(mixedNames.size === (derivation.mixedEvidenceAndRubricExactDimensionNames || []).length, 'mixed exact-name registry must not contain duplicates')
ok(derivedNames.size === (derivation.deterministicDerivedExactDimensionNames || []).length, 'derived exact-name registry must not contain duplicates')
for (const name of sourceNames) ok(uniqueDimensionNames.has(name), `source-measurable exact name is not a declared editorial dimension: ${name}`)
for (const name of mixedNames) ok(uniqueDimensionNames.has(name), `mixed exact name is not a declared editorial dimension: ${name}`)
for (const name of derivedNames) ok(uniqueDimensionNames.has(name), `derived exact name is not a declared editorial dimension: ${name}`)
for (const name of sourceNames) ok(!mixedNames.has(name) && !derivedNames.has(name), `evidence-class override overlap: ${name}`)
for (const name of mixedNames) ok(!derivedNames.has(name), `evidence-class override overlap: ${name}`)
ok(sourceNames.size > 0, 'registry must include at least one exact source-measurable dimension')
ok(mixedNames.size > 0, 'registry must include at least one exact mixed-evidence dimension')
ok(derivedNames.size === 0, 'no deterministic-derived editorial dimension may be promoted before a reviewed formula exists')

const declaredBlockedIds = [...(registry.candidateGapExclusions?.manifestIds || [])].sort()
ok(registry.candidateGapExclusions?.rule === 'BLOCKED_CANDIDATE_GAP_ROWS_REMAIN_IN_THE_REGISTRY_BUT_EVIDENCE_EXECUTION_IS_EXCLUDED', 'candidate-gap exclusion rule mismatch')
ok(JSON.stringify(declaredBlockedIds) === JSON.stringify(blockedEditorialIds), 'candidate-gap exclusion IDs must match materialization evidence exactly')

const blockedSet = new Set(blockedEditorialIds)
const classCounts = {
  SOURCE_MEASURABLE: 0,
  DETERMINISTIC_DERIVED: 0,
  EXPLICIT_EDITORIAL_RUBRIC: 0,
  MIXED_EVIDENCE_AND_RUBRIC: 0,
}
let eligibleSlotCount = 0
let excludedSlotCount = 0
const slotRegistry = []
for (const row of editorialRows) {
  row.compositeDimensions.forEach((dimension, dimensionIndex) => {
    let evidenceClass = 'EXPLICIT_EDITORIAL_RUBRIC'
    if (sourceNames.has(dimension.name)) evidenceClass = 'SOURCE_MEASURABLE'
    else if (mixedNames.has(dimension.name)) evidenceClass = 'MIXED_EVIDENCE_AND_RUBRIC'
    else if (derivedNames.has(dimension.name)) evidenceClass = 'DETERMINISTIC_DERIVED'
    classCounts[evidenceClass] += 1
    const executionStatus = blockedSet.has(row.manifestId)
      ? 'EXCLUDED_CANDIDATE_GAP'
      : 'PLAN_ONLY_DIMENSION_VALUES_NOT_MATERIALIZED'
    if (executionStatus === 'EXCLUDED_CANDIDATE_GAP') excludedSlotCount += 1
    else eligibleSlotCount += 1
    slotRegistry.push({ manifestId: row.manifestId, dimensionIndex, dimensionName: dimension.name, evidenceClass, executionStatus })
  })
}
ok(slotRegistry.length === 394, 'derived slot registry must contain all 394 dimension slots')
ok(eligibleSlotCount + excludedSlotCount === 394, 'eligible/excluded slot partition mismatch')
ok(classCounts.SOURCE_MEASURABLE > 0 && classCounts.EXPLICIT_EDITORIAL_RUBRIC > 0 && classCounts.MIXED_EVIDENCE_AND_RUBRIC > 0, 'derived registry must retain source, rubric, and mixed classes')
ok(classCounts.DETERMINISTIC_DERIVED === 0, 'derived class must remain empty until a formula is reviewed')

const plans = registry.evidencePlanByClass || {}
for (const evidenceClass of ['SOURCE_MEASURABLE', 'DETERMINISTIC_DERIVED', 'EXPLICIT_EDITORIAL_RUBRIC', 'MIXED_EVIDENCE_AND_RUBRIC']) {
  ok(plans[evidenceClass] && Array.isArray(plans[evidenceClass].requiredBeforeAnyValue) && plans[evidenceClass].requiredBeforeAnyValue.length > 0, `${evidenceClass} evidence plan missing`)
}
ok(plans.SOURCE_MEASURABLE.valueAuthoringAtThisGate === false && plans.SOURCE_MEASURABLE.normalizationAtThisGate === false, 'source values/normalization must remain unmaterialized')
ok(plans.DETERMINISTIC_DERIVED.valueAuthoringAtThisGate === false && plans.DETERMINISTIC_DERIVED.formulaAuthoringAtThisGate === false, 'derived values/formulas must remain unmaterialized')
ok(plans.EXPLICIT_EDITORIAL_RUBRIC.perCandidateRubricOutcomeAtThisGate === false && plans.EXPLICIT_EDITORIAL_RUBRIC.numericValueAuthoringAtThisGate === false, 'rubric outcomes/values must remain unmaterialized')
ok(plans.MIXED_EVIDENCE_AND_RUBRIC.perCandidateJoinedValueAtThisGate === false && plans.MIXED_EVIDENCE_AND_RUBRIC.numericValueAuthoringAtThisGate === false, 'mixed joined values must remain unmaterialized')

ok(registry.rowEvidencePlan?.candidateFrozenRowStatus === 'PLAN_ONLY_DIMENSION_VALUES_NOT_MATERIALIZED', 'candidate-frozen row evidence status mismatch')
ok(registry.rowEvidencePlan?.candidateGapRowStatus === 'EXCLUDED_CANDIDATE_GAP', 'candidate-gap row evidence status mismatch')
ok(registry.rowEvidencePlan?.allRequiredDimensionsMustResolveBeforeRowScoring === true, 'all dimensions must resolve before scoring')
ok(registry.rowEvidencePlan?.partialScoringForbidden === true, 'partial scoring must remain forbidden')
ok(registry.rowEvidencePlan?.missingDimensionImputationForbidden === true, 'missing dimension imputation must remain forbidden')
ok(registry.rowEvidencePlan?.crossRowWeightReuseByInferenceForbidden === true, 'cross-row inferred weight reuse must remain forbidden')

ok(registry.weightBoundary?.weightsRemainUnassigned === true, 'weights must remain unassigned')
ok(registry.weightBoundary?.weightDraftingAuthorized === false, 'weight drafting must remain unauthorized')
ok(registry.weightBoundary?.weightReviewAuthorized === false, 'weight review must remain unauthorized')
ok(registry.weightBoundary?.compositeFormulaRemainsUnassigned === true, 'composite formula must remain unassigned')
ok(registry.weightBoundary?.orderingMaterializationAuthorized === false, 'ordering materialization must remain unauthorized')
ok(registry.reviewSummary?.rubricDefinitionsMaterialized === 0, 'no rubric definitions may be materialized at this gate')
ok(registry.reviewSummary?.sourceDimensionValuesMaterialized === 0, 'no source dimension values may be materialized at this gate')
ok(registry.reviewSummary?.derivedDimensionValuesMaterialized === 0, 'no derived dimension values may be materialized at this gate')
ok(registry.reviewSummary?.mixedDimensionValuesMaterialized === 0, 'no mixed dimension values may be materialized at this gate')
ok(registry.reviewSummary?.fabricatedDimensionValues === 0 && registry.reviewSummary?.fabricatedWeights === 0, 'fabricated values/weights must remain zero')
ok(registry.gateDisposition === 'EDITORIAL_DIMENSION_CONTRACT_REGISTRY_AND_EVIDENCE_PLAN_REVIEWED_WITH_ZERO_DIMENSION_VALUES', 'gate disposition mismatch')
ok(registry.nextGate === 'EDITORIAL_DIMENSION_EVIDENCE_MATERIALIZATION_WAVE_1', 'next gate mismatch')
ok(Object.values(registry.authorityBoundary || {}).every((value) => value === false), 'registry execution/public authority must remain disabled')

ok(!page.includes('editorial-dimension-contract-registry-and-evidence-plan.json'), 'public ranking page must not consume registry evidence')
ok(pkg.scripts?.['verify:content-corpus-200-editorial-dimension-contract-registry'] === 'node scripts/verify-content-corpus-200-editorial-dimension-contract-registry.mjs', 'package script wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-editorial-dimension-contract-registry'), 'CI must run dimension contract registry verifier')

const observedSha = jsonSha(registry)
const slotRegistrySha = crypto.createHash('sha256').update(JSON.stringify(slotRegistry)).digest('hex')
console.log(JSON.stringify({
  version: registry.version,
  manifestSha256: MANIFEST_SHA,
  evidenceSha256: observedSha,
  slotRegistrySha256: slotRegistrySha,
  editorialRows: editorialRows.length,
  declaredDimensionSlots,
  uniqueDimensionNames: uniqueDimensionNames.size,
  preparationEligibleRows: frozenEditorialIds.length,
  excludedCandidateGapRows: blockedEditorialIds.length,
  eligibleSlotCount,
  excludedSlotCount,
  classCounts,
  nextGate: registry.nextGate,
}, null, 2))
ok(observedSha === EXPECTED, `unsealed editorial dimension contract registry evidence SHA: observed ${observedSha}; expected ${EXPECTED}`)
console.log('CONTENT-CORPUS-200 editorial dimension contract registry verification passed')
