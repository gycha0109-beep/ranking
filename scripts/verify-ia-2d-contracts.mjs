import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = path => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20260821041000_ia_2d_semantic_governance_evidence.sql')
const semanticActions = read('src/lib/actions/ranking-semantic.ts')
const evidenceActions = read('src/lib/actions/semantic-governance-evidence.ts')
const evidenceDomain = read('src/lib/semantic-governance-evidence.ts')
const semanticPanel = read('src/app/admin/rankings/[id]/edit/SemanticProjectionPanel.tsx')
const measurePage = read('src/app/admin/measure/page.tsx')
const measureMigration = read('supabase/migrations/20260819043000_measure_1_product_usage_discovery.sql')

assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS public.ranking_semantic_governance_events'), 'IA-2D evidence table missing')
assert.ok(migration.includes("'subject_decision_saved'"), 'finalized Subject decision event missing')
assert.ok(migration.includes("'subject_alias_created'"), 'alias-created governance event missing')
assert.ok(migration.includes("'subject_alias_deleted'"), 'alias-deleted governance event missing')
assert.ok(migration.includes("'projection_cleared'"), 'projection-cleared governance event missing')
assert.ok(migration.includes("resolution_kind IN ('new', 'existing', 'alias', 'suggestion')"), 'bounded resolution-kind contract missing')
assert.ok(migration.includes('cardinality(suggestion_keys) BETWEEN 0 AND 5'), 'suggestion evidence must stay bounded to Top 5')
assert.ok(!migration.includes(' jsonb'), 'IA-2D event stream must not introduce arbitrary JSON payloads')
assert.ok(migration.includes('ENABLE ROW LEVEL SECURITY'), 'IA-2D evidence table must enable RLS')
assert.ok(migration.includes('REVOKE ALL PRIVILEGES ON TABLE public.ranking_semantic_governance_events FROM anon, authenticated'), 'anon/auth table access must stay revoked')
assert.ok(migration.includes('GRANT SELECT, INSERT ON TABLE public.ranking_semantic_governance_events TO service_role'), 'service role must be limited to evidence read/append')
assert.ok(!migration.includes('GRANT UPDATE'), 'service role must not receive evidence UPDATE privilege')
assert.ok(!migration.includes('GRANT DELETE'), 'service role must not receive evidence DELETE privilege')
assert.ok(!migration.includes('ALTER TABLE public.product_usage_events'), 'IA-2D must not widen MEASURE-1 product telemetry')

assert.ok(measureMigration.includes("event_type IN ('content_view', 'search', 'search_result_click', 'content_discovery_click')"), 'MEASURE-1 bounded event enum must remain intact')
assert.ok(!measureMigration.includes('semantic_governance'), 'MEASURE-1 migration must remain separate from semantic governance evidence')

assert.ok(semanticActions.includes("event_type: 'subject_decision_saved'"), 'projection saves must record finalized decision evidence')
assert.ok(semanticActions.includes("event_type: 'subject_alias_created'"), 'alias creation evidence missing')
assert.ok(semanticActions.includes("event_type: 'subject_alias_deleted'"), 'alias deletion evidence missing')
assert.ok(semanticActions.includes("event_type: 'projection_cleared'"), 'projection-clear evidence missing')
assert.ok(semanticActions.includes('rankRankingSubjectSuggestions(rawSuggestionQuery, subjectCatalog.options)'), 'server must recompute deterministic suggestions at decision time')
assert.ok(semanticActions.includes('selectedSuggestionIndex >= 0 && requestedSuggestionKey === canonicalSubjectKey'), 'suggestion acceptance must be server-validated')
assert.ok(semanticActions.includes("projection_version: 'ia-2b-admin-manual-v1'"), 'IA-2D must not rewrite IA-2B reviewed-ingestion provenance')
assert.ok(semanticActions.includes('evidence_warning'), 'governance evidence failure must be visible without replacing the semantic mutation result')
assert.ok(!semanticActions.includes("status: 'published'"), 'IA-2D evidence must not publish or change Ranking status')

assert.ok(semanticPanel.includes('selectedSuggestion'), 'client must preserve explicit suggestion choice until finalized save')
assert.ok(semanticPanel.includes('suggestion_query: selectedSuggestion?.query || null'), 'selection query must be sent only as transient validation context')
assert.ok(semanticPanel.includes('selected_suggestion_key: selectedSuggestion?.key || null'), 'selected canonical key evidence missing')
assert.ok(semanticPanel.includes('setSelectedSuggestion(null)'), 'manual Subject edits/workspace sync must clear stale suggestion-selection evidence')

assert.ok(evidenceActions.includes("requireAdminCapability('audit_view'"), 'IA-2D operator readout must use existing audit_view capability')
assert.ok(evidenceActions.includes(".from('ranking_semantic_governance_events')"), 'IA-2D organic authority table missing from readout')
assert.ok(evidenceActions.includes('rankRankingSubjectSuggestions('), 'retrospective replay must reuse the actual IA-2C deterministic algorithm')
assert.ok(evidenceActions.includes("interpretation: 'CONTROLLED_REPLAY_CANDIDATES_NOT_SAME_CONCEPT_LABELS'"), 'retrospective evidence must not be mislabeled as semantic truth')
assert.ok(evidenceActions.includes('event_window_truncated'), 'bounded evidence reads must disclose truncation')
assert.ok(measurePage.includes('MEASURE-1 + IA-2D'), 'operator surface must expose both evidence authorities')
assert.ok(measurePage.includes('IA-2D organic authority'), 'operator surface must state the separate IA-2D authority')
assert.ok(measurePage.includes('SAME_CONCEPT 판정이 아닙니다'), 'controlled replay caveat missing')

const transpiled = ts.transpileModule(evidenceDomain, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText
const evidenceModule = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)

assert.equal(evidenceModule.semanticGovernanceReadiness({
  subject_decisions: 49,
  suggestion_exposures: 30,
  new_subject_decisions: 10,
}), 'INSUFFICIENT_OPERATIONAL_EVIDENCE')
assert.equal(evidenceModule.semanticGovernanceReadiness({
  subject_decisions: 50,
  suggestion_exposures: 29,
  new_subject_decisions: 10,
}), 'INSUFFICIENT_OPERATIONAL_EVIDENCE')
assert.equal(evidenceModule.semanticGovernanceReadiness({
  subject_decisions: 50,
  suggestion_exposures: 30,
  new_subject_decisions: 9,
}), 'INSUFFICIENT_OPERATIONAL_EVIDENCE')
assert.equal(evidenceModule.semanticGovernanceReadiness({
  subject_decisions: 50,
  suggestion_exposures: 30,
  new_subject_decisions: 10,
}), 'MINIMUM_ORGANIC_SAMPLE_REACHED')
assert.equal(evidenceModule.semanticGovernanceRate(0, 0), 0)
assert.equal(evidenceModule.semanticGovernanceRate(1, 4), 0.25)

console.log('IA-2D semantic governance evidence contracts verified.')
