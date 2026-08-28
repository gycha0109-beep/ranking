import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  evidence: p('content/corpus-200/editorial-rubric-candidate-evidence-collection-wave-1.json'),
  matrix: p('content/corpus-200/editorial-rubric-candidate-evidence-matrix-wave-1.json'),
  rubricDefinition: p('content/corpus-200/editorial-explicit-rubric-definition-wave-1.json'),
  registry: p('content/corpus-200/editorial-dimension-contract-registry-and-evidence-plan.json'),
  wave1: p('content/corpus-200/materialization/wave-1.json'),
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
const MATRIX_SHA = '82630125086df98a032b054757f9c65dfdc5bca38ea5eee8adcb78b1219e7c43'
const MATRIX_CELL_REGISTRY_SHA = '5bab536257d321fce99514e1bccd084ade12664aa5012b639fa3f7f00f00763f'
const RUBRIC_DEFINITION_SHA = 'f25542a31dbf157f2195b9a5d7ba7f08ce6a19085cf9f584cec7c11813f3dd04'
const REGISTRY_SHA = 'c0e71b22456b805bfa351eb53f92f121cb6f9d23df1518c5f55ff2b33a1e11c7'
const WAVE1_SHA = '7e0c2b11cf9f6f5b4468d3ab112a2fa31d5ace2a55ef4bca0713771647562f6c'
const EXPECTED = '200cecadd7ebc7eb57c79fc0895683a2af444d072630ac280851d31fd199a066'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 editorial rubric candidate evidence collection wave 1 verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files).flat()) ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)

const evidence = readJson(files.evidence)
const matrix = readJson(files.matrix)
const rubricDefinition = readJson(files.rubricDefinition)
const registry = readJson(files.registry)
const wave1 = readJson(files.wave1)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(matrix) === MATRIX_SHA, 'sealed candidate evidence matrix mutated')
ok(matrix.manifestSha256 === MANIFEST_SHA, 'matrix manifest lineage mismatch')
ok(matrix.matrixDerivation?.cellStatus === 'EVIDENCE_REQUIRED_NOT_MATERIALIZED', 'upstream matrix cells must remain evidence-pending')
ok(matrix.scope?.candidateSlotCells === 934, 'upstream matrix must retain 934 cells')
ok(matrix.scope?.cellsWithCandidateSpecificRubricEvidence === 0, 'upstream matrix must retain zero collected evidence cells')
ok(matrix.nextGate === 'EDITORIAL_RUBRIC_CANDIDATE_EVIDENCE_COLLECTION_WAVE_1', 'matrix must hand off to this gate')
ok(matrix.evidenceBoundary?.candidateEligibilitySnapshotCanSatisfyRubricEvidenceByItself === false, 'eligibility provenance must remain separate from rubric evidence')
ok(matrix.evidenceBoundary?.factValueCanBeReusedAsRubricEvidenceWithoutExactReviewedBinding === false, 'FACT proxy reuse must remain forbidden')
ok(matrix.evidenceBoundary?.modelOnlyJudgmentAllowed === false, 'model-only judgment must remain forbidden')

ok(jsonSha(rubricDefinition) === RUBRIC_DEFINITION_SHA, 'sealed rubric definition mutated')
ok(rubricDefinition.rubricTemplate?.requiredOutcomeEvidence === 'CANDIDATE_SPECIFIC_REVIEWED_EVIDENCE_REFERENCES_PLUS_A_SHORT_DIMENSION_SPECIFIC_RATIONALE', 'rubric evidence requirement changed')
ok(rubricDefinition.rubricTemplate?.counterevidenceRule === 'MATERIAL_COUNTEREVIDENCE_MUST_BE_RETAINED_AND_CANNOT_BE_CHERRY_PICKED_AWAY', 'counterevidence rule changed')
ok(rubricDefinition.rubricTemplate?.crossDimensionProxyRule === 'FORBIDDEN', 'cross-dimension proxy rule changed')
ok(rubricDefinition.rubricTemplate?.missingEvidenceImputationRule === 'FORBIDDEN', 'missing evidence imputation rule changed')
ok(rubricDefinition.rubricTemplate?.modelOnlyJudgmentRule === 'FORBIDDEN', 'model-only judgment rule changed')
ok(rubricDefinition.outcomeBoundary?.candidateOutcomeCount === 0, 'candidate outcomes must remain zero')
ok(rubricDefinition.outcomeBoundary?.numericDimensionValueCount === 0, 'numeric rubric values must remain zero')

ok(jsonSha(registry) === REGISTRY_SHA, 'sealed dimension registry mutated')
ok(jsonSha(wave1) === WAVE1_SHA, 'sealed Wave 1 source materialization mutated')
ok(wave1.manifestSha256 === MANIFEST_SHA, 'Wave 1 manifest lineage mismatch')
ok(Array.isArray(wave1.sourceSnapshots) && wave1.sourceSnapshots.length === 15, 'Wave 1 must retain 15 source snapshots')

const forbiddenSnapshotFields = ['itemKey', 'candidateKey', 'candidateLabel', 'slotId', 'manifestId', 'dimensionName', 'observation', 'rubricEvidence', 'rubricEvidenceReferences', 'counterevidence']
for (const snapshot of wave1.sourceSnapshots) {
  for (const key of forbiddenSnapshotFields) ok(!(key in snapshot), `${snapshot.id} source snapshot metadata must not contain candidate-specific rubric evidence field ${key}`)
}

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
ok(jsonSha(canonicalPayload) === MANIFEST_SHA, 'frozen manifest canonical payload mutated')
const rowById = new Map(rows.map((row) => [row.manifestId, row]))

const sourceNames = new Set(registry.registryDerivation?.sourceMeasurableExactDimensionNames || [])
const mixedNames = new Set(registry.registryDerivation?.mixedEvidenceAndRubricExactDimensionNames || [])
const derivedNames = new Set(registry.registryDerivation?.deterministicDerivedExactDimensionNames || [])
function evidenceClassFor(name) {
  if (sourceNames.has(name)) return 'SOURCE_MEASURABLE'
  if (mixedNames.has(name)) return 'MIXED_EVIDENCE_AND_RUBRIC'
  if (derivedNames.has(name)) return 'DETERMINISTIC_DERIVED'
  return 'EXPLICIT_EDITORIAL_RUBRIC'
}

const expectedWaveFamilies = ['steam-mainstream', 'korean-box-office', 'netflix-titles', 'smartphones', 'kbo-clubs']
ok(JSON.stringify((wave1.families || []).map((family) => family.familyId)) === JSON.stringify(expectedWaveFamilies), 'Wave 1 family set/order changed')
const snapshotIds = new Set(wave1.sourceSnapshots.map((snapshot) => snapshot.id))
const matrixCells = []
const derivedFamilyCollection = []
let editorialRows = 0
let explicitRubricSlots = 0
let candidateMemberships = 0
let eligibilitySnapshotReferences = 0
let directValueFactEntries = 0
let derivedInputFactEntries = 0

for (const family of wave1.families || []) {
  ok(family.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', `${family.familyId} candidate universe must remain frozen/source-backed`)
  const candidates = family.candidateUniverse?.items || []
  ok(candidates.length > 0, `${family.familyId} candidates must remain non-empty`)
  ok(new Set(candidates.map((candidate) => candidate.itemKey)).size === candidates.length, `${family.familyId} candidate item keys must remain unique`)
  for (const candidate of candidates) {
    ok(JSON.stringify(Object.keys(candidate).sort()) === JSON.stringify(['itemKey', 'label']), `${family.familyId}:${candidate.itemKey} candidate universe item must remain identity-only without rubric evidence`)
  }
  const candidateSourceIds = family.candidateUniverse?.sourceSnapshotIds || []
  eligibilitySnapshotReferences += candidateSourceIds.length
  ok(candidateSourceIds.every((id) => snapshotIds.has(id)), `${family.familyId} candidate universe must reference known source snapshots`)
  candidateMemberships += candidates.length

  let familyRubricSlots = 0
  for (const ranking of family.rankings || []) {
    if (ranking.kind === 'FACT' && Array.isArray(ranking.entries)) {
      for (const entry of ranking.entries) {
        const hasDirectValue = Number.isFinite(entry.value)
        const inputValues = entry.inputs && typeof entry.inputs === 'object' ? Object.values(entry.inputs) : []
        const hasDerivedInputs = inputValues.length > 0 && inputValues.every((value) => Number.isFinite(value))
        ok(hasDirectValue || hasDerivedInputs, `${ranking.manifestId}:${entry.itemKey} FACT entry must retain either a finite direct value or finite deterministic inputs`)
        if (hasDirectValue) directValueFactEntries += 1
        else derivedInputFactEntries += 1
      }
    }
    if (ranking.kind !== 'EDITORIAL_COMPOSITE') continue
    editorialRows += 1
    ok(ranking.materializationStatus === 'CANDIDATES_FROZEN_SCORING_UNASSIGNED', `${ranking.manifestId} must remain scoring-unassigned`)
    for (const forbidden of ['entries', 'candidateEvidence', 'rubricEvidence', 'rubricOutcomes', 'dimensionValues', 'weights', 'scores']) {
      ok(!(forbidden in ranking), `${ranking.manifestId} must not contain ${forbidden}`)
    }
    const row = rowById.get(ranking.manifestId)
    ok(row?.contentType === 'EDITORIAL_COMPOSITE', `${ranking.manifestId} must resolve to editorial manifest row`)
    row.compositeDimensions.forEach((dimension, dimensionIndex) => {
      if (evidenceClassFor(dimension.name) !== 'EXPLICIT_EDITORIAL_RUBRIC') return
      explicitRubricSlots += 1
      familyRubricSlots += 1
      const slotId = `${ranking.manifestId}:${dimensionIndex}:${dimension.name}`
      for (const candidate of candidates) {
        matrixCells.push({
          cellId: `${slotId}::${family.familyId}:${candidate.itemKey}`,
          slotId,
          manifestId: ranking.manifestId,
          familyId: family.familyId,
          dimensionIndex,
          dimensionName: dimension.name,
          itemKey: candidate.itemKey,
          label: candidate.label,
          eligibilitySourceSnapshotIds: [...candidateSourceIds],
          evidenceStatus: 'EVIDENCE_REQUIRED_NOT_MATERIALIZED',
        })
      }
    })
  }

  derivedFamilyCollection.push({
    familyId: family.familyId,
    explicitRubricSlots: familyRubricSlots,
    frozenCandidates: candidates.length,
    candidateSlotCells: familyRubricSlots * candidates.length,
    eligibilitySnapshotReferences: candidateSourceIds.length,
    collectedCells: 0,
    sourceAcquisitionRequiredCells: familyRubricSlots * candidates.length,
  })
}

ok(editorialRows === 25, `Wave 1 must retain 25 editorial rows, got ${editorialRows}`)
ok(explicitRubricSlots === 89, `Wave 1 must retain 89 explicit rubric slots, got ${explicitRubricSlots}`)
ok(candidateMemberships === 53, `Wave 1 must retain 53 candidate memberships, got ${candidateMemberships}`)
ok(matrixCells.length === 934, `Wave 1 must derive 934 matrix cells, got ${matrixCells.length}`)
ok(eligibilitySnapshotReferences === 14, `Wave 1 must retain 14 candidate-universe eligibility snapshot references, got ${eligibilitySnapshotReferences}`)
ok(directValueFactEntries + derivedInputFactEntries > 0, 'Wave 1 must retain source-backed FACT observations while keeping them separate from rubric evidence')
ok(jsonSha(matrixCells) === MATRIX_CELL_REGISTRY_SHA, 'derived matrix cell registry changed')

const expectedFamilyCollection = [
  { familyId: 'steam-mainstream', explicitRubricSlots: 18, frozenCandidates: 5, candidateSlotCells: 90, eligibilitySnapshotReferences: 1, collectedCells: 0, sourceAcquisitionRequiredCells: 90 },
  { familyId: 'korean-box-office', explicitRubricSlots: 19, frozenCandidates: 10, candidateSlotCells: 190, eligibilitySnapshotReferences: 1, collectedCells: 0, sourceAcquisitionRequiredCells: 190 },
  { familyId: 'netflix-titles', explicitRubricSlots: 17, frozenCandidates: 20, candidateSlotCells: 340, eligibilitySnapshotReferences: 2, collectedCells: 0, sourceAcquisitionRequiredCells: 340 },
  { familyId: 'smartphones', explicitRubricSlots: 18, frozenCandidates: 8, candidateSlotCells: 144, eligibilitySnapshotReferences: 7, collectedCells: 0, sourceAcquisitionRequiredCells: 144 },
  { familyId: 'kbo-clubs', explicitRubricSlots: 17, frozenCandidates: 10, candidateSlotCells: 170, eligibilitySnapshotReferences: 3, collectedCells: 0, sourceAcquisitionRequiredCells: 170 },
]
ok(JSON.stringify(derivedFamilyCollection) === JSON.stringify(expectedFamilyCollection), `derived family collection changed: ${JSON.stringify(derivedFamilyCollection)}`)

ok(evidence.version === 'content-corpus-200-editorial-rubric-candidate-evidence-collection-wave-1-v1', 'evidence version mismatch')
ok(evidence.manifestVersion === manifest.manifestVersion && evidence.manifestSha256 === MANIFEST_SHA, 'evidence manifest lineage mismatch')
ok(evidence.candidateEvidenceMatrixVersion === matrix.version && evidence.candidateEvidenceMatrixSha256 === MATRIX_SHA, 'matrix lineage mismatch')
ok(evidence.matrixCellRegistrySha256 === MATRIX_CELL_REGISTRY_SHA, 'matrix cell registry lineage mismatch')
ok(evidence.rubricDefinitionVersion === rubricDefinition.version && evidence.rubricDefinitionSha256 === RUBRIC_DEFINITION_SHA, 'rubric definition lineage mismatch')
ok(evidence.candidateMaterializationWaveVersion === wave1.version && evidence.candidateMaterializationWaveSha256 === WAVE1_SHA, 'Wave 1 lineage mismatch')
ok(evidence.status === 'COLLECTION_REVIEW_COMPLETED_ZERO_EXISTING_CANDIDATE_SPECIFIC_RUBRIC_EVIDENCE', 'collection status mismatch')
ok(evidence.observedAt === '2026-08-28T09:47:00+09:00', 'collection timestamp mismatch')
ok(JSON.stringify(evidence.scope) === JSON.stringify({
  waveFamilies: 5,
  waveEditorialRows: 25,
  explicitRubricSlots: 89,
  familyScopedCandidateMemberships: 53,
  candidateSlotCells: 934,
  waveSourceSnapshots: 15,
  candidateUniverseEligibilitySnapshotReferences: 14,
  candidateSpecificRubricEvidenceRecordsFound: 0,
  collectedCells: 0,
  sourceAcquisitionRequiredCells: 934,
  candidateRubricOutcomesAuthored: 0,
  numericDimensionValuesAuthored: 0,
  weightsAuthored: 0,
  compositeScoresAuthored: 0,
  editorialOrderingsAuthored: 0,
}), 'collection scope mismatch')

const review = evidence.existingSourceReview || {}
ok(review.reviewedSurface === 'SEALED_WAVE_1_SOURCE_SNAPSHOTS_CANDIDATE_UNIVERSES_AND_FACT_ENTRIES', 'reviewed source surface mismatch')
ok(review.sourceSnapshotSchemaContainsCandidateSpecificRubricEvidenceRecords === false, 'source snapshots must not be promoted into rubric evidence')
ok(review.candidateUniverseItemsContainRubricEvidenceRecords === false, 'candidate universe items must remain identity-only')
ok(review.editorialMaterializationRowsContainRubricEvidenceRecords === false, 'editorial materialization rows must retain zero rubric evidence')
ok(review.factEntriesContainNumericCandidateObservations === true, 'FACT observations must remain acknowledged')
ok(review.factEntriesCanSatisfyExplicitRubricCellsWithoutExactReviewedBinding === false, 'FACT cross-dimension proxy reuse must remain forbidden')
ok(review.candidateEligibilitySnapshotsCanSatisfyRubricCellsByThemselves === false, 'eligibility provenance cannot satisfy rubric cells')
ok(review.sourceSnapshotMetadataCanBeTreatedAsCandidateSpecificObservation === false, 'source metadata cannot become candidate-specific observation')
ok(review.chartPresenceOrRankCanBeTreatedAsSubjectiveRubricSupport === false, 'chart presence/rank cannot become subjective support')
ok(review.collectionResult === 'NO_EXISTING_FROZEN_RECORD_SATISFIES_THE_CANDIDATE_SPECIFIC_RUBRIC_EVIDENCE_CONTRACT', 'collection result mismatch')

const contract = evidence.futureEvidenceRecordContract || {}
ok(contract.recordIdentity === 'EXACT_DERIVED_CELL_ID', 'future evidence record identity mismatch')
ok(contract.requiredCandidateBinding === 'familyId + itemKey + exact frozen label', 'future candidate binding mismatch')
ok(contract.requiredSlotBinding === 'manifestId + dimensionIndex + exactDimensionName', 'future slot binding mismatch')
ok(contract.requiredEvidenceReferences === 'ONE_OR_MORE_REVIEWED_CANDIDATE_SPECIFIC_SOURCE_REFERENCES_WITH_EXACT_URL_OR_FROZEN_SNAPSHOT_ID_AND_REFERENCE_PERIOD', 'future evidence reference requirement mismatch')
ok(contract.requiredObservation === 'SHORT_DIMENSION_SPECIFIC_OBSERVATION_DIRECTLY_SUPPORTED_BY_THE_REFERENCED_SOURCE', 'future observation requirement mismatch')
ok(contract.counterevidencePolicy === 'MATERIAL_COUNTEREVIDENCE_MUST_BE_RETAINED_WHEN_FOUND', 'future counterevidence policy mismatch')
for (const key of ['sourceMetadataOnlyRecordAllowed', 'eligibilityOnlyRecordAllowed', 'crossDimensionProxyAllowed', 'crossCandidateInferenceAllowed', 'missingEvidenceImputationAllowed', 'modelOnlyObservationAllowed', 'ordinalOutcomeAtCollectionGateAllowed', 'numericDimensionValueAtCollectionGateAllowed']) {
  ok(contract[key] === false, `${key} must remain false`)
}
ok(JSON.stringify(evidence.familyCollection) === JSON.stringify(expectedFamilyCollection), 'family collection evidence mismatch')
ok(JSON.stringify(evidence.blockingReasons) === JSON.stringify([
  'NO_CANDIDATE_SPECIFIC_RUBRIC_EVIDENCE_RECORDS_EXIST_IN_THE_SEALED_WAVE_1_SOURCE_MATERIAL',
  'ELIGIBILITY_PROVENANCE_CANNOT_BE_PROMOTED_TO_SUBJECTIVE_RUBRIC_EVIDENCE',
  'FACT_VALUES_CANNOT_BE_REUSED_AS_CROSS_DIMENSION_RUBRIC_PROXIES',
  'SOURCE_SNAPSHOT_METADATA_IS_NOT_A_CANDIDATE_SPECIFIC_DIMENSION_OBSERVATION',
]), 'blocking reasons mismatch')

const summary = evidence.reviewSummary || {}
ok(summary.all934CellsReviewedForExistingFrozenEvidenceAvailability === true, 'all 934 cells must be reviewed for existing evidence availability')
ok(summary.existingFrozenEvidenceCollectableCells === 0, 'existing frozen collectable cells must remain zero')
ok(summary.sourceAcquisitionRequiredCells === 934, 'all 934 cells must require source acquisition')
ok(summary.candidateRubricOutcomesMaterialized === 0, 'candidate outcomes must remain zero')
ok(summary.numericDimensionValuesMaterialized === 0, 'numeric dimension values must remain zero')
ok(summary.weightsMaterialized === 0, 'weights must remain zero')
ok(summary.compositeScoringExecuted === false, 'composite scoring must remain unexecuted')
ok(summary.editorialOrderingMaterialized === false, 'editorial ordering must remain unmaterialized')
ok(summary.scoringExecutionReadyRows === 0, 'scoring-ready rows must remain zero')
ok(summary.newExternalSourceClaimsAuthored === 0, 'this gate must author zero external source claims')
for (const forbidden of ['evidenceRecords', 'candidateEvidence', 'rubricOutcomes', 'candidateOutcomes', 'dimensionValues', 'weights', 'compositeScores', 'editorialOrderings']) {
  ok(!(forbidden in evidence), `collection evidence must not contain top-level ${forbidden}`)
}
ok(evidence.gateDisposition === 'WAVE_1_RUBRIC_EVIDENCE_COLLECTION_REVIEWED_WITH_ZERO_OF_934_CELLS_COLLECTABLE_FROM_EXISTING_FROZEN_SOURCE_MATERIAL', 'gate disposition mismatch')
ok(evidence.nextGate === 'EDITORIAL_RUBRIC_EVIDENCE_SOURCE_ACQUISITION_PLAN_WAVE_1', 'next gate mismatch')
ok(Object.values(evidence.authorityBoundary || {}).every((value) => value === false), 'all execution/public authority must remain disabled')

ok(!page.includes('editorial-rubric-candidate-evidence-collection-wave-1.json'), 'public ranking page must not consume collection review evidence')
ok(pkg.scripts?.['verify:content-corpus-200-editorial-rubric-candidate-evidence-collection-wave-1'] === 'node scripts/verify-content-corpus-200-editorial-rubric-candidate-evidence-collection-wave-1.mjs', 'package script wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-editorial-rubric-candidate-evidence-collection-wave-1'), 'CI must run collection verifier')

const observedSha = jsonSha(evidence)
console.log(JSON.stringify({
  version: evidence.version,
  manifestSha256: MANIFEST_SHA,
  candidateEvidenceMatrixSha256: MATRIX_SHA,
  matrixCellRegistrySha256: jsonSha(matrixCells),
  evidenceSha256: observedSha,
  waveFamilies: expectedWaveFamilies.length,
  waveEditorialRows: editorialRows,
  explicitRubricSlots,
  familyScopedCandidateMemberships: candidateMemberships,
  candidateSlotCells: matrixCells.length,
  waveSourceSnapshots: wave1.sourceSnapshots.length,
  candidateUniverseEligibilitySnapshotReferences: eligibilitySnapshotReferences,
  directValueFactEntriesObservedButNotPromoted: directValueFactEntries,
  derivedInputFactEntriesObservedButNotPromoted: derivedInputFactEntries,
  candidateSpecificRubricEvidenceRecordsFound: 0,
  collectedCells: 0,
  sourceAcquisitionRequiredCells: matrixCells.length,
  nextGate: evidence.nextGate,
}, null, 2))
ok(observedSha === EXPECTED, `unsealed editorial rubric candidate evidence collection wave 1 SHA: observed ${observedSha}; expected ${EXPECTED}`)
console.log('CONTENT-CORPUS-200 editorial rubric candidate evidence collection wave 1 verification passed')
