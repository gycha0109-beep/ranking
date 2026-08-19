# CONTENT-3 Recurring Editorial Refresh / Revalidation Cadence

Status: **IMPLEMENTATION / VALIDATION**

## Objective

CONTENT-3 turns source-backed publication into an ongoing editorial operation rather than a one-time seed event.

The stage must answer four operational questions:

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

A note such as `2026-08-19 확인` is insufficient for a repeatable queue because it cannot be queried reliably for due/overdue work.

## Real stale-data case discovered

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

Therefore `unesco-world-heritage-properties-2026-top-5` requires a safe editorial refresh. The change is processed through the existing OPS-1 contract: unpublish, edit while draft, re-run readiness, then republish. CONTENT-3 does not create a bypass for published editorial mutation.

The remaining seven published metric rankings were rechecked against their existing authorities and did not require value/order changes at this stage.

## Structured revalidation contract

Migration:

- `20260819030000_content_3_revalidation_cadence.sql`

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

Admin ranking management gains a revalidation status badge and a direct `재검증` workflow link.

The ranking-specific revalidation screen shows:

- current freshness state;
- latest verification;
- next review time;
- latest outcome/note;
- append-only prior events;
- a form to record the next event for published rankings.

The server action does not accept an arbitrary source snapshot. The database records the ranking's current `ranking_sources` rows at event creation time so the audit snapshot comes from the canonical source metadata already attached to the ranking.

## Initial cadence policy

CONTENT-3 uses source volatility rather than one global interval.

Recommended initial cadence for the current Production corpus:

- UNESCO current snapshot: 30 days;
- World Bank historical GDP/population: 90 days because historical series may be revised;
- 국가데이터처 annual domestic migration release: recheck around the next annual publication/correction cycle;
- final KBO historical season records: low-frequency annual correction check.

These intervals are operational starting points, not immutable product constants. Revalidation history is intended to provide evidence for tuning them.

## P2-4 boundary

CONTENT-3 still does not authorize a general crawler/import subsystem.

P2-4 should be reconsidered only if repeated revalidation demonstrates a concrete bottleneck such as:

- too many authoritative pages to check manually/assisted;
- repetitive normalization of the same source formats;
- frequent source revisions causing material update load;
- deduplication or provenance work dominating editorial time;
- refresh deadlines being missed because the current workflow does not scale.

Until that evidence exists, revalidation remains an editorial workflow backed by structured cadence/audit data rather than a large ingestion architecture.

## Validation gates

CONTENT-3 closes only after:

1. exact-head CI passes all prior verifiers plus `verify:content-3`;
2. Hosted migration is applied;
3. admin freshness status and append-only history RPCs are proven on Hosted;
4. all eight published metric rankings receive an initial revalidation event;
5. the stale UNESCO ranking is updated through OPS-1 without weakening publication gates;
6. UNESCO Production detail shows the corrected order/value;
7. Hosted readback shows the corrected ranking editorial-ready with zero blockers;
8. Production deployment is exact merged main and READY;
9. Production runtime errors remain clean.
