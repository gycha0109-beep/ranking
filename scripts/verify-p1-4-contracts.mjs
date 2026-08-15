import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const fail = (message) => {
  console.error(`[P1-4 contract] ${message}`)
  process.exitCode = 1
}
const requireText = (source, needle, label) => {
  if (!source.includes(needle)) fail(`${label}: missing ${JSON.stringify(needle)}`)
}
const forbid = (source, pattern, label) => {
  if (pattern.test(source)) fail(`${label}: forbidden pattern ${pattern}`)
}

const migrationDir = path.join(root, 'supabase', 'migrations')
const migrations = fs.readdirSync(migrationDir).filter((name) => name.endsWith('.sql'))
const p14 = migrations.filter((name) => name.endsWith('_p1_4_facet_discovery.sql'))

if (p14.length !== 1) {
  fail(`expected exactly one P1-4 migration, found ${p14.length}`)
} else {
  const migration = read(path.join('supabase', 'migrations', p14[0]))
  const trimmed = migration.trim()
  if (!trimmed.startsWith('BEGIN;')) fail('migration must start with BEGIN;')
  if (!trimmed.endsWith('COMMIT;')) fail('migration must end with COMMIT;')

  requireText(migration, 'private.p1_4_validate_facet_ids', 'facet validator')
  requireText(migration, 'private.p1_4_content_matches_facets', 'OR/AND matcher')
  requireText(migration, 'public.list_public_facet_options', 'public facet option RPC')
  requireText(migration, "fg.applies_to = 'both'", 'mixed scope both-only rule')
  requireText(migration, "fg.applies_to IN ('ranking', 'both')", 'ranking applicability')
  requireText(migration, "fg.applies_to IN ('item', 'both')", 'item applicability')
  requireText(migration, 'v_count > 12', 'DB max facet limit')
  requireText(migration, 'GROUP BY f.facet_group_id', 'facet group composition')
  requireText(migration, 'rf.facet_id = ANY(sg.facet_ids)', 'ranking same-group OR')
  requireText(migration, 'itf.facet_id = ANY(sg.facet_ids)', 'item same-group OR')
  requireText(migration, 'ALTER FUNCTION public.search_public_content(', 'search base move')
  requireText(migration, 'p1_3_search_public_content_base', 'private P1-3 search base')
  requireText(migration, "p_facet_ids UUID[] DEFAULT '{}'::UUID[]", 'default facet array')
  requireText(migration, 'ALTER FUNCTION public.list_public_rankings(', 'browse base move')
  requireText(migration, 'p1_3_list_public_rankings_base', 'private P1-3 browse base')
  requireText(migration, 'SET search_path = pg_catalog, pg_temp', 'fixed search path')
  requireText(migration, "r.status = 'published'", 'option ranking status predicate')
  requireText(migration, "r.moderation_status IN ('clean', 'suggestive')", 'option ranking moderation predicate')
  requireText(migration, "r.image_moderation_status IN ('clean', 'suggestive')", 'option ranking image predicate')
  requireText(migration, "i.status = 'active'", 'option item status predicate')
  requireText(migration, "i.moderation_status IN ('clean', 'suggestive')", 'option item moderation predicate')
  requireText(migration, "i.image_moderation_status IN ('clean', 'suggestive')", 'option item image predicate')
  requireText(migration, 'REVOKE ALL ON FUNCTION public.list_public_facet_options', 'facet option public revoke')
  requireText(migration, 'GRANT EXECUTE ON FUNCTION public.list_public_facet_options', 'facet option grant')
  requireText(migration, 'REVOKE ALL ON FUNCTION private.p1_3_search_public_content_base', 'private search base revoke')
  requireText(migration, 'REVOKE ALL ON FUNCTION private.p1_3_list_public_rankings_base', 'private browse base revoke')
  forbid(migration, /CREATE\s+INDEX/i, 'P1-4 must reuse existing facet indexes unless review changes contract')
  forbid(migration, /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)[\s\S]{0,80}ON\s+(?:TABLE\s+)?public\.(?:content_likes|content_view_totals)/i, 'engagement direct grants')
}

const contracts = read('src/lib/search/contracts.ts')
requireText(contracts, 'FACET_FILTER_MAX = 12', 'application facet maximum')
requireText(contracts, 'resolveFacetIds', 'facet URL parser')
requireText(contracts, 'canonicalizeFacetIds', 'context canonicalizer')
requireText(contracts, "params.append('facet', id)", 'repeated facet URL params')

const cursor = read('src/lib/search/cursor.ts')
requireText(cursor, "'p1-3-search-v1'", 'P1-3 no-filter search fingerprint preservation')
requireText(cursor, "'p1-3-ranking-browse-v1'", 'P1-3 no-filter browse fingerprint preservation')
requireText(cursor, "'p1-4-facets-v1'", 'filtered fingerprint extension')
requireText(cursor, 'if (facetIds.length > 0)', 'empty-filter backward fingerprint')

const queryLayer = read('src/lib/queries/search.ts')
requireText(queryLayer, "supabase.rpc('list_public_facet_options'", 'facet option query')
requireText(queryLayer, 'p_facet_ids: facetIds', 'search/browse facet RPC parameter')
requireText(queryLayer, 'createSearchFingerprint(args.query, args.kind, args.sort, facetIds)', 'search facet fingerprint')
requireText(queryLayer, 'createRankingBrowseFingerprint(args.categorySlug, subcategorySlug, args.sort, facetIds)', 'browse facet fingerprint')

const panel = read('src/components/FacetFilterPanel.tsx')
requireText(panel, 'method="get"', 'Facet GET form')
requireText(panel, 'name="facet"', 'Facet repeated checkbox param')
requireText(panel, '같은 그룹에서는 하나라도 일치', 'OR/AND UX explanation')
requireText(panel, '전체 해제', 'clear all UX')

const searchPage = read('src/app/search/page.tsx')
requireText(searchPage, 'facet?: string | string[]', 'search facet params')
requireText(searchPage, 'getPublicFacetOptions({ kind })', 'search option scope')
requireText(searchPage, 'canonicalizeFacetIds', 'search incompatible facet cleanup')
requireText(searchPage, '<FacetFilterPanel', 'search facet UI')
requireText(searchPage, 'appendFacetParams(next, facetIds)', 'search next cursor facet persistence')

for (const file of [
  'src/app/categories/[categorySlug]/page.tsx',
  'src/app/categories/[categorySlug]/[subcategorySlug]/page.tsx',
]) {
  const source = read(file)
  requireText(source, 'facet?: string | string[]', `${file} facet params`)
  requireText(source, "getPublicFacetOptions({ kind: 'ranking'", `${file} ranking facet options`)
  requireText(source, 'canonicalizeFacetIds', `${file} facet cleanup`)
  requireText(source, '<FacetFilterPanel', `${file} facet UI`)
  requireText(source, 'appendFacetParams(params, facetIds)', `${file} facet URL persistence`)
  requireText(source, 'facetIds,', `${file} filtered browse query`)
}

const packageJson = JSON.parse(read('package.json'))
if (packageJson.scripts?.['verify:p1-4'] !== 'node scripts/verify-p1-4-contracts.mjs') {
  fail('package.json must expose verify:p1-4')
}

const ci = read('.github/workflows/ci.yml')
requireText(ci, 'npm run verify:p1-2', 'P1-2 regression gate')
requireText(ci, 'npm run verify:p1-3', 'P1-3 regression gate')
requireText(ci, 'npm run verify:p1-4', 'P1-4 CI gate')

if (process.exitCode) {
  console.error('P1-4 static contract verification failed.')
  process.exit(process.exitCode)
}

console.log('P1-4 static contract verification passed.')
