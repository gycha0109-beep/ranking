# RF-1E Exact Outcome Attribution Bridge — Production Readback

Date: 2026-08-24

## Purpose

RF-1E closes the recommendation outcome-attribution provenance gap without creating a second analytics authority.

RF-1B exposure evidence originally retained the target ranking and ranking provenance but did not retain the ranking page that produced the recommendation. Because `MEASURE-1` already represents a ranking-to-ranking navigation as:

- `event_type = 'content_discovery_click'`
- `discovery_source = 'related_ranking'`
- `source_ranking_id = <source ranking>`
- `ranking_id = <target ranking>`

RF-1E does **not** infer an exposure from target ranking plus time proximity. It requires exact source ranking + target ranking + opaque exposure ID equality.

## Authority boundary

MEASURE-1 remains the product-usage telemetry authority.

RF-1E does not add:

- a recommendation outcome table,
- a new click event type,
- a new discovery-source vocabulary,
- a second `user_id` analytics identity,
- a second `viewer_key_hash` authority.

It adds only correlation provenance required to bind an existing MEASURE-1 row to a previously persisted RF-1 exposure.

## Schema changes

### `public.rf1_recommendation_exposures`

`source_ranking_id UUID NOT NULL` is now mandatory and references `public.rankings(id)`.

The migration fails closed if any older RF-1 exposure rows exist before this provenance is introduced. At migration time production had zero RF-1 exposure rows, so no provenance was inferred or backfilled.

The exposure writer now validates both:

- source ranking is public and moderation-eligible,
- target ranking is public and moderation-eligible,
- source ranking and target ranking differ.

Idempotent replay equality includes `source_ranking_id`.

### `public.product_usage_events`

A nullable `recommendation_exposure_id` references `rf1_recommendation_exposures(exposure_id)`.

The pointer is allowed only when the existing MEASURE-1 row already has the exact ranking-to-ranking discovery shape:

- `content_discovery_click`,
- `related_ranking`,
- ranking target present,
- source ranking present,
- no item target/source,
- no category source.

## Atomic bridge

`public.record_rf1_related_discovery_click(...)` is service-role-only.

It:

1. resolves the exact RF-1 exposure,
2. verifies exposure source and target IDs equal the requested MEASURE-1 source and target,
3. delegates event creation to existing `public.record_product_usage_event(...)`,
4. locks and revalidates the resulting MEASURE-1 row,
5. rejects a click timestamp preceding the exposure timestamp,
6. rejects conflicting replay attribution,
7. writes only `recommendation_exposure_id` onto the existing MEASURE-1 row.

This keeps product telemetry ownership in MEASURE-1 while adding exact recommendation provenance.

## Application bridge

`/api/measure-1` continues to use `record_product_usage_event` for ordinary telemetry.

For a ranking-to-ranking discovery click only, an optional `recommendationExposureId` is accepted. If present, the route uses `record_rf1_related_discovery_click`.

`ProductTelemetry` obtains the ID only from `data-rf1-exposure-id` on the clicked anchor. It never generates an exposure ID itself.

The public ranking page currently renders no `data-rf1-exposure-id`, so RF-1E does not activate personalized ordering or attributed recommendation clicks.

## Verification

Exact code HEAD validated before hosted migration application:

- commit: `12d2a13567841e015a3c29bd4a6ebb9f67ab4970`
- GitHub Actions CI run: `#427`
- result: `SUCCESS`

Successful gates included:

- RF-1
- RF-1B
- RF-1C
- RF-1D
- RF-1E
- existing IA gates
- existing MEASURE-1 / MEASURE-2 gates
- lint
- Next production build

## Hosted migration readback

Supabase project: `RanKing&Radar` (`yjdubukqkcvkymabskzd`)

Applied hosted migrations now include:

- RF-1B recommendation exposure evidence,
- RF-1C profile evidence read,
- RF-1D shadow evidence/readiness,
- RF-1E exact outcome attribution bridge.

Post-migration readback:

| Contract | Readback |
|---|---|
| exposure `source_ranking_id` nullable | `NO` |
| MEASURE correlation column | `text` |
| RF-1 exposure rows | `0` |
| RF-1 attributed MEASURE rows | `0` |
| total MEASURE-1 product usage rows | `219` |
| service role can execute attribution bridge | `true` |
| authenticated can execute attribution bridge | `false` |
| anon can execute attribution bridge | `false` |
| service role can execute exposure writer | `true` |
| authenticated can execute exposure writer | `false` |

No synthetic exposure, click, or shadow evidence was inserted to make the readback pass.

## Readiness verdict

Current hosted verdict remains:

`NOT_READY`

`production_policy_authorized = false`

`automatic_authorization = FORBIDDEN`

Current blockers:

- `NO_DURABLE_SHADOW_RUN_EVIDENCE`
- `NO_RELATED_RANKING_CLICK_OUTCOME_EVIDENCE`
- `NO_USER_VISIBLE_RF1_EXPOSURE_EVIDENCE`

Current evidence dimensions:

- authenticated profile evidence: `PRESENT_REVIEW_REQUIRED`
- shadow order evidence: `MISSING`
- related outcome evidence: `MISSING`
- low-exposure evidence: `MISSING`

Current relevant counts:

- published rankings: `16`
- changed bookmark events: `3`
- bookmark users: `2`
- MEASURE-1 product usage events: `219`
- generic related-ranking clicks: `0`
- exactly RF-1-attributed related-ranking clicks: `0`
- RF-1 exposures: `0`
- durable shadow runs: `0`

These counts are evidence-state observations, not production tuning constants.

## Advisor readback

Security advisor findings relevant to RF-1 tables are `RLS Enabled No Policy` INFO notices. This is intentional for the closed-table pattern used here: raw table privileges are revoked and access is through explicit RPCs.

The new attribution bridge is not reported as anonymously or generally authenticated-executable; direct privilege readback also confirms both are false.

Performance advisor reports the new RF-1 indexes as unused while RF-1 exposure/attribution/shadow row counts are zero. No new RF-1E unindexed-foreign-key finding was reported. Index-use evidence must be reassessed after actual controlled evidence exists; unused-at-zero-row is not a removal signal.

Supabase advisor references:

- RLS enabled/no policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- unused index: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Activation boundary

RF-1E is implemented, CI-verified, hosted-schema-applied, and read back.

It is **not** evidence that personalized recommendations are live.

Still forbidden/deferred:

- inventing RankingWiki production policy weights or thresholds,
- public ranking-page RF-1 reranking activation,
- rendering real RF-1 exposure IDs to users without an authorized policy,
- treating generic related-ranking clicks as RF-1 outcomes,
- fabricating SHADOW evidence to satisfy readiness,
- automatic policy authorization.

The next safe phase is evidence capture under an explicitly supplied/reviewed policy bundle, while remaining SHADOW-only until readiness evidence is materially present.
