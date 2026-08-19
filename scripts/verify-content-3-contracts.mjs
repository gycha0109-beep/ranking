import fs from 'node:fs'

const checks = []

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function expect(condition, message) {
  checks.push({ condition, message })
}

const migration = read('supabase/migrations/20260819030000_content_3_revalidation_cadence.sql')
const actions = read('src/lib/actions/content-revalidation.ts')
const page = read('src/app/admin/rankings/[id]/revalidation/page.tsx')
const adminList = read('src/app/admin/rankings/page.tsx')
const workflow = read('.github/workflows/ci.yml')
const pkg = JSON.parse(read('package.json'))

expect(migration.includes('CREATE TABLE public.ranking_revalidations'), 'CONTENT-3 must persist structured revalidation events')
expect(migration.includes("'verified_unchanged'") && migration.includes("'updated'") && migration.includes("'source_changed'") && migration.includes("'source_unavailable'"), 'revalidation outcomes must be constrained')
expect(migration.includes('trg_content_3_immutable_ranking_revalidations'), 'revalidation history must be append-only')
expect(migration.includes('admin_get_ranking_revalidation_status'), 'admin status RPC must exist')
expect(migration.includes('admin_record_ranking_revalidation'), 'admin record RPC must exist')
expect(migration.includes('admin_list_ranking_revalidations'), 'admin history RPC must exist')
expect(migration.includes("private.has_admin_capability(v_user_id, 'content_manage')"), 'CONTENT-3 admin RPCs must reuse content_manage authorization')
expect(migration.includes("'never_reviewed'") && migration.includes("'attention_required'") && migration.includes("'overdue'") && migration.includes("'due_soon'") && migration.includes("'current'"), 'freshness state contract must expose operational states')
expect(migration.includes("jsonb_build_object(\n        'id', rs.id"), 'revalidation events must snapshot current ranking sources')
expect(actions.includes("supabase.rpc('admin_get_ranking_revalidation_status'"), 'server actions must read CONTENT-3 status through RPC')
expect(actions.includes("supabase.rpc('admin_record_ranking_revalidation'"), 'server actions must record CONTENT-3 events through RPC')
expect(page.includes('재검증 결과 기록') && page.includes('재검증 이력'), 'admin revalidation page must expose recording and history UI')
expect(adminList.includes('getRankingRevalidationStatus'), 'ranking admin list must load freshness status')
expect(adminList.includes('/revalidation'), 'ranking admin list must link to revalidation workflow')
expect(pkg.scripts?.['verify:content-3'] === 'node scripts/verify-content-3-contracts.mjs', 'package.json must expose verify:content-3')
expect(workflow.includes('npm run verify:content-3'), 'CI must execute verify:content-3')

const failures = checks.filter((check) => !check.condition)
if (failures.length > 0) {
  console.error('CONTENT-3 contract verification failed:')
  for (const failure of failures) console.error(`- ${failure.message}`)
  process.exit(1)
}

console.log(`CONTENT-3 contract verification passed (${checks.length} checks).`)
