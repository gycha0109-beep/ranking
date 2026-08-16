# LAUNCH P0 Production QA Follow-up

## Scope

This follow-up covers three defects found during manual authenticated production QA after PR #26:

1. comments were created successfully but the comment section also showed `댓글 신고 상태를 불러오지 못했습니다.`
2. daily unique-view counters never persisted a view event
3. `/me/bookmarks` listed saved content but offered no direct removal action

The login localization and ordinary like/bookmark mutations from PR #26 were confirmed working and are not redesigned here.

## 1. Comment report-state contract drift

### Production evidence

The application calls:

- `public.get_my_reported_comment_ids(uuid[])`
- `public.report_content_comment(uuid, uuid, uuid, text, text)`

Hosted Postgres no longer exposed either compatibility RPC. Its canonical current functions were:

- `public.get_my_comment_report_states(uuid[])`
- `public.create_comment_report(uuid, text, text)`

The repository migration history and the Hosted migration record had diverged under the same P1-2.5 stage names.

### Remediation

`20260817001000_launch_p0_comment_report_contract_reconciliation.sql` makes the current Hosted contract explicit in source control and adds narrow compatibility wrappers for the application call sites.

The compatibility report-write RPC verifies that the supplied ranking/item target still matches the comment before delegating to the canonical report function. All four functions remain `authenticated`-only; `anon` and `PUBLIC` execution remain revoked.

No comment/report data is rewritten.

## 2. Daily unique views

### Production evidence

Hosted aggregates showed:

- `content_daily_views`: 0 rows
- cumulative view total: 0

A transaction-rollback database probe under `service_role` reached `record_ranking_daily_view` successfully and returned an inserted result, proving the database write contract itself was healthy.

A temporary Vercel Preview diagnostic then isolated the server configuration boundary:

- existing admin client (`SUPABASE_SERVICE_ROLE_KEY` only): `missing-key`
- after accepting `SUPABASE_SECRET_KEY`: restricted service-role table read succeeded
- the service-role-only view RPC reached Postgres and returned the expected invalid-target `P0002` from a non-mutating probe

The temporary diagnostic endpoint was removed before final review.

### Root cause

Vercel contains the current Supabase `sb_secret_...` key under `SUPABASE_SECRET_KEY`, while the repository still consumed only the legacy variable name `SUPABASE_SERVICE_ROLE_KEY`.

The view writer also uses the legacy variable as its transitional HMAC-secret fallback, so it returned the controlled missing-configuration result before any write RPC could run.

### Remediation

`src/lib/supabase/admin.ts` now:

- prefers `SUPABASE_SECRET_KEY`
- retains `SUPABASE_SERVICE_ROLE_KEY` as a legacy fallback
- bridges the resolved server-only key into the legacy in-process variable for existing server consumers, including the view writer
- disables URL session detection on the privileged server client

`.env.example` documents both server-key names and the preferred dedicated `VIEWER_HASH_SECRET`.

Daily uniqueness semantics are unchanged: one viewer identity contributes at most one count per target per UTC day.

## 3. Bookmark-library removal

`/me/bookmarks` now renders an explicit `저장 해제` action outside the content link. The action reuses the existing authenticated bookmark-off RPC through `setContentBookmark`, then refreshes the library after success.

No bookmark database contract changes were required.

## Hosted change

The only persistent Hosted change in this follow-up is the repository-backed comment-report reconciliation migration. It creates/reconciles RPC definitions and grants; it does not mutate user content or report rows.

## Validation contract

Before merge:

- Hosted comment-report functions/signatures/grants match the migration
- current Secret-key Vercel Preview can create a privileged Supabase client and reach the view-write RPC boundary
- temporary diagnostic routes are absent from the final branch
- LAUNCH-1 verifier covers server-key compatibility, comment-report reconciliation, and bookmark removal
- lint and production build pass
- exact-head CI passes
- PR CI passes

Post-merge production QA should verify once:

1. comment create/reload no longer emits the report-state error
2. first eligible detail view creates/increments the daily unique-view aggregate; repeat views from the same identity on the same UTC day do not increment again
3. `/me/bookmarks` can remove a saved entry directly
