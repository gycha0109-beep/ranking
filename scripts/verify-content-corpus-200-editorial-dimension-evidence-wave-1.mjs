import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  evidence: p('content/corpus-200/editorial-dimension-evidence-wave-1.json'),
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
const REGISTRY_SHA = 'c0e71b22456b805bfa351eb53f92f121cb6f9d23df1518c5f55ff2b33a1e11c7'
const WAVE1_SHA = '7e0c2b11cf9f6f5b4468d3ab112a2fa31d5ace2a55ef4bca0713771647562f6c'
const EXPECTED = 'UNSEALED_EDITORIAL_DIMENSION_EVIDENCE_WAVE_1'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 editorial dimension evidence wave 1 verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files).flat()) ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)

const evidence = readJson(files.evidence)
const registry = readJson(files.registry)
const wave1 = readJson(files.wave1)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(registry) === REGISTRY_SHA, 'sealed dimension registry evidence mutated')
ok(registry.version === 'content-corpus-200-editorial-dimension-contract-registry-and-evidence-plan-v1', 'dimension registry version mismatch')
ok(registry.manifestSha256 === MANIFEST_SHA, 'dimension registry manifest lineage mismatch')
ok(registry.nextGate === 'EDITORIAL_DIMENSION_EVIDENCE_MATERIALIZATION_WAVE_1', 'dimension registry must hand off to wave 1 evidence materialization')
ok(registry.scope?.materializedDimensionValues === 0, 'dimension registry must retain zero materialized dimension values before this gate')
ok(registry.weightBoundary?.weightsRemainUnassigned === true, 'dimension registry weights must remain unassigned')
ok(registry.weightBoundary?.weightDraftingAuthorized === false, 'dimension registry must not authorize weight drafting')
ok(registry.weightBoundary?.weightReviewAuthorized === false, 'dimension registry must not authorize weight review')
ok(Object.values(registry.authorityBoundary || {}).every((value) => value === false), 'dimension registry execution/public authority must remain disabled')

ok(jsonSha(wave1) === WAVE1_SHA, 'sealed candidate/source materialization wave 1 mutated')
ok(wave1.version === 'content-corpus-200-wave-1-v1', 'candidate/source wave 1 version mismatch')
ok(wave1.manifestSha256 === MANIFEST_SHA, 'candidate/source wave 1 manifest lineage mismatch')
ok(wave1.authorityBoundary?.editorialScoringAuthorized === false, 'candidate/source wave 1 must not authorize editorial scoring')

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

const waveEditorialIds = []
for (const family of wave1.families || []) {
  ok(family.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', `${family.familyId} candidate universe must remain source-backed and frozen`)
  ok(Array.isArray(family.candidateUniverse?.items) && family.candidateUniverse.items.length > 0, `${family.familyId} candidate universe must remain non-empty`)
  for (const ranking of family.rankings || []) {
    if (ranking.kind === 'EDITORIAL_COMPOSITE') {
      waveEditorialIds.push(ranking.manifestId)
      ok(ranking.materializationStatus === 'CANDIDATES_FROZEN_SCORING_UNASSIGNED', `${ranking.manifestId} must remain candidate-frozen and scoring-unassigned`)
    }
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

let wave1DimensionSlots = 0
const wave1ClassCounts = {
  SOURCE_MEASURABLE: 0,
  DETERMINISTIC_DERIVED: 0,
  EXPLICIT_EDITORIAL_RUBRIC: 0,
  MIXED_EVIDENCE_AND_RUBRIC: 0,
}
for (const manifestId of waveEditorialIds) {
  const row = rowById.get(manifestId)
  ok(row?.contentType === 'EDITORIAL_COMPOSITE', `${manifestId} must resolve to manifest editorial row`)
  ok(row.compositeFormula === 'WEIGHTS_NOT_ASSIGNED_PRE_MATERIALIZATION', `${manifestId} composite formula must remain unassigned`)
  ok(row.compositeDimensions.every((dimension) => dimension.weightStatus === 'UNASSIGNED_PRE_MATERIALIZATION'), `${manifestId} weights must remain unassigned`)
  for (const dimension of row.compositeDimensions) {
    wave1DimensionSlots += 1
    wave1ClassCounts[evidenceClassFor(dimension.name)] += 1
  }
}

ok(evidence.version === 'content-corpus-200-editorial-dimension-evidence-wave-1-v1', 'evidence version mismatch')
ok(evidence.manifestVersion === manifest.manifestVersion && evidence.manifestSha256 === MANIFEST_SHA, 'evidence manifest lineage mismatch')
ok(evidence.dimensionRegistryVersion === registry.version && evidence.dimensionRegistrySha256 === REGISTRY_SHA, 'evidence registry lineage mismatch')
ok(evidence.candidateMaterializationWaveVersion === wave1.version && evidence.candidateMaterializationWaveSha256 === WAVE1_SHA, 'evidence candidate/source wave lineage mismatch')
ok(evidence.status === 'MATERIALIZED_EXACT_FROZEN_FACT_BINDINGS_ONLY_NO_EDITORIAL_SCORING', 'evidence status mismatch')
ok(evidence.observedAt === '2026-08-26T13:11:20+09:00', 'evidence observation timestamp mismatch')
ok(JSON.stringify(evidence.scope) === JSON.stringify({
  waveFamilies: expectedWaveFamilies,
  waveEditorialRows: 25,
  materializedSourceBindings: 3,
  newNumericValuesAuthored: 0,
  rubricDefinitionsAuthored: 0,
  rubricOutcomesAuthored: 0,
  weightsAuthored: 0,
  compositeScoresAuthored: 0,
  editorialOrderingsAuthored: 0,
}), 'evidence scope mismatch')

const policy = evidence.materializationPolicy || {}
ok(policy.allowedProjection === 'REUSE_EXACT_MATERIALIZED_FACT_ENTRIES_WITHIN_THE_SAME_FAMILY_AND_EXACT_CANDIDATE_UNIVERSE_NO_TRANSFORM', 'allowed projection policy mismatch')
ok(policy.candidateCoverageRule === 'FACT_ENTRY_ITEM_KEYS_MUST_EXACTLY_MATCH_THE_EDITORIAL_CANDIDATE_UNIVERSE', 'candidate coverage policy mismatch')
ok(policy.sourceSnapshotRule === 'SOURCE_SNAPSHOT_IDS_ARE_INHERITED_FROM_THE_MATERIALIZED_FACT_WITHOUT_REINTERPRETATION', 'source snapshot policy mismatch')
ok(policy.numericValueRule === 'NO_NEW_NUMERIC_VALUE_MAY_BE_AUTHORED_OR_INFERRED_IN_THIS_GATE', 'numeric value policy mismatch')
ok(policy.directionRule === 'FACT_RANKING_DIRECTION_IS_NOT_AN_EDITORIAL_PREFERENCE_DIRECTION_AND_MUST_NOT_BE_INHERITED', 'direction boundary mismatch')
ok(policy.normalizationRule === 'NO_EDITORIAL_NORMALIZATION_OR_SCALE_TRANSFORM_IS_AUTHORIZED', 'normalization boundary mismatch')
ok(policy.partialCoverageRule === 'PARTIAL_FACT_COVERAGE_CANNOT_BE_PROJECTED_AS_EDITORIAL_DIMENSION_EVIDENCE', 'partial coverage boundary mismatch')

const expectedBindings = [
  ['cc200-smartphones-05', 4, '무게', 'cc200-smartphones-03', 'officialWeightGrams'],
  ['cc200-smartphones-06', 1, '무게', 'cc200-smartphones-03', 'officialWeightGrams'],
  ['cc200-kbo-clubs-05', 0, '홈런', 'cc200-kbo-clubs-02', 'teamHomeRuns'],
]
ok(Array.isArray(evidence.sourceBindings) && evidence.sourceBindings.length === expectedBindings.length, 'source binding count mismatch')
const slotIds = new Set()
let projectedCandidateObservations = 0
for (let i = 0; i < evidence.sourceBindings.length; i += 1) {
  const binding = evidence.sourceBindings[i]
  const [manifestId, dimensionIndex, dimensionName, sourceFactManifestId, sourceMetric] = expectedBindings[i]
  ok(binding.editorialManifestId === manifestId, `binding ${i} editorial manifest mismatch`)
  ok(binding.dimensionIndex === dimensionIndex, `binding ${i} dimension index mismatch`)
  ok(binding.dimensionName === dimensionName, `binding ${i} dimension name mismatch`)
  ok(binding.evidenceClass === 'SOURCE_MEASURABLE', `binding ${i} evidence class mismatch`)
  ok(binding.sourceFactManifestId === sourceFactManifestId, `binding ${i} source fact mismatch`)
  ok(binding.sourceMetric === sourceMetric, `binding ${i} source metric mismatch`)
  ok(binding.projection === 'REUSE_EXACT_FACT_ENTRIES_NO_TRANSFORM', `binding ${i} projection mismatch`)
  ok(binding.editorialPreferenceDirectionMaterialized === false, `binding ${i} must not materialize editorial preference direction`)
  ok(binding.normalizationMaterialized === false, `binding ${i} must not materialize normalization`)
  ok(!('direction' in binding) && !('entries' in binding) && !('values' in binding) && !('value' in binding) && !('score' in binding) && !('weight' in binding), `binding ${i} must contain no copied values/directions/scores/weights`)

  const slotId = `${manifestId}:${dimensionIndex}:${dimensionName}`
  ok(!slotIds.has(slotId), `duplicate source binding slot ${slotId}`)
  slotIds.add(slotId)

  const editorialRow = rowById.get(manifestId)
  ok(editorialRow?.contentType === 'EDITORIAL_COMPOSITE', `${manifestId} must resolve to editorial row`)
  ok(editorialRow.compositeDimensions?.[dimensionIndex]?.name === dimensionName, `${slotId} must match exact frozen manifest slot`)
  ok(evidenceClassFor(dimensionName) === 'SOURCE_MEASURABLE', `${slotId} must be SOURCE_MEASURABLE in sealed registry`)

  const family = waveFamilyById.get(editorialRow.familyId)
  ok(family, `${manifestId} family must exist in candidate/source wave 1`)
  const editorialMaterialization = (family.rankings || []).find((ranking) => ranking.manifestId === manifestId)
  ok(editorialMaterialization?.kind === 'EDITORIAL_COMPOSITE', `${manifestId} must be editorial in candidate/source wave 1`)
  ok(editorialMaterialization.materializationStatus === 'CANDIDATES_FROZEN_SCORING_UNASSIGNED', `${manifestId} must remain scoring-unassigned`)

  const sourceFactRow = rowById.get(sourceFactManifestId)
  ok(sourceFactRow?.familyId === editorialRow.familyId && sourceFactRow.contentType === 'FACT', `${sourceFactManifestId} must be same-family FACT manifest row`)
  const sourceFact = (family.rankings || []).find((ranking) => ranking.manifestId === sourceFactManifestId)
  ok(sourceFact?.kind === 'FACT' && sourceFact.materializationStatus === 'MATERIALIZED_FACT', `${sourceFactManifestId} must be a materialized FACT`)
  ok(sourceFact.metric === sourceMetric, `${sourceFactManifestId} metric mismatch`)
  ok(Array.isArray(sourceFact.sourceSnapshotIds) && sourceFact.sourceSnapshotIds.length > 0, `${sourceFactManifestId} must retain source snapshots`)
  ok(Array.isArray(sourceFact.entries) && sourceFact.entries.length > 0, `${sourceFactManifestId} must retain fact entries`)

  const candidates = family.candidateUniverse.items || []
  const candidateKeyToLabel = new Map(candidates.map((item) => [item.itemKey, item.label]))
  const factKeyToEntry = new Map(sourceFact.entries.map((entry) => [entry.itemKey, entry]))
  ok(factKeyToEntry.size === sourceFact.entries.length, `${sourceFactManifestId} fact item keys must be unique`)
  ok(candidateKeyToLabel.size === candidates.length, `${editorialRow.familyId} candidate item keys must be unique`)
  ok(factKeyToEntry.size === candidateKeyToLabel.size, `${sourceFactManifestId} must cover the full editorial candidate universe`)
  for (const [itemKey, label] of candidateKeyToLabel) {
    const entry = factKeyToEntry.get(itemKey)
    ok(entry, `${sourceFactManifestId} missing candidate ${itemKey}`)
    ok(entry.label === label, `${sourceFactManifestId} label mismatch for ${itemKey}`)
    ok(typeof entry.value === 'number' && Number.isFinite(entry.value), `${sourceFactManifestId} must retain finite observed numeric value for ${itemKey}`)
  }
  for (const snapshotId of sourceFact.sourceSnapshotIds) {
    ok((family.candidateUniverse.sourceSnapshotIds || []).includes(snapshotId), `${sourceFactManifestId} snapshot ${snapshotId} must belong to the frozen family source surface`)
  }
  projectedCandidateObservations += sourceFact.entries.length
}
ok(projectedCandidateObservations === 26, `exact fact projections must expose 26 frozen candidate observations, got ${projectedCandidateObservations}`)

const nonMaterialized = evidence.nonMaterializedPolicy || {}
ok(nonMaterialized.allOtherWave1SourceMeasurableSlots === 'PENDING_EXACT_SOURCE_OR_FULL_CANDIDATE_COVERAGE', 'unbound source-measurable slot policy mismatch')
ok(nonMaterialized.allWave1ExplicitEditorialRubricSlots === 'PENDING_REVIEWED_RUBRIC_DEFINITION', 'rubric slot policy mismatch')
ok(nonMaterialized.allWave1MixedSlots === 'PENDING_COMPLETE_OBSERVED_INPUTS_AND_REVIEWED_JOIN_RULE', 'mixed slot policy mismatch')
ok(nonMaterialized.allWave1DeterministicDerivedSlots === 'PENDING_REVIEWED_FORMULA', 'derived slot policy mismatch')
ok(nonMaterialized.missingEvidenceImputation === 'FORBIDDEN', 'missing evidence imputation must remain forbidden')
ok(nonMaterialized.crossDimensionProxySubstitution === 'FORBIDDEN', 'cross-dimension proxy substitution must remain forbidden')
ok(nonMaterialized.crossCandidateInference === 'FORBIDDEN', 'cross-candidate inference must remain forbidden')

ok(evidence.reviewSummary?.bindingsAreEvidenceReferencesNotCopiedScores === true, 'bindings must remain evidence references, not scores')
ok(evidence.reviewSummary?.factDirectionsNotInherited === true, 'fact directions must not be inherited')
ok(evidence.reviewSummary?.candidateCoverageMustBeExact === true, 'candidate coverage must remain exact')
ok(evidence.reviewSummary?.sourceSnapshotsRemainFrozen === true, 'source snapshots must remain frozen')
ok(evidence.reviewSummary?.newNumericValuesAuthored === 0, 'new numeric values must remain zero')
ok(evidence.reviewSummary?.subjectiveNumericValuesAuthored === 0, 'subjective numeric values must remain zero')
ok(evidence.reviewSummary?.fabricatedValues === 0 && evidence.reviewSummary?.fabricatedWeights === 0, 'fabricated values/weights must remain zero')
ok(evidence.reviewSummary?.scoringExecutionReadyRows === 0, 'scoring-ready rows must remain zero')
ok(evidence.gateDisposition === 'WAVE_1_EXACT_SOURCE_EVIDENCE_BINDINGS_MATERIALIZED_WITH_ZERO_NEW_VALUES_AND_ZERO_SCORING', 'gate disposition mismatch')
ok(evidence.nextGate === 'EDITORIAL_EXPLICIT_RUBRIC_DEFINITION_WAVE_1', 'next gate mismatch')
ok(Object.values(evidence.authorityBoundary || {}).every((value) => value === false), 'production/scoring/public authority must remain disabled')

ok(!page.includes('editorial-dimension-evidence-wave-1.json'), 'public ranking page must not consume editorial evidence wave 1')
ok(pkg.scripts?.['verify:content-corpus-200-editorial-dimension-evidence-wave-1'] === 'node scripts/verify-content-corpus-200-editorial-dimension-evidence-wave-1.mjs', 'package script wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-editorial-dimension-evidence-wave-1'), 'CI must run editorial dimension evidence wave 1 verifier')

const observedSha = jsonSha(evidence)
console.log(JSON.stringify({
  version: evidence.version,
  manifestSha256: MANIFEST_SHA,
  registrySha256: REGISTRY_SHA,
  candidateMaterializationWaveSha256: WAVE1_SHA,
  evidenceSha256: observedSha,
  waveEditorialRows: waveEditorialIds.length,
  wave1DimensionSlots,
  wave1ClassCounts,
  materializedSourceBindings: evidence.sourceBindings.length,
  projectedCandidateObservations,
  newNumericValuesAuthored: evidence.scope.newNumericValuesAuthored,
  nextGate: evidence.nextGate,
}, null, 2))
ok(observedSha === EXPECTED, `unsealed editorial dimension evidence wave 1 SHA: observed ${observedSha}; expected ${EXPECTED}`)
console.log('CONTENT-CORPUS-200 editorial dimension evidence wave 1 verification passed')
