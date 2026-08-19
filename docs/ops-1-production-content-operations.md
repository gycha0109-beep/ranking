# OPS-1 Production Content Operations / Editorial Quality

Status: **IMPLEMENTED ON BRANCH / HOSTED MIGRATED / PR VALIDATION PENDING**

## Objective

OPS-1 turns pre-launch content quality from an operator convention into an enforceable publication contract.

The stage does not fabricate new rankings merely to increase inventory. Draft capture stays permissive, while public publication becomes fail-closed and auditable from the operator surface.

## Operating model

1. Capture and quick-create may create incomplete drafts.
2. Editorial work happens while the ranking is `draft`.
3. Preview reads the authoritative editorial readiness result.
4. Moderation and editorial readiness must both pass before publish.
5. The database re-checks readiness on publication and rejects bypasses.
6. A published ranking must be unpublished before its editorial fields are changed.
7. Child criteria/source/entry mutations on a published ranking are re-checked at transaction boundary.

This preserves capture speed without allowing draft-quality content to leak into public discovery.

## Publication quality contract

The authoritative DB readiness function checks:

- non-empty title, category and summary;
- complete `scope_json.target`, `scope_json.period`, and `scope_json.method`;
- at least two ranking entries;
- unique items;
- unique contiguous positions from `1..N`;
- a non-empty public reason for every entry;
- every ranked item is `active`;
- at least one criterion;
- every criterion has both name and description;
- non-`user_vote` rankings have at least one usable public source;
- every public source has a label and direct `http(s)` URL;
- Google/Bing/Naver/Daum search result pages and YouTube result pages are not accepted as evidence URLs;
- when a title explicitly promises `TOP N` or `탑 N`, the actual entry count equals `N`.

Moderation remains a separate gate. Sponsorship disclosure remains a separate P2-3 gate. Passing OPS-1 does not bypass either contract.

## Database authority

Migrations:

- `20260819010000_ops_1_editorial_quality.sql`
- `20260819010100_ops_1_trigger_return_fix.sql`

Authority surfaces:

- `private.ops_1_is_usable_source_url`
- `private.ops_1_ranking_editorial_readiness`
- `private.ops_1_assert_ranking_editorial_ready`
- `public.admin_get_ranking_editorial_readiness`
- `trg_ops_1_ranking_publish_quality`
- `trg_ops_1_block_published_editorial_edit`
- deferred child-quality triggers for entries, criteria and sources

The admin readiness RPC is authenticated/admin-only. Public readers do not receive internal readiness diagnostics.

## Known pre-launch content reconciliation

Hosted authority was inspected before migration.

### `best-chicken-breast`

Prestate:

- title: `2026 닭가슴살 TOP 10`
- status: `published`
- entries: `2`
- criteria: `2`
- public source rows: `1`
- source URL: Google search-results URL

The migration fails closed unless that exact bounded prestate is still present. It then returns the ranking to `draft` instead of inventing eight entries or fabricating stronger evidence.

Post-migration readiness blockers are:

- `missing_usable_public_source`
- `invalid_public_source`
- `title_entry_count_mismatch`

### `간편-작성-테스트`

Prestate:

- status: `draft`
- entries: `4`
- generated active items: `테스트`, `중입니다`, `어떻게`, `나올까요?`

The migration verifies that those generated items are not referenced by another ranking, archives the test draft, and archives the four generated test items. It preserves the records rather than deleting them.

## Hosted dynamic validation

After migration:

- attempting to republish the noncompliant `best-chicken-breast` ranking fails with SQLSTATE `23514` and enumerates the three readiness blockers;
- a transient complete `TOP 2` fixture with complete scope, criterion, direct source, two active items and two reasons successfully transitions to `published`;
- the transient valid fixture is rolled back in the same validation transaction;
- four known quick-create test items remain preserved but `archived`.

## Admin experience

`/admin/rankings` now exposes:

- published / draft / archived state;
- `발행 품질 준비됨` or blocker count;
- entry count;
- criterion count;
- usable public source count;
- explicit `TOP N` title promise when present;
- the first blocker messages for triage.

The ranking preview control center loads the authoritative readiness result and disables publication until both editorial and moderation gates pass.

## Non-goals

OPS-1 does not:

- scrape or import external data;
- create synthetic evidence;
- automatically rewrite weak editorial content;
- decide ranking truth from an LLM;
- replace moderation;
- alter ranking/search/vote scoring;
- change P2-3 sponsorship semantics.

## Next evidence required

Before OPS-1 can be closed:

1. exact-head PR CI must pass all legacy verifiers, `verify:ops-1`, lint and production build;
2. PR must merge without tree drift;
3. merged main must deploy READY on Vercel;
4. Production public/admin auth-boundary smoke and runtime error readback must pass;
5. Hosted poststate must remain reconciled with no unintended persistent transient test data.
