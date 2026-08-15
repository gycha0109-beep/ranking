import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const migration = 'supabase/migrations/20260816020000_p2_2_ranking_history_vote_finalization.sql'
const moderationMigration = 'supabase/migrations/20260816021000_p2_2_public_history_moderation_filter.sql'
const checks = []

function requireText(path, text, label = `${path}: ${text}`) {
  const content = read(path)
  if (!content.includes(text)) throw new Error(`P2-2 contract failed: ${label}`)
  checks.push(label)
}

requireText(migration, 'CREATE TABLE IF NOT EXISTS public.ranking_revisions', 'immutable revision ledger exists')
requireText(migration, 'CREATE TABLE IF NOT EXISTS public.ranking_revision_entries', 'entry diff snapshots exist')
requireText(migration, "change_type IN ('vote_finalization', 'vote_void')", 'terminal vote revision types are bounded')
requireText(migration, 'UNIQUE (ranking_id, revision_number)', 'revision numbers are unique per ranking')
requireText(migration, 'uq_ranking_revisions_vote_round', 'one terminal revision exists per vote round')
requireText(migration, 'idx_ranking_revisions_actor', 'actor FK has reverse index')
requireText(migration, 'REVOKE ALL ON TABLE public.ranking_revisions FROM PUBLIC, anon, authenticated', 'raw revisions are closed')
requireText(migration, 'REVOKE ALL ON TABLE public.ranking_revision_entries FROM PUBLIC, anon, authenticated', 'raw revision entries are closed')
requireText(migration, 'trg_p2_2_immutable_ranking_revisions', 'revision rows are immutable')
requireText(migration, 'trg_p2_2_immutable_ranking_revision_entries', 'revision entry rows are immutable')
requireText(migration, 'CREATE OR REPLACE FUNCTION public.get_public_ranking_history', 'bounded public history RPC exists')
requireText(migration, "selected.change_type <> 'vote_finalization' THEN '[]'::JSONB", 'voided rounds do not expose candidate details')
requireText(migration, 'GRANT EXECUTE ON FUNCTION public.get_public_ranking_history(UUID, INTEGER) TO anon, authenticated', 'public history RPC grant exists')
requireText(migration, 'CREATE OR REPLACE FUNCTION public.finalize_ranking_vote', 'vote finalization RPC exists')
requireText(migration, "private.has_admin_capability(v_user_id, 'content_manage')", 'terminal vote operations require content_manage')
requireText(migration, "v_voting_state <> 'closed'", 'terminal operations require closed voting')
requireText(migration, 'v_safe_entry_count <> v_entry_count', 'finalization requires every candidate public-safe')
requireText(migration, "ORDER BY COALESCE(counts.vote_count, 0) DESC, re.position ASC, re.item_id ASC", 'finalization preserves P2-1 deterministic ordering')
requireText(migration, 'CREATE OR REPLACE FUNCTION public.void_ranking_vote_round', 'auditable vote void RPC exists')
requireText(migration, "'vote_void'", 'void terminal revision is persisted')

requireText(moderationMigration, 'JOIN public.items current_item', 'history snapshots re-check current item safety')
requireText(moderationMigration, "current_item.status = 'active'", 'hidden/archived items are excluded from public history')
requireText(moderationMigration, "current_item.moderation_status IN ('clean', 'suggestive')", 'blocked item text is excluded from public history')
requireText(moderationMigration, "current_entry.moderation_status IN ('clean', 'suggestive')", 'blocked current ranking entries are excluded from public history')
requireText(moderationMigration, "selected.change_type <> 'vote_finalization' THEN '[]'::JSONB", 'void history remains candidate-detail-free after remediation')

const sql = read(migration)
const finalizeStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.finalize_ranking_vote')
const finalizeEnd = sql.indexOf('CREATE OR REPLACE FUNCTION public.void_ranking_vote_round')
const finalizeSql = sql.slice(finalizeStart, finalizeEnd)
const snapshotAt = finalizeSql.indexOf('INSERT INTO public.ranking_revision_entries')
const deleteBallotsAt = finalizeSql.indexOf('DELETE FROM public.ranking_votes')
const offsetPositionsAt = finalizeSql.indexOf('SET position = position + v_offset')
const materializeAt = finalizeSql.indexOf('SET position = snapshot.after_position')
if (!(snapshotAt >= 0 && snapshotAt < deleteBallotsAt && deleteBallotsAt < offsetPositionsAt && offsetPositionsAt < materializeAt)) {
  throw new Error('P2-2 contract failed: finalization must snapshot before ballot consumption and use two-phase position materialization')
}
checks.push('finalization snapshots before ballot consumption and materializes positions collision-free')

requireText('src/lib/actions/ranking-history.ts', "supabase.rpc('finalize_ranking_vote'", 'finalization server action uses RPC')
requireText('src/lib/actions/ranking-history.ts', "supabase.rpc('void_ranking_vote_round'", 'void server action uses RPC')
requireText('src/lib/queries/ranking-history.ts', "supabase.rpc('get_public_ranking_history'", 'public history query uses bounded RPC')
requireText('src/components/ranking-history/RankingHistoryPanel.tsx', '공식 순위 변경 이력', 'public history panel exists')
requireText('src/components/voting/RankingVotingPanel.tsx', '투표 결과 확정', 'admin finalization control exists')
requireText('src/components/voting/RankingVotingPanel.tsx', '라운드 폐기', 'admin void control exists')
requireText('src/app/rankings/[rankingSlug]/layout.tsx', 'RankingHistoryPanel', 'ranking detail mounts public history')
requireText('.github/workflows/ci.yml', 'npm run verify:p2-2', 'CI runs P2-2 verifier')

console.log(`P2-2 contract verification passed (${checks.length} checks).`)
