import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(path, 'utf8')

const adminDashboard = read('src/app/admin/page.tsx')
const rankingList = read('src/app/admin/rankings/page.tsx')
const rankingEdit = read('src/app/admin/rankings/[id]/edit/page.tsx')
const semanticAction = read('src/lib/actions/ranking-semantic.ts')
const equivalencePage = read('src/app/admin/measure/equivalence/page.tsx')
const equivalenceAction = read('src/lib/actions/reviewed-equivalence-evidence.ts')
const equivalenceDomain = read('src/lib/reviewed-equivalence-evidence.ts')
const docs = read('docs/ia-2m-organic-evidence-acquisition-readiness.md')
const packageJson = JSON.parse(read('package.json'))
const ci = read('.github/workflows/ci.yml')

assert.ok(adminDashboard.includes("href: '/admin/measure'"), 'operator console must expose Product & Semantic Evidence')
assert.ok(adminDashboard.includes("title: 'Product & Semantic Evidence'"), 'operator console product/semantic evidence label missing')
assert.ok(adminDashboard.includes("href: '/admin/measure/equivalence'"), 'operator console must expose IA-2L equivalence readback')
assert.ok(adminDashboard.includes("title: 'Reviewed Equivalence Evidence'"), 'IA-2L readback label missing')
assert.ok((adminDashboard.match(/capability: 'audit_view'/g) || []).length >= 3, 'evidence destinations must remain audit_view gated')

assert.ok(rankingList.includes('href={`/admin/rankings/${ranking.id}/edit`}'), 'ranking list must still reach ranking edit surface')
assert.ok(rankingEdit.includes('<SemanticProjectionPanel initialWorkspace={semanticWorkspace} />'), 'ranking edit surface must mount SemanticProjectionPanel')
assert.ok(rankingEdit.includes('const IA_2H_CONTEXT_FALLBACK_QUARANTINED = true'), 'IA-2H context fallback quarantine must remain active')

assert.ok(semanticAction.includes("event_type: 'subject_decision_saved'"), 'finalized semantic save must still record governance evidence')
assert.ok(semanticAction.includes(".from('ranking_semantic_governance_events').insert(payload)"), 'organic evidence writer must remain IA-2D governance stream')
assert.ok(semanticAction.includes("projection_version: 'ia-2b-admin-manual-v1'"), 'IA-2B reviewed-ingestion provenance changed')
assert.ok(!semanticAction.includes("status: 'published'"), 'semantic governance must not publish rankings')

assert.ok(equivalencePage.includes('Reviewed Equivalence Evidence'), 'IA-2L operator readback route missing')
assert.ok(equivalenceAction.includes("requireAdminCapability('audit_view'"), 'IA-2L readback must remain audit_view protected')
assert.ok(equivalenceAction.includes("mutation_authority: 'NONE_READ_ONLY_READBACK'"), 'IA-2L readback authority must remain read-only')
assert.ok(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(equivalenceAction), 'IA-2L readback must not mutate data')
assert.ok(!equivalenceAction.includes('actor_user_id'), 'IA-2L readback must not expose actor identity')
assert.ok(equivalenceDomain.includes('CANDIDATE_AVAILABLE_AT_FINAL_SAVE_NOT_CONFIRMED_UI_EXPOSURE'), 'IA-2L evidence interpretation ceiling changed')

assert.ok(docs.includes('governance_events = 0'), 'Hosted zero-event starting baseline missing')
assert.ok(docs.includes('reviewed_aliases = 0'), 'Hosted zero-Alias starting baseline missing')
assert.ok(docs.includes('navigation gap, not an evidence-storage or semantic-save gap'), 'IA-2M diagnosed gap not frozen')
assert.ok(docs.includes('No synthetic rows are inserted'), 'organic evidence non-fabrication contract missing')
assert.ok(docs.includes('No database migration'), 'IA-2M no-schema-change contract missing')
assert.ok(docs.includes('INSUFFICIENT_OPERATIONAL_EVIDENCE'), 'IA-2M readiness ceiling missing')

assert.equal(packageJson.scripts?.['verify:ia-2m'], 'node scripts/verify-ia-2m-organic-evidence-readiness.mjs', 'package verify:ia-2m wiring missing')
assert.ok(ci.includes('npm run verify:ia-2m'), 'CI verify:ia-2m wiring missing')

console.log('IA-2M organic evidence acquisition readiness contracts: PASS')
console.log('evidence_capture_path=OPERATIONALLY_REACHABLE')
console.log('readback_navigation_gap=CLOSED')
console.log('organic_evidence_fabricated=NO')
console.log('automatic_matcher_authorized=NO')
