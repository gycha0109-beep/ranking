import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = path => fs.readFileSync(path, 'utf8')
const helper = read('src/lib/reviewed-equivalence-evidence.ts')
const action = read('src/lib/actions/reviewed-equivalence-evidence.ts')
const page = read('src/app/admin/measure/equivalence/page.tsx')
const docs = read('docs/ia-2l-reviewed-equivalence-evidence-accumulation.md')
const migration = read('supabase/migrations/20260821041000_ia_2d_semantic_governance_evidence.sql')
const semanticAction = read('src/lib/actions/ranking-semantic.ts')
const adminEditPage = read('src/app/admin/rankings/[id]/edit/page.tsx')
const evidenceDomain = read('src/lib/semantic-governance-evidence.ts')
const packageJson = JSON.parse(read('package.json'))
const ci = read('.github/workflows/ci.yml')

assert.ok(helper.includes("CANDIDATE_AVAILABLE_AT_FINAL_SAVE_NOT_CONFIRMED_UI_EXPOSURE"), 'IA-2L interpretation ceiling missing')
assert.ok(helper.includes("'POSITIVE_REUSE'"), 'positive reuse label missing')
assert.ok(helper.includes("'NEGATIVE_NEW_SUBJECT'"), 'negative new-Subject label missing')
assert.ok(helper.includes("'UNLABELED_CANDIDATE'"), 'unlabeled candidate state missing')

const transpiled = ts.transpileModule(helper, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)

const fixture = [
  {
    event_type: 'subject_decision_saved',
    resolution_kind: 'suggestion',
    suggestion_keys: ['subject-a', 'subject-b'],
    selected_subject_key: 'subject-a',
    selected_rank: 1,
  },
  {
    event_type: 'subject_decision_saved',
    resolution_kind: 'new',
    suggestion_keys: ['subject-a'],
  },
  {
    event_type: 'subject_decision_saved',
    resolution_kind: 'existing',
    suggestion_keys: ['subject-b'],
  },
  {
    event_type: 'subject_decision_saved',
    resolution_kind: 'new',
    suggestion_keys: [],
  },
  {
    event_type: 'subject_alias_created',
    input_subject_key: 'alias-a',
    canonical_subject_key: 'subject-a',
    suggestion_keys: [],
  },
]

const summary = module.summarizeReviewedEquivalenceEvidence(fixture)
assert.equal(summary.subject_decisions, 4)
assert.equal(summary.candidate_available_decisions, 3)
assert.equal(summary.candidate_reuse_positive_decisions, 1)
assert.equal(summary.candidate_new_negative_decisions, 1)
assert.equal(summary.candidate_unlabeled_decisions, 1)
assert.equal(summary.new_without_candidate_decisions, 1)
assert.equal(summary.alias_equivalence_assertions, 1)
assert.equal(summary.candidate_decision_labels, 2)
assert.equal(summary.candidate_label_coverage_rate, 0.6667)
assert.equal(summary.candidate_reuse_acceptance_rate, 0.5)
assert.equal(module.classifyReviewedEquivalenceDecision(fixture[0]), 'POSITIVE_REUSE')
assert.equal(module.classifyReviewedEquivalenceDecision(fixture[1]), 'NEGATIVE_NEW_SUBJECT')
assert.equal(module.classifyReviewedEquivalenceDecision(fixture[2]), 'UNLABELED_CANDIDATE')
assert.equal(module.classifyReviewedEquivalenceDecision(fixture[3]), 'NOT_CANDIDATE_DECISION')

assert.ok(action.includes("requireAdminCapability('audit_view'"), 'IA-2L readback must use audit_view')
assert.ok(action.includes(".from('ranking_semantic_governance_events')"), 'IA-2D governance stream must remain IA-2L authority')
assert.ok(action.includes(".from('ranking_semantic_subject_aliases')"), 'reviewed Alias readback missing')
assert.ok(action.includes('EVENT_READ_LIMIT = 5000'), 'bounded event read missing')
assert.ok(action.includes('ALIAS_READ_LIMIT = 1000'), 'bounded Alias read missing')
assert.ok(action.includes('RECENT_DECISION_LIMIT = 20'), 'bounded operator detail missing')
assert.ok(action.includes('product_usage_events_reused: false'), 'MEASURE-1 telemetry separation missing')
assert.ok(action.includes("mutation_authority: 'NONE_READ_ONLY_READBACK'"), 'read-only authority declaration missing')
assert.ok(!action.includes(".from('product_usage_events')"), 'IA-2L must not read MEASURE-1 product telemetry')
assert.ok(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(action), 'IA-2L readback action must not mutate data')
assert.ok(!action.includes('actor_user_id'), 'IA-2L operator readback must not expose actor identity')

assert.ok(page.includes('Reviewed Equivalence Evidence'), 'IA-2L admin page missing')
assert.ok(page.includes('Candidate available at final save'), 'candidate availability language missing')
assert.ok(page.includes('실제 UI 노출을 확인한 로그로 해석하지 않습니다'), 'UI exposure ceiling missing from operator page')
assert.ok(page.includes('POSITIVE_REUSE'), 'positive label display missing')
assert.ok(page.includes('NEGATIVE_NEW_SUBJECT'), 'negative label display missing')
assert.ok(page.includes('/admin/rankings/${row.ranking_id}/edit'), 'candidate decision drill-down missing')

assert.ok(docs.includes('0 rows'), 'Hosted zero-row baseline missing')
assert.ok(docs.includes('reviewed Alias rows: **0**'), 'Hosted zero Alias baseline missing')
assert.ok(docs.includes('CANDIDATE_AVAILABLE_AT_FINAL_SAVE_NOT_CONFIRMED_UI_EXPOSURE'), 'documentation interpretation ceiling missing')
assert.ok(docs.includes('No new evidence table, event type, database migration'), 'no-schema-expansion contract missing')
assert.ok(docs.includes('IA_2H_CONTEXT_FALLBACK_QUARANTINED = true'), 'IA-2J quarantine requirement missing')
assert.ok(docs.includes("projection_version = 'ia-2b-admin-manual-v1'"), 'IA-2B provenance requirement missing')
assert.ok(docs.includes('does not authorize a new automatic matcher'), 'automatic matcher authority ceiling missing')

assert.ok(migration.includes('GRANT SELECT, INSERT ON TABLE public.ranking_semantic_governance_events TO service_role'), 'append-only service-role evidence privileges changed')
assert.ok(!migration.includes('GRANT UPDATE'), 'governance evidence must remain non-updatable')
assert.ok(!migration.includes('GRANT DELETE'), 'governance evidence must remain non-deletable')
assert.ok(migration.includes('REVOKE ALL PRIVILEGES ON TABLE public.ranking_semantic_governance_events FROM anon, authenticated'), 'public governance evidence privileges must stay revoked')
assert.ok(semanticAction.includes("projection_version: 'ia-2b-admin-manual-v1'"), 'reviewed projection provenance changed')
assert.ok(!semanticAction.includes("status: 'published'"), 'semantic governance must not mutate publication status')
assert.ok(adminEditPage.includes('const IA_2H_CONTEXT_FALLBACK_QUARANTINED = true'), 'IA-2H fallback quarantine must remain active')

assert.ok(evidenceDomain.includes('subject_decisions: 50'), 'existing IA-2D decision threshold changed')
assert.ok(evidenceDomain.includes('suggestion_exposures: 30'), 'existing IA-2D candidate threshold changed')
assert.ok(evidenceDomain.includes('new_subject_decisions: 10'), 'existing IA-2D new-Subject threshold changed')

assert.equal(packageJson.scripts?.['verify:ia-2l'], 'node scripts/verify-ia-2l-reviewed-equivalence-evidence.mjs', 'package verify:ia-2l wiring missing')
assert.ok(ci.includes('npm run verify:ia-2l'), 'CI verify:ia-2l wiring missing')

console.log('IA-2L reviewed equivalence evidence contracts: PASS')
console.log('authority=ranking_semantic_governance_events')
console.log('product_usage_events_reused=false')
console.log('interpretation=CANDIDATE_AVAILABLE_AT_FINAL_SAVE_NOT_CONFIRMED_UI_EXPOSURE')
console.log('hosted_starting_governance_rows=0')
console.log('hosted_starting_alias_rows=0')
console.log('automatic_matcher_authorized=NO')
