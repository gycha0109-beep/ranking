import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const migrationPath = 'supabase/migrations/20260821020500_ops_1_public_copy_hygiene.sql'
const migration = read(migrationPath)
const checks = []

function requireText(text, label) {
  if (!migration.includes(text)) throw new Error(`Public copy hygiene contract failed: ${label}`)
  checks.push(label)
}

requireText('private.ops_1_public_copy_hygiene_blockers', 'database hygiene blocker authority exists')
requireText("'internal_public_copy_marker'", 'internal marker has a stable blocker code')
requireText("'ranking.title'", 'ranking title is scanned')
requireText("'ranking.summary'", 'ranking summary is scanned')
requireText("'ranking.body'", 'ranking body is scanned')
requireText("'ranking.seo_title'", 'SEO title is scanned')
requireText("'ranking.seo_description'", 'SEO description is scanned')
requireText("'ranking.scope_json'", 'public scope is scanned')
requireText("'entry.reason'", 'entry reasons are scanned')
requireText("'entry.score_json'", 'public score payload is scanned')
requireText("'criteria.name'", 'criteria names are scanned')
requireText("'criteria.description'", 'criteria descriptions are scanned')
requireText("'source.label'", 'public source labels are scanned')
requireText("'source.note'", 'public source notes are scanned')
requireText('CONTENT-[0-9]+', 'CONTENT lifecycle markers are blocked')
requireText('OPS-[0-9]+', 'OPS lifecycle markers are blocked')
requireText('MEASURE-[0-9]+', 'MEASURE lifecycle markers are blocked')
requireText('UI-[0-9]+[A-Z]?', 'UI lifecycle markers are blocked')
requireText('private.ops_1_assert_ranking_editorial_ready', 'database publication assertion consumes hygiene blockers')
requireText('public.admin_get_ranking_editorial_readiness', 'admin readiness projection consumes hygiene blockers')
requireText("fifa-men-world-ranking-2026-07-top-5", 'known FIFA men leak is reconciled explicitly')
requireText("fifa-women-world-ranking-2026-06-top-5", 'known FIFA women leak is reconciled explicitly')
requireText("UNESCO — Italy", 'known UNESCO source-note leak is reconciled explicitly')
requireText('이후 공식 업데이트가 발표되면 최신 상태를 다시 확인합니다.', 'FIFA public copy uses reader-facing freshness language')
requireText("2026-08-19 확인: 62 properties.", 'UNESCO source note uses reader-facing verification language')

const packageJson = read('package.json')
const ci = read('.github/workflows/ci.yml')
if (!packageJson.includes('"verify:public-copy"')) throw new Error('Public copy hygiene contract failed: package verifier script missing')
if (!ci.includes('npm run verify:public-copy')) throw new Error('Public copy hygiene contract failed: CI verifier step missing')

console.log(`Public copy hygiene contract verification passed (${checks.length + 2} checks).`)
