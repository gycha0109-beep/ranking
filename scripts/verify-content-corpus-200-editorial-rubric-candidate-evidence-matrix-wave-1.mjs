import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  evidence: p('content/corpus-200/editorial-rubric-candidate-evidence-matrix-wave-1.json'),
  authorization: p('content/corpus-200/editorial-rubric-dimension-authorization.json'),
  registry: p('content/corpus-200/editorial-dimension-contract-registry-and-evidence-plan.json'),
  rubricDefinition: p('content/corpus-200/editorial-explicit-rubric-definition-wave-1.json'),
  wave1: p('content/corpus-200/materialization/wave-1.json'),
  normalizationDirection: p('content/corpus-200/editorial-non-rubric-normalization-direction-contract-review-wave-1.json'),
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
const AUTHORIZATION_SHA = 'e923fc17e84030f79d402ccd1188e940bd4482ca4547a0ea6f81202bc360afe0'
const REGISTRY_SHA = 'c0e71b22456b805bfa351eb53f92f121cb6f9d23df1518c5f55ff2b33a1e11c7'
const RUBRIC_DEFINITION_SHA = 'f25542a31dbf157f2195b9a5d7ba7f08ce6a19085cf9f584cec7c11813f3dd04'
const WAVE1_SHA = '7e0c2b11cf9f6f5b4468d3ab112a2fa31d5ace2a55ef4bca0713771647562f6c'
const NORMALIZATION_DIRECTION_SHA = '6ce05d88bad2a5468be5ff548e298f20507803addbad10410bf2b70378793fb4'
const EXPECTED = 'UNSEALED_EDITORIAL_RUBRIC_CANDIDATE_EVIDENCE_MATRIX_WAVE_1'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 editorial rubric candidate evidence matrix wave 1 verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files).flat()) ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)

const evidence = readJson(files.evidence)
const authorization = readJson(files.authorization)
const registry = readJson(files.registry)
const rubricDefinition = readJson(files.rubricDefinition)
const wave1 = readJson(files.wave1)
const normalizationDirection = readJson(files.normalizationDirection)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(authorization) === AUTHORIZATION_SHA, 'sealed rubric/dimension authorization mutated')
ok(authorization.authorizedPreparation?.rowLevelEvidenceMatrixDrafting === true, 'row-level evidence matrix drafting must remain authorized')
ok(authorization.stillProhibited?.hiddenLlmJudgmentAsNumericEvidence === true, 'hidden LLM judgment must remain prohibited')
ok(authorization.stillProhibited?.unreviewedSubjectiveDimensionValues === true, 'unreviewed subjective values must remain prohibited')
ok(authorization.stillProhibited?.automaticWeightAssignment === true, 'automatic weight assignment must remain prohibited')
ok(authorization.stillProhibited?.editorialCompositeScoreExecution === true, 'composite scoring must remain prohibited')
ok(authorization.weightBoundary?.weightsRemainUnassigned === true, 'weights must remain unassigned')

ok(jsonSha(registry) === REGISTRY_SHA, 'sealed dimension registry mutated')
ok(registry.manifestSha256 === MANIFEST_SHA, 'dimension registry manifest lineage mismatch')
ok(registry.evidencePlanByClass?.EXPLICIT_EDITORIAL_RUBRIC?.perCandidateRubricOutcomeAtThisGate === false, 'registry must retain no per-candidate rubric outcomes')
ok(registry.evidencePlanByClass?.EXPLICIT_EDITORIAL_RUBRIC?.numericValueAuthoringAtThisGate === false, 'registry must retain no rubric numeric value authoring')
ok(registry.rowEvidencePlan?.partialScoringForbidden === true, 'partial scoring must remain forbidden')
ok(registry.rowEvidencePlan?.missingDimensionImputationForbidden === true, 'missing dimension imputation must remain forbidden')

ok(jsonSha(rubricDefinition) === RUBRIC_DEFINITION_SHA, 'sealed Wave 1 rubric definition mutated')
ok(rubricDefinition.manifestSha256 === MANIFEST_SHA, 'rubric definition manifest lineage mismatch')
ok(rubricDefinition.dimensionRegistrySha256 === REGISTRY_SHA, 'rubric definition registry lineage mismatch')
ok(rubricDefinition.scope?.explicitRubricSlotsDefined === 89, 'rubric definition must retain exactly 89 explicit rubric slots')
ok(rubricDefinition.outcomeBoundary?.candidateOutcomeAuthoringAuthorized === false, 'candidate rubric outcome authoring must remain unauthorized')
ok(rubricDefinition.outcomeBoundary?.candidateOutcomeCount === 0, 'candidate rubric outcomes must remain zero')
ok(rubricDefinition.outcomeBoundary?.numericDimensionValueCount === 0, 'numeric rubric dimension values must remain zero')
ok(rubricDefinition.outcomeBoundary?.weightAssignmentExecuted === false, 'weight assignment must remain unexecuted')
ok(rubricDefinition.outcomeBoundary?.compositeScoringExecuted === false, 'composite scoring must remain unexecuted')
ok(rubricDefinition.outcomeBoundary?.editorialOrderingMaterialized === false, 'editorial ordering must remain unmaterialized')
ok(rubricDefinition.rubricTemplate?.requiredOutcomeEvidence === 'CANDIDATE_SPECIFIC_REVIEWED_EVIDENCE_REFERENCES_PLUS_A_SHORT_DIMENSION_SPECIFIC_RATIONALE', 'rubric outcome evidence requirement changed')
ok(rubricDefinition.rubricTemplate?.insufficientEvidenceDisposition === 'BLOCK_OUTCOME_NO_DEFAULT_OR_MIDPOINT_VALUE', 'insufficient evidence disposition changed')
ok(rubricDefinition.rubricTemplate?.counterevidenceRule === 'MATERIAL_COUNTEREVIDENCE_MUST_BE_RETAINED_AND_CANNOT_BE_CHERRY_PICKED_AWAY', 'counterevidence rule changed')
ok(rubricDefinition.rubricTemplate?.crossDimensionProxyRule === 'FORBIDDEN', 'cross-dimension proxy rule changed')
ok(rubricDefinition.rubricTemplate?.missingEvidenceImputationRule === 'FORBIDDEN', 'missing evidence imputation rule changed')
ok(rubricDefinition.rubricTemplate?.modelOnlyJudgmentRule === 'FORBIDDEN', 'model-only judgment rule changed')

ok(jsonSha(wave1) === WAVE1_SHA, 'sealed Wave 1 candidate materialization mutated')
ok(wave1.manifestSha256 === MANIFEST_SHA, 'Wave 1 manifest lineage mismatch')
ok(jsonSha(normalizationDirection) === NORMALIZATION_DIRECTION_SHA, 'sealed normalization/direction review mutated')
ok(normalizationDirection.nextGate === 'EDITORIAL_RUBRIC_CANDIDATE_EVIDENCE_MATRIX_WAVE_1', 'normalization/direction review must hand off to this gate')
ok(normalizationDirection.scope?.editorialDimensionValuesMaterialized === 0, 'upstream editorial values must remain zero')
ok(normalizationDirection.scope?.weightsAuthored === 0, 'upstream weights must remain zero')

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
const rowById = new Map(rows.map((row) => [row.manifestId, row]))

const expectedWaveFamilies = ['steam-mainstream', 'korean-box-office', 'netflix-titles', 'smartphones', 'kbo-clubs']
ok(JSON.stringify((wave1.families || []).map((family) => family.familyId)) === JSON.stringify(expectedWaveFamilies), 'Wave 1 family set/order changed')

const sourceNames = new Set(registry.registryDerivation?.sourceMeasurableExactDimensionNames || [])
const mixedNames = new Set(registry.registryDerivation?.mixedEvidenceAndRubricExactDimensionNames || [])
const derivedNames = new Set(registry.registryDerivation?.deterministicDerivedExactDimensionNames || [])
function evidenceClassFor(name) {
  if (sourceNames.has(name)) return 'SOURCE_MEASURABLE'
  if (mixedNames.has(name)) return 'MIXED_EVIDENCE_AND_RUBRIC'
  if (derivedNames.has(name)) return 'DETERMINISTIC_DERIVED'
  return 'EXPLICIT_EDITORIAL_RUBRIC'
}

const derivedFamilyMatrix = []
const matrixCells = []
let editorialRows = 0
let explicitRubricSlots = 0
let candidateMemberships = 0
for (const family of wave1.families || []) {
  ok(family.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', `${family.familyId} candidate universe must remain frozen/source-backed`)
  const candidates = family.candidateUniverse?.items || []
  ok(candidates.length > 0, `${family.familyId} candidate universe must be non-empty`)
  ok(new Set(candidates.map((candidate) => candidate.itemKey)).size === candidates.length, `${family.familyId} candidate item keys must be unique`)
  ok(candidates.every((candidate) => typeof candidate.itemKey === 'string' && candidate.itemKey.length > 0 && typeof candidate.label === 'string' && candidate.label.length > 0), `${family.familyId} candidate identities/labels must be complete`)
  candidateMemberships += candidates.length

  const familyRubricSlots = []
  for (const ranking of family.rankings || []) {
    if (ranking.kind !== 'EDITORIAL_COMPOSITE') continue
    editorialRows += 1
    ok(ranking.materializationStatus === 'CANDIDATES_FROZEN_SCORING_UNASSIGNED', `${ranking.manifestId} must remain scoring-unassigned`)
    ok(ranking.candidateUniverseRef === family.familyId, `${ranking.manifestId} candidate universe ref changed`)
    const row = rowById.get(ranking.manifestId)
    ok(row?.contentType === 'EDITORIAL_COMPOSITE', `${ranking.manifestId} must resolve to editorial manifest row`)
    ok(row.compositeFormula === 'WEIGHTS_NOT_ASSIGNED_PRE_MATERIALIZATION', `${ranking.manifestId} formula must remain unassigned`)
    ok(row.compositeDimensions.every((dimension) => dimension.weightStatus === 'UNASSIGNED_PRE_MATERIALIZATION'), `${ranking.manifestId} weights must remain unassigned`)
    row.compositeDimensions.forEach((dimension, dimensionIndex) => {
      if (evidenceClassFor(dimension.name) !== 'EXPLICIT_EDITORIAL_RUBRIC') return
      const slot = {
        slotId: `${ranking.manifestId}:${dimensionIndex}:${dimension.name}`,
        manifestId: ranking.manifestId,
        familyId: family.familyId,
        dimensionIndex,
        dimensionName: dimension.name,
      }
      familyRubricSlots.push(slot)
      explicitRubricSlots += 1
      for (const candidate of candidates) {
        matrixCells.push({
          cellId: `${slot.slotId}::${family.familyId}:${candidate.itemKey}`,
          slotId: slot.slotId,
          manifestId: slot.manifestId,
          familyId: family.familyId,
          dimensionIndex,
          dimensionName: dimension.name,
          itemKey: candidate.itemKey,
          label: candidate.label,
          eligibilitySourceSnapshotIds: [...(family.candidateUniverse.sourceSnapshotIds || [])],
          evidenceStatus: 'EVIDENCE_REQUIRED_NOT_MATERIALIZED',
        })
      }
    })
  }

  derivedFamilyMatrix.push({
    familyId: family.familyId,
    frozenCandidates: candidates.length,
    explicitRubricSlots: familyRubricSlots.length,
    candidateSlotCells: familyRubricSlots.length * candidates.length,
    candidateUniverseSourceSnapshots: (family.candidateUniverse.sourceSnapshotIds || []).length,
    cellsWithCandidateSpecificRubricEvidence: 0,
    cellsRequiringRubricEvidence: familyRubricSlots.length * candidates.length,
  })
}

ok(editorialRows === 25, `Wave 1 must retain 25 editorial rows, got ${editorialRows}`)
ok(explicitRubricSlots === 89, `Wave 1 must retain 89 explicit rubric slots, got ${explicitRubricSlots}`)
ok(candidateMemberships === 53, `Wave 1 must retain 53 family-scoped candidate memberships, got ${candidateMemberships}`)
ok(matrixCells.length === 934, `Wave 1 must derive 934 candidate-slot cells, got ${matrixCells.length}`)
ok(new Set(matrixCells.map((cell) => cell.cellId)).size === 934, 'derived candidate-slot cell IDs must be unique')
ok(matrixCells.every((cell) => cell.evidenceStatus === 'EVIDENCE_REQUIRED_NOT_MATERIALIZED'), 'every derived cell must remain evidence-pending')
ok(matrixCells.every((cell) => Array.isArray(cell.eligibilitySourceSnapshotIds) && cell.eligibilitySourceSnapshotIds.length > 0), 'every derived cell must retain eligibility provenance')
for (const cell of matrixCells) {
  for (const forbidden of ['ordinal', 'outcome', 'score', 'value', 'weight', 'rationale', 'rubricEvidenceReferences', 'counterevidence']) {
    ok(!(forbidden in cell), `${cell.cellId} must not contain authored ${forbidden}`)
  }
}

const expectedFamilyMatrix = [
  { familyId: 'steam-mainstream', frozenCandidates: 5, explicitRubricSlots: 18, candidateSlotCells: 90, candidateUniverseSourceSnapshots: 1, cellsWithCandidateSpecificRubricEvidence: 0, cellsRequiringRubricEvidence: 90 },
  { familyId: 'korean-box-office', frozenCandidates: 10, explicitRubricSlots: 19, candidateSlotCells: 190, candidateUniverseSourceSnapshots: 1, cellsWithCandidateSpecificRubricEvidence: 0, cellsRequiringRubricEvidence: 190 },
  { familyId: 'netflix-titles', frozenCandidates: 20, explicitRubricSlots: 17, candidateSlotCells: 340, candidateUniverseSourceSnapshots: 2, cellsWithCandidateSpecificRubricEvidence: 0, cellsRequiringRubricEvidence: 340 },
  { familyId: 'smartphones', frozenCandidates: 8, explicitRubricSlots: 18, candidateSlotCells: 144, candidateUniverseSourceSnapshots: 7, cellsWithCandidateSpecificRubricEvidence: 0, cellsRequiringRubricEvidence: 144 },
  { familyId: 'kbo-clubs', frozenCandidates: 10, explicitRubricSlots: 17, candidateSlotCells: 170, candidateUniverseSourceSnapshots: 3, cellsWithCandidateSpecificRubricEvidence: 0, cellsRequiringRubricEvidence: 170 },
]
ok(JSON.stringify(derivedFamilyMatrix) === JSON.stringify(expectedFamilyMatrix), `derived family matrix changed: ${JSON.stringify(derivedFamilyMatrix)}`)
const matrixCellRegistrySha256 = jsonSha(matrixCells)

ok(evidence.version === 'content-corpus-200-editorial-rubric-candidate-evidence-matrix-wave-1-v1', 'evidence version mismatch')
ok(evidence.manifestVersion === manifest.manifestVersion && evidence.manifestSha256 === MANIFEST_SHA, 'evidence manifest lineage mismatch')
ok(evidence.rubricDefinitionVersion === rubricDefinition.version && evidence.rubricDefinitionSha256 === RUBRIC_DEFINITION_SHA, 'rubric definition lineage mismatch')
ok(evidence.candidateMaterializationWaveVersion === wave1.version && evidence.candidateMaterializationWaveSha256 === WAVE1_SHA, 'candidate Wave 1 lineage mismatch')
ok(evidence.normalizationDirectionReviewVersion === normalizationDirection.version && evidence.normalizationDirectionReviewSha256 === NORMALIZATION_DIRECTION_SHA, 'normalization/direction lineage mismatch')
ok(evidence.status === 'DERIVED_EXPLICIT_RUBRIC_CANDIDATE_EVIDENCE_REQUIREMENT_MATRIX_NO_OUTCOMES', 'evidence status mismatch')
ok(evidence.observedAt === '2026-08-28T09:22:00+09:00', 'evidence observation timestamp mismatch')
ok(JSON.stringify(evidence.scope) === JSON.stringify({
  waveFamilies: 5,
  waveEditorialRows: 25,
  explicitRubricSlots: 89,
  familyScopedCandidateMemberships: 53,
  candidateSlotCells: 934,
  cellsWithCandidateSpecificRubricEvidence: 0,
  cellsRequiringRubricEvidence: 934,
  candidateRubricOutcomesAuthored: 0,
  numericDimensionValuesAuthored: 0,
  weightsAuthored: 0,
  compositeScoresAuthored: 0,
  editorialOrderingsAuthored: 0,
}), 'evidence scope mismatch')

const derivation = evidence.matrixDerivation || {}
ok(derivation.mode === 'CARTESIAN_PRODUCT_OF_EACH_EXPLICIT_RUBRIC_SLOT_WITH_ITS_FROZEN_FAMILY_CANDIDATE_UNIVERSE', 'matrix derivation mode mismatch')
ok(derivation.slotIdentity === 'manifestId + dimensionIndex + exactDimensionName', 'matrix slot identity mismatch')
ok(derivation.candidateIdentity === 'familyId + itemKey', 'matrix candidate identity mismatch')
ok(derivation.candidateLabels === 'EXACT_FROZEN_WAVE_1_CANDIDATE_LABELS', 'candidate label authority mismatch')
ok(derivation.candidateEligibilityProvenance === 'SEALED_WAVE_1_CANDIDATE_UNIVERSE_SOURCE_SNAPSHOTS_ONLY', 'eligibility provenance contract mismatch')
ok(derivation.eligibilityProvenanceIsRubricEvidence === false, 'eligibility provenance must not become rubric evidence')
ok(derivation.cellStatus === 'EVIDENCE_REQUIRED_NOT_MATERIALIZED', 'cell status mismatch')
ok(derivation.cellMaterializationMode === 'DERIVED_AND_HASHED_BY_VERIFIER_NOT_DUPLICATED_AS_934_STATIC_ROWS', 'cell materialization mode mismatch')
ok(derivation.sameItemKeyAcrossFamiliesRemainsSeparateCandidateIdentity === true, 'cross-family candidate identities must remain separate')
ok(derivation.sameNamedDimensionsAcrossEditorialRowsRemainSeparateSlotContracts === true, 'same-named rubric slots across rows must remain separate')
ok(JSON.stringify(evidence.familyMatrix) === JSON.stringify(expectedFamilyMatrix), 'evidence family matrix mismatch')

const boundary = evidence.evidenceBoundary || {}
ok(boundary.candidateEligibilitySnapshotCanSatisfyRubricEvidenceByItself === false, 'eligibility snapshots must not satisfy rubric evidence')
ok(boundary.factValueCanBeReusedAsRubricEvidenceWithoutExactReviewedBinding === false, 'FACT values must not become rubric evidence without exact reviewed binding')
ok(boundary.chartRankCanBeReusedAsSubjectiveRubricEvidence === false, 'chart ranks must not become subjective rubric evidence')
ok(boundary.crossDimensionProxyEvidenceAllowed === false, 'cross-dimension proxy evidence must remain forbidden')
ok(boundary.crossCandidateInferenceAllowed === false, 'cross-candidate inference must remain forbidden')
ok(boundary.missingEvidenceImputationAllowed === false, 'missing evidence imputation must remain forbidden')
ok(boundary.modelOnlyJudgmentAllowed === false, 'model-only judgment must remain forbidden')
ok(boundary.futureCellEvidenceRequirement === 'CANDIDATE_SPECIFIC_REVIEWED_EVIDENCE_REFERENCE_PLUS_DIMENSION_SPECIFIC_OBSERVATION_AND_MATERIAL_COUNTEREVIDENCE_IF_PRESENT', 'future cell evidence requirement mismatch')
ok(boundary.futureOutcomeRequirement === 'SEALED_CELL_EVIDENCE_PLUS_SHORT_DIMENSION_SPECIFIC_RATIONALE_BEFORE_ANY_ORDINAL_OUTCOME', 'future outcome requirement mismatch')

const summary = evidence.reviewSummary || {}
ok(summary.rubricContractsRemainDefinitionOnly === true, 'rubric contracts must remain definition-only')
ok(summary.candidateUniversesRemainFrozen === true, 'candidate universes must remain frozen')
ok(summary.eligibilityProvenanceSeparatedFromRubricEvidence === true, 'eligibility and rubric evidence must remain separated')
ok(summary.allCandidateSlotCellsEnumeratedByDeterministicDerivation === true, 'all cells must be deterministically derivable')
ok(summary.allCandidateSlotCellsCurrentlyEvidencePending === true, 'all cells must remain evidence-pending')
ok(summary.candidateRubricOutcomesMaterialized === 0, 'candidate rubric outcomes must remain zero')
ok(summary.numericDimensionValuesMaterialized === 0, 'numeric rubric values must remain zero')
ok(summary.weightsMaterialized === 0, 'weights must remain zero')
ok(summary.compositeScoringExecuted === false, 'composite scoring must remain unexecuted')
ok(summary.editorialOrderingMaterialized === false, 'editorial ordering must remain unmaterialized')
ok(summary.scoringExecutionReadyRows === 0, 'scoring-ready rows must remain zero')
for (const forbidden of ['cells', 'candidateOutcomes', 'rubricOutcomes', 'dimensionValues', 'weights', 'compositeScores', 'editorialOrderings']) {
  ok(!(forbidden in evidence), `evidence must not contain top-level ${forbidden}`)
}
ok(evidence.gateDisposition === 'WAVE_1_EXPLICIT_RUBRIC_CANDIDATE_EVIDENCE_REQUIREMENT_MATRIX_DERIVED_FOR_934_CELLS_WITH_ZERO_OUTCOMES', 'gate disposition mismatch')
ok(evidence.nextGate === 'EDITORIAL_RUBRIC_CANDIDATE_EVIDENCE_COLLECTION_WAVE_1', 'next gate mismatch')
ok(Object.values(evidence.authorityBoundary || {}).every((value) => value === false), 'all execution/public authority must remain disabled')

ok(!page.includes('editorial-rubric-candidate-evidence-matrix-wave-1.json'), 'public ranking page must not consume rubric candidate evidence matrix')
ok(pkg.scripts?.['verify:content-corpus-200-editorial-rubric-candidate-evidence-matrix-wave-1'] === 'node scripts/verify-content-corpus-200-editorial-rubric-candidate-evidence-matrix-wave-1.mjs', 'package script wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-editorial-rubric-candidate-evidence-matrix-wave-1'), 'CI must run rubric candidate evidence matrix verifier')

const observedSha = jsonSha(evidence)
console.log(JSON.stringify({
  version: evidence.version,
  manifestSha256: MANIFEST_SHA,
  evidenceSha256: observedSha,
  matrixCellRegistrySha256,
  waveFamilies: expectedWaveFamilies.length,
  waveEditorialRows: editorialRows,
  explicitRubricSlots,
  familyScopedCandidateMemberships: candidateMemberships,
  candidateSlotCells: matrixCells.length,
  cellsWithCandidateSpecificRubricEvidence: 0,
  cellsRequiringRubricEvidence: matrixCells.length,
  familyMatrix: derivedFamilyMatrix,
  candidateRubricOutcomesAuthored: evidence.scope.candidateRubricOutcomesAuthored,
  numericDimensionValuesAuthored: evidence.scope.numericDimensionValuesAuthored,
  weightsAuthored: evidence.scope.weightsAuthored,
  nextGate: evidence.nextGate,
}, null, 2))
ok(observedSha === EXPECTED, `unsealed editorial rubric candidate evidence matrix wave 1 SHA: observed ${observedSha}; expected ${EXPECTED}`)
console.log('CONTENT-CORPUS-200 editorial rubric candidate evidence matrix wave 1 verification passed')
