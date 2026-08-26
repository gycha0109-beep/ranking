import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const contentRoot = p('content', 'corpus-200')
const files = {
  preflight: p('content/corpus-200/publication-preflight.json'),
  effective: p('content/corpus-200/effective-materialization-state.json'),
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
const EFFECTIVE_SHA = 'e25f7ba735695f8171b22ce9ba0d6bb0e6e36dea1963d3596d3edbd9a5e14618'
const EXPECTED = 'a62c1c62e9ca68ce4598d67b9b2cb286bddd88c46214d7ab3d08e77c6e937175'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 publication preflight verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of [files.preflight, files.effective, files.schema, files.manifest, files.page, files.pkg, files.ci, ...files.families]) {
  ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)
}

const preflight = readJson(files.preflight)
const effective = readJson(files.effective)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(effective) === EFFECTIVE_SHA, 'frozen effective materialization state mutated')
ok(effective.version === 'content-corpus-200-effective-materialization-state-v1', 'effective state version mismatch')
ok(effective.status === 'DERIVED_PREPUBLICATION_EFFECTIVE_STATE_AFTER_RECOVERY_CLOSURE', 'effective state status mismatch')
ok(Object.values(effective.authorityBoundary || {}).every((value) => value === false), 'effective state authority must remain disabled')

function transpile(source, fileName) {
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      strict: true,
    },
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
  const moduleName = `./${path.basename(file, '.ts')}`
  manifestJs = manifestJs.replace(`from '${moduleName}'`, `from '${familyUrls[index]}'`)
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
const observedManifestSha = crypto.createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex')
ok(observedManifestSha === MANIFEST_SHA, 'frozen manifest canonical payload mutated')
ok(rows.length === 200 && new Set(rows.map((row) => row.manifestId)).size === 200, 'manifest must remain exactly 200 unique rows')
ok(rows.every((row) => row.publicationStatus === 'DRAFT_ONLY'), 'all corpus rows must remain DRAFT_ONLY')
ok(rows.every((row) => row.existingOverlapReview === 'REVIEW_REQUIRED'), 'existing-production overlap review must remain pending for every row')

const effectiveSummary = effective.effectiveSummary || {}
const fact = effectiveSummary.byContentType?.FACT || {}
const editorial = effectiveSummary.byContentType?.EDITORIAL_COMPOSITE || {}
const vote = effectiveSummary.byContentType?.COMMUNITY_VOTE || {}

const effectiveReadyRows = effectiveSummary.effectiveReadyRows
const sourceOrCandidateGapRows = effectiveSummary.blockedRows
const factRowsWithMaterializedOrdering = (fact.materializedBase || 0) + (fact.materializedRecovery || 0)
const editorialRowsPendingReviewedScoring = editorial.candidatesFrozenScoringUnassigned || 0
const communityVoteRowsPendingOrganicOutcome = vote.candidatesFrozenNoVotes || 0

ok(effectiveSummary.totalRankings === 200, 'effective state must cover 200 rankings')
ok(effectiveReadyRows === 159 && sourceOrCandidateGapRows === 41, 'effective materialization state must remain 159 ready / 41 blocked')
ok(factRowsWithMaterializedOrdering === 40, 'FACT authoritative ordering count must remain 40')
ok(editorialRowsPendingReviewedScoring === 76, 'editorial scoring-pending count must remain 76')
ok(communityVoteRowsPendingOrganicOutcome === 43, 'community vote organic-outcome-pending count must remain 43')
ok(factRowsWithMaterializedOrdering + editorialRowsPendingReviewedScoring + communityVoteRowsPendingOrganicOutcome + sourceOrCandidateGapRows === 200, 'authoritative-ordering partition must cover all 200 rows')

const existingRows = rows.filter((row) => row.taxonomyStatus === 'EXISTING').length
const proposedRows = rows.filter((row) => row.taxonomyStatus === 'PROPOSED').length
const overlapPendingRows = rows.filter((row) => row.existingOverlapReview === 'REVIEW_REQUIRED').length

const knownProductionTitles = new Set([
  '2024 인구 TOP 5',
  '2025 시도 순유입률 TOP 3',
  '2025 시도 순유출률 TOP 3',
  '2024 명목 GDP TOP 5',
  '2025 KBO 팀 타율 TOP 5',
  '2025 KBO 팀 평균자책점 TOP 5',
  '2025 KBO 팀 승률 TOP 5',
  '2026 UNESCO 세계유산 보유 건수 TOP 5',
  'PISA 2022 수학 평균점수 TOP 5',
  'PISA 2022 읽기 평균점수 TOP 5',
  'PISA 2022 과학 평균점수 TOP 5',
  '2026년 7월 FIFA 남자 세계랭킹 TOP 5',
  '2026년 6월 FIFA 여자 세계랭킹 TOP 5',
  '2026년 6월 TOP500 슈퍼컴퓨터 성능 TOP 5',
  '2025 세계 공항 이용객 수 TOP 5',
  '2025 세계 도시 인구 TOP 5',
])
const exactKnownTitleDuplicates = rows.filter((row) => knownProductionTitles.has(row.title)).length

ok(existingRows === 70 && proposedRows === 130, 'taxonomy split must remain 70 existing / 130 proposed')
ok(overlapPendingRows === 200, 'all 200 rows must remain pending semantic overlap review')
ok(exactKnownTitleDuplicates === 0, 'frozen static production title set must have zero exact title duplicates')

ok(preflight.version === 'content-corpus-200-publication-preflight-v1', 'preflight version mismatch')
ok(preflight.manifestVersion === manifest.manifestVersion && preflight.manifestSha256 === MANIFEST_SHA, 'manifest lineage mismatch')
ok(preflight.effectiveMaterializationStateVersion === effective.version && preflight.effectiveMaterializationStateSha256 === EFFECTIVE_SHA, 'effective-state lineage mismatch')
ok(preflight.status === 'DERIVED_NON_AUTHORIZING_PUBLICATION_PREFLIGHT', 'preflight status mismatch')
ok(preflight.derivedAt === '2026-08-26T10:43:00+09:00', 'preflight derived timestamp mismatch')
ok(preflight.interpretation === 'EFFECTIVE_READY_DOES_NOT_MEAN_PUBLICATION_READY', 'preflight interpretation boundary mismatch')

const stages = preflight.stages || {}
ok(JSON.stringify(stages.materialization) === JSON.stringify({
  totalRows: 200,
  effectiveReadyRows,
  blockedSourceOrCandidateGapRows: sourceOrCandidateGapRows,
}), 'materialization stage mismatch')
ok(JSON.stringify(stages.authoritativeOrdering) === JSON.stringify({
  factRowsWithMaterializedOrdering,
  editorialRowsPendingReviewedScoring,
  communityVoteRowsPendingOrganicOutcome,
  rowsStillBlockedBySourceOrCandidateGap: sourceOrCandidateGapRows,
  totalRows: 200,
}), 'authoritative ordering stage mismatch')
ok(JSON.stringify(stages.taxonomy) === JSON.stringify({
  existingRows,
  proposedRows,
  mutationAuthorized: false,
}), 'taxonomy stage mismatch')
ok(JSON.stringify(stages.existingProductionOverlapReview) === JSON.stringify({
  reviewedRows: 0,
  pendingRows: overlapPendingRows,
  knownExactTitleDuplicatesInFrozenStaticProductionTitleSet: exactKnownTitleDuplicates,
  exactTitleNonDuplicationDoesNotSatisfySemanticOverlapReview: true,
}), 'overlap review stage mismatch')
ok(JSON.stringify(stages.publicationClearance) === JSON.stringify({
  fullyPublicationClearedRows: 0,
  publicPublicationAuthorized: false,
  productionDatabaseWritesAuthorized: false,
}), 'publication clearance stage mismatch')

const expectedQueue = [
  'CURRENT_PRODUCTION_OVERLAP_REVIEW',
  'PROPOSED_TAXONOMY_REVIEW',
  'EDITORIAL_SCORING_REVIEW',
  'COMMUNITY_VOTE_BOOTSTRAP_WITHOUT_FABRICATION',
  'SEPARATE_PUBLICATION_AUTHORIZATION',
]
ok(JSON.stringify(preflight.nextGateQueue) === JSON.stringify(expectedQueue), 'next gate queue mismatch')
ok(Object.values(preflight.authorityBoundary || {}).every((value) => value === false), 'publication preflight must not authorize any mutation or activation')
ok(preflight.authorityBoundary.editorialScoringAuthorized === false, 'editorial scoring must remain unauthorized')
ok(preflight.authorityBoundary.voteFabricationAuthorized === false, 'vote fabrication must remain forbidden')

ok(!page.includes('publication-preflight.json'), 'public ranking page must not consume publication preflight evidence')
ok(!page.includes('effective-materialization-state.json'), 'public ranking page must not consume effective-state evidence')
ok(pkg.scripts?.['verify:content-corpus-200-publication-preflight'] === 'node scripts/verify-content-corpus-200-publication-preflight.mjs', 'package script wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-publication-preflight'), 'CI must run publication preflight verifier')

const observedSha = jsonSha(preflight)
const report = {
  version: preflight.version,
  manifestSha256: MANIFEST_SHA,
  effectiveMaterializationStateSha256: EFFECTIVE_SHA,
  evidenceSha256: observedSha,
  materialization: stages.materialization,
  authoritativeOrdering: stages.authoritativeOrdering,
  taxonomy: stages.taxonomy,
  overlapReview: stages.existingProductionOverlapReview,
  publicationClearance: stages.publicationClearance,
  authority: preflight.authorityBoundary,
}
console.log('CONTENT-CORPUS-200 publication preflight result:')
console.log(JSON.stringify(report, null, 2))

if (EXPECTED === '__UNSEALED_FIRST_RUN__') {
  fail(`publication preflight evidence must be frozen after first structurally valid execution; observed sha256=${observedSha}`)
}
ok(observedSha === EXPECTED, `frozen publication preflight evidence mutated; expected ${EXPECTED}, observed ${observedSha}`)
console.log(`CONTENT-CORPUS-200 publication preflight contracts: PASS (${observedSha.slice(0, 16)})`)
