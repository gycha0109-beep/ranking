import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const migration = 'supabase/migrations/20260816010000_p2_1_user_voting.sql'
const indexMigration = 'supabase/migrations/20260816011000_p2_1_vote_fk_indexes.sql'
const checks = []

function requireText(path, text, label = `${path}: ${text}`) {
  const content = read(path)
  if (!content.includes(text)) throw new Error(`P2-1 contract failed: ${label}`)
  checks.push(label)
}

requireText(migration, 'CREATE TABLE IF NOT EXISTS public.ranking_vote_settings', 'vote settings table exists')
requireText(migration, 'CREATE TABLE IF NOT EXISTS public.ranking_votes', 'vote ballot table exists')
requireText(migration, 'PRIMARY KEY (ranking_id, user_id)', 'one ballot per user per ranking')
requireText(migration, 'REVOKE ALL ON TABLE public.ranking_votes FROM PUBLIC, anon, authenticated', 'raw ballots are closed')
requireText(migration, 'CREATE OR REPLACE FUNCTION public.get_ranking_vote_summary', 'bounded public aggregate RPC exists')
requireText(migration, 'GRANT EXECUTE ON FUNCTION public.get_ranking_vote_summary(UUID) TO anon, authenticated', 'aggregate is public readable')
requireText(migration, "PERFORM private.assert_user_capability(v_user_id, 'engagement_write')", 'vote mutations reuse engagement sanction capability')
requireText(migration, "IF COALESCE(v_state, 'closed') <> 'open'", 'writes require open voting state')
requireText(migration, "ROW_NUMBER() OVER (\n      ORDER BY COALESCE(counts.vote_count, 0) DESC, candidate.seed_position ASC, candidate.item_id ASC", 'deterministic vote ordering')
requireText(migration, "v_state NOT IN ('open', 'closed')", 'voting lifecycle is open/closed only')
requireText(migration, "private.has_admin_capability(v_user_id, 'content_manage')", 'admin voting state requires content_manage')
requireText(migration, 'trg_p2_1_freeze_voted_ranking', 'voted ranking freeze trigger exists')
requireText(migration, 'trg_p2_1_freeze_voted_entries', 'voted candidate freeze trigger exists')
requireText(migration, 'trg_p2_1_reconcile_item', 'candidate visibility changes reconcile open voting')
requireText(indexMigration, 'idx_ranking_votes_item', 'vote item FK has reverse index')
requireText(indexMigration, 'idx_ranking_votes_user', 'vote user FK has reverse index')
requireText(indexMigration, 'idx_ranking_vote_settings_updated_by', 'vote settings updater FK has reverse index')
requireText('src/components/voting/RankingVotingPanel.tsx', '사용자 투표 순위', 'public voting panel exists')
requireText('src/components/voting/RankingVotingPanel.tsx', '투표 취소', 'open vote cancellation exists')
requireText('src/components/voting/RankingVotingPanel.tsx', '관리자 투표 제어', 'admin open/close control exists')
requireText('src/lib/actions/voting.ts', "supabase.rpc('set_ranking_vote'", 'vote server action uses RPC')
requireText('src/lib/actions/voting.ts', "supabase.rpc('clear_ranking_vote'", 'clear server action uses RPC')
requireText('src/lib/actions/voting.ts', "supabase.rpc('set_ranking_voting_state'", 'admin state server action uses RPC')
requireText('src/app/rankings/[rankingSlug]/layout.tsx', 'RankingVotingPanel', 'ranking detail mounts voting panel')
requireText('src/lib/seo.ts', 'get_ranking_vote_summary', 'user_vote JSON-LD uses vote ordering')
requireText('.github/workflows/ci.yml', 'npm run verify:p2-1', 'CI runs P2-1 verifier')

if (read(migration).includes("'finalized'")) throw new Error('P2-1 contract failed: finalized lifecycle is deferred to P2-2')
checks.push('finalized lifecycle is deferred to P2-2')

console.log(`P2-1 contract verification passed (${checks.length} checks).`)
