import fs from 'node:fs'

const checks = []

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function expect(condition, message) {
  checks.push({ condition, message })
}

const migration = read('supabase/migrations/20260819020000_content_1_metric_ranking_type.sql')
const detail = read('src/app/rankings/[rankingSlug]/page.tsx')
const createPage = read('src/app/admin/rankings/new/page.tsx')
const editor = read('src/app/admin/rankings/[id]/edit/RankingEditorForm.tsx')
const workflow = read('.github/workflows/ci.yml')
const pkg = JSON.parse(read('package.json'))

expect(migration.includes("'metric'::text"), 'ranking_type DB contract must allow metric')
expect(migration.includes("'editor_pick'::text") && migration.includes("'user_vote'::text") && migration.includes("'sponsored'::text"), 'metric migration must preserve existing ranking types')
expect(detail.includes("metric: '공식 지표'"), 'public ranking detail must label metric as 공식 지표')
expect(detail.includes("ranking.ranking_type !== 'metric' && entry.editor_score"), 'metric ranking detail must not present editor_score as a star rating')
expect(createPage.includes("'metric'"), 'admin ranking creation type union must include metric')
expect(createPage.includes('<option value="metric">공식 지표 (metric)</option>'), 'admin ranking creation UI must expose metric')
expect(editor.includes('<option value="metric">공식 지표 (metric)</option>'), 'admin ranking editor must preserve and expose metric')
expect(pkg.scripts?.['verify:content-1'] === 'node scripts/verify-content-1-contracts.mjs', 'package.json must expose verify:content-1')
expect(workflow.includes('npm run verify:content-1'), 'CI must execute verify:content-1')

const failures = checks.filter((check) => !check.condition)
if (failures.length > 0) {
  console.error('CONTENT-1 contract verification failed:')
  for (const failure of failures) console.error(`- ${failure.message}`)
  process.exit(1)
}

console.log(`CONTENT-1 contract verification passed (${checks.length} checks).`)
