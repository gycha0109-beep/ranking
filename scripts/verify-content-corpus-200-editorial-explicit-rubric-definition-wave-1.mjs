import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  evidence: p('content/corpus-200/editorial-explicit-rubric-definition-wave-1.json'),
  authorization: p('content/corpus-200/editorial-rubric-dimension-authorization.json'),
  registry: p('content/corpus-200/editorial-dimension-contract-registry-and-evidence-plan.json'),
  sourceEvidence: p('content/corpus-200/editorial-dimension-evidence-wave-1.json'),
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
const AUTHORIZATION_SHA = 'e923fc17e84030f79d402ccd1188e940bd4482ca4547a0ea6f81202bc360afe0'
const REGISTRY_SHA = 'c0e71b22456b805bfa351eb53f92f121cb6f9d23df1518c5f55ff2b33a1e11c7'
const SOURCE_EVIDENCE_SHA = '1d87eeaf10751a36f3dd74a61bd461e50e8674d878e0065e87550e64d1f130ea'
const WAVE1_SHA = '7e0c2b11cf9f6f5b4468d3ab112a2fa31d5ace2a55ef4bca0713771647562f6c'
const EXPECTED = 'UNSEALED_EDITORIAL_EXPLICIT_RUBRIC_DEFINITION_WAVE_1'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 editorial explicit rubric definition wave 1 verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files).flat()) ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)

const evidence = readJson(files.evidence)
const authorization = readJson(files.authorization)
const registry = readJson(files.registry)
const sourceEvidence = readJson(files.sourceEvidence)
const wave1 = readJson(files.wave1)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(authorization) === AUTHORIZATION_SHA, 'sealed rubric/dimension authorization mutated')
ok(authorization.version === 'content-corpus-200-editorial-rubric-dimension-authorization-v1', 'authorization version mismatch')
ok(authorization.manifestSha256 === MANIFEST_SHA, 'authorization manifest lineage mismatch')
ok(authorization.authorizedPreparation?.rubricSpecificationDrafting === true, 'rubric specification drafting must be authorized')
ok(authorization.stillProhibited?.hiddenLlmJudgmentAsNumericEvidence === true, 'hidden LLM numeric judgment must remain prohibited')
ok(authorization.stillProhibited?.unreviewedSubjectiveDimensionValues === true, 'unreviewed subjective values must remain prohibited')
ok(authorization.stillProhibited?.automaticWeightAssignment === true, 'automatic weight assignment must remain prohibited')
ok(authorization.stillProhibited?.editorialCompositeScoreExecution === true, 'composite score execution must remain prohibited')
ok(authorization.stillProhibited?.editorialOrderingMaterialization === true, 'editorial ordering must remain prohibited')
ok(authorization.weightBoundary?.weightsRemainUnassigned === true, 'weights must remain unassigned')

ok(jsonSha(registry) === REGISTRY_SHA, 'sealed dimension registry mutated')
ok(registry.version === 'content-corpus-200-editorial-dimension-contract-registry-and-evidence-plan-v1', 'registry version mismatch')
ok(registry.manifestSha256 === MANIFEST_SHA, 'registry manifest lineage mismatch')

ok(jsonSha(sourceEvidence) === SOURCE_EVIDENCE_SHA, 'sealed wave 1 source evidence mutated')
ok(sourceEvidence.version === 'content-corpus-200-editorial-dimension-evidence-wave-1-v1', 'source evidence version mismatch')
ok(sourceEvidence.manifestSha256 === MANIFEST_SHA, 'source evidence manifest lineage mismatch')
ok(sourceEvidence.dimensionRegistrySha256 === REGISTRY_SHA, 'source evidence registry lineage mismatch')
ok(sourceEvidence.scope?.materializedSourceBindings === 3, 'source evidence must retain exactly three bindings')
ok(sourceEvidence.scope?.newNumericValuesAuthored === 0, 'source evidence must retain zero newly authored numeric values')
ok(sourceEvidence.reviewSummary?.scoringExecutionReadyRows === 0, 'source evidence must retain zero scoring-ready rows')
ok(sourceEvidence.nextGate === 'EDITORIAL_EXPLICIT_RUBRIC_DEFINITION_WAVE_1', 'source evidence must hand off to rubric definition wave 1')

ok(jsonSha(wave1) === WAVE1_SHA, 'sealed candidate/source materialization wave 1 mutated')
ok(wave1.version === 'content-corpus-200-wave-1-v1', 'wave 1 version mismatch')
ok(wave1.manifestSha256 === MANIFEST_SHA, 'wave 1 manifest lineage mismatch')

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
ok(JSON.stringify((wave1.families || []).map((family) => family.familyId)) === JSON.stringify(expectedWaveFamilies), 'wave 1 family set/order changed')

const waveEditorialIds = []
for (const family of wave1.families || []) {
  ok(family.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', `${family.familyId} candidate universe must remain frozen/source-backed`)
  for (const ranking of family.rankings || []) {
    if (ranking.kind !== 'EDITORIAL_COMPOSITE') continue
    waveEditorialIds.push(ranking.manifestId)
    ok(ranking.materializationStatus === 'CANDIDATES_FROZEN_SCORING_UNASSIGNED', `${ranking.manifestId} must remain scoring-unassigned`)
  }
}
ok(waveEditorialIds.length === 25, `wave 1 must retain 25 editorial rows, got ${waveEditorialIds.length}`)

const sourceNames = new Set(registry.registryDerivation?.sourceMeasurableExactDimensionNames || [])
const mixedNames = new Set(registry.registryDerivation?.mixedEvidenceAndRubricExactDimensionNames || [])
const derivedNames = new Set(registry.registryDerivation?.deterministicDerivedExactDimensionNames || [])
function evidenceClassFor(name) {
  if (sourceNames.has(name)) return 'SOURCE_MEASURABLE'
  if (mixedNames.has(name)) return 'MIXED_EVIDENCE_AND_RUBRIC'
  if (derivedNames.has(name)) return 'DETERMINISTIC_DERIVED'
  return 'EXPLICIT_EDITORIAL_RUBRIC'
}

const classCounts = {
  SOURCE_MEASURABLE: 0,
  DETERMINISTIC_DERIVED: 0,
  EXPLICIT_EDITORIAL_RUBRIC: 0,
  MIXED_EVIDENCE_AND_RUBRIC: 0,
}
const rubricContracts = []
let waveDimensionSlots = 0
for (const manifestId of waveEditorialIds) {
  const row = rowById.get(manifestId)
  ok(row?.contentType === 'EDITORIAL_COMPOSITE', `${manifestId} must resolve to editorial manifest row`)
  ok(typeof row.rankingBasis === 'string' && row.rankingBasis.length > 0, `${manifestId} must retain exact ranking basis`)
  ok(row.compositeFormula === 'WEIGHTS_NOT_ASSIGNED_PRE_MATERIALIZATION', `${manifestId} formula must remain unassigned`)
  ok(row.compositeDimensions.every((dimension) => dimension.weightStatus === 'UNASSIGNED_PRE_MATERIALIZATION'), `${manifestId} weights must remain unassigned`)
  row.compositeDimensions.forEach((dimension, dimensionIndex) => {
    waveDimensionSlots += 1
    const evidenceClass = evidenceClassFor(dimension.name)
    classCounts[evidenceClass] += 1
    if (evidenceClass !== 'EXPLICIT_EDITORIAL_RUBRIC') return
    rubricContracts.push({
      slotId: `${manifestId}:${dimensionIndex}:${dimension.name}`,
      manifestId,
      familyId: row.familyId,
      dimensionIndex,
      dimensionName: dimension.name,
      rankingBasis: row.rankingBasis,
      evidenceClass,
      rubricTemplateVersion: evidence.rubricTemplate?.version,
    })
  })
}

ok(waveDimensionSlots === 104, `wave 1 must retain 104 dimension slots, got ${waveDimensionSlots}`)
ok(JSON.stringify(classCounts) === JSON.stringify({
  SOURCE_MEASURABLE: 13,
  DETERMINISTIC_DERIVED: 0,
  EXPLICIT_EDITORIAL_RUBRIC: 89,
  MIXED_EVIDENCE_AND_RUBRIC: 2,
}), `wave 1 evidence class counts changed: ${JSON.stringify(classCounts)}`)
ok(rubricContracts.length === 89, `must derive 89 explicit rubric contracts, got ${rubricContracts.length}`)
ok(new Set(rubricContracts.map((contract) => contract.slotId)).size === 89, 'rubric contract slot identities must be unique')

ok(evidence.version === 'content-corpus-200-editorial-explicit-rubric-definition-wave-1-v1', 'evidence version mismatch')
ok(evidence.manifestVersion === manifest.manifestVersion && evidence.manifestSha256 === MANIFEST_SHA, 'evidence manifest lineage mismatch')
ok(evidence.authorizationVersion === authorization.version && evidence.authorizationSha256 === AUTHORIZATION_SHA, 'evidence authorization lineage mismatch')
ok(evidence.dimensionRegistryVersion === registry.version && evidence.dimensionRegistrySha256 === REGISTRY_SHA, 'evidence registry lineage mismatch')
ok(evidence.sourceEvidenceWaveVersion === sourceEvidence.version && evidence.sourceEvidenceWaveSha256 === SOURCE_EVIDENCE_SHA, 'evidence source-wave lineage mismatch')
ok(evidence.status === 'DEFINED_EXPLICIT_ANCHORED_RUBRIC_CONTRACTS_NO_CANDIDATE_OUTCOMES', 'evidence status mismatch')
ok(evidence.definedAt === '2026-08-27T09:13:00+09:00', 'definition timestamp mismatch')
ok(JSON.stringify(evidence.scope) === JSON.stringify({
  waveFamilies: expectedWaveFamilies,
  waveEditorialRows: 25,
  waveDimensionSlots: 104,
  explicitRubricSlotsDefined: 89,
  sourceMeasurableSlotsExcluded: 13,
  mixedEvidenceAndRubricSlotsExcluded: 2,
  deterministicDerivedSlotsExcluded: 0,
  candidateRubricOutcomesAuthored: 0,
  numericDimensionValuesAuthored: 0,
  weightsAuthored: 0,
  compositeScoresAuthored: 0,
  editorialOrderingsAuthored: 0,
}), 'evidence scope mismatch')

const derivation = evidence.rubricContractDerivation || {}
ok(derivation.mode === 'DERIVE_ONE_CONTRACT_FOR_EVERY_WAVE_1_SLOT_CLASSIFIED_EXPLICIT_EDITORIAL_RUBRIC_BY_THE_SEALED_REGISTRY', 'rubric contract derivation mode mismatch')
ok(derivation.slotIdentity === 'manifestId + dimensionIndex + exactDimensionName', 'rubric slot identity mismatch')
ok(derivation.decisionContext === 'EXACT_FROZEN_MANIFEST_RANKING_BASIS_FOR_THE_EDITORIAL_ROW', 'rubric decision context mismatch')
ok(derivation.dimensionContext === 'EXACT_FROZEN_DIMENSION_NAME_ONLY', 'rubric dimension context mismatch')
ok(derivation.sameNamedDimensionsAcrossRowsRemainSeparateContracts === true, 'same-name cross-row contracts must remain separate')
ok(derivation.noSubstringOrSemanticSlotPromotion === true, 'substring/semantic slot promotion must remain disabled')
ok(derivation.noLlmGeneratedSlotReclassification === true, 'LLM slot reclassification must remain disabled')

const template = evidence.rubricTemplate || {}
ok(template.version === 'editorial-explicit-rubric-ordinal-0-4-v1', 'rubric template version mismatch')
ok(template.scaleType === 'ANCHORED_ORDINAL_0_TO_4_NOT_A_COMPOSITE_SCORE', 'rubric scale type mismatch')
ok(template.evaluationQuestionTemplate === 'Within the exact editorial decision context, how strongly does reviewed candidate-specific evidence support this candidate on the exact named dimension?', 'rubric evaluation question mismatch')
ok(Array.isArray(template.anchors) && template.anchors.length === 5, 'rubric template must define five anchors')
ok(JSON.stringify(template.anchors.map((anchor) => anchor.ordinal)) === JSON.stringify([0, 1, 2, 3, 4]), 'rubric anchor ordinals must be exactly 0..4')
ok(JSON.stringify(template.anchors.map((anchor) => anchor.label)) === JSON.stringify(['CONTRADICTED', 'WEAK', 'MIXED', 'STRONG', 'EXCEPTIONAL']), 'rubric anchor labels mismatch')
ok(template.anchors.every((anchor) => typeof anchor.criterion === 'string' && anchor.criterion.length > 40), 'every rubric anchor must contain explicit criterion text')
ok(template.insufficientEvidenceDisposition === 'BLOCK_OUTCOME_NO_DEFAULT_OR_MIDPOINT_VALUE', 'missing evidence must block instead of defaulting')
ok(template.requiredOutcomeEvidence === 'CANDIDATE_SPECIFIC_REVIEWED_EVIDENCE_REFERENCES_PLUS_A_SHORT_DIMENSION_SPECIFIC_RATIONALE', 'future outcome evidence contract mismatch')
ok(template.counterevidenceRule === 'MATERIAL_COUNTEREVIDENCE_MUST_BE_RETAINED_AND_CANNOT_BE_CHERRY_PICKED_AWAY', 'counterevidence rule mismatch')
ok(template.crossDimensionProxyRule === 'FORBIDDEN', 'cross-dimension proxy must remain forbidden')
ok(template.missingEvidenceImputationRule === 'FORBIDDEN', 'missing evidence imputation must remain forbidden')
ok(template.modelOnlyJudgmentRule === 'FORBIDDEN', 'model-only judgment must remain forbidden')
ok(template.ordinalDirection === 'HIGHER_ORDINAL_MEANS_STRONGER_SUPPORT_FOR_THE_EXACT_NAMED_DIMENSION_ONLY', 'ordinal direction mismatch')
ok(template.weightMeaning === 'NONE_AT_THIS_GATE', 'rubric anchors must not imply weights')

const outcome = evidence.outcomeBoundary || {}
ok(outcome.rubricDefinitionsAreCandidateOutcomes === false, 'rubric definitions must not be candidate outcomes')
ok(outcome.candidateOutcomeAuthoringAuthorized === false, 'candidate outcome authoring must remain unauthorized')
ok(outcome.candidateOutcomeReviewExecuted === false, 'candidate outcome review must not execute')
ok(outcome.candidateOutcomeCount === 0, 'candidate outcome count must remain zero')
ok(outcome.numericDimensionValueCount === 0, 'numeric dimension values must remain zero')
ok(outcome.weightDraftingExecuted === false && outcome.weightAssignmentExecuted === false, 'weight work must not execute')
ok(outcome.compositeScoringExecuted === false, 'composite scoring must not execute')
ok(outcome.editorialOrderingMaterialized === false, 'editorial ordering must not materialize')
ok(outcome.scoringExecutionReadyRows === 0, 'scoring-ready rows must remain zero')

for (const forbidden of ['candidateOutcomes', 'candidateValues', 'dimensionValues', 'weights', 'compositeScores', 'editorialOrderings']) {
  ok(!(forbidden in evidence), `evidence must not contain top-level ${forbidden}`)
}
ok(evidence.gateDisposition === 'WAVE_1_EXPLICIT_RUBRIC_CONTRACTS_DEFINED_WITH_ZERO_CANDIDATE_OUTCOMES_AND_ZERO_SCORING', 'gate disposition mismatch')
ok(evidence.nextGate === 'EDITORIAL_NON_RUBRIC_DIMENSION_EVIDENCE_COMPLETION_WAVE_1', 'next gate mismatch')
ok(Object.values(evidence.authorityBoundary || {}).every((value) => value === false), 'execution/public authority must remain disabled')

ok(!page.includes('editorial-explicit-rubric-definition-wave-1.json'), 'public ranking page must not consume rubric definition evidence')
ok(pkg.scripts?.['verify:content-corpus-200-editorial-explicit-rubric-definition-wave-1'] === 'node scripts/verify-content-corpus-200-editorial-explicit-rubric-definition-wave-1.mjs', 'package script wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-editorial-explicit-rubric-definition-wave-1'), 'CI must run rubric definition verifier')

const observedSha = jsonSha(evidence)
const derivedContractRegistrySha = jsonSha(rubricContracts)
console.log(JSON.stringify({
  version: evidence.version,
  manifestSha256: MANIFEST_SHA,
  authorizationSha256: AUTHORIZATION_SHA,
  dimensionRegistrySha256: REGISTRY_SHA,
  sourceEvidenceWaveSha256: SOURCE_EVIDENCE_SHA,
  evidenceSha256: observedSha,
  derivedRubricContractRegistrySha256: derivedContractRegistrySha,
  waveEditorialRows: waveEditorialIds.length,
  waveDimensionSlots,
  classCounts,
  explicitRubricContracts: rubricContracts.length,
  candidateRubricOutcomesAuthored: evidence.scope.candidateRubricOutcomesAuthored,
  numericDimensionValuesAuthored: evidence.scope.numericDimensionValuesAuthored,
  nextGate: evidence.nextGate,
}, null, 2))
ok(observedSha === EXPECTED, `unsealed editorial explicit rubric definition wave 1 SHA: observed ${observedSha}; expected ${EXPECTED}`)
console.log('CONTENT-CORPUS-200 editorial explicit rubric definition wave 1 verification passed')
