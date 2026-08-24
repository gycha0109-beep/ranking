import fs from 'node:fs'

const migrationPath = 'supabase/migrations/20260824003000_audit_r4_rls_fk_performance_hygiene.sql'
const migration = fs.readFileSync(migrationPath, 'utf8')

const failures = []

function requireText(text, label) {
  if (!migration.includes(text)) failures.push(`missing: ${label}`)
}

function forbid(pattern, label) {
  if (pattern.test(migration)) failures.push(`forbidden: ${label}`)
}

for (const [policy, table] of [
  ['Categories manageable by admin only', 'categories'],
  ['Subcategories manageable by admin only', 'subcategories'],
  ['Rankings manageable by admin', 'rankings'],
  ['Items manageable by admin', 'items'],
  ['Ranking entries manageable by admin', 'ranking_entries'],
  ['Ranking criteria manageable by admin', 'ranking_criteria'],
  ['Ranking sources manageable by admin', 'ranking_sources'],
  ['Ranking facets manageable by admin', 'ranking_facets'],
  ['Facet groups manageable by admin', 'facet_groups'],
  ['Facets manageable by admin', 'facets'],
  ['Item facets manageable by admin', 'item_facets'],
  ['Moderation terms manageable by admin', 'moderation_terms'],
]) {
  requireText(`DROP POLICY IF EXISTS "${policy}" ON public.${table};`, `${policy} SELECT-overlap removal`)
}

for (const prefix of [
  'Categories',
  'Subcategories',
  'Rankings',
  'Items',
  'Ranking entries',
  'Ranking criteria',
  'Ranking sources',
  'Ranking facets',
  'Facet groups',
  'Facets',
  'Item facets',
  'Moderation terms',
]) {
  requireText(`CREATE POLICY "${prefix} insertable by admin"`, `${prefix} INSERT authority`)
  requireText(`CREATE POLICY "${prefix} updatable by admin"`, `${prefix} UPDATE authority`)
  requireText(`CREATE POLICY "${prefix} deletable by admin"`, `${prefix} DELETE authority`)
}

requireText('DROP POLICY IF EXISTS "Reactions manageable by self" ON public.reactions;', 'reaction ALL-policy removal')
requireText('CREATE POLICY "Reactions insertable by self"', 'reaction INSERT authority')
requireText('CREATE POLICY "Reactions updatable by self"', 'reaction UPDATE authority')
requireText('CREATE POLICY "Reactions deletable by self"', 'reaction DELETE authority')

for (const policy of [
  'Users can update their own profile',
  'Roles viewable by admin',
  'ar_users_can_read_own_raw_inputs',
  'ar_users_can_read_own_pain_evidences',
  'ar_users_can_read_own_problem_candidates',
  'ar_users_can_read_own_problem_evidence_links',
  'Rankings select policy',
  'Ranking entries select policy',
  'Operators can view moderation reviews',
]) {
  requireText(`ALTER POLICY "${policy}"`, `${policy} initplan rewrite`)
}

requireText('(SELECT auth.uid())', 'initplan-safe auth.uid()')
requireText('(SELECT auth.role())', 'initplan-safe auth.role()')
requireText('idx_ranking_criteria_ranking_id', 'ranking_criteria FK index')
requireText('ON public.ranking_criteria (ranking_id);', 'ranking_criteria index target')
requireText('idx_ranking_sources_ranking_id', 'ranking_sources FK index')
requireText('ON public.ranking_sources (ranking_id);', 'ranking_sources index target')

forbid(/\bDROP\s+INDEX\b/i, 'index deletion in AUDIT-R4')
forbid(/\bCREATE\s+INDEX\b(?![\s\S]*idx_ranking_criteria_ranking_id|[\s\S]*idx_ranking_sources_ranking_id)/i, 'unbounded index creation')

const createdIndexes = [...migration.matchAll(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_]+)/gi)].map((match) => match[1])
const expectedIndexes = new Set(['idx_ranking_criteria_ranking_id', 'idx_ranking_sources_ranking_id'])
if (createdIndexes.length !== 2 || createdIndexes.some((name) => !expectedIndexes.has(name))) {
  failures.push(`unexpected index set: ${createdIndexes.join(', ')}`)
}

if (failures.length > 0) {
  console.error('AUDIT-R4 contract verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('AUDIT-R4 contracts verified')
