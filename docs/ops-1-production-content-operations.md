# OPS-1 Production Content Operations / Editorial Quality

Status: **SUCCESS / CLOSED**

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

The migration fails closed unless that exact bounded Hosted prestate is still present. Fresh databases without the two known Hosted fixtures skip the bounded reconciliation block. The existing Hosted ranking is returned to `draft` instead of inventing eight entries or fabricating stronger evidence.

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

Final Hosted poststate after all validation:

- rankings total: `2`
- published rankings: `0`
- draft rankings: `1`
- archived rankings: `1`
- active items: `2`
- archived test items: `4`
- persistent `ops-1-transient-top-2` rows: `0`
- sponsors: `0`
- sponsorships: `0`
- unresolved legacy `sponsor_flag=true`: `0`

## Admin experience

`/admin/rankings` exposes:

- published / draft / archived state;
- `발행 품질 준비됨` or blocker count;
- entry count;
- criterion count;
- usable public source count;
- explicit `TOP N` title promise when present;
- the first blocker messages for triage.

The ranking preview control center loads the authoritative readiness result and disables publication until both editorial and moderation gates pass.

## Repository validation

Implementation branch:

- branch: `feature/ops-1-editorial-quality`
- base main: `80857c61a47ef1155a24564ea496e19267093b03`
- exact validated head: `e8d76f87f4dfd34db761b0cc7b0dc653d9bd8e94`
- implementation PR: `#41`
- exact-head GitHub Actions CI: run `#202` / `32201134234`

CI passed:

- all existing P1 verifiers;
- P2-1 / P2-2 / P2-3 verifiers;
- `verify:ops-1`;
- UI-1 verifier;
- LAUNCH-1 verifier;
- ESLint;
- production build.

PR #41 merged at:

`cce3cef2f94dfc28205fea76cebb4fecb8a67053`

The validated PR head and implementation merge commit have zero changed files between their file trees. Therefore the merged main file tree is the exact tree that passed CI #202.

## Production acceptance

Vercel deployment:

- deployment: `dpl_FSBor3m1irSA8we7XRZrBKJ96Dny`
- target: Production
- git ref: `main`
- git SHA: `cce3cef2f94dfc28205fea76cebb4fecb8a67053`
- state: `READY`

Production readback verified:

- `/` → `200`; public inventory reports zero published rankings and two active items;
- `/rankings/best-chicken-breast` → `404`, so the draft-quality ranking no longer leaks through the public ranking route;
- `/items/hankki-grill-sous-vide` → `200`, so legitimate active item detail remains available;
- unauthenticated `/admin/rankings` resolves to the login surface with `next=/admin/rankings`; admin data is not exposed;
- one-hour Vercel runtime error readback → zero runtime error clusters;
- deployment-scoped observed responses were normal `200` plus the intentional draft-ranking `404`.

## Non-goals

OPS-1 does not:

- scrape or import external data;
- create synthetic evidence;
- automatically rewrite weak editorial content;
- decide ranking truth from an LLM;
- replace moderation;
- alter ranking/search/vote scoring;
- change P2-3 sponsorship semantics.

## Closeout

All lifecycle requirements are satisfied:

1. exact-head PR CI passed all legacy gates plus `verify:ops-1`, lint and production build;
2. implementation merged without file-tree drift;
3. exact merged-main SHA deployed READY to Vercel Production;
4. public visibility, active item continuity, admin auth boundary and runtime health passed Production acceptance;
5. Hosted final state contains no persistent transient validation row and no regression to P2-3 sponsorship truth.

**OPS-1 = SUCCESS / CLOSED**

The next product task is `CONTENT-1 Verified Production Seed Batch`: populate a small set of real, source-backed rankings through the now-enforced editorial workflow and measure actual operator effort before deciding whether external import/crawling is justified.
