# CONTENT-3 Recurring Editorial Refresh / Revalidation Cadence

Status: **SUCCESS / CLOSED**

## Objective

CONTENT-3 turns source-backed publication into an ongoing editorial operation rather than a one-time seed event.

The stage answers four operational questions:

1. when each published ranking was last checked against its authoritative source;
2. when it should be checked again;
3. whether the latest check found no change, a completed content update, a source change requiring action, or an unavailable source;
4. whether repeated refresh work is expensive enough to justify P2-4 external ingestion.

CONTENT-3 does not change ranking order semantics, search relevance, voting, sponsorship, or OPS-1 publication quality rules.

## Current-state finding

Before CONTENT-3, `ranking_sources` could store source labels, URLs and free-text notes, but the repository had no structured authority for:

- last verification time;
- next verification due time;
- freshness state;
- immutable revalidation history.

A note such as `2026-08-19 확인` was insufficient for a repeatable queue because it could not be queried reliably for due/overdue work.

## Real stale-data case discovered and corrected

The first CONTENT-3 revalidation immediately found a material change in the published UNESCO snapshot.

CONTENT-2 stored:

1. China — 61
2. Italy — 61
3. France — 56
4. Germany — 55
5. Spain — 50

The authoritative UNESCO State Party pages rechecked during CONTENT-3 showed:

1. Italy — 62
2. China — 61
3. France — 56
4. Germany — 55
5. Spain — 50

`unesco-world-heritage-properties-2026-top-5` was corrected through the existing OPS-1 contract: unpublish, edit while draft, re-run readiness, then republish while preserving the original first-published timestamp.

Production acceptance then found one additional stale sentence in the Methodology body that still described China and Italy as tied at 61. That text was also corrected through the same OPS-1 workflow and revalidated before republishing.

The final Production detail now consistently shows Italy at 62 in first place and China at 61 in second place across ranking entries, metric values, reasons, JSON-LD and Methodology text.

The remaining seven published metric rankings were rechecked against their existing authorities and did not require value/order changes during this lifecycle.

## Structured revalidation contract

Repository migrations:

- `20260819030000_content_3_revalidation_cadence.sql`
- `20260819030100_content_3_rpc_permissions.sql`
- `20260819030200_content_3_actor_fk_index.sql`

New append-only authority:

- `public.ranking_revalidations`

Each event records:

- ranking ID;
- outcome;
- verified timestamp;
- next review timestamp;
- operator note;
- current ranking source metadata snapshot;
- actor attribution;
- creation timestamp.

Allowed outcomes:

- `verified_unchanged`;
- `updated`;
- `source_changed`;
- `source_unavailable`.

Rows are immutable after insertion. Direct table access is not the admin contract; authenticated admins use SECURITY DEFINER RPCs guarded by the existing `content_manage` capability.

The CONTENT-3 RPC permission follow-up explicitly revokes execution from `PUBLIC` and `anon` and grants it to `authenticated`. The actor foreign-key follow-up adds a covering index for `actor_id`.

## Freshness states

The admin status RPC derives one operational state from the latest event:

- `not_applicable` — ranking is not published;
- `never_reviewed` — published but no revalidation event exists;
- `attention_required` — latest event is `source_changed` or `source_unavailable`;
- `overdue` — next review time has passed;
- `due_soon` — next review is within seven days;
- `current` — latest verification is valid and not near its next due time.

`attention_required` takes precedence over calendar state so a source problem cannot be hidden by a future next-review date.

## Admin workflow

Admin ranking management now shows a revalidation freshness badge, the next review date when available, and a direct `재검증` workflow link.

The ranking-specific revalidation screen shows:

- current freshness state;
- latest verification;
- next review time;
- latest outcome/note;
- append-only prior events;
- a form to record the next event for published rankings.

The server action does not accept an arbitrary source snapshot. The database records the ranking's current `ranking_sources` rows at event creation time so the audit snapshot comes from canonical source metadata already attached to the ranking.

## Initial Production cadence

CONTENT-3 uses source volatility rather than one global interval.

The initial recorded next-review schedule is:

- UNESCO current snapshot: 2026-09-19;
- World Bank historical GDP/population: 2026-11-19;
- final KBO 2025 historical season records: 2027-01-01;
- 국가데이터처 2025 annual domestic migration release: 2027-01-29.

These dates are operational starting points, not immutable product constants. Revalidation history provides the evidence for tuning them.

## Hosted acceptance

Hosted Supabase acceptance completed with the production project as authority.

- all three CONTENT-3 migrations applied;
- admin status/history/record RPCs executed successfully under an authenticated operator with `content_manage`;
- anonymous function execution for all three CONTENT-3 admin RPCs is revoked;
- `ranking_revalidations` is append-only;
- initial revalidation was recorded for all 8 published metric rankings;
- 7 initial outcomes were `verified_unchanged`;
- UNESCO first produced `source_changed`, then `updated` after the safe editorial refresh;
- Production-detail acceptance discovered and corrected the remaining stale Methodology sentence, producing one additional `updated` event;
- final latest freshness state for all 8 published metric rankings is `current`;
- total CONTENT-3 revalidation events at closeout: 10;
- corrected UNESCO ranking remains OPS-1 `editorial_ready=true` with zero blockers.

## Repository and Production acceptance

Implementation PR #46 exact head:

- `ae39495cebed1457a1acf372017137ed9606ab84`

Exact-head CI:

- run #218;
- all prior verifiers passed;
- `verify:content-3` passed;
- lint passed;
- production build passed.

Merged implementation main:

- `664310e141715c85d80234bf3b91b78e629c3dcf`

Validated feature head and merged main have identical file trees.

Vercel Production deployment:

- deployment `dpl_BaKhiSpa5VpFyebwb7AKw3hU442z`;
- target `production`;
- git ref `main`;
- exact SHA `664310e141715c85d80234bf3b91b78e629c3dcf`;
- state `READY`;
- canonical alias `ranking-rho-three.vercel.app`;
- no non-main Vercel deployment was created during the feature branch lifecycle;
- Production runtime error clusters were zero during acceptance.

Public UNESCO detail acceptance verified:

- HTTP 200;
- Italy position 1 with explicit metric value `62건`;
- China position 2 with explicit metric value `61건`;
- corrected item reasons;
- corrected JSON-LD order;
- corrected Methodology body;
- updated Italy source note.

## P2-4 boundary

CONTENT-3 still does not justify a general crawler/import subsystem.

The first recurring revalidation cycle found one real stale document and corrected it safely, but the work did not demonstrate a sourcing, normalization or update bottleneck that warrants fetch → raw ingestion → normalize → dedupe → staging → admin review infrastructure.

P2-4 should be reconsidered only if continued production operation demonstrates concrete scale pressure such as:

- too many authoritative pages to check manually/assisted;
- repetitive normalization of the same source formats;
- frequent source revisions causing material update load;
- deduplication or provenance work dominating editorial time;
- refresh deadlines being missed because the current workflow does not scale.

Until that evidence exists, recurring revalidation remains an editorial workflow backed by structured cadence and immutable audit data.

## Lifecycle conclusion

All CONTENT-3 validation gates are satisfied.

**Lifecycle result: `SUCCESS / CLOSED`.**

The next work should be normal Production editorial operation and source-backed coverage expansion using the existing OPS-1 + CONTENT-3 contracts. P2-4 external ingestion remains deferred until operational evidence changes that decision.
