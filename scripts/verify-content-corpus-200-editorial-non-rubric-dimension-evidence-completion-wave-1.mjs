import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  evidence: p('content/corpus-200/editorial-non-rubric-dimension-evidence-completion-wave-1.json'),
  authorization: p('content/corpus-200/editorial-rubric-dimension-authorization.json'),
  registry: p('content/corpus-200/editorial-dimension-contract-registry-and-evidence-plan.json'),
  priorEvidence: p('content/corpus-200/editorial-dimension-evidence-wave-1.json'),
  rubric: p('content/corpus-200/editorial-explicit-rubric-definition-wave-1.json'),
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
const PRIOR_EVIDENCE_SHA = '1d87eeaf10751a36f3dd74a61bd461e50e8674d878e0065e87550e64d1f130ea'
const RUBRIC_SHA = 'f25542a31dbf157f2195b9a5d7ba7f08ce6a19085cf9f584cec7c11813f3dd04'
const WAVE1_SHA = '7e0c2b11cf9f6f5b4468d3ab112a2fa31d5ace2a55ef4bca0713771647562f6c'
const EXPECTED = 'UNSEALED_EDITORIAL_NON_RUBRIC_DIMENSION_EVIDENCE_COMPLETION_WAVE_1'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 editorial non-rubric dimension evidence completion wave 1 verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files).flat()) ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)

const evidence = readJson(files.evidence)
const authorization = readJson(files.authorization)
const registry = readJson(files.registry)
const priorEvidence = readJson(files.priorEvidence)
const rubric = readJson(files.rubric)
const wave1 = readJson(files.wave1)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(authorization) === AUTHORIZATION_SHA, 'sealed authorization mutated')
ok(jsonSha(registry) === REGISTRY_SHA, 'sealed dimension registry mutated')
ok(jsonSha(priorEvidence) === PRIOR_EVIDENCE_SHA, 'sealed prior wave 1 source evidence mutated')
ok(jsonSha(rubric) === RUBRIC_SHA, 'sealed wave 1 rubric definition mutated')
ok(jsonSha(wave1) === WAVE1_SHA, 'sealed candidate/source wave 1 mutated')
ok(authorization.manifestSha256 === MANIFEST_SHA && registry.manifestSha256 === MANIFEST_SHA, 'upstream manifest lineage mismatch')
ok(priorEvidence.manifestSha256 === MANIFEST_SHA && rubric.manifestSha256 === MANIFEST_SHA && wave1.manifestSha256 === MANIFEST_SHA, 'upstream manifest lineage mismatch')
ok(authorization.authorizedPreparation?.objectiveSourceEvidenceCollection === true, 'objective source evidence collection must remain authorized preparation')
ok(authorization.authorizedPreparation?.normalizationPlanDrafting === true, 'normalization plan drafting must remain authorized preparation')
ok(authorization.stillProhibited?.editorialCompositeScoreExecution === true, 'editorial composite scoring must remain prohibited')
ok(authorization.stillProhibited?.automaticWeightAssignment === true, 'automatic weight assignment must remain prohibited')
ok(rubric.nextGate === 'EDITORIAL_NON_RUBRIC_DIMENSION_EVIDENCE_COMPLETION_WAVE_1', 'rubric definition must hand off to this gate')
ok(priorEvidence.scope?.materializedSourceBindings === 3, 'prior evidence must retain exactly three bindings')
ok(priorEvidence.reviewSummary?.scoringExecutionReadyRows === 0, 'prior evidence must retain zero scoring-ready rows')

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
const waveFamilyById = new Map((wave1.families || []).map((family) => [family.familyId, family]))
const expectedWaveFamilies = ['steam-mainstream', 'korean-box-office', 'netflix-titles', 'smartphones', 'kbo-clubs']
ok(JSON.stringify([...waveFamilyById.keys()]) === JSON.stringify(expectedWaveFamilies), 'wave 1 family set/order changed')

const sourceNames = new Set(registry.registryDerivation?.sourceMeasurableExactDimensionNames || [])
const mixedNames = new Set(registry.registryDerivation?.mixedEvidenceAndRubricExactDimensionNames || [])
const derivedNames = new Set(registry.registryDerivation?.deterministicDerivedExactDimensionNames || [])
function evidenceClassFor(name) {
  if (sourceNames.has(name)) return 'SOURCE_MEASURABLE'
  if (mixedNames.has(name)) return 'MIXED_EVIDENCE_AND_RUBRIC'
  if (derivedNames.has(name)) return 'DETERMINISTIC_DERIVED'
  return 'EXPLICIT_EDITORIAL_RUBRIC'
}

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

let waveDimensionSlots = 0
const classCounts = { SOURCE_MEASURABLE: 0, DETERMINISTIC_DERIVED: 0, EXPLICIT_EDITORIAL_RUBRIC: 0, MIXED_EVIDENCE_AND_RUBRIC: 0 }
const nonRubricSlots = []
for (const manifestId of waveEditorialIds) {
  const row = rowById.get(manifestId)
  ok(row?.contentType === 'EDITORIAL_COMPOSITE', `${manifestId} must resolve to editorial row`)
  ok(row.compositeFormula === 'WEIGHTS_NOT_ASSIGNED_PRE_MATERIALIZATION', `${manifestId} formula must remain unassigned`)
  ok(row.compositeDimensions.every((dimension) => dimension.weightStatus === 'UNASSIGNED_PRE_MATERIALIZATION'), `${manifestId} weights must remain unassigned`)
  row.compositeDimensions.forEach((dimension, dimensionIndex) => {
    waveDimensionSlots += 1
    const evidenceClass = evidenceClassFor(dimension.name)
    classCounts[evidenceClass] += 1
    if (evidenceClass !== 'EXPLICIT_EDITORIAL_RUBRIC') {
      nonRubricSlots.push({
        slotId: `${manifestId}:${dimensionIndex}:${dimension.name}`,
        manifestId,
        dimensionIndex,
        dimensionName: dimension.name,
        evidenceClass,
      })
    }
  })
}
ok(waveDimensionSlots === 104, `wave 1 must retain 104 dimension slots, got ${waveDimensionSlots}`)
ok(JSON.stringify(classCounts) === JSON.stringify({ SOURCE_MEASURABLE: 13, DETERMINISTIC_DERIVED: 0, EXPLICIT_EDITORIAL_RUBRIC: 89, MIXED_EVIDENCE_AND_RUBRIC: 2 }), `wave 1 class counts changed: ${JSON.stringify(classCounts)}`)
ok(nonRubricSlots.length === 15, `wave 1 must retain 15 non-rubric slots, got ${nonRubricSlots.length}`)

ok(evidence.version === 'content-corpus-200-editorial-non-rubric-dimension-evidence-completion-wave-1-v1', 'evidence version mismatch')
ok(evidence.manifestVersion === manifest.manifestVersion && evidence.manifestSha256 === MANIFEST_SHA, 'evidence manifest lineage mismatch')
ok(evidence.authorizationVersion === authorization.version && evidence.authorizationSha256 === AUTHORIZATION_SHA, 'authorization lineage mismatch')
ok(evidence.dimensionRegistryVersion === registry.version && evidence.dimensionRegistrySha256 === REGISTRY_SHA, 'registry lineage mismatch')
ok(evidence.priorSourceEvidenceVersion === priorEvidence.version && evidence.priorSourceEvidenceSha256 === PRIOR_EVIDENCE_SHA, 'prior source evidence lineage mismatch')
ok(evidence.rubricDefinitionVersion === rubric.version && evidence.rubricDefinitionSha256 === RUBRIC_SHA, 'rubric definition lineage mismatch')
ok(evidence.candidateMaterializationWaveVersion === wave1.version && evidence.candidateMaterializationWaveSha256 === WAVE1_SHA, 'candidate/source wave lineage mismatch')
ok(evidence.status === 'REVIEWED_ALL_WAVE_1_NON_RUBRIC_SLOTS_WITH_SOURCE_COVERAGE_ONLY_NO_EDITORIAL_VALUES', 'evidence status mismatch')
ok(evidence.reviewedAt === '2026-08-27T13:30:00+09:00', 'review timestamp mismatch')
ok(JSON.stringify(evidence.scope) === JSON.stringify({
  waveEditorialRows: 25,
  waveDimensionSlots: 104,
  nonRubricSlots: 15,
  priorCompleteBindings: 3,
  newFullCandidateSourceObservationSlots: 2,
  rawFullCandidateCoverageNormalizationPendingSlots: 1,
  blockedSlots: 9,
  newEditorialDimensionValuesMaterialized: 0,
  newEditorialPreferenceDirectionsAssigned: 0,
  normalizationsExecuted: 0,
  weightsAuthored: 0,
  compositeScoresAuthored: 0,
  editorialOrderingsAuthored: 0,
}), 'evidence scope mismatch')

ok(Array.isArray(evidence.slotInventory) && evidence.slotInventory.length === 15, 'slot inventory must contain 15 records')
ok(JSON.stringify(evidence.slotInventory.map((slot) => slot.slotId)) === JSON.stringify(nonRubricSlots.map((slot) => slot.slotId)), 'slot inventory must exactly match derived non-rubric slot order')
for (let i = 0; i < nonRubricSlots.length; i += 1) {
  const expectedSlot = nonRubricSlots[i]
  const actual = evidence.slotInventory[i]
  ok(actual.manifestId === expectedSlot.manifestId && actual.dimensionIndex === expectedSlot.dimensionIndex && actual.dimensionName === expectedSlot.dimensionName, `slot ${expectedSlot.slotId} identity mismatch`)
  ok(actual.evidenceClass === expectedSlot.evidenceClass, `slot ${expectedSlot.slotId} evidence class mismatch`)
}
const statusCounts = evidence.slotInventory.reduce((acc, slot) => { acc[slot.status] = (acc[slot.status] || 0) + 1; return acc }, {})
ok(JSON.stringify(statusCounts) === JSON.stringify({ BLOCKED: 9, PRIOR_COMPLETE_BINDING: 3, FULL_CANDIDATE_SOURCE_OBSERVATIONS_COMPLETE: 2, RAW_FULL_CANDIDATE_COVERAGE_NORMALIZATION_PENDING: 1 }), `slot status counts mismatch: ${JSON.stringify(statusCounts)}`)

const expectedPriorSlots = priorEvidence.sourceBindings.map((binding) => `${binding.editorialManifestId}:${binding.dimensionIndex}:${binding.dimensionName}`)
const actualPriorSlots = evidence.slotInventory.filter((slot) => slot.status === 'PRIOR_COMPLETE_BINDING').map((slot) => slot.slotId)
ok(JSON.stringify(actualPriorSlots) === JSON.stringify(expectedPriorSlots), 'prior complete binding slots must exactly match sealed prior evidence')

ok(Array.isArray(evidence.sourceObservationSets) && evidence.sourceObservationSets.length === 3, 'must contain exactly three new source observation sets')
const observationBySlot = new Map(evidence.sourceObservationSets.map((set) => [set.slotId, set]))
ok(observationBySlot.size === 3, 'source observation slot IDs must be unique')
const expectedObservationSlots = ['cc200-smartphones-06:0:폭', 'cc200-smartphones-06:2:화면 크기', 'cc200-kbo-clubs-05:1:장타율']
ok(JSON.stringify([...observationBySlot.keys()]) === JSON.stringify(expectedObservationSlots), 'source observation set slots mismatch')

function candidateKeysFor(manifestId) {
  const row = rowById.get(manifestId)
  ok(row, `${manifestId} must resolve to manifest row`)
  const family = waveFamilyById.get(row.familyId)
  ok(family, `${manifestId} family must exist in wave 1`)
  return (family.candidateUniverse.items || []).map((item) => item.itemKey)
}
function validateObservationSet(slotId, expectedCandidateKeys) {
  const set = observationBySlot.get(slotId)
  ok(set, `${slotId} observation set missing`)
  ok(Array.isArray(set.entries), `${slotId} entries must exist`)
  ok(JSON.stringify(set.entries.map((entry) => entry.itemKey)) === JSON.stringify(expectedCandidateKeys), `${slotId} must cover the frozen candidate universe exactly and in order`)
  ok(new Set(set.entries.map((entry) => entry.itemKey)).size === expectedCandidateKeys.length, `${slotId} candidate keys must be unique`)
  ok(set.entries.every((entry) => typeof entry.value === 'number' && Number.isFinite(entry.value)), `${slotId} entries must contain finite source observations`)
}
validateObservationSet('cc200-smartphones-06:0:폭', candidateKeysFor('cc200-smartphones-06'))
validateObservationSet('cc200-smartphones-06:2:화면 크기', candidateKeysFor('cc200-smartphones-06'))
validateObservationSet('cc200-kbo-clubs-05:1:장타율', candidateKeysFor('cc200-kbo-clubs-05'))

const widthSet = observationBySlot.get('cc200-smartphones-06:0:폭')
ok(widthSet.status === 'FULL_CANDIDATE_SOURCE_OBSERVATIONS_COMPLETE_NO_EDITORIAL_VALUE_PROJECTION', 'width source coverage status mismatch')
ok(widthSet.unit === 'mm' && widthSet.entries.every((entry) => entry.unit === 'mm'), 'width observations must use reviewed common mm unit from source surfaces')
ok(widthSet.entries.every((entry) => /^https:\/\/(www\.)?(samsung\.com|apple\.com|mi\.com|oneplus\.com|vivo\.com)\//.test(entry.sourceUrl)), 'width observations must use allowed official manufacturer hosts')

const displaySet = observationBySlot.get('cc200-smartphones-06:2:화면 크기')
ok(displaySet.status === 'RAW_FULL_CANDIDATE_COVERAGE_NORMALIZATION_PENDING', 'display source coverage status mismatch')
ok(JSON.stringify(displaySet.unitsSeen) === JSON.stringify(['mm', 'cm']), 'display raw units must remain explicitly mixed')
ok(displaySet.normalizationMaterialized === false, 'display normalization must not materialize')
ok(new Set(displaySet.entries.map((entry) => entry.unit)).size === 2, 'display raw evidence must retain mixed source units')
ok(displaySet.entries.every((entry) => /^https:\/\/(www\.)?(samsung\.com|apple\.com|mi\.com|oneplus\.com|vivo\.com)\//.test(entry.sourceUrl)), 'display observations must use allowed official manufacturer hosts')

const slgSet = observationBySlot.get('cc200-kbo-clubs-05:1:장타율')
ok(slgSet.status === 'FULL_CANDIDATE_SOURCE_OBSERVATIONS_COMPLETE_NO_EDITORIAL_VALUE_PROJECTION', 'KBO SLG source coverage status mismatch')
ok(slgSet.unit === 'rate', 'KBO SLG unit mismatch')
ok(slgSet.sourceKey === 'kbo-live-stats', 'KBO SLG source key mismatch')
ok(slgSet.sourceUrl === 'https://web1.koreabaseball.com/Record/Team/Hitter/Basic2.aspx', 'KBO SLG source URL mismatch')
ok(slgSet.entries.every((entry) => entry.value >= 0 && entry.value <= 1), 'KBO SLG observations must be rates')

ok(Array.isArray(evidence.blockedSlots) && evidence.blockedSlots.length === 9, 'blocked slot inventory must contain nine records')
const expectedBlockedSlots = evidence.slotInventory.filter((slot) => slot.status === 'BLOCKED').map((slot) => slot.slotId)
ok(JSON.stringify(evidence.blockedSlots.map((slot) => slot.slotId)) === JSON.stringify(expectedBlockedSlots), 'blocked slots must exactly match blocked inventory records')
ok(evidence.blockedSlots.every((slot) => typeof slot.blocker === 'string' && slot.blocker.length > 25), 'every blocked slot must retain an explicit blocker')

const policy = evidence.completionPolicy || {}
ok(policy.sourceObservationIsEditorialValue === false, 'source observations must not become editorial values')
ok(policy.editorialValueProjection === 'NOT_AUTHORIZED_AT_THIS_GATE', 'editorial value projection must remain unauthorized')
ok(policy.candidateUniverseMutation === 'FORBIDDEN', 'candidate universe mutation must remain forbidden')
ok(policy.blockedRule === 'NO_IMPUTATION_NO_PROXY_SUBSTITUTION_NO_SILENT_CANDIDATE_FILTERING', 'blocked evidence rule mismatch')
const summary = evidence.reviewSummary || {}
ok(summary.newSourceObservationsAreNotEditorialDimensionValues === true, 'new source observations must remain non-editorial values')
ok(summary.rawMixedUnitDisplayEvidenceNotNormalized === true, 'display normalization must remain pending')
ok(summary.newEditorialDimensionValuesMaterialized === 0, 'new editorial dimension values must remain zero')
ok(summary.weightsAuthored === 0 && summary.compositeScoringExecuted === false && summary.editorialOrderingMaterialized === false, 'scoring/ordering work must remain unexecuted')
ok(summary.scoringExecutionReadyRows === 0, 'scoring-ready rows must remain zero')
for (const forbidden of ['dimensionValues', 'weights', 'compositeScores', 'editorialOrderings', 'candidateOutcomes']) {
  ok(!(forbidden in evidence), `evidence must not contain top-level ${forbidden}`)
}
ok(evidence.gateDisposition === 'WAVE_1_NON_RUBRIC_EVIDENCE_INVENTORY_COMPLETED_WITH_TWO_NEW_FULL_COVERAGE_SOURCE_SETS_ONE_NORMALIZATION_PENDING_SET_AND_NINE_BLOCKERS', 'gate disposition mismatch')
ok(evidence.nextGate === 'EDITORIAL_NON_RUBRIC_BLOCKER_RECOVERY_WAVE_1', 'next gate mismatch')
ok(Object.values(evidence.authorityBoundary || {}).every((value) => value === false), 'execution/public authority must remain disabled')

ok(!page.includes('editorial-non-rubric-dimension-evidence-completion-wave-1.json'), 'public ranking page must not consume non-rubric evidence completion')
ok(pkg.scripts?.['verify:content-corpus-200-editorial-non-rubric-dimension-evidence-completion-wave-1'] === 'node scripts/verify-content-corpus-200-editorial-non-rubric-dimension-evidence-completion-wave-1.mjs', 'package script wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-editorial-non-rubric-dimension-evidence-completion-wave-1'), 'CI must run non-rubric evidence completion verifier')

const observedSha = jsonSha(evidence)
console.log(JSON.stringify({
  version: evidence.version,
  manifestSha256: MANIFEST_SHA,
  evidenceSha256: observedSha,
  waveEditorialRows: waveEditorialIds.length,
  waveDimensionSlots,
  classCounts,
  nonRubricSlots: nonRubricSlots.length,
  statusCounts,
  sourceObservationSets: evidence.sourceObservationSets.length,
  blockedSlots: evidence.blockedSlots.length,
  newEditorialDimensionValuesMaterialized: evidence.scope.newEditorialDimensionValuesMaterialized,
  nextGate: evidence.nextGate,
}, null, 2))
ok(observedSha === EXPECTED, `unsealed editorial non-rubric dimension evidence completion wave 1 SHA: observed ${observedSha}; expected ${EXPECTED}`)
console.log('CONTENT-CORPUS-200 editorial non-rubric dimension evidence completion wave 1 verification passed')
