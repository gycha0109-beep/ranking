import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const fail = (message) => {
  console.error(`[P1-3 contract] ${message}`)
  process.exitCode = 1
}
const requireText = (source, needle, label) => {
  if (!source.includes(needle)) fail(`${label}: missing ${JSON.stringify(needle)}`)
}
const forbid = (source, pattern, label) => {
  if (pattern.test(source)) fail(`${label}: forbidden pattern ${pattern}`)
}

const migrationDir = path.join(root, 'supabase', 'migrations')
const migrationNames = fs.readdirSync(migrationDir).filter((name) => name.endsWith('.sql'))
const p13Migrations = migrationNames.filter((name) => name.endsWith('_p1_3_search_discovery.sql'))

if (p13Migrations.length !== 1) {
  fail(`expected exactly one P1-3 search migration, found ${p13Migrations.length}`)
} else {
  const migration = read(path.join('supabase', 'migrations', p13Migrations[0]))
  const trimmed = migration.trim()

  if (!trimmed.startsWith('BEGIN;')) fail('migration must start with BEGIN;')
  if (!trimmed.endsWith('COMMIT;')) fail('migration must end with COMMIT;')

  requireText(migration, 'CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;', 'pg_trgm')
  requireText(migration, 'ADD COLUMN search_text TEXT GENERATED ALWAYS AS', 'content generated search text')
  requireText(migration, 'ADD COLUMN search_name TEXT GENERATED ALWAYS AS', 'classification generated search name')
  requireText(migration, 'extensions.gin_trgm_ops', 'trigram index operator class')
  requireText(migration, 'idx_ranking_facets_p1_3_reverse', 'ranking facet reverse index')
  requireText(migration, 'idx_item_facets_p1_3_reverse', 'item facet reverse index')
  requireText(migration, 'CREATE OR REPLACE FUNCTION public.search_public_content(', 'public search RPC')
  requireText(migration, 'CREATE OR REPLACE FUNCTION public.list_public_rankings(', 'public ranking list RPC')
  requireText(migration, 'SECURITY DEFINER', 'security definer boundary')
  requireText(migration, 'SET search_path = pg_catalog, pg_temp', 'fixed search path')
  requireText(migration, "r.status = 'published'", 'ranking public status predicate')
  requireText(migration, "r.moderation_status IN ('clean', 'suggestive')", 'ranking moderation predicate')
  requireText(migration, "r.image_moderation_status IN ('clean', 'suggestive')", 'ranking image moderation predicate')
  requireText(migration, "i.status = 'active'", 'item public status predicate')
  requireText(migration, "i.moderation_status IN ('clean', 'suggestive')", 'item moderation predicate')
  requireText(migration, "i.image_moderation_status IN ('clean', 'suggestive')", 'item image moderation predicate')
  requireText(migration, 'v_escaped := pg_catalog.replace(', 'literal LIKE escaping')
  requireText(migration, "ESCAPE E'\\\\'", 'explicit LIKE escape')
  requireText(migration, 'OPERATOR(extensions.%>)', 'trigram fuzzy candidate operator')
  requireText(migration, 'extensions.word_similarity', 'field fuzzy scoring')
  requireText(migration, 'p_limit INTEGER DEFAULT 20', 'bounded default limit')
  requireText(migration, 'IF v_limit < 1 OR v_limit > 50 THEN', 'hard DB limit')
  requireText(migration, 'x.id ASC', 'stable UUID tie break')
  requireText(migration, 'REVOKE ALL ON FUNCTION public.search_public_content(', 'search execute hardening')
  requireText(migration, 'GRANT EXECUTE ON FUNCTION public.search_public_content(', 'search RPC grant')
  requireText(migration, 'REVOKE ALL ON FUNCTION public.list_public_rankings(', 'browse execute hardening')
  requireText(migration, 'GRANT EXECUTE ON FUNCTION public.list_public_rankings(', 'browse RPC grant')
  requireText(migration, 'public.content_view_totals', 'aggregate view reads')
  requireText(migration, 'public.content_likes', 'aggregate like reads')

  forbid(migration, /viewer_key_hash/i, 'viewer identity must not enter P1-3')
  forbid(migration, /CREATE\s+TABLE[\s\S]{0,120}(search[_\s-]?(?:query|log|history)|query[_\s-]?log)/i, 'raw search logging table')
  forbid(migration, /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)[\s\S]{0,80}ON\s+(?:TABLE\s+)?public\.(?:content_likes|content_view_totals)/i, 'engagement table direct grant')

  const baseScores = [...migration.matchAll(/THEN\s+(120000|110000|100000|90000|80000|70000|60000|50000|40000|30000|10000)\b/g)]
    .map((match) => Number(match[1]))
  if (baseScores.length < 10) fail('relevance tier constants are unexpectedly missing')
  requireText(migration, 'LEAST(\n              9999,', 'fuzzy bonus ceiling')
}

const searchPage = read('src/app/search/page.tsx')
requireText(searchPage, 'const params = await searchParams', 'Next 16 async searchParams')
requireText(searchPage, 'searchPublicContent({ query, kind, sort, cursor })', 'search page query connection')
requireText(searchPage, '검색 결과가 없습니다', 'no-result UX')
requireText(searchPage, 'historySync', 'search page runtime history synchronization opt-in')

const searchForm = read('src/components/SearchForm.tsx')
requireText(searchForm, "'use client'", 'search form client history boundary')
requireText(searchForm, 'action="/search"', 'GET search action')
requireText(searchForm, 'method="get"', 'GET search method')
requireText(searchForm, 'minLength={2}', 'client search minimum')
requireText(searchForm, 'maxLength={120}', 'client search maximum')
requireText(searchForm, 'const formKey = JSON.stringify([defaultQuery, defaultKind, defaultSort, facetIds])', 'canonical search form remount identity')
requireText(searchForm, '<form ref={formRef} key={formKey} action="/search"', 'canonical search form remount boundary')
requireText(searchForm, 'form.reset()', 'history restore must reset uncontrolled controls to canonical defaults')
requireText(searchForm, "window.addEventListener('pageshow', restoreCanonicalControls)", 'BFCache pageshow synchronization')
requireText(searchForm, "window.addEventListener('popstate', restoreCanonicalControls)", 'history popstate synchronization')
requireText(searchForm, "queryControl.value = params.get('q') ?? ''", 'history-restored query synchronization')
requireText(searchForm, "kindControl.value = SEARCH_KINDS.has(requestedKind) ? requestedKind : 'all'", 'history-restored kind synchronization')
requireText(searchForm, "sortControl.value = SEARCH_SORTS.has(requestedSort) ? requestedSort : 'relevance'", 'history-restored sort synchronization')

const searchQueries = read('src/lib/queries/search.ts')
requireText(searchQueries, 'SEARCH_PAGE_SIZE + 1', 'limit + 1 pagination')
requireText(searchQueries, "supabase.rpc('search_public_content'", 'search RPC query')
requireText(searchQueries, "supabase.rpc('list_public_rankings'", 'browse RPC query')
requireText(searchQueries, 'cursorAccepted', 'invalid cursor fallback signal')

const cursor = read('src/lib/search/cursor.ts')
requireText(cursor, "from 'node:crypto'", 'cursor server-side fingerprint primitive')
requireText(cursor, "'p1-3-search-v1'", 'search cursor version fingerprint')
requireText(cursor, "'p1-3-ranking-browse-v1'", 'browse cursor version fingerprint')
requireText(cursor, 'isValidTimestamp', 'cursor timestamp validation')
requireText(cursor, 'isValidUuid', 'cursor UUID validation')
requireText(cursor, 'isNonNegativeSafeInteger', 'cursor metric validation')

const categoryPage = read('src/app/categories/[categorySlug]/page.tsx')
const subcategoryPage = read('src/app/categories/[categorySlug]/[subcategorySlug]/page.tsx')
requireText(categoryPage, 'listPublicRankings({', 'category bounded browse')
requireText(subcategoryPage, 'listPublicRankings({', 'subcategory bounded browse')
forbid(categoryPage, /getPublishedRankingsByCategory/, 'legacy unbounded category query')
forbid(subcategoryPage, /getPublishedRankingsBySubcategory/, 'legacy unbounded subcategory query')

const publicQueries = read('src/lib/queries/public.ts')
forbid(publicQueries, /export async function getPublishedRankingsByCategory/, 'legacy category query export')
forbid(publicQueries, /export async function getPublishedRankingsBySubcategory/, 'legacy subcategory query export')
requireText(publicQueries, 'return a.id.localeCompare(b.id)', 'related recommendation UUID tie break')

const home = read('src/app/page.tsx')
const homeQueries = read('src/lib/queries/home.ts')
requireText(homeQueries, ".in('moderation_status', PUBLIC_MODERATION_STATUSES)", 'explicit home moderation boundary')
requireText(homeQueries, ".in('image_moderation_status', PUBLIC_MODERATION_STATUSES)", 'explicit home image moderation boundary')
requireText(home, '새로 업데이트', 'home latest wording')
forbid(home, /<SearchForm\s+hero\s*\/>/, 'home must not duplicate global navbar search')
forbid(home, /disabled[\s\S]{0,120}P1 준비중/, 'disabled legacy search')

const navbar = read('src/components/Navbar.tsx')
requireText(navbar, '<SearchForm compact />', 'desktop navbar search')
requireText(navbar, 'href="/search"', 'mobile navbar search entry')

const packageJson = JSON.parse(read('package.json'))
if (packageJson.scripts?.['verify:p1-3'] !== 'node scripts/verify-p1-3-contracts.mjs') {
  fail('package.json must expose verify:p1-3')
}

const ci = read('.github/workflows/ci.yml')
requireText(ci, 'workflow_dispatch:', 'manual exact-head CI trigger')
requireText(ci, 'npm run verify:p1-2', 'P1-2 CI contract')
requireText(ci, 'npm run verify:p1-3', 'P1-3 CI contract')

if (process.exitCode) {
  console.error('P1-3 static contract verification failed.')
  process.exit(process.exitCode)
}

console.log('P1-3 static contract verification passed.')
