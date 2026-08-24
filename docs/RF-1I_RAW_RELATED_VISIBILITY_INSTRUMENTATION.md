# RF-1I Raw Related-Ranking Visibility Instrumentation

Date: 2026-08-24

## Goal

RF-1I adds the missing observation layer needed to eventually reason about `FEED_IMPRESSION`, `QUICK_SKIP`, and `DWELL` without inventing behavior thresholds before RankingWiki has evidence.

The implementation deliberately records **raw facts**, not RF-1 behavior judgments.

## Authority decision

RF-1I does not create a second analytics store.

The existing MEASURE-1 authority remains:

- `public.product_usage_events`
- `/api/measure-1`
- `public.record_product_usage_event(...)`

The existing privacy-preserving `viewer_key_hash`, source/target provenance, traffic classification, retention path, and server-only write boundary remain authoritative.

RF-1I adds no:

- `user_id` analytics identity,
- second viewer hash,
- raw IP address,
- user-agent fingerprint,
- `rf1_behavior_events` table,
- `rf1_visibility` table.

## Raw observation vocabulary

MEASURE-1 now admits two additional raw event types:

- `content_impression`
- `content_visibility`

These are not equivalent to approved RF-1 behavior events by themselves.

In particular, RF-1I does **not** persist:

- `QUICK_SKIP`
- `DWELL`
- dwell magnitude
- quick-skip threshold decisions

Those remain calibration questions for later evidence.

## Observation fields

`public.product_usage_events` now contains:

- `observation_id UUID`
- `visible_duration_ms BIGINT`
- `entry_intersection_ratio_ppm INTEGER`
- `visibility_end_reason TEXT`

The current raw scope is intentionally narrow: ranking-detail → related-ranking links only.

Every raw observation therefore retains:

- source ranking,
- target ranking,
- `discovery_source = 'related_ranking'`,
- observation ID,
- entry visibility geometry,
- optional exact RF-1 exposure correlation if a future authorized runtime supplies one.

## Browser semantics

`ProductTelemetry` uses `IntersectionObserver` rather than DOM existence as impression evidence.

A segment starts only when:

- the current page is a ranking detail page,
- the target is another ranking,
- the link has a positive visible intersection,
- the document is visible.

The observer uses `threshold: 0`. This is intentional: RF-1I does not introduce a product-policy visibility percentage threshold.

At segment entry:

- a fresh `observation_id` is generated,
- entry intersection ratio is stored as parts-per-million,
- a `content_impression` raw event is emitted,
- monotonic timing starts with `performance.now()`.

The segment ends on one of:

- `out_of_view`
- `page_hidden`
- `page_exit`
- `unmount`

A `content_visibility` event records the raw `visible_duration_ms` for that segment.

When the tab becomes hidden, the active segment is closed before background time can accumulate. If the card becomes visible again later, a new observation segment is created.

## Impression → visibility → click correlation

While a related-ranking link is actively visible, its current opaque observation ID is held transiently on the anchor as `data-measure-observation-id`.

If the user clicks that link, the existing `content_discovery_click` telemetry may reuse the same `observation_id`.

The database has a bounded uniqueness contract over `(observation_id, event_type)` for:

- `content_impression`
- `content_visibility`
- `content_discovery_click`

This makes one observation segment reconstructable without creating a separate session/behavior table.

## RF-1 exposure provenance

RF-1E's exact source/target exposure validation is preserved.

If a future authorized public RF-1 runtime renders `data-rf1-exposure-id`, raw impression/visibility and click events can all retain that exact exposure pointer.

The current public ranking page still renders no RF-1 exposure ID and does not execute RF-1 ranking logic. RF-1I therefore does not activate personalized ordering.

## Database write boundary

The extended `record_product_usage_event(...)` remains `SECURITY DEFINER` but direct execution is restricted to `service_role`.

Hosted privilege readback after migration:

| Contract | Result |
|---|---:|
| service role can execute extended MEASURE-1 writer | `true` |
| authenticated can execute extended MEASURE-1 writer | `false` |
| anon can execute extended MEASURE-1 writer | `false` |
| service role can execute RF-1 related-click bridge | `true` |
| authenticated can execute RF-1 related-click bridge | `false` |

The raw `product_usage_events` table continues to use the existing closed-table/RLS pattern.

## Verification

Implementation HEAD before hosted migration application:

`65963b1f8e8d183147043e3c98ad5ee01cf04881`

GitHub Actions CI run `#457` completed `SUCCESS` with:

- all existing audit/P1/P2/IA gates,
- `verify:rf-1` through `verify:rf-1i`,
- existing OPS/public-copy/content/UI/launch/acquisition gates,
- existing MEASURE-1 and MEASURE-2 gates,
- lint,
- Next production build.

RF-1I contract verification specifically checks that:

- MEASURE-1 is extended rather than duplicated,
- no QUICK_SKIP/DWELL classification is introduced,
- raw visibility is related-ranking-only,
- background-tab time is excluded,
- impression/visibility/click can share observation provenance,
- no raw IP/user-agent identity is introduced,
- public RF-1 ordering remains disabled.

## Hosted migration/readback

Production project: `RanKing&Radar` (`yjdubukqkcvkymabskzd`).

Migration applied:

`rf_1i_related_visibility_measurement`

Pre-migration telemetry state:

- total MEASURE-1 rows: `219`
- RF-1-attributed rows: `0`
- related-ranking clicks: `0`

Immediate post-migration state:

- total MEASURE-1 rows: `219`
- `content_impression` rows: `0`
- `content_visibility` rows: `0`
- rows with `observation_id`: `0`
- RF-1I columns present: `4 / 4`

Existing telemetry rows were preserved and naturally have NULL RF-1I observation fields.

No synthetic production observation row was inserted.

## PostgreSQL rollback runtime test

The hosted database was exercised inside a transaction using two real current public ranking IDs.

The test wrote, under a single synthetic observation ID:

1. `content_impression`
2. `content_visibility` with raw duration `1234 ms`
3. `content_discovery_click`

Inside the transaction the database verified:

- exactly three correlated rows existed,
- the raw visibility duration was exactly `1234`.

The transaction was then rolled back.

Final readback:

- runtime test: `PASS`
- persisted synthetic test rows: `0`
- total production MEASURE-1 rows after test: `219`

This verifies the actual PostgreSQL constraints/function signatures without contaminating production evidence.

## Advisor readback

Security advisor continues to report `RLS Enabled No Policy` INFO for `product_usage_events`. That reflects the pre-existing intentional closed-table pattern; direct function privilege readback confirms the new writer is not anon/authenticated executable.

Reference:
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Performance advisor reports multiple pre-existing unindexed foreign-key and unused-index notices across the project, including older `product_usage_events` target/source FKs. RF-1I adds no new foreign key and produced no new RF-1I-specific unindexed-FK finding. The new observation indexes should be reassessed only after real observation traffic exists.

References:
- https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
- https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Activation state

The hosted database is schema-ready, but the RF-1I browser/application code is still on PR #105 and has not been merged/deployed.

Therefore:

- raw observation schema: applied
- PostgreSQL runtime contract: verified
- branch application code: implemented and CI-green
- production browser event collection: **not yet deployed/verified**
- real RF-1I observation samples: `0`
- QUICK_SKIP classification: unresolved
- DWELL magnitude calibration: unresolved
- public RF-1 ordering: off

Database migration alone does not cause user traffic to emit the new events.

## Next boundary

After application deployment and real raw samples exist, the next safe step is a non-authorizing observation readback/calibration layer that summarizes raw duration and click outcomes without automatically converting them into QUICK_SKIP or DWELL policy values.

Until those samples exist, no duration threshold or RF-1 behavior magnitude should be invented.
