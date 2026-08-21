import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const migration = 'supabase/migrations/20260819010000_ops_1_editorial_quality.sql'
const triggerFix = 'supabase/migrations/20260819010100_ops_1_trigger_return_fix.sql'
const topCountBoundary = 'supabase/migrations/20260822071500_content_5_top_count_brand_boundary.sql'
const checks = []

function requireText(path, text, label = `${path}: ${text}`) {
  const content = read(path)
  if (!content.includes(text)) throw new Error(`OPS-1 contract failed: ${label}`)
  checks.push(label)
}

function forbidText(path, text, label = `${path}: ${text}`) {
  const content = read(path)
  if (content.includes(text)) throw new Error(`OPS-1 contract failed: ${label}`)
  checks.push(label)
}

requireText(migration, 'private.ops_1_ranking_editorial_readiness', 'database editorial readiness authority exists')
requireText(migration, 'public.admin_get_ranking_editorial_readiness', 'admin readiness RPC exists')
requireText(migration, "'incomplete_scope'", 'scope target/period/method is publication-gated')
requireText(migration, "'insufficient_entries'", 'publication requires at least two entries')
requireText(migration, "'non_contiguous_positions'", 'positions must be contiguous')
requireText(migration, "'duplicate_items'", 'duplicate ranking items are blocked')
requireText(migration, "'missing_entry_reason'", 'every entry requires a public reason')
requireText(migration, "'inactive_entry_item'", 'published rankings require active items')
requireText(migration, "'incomplete_criteria'", 'criteria require descriptions')
requireText(migration, "'missing_usable_public_source'", 'non-vote rankings require usable public evidence')
requireText(migration, "'invalid_public_source'", 'search result pages are rejected as evidence')
requireText(migration, "'title_entry_count_mismatch'", 'TOP N title promise must match actual entries')
requireText(migration, 'trg_ops_1_ranking_publish_quality', 'ranking publication has a database quality trigger')
requireText(migration, 'trg_ops_1_block_published_editorial_edit', 'published editorial edits require unpublish first')
requireText(migration, 'deferrable initially deferred', 'child mutations are checked at transaction boundary')
requireText(migration, "r.slug = 'best-chicken-breast'", 'known noncompliant published seed is reconciled explicitly')
requireText(migration, "r.slug = '간편-작성-테스트'", 'known quick-create test draft is reconciled explicitly')
requireText(migration, "i.title in ('테스트', '중입니다', '어떻게', '나올까요?')", 'known generated test items are archived explicitly')
requireText(triggerFix, "if tg_op = 'DELETE' then", 'child trigger return path handles deletes explicitly')
requireText(topCountBoundary, 'private.ops_1_ranking_editorial_readiness', 'TOP-count brand boundary preserves the same readiness authority')
requireText(topCountBoundary, "(?i)(TOP|탑)[[:space:]]+([0-9]{1,3})", 'TOP-count promise requires explicit whitespace before the count')
forbidText(topCountBoundary, "(?i)(TOP|탑)[[:space:]]*([0-9]{1,3})", 'TOP-count boundary must not reinterpret branded tokens such as TOP500')
requireText(topCountBoundary, "'title_entry_count_mismatch'", 'TOP-count boundary preserves title/entry mismatch enforcement')
requireText(topCountBoundary, "'missing_usable_public_source'", 'TOP-count boundary preserves source readiness enforcement')
requireText(topCountBoundary, "'non_contiguous_positions'", 'TOP-count boundary preserves position readiness enforcement')
requireText('src/lib/actions/editorial-quality.ts', 'publishRankingWithEditorialGate', 'publish action checks editorial readiness before legacy publish action')
requireText('src/lib/actions/editorial-quality.ts', "admin_get_ranking_editorial_readiness", 'UI reads database readiness authority')
requireText('src/app/admin/rankings/[id]/preview/PreviewControlPanel.tsx', 'OPS-1 Editorial Quality', 'preview exposes editorial readiness')
requireText('src/app/admin/rankings/[id]/preview/PreviewControlPanel.tsx', 'publishRankingWithEditorialGate', 'preview uses the guarded publication action')
requireText('src/app/admin/rankings/page.tsx', '발행 품질 준비됨', 'ranking operations list surfaces ready state')
requireText('src/app/admin/rankings/page.tsx', '품질 보완', 'ranking operations list surfaces blocker state')
requireText('src/app/admin/rankings/page.tsx', '발행 취소 → draft 편집 → readiness 재검사 → 재발행', 'operator workflow requires draft-before-edit')
requireText('package.json', '"verify:ops-1": "node scripts/verify-ops-1-contracts.mjs"', 'package exposes OPS-1 verifier')
requireText('.github/workflows/ci.yml', 'npm run verify:ops-1', 'CI runs OPS-1 verifier')

console.log(`OPS-1 contract verification passed (${checks.length} checks).`)
