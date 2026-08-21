import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const contextPath = path.join(root, 'src/lib/ranking-subject-context.ts')
const matcherPath = path.join(root, 'src/lib/ranking-subject-suggestions.ts')
const actionPath = path.join(root, 'src/lib/actions/ranking-semantic-context.ts')
const bridgePath = path.join(root, 'src/app/admin/rankings/[id]/edit/SemanticProjectionWithContext.tsx')
const pagePath = path.join(root, 'src/app/admin/rankings/[id]/edit/page.tsx')
const docsPath = path.join(root, 'docs/ia-2h-bounded-semantic-context-signal.md')
const packagePath = path.join(root, 'package.json')
const ciPath = path.join(root, '.github/workflows/ci.yml')

const FROZEN_MATCHER_BLOB_SHA = '49f8d8ea220d1ee1d4fa229f8f3a5a0aff048a47'

function fail(message) {
  console.error(`IA-2H contract verification failed: ${message}`)
  process.exit(1)
}

function expect(condition, message) {
  if (!condition) fail(message)
}

function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`missing ${path.relative(root, filePath)}`)
  return fs.readFileSync(filePath, 'utf8')
}

function gitBlobSha1(buffer) {
  return crypto
    .createHash('sha1')
    .update(`blob ${buffer.length}\0`)
    .update(buffer)
    .digest('hex')
}

const matcherRaw = fs.readFileSync(matcherPath)
expect(gitBlobSha1(matcherRaw) === FROZEN_MATCHER_BLOB_SHA, 'frozen lexical matcher changed')

const contextSource = read(contextPath)
const actionSource = read(actionPath)
const bridgeSource = read(bridgePath)
const pageSource = read(pagePath)
const docsSource = read(docsPath)
const packageSource = read(packagePath)
const ciSource = read(ciPath)

const transpiled = ts.transpileModule(contextSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
  fileName: contextPath,
}).outputText
const contextModule = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)
const { rankRankingSubjectContextSuggestions } = contextModule
expect(typeof rankRankingSubjectContextSuggestions === 'function', 'context ranker export unavailable')

const current = {
  ranking_id: 'current',
  subcategory_id: 'pisa',
  item_ids: ['a', 'b', 'c', 'd', 'e'],
}
const subjectA = [
  { ranking_id: 'a1', subject_key: 'subject-a', subcategory_id: 'pisa', item_ids: ['a', 'b', 'c', 'f', 'g'] },
  { ranking_id: 'a2', subject_key: 'subject-a', subcategory_id: 'pisa', item_ids: ['a', 'b', 'd', 'h', 'i'] },
]

const consensus = rankRankingSubjectContextSuggestions(current, subjectA)
expect(consensus.length === 1, 'two-ranking repeated consensus should emit one suggestion')
expect(consensus[0].subject_key === 'subject-a', 'consensus subject mismatch')
expect(consensus[0].supporting_ranking_count === 2, 'supporting ranking count mismatch')
expect(consensus[0].max_shared_item_count === 3, 'shared item summary mismatch')

const oneSupport = rankRankingSubjectContextSuggestions(current, subjectA.slice(0, 1))
expect(oneSupport.length === 0, 'single supporting ranking must abstain')

const competing = rankRankingSubjectContextSuggestions(current, [
  ...subjectA,
  { ranking_id: 'b1', subject_key: 'subject-b', subcategory_id: 'pisa', item_ids: ['a', 'b', 'c', 'x', 'y'] },
])
expect(competing.length === 0, 'any competing qualifying Subject must force abstention')

const wrongSubcategory = rankRankingSubjectContextSuggestions(current, subjectA.map(row => ({
  ...row,
  subcategory_id: 'other',
})))
expect(wrongSubcategory.length === 0, 'different subcategory must not support context fallback')

const weakOverlap = rankRankingSubjectContextSuggestions(current, [
  { ranking_id: 'w1', subject_key: 'subject-a', subcategory_id: 'pisa', item_ids: ['a', 'x', 'y', 'z'] },
  { ranking_id: 'w2', subject_key: 'subject-a', subcategory_id: 'pisa', item_ids: ['b', 'm', 'n', 'o'] },
])
expect(weakOverlap.length === 0, 'one shared Item per ranking must abstain')

const duplicateItems = rankRankingSubjectContextSuggestions(
  { ...current, item_ids: ['a', 'a', 'b', 'c', 'd', 'e'] },
  subjectA.map(row => ({ ...row, item_ids: [...row.item_ids, row.item_ids[0]] }))
)
expect(duplicateItems.length === 1, 'duplicate Item identities must not break consensus')
expect(duplicateItems[0].max_shared_item_count === 3, 'duplicate Item identities must not inflate overlap')

expect(contextSource.includes('SUBJECT_CONTEXT_MIN_SHARED_ITEMS = 2'), 'shared Item floor not frozen')
expect(contextSource.includes('SUBJECT_CONTEXT_MIN_ITEM_JACCARD = 0.25'), 'Jaccard floor not frozen')
expect(contextSource.includes('SUBJECT_CONTEXT_MIN_SUPPORTING_RANKINGS = 2'), 'support floor not frozen')
expect(contextSource.includes('SUBJECT_CONTEXT_SUGGESTION_LIMIT = 1'), 'single suggestion cap not frozen')
expect(contextSource.includes('supportBySubject.size !== 1'), 'competing Subject abstention contract missing')

expect(actionSource.includes("'use server'"), 'context loader must be server-only')
expect(actionSource.includes('isDiscoveryEligibleProjection'), 'context loader must reuse discovery eligibility')
expect(actionSource.includes('SUBJECT_CONTEXT_PROJECTION_LIMIT = 500'), 'projection query bound missing')
expect(actionSource.includes('SUBJECT_CONTEXT_ENTRY_LIMIT = 5000'), 'entry query bound missing')
expect(actionSource.includes('CURRENT_RANKING_ITEM_LIMIT = 100'), 'current Item query bound missing')
expect(actionSource.includes("meta.status === 'archived'"), 'archived rankings must be excluded')
expect(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(actionSource), 'context loader must remain read-only')

expect(bridgeSource.includes('lexicalSuggestions.length === 0'), 'context fallback must require lexical abstention')
expect(bridgeSource.includes('!exactAlias'), 'exact Alias must suppress context fallback')
expect(bridgeSource.includes('Subject 입력에 사용'), 'explicit operator selection control missing')
expect(bridgeSource.includes('자동 저장/병합 없음'), 'non-mutating UX copy missing')
expect(!bridgeSource.includes('createRankingSubjectAlias'), 'context bridge must not auto-create Alias')
expect(!bridgeSource.includes('saveRankingSemanticProjection'), 'context bridge must not auto-save projection')

expect(pageSource.includes('getRankingSubjectContextSuggestions(id)'), 'edit page does not load context suggestions')
expect(pageSource.includes('SemanticProjectionWithContext'), 'edit page does not mount context bridge')

expect(docsSource.includes('6 / 13'), 'Hosted retrospective feasibility result not documented')
expect(docsSource.includes('0 / 13'), 'Hosted retrospective false recovery result not documented')
expect(docsSource.includes('새 Subject'), 'open-world new Subject invariant missing from docs')
expect(docsSource.includes('embeddings or vector search'), 'explicit semantic-system non-goal missing')

const forbidden = /openai|anthropic|gemini|embedding|vector database|pgvector/i
expect(!forbidden.test(contextSource), 'pure context ranker must not introduce external semantic model dependencies')
expect(!forbidden.test(actionSource), 'context server loader must not introduce external semantic model dependencies')

const packageJson = JSON.parse(packageSource)
expect(packageJson.scripts?.['verify:ia-2h'] === 'node scripts/verify-ia-2h-bounded-context.mjs', 'package verify:ia-2h wiring missing')
expect(ciSource.includes('npm run verify:ia-2h'), 'CI verify:ia-2h wiring missing')

console.log('IA-2H bounded semantic context contracts: PASS')
console.log('frozen_lexical_matcher=UNCHANGED')
console.log('context_signal=REPEATED_ITEM_NEIGHBORHOOD_ONLY')
console.log('context_suggestion_limit=1')
console.log('hosted_retrospective_recovery=6/13')
console.log('hosted_retrospective_false_recovery=0/13')
console.log('organic_evidence_claim=NONE')
