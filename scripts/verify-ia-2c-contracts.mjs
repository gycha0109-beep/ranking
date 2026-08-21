import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const suggestionPath = path.join(root, 'src/lib/ranking-subject-suggestions.ts')
const inputPath = path.join(root, 'src/lib/ranking-semantic-input.ts')
const actionPath = path.join(root, 'src/lib/actions/ranking-semantic.ts')
const panelPath = path.join(root, 'src/app/admin/rankings/[id]/edit/SemanticProjectionPanel.tsx')
const migrationPath = path.join(root, 'supabase/migrations/20260821034000_ia_2c_subject_aliases.sql')
const creatorIndexMigrationPath = path.join(root, 'supabase/migrations/20260821034500_ia_2c_subject_alias_created_by_index.sql')
const docPath = path.join(root, 'docs/ia-2c-canonical-subject-alias-deterministic-suggestion.md')

function fail(message) {
  console.error(`IA-2C contract failed: ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

for (const filePath of [suggestionPath, inputPath, actionPath, panelPath, migrationPath, creatorIndexMigrationPath, docPath]) {
  assert(fs.existsSync(filePath), `${path.relative(root, filePath)} must exist`)
}

const suggestionSource = fs.readFileSync(suggestionPath, 'utf8')
const inputSource = fs.readFileSync(inputPath, 'utf8')
const actionSource = fs.readFileSync(actionPath, 'utf8')
const panelSource = fs.readFileSync(panelPath, 'utf8')
const migration = fs.readFileSync(migrationPath, 'utf8')
const creatorIndexMigration = fs.readFileSync(creatorIndexMigrationPath, 'utf8')
const doc = fs.readFileSync(docPath, 'utf8')
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8')
const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')

function loadTsModule(source, fileName) {
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
    fileName,
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)
}

const suggestionModule = await loadTsModule(suggestionSource, suggestionPath)
const inputModule = await loadTsModule(inputSource, inputPath)
const {
  RANKING_SUBJECT_SUGGESTION_LIMIT,
  normalizeRankingSubjectLookup,
  rankRankingSubjectSuggestions,
} = suggestionModule
const { normalizeRankingSemanticKey, isRankingSemanticKey } = inputModule

assert(RANKING_SUBJECT_SUGGESTION_LIMIT === 5, 'subject suggestions must remain bounded to five')
assert(normalizeRankingSubjectLookup(' PISA-Country-Performance ') === 'pisa-country-performance', 'suggestion lookup must normalize deterministically')
assert(normalizeRankingSemanticKey(' FIFA-World-Ranking ') === 'fifa-world-ranking', 'server semantic key normalization must remain shared and deterministic')
assert(isRankingSemanticKey('mens-fragrance'), 'valid open-world semantic key must be accepted')
assert(!isRankingSemanticKey('남자 향수'), 'raw arbitrary labels must not become canonical keys directly')

const options = [
  { subject_key: 'mens-fragrance', usage_count: 7, aliases: ['male-fragrance', 'men-perfume'] },
  { subject_key: 'pisa-country-performance', usage_count: 3, aliases: [] },
  { subject_key: 'fifa-world-ranking', usage_count: 2, aliases: ['fifa-ranking'] },
]

const aliasExact = rankRankingSubjectSuggestions(' men-perfume ', options)
assert(aliasExact[0]?.subject_key === 'mens-fragrance', 'exact reviewed alias must suggest its canonical Subject first')
assert(aliasExact[0]?.matched_by === 'alias', 'alias provenance must be exposed in deterministic suggestion result')

const canonicalPrefix = rankRankingSubjectSuggestions('pisa', options)
assert(canonicalPrefix[0]?.subject_key === 'pisa-country-performance', 'canonical prefix must rank deterministically')

const fuzzy = rankRankingSubjectSuggestions('fifa-ranking', options)
assert(fuzzy[0]?.subject_key === 'fifa-world-ranking', 'reviewed alias must support deterministic reuse suggestion')

const empty = rankRankingSubjectSuggestions('', options)
assert(empty.length <= 5, 'empty-query canonical catalog must remain bounded')
assert(empty[0]?.subject_key === 'mens-fragrance', 'usage count must deterministically order empty-query suggestions')

assert(migration.includes('CREATE TABLE IF NOT EXISTS public.ranking_semantic_subject_aliases'), 'reviewed Subject alias table must exist')
assert(migration.includes('alias_key text PRIMARY KEY'), 'alias key must be unique')
assert(migration.includes('canonical_subject_key text NOT NULL'), 'alias must resolve to one canonical Subject key')
assert(migration.includes('CHECK (alias_key <> canonical_subject_key)'), 'identity aliases must be rejected')
assert(migration.includes('ENABLE ROW LEVEL SECURITY'), 'alias governance table must use RLS')
assert(migration.includes('REVOKE ALL PRIVILEGES ON TABLE public.ranking_semantic_subject_aliases FROM anon, authenticated'), 'public clients must receive no alias governance privileges')
assert(!migration.includes('GRANT SELECT ON TABLE public.ranking_semantic_subject_aliases TO anon'), 'alias table must not become a public taxonomy endpoint')
assert(!/ALTER TABLE\s+public\.rankings\b/i.test(migration), 'IA-2C must not add mandatory authored columns to rankings')
assert(creatorIndexMigration.includes('idx_ranking_semantic_subject_aliases_created_by'), 'created_by foreign key must have a covering index')
assert(creatorIndexMigration.includes('ON public.ranking_semantic_subject_aliases(created_by)'), 'creator index must cover the governance provenance foreign key')

assert(actionSource.includes('SUBJECT_CATALOG_PROJECTION_LIMIT = 1000'), 'canonical catalog reads must remain bounded')
assert(actionSource.includes('SUBJECT_ALIAS_LIMIT = 500'), 'alias catalog reads must remain bounded')
assert(actionSource.includes(".from('ranking_semantic_subject_aliases')"), 'server actions must use reviewed alias mappings')
assert(actionSource.includes('resolveCanonicalSubjectKey'), 'projection save must exact-resolve reviewed aliases')
assert(actionSource.includes('canonicalSubjectKey !== parsed.value.subject_key'), 'save result must expose alias-resolution provenance')
assert(actionSource.includes('createRankingSubjectAlias'), 'admin must be able to create reviewed aliases')
assert(actionSource.includes('deleteRankingSubjectAlias'), 'admin must be able to remove reviewed aliases')
assert(actionSource.includes('이미 실제 projection의 Canonical Subject로 사용 중인 key는 Alias로 바꿀 수 없습니다.'), 'canonical-to-alias collision must be guarded')
assert(actionSource.includes('alias chain은 허용하지 않습니다.'), 'alias chains must be rejected')
assert(actionSource.includes('Canonical Subject는 먼저 실제 projection에서 사용된 key여야 합니다.'), 'new aliases must target an observed canonical concept')
assert(actionSource.includes("projection_version: 'ia-2b-admin-manual-v1'"), 'IA-2C alias governance must preserve reviewed ingestion provenance from IA-2B')
assert(!actionSource.includes("status: 'published'"), 'IA-2C must never publish a ranking')
assert(!actionSource.includes('published_at:'), 'IA-2C must never mutate publication timestamps')

assert(panelSource.includes('새 Subject를 그대로 만드는 것도 허용합니다.'), 'UI must preserve open-world Subject creation')
assert(panelSource.includes('Deterministic suggestions'), 'UI must expose deterministic canonical reuse suggestions')
assert(panelSource.includes('Alias 연결'), 'UI must require explicit alias creation')
assert(panelSource.includes('exact Alias'), 'UI must make exact alias resolution visible')
assert(panelSource.includes('AI/embedding 없이'), 'suggestions must remain AI-independent')
assert(panelSource.includes('경고 전용 · 저장/발행 hard block 없음'), 'identity advisory must remain non-blocking')

assert(doc.includes('Existing canonical Subjects are suggested for reuse, not required.'), 'documentation must preserve optional reuse semantics')
assert(doc.includes('`분류 실패 = 게시 실패` remains forbidden.'), 'documentation must preserve free publication')
assert(doc.includes('a global Topic/Subject ontology'), 'documentation must explicitly defer global ontology work')
assert(packageJson.includes('"verify:ia-2c"'), 'package verifier script must be wired')
assert(ci.includes('npm run verify:ia-2c'), 'CI must run the IA-2C verifier')

console.log('IA-2C canonical Subject alias & deterministic suggestion contracts: PASS')
