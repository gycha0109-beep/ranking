import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const corpusPath = path.join(root, 'src/lib/recommendation/rf1m-mixed-holdout-corpus.ts')
const publicPagePath = path.join(root, 'src/app/rankings/[rankingSlug]/page.tsx')
const EXPECTED_CORPUS_SHA256 = 'TO_BE_FROZEN_BEFORE_RF1M_EVALUATION'

function fail(message) {
  console.error(`RF-1M corpus integrity failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

assert(fs.existsSync(corpusPath), 'mixed holdout corpus source must exist')
assert(fs.existsSync(publicPagePath), 'public ranking page must exist')

const corpusSource = fs.readFileSync(corpusPath, 'utf8')
const publicPageSource = fs.readFileSync(publicPagePath, 'utf8')

const forbiddenImplementationImports = [
  'rf1-core',
  'rf1-initial-policy-calibration',
  'ranking-neighborhood',
  'ranking-identity',
  'rf1-related-adapter',
  'rf1-shadow',
]

for (const forbidden of forbiddenImplementationImports) {
  assert(!corpusSource.includes(forbidden), `corpus generator must not reference ${forbidden}`)
}

for (const forbiddenAnswerField of [
  'expectedRank',
  'expectedTier',
  'expectedCandidate',
  'candidateDepthTarget',
  'reorderTarget',
  'expectedReorder',
]) {
  assert(!corpusSource.includes(forbiddenAnswerField), `corpus generator must not encode ${forbiddenAnswerField}`)
}

assert(!publicPageSource.includes('rf1m-mixed-holdout-corpus'), 'public ranking page must not import RF-1M corpus')
assert(!publicPageSource.includes('RF1M_MIXED_HOLDOUT_CORPUS_V1'), 'public ranking page must not consume RF-1M corpus')

const js = ts.transpileModule(corpusSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    strict: true,
  },
  fileName: corpusPath,
}).outputText

const moduleUrl = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
const corpusModule = await import(moduleUrl)
const corpus = corpusModule.buildRf1mMixedHoldoutCorpus()
const repeated = corpusModule.buildRf1mMixedHoldoutCorpus()

assert(JSON.stringify(corpus) === JSON.stringify(repeated), 'corpus generation must be deterministic')
assert(corpus.corpusId === 'rf1m-independent-mixed-holdout-v1', 'corpus ID must remain explicit')
assert(corpus.generatorSeed === 'rf1m-independent-mixed-holdout-v1:2026-08-24', 'generator seed must remain frozen')
assert(corpus.generationBoundary === 'CONTENT_WORLD_ONLY_NO_RECOMMENDATION_POLICY_ACCESS', 'generation boundary must remain explicit')
assert(corpus.worldCount === 26, 'corpus must contain exactly 26 content worlds')
assert(corpus.rankings.length >= 160 && corpus.rankings.length <= 300, 'corpus size must remain in the predeclared broad range')
assert(new Set(corpus.rankings.map((row) => row.id)).size === corpus.rankings.length, 'ranking IDs must be unique')
assert(corpus.rankings.every((row) => row.itemIds.length >= 3), 'every ranking must contain at least three items')
assert(corpus.rankings.every((row) => new Set(row.itemIds).size === row.itemIds.length), 'ranking items must be unique within each ranking')
assert(corpus.rankings.every((row) => row.semanticProjection?.classification_state === 'reviewed'), 'every ranking must carry reviewed semantic projection data')
assert(corpus.rankings.every((row) => row.semanticProjection?.ranking_id === row.id), 'semantic projection ranking IDs must match ranking IDs')
assert(corpus.rankings.every((row) => Number.isFinite(row.uniqueViewCount) && row.uniqueViewCount >= 0), 'view counts must be finite non-negative values')
assert(corpus.rankings.every((row) => Number.isFinite(row.likeCount) && row.likeCount >= 0), 'like counts must be finite non-negative values')
assert(corpus.rankings.every((row) => Number.isFinite(row.bookmarkCount) && row.bookmarkCount >= 0), 'bookmark counts must be finite non-negative values')
assert(corpus.rankings.every((row) => Number.isFinite(row.recentExposureCount) && row.recentExposureCount >= 0), 'exposure counts must be finite non-negative values')

const categories = new Set(corpus.rankings.map((row) => row.categoryId))
const subcategories = new Set(corpus.rankings.map((row) => row.subcategoryId).filter(Boolean))
const metricCount = corpus.rankings.filter((row) => row.rankingType === 'metric').length
const userVoteCount = corpus.rankings.filter((row) => row.rankingType === 'user_vote').length
const itemCounts = corpus.rankings.map((row) => row.itemIds.length)
const zeroViewCount = corpus.rankings.filter((row) => row.uniqueViewCount === 0).length
const worldSizes = [...new Set(corpus.rankings.map((row) => row.worldKey))]
  .map((worldKey) => corpus.rankings.filter((row) => row.worldKey === worldKey).length)

assert(categories.size >= 10, 'content worlds must span at least ten categories')
assert(subcategories.size >= 30, 'content worlds must span at least thirty subcategories')
assert(metricCount > 0 && userVoteCount > 0, 'corpus must contain both metric and user_vote ranking types')
assert(Math.min(...worldSizes) >= 4 && Math.max(...worldSizes) <= 13, 'world sizes must stay within the generator-declared content range')

const corpusSha256 = crypto.createHash('sha256').update(JSON.stringify(corpus.rankings)).digest('hex')

const report = {
  corpusId: corpus.corpusId,
  generatorSeed: corpus.generatorSeed,
  generationBoundary: corpus.generationBoundary,
  corpusSha256,
  totalRankings: corpus.rankings.length,
  worldCount: corpus.worldCount,
  categoryCount: categories.size,
  subcategoryCount: subcategories.size,
  rankingTypes: {
    metric: metricCount,
    user_vote: userVoteCount,
  },
  worldSizeRange: {
    min: Math.min(...worldSizes),
    max: Math.max(...worldSizes),
  },
  itemCountRange: {
    min: Math.min(...itemCounts),
    max: Math.max(...itemCounts),
  },
  zeroViewRankings: zeroViewCount,
  evaluationState: 'NOT_EXECUTED',
  recommendationImplementationImportedByGenerator: false,
  organicEvidenceClaimed: false,
  productionActivationAuthorized: false,
}

console.log('RF-1M pre-evaluation corpus integrity result:')
console.log(JSON.stringify(report, null, 2))

assert(
  EXPECTED_CORPUS_SHA256 !== 'TO_BE_FROZEN_BEFORE_RF1M_EVALUATION',
  `corpus must be frozen before any RF-1M evaluator exists; observed sha256=${corpusSha256}`,
)
assert(corpusSha256 === EXPECTED_CORPUS_SHA256, `corpus freeze mismatch: expected ${EXPECTED_CORPUS_SHA256}, observed ${corpusSha256}`)

console.log(`RF-1M mixed holdout corpus integrity: PASS (${corpusSha256.slice(0, 16)})`)
