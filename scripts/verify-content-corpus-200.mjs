import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const contentRoot = path.join(root, 'content/corpus-200')
const schemaPath = path.join(contentRoot, 'schema.ts')
const manifestPath = path.join(contentRoot, 'manifest.ts')
const familyPaths = [
  path.join(contentRoot, 'families-01-games-media.ts'),
  path.join(contentRoot, 'families-02-music-tech-sports.ts'),
  path.join(contentRoot, 'families-03-mobility-travel-food.ts'),
  path.join(contentRoot, 'families-04-beauty-subscriptions-consumer.ts'),
]
const sourceCatalogPath = path.join(contentRoot, 'source-catalog.json')
const publicPagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')
const EXPECTED_MANIFEST_SHA256 = 'f8441bd0d50388c2c536bc03bd56882fb13e11bf5922acc1408689d834136493'

function fail(message) {
  console.error(`CONTENT-CORPUS-200 verification failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function groupBy(values, keyFn) {
  return values.reduce((groups, value) => {
    const key = keyFn(value)
    ;(groups[key] ||= []).push(value)
    return groups
  }, {})
}

for (const requiredPath of [schemaPath, manifestPath, sourceCatalogPath, publicPagePath, ...familyPaths]) {
  assert(fs.existsSync(requiredPath), `${path.relative(root, requiredPath)} must exist`)
}

const sourceFiles = [schemaPath, manifestPath, ...familyPaths]
const allSource = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
const publicPageSource = fs.readFileSync(publicPagePath, 'utf8')
const sourceCatalog = JSON.parse(fs.readFileSync(sourceCatalogPath, 'utf8'))

const forbiddenRecommendationReferences = [
  'rf1-core',
  'rf1-initial-policy-calibration',
  'ranking-neighborhood',
  'ranking-identity',
  'rf1-related-adapter',
  'rf1-shadow',
]
for (const forbidden of forbiddenRecommendationReferences) {
  assert(!allSource.includes(forbidden), `content authoring files must not reference recommendation implementation ${forbidden}`)
}

const forbiddenAnswerFields = [
  'expectedRank',
  'expectedTier',
  'candidateDepthTarget',
  'reorderTarget',
  'expectedReorder',
  'jaccardTarget',
  'neighborhoodTierTarget',
  'algorithmTarget',
]
for (const forbidden of forbiddenAnswerFields) {
  assert(!allSource.includes(forbidden), `content authoring must not encode recommendation answer field ${forbidden}`)
}

assert(!publicPageSource.includes('content/corpus-200'), 'public ranking page must not import the draft corpus')
assert(!publicPageSource.includes('CONTENT_CORPUS_200_MANIFEST_V1'), 'public ranking page must not consume the draft corpus')

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

const schemaUrl = dataUrl(transpile(fs.readFileSync(schemaPath, 'utf8'), schemaPath))
const familyUrls = familyPaths.map((file) => dataUrl(transpile(fs.readFileSync(file, 'utf8'), file)))
let manifestJs = transpile(fs.readFileSync(manifestPath, 'utf8'), manifestPath)
manifestJs = manifestJs.replace("from './schema'", `from '${schemaUrl}'`)
familyPaths.forEach((file, index) => {
  const moduleName = `./${path.basename(file, '.ts')}`
  manifestJs = manifestJs.replace(`from '${moduleName}'`, `from '${familyUrls[index]}'`)
})
const manifestUrl = dataUrl(manifestJs)
const manifestModule = await import(manifestUrl)
const manifest = manifestModule.buildContentCorpus200Manifest()
const repeated = manifestModule.buildContentCorpus200Manifest()

assert(JSON.stringify(manifest) === JSON.stringify(repeated), 'manifest materialization must be deterministic')
assert(manifest.manifestVersion === 'content-corpus-200-manifest-v1', 'manifest version must remain explicit')
assert(manifest.status === 'CURATED_DRAFT_MANIFEST_PRE_MATERIALIZATION', 'manifest must remain pre-materialization')
assert(manifest.authorityBoundary.productionDatabaseWritesAuthorized === false, 'manifest must not authorize production DB writes')
assert(manifest.authorityBoundary.publicPublicationAuthorized === false, 'manifest must not authorize public publication')
assert(manifest.authorityBoundary.recommendationEvaluationAuthorized === false, 'manifest must not authorize recommendation evaluation')
assert(manifest.authorityBoundary.taxonomyMutationAuthorized === false, 'manifest must not authorize taxonomy mutation')

const rows = manifest.rankings
assert(rows.length === 200, `manifest must contain exactly 200 rankings; observed ${rows.length}`)
assert(new Set(rows.map((row) => row.manifestId)).size === 200, 'manifest IDs must be unique')
assert(new Set(rows.map((row) => row.slug)).size === 200, 'draft slugs must be unique')
assert(new Set(rows.map((row) => row.title)).size === 200, 'titles must be unique')

const byType = groupBy(rows, (row) => row.contentType)
assert((byType.FACT || []).length === 60, 'FACT count must be exactly 60')
assert((byType.EDITORIAL_COMPOSITE || []).length === 90, 'EDITORIAL_COMPOSITE count must be exactly 90')
assert((byType.COMMUNITY_VOTE || []).length === 50, 'COMMUNITY_VOTE count must be exactly 50')
assert(manifest.contentMix.FACT === 60 && manifest.contentMix.EDITORIAL_COMPOSITE === 90 && manifest.contentMix.COMMUNITY_VOTE === 50, 'declared content mix must match the curated 60/90/50 plan')

const familyIds = [...new Set(rows.map((row) => row.familyId))]
assert(familyIds.length === 20, `manifest must contain exactly 20 content families; observed ${familyIds.length}`)
for (const familyId of familyIds) {
  assert(rows.filter((row) => row.familyId === familyId).length === 10, `${familyId} must contain exactly 10 rankings`)
  assert(rows.filter((row) => row.familyId === familyId && row.contentType === 'FACT').length === 3, `${familyId} must contain exactly 3 FACT rankings`)
}

const allowedRankingTypes = new Set(['editor_pick', 'popularity', 'quality', 'purpose', 'metric', 'user_vote'])
for (const row of rows) {
  assert(allowedRankingTypes.has(row.rankingType), `${row.manifestId} has unsupported rankingType ${row.rankingType}`)
  assert(row.rankingType !== 'sponsored', `${row.manifestId} must not be sponsored in CONTENT-CORPUS-200`)
  assert(row.publicationStatus === 'DRAFT_ONLY', `${row.manifestId} must remain DRAFT_ONLY`)
  assert(row.entryMaterializationStatus === 'NOT_STARTED', `${row.manifestId} must not fabricate item materialization`)
  assert(row.algorithmEvaluationStatus === 'NOT_RUN', `${row.manifestId} must not contain recommendation evaluation results`)
  assert(row.existingOverlapReview === 'REVIEW_REQUIRED', `${row.manifestId} must remain pending current-production overlap review`)
  assert(row.taxonomyStatus === 'EXISTING' || row.taxonomyStatus === 'PROPOSED', `${row.manifestId} must declare taxonomy status`)
  assert(Array.isArray(row.sourceKeys) && row.sourceKeys.length >= 1, `${row.manifestId} must declare at least one source authority`)
  assert(row.title.trim() === row.title && row.title.length >= 5, `${row.manifestId} title must be non-trivial and trimmed`)
  assert(row.candidateUniverseStrategy.length >= 25, `${row.manifestId} must define a content-based candidate universe strategy`)
  assert(row.contentRationale.length >= 15, `${row.manifestId} must explain content value independently of recommendation behavior`)

  if (row.contentType === 'FACT') {
    assert(row.rankingType === 'metric', `${row.manifestId} FACT must map to metric`)
    assert(row.factDimensions.length >= 1, `${row.manifestId} FACT must declare dimensions`)
    assert(row.compositeDimensions.length === 0 && row.compositeFormula === null, `${row.manifestId} FACT must not fabricate editorial weights`)
    assert(row.voteQuestion === null, `${row.manifestId} FACT must not carry a vote question`)
  } else if (row.contentType === 'EDITORIAL_COMPOSITE') {
    assert(row.rankingType === 'editor_pick' || row.rankingType === 'purpose' || row.rankingType === 'quality', `${row.manifestId} editorial ranking type must stay editorial-compatible`)
    assert(row.editorialQuestion && row.editorialQuestion.length >= 15, `${row.manifestId} editorial must state the user question`)
    assert(row.compositeDimensions.length >= 3, `${row.manifestId} editorial must have at least three review dimensions`)
    assert(row.compositeDimensions.every((dimension) => dimension.weightStatus === 'UNASSIGNED_PRE_MATERIALIZATION'), `${row.manifestId} must not pre-fit composite weights`)
    assert(row.compositeFormula === 'WEIGHTS_NOT_ASSIGNED_PRE_MATERIALIZATION', `${row.manifestId} must defer formula assignment until evidence materialization`)
    assert(row.voteQuestion === null, `${row.manifestId} editorial must not impersonate a community vote`)
  } else {
    assert(row.contentType === 'COMMUNITY_VOTE', `${row.manifestId} must use a known content type`)
    assert(row.rankingType === 'user_vote', `${row.manifestId} community content must map to user_vote`)
    assert(row.voteQuestion && row.voteQuestion.length >= 8, `${row.manifestId} community vote must state a question`)
    assert(row.sourceKeys.includes('rankingwiki-community-vote'), `${row.manifestId} community vote must use native vote authority`)
    assert(row.factDimensions.length === 0 && row.compositeDimensions.length === 0, `${row.manifestId} community vote must not fabricate scoring dimensions`)
  }
}

const catalogByKey = new Map(sourceCatalog.sources.map((source) => [source.key, source]))
assert(catalogByKey.size === sourceCatalog.sources.length, 'source catalog keys must be unique')
for (const row of rows) {
  for (const sourceKey of row.sourceKeys) {
    assert(catalogByKey.has(sourceKey), `${row.manifestId} references unknown source ${sourceKey}`)
  }
}

const circle = catalogByKey.get('circle-chart')
assert(circle?.accessMode === 'MANUAL_REFERENCE_ONLY', 'Circle Chart must remain manual-reference-only under the observed TDM restriction')
assert(/TDM/i.test(circle?.note || ''), 'Circle Chart restriction note must explicitly mention TDM')
const headphoneLab = catalogByKey.get('headphone-review-lab')
assert(headphoneLab?.accessMode === 'LICENSE_REVIEW_REQUIRED', 'third-party headphone measurement source must remain license-review-gated')

const existingTaxonomy = new Set([
  'foods:',
  'statistics:world-cities',
  'sports:kbo',
  'sports:fifa',
  'travel-transport:airports',
])
for (const row of rows.filter((row) => row.taxonomyStatus === 'EXISTING')) {
  const key = `${row.categorySlug}:${row.subcategorySlug || ''}`
  assert(existingTaxonomy.has(key), `${row.manifestId} claims an unverified existing taxonomy path ${key}`)
}

const productionTitles = new Set([
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
for (const row of rows) {
  assert(!productionTitles.has(row.title), `${row.manifestId} exactly duplicates an already-published production title`)
}

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
const manifestSha256 = crypto.createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex')

const report = {
  manifestVersion: manifest.manifestVersion,
  manifestSha256,
  rankingCount: rows.length,
  familyCount: familyIds.length,
  contentMix: {
    FACT: (byType.FACT || []).length,
    EDITORIAL_COMPOSITE: (byType.EDITORIAL_COMPOSITE || []).length,
    COMMUNITY_VOTE: (byType.COMMUNITY_VOTE || []).length,
  },
  taxonomy: {
    existingRows: rows.filter((row) => row.taxonomyStatus === 'EXISTING').length,
    proposedRows: rows.filter((row) => row.taxonomyStatus === 'PROPOSED').length,
  },
  sourceCatalogCount: sourceCatalog.sources.length,
  sourceVerification: groupBy(sourceCatalog.sources, (source) => source.verificationStatus),
  state: {
    entryMaterialization: 'NOT_STARTED',
    productionDatabaseWrites: false,
    publicPublication: false,
    recommendationEvaluation: 'NOT_RUN',
    taxonomyMutation: false,
  },
}

console.log('CONTENT-CORPUS-200 curated manifest result:')
console.log(JSON.stringify(report, null, 2))

assert(EXPECTED_MANIFEST_SHA256 !== 'TO_BE_FROZEN_AFTER_FIRST_VERIFIED_MANIFEST', `manifest must be frozen after first verified execution; observed sha256=${manifestSha256}`)
assert(manifestSha256 === EXPECTED_MANIFEST_SHA256, `manifest freeze mismatch: expected ${EXPECTED_MANIFEST_SHA256}, observed ${manifestSha256}`)

console.log(`CONTENT-CORPUS-200 manifest contracts: PASS (${manifestSha256.slice(0, 16)})`)
