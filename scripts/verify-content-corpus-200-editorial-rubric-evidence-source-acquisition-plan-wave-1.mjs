import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  evidence: p('content/corpus-200/editorial-rubric-evidence-source-acquisition-plan-wave-1.json'),
  collection: p('content/corpus-200/editorial-rubric-candidate-evidence-collection-wave-1.json'),
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
const COLLECTION_SHA = '200cecadd7ebc7eb57c79fc0895683a2af444d072630ac280851d31fd199a066'
const MATRIX_SHA = '82630125086df98a032b054757f9c65dfdc5bca38ea5eee8adcb78b1219e7c43'
const MATRIX_CELL_REGISTRY_SHA = '5bab536257d321fce99514e1bccd084ade12664aa5012b639fa3f7f00f00763f'
const RUBRIC_DEFINITION_SHA = 'f25542a31dbf157f2195b9a5d7ba7f08ce6a19085cf9f584cec7c11813f3dd04'
const REGISTRY_SHA = 'c0e71b22456b805bfa351eb53f92f121cb6f9d23df1518c5f55ff2b33a1e11c7'
const WAVE1_SHA = '7e0c2b11cf9f6f5b4468d3ab112a2fa31d5ace2a55ef4bca0713771647562f6c'
const EXPECTED = '80eb6a1602ce7fae0155aeb2f872f1ac281039d8ed3a6a7cdcdcc0e9fc96a28b'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 editorial rubric evidence source acquisition plan wave 1 verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files).flat()) ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)

const evidence = readJson(files.evidence)
const collection = readJson(files.collection)
const matrix = readJson(files.matrix)
const rubricDefinition = readJson(files.rubricDefinition)
const registry = readJson(files.registry)
const wave1 = readJson(files.wave1)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(collection) === COLLECTION_SHA, 'sealed collection review mutated')
ok(collection.nextGate === 'EDITORIAL_RUBRIC_EVIDENCE_SOURCE_ACQUISITION_PLAN_WAVE_1', 'collection review must hand off to this gate')
ok(collection.scope?.candidateSlotCells === 934, 'collection review must retain 934 cells')
ok(collection.scope?.collectedCells === 0, 'collection review must retain zero collected cells')
ok(collection.scope?.sourceAcquisitionRequiredCells === 934, 'collection review must require acquisition for all 934 cells')
ok(jsonSha(matrix) === MATRIX_SHA, 'sealed candidate evidence matrix mutated')
ok(matrix.matrixCellRegistrySha256 === undefined || matrix.scope?.candidateSlotCells === 934, 'candidate evidence matrix lineage changed')
ok(jsonSha(rubricDefinition) === RUBRIC_DEFINITION_SHA, 'sealed rubric definition mutated')
ok(jsonSha(registry) === REGISTRY_SHA, 'sealed dimension registry mutated')
ok(jsonSha(wave1) === WAVE1_SHA, 'sealed Wave 1 source materialization mutated')

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

const derivedCells = []
const derivedFamilyStats = []
let editorialRows = 0
let explicitRubricSlots = 0
let candidateMemberships = 0
for (const family of wave1.families || []) {
  const candidates = family.candidateUniverse?.items || []
  candidateMemberships += candidates.length
  let familyRubricSlots = 0
  for (const ranking of family.rankings || []) {
    if (ranking.kind !== 'EDITORIAL_COMPOSITE') continue
    editorialRows += 1
    const row = rowById.get(ranking.manifestId)
    ok(row?.contentType === 'EDITORIAL_COMPOSITE', `${ranking.manifestId} must resolve to editorial manifest row`)
    row.compositeDimensions.forEach((dimension, dimensionIndex) => {
      if (evidenceClassFor(dimension.name) !== 'EXPLICIT_EDITORIAL_RUBRIC') return
      explicitRubricSlots += 1
      familyRubricSlots += 1
      const slotId = `${ranking.manifestId}:${dimensionIndex}:${dimension.name}`
      for (const candidate of candidates) {
        derivedCells.push({
          cellId: `${slotId}::${family.familyId}:${candidate.itemKey}`,
          slotId,
          manifestId: ranking.manifestId,
          familyId: family.familyId,
          dimensionIndex,
          dimensionName: dimension.name,
          itemKey: candidate.itemKey,
          label: candidate.label,
          eligibilitySourceSnapshotIds: [...(family.candidateUniverse?.sourceSnapshotIds || [])],
          evidenceStatus: 'EVIDENCE_REQUIRED_NOT_MATERIALIZED',
        })
      }
    })
  }
  derivedFamilyStats.push({
    familyId: family.familyId,
    frozenCandidates: candidates.length,
    explicitRubricSlots: familyRubricSlots,
    candidateSourcePortfolios: candidates.length,
    cellEvidenceObligations: familyRubricSlots * candidates.length,
  })
}

ok(editorialRows === 25, `Wave 1 must retain 25 editorial rows, got ${editorialRows}`)
ok(explicitRubricSlots === 89, `Wave 1 must retain 89 explicit rubric slots, got ${explicitRubricSlots}`)
ok(candidateMemberships === 53, `Wave 1 must retain 53 candidate memberships, got ${candidateMemberships}`)
ok(derivedCells.length === 934, `Wave 1 must derive 934 candidate-slot cells, got ${derivedCells.length}`)
ok(jsonSha(derivedCells) === MATRIX_CELL_REGISTRY_SHA, 'derived matrix cell registry changed')

ok(evidence.version === 'content-corpus-200-editorial-rubric-evidence-source-acquisition-plan-wave-1-v1', 'plan version mismatch')
ok(evidence.manifestVersion === manifest.manifestVersion && evidence.manifestSha256 === MANIFEST_SHA, 'manifest lineage mismatch')
ok(evidence.candidateEvidenceMatrixVersion === matrix.version && evidence.candidateEvidenceMatrixSha256 === MATRIX_SHA, 'matrix lineage mismatch')
ok(evidence.matrixCellRegistrySha256 === MATRIX_CELL_REGISTRY_SHA, 'matrix cell registry lineage mismatch')
ok(evidence.rubricDefinitionVersion === rubricDefinition.version && evidence.rubricDefinitionSha256 === RUBRIC_DEFINITION_SHA, 'rubric definition lineage mismatch')
ok(evidence.collectionReviewVersion === collection.version && evidence.collectionReviewSha256 === COLLECTION_SHA, 'collection review lineage mismatch')
ok(evidence.status === 'SOURCE_ACQUISITION_PLAN_DEFINED_NO_EXTERNAL_SOURCE_ACQUISITION_EXECUTED', 'plan status mismatch')
ok(evidence.plannedAt === '2026-08-28T10:56:00+09:00', 'plan timestamp mismatch')

ok(JSON.stringify(evidence.scope) === JSON.stringify({
  waveFamilies: 5,
  waveEditorialRows: 25,
  explicitRubricSlots: 89,
  familyScopedCandidateMemberships: 53,
  candidateSourcePortfoliosPlanned: 53,
  candidateSlotCells: 934,
  cellEvidenceObligations: 934,
  existingCollectedCells: 0,
  externalSourcesAcquiredAtThisGate: 0,
  candidateEvidenceRecordsAuthoredAtThisGate: 0,
  candidateRubricOutcomesAuthored: 0,
  numericDimensionValuesAuthored: 0,
  weightsAuthored: 0,
  compositeScoresAuthored: 0,
  editorialOrderingsAuthored: 0,
}), 'plan scope mismatch')

const model = evidence.acquisitionModel || {}
ok(model.candidatePortfolioIdentity === 'familyId + itemKey + exact frozen label', 'candidate portfolio identity mismatch')
ok(model.slotIdentity === 'manifestId + dimensionIndex + exactDimensionName', 'slot identity mismatch')
ok(model.portfolioCount === 53 && model.slotContractCount === 89 && model.cellObligationCount === 934, 'acquisition model counts mismatch')
ok(model.sameSourceMaySupportMultipleCells === true, 'direct multi-cell source reuse must remain possible')
ok(model.sameSourceReuseCondition === 'EACH_REUSED_BINDING_MUST_HAVE_SEPARATE_DIRECT_SUPPORT_FOR_THE_EXACT_SLOT_AND_A_SEPARATE_CELL_OBSERVATION', 'same-source reuse condition mismatch')
for (const key of ['sourceDiscoveryAloneSatisfiesCell', 'candidatePortfolioCompletenessImpliesCellCompleteness', 'crossDimensionProxyAllowed', 'crossCandidateInferenceAllowed', 'missingEvidenceImputationAllowed', 'modelOnlyObservationAllowed']) {
  ok(model[key] === false, `${key} must remain false`)
}

const expectedSourceClasses = [
  'OFFICIAL_CANDIDATE_RECORD',
  'OFFICIAL_STATISTICS_OR_EVENT_RECORD',
  'INDEPENDENT_MEASUREMENT_OR_TEST',
  'INDEPENDENT_PROFESSIONAL_REVIEW',
  'REPUTABLE_REPORTING_OR_INTERVIEW',
]
ok(JSON.stringify((evidence.sourceClassPolicy || []).map((entry) => entry.sourceClass)) === JSON.stringify(expectedSourceClasses), 'source class policy changed')
for (const sourceClass of evidence.sourceClassPolicy || []) {
  ok(sourceClass.candidateIdentityRequired === true, `${sourceClass.sourceClass} must require exact candidate identity`)
  ok(sourceClass.referencePeriodOrVersionRequiredWhenMaterial === true, `${sourceClass.sourceClass} must preserve material period/version context`)
}
ok(evidence.sourceClassPolicy[0].subjectiveQualityClaimSatisfiedBySourceClassAlone === false, 'official candidate record cannot alone establish subjective quality')
ok(evidence.sourceClassPolicy[1].subjectiveQualityClaimSatisfiedBySourceClassAlone === false, 'official statistics cannot alone establish subjective quality')
ok(evidence.sourceClassPolicy[2].subjectiveQualityClaimSatisfiedBySourceClassAlone === false, 'measurement class cannot alone establish subjective quality')

const inadmissible = new Set(evidence.inadmissibleEvidence || [])
for (const required of [
  'SEARCH_RESULT_SNIPPET_WITHOUT_REVIEWED_SOURCE_SURFACE',
  'GENERIC_FAMILY_LEVEL_ARTICLE_WITHOUT_EXACT_CANDIDATE_BINDING',
  'UNSOURCED_SUMMARY_OR_MODEL_GENERATED_JUDGMENT',
  'CANDIDATE_ELIGIBILITY_OR_CHART_PRESENCE_USED_AS_SUBJECTIVE_QUALITY_EVIDENCE',
  'FACT_VALUE_OR_DETERMINISTIC_INPUT_REUSED_AS_AN_UNREVIEWED_CROSS_DIMENSION_PROXY',
  'SINGLE_UNATTRIBUTED_OR_UNREVIEWED_USER_ANECDOTE',
  'SOURCE_METADATA_WITHOUT_A_DIMENSION_SPECIFIC_CANDIDATE_OBSERVATION',
]) ok(inadmissible.has(required), `missing inadmissible evidence rule ${required}`)

const sourceRecord = evidence.requiredSourceRecordContract || {}
ok(sourceRecord.sourceRecordIdentity === 'STABLE_PLAN_LOCAL_SOURCE_ID', 'source record identity mismatch')
ok(sourceRecord.sourceRecordByItselfIsRubricEvidence === false, 'source record discovery cannot equal rubric evidence')
ok(sourceRecord.sourceRecordMustBeReviewedBeforeCellBinding === true, 'source record review must precede binding')
ok(sourceRecord.accessOrLicenseUnclearDisposition === 'BLOCK_BINDING_PENDING_REVIEW', 'access/license uncertainty must block binding')
for (const field of ['sourceRecordId', 'familyId', 'itemKey', 'exactFrozenLabel', 'sourceClass', 'sourceLabel', 'sourceUrlOrFrozenSnapshotId', 'publisherOrAuthority', 'publishedAtOrRetrievedAt', 'referencePeriodOrVersionWhenMaterial', 'accessAndReuseReviewStatus']) {
  ok(sourceRecord.requiredFields?.includes(field), `source record must require ${field}`)
}

const cellBinding = evidence.requiredCellBindingContract || {}
ok(cellBinding.minimumReviewedSourceRecords === 1, 'cell binding must require at least one reviewed source record')
ok(cellBinding.observationMustBeDirectlySupported === true, 'cell observation must be directly supported')
ok(cellBinding.materialCounterevidenceMustBeRetained === true, 'material counterevidence must be retained')
for (const field of ['cellId', 'slotId', 'manifestId', 'dimensionIndex', 'exactDimensionName', 'familyId', 'itemKey', 'exactFrozenLabel', 'sourceRecordIds', 'dimensionSpecificObservation', 'materialCounterevidence', 'evidenceReviewStatus']) {
  ok(cellBinding.requiredFields?.includes(field), `cell binding must require ${field}`)
}
for (const key of ['ordinalOutcomeAtAcquisitionGateAllowed', 'numericDimensionValueAtAcquisitionGateAllowed', 'weightAtAcquisitionGateAllowed', 'compositeScoreAtAcquisitionGateAllowed']) {
  ok(cellBinding[key] === false, `${key} must remain false`)
}

const expectedFamilyOrder = ['steam-mainstream', 'smartphones', 'kbo-clubs', 'korean-box-office', 'netflix-titles']
ok(JSON.stringify((evidence.familyExecutionPlan || []).map((entry) => entry.familyId)) === JSON.stringify(expectedFamilyOrder), 'family execution order changed')
ok((evidence.familyExecutionPlan || []).every((entry, index) => entry.sequence === index + 1), 'family execution sequence must be contiguous')
const byFamily = new Map(derivedFamilyStats.map((entry) => [entry.familyId, entry]))
for (const entry of evidence.familyExecutionPlan || []) {
  const derived = byFamily.get(entry.familyId)
  ok(derived, `unknown family plan ${entry.familyId}`)
  ok(entry.frozenCandidates === derived.frozenCandidates, `${entry.familyId} frozen candidate count mismatch`)
  ok(entry.explicitRubricSlots === derived.explicitRubricSlots, `${entry.familyId} rubric slot count mismatch`)
  ok(entry.candidateSourcePortfolios === derived.candidateSourcePortfolios, `${entry.familyId} portfolio count mismatch`)
  ok(entry.cellEvidenceObligations === derived.cellEvidenceObligations, `${entry.familyId} cell obligation count mismatch`)
  ok(Array.isArray(entry.preferredSourceClasses) && entry.preferredSourceClasses.length > 0, `${entry.familyId} source class priority must be non-empty`)
  ok(entry.preferredSourceClasses.every((sourceClass) => expectedSourceClasses.includes(sourceClass)), `${entry.familyId} uses unknown source class`)
}
const cellBatchSizes = evidence.familyExecutionPlan.map((entry) => entry.cellEvidenceObligations)
ok(JSON.stringify(cellBatchSizes) === JSON.stringify([90, 144, 170, 190, 340]), 'family execution order must remain ascending by bounded cell batch size')

const boundary = evidence.executionBoundary || {}
for (const key of ['planDefinesActualSourceUrls', 'planClaimsAnyExternalSourceSupportsAnyCell', 'planPerformsWebResearch', 'planAcquiresExternalSources', 'planAuthorsCandidateSpecificEvidence', 'planAuthorsCandidateRubricOutcomes', 'planAuthorsNumericDimensionValues', 'planAuthorsWeights', 'planExecutesCompositeScoring', 'planMaterializesEditorialOrdering']) {
  ok(boundary[key] === false, `${key} must remain false`)
}
ok(boundary.actualAcquisitionRequiresSeparateAuthorizationGate === true, 'actual acquisition must require separate authorization')
ok(evidence.gateDisposition === 'WAVE_1_RUBRIC_EVIDENCE_SOURCE_ACQUISITION_PLAN_DEFINED_FOR_934_CELLS_WITH_ZERO_EXTERNAL_ACQUISITION_EXECUTED', 'gate disposition mismatch')
ok(evidence.nextGate === 'EDITORIAL_RUBRIC_EVIDENCE_SOURCE_ACQUISITION_AUTHORIZATION_WAVE_1A_STEAM_MAINSTREAM', 'next gate mismatch')
ok(Object.values(evidence.authorityBoundary || {}).every((value) => value === false), 'all execution/public authority must remain disabled')

const serializedPlan = JSON.stringify(evidence)
ok(!/https?:\/\//i.test(serializedPlan), 'planning gate must not author actual external URLs')
for (const forbidden of ['sourceRecords', 'candidateEvidence', 'cellBindings', 'rubricOutcomes', 'candidateOutcomes', 'dimensionValues', 'weights', 'compositeScores', 'editorialOrderings']) {
  ok(!(forbidden in evidence), `planning evidence must not contain top-level ${forbidden}`)
}
ok(!page.includes('editorial-rubric-evidence-source-acquisition-plan-wave-1.json'), 'public ranking page must not consume acquisition plan evidence')
ok(pkg.scripts?.['verify:content-corpus-200-editorial-rubric-evidence-source-acquisition-plan-wave-1'] === 'node scripts/verify-content-corpus-200-editorial-rubric-evidence-source-acquisition-plan-wave-1.mjs', 'package script wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-editorial-rubric-evidence-source-acquisition-plan-wave-1'), 'CI must run acquisition plan verifier')

const observedSha = jsonSha(evidence)
console.log(JSON.stringify({
  version: evidence.version,
  manifestSha256: MANIFEST_SHA,
  collectionReviewSha256: COLLECTION_SHA,
  matrixCellRegistrySha256: jsonSha(derivedCells),
  evidenceSha256: observedSha,
  waveFamilies: expectedWaveFamilies.length,
  waveEditorialRows: editorialRows,
  explicitRubricSlots,
  familyScopedCandidateMemberships: candidateMemberships,
  candidateSourcePortfoliosPlanned: candidateMemberships,
  cellEvidenceObligations: derivedCells.length,
  sourceClasses: expectedSourceClasses.length,
  externalSourcesAcquiredAtThisGate: 0,
  candidateEvidenceRecordsAuthoredAtThisGate: 0,
  nextGate: evidence.nextGate,
}, null, 2))
ok(observedSha === EXPECTED, `unsealed editorial rubric evidence source acquisition plan wave 1 SHA: observed ${observedSha}; expected ${EXPECTED}`)
console.log('CONTENT-CORPUS-200 editorial rubric evidence source acquisition plan wave 1 verification passed')
