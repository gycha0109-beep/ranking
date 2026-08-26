import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  review: p('content/corpus-200/current-production-overlap-review.json'),
  preflight: p('content/corpus-200/publication-preflight.json'),
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
const PREFLIGHT_SHA = 'a62c1c62e9ca68ce4598d67b9b2cb286bddd88c46214d7ab3d08e77c6e937175'
const EXPECTED = 'fb309dbb9d18514afbc9b01c3f573fd5b05eb06f84eafaa4fddaeb7e1e968205'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 current production overlap review verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of [files.review, files.preflight, files.schema, files.manifest, files.page, files.pkg, files.ci, ...files.families]) {
  ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)
}

const review = readJson(files.review)
const preflight = readJson(files.preflight)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(preflight) === PREFLIGHT_SHA, 'frozen publication preflight mutated')
ok(preflight.version === 'content-corpus-200-publication-preflight-v1', 'publication preflight version mismatch')
ok(preflight.stages?.existingProductionOverlapReview?.pendingRows === 200, 'preflight must remain the frozen pre-review state')
ok(Object.values(preflight.authorityBoundary || {}).every((value) => value === false), 'preflight authority must remain disabled')

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
ok(rows.every((row) => row.existingOverlapReview === 'REVIEW_REQUIRED'), 'frozen manifest overlap field must not be mutated by this review phase')

ok(review.version === 'content-corpus-200-current-production-overlap-review-v1', 'review version mismatch')
ok(review.manifestVersion === manifest.manifestVersion && review.manifestSha256 === MANIFEST_SHA, 'manifest lineage mismatch')
ok(review.publicationPreflightVersion === preflight.version && review.publicationPreflightSha256 === PREFLIGHT_SHA, 'publication preflight lineage mismatch')
ok(review.status === 'REVIEWED_NON_AUTHORIZING_CURRENT_PRODUCTION_OVERLAP_SNAPSHOT', 'review status mismatch')
ok(review.reviewedAt === '2026-08-26T10:59:00+09:00', 'review timestamp mismatch')

const snapshot = review.productionSnapshot || {}
ok(snapshot.boundary === 'READ_ONLY_HOSTED_PUBLISHED_RANKINGS_SNAPSHOT', 'production snapshot must remain read-only')
ok(snapshot.publishedRankingCount === 16, 'production snapshot must contain exactly 16 published rankings')
ok(snapshot.semanticProjectionCount === 13, 'production semantic projection count must remain 13')
ok(Array.isArray(snapshot.rankings) && snapshot.rankings.length === 16, 'production ranking snapshot length mismatch')
ok(new Set(snapshot.rankings.map((row) => row.slug)).size === 16, 'production ranking slugs must be unique')

const expectedProduction = [
  ['world-population-2024-top-5', '2024 인구 TOP 5', 'statistics', 'world', 'world-country-population'],
  ['korea-net-inmigration-rate-2025-top-3', '2025 시도 순유입률 TOP 3', 'statistics', 'korea', 'korea-interregional-migration-rate'],
  ['korea-net-outmigration-rate-2025-top-3', '2025 시도 순유출률 TOP 3', 'statistics', 'korea', 'korea-interregional-migration-rate'],
  ['world-nominal-gdp-2024-top-5', '2024 명목 GDP TOP 5', 'statistics', 'world', 'world-country-nominal-gdp'],
  ['kbo-team-batting-average-2025-top-5', '2025 KBO 팀 타율 TOP 5', 'sports', 'kbo', 'kbo-team-season-performance'],
  ['kbo-team-era-2025-top-5', '2025 KBO 팀 평균자책점 TOP 5', 'sports', 'kbo', 'kbo-team-season-performance'],
  ['kbo-team-winning-percentage-2025-top-5', '2025 KBO 팀 승률 TOP 5', 'sports', 'kbo', 'kbo-team-season-performance'],
  ['unesco-world-heritage-properties-2026-top-5', '2026 UNESCO 세계유산 보유 건수 TOP 5', 'culture-heritage', 'world-heritage', 'unesco-world-heritage-country-count'],
  ['pisa-2022-mathematics-top-5', 'PISA 2022 수학 평균점수 TOP 5', 'education', 'pisa', 'pisa-country-performance'],
  ['pisa-2022-reading-top-5', 'PISA 2022 읽기 평균점수 TOP 5', 'education', 'pisa', 'pisa-country-performance'],
  ['pisa-2022-science-top-5', 'PISA 2022 과학 평균점수 TOP 5', 'education', 'pisa', 'pisa-country-performance'],
  ['fifa-men-world-ranking-2026-07-top-5', '2026년 7월 FIFA 남자 세계랭킹 TOP 5', 'sports', 'fifa', 'fifa-world-ranking'],
  ['fifa-women-world-ranking-2026-06-top-5', '2026년 6월 FIFA 여자 세계랭킹 TOP 5', 'sports', 'fifa', 'fifa-world-ranking'],
  ['world-busiest-airports-passengers-2025-top-5', '2025 세계 공항 이용객 수 TOP 5', 'travel-transport', 'airports', null],
  ['world-largest-cities-population-2025-top-5', '2025 세계 도시 인구 TOP 5', 'statistics', 'world-cities', null],
  ['top500-supercomputer-hpl-rmax-2026-06-top-5', '2026년 6월 TOP500 슈퍼컴퓨터 성능 TOP 5', 'technology', 'supercomputers', null],
].map(([slug, title, categorySlug, subcategorySlug, subjectKey]) => ({ slug, title, categorySlug, subcategorySlug, subjectKey }))
ok(JSON.stringify(snapshot.rankings) === JSON.stringify(expectedProduction), 'production snapshot content mismatch')

const missingProjectionSlugs = expectedProduction.filter((row) => row.subjectKey === null).map((row) => row.slug)
ok(JSON.stringify(snapshot.missingSemanticProjectionSlugs) === JSON.stringify(missingProjectionSlugs), 'missing semantic projection set mismatch')
ok(snapshot.rankings.filter((row) => row.subjectKey !== null).length === snapshot.semanticProjectionCount, 'semantic projection count must derive from snapshot')

const policy = review.reviewPolicy || {}
ok(JSON.stringify(policy.decisionKinds) === JSON.stringify(['NO_SUBJECT_OVERLAP', 'RELATED_DISTINCT', 'DUPLICATE_OR_REDUNDANT']), 'review decision kinds mismatch')
ok(policy.familyLevelReviewBoundary === 'A_FAMILY_DECISION_COVERS_ITS_FROZEN_TEN_MANIFEST_ROWS_ONLY_AFTER_EACH_ROW_TITLE_BASIS_AND_VIEW_IS_REVIEWED_AGAINST_THE_CURRENT_PRODUCTION_SNAPSHOT', 'family review boundary mismatch')
ok(policy.relatedDistinctMeaning === 'SAME_OR_ADJACENT_DOMAIN_BUT_DIFFERENT_QUESTION_METRIC_VIEW_OR_VERSION_SUFFICIENT_TO_REMAIN_INDEPENDENTLY_USEFUL', 'related-distinct interpretation mismatch')
ok(policy.exactTitleNonDuplicationAloneIsInsufficient === true, 'exact-title-only review must remain insufficient')
ok(policy.automaticSemanticApprovalAuthorized === false, 'automatic semantic approval must remain disabled')

const productionSlugs = new Set(snapshot.rankings.map((row) => row.slug))
const productionTitles = new Set(snapshot.rankings.map((row) => row.title))
const manifestFamilyIds = [...new Set(rows.map((row) => row.familyId))]
const rowsByFamily = new Map(manifestFamilyIds.map((familyId) => [familyId, rows.filter((row) => row.familyId === familyId)]))

ok(manifestFamilyIds.length === 20, 'manifest must remain 20 families')
ok([...rowsByFamily.values()].every((familyRows) => familyRows.length === 10), 'family-level review requires exactly 10 frozen rows per family')
ok(rows.every((row) => !productionTitles.has(row.title)), 'manifest must contain no exact current-production title duplicate')

const expectedRelated = new Map([
  ['kbo-clubs', ['kbo-team-batting-average-2025-top-5', 'kbo-team-era-2025-top-5', 'kbo-team-winning-percentage-2025-top-5']],
  ['airports', ['world-busiest-airports-passengers-2025-top-5']],
  ['fifa-national-teams', ['fifa-men-world-ranking-2026-07-top-5', 'fifa-women-world-ranking-2026-06-top-5']],
  ['asian-cities', ['world-largest-cities-population-2025-top-5']],
])

ok(Array.isArray(review.familyReviews) && review.familyReviews.length === 20, 'review must contain exactly 20 family decisions')
ok(new Set(review.familyReviews.map((entry) => entry.familyId)).size === 20, 'family review IDs must be unique')
ok(review.familyReviews.every((entry) => manifestFamilyIds.includes(entry.familyId)), 'family review contains unknown family')
ok(review.familyReviews.every((entry) => typeof entry.note === 'string' && entry.note.trim().length > 0), 'every family review requires a note')

let noOverlapRows = 0
let relatedRows = 0
let duplicateRows = 0
for (const entry of review.familyReviews) {
  const familyRows = rowsByFamily.get(entry.familyId) || []
  const relatedSlugs = expectedRelated.get(entry.familyId)
  if (relatedSlugs) {
    ok(entry.decision === 'RELATED_DISTINCT', `${entry.familyId} must remain reviewed as RELATED_DISTINCT`)
    ok(JSON.stringify(entry.productionRankingSlugs) === JSON.stringify(relatedSlugs), `${entry.familyId} production relation set mismatch`)
    relatedRows += familyRows.length
  } else {
    ok(entry.decision === 'NO_SUBJECT_OVERLAP', `${entry.familyId} must remain reviewed as NO_SUBJECT_OVERLAP`)
    ok(Array.isArray(entry.productionRankingSlugs) && entry.productionRankingSlugs.length === 0, `${entry.familyId} must not claim a production relation`)
    noOverlapRows += familyRows.length
  }
  ok((entry.productionRankingSlugs || []).every((slug) => productionSlugs.has(slug)), `${entry.familyId} references an unknown production slug`)
  if (entry.decision === 'DUPLICATE_OR_REDUNDANT') duplicateRows += familyRows.length
}

ok(relatedRows === 40 && noOverlapRows === 160 && duplicateRows === 0, 'review row partition must remain 160 no-overlap / 40 related-distinct / 0 duplicate')
ok([...expectedRelated.keys()].every((familyId) => review.familyReviews.some((entry) => entry.familyId === familyId && entry.decision === 'RELATED_DISTINCT')), 'all reviewed related families must be present')

const summary = review.reviewSummary || {}
ok(JSON.stringify(summary) === JSON.stringify({
  reviewedFamilyCount: 20,
  reviewedManifestRowCount: 200,
  noSubjectOverlapRows: noOverlapRows,
  relatedDistinctRows: relatedRows,
  duplicateOrRedundantRows: duplicateRows,
  overlapReviewCompleteRows: noOverlapRows + relatedRows + duplicateRows,
}), 'review summary mismatch')
ok(review.nextGate === 'PROPOSED_TAXONOMY_REVIEW', 'next gate must remain proposed taxonomy review')
ok(Object.values(review.authorityBoundary || {}).every((value) => value === false), 'overlap review must not authorize any mutation, scoring, publication, or activation')

ok(!page.includes('current-production-overlap-review.json'), 'public ranking page must not consume overlap review evidence')
ok(pkg.scripts?.['verify:content-corpus-200-current-production-overlap-review'] === 'node scripts/verify-content-corpus-200-current-production-overlap-review.mjs', 'package script wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-current-production-overlap-review'), 'CI must run current production overlap review verifier')

const observedSha = jsonSha(review)
const report = {
  version: review.version,
  manifestSha256: MANIFEST_SHA,
  publicationPreflightSha256: PREFLIGHT_SHA,
  evidenceSha256: observedSha,
  productionPublishedRankings: snapshot.publishedRankingCount,
  productionSemanticProjections: snapshot.semanticProjectionCount,
  reviewedFamilies: summary.reviewedFamilyCount,
  reviewedRows: summary.reviewedManifestRowCount,
  noSubjectOverlapRows: summary.noSubjectOverlapRows,
  relatedDistinctRows: summary.relatedDistinctRows,
  duplicateOrRedundantRows: summary.duplicateOrRedundantRows,
  nextGate: review.nextGate,
  authority: review.authorityBoundary,
}
console.log('CONTENT-CORPUS-200 current production overlap review result:')
console.log(JSON.stringify(report, null, 2))

if (EXPECTED === '__UNSEALED_FIRST_RUN__') {
  fail(`current production overlap review evidence must be frozen after first structurally valid execution; observed sha256=${observedSha}`)
}
ok(observedSha === EXPECTED, `frozen current production overlap review evidence mutated; expected ${EXPECTED}, observed ${observedSha}`)
console.log(`CONTENT-CORPUS-200 current production overlap review contracts: PASS (${observedSha.slice(0, 16)})`)
