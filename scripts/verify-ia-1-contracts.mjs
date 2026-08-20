import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = process.cwd()
const helperPath = path.join(root, 'src/lib/ranking-neighborhood.ts')
const publicQueryPath = path.join(root, 'src/lib/queries/public.ts')

function fail(message) {
  console.error(`IA-1 contract failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function approx(actual, expected, epsilon = 0.000001) {
  return Math.abs(actual - expected) <= epsilon
}

assert(fs.existsSync(helperPath), 'src/lib/ranking-neighborhood.ts must exist')
assert(fs.existsSync(publicQueryPath), 'src/lib/queries/public.ts must exist')

const helperSource = fs.readFileSync(helperPath, 'utf8')
const publicSource = fs.readFileSync(publicQueryPath, 'utf8')

const transpiled = ts.transpileModule(helperSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
  fileName: helperPath,
}).outputText

const helperUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
const neighborhood = await import(helperUrl)

const {
  ITEM_JACCARD_MIN,
  LEXICAL_JACCARD_MIN,
  calculateItemJaccard,
  calculateLexicalJaccard,
  classifyRankingNeighbor,
  compareRankingNeighbors,
  isSameNonNullSubcategory,
  normalizeRankingTokens,
} = neighborhood

assert(ITEM_JACCARD_MIN === 0.30, 'Item Jaccard cutoff must remain the provisional 0.30 fixture constant')
assert(LEXICAL_JACCARD_MIN === 0.30, 'Lexical Jaccard cutoff must remain the provisional 0.30 fixture constant')
assert(isSameNonNullSubcategory(null, null) === false, 'null subcategories must not be equal context')
assert(isSameNonNullSubcategory('fifa', 'fifa') === true, 'matching non-null subcategories must be equal context')

function node({ id, category = 'category', subcategory = 'subcategory', title, items = [], publishedAt = '2026-08-20T00:00:00Z' }) {
  return {
    id,
    categoryId: category,
    subcategoryId: subcategory,
    title,
    itemIds: items,
    publishedAt,
  }
}

const kboWin = node({ id: 'kbo-win', category: 'sports', subcategory: 'kbo', title: '2025 KBO 팀 승률 TOP 5', items: ['a', 'b', 'c', 'd', 'e'] })
const kboBat = node({ id: 'kbo-bat', category: 'sports', subcategory: 'kbo', title: '2025 KBO 팀 타율 TOP 5', items: ['c', 'd', 'e', 'f', 'g'] })
const kboRelation = classifyRankingNeighbor(kboWin, kboBat)
assert(kboRelation?.tier === 'A', 'KBO win-rate ↔ batting-average must be Tier A')
assert(approx(kboRelation.itemJaccard, 3 / 7), 'KBO Item Jaccard must be 3/7')
assert(approx(kboRelation.lexicalJaccard, 2 / 4), 'KBO lexical Jaccard must be 0.5')

const pisaScience = node({ id: 'pisa-science', category: 'education', subcategory: 'pisa', title: 'PISA 2022 과학 평균점수 TOP 5', items: ['a', 'b', 'c', 'd', 'e'] })
const pisaMath = node({ id: 'pisa-math', category: 'education', subcategory: 'pisa', title: 'PISA 2022 수학 평균점수 TOP 5', items: ['b', 'c', 'd', 'e', 'f'] })
assert(classifyRankingNeighbor(pisaScience, pisaMath)?.tier === 'A', 'PISA science ↔ math must be Tier A')

const fifaWomen = node({ id: 'fifa-women', category: 'sports', subcategory: 'fifa', title: '2026년 6월 FIFA 여자 세계랭킹 TOP 5', items: ['w1', 'w2', 'w3', 'w4', 'w5'] })
const fifaMen = node({ id: 'fifa-men', category: 'sports', subcategory: 'fifa', title: '2026년 7월 FIFA 남자 세계랭킹 TOP 5', items: ['m1', 'm2', 'm3', 'm4', 'm5'] })
const fifaRelation = classifyRankingNeighbor(fifaWomen, fifaMen)
assert(fifaRelation?.tier === 'C', 'FIFA women ↔ men must survive as lexical-only same-subcategory Tier C')
assert(fifaRelation.sharedItemCount === 0, 'FIFA fixture must have zero shared Items')
assert(approx(fifaRelation.lexicalJaccard, 0.5), 'FIFA lexical Jaccard must be 0.5')

const inflow = node({ id: 'inflow', category: 'stats', subcategory: 'kr', title: '2025 시도 순유입률 TOP 3', items: ['a', 'b', 'c'] })
const outflow = node({ id: 'outflow', category: 'stats', subcategory: 'kr', title: '2025 시도 순유출률 TOP 3', items: ['d', 'e', 'f'] })
const migrationRelation = classifyRankingNeighbor(inflow, outflow)
assert(migrationRelation?.tier === 'C', '순유입률 ↔ 순유출률 must remain above the lexical boundary')
assert(approx(migrationRelation.lexicalJaccard, 1 / 3), '시도 fixture lexical Jaccard must be 1/3')

const gdp = node({ id: 'gdp', category: 'stats', subcategory: 'world', title: '2024 명목 GDP TOP 5', items: ['us', 'cn', 'de', 'jp', 'in'] })
const population = node({ id: 'population', category: 'stats', subcategory: 'world', title: '2024 인구 TOP 5', items: ['in', 'cn', 'us', 'id', 'pk'] })
const gdpPopulationRelation = classifyRankingNeighbor(gdp, population)
assert(gdpPopulationRelation?.tier === 'B', 'GDP ↔ population must be Item-only same-subcategory Tier B')
assert(approx(gdpPopulationRelation.itemJaccard, 3 / 7), 'GDP ↔ population Item Jaccard must be 3/7')
assert(gdpPopulationRelation.lexicalJaccard === 0, 'GDP ↔ population lexical Jaccard must be zero after normalization')

const unesco = node({ id: 'unesco', category: 'heritage', subcategory: 'world-heritage', title: '2026 UNESCO 세계유산 보유 건수 TOP 5', items: ['it', 'cn', 'de', 'fr', 'es'] })
const unescoGdp = classifyRankingNeighbor(unesco, gdp)
assert(unescoGdp === null, 'UNESCO ↔ GDP must not qualify from shared countries alone')
assert(approx(calculateItemJaccard(unesco.itemIds, gdp.itemIds), 2 / 8), 'UNESCO ↔ GDP Item Jaccard fixture must be 0.25')

const nullSubA = node({ id: 'null-a', category: 'stats', subcategory: null, title: '서로 다른 주제 A', items: [] })
const nullSubB = node({ id: 'null-b', category: 'stats', subcategory: null, title: '완전히 다른 주제 B', items: [] })
assert(classifyRankingNeighbor(nullSubA, nullSubB) === null, 'two null subcategories must not create a contextual neighbor')

const top5 = ['1', '2', '3', '4', '5']
const top100 = Array.from({ length: 100 }, (_, index) => String(index + 1))
assert(approx(calculateItemJaccard(top5, top100), 0.05), 'TOP5 contained in TOP100 must have Item Jaccard 0.05')

const lexicalContainment = calculateLexicalJaccard('남자 향수 TOP 5', '20대 여름 남자 향수 TOP 10')
assert(lexicalContainment > 0 && lexicalContainment < 1, 'short-title lexical containment must not force similarity to 1.0')

const reverseRelation = classifyRankingNeighbor(kboBat, kboWin)
assert(reverseRelation?.tier === kboRelation.tier, 'pair tier must be symmetric')
assert(approx(reverseRelation.itemJaccard, kboRelation.itemJaccard), 'Item Jaccard must be symmetric')
assert(approx(reverseRelation.lexicalJaccard, kboRelation.lexicalJaccard), 'lexical Jaccard must be symmetric')

const older = { ...kboRelation, candidateId: 'older', publishedAt: '2025-01-01T00:00:00Z' }
const newer = { ...kboRelation, candidateId: 'newer', publishedAt: '2026-01-01T00:00:00Z' }
assert(compareRankingNeighbors(newer, older) < 0, 'newer publication must win only after relation metrics tie')

const tokens = normalizeRankingTokens('2026년 7월 FIFA 남자 세계랭킹 TOP 5')
assert(!tokens.includes('top') && !tokens.includes('5') && !tokens.includes('2026년') && !tokens.includes('7월'), 'boilerplate/date tokens must be removed deterministically')

const relatedStart = publicSource.indexOf('export async function getRelatedRankings')
const relatedEnd = publicSource.indexOf('/**\n * 관련 아이템', relatedStart)
assert(relatedStart >= 0 && relatedEnd > relatedStart, 'getRelatedRankings source boundary must be detectable')
const relatedSource = publicSource.slice(relatedStart, relatedEnd)

assert(relatedSource.includes('SAME_SUBCATEGORY_CANDIDATE_LIMIT'), 'same-subcategory candidate source must be bounded by a named constant')
assert(relatedSource.includes('SHARED_ITEM_CANDIDATE_ROW_LIMIT'), 'shared-Item candidate source must be bounded by a named constant')
assert(relatedSource.includes(".order('ranking_id', { ascending: true })"), 'shared-Item candidate rows must have stable ordering')
assert(relatedSource.includes(".order('id', { ascending: true })"), 'candidate collection must include a stable ID tie-break')
assert(relatedSource.includes(".in('ranking_id', candidateIds)"), 'candidate Item sets must be hydrated in one batch')
assert(relatedSource.includes('items!inner(id)'), 'candidate Item hydration must enforce public Item visibility')
assert(relatedSource.includes('Promise.all(candidateQueries)'), 'candidate sources should run as a bounded batch')
assert(relatedSource.includes('candidateMap'), 'candidate IDs must be deduplicated before relation evaluation')
assert(relatedSource.includes('PUBLIC_MODERATION_STATUSES'), 'canonical public moderation statuses must be reused')
assert(relatedSource.includes('classifyRankingNeighbor'), 'domain helper must own contextual gate classification')
assert(relatedSource.includes('compareRankingNeighbors'), 'domain helper must own deterministic relation ordering')
assert(relatedSource.includes('explainRankingNeighbor'), 'relation reason must be explainable')
assert(!relatedSource.includes(".from('ranking_facets')"), 'IA-1 related Ranking runtime must not query Facets')
assert(!relatedSource.includes(".eq('category_id', ranking.category_id)"), 'IA-1 must not introduce broad same-category candidate scans')
assert(!relatedSource.includes('ranking_type'), 'ranking_type must not participate in the contextual gate')

console.log('IA-1 neighborhood contracts: PASS')
