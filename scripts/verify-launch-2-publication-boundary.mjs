import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(path, 'utf8')
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message)
}

const migration = read('supabase/migrations/20260821124800_launch_2_publication_boundary.sql')
const hardening = read('supabase/migrations/20260821130500_launch_2_publication_boundary_perf_hardening.sql')
const allMigrations = `${migration}\n${hardening}`
const publicClient = read('src/lib/supabase/public.ts')
const publicQueries = read('src/lib/queries/public.ts')
const seo = read('src/lib/seo.ts')
const itemPage = read('src/app/items/[itemSlug]/page.tsx')
const docs = read('docs/launch-2-public-publication-boundary.md')
const packageJson = read('package.json')
const ci = read('.github/workflows/ci.yml')

for (const policy of [
  'Items viewable by everyone if active',
  'Categories viewable by everyone if visible',
  'Subcategories viewable by everyone if visible',
]) {
  requireCondition(migration.includes(`DROP POLICY IF EXISTS "${policy}"`), `LAUNCH-2 must replace ${policy}`)
  requireCondition(migration.includes(`CREATE POLICY "${policy}"`), `LAUNCH-2 must recreate ${policy}`)
}

requireCondition(hardening.includes("(SELECT auth.role()) = 'anon'"), 'Item public policy must use an initplan-safe anonymous role lookup')
requireCondition(hardening.includes('ALTER POLICY "Items viewable by everyone if active"'), 'performance hardening must retain the Item publication policy')
requireCondition(allMigrations.includes("status = 'active'"), 'Item public policy must require active state')
requireCondition(allMigrations.includes('re.item_id = items.id'), 'Item public policy must bind ranking membership to the Item')
requireCondition(allMigrations.includes("re.moderation_status IN ('clean', 'suggestive')"), 'Item membership must require a public-safe ranking entry')
requireCondition(allMigrations.includes("r.status = 'published'"), 'public membership must require a published Ranking')
requireCondition(allMigrations.includes("r.moderation_status IN ('clean', 'suggestive')"), 'public membership must require Ranking moderation safety')
requireCondition(allMigrations.includes("r.image_moderation_status IN ('clean', 'suggestive')"), 'public membership must require Ranking image moderation safety')

requireCondition(migration.includes('r.category_id = categories.id'), 'Category public policy must bind a published Ranking to the Category')
requireCondition(migration.includes('r.subcategory_id = subcategories.id'), 'Subcategory public policy must bind a published Ranking to the Subcategory')
requireCondition(migration.includes('c.id = subcategories.category_id') && migration.includes('c.is_visible = TRUE'), 'Subcategory public policy must preserve visible parent Category authority')

requireCondition(migration.includes('CREATE OR REPLACE FUNCTION public.search_public_content'), 'LAUNCH-2 must harden the public search SECURITY DEFINER RPC')
requireCondition(migration.includes('FROM private.p1_3_search_public_content_base('), 'search hardening must preserve the P1-3 base matcher')
requireCondition(migration.includes('v_cursor_id := v_row.id;'), 'search filtering must advance the internal keyset cursor before visibility filtering')
requireCondition(migration.includes("v_row.content_kind = 'ranking'"), 'published Ranking search rows must remain eligible')
requireCondition(migration.includes('WHERE re.item_id = v_row.id'), 'Item search rows must require public Ranking membership')
requireCondition(!migration.includes("IF pg_catalog.cardinality(v_facet_ids) = 0 THEN\n    RETURN QUERY"), 'search must not retain the no-Facet SECURITY DEFINER visibility bypass')
requireCondition(migration.includes('private.p1_4_content_matches_facets'), 'Facet search filtering must remain wired after publication hardening')

requireCondition(migration.includes('CREATE OR REPLACE FUNCTION public.list_public_facet_options'), 'LAUNCH-2 must harden the public Facet SECURITY DEFINER RPC')
requireCondition(migration.includes('FROM public.item_facets itf'), 'Item Facet option discovery must remain explicit')
requireCondition(migration.includes('WHERE re.item_id = i.id'), 'Item Facet options must require published Ranking membership')

requireCondition(hardening.includes('CREATE INDEX IF NOT EXISTS idx_ranking_entries_public_item_membership'), 'LAUNCH-2 must index public Item membership lookup')
requireCondition(hardening.includes('ON public.ranking_entries (item_id, ranking_id)'), 'membership index must lead with item_id')
requireCondition(hardening.includes("WHERE moderation_status IN ('clean', 'suggestive')"), 'membership index must align with the public-safe entry predicate')

for (const forbidden of [
  'DELETE FROM public.items',
  'DELETE FROM public.categories',
  'DELETE FROM public.subcategories',
  'DELETE FROM public.rankings',
  'UPDATE public.items',
  'UPDATE public.categories',
  'UPDATE public.subcategories',
  'UPDATE public.rankings',
  'ALTER TABLE public.rankings',
]) {
  requireCondition(!allMigrations.includes(forbidden), `LAUNCH-2 must not mutate authoring rows or Ranking publication state: ${forbidden}`)
}

requireCondition(publicClient.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY'), 'public readers must remain bound to the anon Supabase authority')
requireCondition(publicQueries.includes("import { createPublicClient } from '@/lib/supabase/public'"), 'public queries must reuse the anon public client')
requireCondition(seo.includes("import { createPublicClient } from '@/lib/supabase/public'"), 'SEO and sitemap readers must reuse the anon public client')
requireCondition(itemPage.includes('if (!item) notFound()'), 'draft-only Item detail must resolve through the existing 404 boundary when RLS hides it')

for (const phrase of [
  'Admin/editor asset existence',
  'Item status = active',
  'Category is_visible = true',
  'draft-only Item route resolves to 404/noindex',
  'idx_ranking_entries_public_item_membership',
  'does not claim that Google',
]) {
  requireCondition(docs.includes(phrase), `LAUNCH-2 docs must freeze boundary language: ${phrase}`)
}

requireCondition(packageJson.includes('"verify:launch-2": "node scripts/verify-launch-2-publication-boundary.mjs"'), 'package.json must expose verify:launch-2')
requireCondition(ci.includes('npm run verify:launch-2'), 'CI must run the LAUNCH-2 verifier')

console.log('LAUNCH-2 publication boundary verified')
