# MEASURE-2 — Post-ACQ / Post-UI Real-User Evidence Readback & Investment Gate

Status: **MEASURE-2A SUCCESS / CLOSED — CLEAN BASELINE ESTABLISHED**

## Decision

MEASURE-2 asks one question:

> Does current real-user product/discovery evidence justify another product investment now?

Current answer:

```text
MEASURE_2A_CLEAN_BASELINE_INTEGRITY = SUCCESS / CLOSED
MEASURE_2_INVESTMENT_GATE = INSUFFICIENT_CLEAN_EVIDENCE
PRODUCT_FEATURE_INVESTMENT = NO_BUILD
OBSERVATION = CONTINUE
```

This is not a product-feature stage. It preserves the MEASURE-1 privacy boundary and repairs a measurement-integrity defect introduced by later anonymous Production browser acceptance tests.

## Starting authority

Authoritative starting `main`:

```text
e260bd60e22d845938a58eb7afda7ef80c117e02
```

Repair merge authority:

```text
PR = #94
PR_HEAD = 1d00b6a7fa235615bb2f61704cf77584da638f30
MERGED_MAIN = fb579078619ccb0ec6d0fdfa85583193ea6b284e
PRODUCTION_DEPLOYMENT = dpl_Cb94VtDCHiUZ59ijQkw7RvuXxPZB
PRODUCTION_STATE = READY
PRODUCTION_GIT_SHA = fb579078619ccb0ec6d0fdfa85583193ea6b284e
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

The semantic boundary is explicit:

```text
UNKNOWN != VERIFIED_REAL_USER
```

`unknown` means only that traffic was not classified as known QA/internal at write time.

## Hosted readback at MEASURE-2 start

Hosted `public.product_usage_events` initially contained:

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

The `unknown` search events were concentrated in exact Production E2E fixtures:

```text
슈퍼컴퓨터
LineShine
noresult7f3c2rankingwiki
```

Unknown content views were similarly concentrated in the TOP500 supercomputer ranking and LineShine item used by the Production Playwright suites.

The post-UI-3F browser suite is predominantly signed out. MEASURE-1 originally classified known authenticated E2E traffic through user metadata / reserved QA accounts, so independent anonymous Playwright contexts fell through to `traffic_class='unknown'`.

The contamination was reproduced again while PR #94 E2E ran against the still-old Production deployment: legacy totals rose from 149 to 210 before the repaired deployment became authoritative.

## Evidence handling

MEASURE-2 does not rewrite history to manufacture a cleaner result.

```text
LEGACY_TOTAL_EVENTS = 210
LEGACY_UNKNOWN_EVENTS = 205
LEGACY_QA_INTERNAL_EVENTS = 5
LEGACY_UNKNOWN_EVENTS = PRESERVED_NOT_RECLASSIFIED
```

No existing `product_usage_events` row was deleted or relabeled.

The pre-fix `unknown` population remains evidence of the operational defect but cannot authorize content, search, discovery, community, recommendation, ingestion, or other product investment.

## Repair contract

Read-only Production browser acceptance sends one explicit marker:

```text
x-rankingwiki-production-e2e: readonly-v1
```

Middleware recognizes it only for:

```text
POST /api/measure-1
```

and returns a successful non-inserting telemetry response before the normal MEASURE-1 writer is reached.

The marker:

- grants no authentication or authorization;
- bypasses no admin/product permission;
- affects only the bounded telemetry POST;
- adds no IP, user-agent, raw-referrer, or fingerprint storage;
- does not change authenticated `qa_internal` classification;
- exists only to stop read-only Production acceptance from polluting the real-user candidate baseline.

## Exact-head validation

PR #94 exact head:

```text
1d00b6a7fa235615bb2f61704cf77584da638f30
```

Validation:

```text
CI_RUN = #367 / 32621596141
CI = SUCCESS
verify:measure-1 = SUCCESS
verify:measure-2 = SUCCESS
ALL_HISTORICAL_VERIFIERS = SUCCESS
LINT = SUCCESS
NEXT_PRODUCTION_BUILD = SUCCESS

PRODUCTION_E2E_RUN = #24 / 32621596101
PR_ATTEMPT = SUCCESS
MERGED_PRODUCTION_RERUN = SUCCESS
DEEP_CHROMIUM = SUCCESS
ACCESSIBILITY_AXE = SUCCESS
CROSS_BROWSER_DEVICE_MATRIX = SUCCESS
```

## Clean baseline boundary

Merged-main Production became READY at:

```text
CLEAN_BASELINE_START_UTC = 2026-08-23T06:04:41.988Z
CLEAN_BASELINE_START_KST = 2026-08-23T15:04:41.988+09:00
```

The exact Production deployment is:

```text
dpl_Cb94VtDCHiUZ59ijQkw7RvuXxPZB
```

with exact Git SHA:

```text
fb579078619ccb0ec6d0fdfa85583193ea6b284e
```

After the repaired Production was authoritative, the same Production E2E suite was rerun in full. Final Hosted readback after that completed run showed:

```text
POST_BOUNDARY_EVENTS = 0
POST_BOUNDARY_UNKNOWN = 0
POST_BOUNDARY_QA_INTERNAL = 0
POST_BOUNDARY_KNOWN_FIXTURE_SEARCHES = 0
```

The global table remained:

```text
TOTAL_EVENTS = 210
UNKNOWN_TOTAL = 205
QA_INTERNAL_TOTAL = 5
LAST_EVENT_AT = 2026-08-23T06:02:47.882305Z
```

The last stored event precedes the clean boundary. This proves the repaired Production E2E no longer contaminates MEASURE-1 storage.

## Acceptance criteria result

1. Production Playwright marker in both configs — **PASS**
2. suppression bounded to marker + `POST /api/measure-1` — **PASS**
3. MEASURE-1 privacy/authenticated-QA contract retained — **PASS**
4. exact-head verifiers/lint/build — **PASS**
5. merge to main — **PASS**
6. exact merged-main Production READY — **PASS**
7. Production E2E against merged deployment — **PASS**
8. no E2E-fixture telemetry after boundary — **PASS**
9. acceptance suite exposes no 5xx/runtime regression — **PASS**
10. clean observation boundary recorded — **PASS**

## Investment gate after repair

The repair does not authorize another feature.

Future investment requires post-boundary evidence:

- expand content only when clean views/search/discovery show repeatable topic demand;
- improve search only when meaningful clean search volume shows a real zero-result/CTR problem;
- improve category/discovery only when clean usage demonstrates weak internal discovery;
- invest in community/voting only when non-QA authenticated engagement grows;
- consider ingestion only when demand plus editorial throughput exposes a sourcing bottleneck;
- otherwise keep `NO_BUILD`.

Search Console/Bing authority remains unavailable, so MEASURE-2 must not infer organic-search acquisition from IndexNow receipt or public search sampling.

## Terminal state

```text
MEASURE_2A = SUCCESS / CLOSED
CLEAN_BASELINE_INTEGRITY_REPAIR = VERIFIED
CLEAN_BASELINE_START = 2026-08-23T06:04:41.988Z
LEGACY_UNKNOWN_EVENTS = PRESERVED_NOT_RECLASSIFIED
POST_BOUNDARY_SYNTHETIC_CONTAMINATION = 0
MEASURE_2_INVESTMENT_GATE = INSUFFICIENT_CLEAN_EVIDENCE
PRODUCT_FEATURE_INVESTMENT = NO_BUILD
OBSERVATION = CONTINUE
SEARCH_ENGINE_ACQUISITION_ATTRIBUTION = UNAVAILABLE
```
