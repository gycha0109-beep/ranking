import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const p = (...parts) => path.join(root, ...parts)
const files = {
  review: p('content/corpus-200/proposed-taxonomy-review.json'),
  overlap: p('content/corpus-200/current-production-overlap-review.json'),
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
const OVERLAP_SHA = 'fb309dbb9d18514afbc9b01c3f573fd5b05eb06f84eafaa4fddaeb7e1e968205'
const EXPECTED = 'UNSEALED_FIRST_OBSERVATION'

const fail = (message) => {
  console.error(`CONTENT-CORPUS-200 proposed taxonomy review verification failed: ${message}`)
  process.exit(1)
}
const ok = (condition, message) => { if (!condition) fail(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const jsonSha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

for (const file of [files.review, files.overlap, files.schema, files.manifest, files.page, files.pkg, files.ci, ...files.families]) {
  ok(fs.existsSync(file), `${path.relative(root, file)} must exist`)
}

const review = readJson(files.review)
const overlap = readJson(files.overlap)
const page = fs.readFileSync(files.page, 'utf8')
const pkg = readJson(files.pkg)
const ci = fs.readFileSync(files.ci, 'utf8')

ok(jsonSha(overlap) === OVERLAP_SHA, 'frozen current production overlap review mutated')
ok(overlap.version === 'content-corpus-200-current-production-overlap-review-v1', 'current production overlap review version mismatch')
ok(overlap.manifestSha256 === MANIFEST_SHA, 'overlap review manifest lineage mismatch')
ok(overlap.publicationPreflightSha256 === PREFLIGHT_SHA, 'overlap review preflight lineage mismatch')
ok(overlap.reviewSummary?.overlapReviewCompleteRows === 200, 'overlap review must remain complete for all 200 rows')
ok(overlap.nextGate === 'PROPOSED_TAXONOMY_REVIEW', 'overlap review must hand off to proposed taxonomy review')
ok(Object.values(overlap.authorityBoundary || {}).every((value) => value === false), 'overlap review authority must remain disabled')

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
ok(manifest.authorityBoundary?.taxonomyMutationAuthorized === false, 'manifest must keep taxonomy mutation disabled')
ok(rows.every((row) => row.publicationStatus === 'DRAFT_ONLY'), 'all corpus rows must remain DRAFT_ONLY')

ok(review.version === 'content-corpus-200-proposed-taxonomy-review-v1', 'review version mismatch')
ok(review.manifestVersion === manifest.manifestVersion && review.manifestSha256 === MANIFEST_SHA, 'manifest lineage mismatch')
ok(review.publicationPreflightVersion === 'content-corpus-200-publication-preflight-v1' && review.publicationPreflightSha256 === PREFLIGHT_SHA, 'publication preflight lineage mismatch')
ok(review.currentProductionOverlapReviewVersion === overlap.version && review.currentProductionOverlapReviewSha256 === OVERLAP_SHA, 'overlap review lineage mismatch')
ok(review.status === 'REVIEWED_NON_AUTHORIZING_PROPOSED_TAXONOMY_SNAPSHOT', 'review status mismatch')
ok(review.reviewedAt === '2026-08-26T11:46:00+09:00', 'review timestamp mismatch')

const snapshot = review.productionTaxonomySnapshot || {}
ok(snapshot.boundary === 'READ_ONLY_HOSTED_PRODUCTION_TAXONOMY_SNAPSHOT', 'production taxonomy snapshot must remain read-only')
ok(snapshot.publishedRankingCount === 16, 'production taxonomy snapshot must be tied to the 16-ranking hosted snapshot')

const expectedCategories = [
  ['culture-heritage', '문화·유산'],
  ['education', '교육'],
  ['foods', '건강식품'],
  ['sports', '스포츠'],
  ['statistics', '통계'],
  ['technology', '기술'],
  ['travel-transport', '여행·교통'],
].map(([slug, name]) => ({ slug, name, isVisible: true }))
const expectedSubcategories = [
  ['culture-heritage', 'world-heritage', '세계유산'],
  ['education', 'pisa', 'PISA'],
  ['sports', 'fifa', 'FIFA'],
  ['sports', 'kbo', 'KBO'],
  ['statistics', 'korea', '대한민국'],
  ['statistics', 'world', '세계'],
  ['statistics', 'world-cities', '세계 도시'],
  ['technology', 'supercomputers', '슈퍼컴퓨터'],
  ['travel-transport', 'airports', '공항'],
].map(([categorySlug, slug, name]) => ({ categorySlug, slug, name, isVisible: true }))
ok(JSON.stringify(snapshot.categories) === JSON.stringify(expectedCategories), 'production category snapshot mismatch')
ok(JSON.stringify(snapshot.subcategories) === JSON.stringify(expectedSubcategories), 'production subcategory snapshot mismatch')
ok(new Set(snapshot.categories.map((entry) => entry.slug)).size === 7, 'production category slugs must be unique')
ok(new Set(snapshot.subcategories.map((entry) => `${entry.categorySlug}/${entry.slug}`)).size === 9, 'production subcategory paths must be unique')

const proposedRows = rows.filter((row) => row.taxonomyStatus === 'PROPOSED')
const existingRows = rows.filter((row) => row.taxonomyStatus === 'EXISTING')
const proposedFamilyIds = [...new Set(proposedRows.map((row) => row.familyId))]
const existingFamilyIds = [...new Set(existingRows.map((row) => row.familyId))]
ok(proposedRows.length === 130, 'manifest must retain exactly 130 PROPOSED taxonomy rows')
ok(existingRows.length === 70, 'manifest must retain exactly 70 EXISTING taxonomy rows')
ok(proposedFamilyIds.length === 13, 'manifest must retain exactly 13 PROPOSED taxonomy families')
ok(existingFamilyIds.length === 7, 'manifest must retain exactly 7 EXISTING taxonomy families')
ok([...proposedFamilyIds, ...existingFamilyIds].length === 20, 'taxonomy family partition must cover exactly 20 families')

const expectedPaths = [
  ['steam-mainstream', 'games', 'steam'],
  ['steam-coop-survival', 'games', 'coop-survival'],
  ['korean-box-office', 'media', 'korean-film'],
  ['netflix-titles', 'media', 'netflix'],
  ['kpop-songs', 'music', 'kpop-songs'],
  ['kpop-artists-albums', 'music', 'kpop-artists'],
  ['smartphones', 'technology', 'smartphones'],
  ['laptops', 'technology', 'laptops'],
  ['electric-vehicles', 'mobility', 'electric-vehicles'],
  ['sunscreens', 'beauty', 'sunscreen'],
  ['skincare-serums', 'beauty', 'serum-ampoule'],
  ['streaming-services', 'media', 'streaming-services'],
  ['anc-headphones', 'technology', 'headphones'],
]

for (const [familyId, categorySlug, subcategorySlug] of expectedPaths) {
  const familyRows = proposedRows.filter((row) => row.familyId === familyId)
  ok(familyRows.length === 10, `${familyId} must retain exactly 10 proposed rows`)
  ok(familyRows.every((row) => row.categorySlug === categorySlug && row.subcategorySlug === subcategorySlug), `${familyId} taxonomy path mismatch`)
}
ok(proposedRows.every((row) => expectedPaths.some(([familyId]) => familyId === row.familyId)), 'unexpected PROPOSED taxonomy family found')

const policy = review.reviewPolicy || {}
ok(policy.scope === 'ONLY_FROZEN_MANIFEST_FAMILIES_MARKED_PROPOSED_ARE_REVIEWED_FOR_PATH_COHERENCE_AND_CURRENT_PRODUCTION_COLLISION', 'review scope mismatch')
ok(policy.familyBoundary === 'EACH_FAMILY_OWNS_EXACTLY_TEN_FROZEN_MANIFEST_ROWS_AND_ONE_CATEGORY_SUBCATEGORY_PATH', 'family review boundary mismatch')
ok(policy.existingCategoryReuseRule === 'A_PROPOSED_FAMILY_MAY_REUSE_AN_EXISTING_CATEGORY_ONLY_WHEN_ITS_SUBCATEGORY_PATH_IS_NEW_AND_DOMAIN_COHERENT', 'existing-category reuse rule mismatch')
ok(policy.newCategoryRule === 'A_NEW_CATEGORY_SLUG_MUST_BE_DISTINCT_FROM_THE_CURRENT_PRODUCTION_CATEGORY_SET_AND_GROUP_ONE_OR_MORE_INDEPENDENTLY_USEFUL_FAMILIES', 'new-category rule mismatch')
ok(policy.reviewOutcome === 'COHERENT_REQUIRES_SEPARATE_TAXONOMY_AUTHORIZATION', 'review outcome policy mismatch')
ok(policy.displayNameApprovalAuthorized === false && policy.categoryCreationAuthorized === false && policy.subcategoryCreationAuthorized === false, 'taxonomy review policy must not authorize naming or creation')

const currentCategorySlugs = new Set(snapshot.categories.map((entry) => entry.slug))
const currentFullPaths = new Set(snapshot.subcategories.map((entry) => `${entry.categorySlug}/${entry.slug}`))
const proposedFullPaths = expectedPaths.map(([, categorySlug, subcategorySlug]) => `${categorySlug}/${subcategorySlug}`)
ok(new Set(proposedFullPaths).size === expectedPaths.length, 'proposed taxonomy paths must be unique')
ok(proposedFullPaths.every((fullPath) => !currentFullPaths.has(fullPath)), 'proposed taxonomy path collides with current production path')

const expectedNewCategories = ['beauty', 'games', 'media', 'mobility', 'music']
const observedNewCategories = [...new Set(expectedPaths.map(([, categorySlug]) => categorySlug).filter((slug) => !currentCategorySlugs.has(slug)))].sort()
const observedReusedCategories = [...new Set(expectedPaths.map(([, categorySlug]) => categorySlug).filter((slug) => currentCategorySlugs.has(slug)))].sort()
ok(JSON.stringify(observedNewCategories) === JSON.stringify(expectedNewCategories), 'new category slug set mismatch')
ok(JSON.stringify(observedReusedCategories) === JSON.stringify(['technology']), 'reused existing category slug set mismatch')

ok(Array.isArray(review.proposedFamilyReviews) && review.proposedFamilyReviews.length === 13, 'review must contain exactly 13 proposed family decisions')
ok(new Set(review.proposedFamilyReviews.map((entry) => entry.familyId)).size === 13, 'proposed family review IDs must be unique')
for (const entry of review.proposedFamilyReviews) {
  const expected = expectedPaths.find(([familyId]) => familyId === entry.familyId)
  ok(Boolean(expected), `${entry.familyId} is not a frozen PROPOSED family`)
  const [, categorySlug, subcategorySlug] = expected
  ok(entry.manifestRowCount === 10, `${entry.familyId} review must cover exactly 10 rows`)
  ok(entry.categorySlug === categorySlug && entry.subcategorySlug === subcategorySlug, `${entry.familyId} review path mismatch`)
  const expectedDisposition = currentCategorySlugs.has(categorySlug) ? 'EXISTING_CATEGORY' : 'NEW_CATEGORY'
  ok(entry.categoryDisposition === expectedDisposition, `${entry.familyId} category disposition mismatch`)
  ok(entry.subcategoryDisposition === 'NEW_SUBCATEGORY_PATH', `${entry.familyId} subcategory disposition mismatch`)
  ok(entry.reviewOutcome === 'COHERENT_REQUIRES_SEPARATE_TAXONOMY_AUTHORIZATION', `${entry.familyId} review must remain non-authorizing`)
  ok(typeof entry.note === 'string' && entry.note.trim().length > 0, `${entry.familyId} review note is required`)
}

const summary = review.reviewSummary || {}
ok(JSON.stringify(summary) === JSON.stringify({
  reviewedProposedFamilyCount: 13,
  reviewedProposedManifestRowCount: 130,
  existingTaxonomyFamilyCount: 7,
  existingTaxonomyManifestRowCount: 70,
  newCategorySlugCount: 5,
  newCategorySlugs: expectedNewCategories,
  reusedExistingCategorySlugCount: 1,
  reusedExistingCategorySlugs: ['technology'],
  newSubcategoryPathCount: 13,
  fullPathCollisionCount: 0,
  reviewedCoherentFamilyCount: 13,
  requiresRedesignFamilyCount: 0,
}), 'taxonomy review summary mismatch')
ok(review.nextGate === 'EDITORIAL_SCORING_REVIEW', 'next gate must remain editorial scoring review')
ok(Object.values(review.authorityBoundary || {}).every((value) => value === false), 'taxonomy review must not authorize mutation, scoring, publication, votes, or activation')

ok(!page.includes('proposed-taxonomy-review.json'), 'public ranking page must not consume taxonomy review evidence')
ok(pkg.scripts?.['verify:content-corpus-200-proposed-taxonomy-review'] === 'node scripts/verify-content-corpus-200-proposed-taxonomy-review.mjs', 'package script wiring mismatch')
ok(ci.includes('npm run verify:content-corpus-200-proposed-taxonomy-review'), 'CI must run proposed taxonomy review verifier')

const observedSha = jsonSha(review)
const report = {
  version: review.version,
  manifestSha256: MANIFEST_SHA,
  publicationPreflightSha256: PREFLIGHT_SHA,
  currentProductionOverlapReviewSha256: OVERLAP_SHA,
  evidenceSha256: observedSha,
  productionCategories: snapshot.categories.length,
  productionSubcategoryPaths: snapshot.subcategories.length,
  reviewedProposedFamilies: summary.reviewedProposedFamilyCount,
  reviewedProposedRows: summary.reviewedProposedManifestRowCount,
  newCategorySlugs: summary.newCategorySlugs,
  reusedExistingCategorySlugs: summary.reusedExistingCategorySlugs,
  newSubcategoryPaths: summary.newSubcategoryPathCount,
  fullPathCollisions: summary.fullPathCollisionCount,
  nextGate: review.nextGate,
  authorityBoundary: review.authorityBoundary,
}
console.log(JSON.stringify(report, null, 2))

if (EXPECTED === 'UNSEALED_FIRST_OBSERVATION') {
  fail(`deliberate unsealed SHA guard; observed evidence SHA ${observedSha}`)
}
ok(observedSha === EXPECTED, `evidence SHA mismatch: expected ${EXPECTED}, observed ${observedSha}`)

console.log('CONTENT-CORPUS-200 proposed taxonomy review verification passed.')
