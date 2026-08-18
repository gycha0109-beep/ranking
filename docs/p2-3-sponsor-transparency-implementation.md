# P2-3 Sponsor Transparency / Management — Implementation Evidence

Status: **SUCCESS / CLOSED**

## Scope

P2-3 promotes legacy sponsorship hints into a normalized, auditable transparency domain without inventing commercial relationships.

Implemented surfaces:

- normalized `sponsors`, `sponsorships`, and append-only `sponsorship_events` tables;
- `sponsorship_manage` admin capability;
- sponsor and sponsorship management RPCs;
- public-safe ranking/item disclosure RPCs;
- explicit `upcoming` / `current` / `historical` public disclosure state;
- ranking publication and placement-save guards;
- integrated `sponsorship_change` audit stream/detail support;
- admin sponsor/sponsorship management pages with relationship counts, readiness status and public preview;
- public ranking/item disclosure UI;
- P2-3 repository contract verifier and CI gate.

## Legacy reconciliation

The only Hosted legacy `ranking_entries.sponsor_flag=true` record was:

- ranking: `best-chicken-breast`
- item: `hankki-grill-sous-vide`

The operator explicitly classified that flag as test/demo data, not a real sponsorship.

The migration therefore:

1. requires that exact one-row prestate;
2. records one append-only `legacy_reconcile` event;
3. does **not** create a sponsor or sponsorship record;
4. sets the legacy flag to false;
5. aborts unless unresolved true flags become zero.

Final Hosted poststate after migration, dynamic validation, transient-test cleanup, merge, and Production acceptance:

- sponsors: `0`
- sponsorships: `0`
- sponsorship events: `1`
- legacy reconciliation events: `1`
- unresolved legacy sponsor flags: `0`
- normalized sponsorship authority ready: `true`

The one retained event records the approved test/demo reconciliation. No fake commercial relationship was created.

## Security boundary

Raw sponsorship tables grant no direct privileges to `anon` or `authenticated`.

Public reads are exposed only through bounded SECURITY DEFINER disclosure RPCs. They contain sponsor identity, relationship/disclosure/influence information, relationship dates, and period state, but exclude internal notes and actor/admin metadata.

Admin mutations are RPC-only and require `sponsorship_manage`. General audit reads require `audit_view`; sensitive snapshots remain behind `audit_sensitive_view`.

The available Hosted test account held moderator, admin, and super_admin rows simultaneously, so a clean moderator-only browser mutation denial was not manufactured by mutating authority data. The capability implementation grants `sponsorship_manage` only to `admin` and `super_admin`, and Hosted mutation/RPC authorization paths plus static contracts were validated before merge.

## Editorial integrity

- sponsorship does not alter ranking/search/vote scoring;
- ordinary ranking save no longer materializes legacy sponsor truth and always writes `sponsor_flag=false`;
- a published placement sponsorship prevents ordinary ranking save from silently removing that item;
- a `ranking_type='sponsored'` ranking cannot be published without a published ranking-level sponsorship disclosure;
- placement sponsorship publication requires the ranking/item pair to exist in the current ranking entries.

Hosted guard tests passed for:

- append-only sponsorship event immutability (`42501`);
- invalid relationship period rejection (`23514`);
- legacy `sponsor_flag=true` re-authoring rejection (`23514`);
- invalid target shape rejection (`23514`);
- publication of a non-existent placement rejection (`23514`);
- sponsored ranking without disclosure rejection (`23514`).

All transient guard-test rows were removed.

## Public disclosure history

The public projection returns `period_state` from Hosted authority rather than making the public UI infer publication history independently:

- future start → `upcoming`;
- started and not ended → `current`;
- ended → `historical`.

A bounded Hosted validation created one transient published relationship in each period state against the test ranking. The public ranking disclosure RPC returned all three expected states. The transient sponsorships and sponsor were deleted immediately after validation.

The shared disclosure component visibly distinguishes upcoming, current, and historical disclosures. Expired published relationships remain historically disclosed rather than disappearing.

## Admin readiness

`admin_get_sponsorship_readiness` is capability-gated and reports:

- unresolved legacy flags;
- legacy reconciliation event count;
- published sponsorship count;
- `normalized_authority_ready`.

Validated Hosted readiness before merge:

- unresolved legacy flags: `0`;
- legacy reconciliation events: `1`;
- published sponsorships: `0`;
- normalized authority ready: `true`.

The sponsor management surface also shows current and published relationship counts. The sponsorship management surface shows readiness status and renders the shared public disclosure component as the operator preview.

## Audit integration

Hosted readback verified:

- `list_admin_audit_events_v2` returns the reconciliation as `sponsorship_change`;
- the event has a stable `sponsorship:<entity_id>` correlation ID;
- the detail RPC returns public-safe evidence plus related events;
- sensitive evidence remains separately capability-gated.

## Advisor reconciliation

Supabase performance advisor initially identified four P2-3 foreign keys without covering indexes:

- `sponsors.created_by`
- `sponsors.updated_by`
- `sponsorships.created_by`
- `sponsorships.updated_by`

The follow-up migration added four partial indexes and Hosted readback confirmed all four definitions.

Security advisor notes that the three raw P2-3 tables have RLS enabled with no policies. This is intentional deny-by-default: direct `PUBLIC`, `anon`, and `authenticated` table privileges are revoked and all reads/writes are through bounded RPCs. SECURITY DEFINER findings for P2-3 RPCs are intentional: admin RPCs self-authorize by capability and public RPCs expose bounded projections only.

## Repository and CI evidence

Implementation baseline:

`d8058b84a07e7a66937ed39a743b0ceff7dc9f15`

Implementation PR:

- PR: `#39 feat: implement P2-3 sponsor transparency`
- exact implementation head: `7333924f7fcbc5ac62647739ae3c079ef59a955a`
- exact-head CI: run `#198` / workflow run `32106371550`
- result: **SUCCESS**
- validated gates: P1/P2 verifiers including `verify:p2-3`, UI/Launch verifier, lint, Production build

PR #39 was merged with the exact expected head. Implementation merge SHA:

`1aabde5670cfe1d55b22abfd3181ed83921fc448`

The merge commit tree contains the exact validated implementation head as its P2-3 parent.

## Hosted migration authority

The following repository migrations were applied successfully to Hosted Supabase:

- `20260818062000_p2_3_sponsor_transparency.sql`
- `20260818062100_p2_3_sponsor_audit_integration.sql`
- `20260818062200_p2_3_sponsor_fk_indexes.sql`
- `20260818062300_p2_3_disclosure_readiness.sql`

Hosted migration registry and final data readback were rechecked during closeout.

## Production acceptance

Vercel deployed implementation merge SHA `1aabde5670cfe1d55b22abfd3181ed83921fc448` from `main` as Production deployment:

`dpl_6QjwenUkgHKv6o45iq7euRa6gZrn`

Deployment state: **READY**.

Production readback verified:

- `/` → public success;
- `/rankings/best-chicken-breast` → `200`;
- `/items/hankki-grill-sous-vide` → `200`;
- no legacy sponsor disclosure reappeared for the reconciled test/demo row;
- `/admin/sponsors` unauthenticated access is routed to login with the intended `next` target;
- `/admin/sponsorships` unauthenticated access is routed to login with the intended `next` target;
- security response headers remain present;
- deployment-scoped runtime `error` / `fatal` logs over the acceptance window: `0`.

An authenticated admin browser session was not separately manufactured during closeout. The admin mutation/security boundary is instead backed by the already-completed Hosted RPC/constraint validation, capability checks, CI contracts, and the Production unauthenticated route boundary.

## Final classification

P2-3 is complete as a normalized sponsorship authority and disclosure system.

**`P2-3 SUCCESS / CLOSED`**
