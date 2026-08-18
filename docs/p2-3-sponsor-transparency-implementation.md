# P2-3 Sponsor Transparency / Management — Implementation Evidence

Status: **IMPLEMENTED ON BRANCH / HOSTED MIGRATED / PR VALIDATION PENDING**

## Scope

This implementation promotes legacy sponsorship hints into a normalized, auditable transparency domain without inventing commercial relationships.

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

Hosted poststate after migration and dynamic validation:

- sponsors: `0`
- sponsorships: `0`
- sponsorship events: `1`
- legacy reconciliation events: `1`
- unresolved legacy sponsor flags: `0`
- current ranking public disclosures: `[]`
- current item public disclosures: `[]`
- normalized sponsorship authority ready: `true`

The one event records the exact before/after change from `sponsor_flag=true` to `false` and is visible through the integrated `sponsorship_change` audit stream.

## Security boundary

Raw sponsorship tables grant no direct privileges to `anon` or `authenticated`.

Public reads are exposed only through bounded SECURITY DEFINER disclosure RPCs. They contain sponsor identity, relationship/disclosure/influence information, relationship dates and period state, but exclude internal notes and actor/admin metadata.

Admin mutations are RPC-only and require `sponsorship_manage`. General audit reads require `audit_view`; sensitive snapshots remain behind `audit_sensitive_view`.

The Hosted admin authority readback reports `sponsorship_manage` for the current `super_admin` access. The available test user currently holds moderator, admin and super_admin rows simultaneously, so a clean moderator-only denial cannot be empirically demonstrated without mutating authority data. The capability function itself resolves the effective role and grants `sponsorship_manage` only to `admin` and `super_admin`.

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

All transient guard-test rows were removed; final Hosted counts remained at zero real sponsors and zero real sponsorships.

## Public disclosure history

The final public projection returns `period_state` from Hosted authority rather than making the UI infer publication history independently:

- future start → `upcoming`;
- started and not ended → `current`;
- ended → `historical`.

A transient Hosted validation created one published relationship in each period state against the test ranking. The public ranking disclosure RPC returned all three with the expected states. Those three transient relationships and their transient sponsor were then deleted. Final Hosted counts returned to:

- sponsors: `0`
- sponsorships: `0`
- sponsorship events: `1`
- unresolved legacy flags: `0`.

The public disclosure component visibly distinguishes upcoming, current and historical disclosures. Expired published relationships remain visible as historical records.

## Admin readiness

`admin_get_sponsorship_readiness` is capability-gated and reports:

- unresolved legacy flags;
- legacy reconciliation event count;
- published sponsorship count;
- `normalized_authority_ready`.

Hosted readback after cleanup returned:

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

The follow-up migration adds four partial indexes and Hosted readback confirmed all four index definitions exist.

Security advisor notes that the three raw P2-3 tables have RLS enabled with no policies. This is intentional deny-by-default: direct `PUBLIC`, `anon`, and `authenticated` table privileges are revoked and all reads/writes are through bounded RPCs. SECURITY DEFINER findings for the P2-3 RPCs are also intentional; admin RPCs self-authorize by capability and public RPCs expose bounded projections only. Pre-existing unrelated advisor findings are outside P2-3 scope.

## Lifecycle evidence

Repository base used for implementation:

`d8058b84a07e7a66937ed39a743b0ceff7dc9f15`

Hosted migrations applied successfully through the Supabase migration authority:

- `p2_3_sponsor_transparency`
- `p2_3_sponsor_audit_integration`
- `p2_3_sponsor_fk_indexes`
- `p2_3_disclosure_readiness`

Final PR exact-head CI, merge, merged-main CI, Vercel Production readiness and public smoke remain required before this document can be promoted to `SUCCESS / CLOSED`.
