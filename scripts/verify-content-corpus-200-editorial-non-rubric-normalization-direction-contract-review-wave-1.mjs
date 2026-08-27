import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  evidence: p('content/corpus-200/editorial-non-rubric-normalization-direction-contract-review-wave-1.json'),
  authorization: p('content/corpus-200/editorial-rubric-dimension-authorization.json'),
  registry: p('content/corpus-200/editorial-dimension-contract-registry-and-evidence-plan.json'),
  priorEvidence: p('content/corpus-200/editorial-dimension-evidence-wave-1.json'),
  completion: p('content/corpus-200/editorial-non-rubric-dimension-evidence-completion-wave-1.json'),
  recovery: p('content/corpus-200/editorial-non-rubric-blocker-recovery-wave-1.json'),
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
const COMPLETION_SHA = '293906bd122dcc0ac5611a2a4bcc37195a2e4d8e2b5c15bf288e281e43ed025c'
const RECOVERY_SHA = '6ea390e55d827e3613f4cb35a4cd56468c7363c9dacecaaedbbd57fd23a47739'
const WAVE1_SHA = '7e0c2b11cf9f6f5b4468d3ab112a2fa31d5ace2a55ef4bca0713771647562f6c'
const EXPECTED = 'UNSEALED_EDITORIAL_NON_RUBRIC_NORMALIZATION_DIRECTION_CONTRACT_REVIEW_WAVE_1'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 editorial non-rubric normalization/direction contract review wave 1 verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
const sorted = (items) => [...items].sort()

for (const file of Object.values(files).flat()) ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)
const evidence = readJson(files.evidence)
const authorization = readJson(files.authorization)
const registry = readJson(files.registry)
const priorEvidence = readJson(files.priorEvidence)
const completion = readJson(files.completion)
const recovery = readJson(files.recovery)
const wave1 = readJson(files.wave1)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(authorization) === AUTHORIZATION_SHA, 'sealed authorization mutated')
ok(jsonSha(registry) === REGISTRY_SHA, 'sealed dimension registry mutated')
ok(jsonSha(priorEvidence) === PRIOR_EVIDENCE_SHA, 'sealed prior source evidence mutated')
ok(jsonSha(completion) === COMPLETION_SHA, 'sealed non-rubric completion evidence mutated')
ok(jsonSha(recovery) === RECOVERY_SHA, 'sealed blocker recovery evidence mutated')
ok(jsonSha(wave1) === WAVE1_SHA, 'sealed candidate/source wave 1 mutated')
ok(authorization.authorizedPreparation?.normalizationPlanDrafting === true, 'normalization plan drafting must remain authorized preparation')
ok(authorization.authorizedPreparation?.rowLevelEvidenceMatrixDrafting === true, 'row-level evidence matrix drafting must remain authorized preparation')
ok(authorization.stillProhibited?.automaticWeightAssignment === true, 'automatic weight assignment must remain prohibited')
ok(authorization.stillProhibited?.editorialCompositeScoreExecution === true, 'composite scoring must remain prohibited')
ok(authorization.weightBoundary?.weightsRemainUnassigned === true, 'weights must remain unassigned')
ok(priorEvidence.materializationPolicy?.directionRule === 'FACT_RANKING_DIRECTION_IS_NOT_AN_EDITORIAL_PREFERENCE_DIRECTION_AND_MUST_NOT_BE_INHERITED', 'FACT direction non-inheritance authority changed')
ok(priorEvidence.reviewSummary?.factDirectionsNotInherited === true, 'FACT directions must remain uninherited')
ok(recovery.nextGate === 'EDITORIAL_NON_RUBRIC_NORMALIZATION_AND_DIRECTION_CONTRACT_REVIEW_WAVE_1', 'blocker recovery must hand off to this gate')
ok(recovery.scope?.remainingBlockedSlots === 8, 'blocker recovery must retain eight blockers')

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

const waveFamilyIds = new Set((wave1.families || []).map((family) => family.familyId))
const sourceNames = new Set(registry.registryDerivation?.sourceMeasurableExactDimensionNames || [])
const mixedNames = new Set(registry.registryDerivation?.mixedEvidenceAndRubricExactDimensionNames || [])
const derivedNames = new Set(registry.registryDerivation?.deterministicDerivedExactDimensionNames || [])
const evidenceClassFor = (name) => sourceNames.has(name) ? 'SOURCE_MEASURABLE' : mixedNames.has(name) ? 'MIXED_EVIDENCE_AND_RUBRIC' : derivedNames.has(name) ? 'DETERMINISTIC_DERIVED' : 'EXPLICIT_EDITORIAL_RUBRIC'
const nonRubricSlots = []
for (const row of rows) {
  if (!waveFamilyIds.has(row.familyId) || row.contentType !== 'EDITORIAL_COMPOSITE') continue
  row.compositeDimensions.forEach((dimension, dimensionIndex) => {
    const evidenceClass = evidenceClassFor(dimension.name)
    if (evidenceClass !== 'EXPLICIT_EDITORIAL_RUBRIC') {
      nonRubricSlots.push({
        slotId: `${row.manifestId}:${dimensionIndex}:${dimension.name}`,
        manifestId: row.manifestId,
        dimensionIndex,
        dimensionName: dimension.name,
        evidenceClass,
      })
    }
  })
}
ok(nonRubricSlots.length === 15, `Wave 1 must retain 15 non-rubric slots, got ${nonRubricSlots.length}`)

const priorSlots = priorEvidence.sourceBindings.map((binding) => `${binding.editorialManifestId}:${binding.dimensionIndex}:${binding.dimensionName}`)
const completionObservationSlots = completion.sourceObservationSets.map((set) => set.slotId)
const recoverySlots = [recovery.recoveredSlot?.slotId]
const coveredSlots = [...priorSlots, ...completionObservationSlots, ...recoverySlots]
ok(new Set(coveredSlots).size === 7, `covered source slot union must be seven unique slots, got ${new Set(coveredSlots).size}`)
const expectedCoveredSlots = [
  'cc200-smartphones-05:4:무게',
  'cc200-smartphones-06:0:폭',
  'cc200-smartphones-06:1:무게',
  'cc200-smartphones-06:2:화면 크기',
  'cc200-kbo-clubs-05:0:홈런',
  'cc200-kbo-clubs-05:1:장타율',
  'cc200-korean-box-office-06:3:러닝타임',
]
ok(JSON.stringify(sorted(coveredSlots)) === JSON.stringify(sorted(expectedCoveredSlots)), 'covered source slots changed')
const blockedSlots = recovery.remainingBlockers.map((slot) => slot.slotId)
ok(blockedSlots.length === 8 && new Set(blockedSlots).size === 8, 'remaining blocker set must contain eight unique slots')
ok(JSON.stringify(sorted([...coveredSlots, ...blockedSlots])) === JSON.stringify(sorted(nonRubricSlots.map((slot) => slot.slotId))), 'covered plus blocked slots must partition all 15 Wave 1 non-rubric slots')

ok(evidence.version === 'content-corpus-200-editorial-non-rubric-normalization-direction-contract-review-wave-1-v1', 'evidence version mismatch')
ok(evidence.manifestVersion === manifest.manifestVersion && evidence.manifestSha256 === MANIFEST_SHA, 'manifest lineage mismatch')
ok(evidence.authorizationVersion === authorization.version && evidence.authorizationSha256 === AUTHORIZATION_SHA, 'authorization lineage mismatch')
ok(evidence.dimensionRegistryVersion === registry.version && evidence.dimensionRegistrySha256 === REGISTRY_SHA, 'registry lineage mismatch')
ok(evidence.priorSourceEvidenceVersion === priorEvidence.version && evidence.priorSourceEvidenceSha256 === PRIOR_EVIDENCE_SHA, 'prior source evidence lineage mismatch')
ok(evidence.completionEvidenceVersion === completion.version && evidence.completionEvidenceSha256 === COMPLETION_SHA, 'completion lineage mismatch')
ok(evidence.blockerRecoveryVersion === recovery.version && evidence.blockerRecoverySha256 === RECOVERY_SHA, 'recovery lineage mismatch')
ok(evidence.status === 'REVIEWED_WAVE_1_NORMALIZATION_AND_DIRECTION_CONTRACTS_ONLY_NO_VALUE_PROJECTION', 'evidence status mismatch')
ok(evidence.reviewedAt === '2026-08-27T18:35:00+09:00', 'review timestamp mismatch')
ok(JSON.stringify(evidence.scope) === JSON.stringify({
  waveNonRubricSlots: 15,
  sourceCoveredSlotsReviewed: 7,
  blockedSlotsExcludedFromDirectionAssignment: 8,
  identityUnitContracts: 6,
  deterministicUnitConversionPlans: 1,
  monotonicDirectionContracts: 5,
  contextualNonMonotonicContracts: 2,
  normalizationsExecuted: 0,
  normalizedCandidateValuesMaterialized: 0,
  editorialDimensionValuesMaterialized: 0,
  editorialPreferenceDirectionsMaterialized: 0,
  weightsAuthored: 0,
  compositeScoresAuthored: 0,
  editorialOrderingsAuthored: 0,
}), 'scope mismatch')

const policy = evidence.reviewPolicy || {}
ok(policy.contractReviewOnly === true, 'gate must remain contract-review-only')
ok(policy.directionRule === 'DIRECTION_CONTRACT_MUST_BE_REVIEWED_FROM_THE_EXACT_EDITORIAL_INTENT_AND_MUST_NEVER_BE_INHERITED_FROM_A_FACT_ASC_DESC_DIRECTION', 'direction review rule mismatch')
ok(policy.contextualRule === 'NON_MONOTONIC_CONTEXTUAL_MEANS_NO_SCALAR_PREFERENCE_TARGET_THRESHOLD_OR_MIDPOINT_IS_AUTHORIZED', 'contextual direction rule mismatch')
ok(policy.normalizationRule === 'UNIT_NORMALIZATION_MAY_BE_DECLARED_AS_A_DETERMINISTIC_FORMULA_PLAN_BUT_NO_PER_CANDIDATE_NORMALIZED_VALUE_IS_MATERIALIZED_AT_THIS_GATE', 'normalization plan rule mismatch')
ok(policy.blockedRule === 'BLOCKED_SOURCE_OR_METRIC_SLOTS_RECEIVE_NO_DIRECTION_OR_NORMALIZATION_CONTRACT_BY_INFERENCE', 'blocked contract rule mismatch')
ok(policy.partialRowScoring === 'FORBIDDEN' && policy.editorialValueProjection === 'NOT_AUTHORIZED_AT_THIS_GATE', 'scoring/value execution boundary mismatch')
ok(policy.normalizationExecution === 'NOT_AUTHORIZED_AT_THIS_GATE' && policy.weightAssignment === 'NOT_AUTHORIZED_AT_THIS_GATE', 'normalization/weight execution boundary mismatch')

ok(Array.isArray(evidence.coveredSlotContracts) && evidence.coveredSlotContracts.length === 7, 'must contain seven covered slot contracts')
ok(JSON.stringify(evidence.coveredSlotContracts.map((contract) => contract.slotId)) === JSON.stringify(expectedCoveredSlots), 'covered slot contract order/identity mismatch')
const contractBySlot = new Map(evidence.coveredSlotContracts.map((contract) => [contract.slotId, contract]))
ok(contractBySlot.size === 7, 'covered slot contracts must have unique slot IDs')
for (const contract of evidence.coveredSlotContracts) {
  const slot = nonRubricSlots.find((candidate) => candidate.slotId === contract.slotId)
  ok(slot, `${contract.slotId} must resolve to derived non-rubric slot`)
  ok(contract.evidenceClass === slot.evidenceClass, `${contract.slotId} evidence class mismatch`)
  const row = rowById.get(slot.manifestId)
  ok(row?.compositeDimensions?.[slot.dimensionIndex]?.name === slot.dimensionName, `${contract.slotId} manifest slot identity mismatch`)
  ok(row.compositeDimensions[slot.dimensionIndex].weightStatus === 'UNASSIGNED_PRE_MATERIALIZATION', `${contract.slotId} weight must remain unassigned`)
  ok(contract.directionContract?.materialized === false, `${contract.slotId} direction must not be materialized`)
  for (const forbidden of ['entries', 'values', 'normalizedEntries', 'normalizedValues', 'scores']) {
    ok(!(forbidden in contract), `${contract.slotId} contract must not contain ${forbidden}`)
  }
}

const expectedIntents = {
  'cc200-smartphones-05': '여행 중 사진·영상·줌·배터리를 한 기기로 해결하기 좋은가?',
  'cc200-smartphones-06': '작은 손에서도 그립과 무게 부담이 적은가?',
  'cc200-kbo-clubs-05': '장타와 득점 장면을 기대하는 팬에게 재미가 큰 팀은?',
  'cc200-korean-box-office-06': '취향 차이가 있어도 함께 보기 무난한 작품은?',
}
for (const [manifestId, rankingBasis] of Object.entries(expectedIntents)) ok(rowById.get(manifestId)?.rankingBasis === rankingBasis, `${manifestId} editorial intent changed`)

const expectedDirectionKinds = {
  'cc200-smartphones-05:4:무게': 'LOWER_IS_BETTER',
  'cc200-smartphones-06:0:폭': 'LOWER_IS_BETTER',
  'cc200-smartphones-06:1:무게': 'LOWER_IS_BETTER',
  'cc200-smartphones-06:2:화면 크기': 'NON_MONOTONIC_CONTEXTUAL',
  'cc200-kbo-clubs-05:0:홈런': 'HIGHER_IS_BETTER',
  'cc200-kbo-clubs-05:1:장타율': 'HIGHER_IS_BETTER',
  'cc200-korean-box-office-06:3:러닝타임': 'NON_MONOTONIC_CONTEXTUAL',
}
for (const [slotId, kind] of Object.entries(expectedDirectionKinds)) ok(contractBySlot.get(slotId)?.directionContract?.kind === kind, `${slotId} direction contract mismatch`)
const directionCounts = evidence.coveredSlotContracts.reduce((acc, contract) => { acc[contract.directionContract.kind] = (acc[contract.directionContract.kind] || 0) + 1; return acc }, {})
ok(JSON.stringify(directionCounts) === JSON.stringify({ LOWER_IS_BETTER: 3, NON_MONOTONIC_CONTEXTUAL: 2, HIGHER_IS_BETTER: 2 }), `direction counts mismatch: ${JSON.stringify(directionCounts)}`)

const identityUnits = {
  'cc200-smartphones-05:4:무게': 'g',
  'cc200-smartphones-06:0:폭': 'mm',
  'cc200-smartphones-06:1:무게': 'g',
  'cc200-kbo-clubs-05:0:홈런': 'count',
  'cc200-kbo-clubs-05:1:장타율': 'rate',
  'cc200-korean-box-office-06:3:러닝타임': 'min',
}
for (const [slotId, unit] of Object.entries(identityUnits)) {
  const unitContract = contractBySlot.get(slotId)?.unitContract
  ok(unitContract?.kind === 'IDENTITY' && unitContract.canonicalUnit === unit && unitContract.conversion === 'NONE', `${slotId} identity unit contract mismatch`)
}
ok(priorEvidence.sourceBindings.find((binding) => binding.editorialManifestId === 'cc200-smartphones-05')?.sourceMetric === 'officialWeightGrams', 'travel weight source metric changed')
ok(priorEvidence.sourceBindings.find((binding) => binding.editorialManifestId === 'cc200-smartphones-06')?.sourceMetric === 'officialWeightGrams', 'one-hand weight source metric changed')
ok(priorEvidence.sourceBindings.find((binding) => binding.editorialManifestId === 'cc200-kbo-clubs-05')?.sourceMetric === 'teamHomeRuns', 'KBO home-run source metric changed')
ok(completion.sourceObservationSets.find((set) => set.slotId === 'cc200-smartphones-06:0:폭')?.unit === 'mm', 'width source unit changed')
ok(completion.sourceObservationSets.find((set) => set.slotId === 'cc200-kbo-clubs-05:1:장타율')?.unit === 'rate', 'SLG source unit changed')
ok(recovery.runtimeObservationSet?.unit === 'min', 'runtime source unit changed')

const displayContract = contractBySlot.get('cc200-smartphones-06:2:화면 크기')
ok(displayContract?.unitContract?.kind === 'DETERMINISTIC_UNIT_CONVERSION_PLAN', 'display must use deterministic unit conversion plan')
ok(displayContract.unitContract.canonicalUnit === 'mm', 'display canonical unit must be mm')
ok(JSON.stringify(displayContract.unitContract.acceptedInputUnits) === JSON.stringify(['mm','cm']), 'display accepted units mismatch')
ok(displayContract.unitContract.formula === 'mm => value; cm => value * 10; otherwise BLOCK', 'display conversion formula mismatch')
ok(displayContract.unitContract.normalizedValuesMaterialized === false, 'display normalized values must not materialize')
const rawDisplay = completion.sourceObservationSets.find((set) => set.slotId === 'cc200-smartphones-06:2:화면 크기')
ok(JSON.stringify(rawDisplay?.unitsSeen) === JSON.stringify(['mm','cm']), 'raw display evidence must remain mixed-unit mm/cm')
ok(rawDisplay?.normalizationMaterialized === false, 'upstream display normalization must remain unexecuted')

ok(Array.isArray(evidence.blockedSlotExclusions) && evidence.blockedSlotExclusions.length === 8, 'must contain eight blocked slot exclusions')
ok(JSON.stringify(evidence.blockedSlotExclusions.map((slot) => slot.slotId)) === JSON.stringify(blockedSlots), 'blocked slot exclusions must exactly match sealed recovery blockers')
for (const exclusion of evidence.blockedSlotExclusions) {
  ok(exclusion.directionContract.startsWith('UNASSIGNED_BLOCKED'), `${exclusion.slotId} must have no direction contract`)
  ok(exclusion.normalizationContract.startsWith('UNASSIGNED_BLOCKED'), `${exclusion.slotId} must have no normalization contract`)
}
const kboAway = evidence.blockedSlotExclusions.find((slot) => slot.slotId === 'cc200-kbo-clubs-07:0:원정 일정')
ok(kboAway?.directionContract === 'UNASSIGNED_BLOCKED_METRIC_CONTRACT_UNRESOLVED', 'KBO away direction must remain blocked on metric contract')

const summary = evidence.reviewSummary || {}
ok(summary.factDirectionsInherited === false, 'FACT directions must not be inherited')
ok(summary.displayUnitConversionPlanReviewedWithoutExecution === true, 'display conversion must remain plan-only')
ok(summary.contextualSlotsRemainWithoutScalarPreference === true, 'contextual slots must remain non-scalar')
ok(summary.blockedSlotsRemainWithoutInferredContracts === true, 'blocked slots must remain without inferred contracts')
ok(summary.normalizedCandidateValuesMaterialized === 0 && summary.editorialDimensionValuesMaterialized === 0, 'normalized/editorial values must remain zero')
ok(summary.weightsAuthored === 0 && summary.compositeScoringExecuted === false && summary.editorialOrderingMaterialized === false, 'weights/scoring/ordering must remain unexecuted')
ok(summary.scoringExecutionReadyRows === 0, 'scoring-ready rows must remain zero')
for (const forbidden of ['dimensionValues','normalizedCandidateValues','weights','compositeScores','editorialOrderings','candidateOutcomes']) ok(!(forbidden in evidence), `evidence must not contain top-level ${forbidden}`)
ok(evidence.gateDisposition === 'WAVE_1_NORMALIZATION_AND_DIRECTION_CONTRACTS_REVIEWED_FOR_SEVEN_SOURCE_COVERED_SLOTS_WITH_ZERO_NORMALIZATION_EXECUTION_AND_ZERO_EDITORIAL_VALUES', 'gate disposition mismatch')
ok(evidence.nextGate === 'EDITORIAL_RUBRIC_CANDIDATE_EVIDENCE_MATRIX_WAVE_1', 'next gate mismatch')
ok(Object.values(evidence.authorityBoundary || {}).every((value) => value === false), 'execution/public authority must remain disabled')

ok(!page.includes('editorial-non-rubric-normalization-direction-contract-review-wave-1.json'), 'public ranking page must not consume normalization/direction contract evidence')
ok(pkg.scripts?.['verify:content-corpus-200-editorial-non-rubric-normalization-direction-contract-review-wave-1'] === 'node scripts/verify-content-corpus-200-editorial-non-rubric-normalization-direction-contract-review-wave-1.mjs', 'package script wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-editorial-non-rubric-normalization-direction-contract-review-wave-1'), 'CI must run normalization/direction contract verifier')

const observedSha = jsonSha(evidence)
console.log(JSON.stringify({
  version: evidence.version,
  manifestSha256: MANIFEST_SHA,
  evidenceSha256: observedSha,
  waveNonRubricSlots: nonRubricSlots.length,
  sourceCoveredSlotsReviewed: coveredSlots.length,
  blockedSlotsExcluded: blockedSlots.length,
  identityUnitContracts: evidence.scope.identityUnitContracts,
  deterministicUnitConversionPlans: evidence.scope.deterministicUnitConversionPlans,
  directionCounts,
  normalizationsExecuted: evidence.scope.normalizationsExecuted,
  editorialDimensionValuesMaterialized: evidence.scope.editorialDimensionValuesMaterialized,
  nextGate: evidence.nextGate,
}, null, 2))
ok(observedSha === EXPECTED, `unsealed editorial non-rubric normalization/direction contract review wave 1 SHA: observed ${observedSha}; expected ${EXPECTED}`)
console.log('CONTENT-CORPUS-200 editorial non-rubric normalization/direction contract review wave 1 verification passed')
