# MEASURE-2 — Post-ACQ / Post-UI Real-User Evidence Readback & Investment Gate

Status: **BASELINE CONTAMINATION CONFIRMED / CLEAN-BASELINE REPAIR IMPLEMENTING**

## Decision

MEASURE-2 asks one question:

> Does current real-user product/discovery evidence justify another product investment now?

Current answer:

```text
MEASURE_2_INVESTMENT_GATE = BLOCKED_CONTAMINATED_BASELINE
PRODUCT_FEATURE_INVESTMENT = NO_BUILD
```

This is not a product-feature stage. It preserves the MEASURE-1 privacy boundary and repairs a measurement-integrity defect introduced by later anonymous Production browser acceptance tests.

## Starting authority

Authoritative starting `main`:

```text
e260bd60e22d845938a58eb7afda7ef80c117e02
```

Inherited authority:

```text
V1_PRODUCT_IMPLEMENTATION = COMPLETE
UI_3F = SUCCESS / CLOSED
ACQ_2 = SUCCESS / CLOSED
ACQ_3_READBACK_CONTRACT = SUCCESS / CLOSED
SEARCH_ENGINE_CRAWL_INDEX_STATE = UNCONFIRMED
```

MEASURE-1 remains the telemetry authority. Its bounded event types are:

- `content_view`
- `search`
- `search_result_click`
- `content_discovery_click`

Its traffic classes remain:

- `unknown`
- `qa_internal`

The semantic boundary is now made explicit:

```text
UNKNOWN != VERIFIED_REAL_USER
```

`unknown` means only that traffic was not classified as known QA/internal at write time. It is baseline-eligible only while the operational classifier is known not to be contaminated by a later QA path.

## Hosted readback at MEASURE-2 start

Hosted `public.product_usage_events` contained:

```text
TOTAL_EVENTS = 149
UNKNOWN_EVENTS = 144
QA_INTERNAL_EVENTS = 5
UNKNOWN_DISTINCT_DAILY_VIEWERS = 72
FIRST_EVENT_AT = 2026-08-19T05:00:09.4734Z
LAST_EVENT_AT = 2026-08-22T15:41:24.961508Z
```

By day:

```text
2026-08-19  qa_internal = 5
2026-08-20  unknown     = 3
2026-08-22  unknown     = 141
```

The 2026-08-22 spike is not accepted as organic demand evidence.

## Contamination evidence

The 67 `unknown` search events are concentrated in exact current Production E2E fixtures:

```text
슈퍼컴퓨터                 55 searches
LineShine                    10 searches
noresult7f3c2rankingwiki      2 searches
```

The synthetic no-result query is an exact repository QA fixture.

Unknown content views are similarly concentrated:

```text
TOP500 supercomputer ranking = 34
LineShine item               = 30
PISA 2022 reading ranking    = 1
```

The TOP500 ranking, LineShine item, technology category, `슈퍼컴퓨터` query, and `noresult7f3c2rankingwiki` query are the canonical fixtures used by the post-UI-3F Production Playwright smoke/compatibility suite.

The later browser suite is predominantly signed out. MEASURE-1 originally classified known authenticated E2E traffic via user app metadata or the reserved `example.com` QA account. Signed-out browser contexts therefore received independent anonymous viewer cookies and fell through to `traffic_class='unknown'`.

This explains the apparent one-day explosion in unknown daily viewers and search volume without requiring any claim about actual users.

## Evidence handling

MEASURE-2 does not rewrite history to manufacture a cleaner result.

```text
LEGACY_UNKNOWN_EVENTS = PRESERVED_NOT_RECLASSIFIED
POST_FIX_CLEAN_BASELINE = REQUIRED
```

No existing `product_usage_events` row is deleted or relabeled.

The pre-fix `unknown` population remains queryable evidence of the operational defect, but it is not used to authorize content, search, discovery, community, recommendation, ingestion, or other product investment.

The three 2026-08-20 unknown events are also not promoted to verified real-user evidence. They may be genuine usage or manual anonymous internal traffic; the current authority cannot distinguish them retrospectively.

## Repair contract

Read-only Production browser acceptance now sends one explicit marker:

```text
x-rankingwiki-production-e2e: readonly-v1
```

The middleware recognizes this marker only for:

```text
POST /api/measure-1
```

and returns a successful non-inserting telemetry response before the normal MEASURE-1 writer is reached.

This marker:

- does not grant authentication or authorization;
- does not bypass admin/product permissions;
- does not alter product requests other than the bounded telemetry POST;
- does not inspect or persist IP, user-agent, raw referrer, or browser fingerprint;
- does not change the existing authenticated `qa_internal` classification contract;
- exists only to stop read-only Production acceptance from polluting the real-user candidate baseline.

The marker is not a security credential. A client that deliberately copies it can only suppress its own bounded telemetry write, not gain product authority.

## Acceptance criteria

MEASURE-2A clean-baseline integrity repair closes only when:

1. the explicit marker is present in both Production Playwright configs;
2. middleware suppression is bounded to exact marker + `POST /api/measure-1`;
3. the original MEASURE-1 route retains its privacy and authenticated-QA classification contract;
4. `verify:measure-2`, all historical verifiers, lint, and Next production build pass at the exact PR head;
5. the repair merges to `main`;
6. merged-main Production is READY from the exact merge SHA;
7. Production E2E passes against that merged deployment;
8. Hosted readback shows no new E2E-fixture telemetry after the clean-baseline boundary;
9. runtime error / 5xx checks remain clean;
10. a new clean observation boundary is recorded.

## Investment gate after repair

The repair itself does not authorize another feature.

After the clean boundary:

- expand content only if eligible views/search/discovery show repeatable topic demand;
- improve search only if meaningful clean search volume shows high zero-result rate or weak result CTR;
- improve category/discovery only if clean content usage exists and internal discovery is demonstrably weak;
- invest in community/voting only if non-QA authenticated engagement grows;
- consider ingestion only if demonstrated demand and editorial throughput expose a sourcing bottleneck;
- otherwise keep `NO_BUILD`.

Because Search Console/Bing engine authority remains unavailable, MEASURE-2 also must not infer organic-search acquisition from IndexNow receipt or public search sampling.

## Current terminal state

Until post-fix evidence is collected:

```text
MEASURE_2_INVESTMENT_GATE = BLOCKED_CONTAMINATED_BASELINE
PRODUCT_FEATURE_INVESTMENT = NO_BUILD
CLEAN_BASELINE_INTEGRITY_REPAIR = IMPLEMENTING
LEGACY_UNKNOWN_EVENTS = PRESERVED_NOT_RECLASSIFIED
POST_FIX_CLEAN_BASELINE = REQUIRED
SEARCH_ENGINE_ACQUISITION_ATTRIBUTION = UNAVAILABLE
```
