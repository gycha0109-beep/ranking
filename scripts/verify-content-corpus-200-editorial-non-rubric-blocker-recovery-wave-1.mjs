import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  evidence: p('content/corpus-200/editorial-non-rubric-blocker-recovery-wave-1.json'),
  completion: p('content/corpus-200/editorial-non-rubric-dimension-evidence-completion-wave-1.json'),
  authorization: p('content/corpus-200/editorial-rubric-dimension-authorization.json'),
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
const AUTHORIZATION_SHA = 'e923fc17e84030f79d402ccd1188e940bd4482ca4547a0ea6f81202bc360afe0'
const REGISTRY_SHA = 'c0e71b22456b805bfa351eb53f92f121cb6f9d23df1518c5f55ff2b33a1e11c7'
const COMPLETION_SHA = '293906bd122dcc0ac5611a2a4bcc37195a2e4d8e2b5c15bf288e281e43ed025c'
const WAVE1_SHA = '7e0c2b11cf9f6f5b4468d3ab112a2fa31d5ace2a55ef4bca0713771647562f6c'
const EXPECTED = 'UNSEALED_EDITORIAL_NON_RUBRIC_BLOCKER_RECOVERY_WAVE_1'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 editorial non-rubric blocker recovery wave 1 verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of Object.values(files).flat()) ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)
const evidence = readJson(files.evidence)
const completion = readJson(files.completion)
const authorization = readJson(files.authorization)
const registry = readJson(files.registry)
const wave1 = readJson(files.wave1)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(completion) === COMPLETION_SHA, 'sealed non-rubric completion evidence mutated')
ok(jsonSha(authorization) === AUTHORIZATION_SHA, 'sealed authorization mutated')
ok(jsonSha(registry) === REGISTRY_SHA, 'sealed dimension registry mutated')
ok(jsonSha(wave1) === WAVE1_SHA, 'sealed candidate/source wave 1 mutated')
ok(completion.scope?.blockedSlots === 9, 'upstream completion must retain nine blockers')
ok(completion.scope?.newEditorialDimensionValuesMaterialized === 0, 'upstream completion must retain zero editorial values')
ok(authorization.authorizedPreparation?.objectiveSourceEvidenceCollection === true, 'source evidence collection must remain authorized preparation')
ok(authorization.stillProhibited?.editorialCompositeScoreExecution === true, 'composite scoring must remain prohibited')
ok(authorization.weightBoundary?.weightsRemainUnassigned === true, 'weights must remain unassigned')
ok(registry.evidencePlanByClass?.SOURCE_MEASURABLE?.valueAuthoringAtThisGate === false, 'source-measurable values must not be authorized by registry gate')

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
const familyById = new Map((wave1.families || []).map((family) => [family.familyId, family]))

const recoveredSlotId = 'cc200-korean-box-office-06:3:러닝타임'
const upstreamBlocked = completion.blockedSlots.map((slot) => slot.slotId)
ok(upstreamBlocked.includes(recoveredSlotId), 'runtime slot must be blocked in sealed completion evidence')
const runtimeRow = rowById.get('cc200-korean-box-office-06')
ok(runtimeRow?.contentType === 'EDITORIAL_COMPOSITE', 'runtime row must remain editorial composite')
ok(runtimeRow.compositeDimensions?.[3]?.name === '러닝타임', 'runtime slot identity changed in manifest')
ok(runtimeRow.compositeDimensions?.[3]?.weightStatus === 'UNASSIGNED_PRE_MATERIALIZATION', 'runtime slot weight must remain unassigned')
ok(runtimeRow.compositeFormula === 'WEIGHTS_NOT_ASSIGNED_PRE_MATERIALIZATION', 'runtime row formula must remain unassigned')

ok(evidence.version === 'content-corpus-200-editorial-non-rubric-blocker-recovery-wave-1-v1', 'evidence version mismatch')
ok(evidence.manifestVersion === manifest.manifestVersion && evidence.manifestSha256 === MANIFEST_SHA, 'manifest lineage mismatch')
ok(evidence.authorizationVersion === authorization.version && evidence.authorizationSha256 === AUTHORIZATION_SHA, 'authorization lineage mismatch')
ok(evidence.dimensionRegistryVersion === registry.version && evidence.dimensionRegistrySha256 === REGISTRY_SHA, 'registry lineage mismatch')
ok(evidence.completionEvidenceVersion === completion.version && evidence.completionEvidenceSha256 === COMPLETION_SHA, 'completion evidence lineage mismatch')
ok(evidence.candidateMaterializationWaveVersion === wave1.version && evidence.candidateMaterializationWaveSha256 === WAVE1_SHA, 'wave 1 lineage mismatch')
ok(evidence.status === 'RECOVERED_ONE_OF_NINE_NON_RUBRIC_BLOCKERS_WITH_FULL_CANDIDATE_OFFICIAL_RUNTIME_EVIDENCE_NO_EDITORIAL_VALUES', 'evidence status mismatch')
ok(evidence.reviewedAt === '2026-08-27T13:30:00+09:00', 'review timestamp mismatch')
ok(JSON.stringify(evidence.scope) === JSON.stringify({
  incomingBlockedSlots: 9,
  recoveredSlots: 1,
  remainingBlockedSlots: 8,
  runtimeFrozenCandidates: 10,
  runtimeSourceObservations: 10,
  newSourceObservationSets: 1,
  newEditorialDimensionValuesMaterialized: 0,
  newEditorialPreferenceDirectionsAssigned: 0,
  normalizationsExecuted: 0,
  weightsAuthored: 0,
  compositeScoresAuthored: 0,
  editorialOrderingsAuthored: 0,
}), 'scope mismatch')

const policy = evidence.recoveryPolicy || {}
ok(policy.sourceObservationIsEditorialValue === false, 'source observations must not become editorial values')
ok(policy.editorialValueProjection === 'NOT_AUTHORIZED_AT_THIS_GATE', 'editorial value projection must remain unauthorized')
ok(policy.preferenceDirectionAssignment === 'NOT_AUTHORIZED_AT_THIS_GATE', 'preference direction assignment must remain unauthorized')
ok(policy.candidateUniverseMutation === 'FORBIDDEN', 'candidate universe mutation must remain forbidden')
ok(policy.partialRecovery === 'FORBIDDEN' && policy.proxySubstitution === 'FORBIDDEN', 'partial/proxy recovery must remain forbidden')

const recovered = evidence.recoveredSlot || {}
ok(recovered.slotId === recoveredSlotId && recovered.manifestId === 'cc200-korean-box-office-06', 'recovered slot identity mismatch')
ok(recovered.dimensionIndex === 3 && recovered.dimensionName === '러닝타임', 'recovered runtime dimension mismatch')
ok(recovered.evidenceClass === 'SOURCE_MEASURABLE', 'runtime must remain source measurable')
ok(recovered.priorStatus === 'BLOCKED' && recovered.recoveredStatus === 'FULL_CANDIDATE_SOURCE_OBSERVATIONS_COMPLETE', 'runtime recovery status mismatch')
ok(recovered.editorialDimensionValueMaterialized === false, 'runtime recovery must not materialize editorial values')

const runtimeSet = evidence.runtimeObservationSet || {}
ok(runtimeSet.slotId === recoveredSlotId, 'runtime observation slot mismatch')
ok(runtimeSet.candidateCoverage === '10_OF_10_FROZEN_CANDIDATES', 'runtime candidate coverage mismatch')
ok(runtimeSet.unit === 'min', 'runtime observation unit must be minutes')
ok(runtimeSet.status === 'FULL_CANDIDATE_SOURCE_OBSERVATIONS_COMPLETE_NO_EDITORIAL_VALUE_PROJECTION', 'runtime observation status mismatch')
const koreanFamily = familyById.get('korean-box-office')
ok(koreanFamily?.candidateUniverse?.status === 'FROZEN_SOURCE_BACKED', 'Korean box office candidate universe must remain frozen')
const frozenKeys = koreanFamily.candidateUniverse.items.map((item) => item.itemKey)
const expectedKeys = ['the-kings-warden','colony','hope','salmokji-whispering-water','once-we-were-us','humint','the-eyes','choir-of-god','wild-sing','heartsping-legend-of-whale-jewel']
ok(JSON.stringify(frozenKeys) === JSON.stringify(expectedKeys), 'frozen Korean box office candidate order changed')
ok(Array.isArray(runtimeSet.entries) && runtimeSet.entries.length === 10, 'runtime evidence must contain ten entries')
ok(JSON.stringify(runtimeSet.entries.map((entry) => entry.itemKey)) === JSON.stringify(frozenKeys), 'runtime evidence must cover frozen candidates exactly and in order')
ok(new Set(runtimeSet.entries.map((entry) => entry.itemKey)).size === 10, 'runtime candidate keys must be unique')
ok(runtimeSet.entries.every((entry) => entry.unit === 'min' && Number.isInteger(entry.value) && entry.value > 0), 'runtime values must be positive integer source observations in minutes')
const expectedRuntimeValues = [116,122,156,95,114,119,105,110,107,105]
ok(JSON.stringify(runtimeSet.entries.map((entry) => entry.value)) === JSON.stringify(expectedRuntimeValues), 'reviewed runtime observations changed')
const expectedAuthorities = ['KOFIC_KOBIZ','KOFIC_KOBIZ','KOFIC_KOBIZ','KOFIC_KOBIZ','KOFIC_KOBIZ','KOFIC_KOBIZ','LSF_INDONESIA_OFFICIAL_FILM_CLASSIFICATION','KOFIC_KOBIZ','KBS_WORLD_OFFICIAL','KOFIC_OFFICIAL']
ok(JSON.stringify(runtimeSet.entries.map((entry) => entry.sourceAuthority)) === JSON.stringify(expectedAuthorities), 'runtime source authority mapping changed')
const allowedOfficialHosts = new Set(['www.koreanfilm.or.kr','koreanfilm.or.kr','lsf.go.id','world.kbs.co.kr','kofic.kr'])
for (const entry of runtimeSet.entries) {
  const url = new URL(entry.sourceUrl)
  ok(url.protocol === 'https:', `${entry.itemKey} runtime source must use https`)
  ok(allowedOfficialHosts.has(url.hostname), `${entry.itemKey} runtime source host is not in reviewed official set: ${url.hostname}`)
}

ok(Array.isArray(evidence.remainingBlockers) && evidence.remainingBlockers.length === 8, 'exactly eight blockers must remain')
const expectedRemaining = upstreamBlocked.filter((slotId) => slotId !== recoveredSlotId)
ok(JSON.stringify(evidence.remainingBlockers.map((slot) => slot.slotId)) === JSON.stringify(expectedRemaining), 'remaining blockers must equal upstream blockers minus recovered runtime slot')
ok(evidence.remainingBlockers.every((slot) => typeof slot.blocker === 'string' && slot.blocker.length > 25), 'every remaining blocker must retain explicit rationale')
const kboAway = evidence.remainingBlockers.find((slot) => slot.slotId === 'cc200-kbo-clubs-07:0:원정 일정')
ok(kboAway?.status === 'BLOCKED_SOURCE_SURFACE_FOUND_METRIC_CONTRACT_UNRESOLVED', 'KBO away schedule blocker must be refined without recovery')
ok(Array.isArray(kboAway.reviewedOfficialSources) && kboAway.reviewedOfficialSources.length === 3, 'KBO away schedule must retain three reviewed official sources')
ok(kboAway.reviewedOfficialSources.every((url) => new URL(url).hostname === 'www.koreabaseball.com'), 'KBO away schedule sources must remain official KBO hosts')

const summary = evidence.recoverySummary || {}
ok(summary.runtimeBlockerRecovered === true && summary.runtimeCandidateCoverageComplete === true, 'runtime recovery summary mismatch')
ok(summary.kboAwayScheduleSourceSurfaceRecovered === true && summary.kboAwayScheduleMetricContractRecovered === false, 'KBO blocker refinement summary mismatch')
ok(summary.netflixCandidateScopeMismatchResolved === false, 'Netflix candidate scope mismatch must remain unresolved')
ok(summary.steamFullCandidateSourceCoverageResolved === false, 'Steam blocker must remain unresolved')
ok(summary.smartphoneMixedJoinRulesResolved === false, 'smartphone mixed join blockers must remain unresolved')
ok(summary.newEditorialDimensionValuesMaterialized === 0, 'editorial values must remain zero')
ok(summary.weightsAuthored === 0 && summary.compositeScoringExecuted === false && summary.editorialOrderingMaterialized === false, 'weight/scoring/ordering work must remain unexecuted')
ok(summary.scoringExecutionReadyRows === 0, 'scoring-ready rows must remain zero')
for (const forbidden of ['dimensionValues','weights','compositeScores','editorialOrderings','candidateOutcomes']) {
  ok(!(forbidden in evidence), `evidence must not contain top-level ${forbidden}`)
}
ok(evidence.gateDisposition === 'WAVE_1_NON_RUBRIC_BLOCKER_RECOVERY_RECOVERED_KOREAN_FILM_RUNTIME_ONE_OF_NINE_AND_REFINED_KBO_AWAY_SCHEDULE_BLOCKER_WITH_ZERO_EDITORIAL_VALUES', 'gate disposition mismatch')
ok(evidence.nextGate === 'EDITORIAL_NON_RUBRIC_NORMALIZATION_AND_DIRECTION_CONTRACT_REVIEW_WAVE_1', 'next gate mismatch')
ok(Object.values(evidence.authorityBoundary || {}).every((value) => value === false), 'execution/public authority must remain disabled')

ok(!page.includes('editorial-non-rubric-blocker-recovery-wave-1.json'), 'public ranking page must not consume blocker recovery evidence')
ok(pkg.scripts?.['verify:content-corpus-200-editorial-non-rubric-blocker-recovery-wave-1'] === 'node scripts/verify-content-corpus-200-editorial-non-rubric-blocker-recovery-wave-1.mjs', 'package script wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-editorial-non-rubric-blocker-recovery-wave-1'), 'CI must run blocker recovery verifier')

const observedSha = jsonSha(evidence)
console.log(JSON.stringify({
  version: evidence.version,
  manifestSha256: MANIFEST_SHA,
  completionEvidenceSha256: COMPLETION_SHA,
  evidenceSha256: observedSha,
  incomingBlockedSlots: evidence.scope.incomingBlockedSlots,
  recoveredSlots: evidence.scope.recoveredSlots,
  remainingBlockedSlots: evidence.scope.remainingBlockedSlots,
  runtimeCandidateCoverage: runtimeSet.candidateCoverage,
  runtimeObservations: runtimeSet.entries.length,
  newEditorialDimensionValuesMaterialized: evidence.scope.newEditorialDimensionValuesMaterialized,
  nextGate: evidence.nextGate,
}, null, 2))
ok(observedSha === EXPECTED, `unsealed editorial non-rubric blocker recovery wave 1 SHA: observed ${observedSha}; expected ${EXPECTED}`)
console.log('CONTENT-CORPUS-200 editorial non-rubric blocker recovery wave 1 verification passed')
