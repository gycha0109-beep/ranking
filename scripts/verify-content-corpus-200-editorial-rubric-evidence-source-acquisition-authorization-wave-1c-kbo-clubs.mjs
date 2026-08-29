import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const stem = 'editorial-rubric-evidence-source-acquisition-authorization-wave-1c-kbo-clubs'
const files = {
  evidence: p(`content/corpus-200/${stem}.json`),
  plan: p('content/corpus-200/editorial-rubric-evidence-source-acquisition-plan-wave-1.json'),
  priorAcquisition: p('content/corpus-200/editorial-rubric-evidence-source-acquisition-wave-1b-smartphones.json'),
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
const PLAN_SHA = '80eb6a1602ce7fae0155aeb2f872f1ac281039d8ed3a6a7cdcdcc0e9fc96a28b'
const PRIOR_ACQUISITION_SHA = '3813c7d8e3d69c8d9ce495c25cfc8919868162e4cbe299a4249dc223092ffddc'
const REGISTRY_SHA = 'c0e71b22456b805bfa351eb53f92f121cb6f9d23df1518c5f55ff2b33a1e11c7'
const WAVE1_SHA = '7e0c2b11cf9f6f5b4468d3ab112a2fa31d5ace2a55ef4bca0713771647562f6c'
const EXPECTED = 'UNSEALED_EDITORIAL_RUBRIC_EVIDENCE_SOURCE_ACQUISITION_AUTHORIZATION_WAVE_1C_KBO_CLUBS'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 Wave 1C KBO acquisition authorization verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files).flat()) ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)

const evidence = readJson(files.evidence)
const plan = readJson(files.plan)
const priorAcquisition = readJson(files.priorAcquisition)
const registry = readJson(files.registry)
const wave1 = readJson(files.wave1)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(plan) === PLAN_SHA, 'sealed source acquisition plan mutated')
ok(plan.scope?.candidateSlotCells === 934 && plan.scope?.existingCollectedCells === 0, 'source acquisition plan scope changed')
ok(plan.executionBoundary?.actualAcquisitionRequiresSeparateAuthorizationGate === true, 'plan must require separate acquisition authorization')
ok(jsonSha(priorAcquisition) === PRIOR_ACQUISITION_SHA, 'sealed Wave 1B smartphone acquisition evidence mutated')
ok(priorAcquisition.nextGate === 'EDITORIAL_RUBRIC_EVIDENCE_SOURCE_ACQUISITION_AUTHORIZATION_WAVE_1C_KBO_CLUBS', 'Wave 1B acquisition must hand off to this authorization gate')
ok(priorAcquisition.scope?.candidateSlotCells === 144 && priorAcquisition.scope?.directlyBoundCells === 120 && priorAcquisition.scope?.unresolvedCells === 24, 'Wave 1B acquisition disposition changed')
ok(Object.values(priorAcquisition.authorityBoundary || {}).every((value) => value === false), 'Wave 1B post-acquisition authorities must remain closed')
ok(jsonSha(registry) === REGISTRY_SHA, 'sealed dimension registry mutated')
ok(jsonSha(wave1) === WAVE1_SHA, 'sealed Wave 1 materialization mutated')

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

const kbo = (wave1.families || []).find((family) => family.familyId === 'kbo-clubs')
ok(kbo, 'Wave 1 KBO family must exist')
const candidates = kbo.candidateUniverse?.items || []
const expectedCandidates = [
  { itemKey: 'kt-wiz', exactFrozenLabel: 'KT' },
  { itemKey: 'samsung-lions', exactFrozenLabel: '삼성' },
  { itemKey: 'hanwha-eagles', exactFrozenLabel: '한화' },
  { itemKey: 'nc-dinos', exactFrozenLabel: 'NC' },
  { itemKey: 'kia-tigers', exactFrozenLabel: 'KIA' },
  { itemKey: 'lg-twins', exactFrozenLabel: 'LG' },
  { itemKey: 'doosan-bears', exactFrozenLabel: '두산' },
  { itemKey: 'lotte-giants', exactFrozenLabel: '롯데' },
  { itemKey: 'ssg-landers', exactFrozenLabel: 'SSG' },
  { itemKey: 'kiwoom-heroes', exactFrozenLabel: '키움' },
]
ok(JSON.stringify(candidates.map((item) => ({ itemKey: item.itemKey, exactFrozenLabel: item.label }))) === JSON.stringify(expectedCandidates), 'KBO frozen candidate identity changed')

const editorialManifestIds = []
const explicitSlots = []
const targetCells = []
for (const ranking of kbo.rankings || []) {
  if (ranking.kind !== 'EDITORIAL_COMPOSITE') continue
  editorialManifestIds.push(ranking.manifestId)
  ok(ranking.materializationStatus === 'CANDIDATES_FROZEN_SCORING_UNASSIGNED', `${ranking.manifestId} scoring state changed`)
  const row = rowById.get(ranking.manifestId)
  ok(row?.contentType === 'EDITORIAL_COMPOSITE', `${ranking.manifestId} must resolve to an editorial manifest row`)
  row.compositeDimensions.forEach((dimension, dimensionIndex) => {
    if (evidenceClassFor(dimension.name) !== 'EXPLICIT_EDITORIAL_RUBRIC') return
    const slotId = `${ranking.manifestId}:${dimensionIndex}:${dimension.name}`
    explicitSlots.push({ slotId, manifestId: ranking.manifestId, dimensionIndex, exactDimensionName: dimension.name })
    for (const candidate of candidates) {
      targetCells.push({
        cellId: `${slotId}::kbo-clubs:${candidate.itemKey}`,
        slotId,
        manifestId: ranking.manifestId,
        dimensionIndex,
        exactDimensionName: dimension.name,
        familyId: 'kbo-clubs',
        itemKey: candidate.itemKey,
        exactFrozenLabel: candidate.label,
      })
    }
  })
}
const expectedEditorialManifestIds = [
  'cc200-kbo-clubs-04',
  'cc200-kbo-clubs-05',
  'cc200-kbo-clubs-06',
  'cc200-kbo-clubs-07',
  'cc200-kbo-clubs-08',
]
ok(JSON.stringify(editorialManifestIds) === JSON.stringify(expectedEditorialManifestIds), 'KBO editorial manifest scope changed')
ok(explicitSlots.length === 17, `KBO must retain 17 explicit rubric slots, got ${explicitSlots.length}`)
ok(targetCells.length === 170, `KBO must retain 170 candidate-slot cells, got ${targetCells.length}`)

const thirdPlanFamily = plan.familyExecutionPlan?.[2]
ok(thirdPlanFamily?.sequence === 3 && thirdPlanFamily.familyId === 'kbo-clubs', 'Wave 1C KBO must remain third bounded plan family')
ok(thirdPlanFamily.frozenCandidates === 10 && thirdPlanFamily.explicitRubricSlots === 17 && thirdPlanFamily.cellEvidenceObligations === 170, 'Wave 1C plan counts changed')
ok(JSON.stringify(thirdPlanFamily.preferredSourceClasses) === JSON.stringify(['OFFICIAL_STATISTICS_OR_EVENT_RECORD', 'OFFICIAL_CANDIDATE_RECORD', 'REPUTABLE_REPORTING_OR_INTERVIEW']), 'Wave 1C plan source-class preference changed')

ok(evidence.version === 'content-corpus-200-editorial-rubric-evidence-source-acquisition-authorization-wave-1c-kbo-clubs-v1', 'authorization version mismatch')
ok(evidence.manifestVersion === manifest.manifestVersion && evidence.manifestSha256 === MANIFEST_SHA, 'manifest lineage mismatch')
ok(evidence.sourceAcquisitionPlanVersion === plan.version && evidence.sourceAcquisitionPlanSha256 === PLAN_SHA, 'source acquisition plan lineage mismatch')
ok(evidence.priorWaveAcquisitionVersion === priorAcquisition.version && evidence.priorWaveAcquisitionSha256 === PRIOR_ACQUISITION_SHA, 'prior acquisition lineage mismatch')
ok(evidence.status === 'AUTHORIZED_BOUNDED_EXTERNAL_SOURCE_ACQUISITION_ONLY_NO_RUBRIC_OUTCOMES', 'authorization status mismatch')
ok(evidence.authorizedAt === '2026-08-29T14:36:00+09:00', 'authorization timestamp mismatch')
ok(JSON.stringify(evidence.scope) === JSON.stringify({
  authorizedWave: '1C',
  authorizedFamilyId: 'kbo-clubs',
  authorizedEditorialRows: 5,
  authorizedFrozenCandidates: 10,
  authorizedExplicitRubricSlots: 17,
  authorizedCandidateSlotCells: 170,
  excludedWave1Families: 4,
  sourceRecordsPreAuthorized: 0,
  cellBindingsPreAuthorized: 0,
  rubricOutcomesPreAuthorized: 0,
  numericDimensionValuesPreAuthorized: 0,
  weightsPreAuthorized: 0,
  compositeScoresPreAuthorized: 0,
  editorialOrderingsPreAuthorized: 0,
}), 'authorization scope mismatch')
ok(JSON.stringify(evidence.authorizedCandidates) === JSON.stringify(expectedCandidates), 'authorized candidate scope must equal exact frozen KBO candidates')
ok(JSON.stringify(evidence.authorizedEditorialManifestIds) === JSON.stringify(expectedEditorialManifestIds), 'authorized editorial manifest scope mismatch')
ok(JSON.stringify(evidence.preferredSourceClasses) === JSON.stringify(['OFFICIAL_STATISTICS_OR_EVENT_RECORD', 'OFFICIAL_CANDIDATE_RECORD', 'REPUTABLE_REPORTING_OR_INTERVIEW']), 'KBO source-class preference changed')

const auth = evidence.executionAuthorization || {}
for (const key of [
  'publicWebResearchAuthorized',
  'externalSourceDiscoveryAuthorized',
  'externalSourceReviewAuthorized',
  'candidateSpecificSourceRecordAuthoringAuthorized',
  'dimensionSpecificCellObservationAuthoringAuthorized',
  'sourceToCellBindingAuthoringAuthorized',
  'materialCounterevidenceCaptureAuthorized',
  'unresolvedCellDispositionAuthoringAuthorized',
  'authorizationLimitedToExactFrozenCandidateIdentity',
  'authorizationLimitedToExactExplicitRubricSlots',
  'authorizationLimitedToKboClubsFamily',
  'authorizationRequiresDirectSupportPerCell',
]) ok(auth[key] === true, `${key} must be authorized`)

const retrieval = evidence.retrievalBoundary || {}
ok(retrieval.publiclyAccessibleSourcesOnly === true, 'acquisition must remain public-source only')
for (const key of [
  'loginOrPaywallBypassAuthorized',
  'robotsOrAccessControlBypassAuthorized',
  'searchResultSnippetAsEvidenceAuthorized',
  'sourceMetadataWithoutDimensionObservationAuthorized',
  'genericFamilyArticleWithoutCandidateBindingAuthorized',
  'modelOnlyJudgmentAuthorized',
  'crossCandidateInferenceAuthorized',
  'crossDimensionProxyAuthorized',
  'missingEvidenceImputationAuthorized',
  'candidateEligibilityAsSubjectiveQualityEvidenceAuthorized',
  'sourceDiscoveryAloneSatisfiesCell',
  'longVerbatimSourceCopyAuthorized',
]) ok(retrieval[key] === false, `${key} must remain false`)
ok(retrieval.sourceCaptureRule === 'RECORD_SOURCE_IDENTITY_METADATA_AND_CONCISE_DIMENSION_SPECIFIC_PARAPHRASE_OR_OBSERVATION_ONLY', 'source capture rule mismatch')
ok(retrieval.unclearAccessOrReuseDisposition === 'BLOCK_BINDING_PENDING_REVIEW', 'unclear access/reuse must block binding')

const contract = evidence.sourceAndBindingContract || {}
ok(contract.sourceRecordMustUsePlanRequiredFields === true && contract.cellBindingMustUsePlanRequiredFields === true, 'execution must inherit plan record contracts')
ok(contract.minimumReviewedSourceRecordsPerSatisfiedCell === 1, 'satisfied cell must bind at least one reviewed source')
ok(contract.sameSourceMaySupportMultipleCells === true && contract.sameSourceReuseRequiresSeparateDirectSupportPerExactSlot === true, 'same-source reuse contract changed')
ok(contract.materialCounterevidenceMustBeRetained === true, 'material counterevidence must be retained')
ok(contract.candidateVersionOrIdentityAmbiguityBlocksBinding === true, 'candidate identity ambiguity must block binding')
ok(contract.sourceMayRemainUnboundWhenExactDimensionSupportIsAbsent === true, 'non-supporting source must be allowed to remain unbound')
ok(contract.cellMayRemainUnresolvedWhenNoAdmissibleEvidenceIsFound === true, 'unresolved cells must remain allowed')
ok(contract.all170CellsMustBeSatisfiedAtExecutionGate === false, 'authorization must not force evidence fabrication for all 170 cells')

ok(Object.values(evidence.stillProhibited || {}).every((value) => value === true), 'all prohibited scoring/public actions must remain prohibited')
ok(Object.values(evidence.executionEvidenceRequirements || {}).every((value) => value === true), 'all execution evidence requirements must remain enabled')
ok(evidence.gateDisposition === 'WAVE_1C_KBO_CLUBS_EXTERNAL_SOURCE_ACQUISITION_AUTHORIZED_FOR_170_EXACT_RUBRIC_CELLS_WITH_SCORING_AND_OUTCOMES_DISABLED', 'gate disposition mismatch')
ok(evidence.nextGate === 'EDITORIAL_RUBRIC_EVIDENCE_SOURCE_ACQUISITION_WAVE_1C_KBO_CLUBS', 'next gate mismatch')

const authority = evidence.authorityBoundary || {}
ok(authority.externalSourceAcquisitionExecutionAuthorized === true, 'bounded external source acquisition execution must be authorized')
for (const [key, value] of Object.entries(authority)) {
  if (key === 'externalSourceAcquisitionExecutionAuthorized') continue
  ok(value === false, `${key} must remain false`)
}

const serialized = JSON.stringify(evidence)
ok(!/https?:\/\//i.test(serialized), 'authorization gate must not contain actual external source URLs')
for (const forbidden of ['sourceRecords', 'cellBindings', 'candidateEvidence', 'rubricOutcomes', 'candidateOutcomes', 'dimensionValues', 'weights', 'compositeScores', 'editorialOrderings']) {
  ok(!(forbidden in evidence), `authorization evidence must not contain top-level ${forbidden}`)
}
const script = `verify:content-corpus-200-${stem}`
ok(!page.includes(`${stem}.json`), 'public ranking page must not consume authorization evidence')
ok(pkg.scripts?.[script] === `node scripts/verify-content-corpus-200-${stem}.mjs`, 'package script wiring mismatch')
ok(ci.includes(`npm run ${script}`), 'CI wiring mismatch')

const observed = jsonSha(evidence)
console.log(JSON.stringify({
  version: evidence.version,
  evidenceSha256: observed,
  priorWaveAcquisitionSha256: jsonSha(priorAcquisition),
  authorizedFamilyId: evidence.scope.authorizedFamilyId,
  authorizedFrozenCandidates: candidates.length,
  authorizedExplicitRubricSlots: explicitSlots.length,
  authorizedCandidateSlotCells: targetCells.length,
  candidateRubricOutcomesPreAuthorized: evidence.scope.rubricOutcomesPreAuthorized,
  numericDimensionValuesPreAuthorized: evidence.scope.numericDimensionValuesPreAuthorized,
  weightsPreAuthorized: evidence.scope.weightsPreAuthorized,
  nextGate: evidence.nextGate,
}, null, 2))
ok(observed === EXPECTED, `unsealed Wave 1C KBO acquisition authorization SHA: observed ${observed}; expected ${EXPECTED}`)
console.log('CONTENT-CORPUS-200 Wave 1C KBO acquisition authorization verification passed')
