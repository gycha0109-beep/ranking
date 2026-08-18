import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const coreMigration = 'supabase/migrations/20260818062000_p2_3_sponsor_transparency.sql'
const auditMigration = 'supabase/migrations/20260818062100_p2_3_sponsor_audit_integration.sql'
const indexMigration = 'supabase/migrations/20260818062200_p2_3_sponsor_fk_indexes.sql'
const checks = []

function requireText(path, text, label = `${path}: ${text}`) {
  const content = read(path)
  if (!content.includes(text)) throw new Error(`P2-3 contract failed: ${label}`)
  checks.push(label)
}

function forbidText(path, text, label = `${path}: must not contain ${text}`) {
  const content = read(path)
  if (content.includes(text)) throw new Error(`P2-3 contract failed: ${label}`)
  checks.push(label)
}

requireText(coreMigration, 'CREATE TABLE public.sponsors', 'normalized sponsor table exists')
requireText(coreMigration, 'CREATE TABLE public.sponsorships', 'normalized sponsorship table exists')
requireText(coreMigration, 'CREATE TABLE public.sponsorship_events', 'append-only sponsorship event table exists')
requireText(coreMigration, "target_type IN ('ranking', 'item', 'placement')", 'target types are bounded')
requireText(coreMigration, 'CONSTRAINT sponsorships_target_shape CHECK', 'target shape is constrained')
requireText(coreMigration, 'CONSTRAINT sponsorships_period CHECK', 'sponsorship period is constrained')
requireText(coreMigration, 'trg_sponsorship_events_immutable', 'sponsorship audit rows are immutable')
requireText(coreMigration, 'REVOKE ALL ON TABLE public.sponsors FROM PUBLIC, anon, authenticated', 'raw sponsor table is closed')
requireText(coreMigration, 'REVOKE ALL ON TABLE public.sponsorships FROM PUBLIC, anon, authenticated', 'raw sponsorship table is closed')
requireText(coreMigration, 'REVOKE ALL ON TABLE public.sponsorship_events FROM PUBLIC, anon, authenticated', 'raw sponsorship events are closed')
requireText(coreMigration, "'sponsorship_manage'", 'dedicated sponsorship capability exists')
requireText(coreMigration, 'CREATE OR REPLACE FUNCTION public.get_public_ranking_sponsorship_disclosures', 'public ranking disclosure RPC exists')
requireText(coreMigration, 'CREATE OR REPLACE FUNCTION public.get_public_item_sponsorship_disclosures', 'public item disclosure RPC exists')
requireText(coreMigration, 'trg_rankings_require_sponsorship_disclosure', 'sponsored ranking publication is disclosure-gated')
requireText(coreMigration, 'trg_ranking_entries_reject_legacy_sponsor_flag', 'legacy sponsor flag cannot be re-authored')
requireText(coreMigration, "sp.target_type = 'placement' AND sp.ranking_id = p_ranking_id AND sp.status = 'published'", 'ranking save protects disclosed placements')
requireText(coreMigration, "COALESCE(e.score_json, '{}'::JSONB), NULLIF(e.internal_note, ''), FALSE", 'ranking save materializes legacy sponsor flag false')
requireText(coreMigration, "r.slug = 'best-chicken-breast' AND i.slug = 'hankki-grill-sous-vide'", 'legacy reconciliation is bound to approved test row')
requireText(coreMigration, 'IF v_flag_count <> 1 OR v_target_count <> 1 THEN', 'legacy reconciliation fails closed on prestate drift')
requireText(coreMigration, 'legacy_reconcile', 'legacy reconciliation is audited')
requireText(coreMigration, 'IF EXISTS (SELECT 1 FROM public.ranking_entries WHERE sponsor_flag IS TRUE)', 'activation requires zero unresolved legacy flags')

const coreSql = read(coreMigration)
const publicRankingStart = coreSql.indexOf('CREATE OR REPLACE FUNCTION public.get_public_ranking_sponsorship_disclosures')
const publicItemEnd = coreSql.indexOf('CREATE OR REPLACE FUNCTION private.enforce_sponsored_ranking_disclosure')
const publicProjection = coreSql.slice(publicRankingStart, publicItemEnd)
for (const forbidden of ['internal_note', 'actor_id', 'created_by', 'updated_by']) {
  if (publicProjection.includes(forbidden)) throw new Error(`P2-3 contract failed: public disclosure projection leaks ${forbidden}`)
}
checks.push('public disclosure projection excludes internal and actor metadata')

requireText(auditMigration, 'sponsorship_change', 'sponsorship changes join the integrated audit stream')
requireText(auditMigration, 'list_admin_audit_event_stream_pre_p2_3', 'previous audit stream remains delegated authority')
requireText(auditMigration, 'COALESCE(cardinality(v_event_kinds), 0) > 7', 'audit filter bound includes seventh event kind')
requireText(auditMigration, "v_kind <> 'sponsorship_change'", 'audit detail delegates non-sponsorship evidence')
requireText(auditMigration, "event.before_data - 'internal_note' - 'created_by' - 'updated_by'", 'general audit evidence strips sensitive sponsorship fields')

for (const indexName of [
  'idx_sponsors_created_by',
  'idx_sponsors_updated_by',
  'idx_sponsorships_created_by',
  'idx_sponsorships_updated_by',
]) {
  requireText(indexMigration, indexName, `actor foreign-key index exists: ${indexName}`)
}

requireText('src/lib/actions/sponsorship-admin.ts', "runAdminRpc('sponsorship_manage'", 'sponsorship mutations use capability-gated RPCs')
requireText('src/lib/actions/sponsorship-admin.ts', 'subjectType: adminSubjectType(rpcName)', 'sponsor telemetry subject is classified explicitly')
requireText('src/app/admin/page.tsx', "href: '/admin/sponsors'", 'sponsor management is exposed in admin console')
requireText('src/app/admin/page.tsx', "href: '/admin/sponsorships'", 'sponsorship management is exposed in admin console')
requireText('src/app/admin/rankings/[id]/edit/RankingEditorForm.tsx', 'ranking_type', 'ranking editor remains separate from sponsorship truth')
requireText('src/app/rankings/[rankingSlug]/page.tsx', 'SponsorshipDisclosure', 'ranking page renders normalized disclosures')
forbidText('src/app/rankings/[rankingSlug]/page.tsx', 'entry.sponsor_flag', 'public ranking page no longer trusts legacy sponsor flag')
requireText('src/app/items/[itemSlug]/page.tsx', 'SponsorshipDisclosure', 'item page renders normalized disclosures')
requireText('src/lib/admin-audit.ts', "'sponsorship_change'", 'client audit type includes sponsorship changes')
requireText('src/lib/actions/admin-access.ts', "eventKind === 'moderation_review' || eventKind === 'sponsorship_change'", 'UUID sponsorship audit detail validation exists')
requireText('src/app/admin/audit/page.tsx', "sponsorship_change: '협찬 관계 변경'", 'audit list labels sponsorship changes')
requireText('src/app/admin/audit/[eventKind]/[eventId]/page.tsx', "sponsorship_change: '협찬 관계 변경'", 'audit detail labels sponsorship changes')
requireText('package.json', '"verify:p2-3": "node scripts/verify-p2-3-contracts.mjs"', 'package exposes P2-3 verifier')
requireText('.github/workflows/ci.yml', 'npm run verify:p2-3', 'CI runs P2-3 verifier')

console.log(`P2-3 contract verification passed (${checks.length} checks).`)
