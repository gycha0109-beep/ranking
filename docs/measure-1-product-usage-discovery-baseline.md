# MEASURE-1 Product Usage & Discovery Baseline / Real-User Validation Readiness

Status: **SUCCESS / CLOSED**

## Objective

MEASURE-1 establishes the minimum trustworthy product-usage and discovery evidence required to decide what Ranking Wiki should build next. It is not a general analytics platform and does not introduce a third-party analytics SaaS, recommendation system, crawler, behavioral profile, experimentation platform, or BI warehouse.

The stage starts a new baseline authority after CONTENT-4. Existing lifetime counters remain product UI data, but pre-MEASURE-1 telemetry is not retroactively treated as real-user demand.

## Starting authority

Authoritative starting `main`:

- `17d731a96c6edc7258ed1e3dc7c98664f6037945`
- CONTENT-4 PR #48 merged and closed
- Vercel Production deployment `dpl_Hu9Y7FGCa6RXcRf1mJ9qqcJ5csU1` READY from the same SHA
- Hosted Supabase `yjdubukqkcvkymabskzd` ACTIVE_HEALTHY
- visible top-level categories: `5`
- visible subcategories: `6`
- published rankings: `13`
- active items: `42`
- published OPS-1 readiness failures: `0`

## Current-state telemetry audit

The existing product already has:

- `content_daily_views`
- `content_view_totals`
- `content_likes`
- `content_like_events`
- `content_bookmarks`
- `content_bookmark_events`
- `comments`
- `reactions`

The existing daily-view contract is privacy-preserving relative to conventional analytics. Ranking/item detail hydration records a service-side HMAC of a UTC date plus either the authenticated user UUID or an anonymous UUID cookie. Raw IP and user-agent fingerprint data are not persisted, and the daily hash does not provide a stable cross-day pseudonymous identity.

However, the existing authority has no traffic provenance. At the MEASURE-1 audit point Hosted data contained:

- `content_daily_views`: `169`
- distinct viewer hashes: `152`
- lifetime unique-view total: `169`
- likes: `1`
- bookmarks: `1`
- comments: `2`
- reactions: `0`
- like events: `3`
- bookmark events: `3`

Those rows are concentrated in 2026-08-17 through 2026-08-18 QA flows, especially `best-chicken-breast` (`149` views). The repository's Production Playwright suite also targets that ranking and mutates likes, bookmarks, and comments with a dedicated E2E account. These values therefore cannot be treated as current-corpus organic demand.

The search implementation uses `search_public_content`, but the audit found no structured authority for search executions, result counts, zero-result queries, result clicks, click positions, or discovery-source attribution.

## Authority split

### Legacy UI counters

`content_daily_views` and `content_view_totals` remain untouched so existing ranking/item view counters and their deduplication contract do not regress.

They are explicitly **not baseline-eligible** for MEASURE-1 because historical rows cannot be reliably classified as QA/internal versus real-user traffic.

### MEASURE-1 baseline authority

`product_usage_events` starts at the MEASURE-1 deployment boundary and accepts only four event types:

1. `content_view`
2. `search`
3. `search_result_click`
4. `content_discovery_click`

No arbitrary event name or metadata JSON is accepted.

## Traffic classification

The baseline has two forward-looking classes:

- `unknown`: baseline-eligible traffic that is not known to be QA/internal
- `qa_internal`: known test/internal traffic, excluded from eligible product metrics

Known Production E2E traffic is classified as `qa_internal` when either:

- the authenticated user's app metadata contains `telemetry_class=qa_internal`; or
- the dedicated test account uses the reserved `example.com` domain.

No user UUID or email is copied into the telemetry row. The classification is derived before the bounded service-role RPC write.

Anonymous manual internal testing cannot be perfectly distinguished without an explicit test marker. MEASURE-1 intentionally does not introduce fingerprinting or heuristic bot detection to solve that edge case. Such traffic remains `unknown` unless a later operational need justifies a stronger explicit marker.

## Viewer privacy contract

MEASURE-1 reuses the existing `rw_viewer_v1` anonymous cookie rather than introducing another identity.

For each UTC date, the server computes an HMAC over:

- `u:<authenticated-user-uuid>` for authenticated users; or
- `a:<anonymous-cookie-uuid>` for anonymous users.

Only the resulting 64-hex daily hash is stored.

Consequences:

- no raw IP persistence;
- no user-agent fingerprint persistence;
- no cross-site tracking;
- no stable cross-day behavioral identifier;
- no user identity duplicated into event rows;
- returning-user measurement is intentionally unavailable in MEASURE-1.

A future stage must not add a stable pseudonymous identity merely to manufacture a returning-user KPI without a separate privacy/product justification.

## Search privacy contract

Search text is free input and may contain sensitive material.

MEASURE-1 therefore:

- normalizes with NFKC, whitespace collapse, trim, and lowercase;
- accepts only normalized query lengths `2..120`;
- hashes the normalized query with server HMAC for durable aggregation;
- retains normalized text only when at most `80` characters;
- redacts retained text entirely when it resembles an email address, URL, Korean resident-style identifier, or phone number;
- nulls retained query text after `30 days`;
- deletes the full event after `13 months`.

The original unnormalized raw query is never persisted.

## Search measurement semantics

A `search` event contains:

- `search_id`
- daily viewer hash
- traffic class
- normalized query HMAC
- optional short sanitized normalized query text
- result count for the rendered result page
- derived zero-result boolean

A `search_result_click` contains:

- the same `search_id`
- query HMAC
- target canonical ranking/item UUID
- selected result position

There is deliberately no row-per-result impression event. Search-result CTR is derived from search sessions with at least one click divided by measured search sessions. This avoids high-volume impression data that adds no decision value at the current scale.

## Discovery measurement semantics

`content_discovery_click` is limited to these internal paths:

- `home`
- `category`
- `related_ranking`
- `ranking_item`
- `item_ranking`

Search clicks use `search_result_click` rather than duplicating a generic discovery event.

The client only submits the source pathname and target pathname. The server resolves target slugs to canonical UUIDs before persistence. Category/ranking/item source identities are also resolved where available.

Direct/external arrival is not given a separate referrer log in MEASURE-1. A direct or external landing can still produce a `content_view`, but raw referrer URL persistence is intentionally avoided. If acquisition attribution becomes a real product need, a later stage may consider a coarse same-site/external/direct classification without storing full URLs.

## Content-view semantics

A MEASURE-1 `content_view` is recorded on ranking/item detail navigation and is unique per daily viewer hash plus canonical target. It starts only after MEASURE-1 deployment.

This new baseline view event does not replace the existing public lifetime counter. The two authorities have different purposes:

- existing view tables: product display / historical counter;
- MEASURE-1 view events: traffic-classified product evidence.

## Persistence and security

`product_usage_events`:

- uses stable ranking/item UUID foreign keys;
- has RLS enabled;
- has no direct `anon` or `authenticated` table access;
- is written only through a bounded service-role RPC;
- has no arbitrary JSON metadata field;
- has bounded event/source enums and field-shape checks;
- uses idempotent client UUIDs;
- opportunistically runs bounded retention cleanup on writes;
- exposes a service-role cleanup RPC for explicit maintenance;
- is also attached to the existing P1-2-9 centralized maintenance runner and pg_cron schedule, so retention still runs when user traffic is idle.

The scheduled job is `maintain_measure_1_telemetry` / `ranking-maint-measure-1-telemetry`, runs daily at `10 4 * * *` UTC, redacts retained query text after 30 days, and deletes events after 13 months. It reuses the existing maintenance job definition, advisory lock, run ledger, timeout, batching, and pg_cron authority instead of introducing another scheduler.

The public API route rejects cross-origin writes when an Origin header is present and does not inspect or persist IP, user-agent, or raw referrer values.

## Operator baseline

`/admin/measure` is a minimal readout guarded by the existing `audit_view` capability. It is intentionally not a large analytics dashboard.

For a selected period it exposes:

- eligible content views;
- ranking vs item views;
- eligible distinct daily viewers;
- known QA/internal view/search/discovery counts;
- measured searches;
- distinct daily searchers;
- zero-result count and rate;
- searches that produced a result click;
- search-result CTR;
- discovery clicks grouped by bounded source;
- eligible authenticated engagement counts;
- recent sanitized top search terms while text retention permits them.

Existing authenticated engagement events are classified at read time. The reserved QA account and any account explicitly carrying `telemetry_class=qa_internal` are excluded from eligible engagement counts.

## KPI interpretation limits

MEASURE-1 intentionally does **not** claim:

- total site visitors, because home/category page impressions are not being turned into a general pageview system;
- returning users, because the privacy contract rotates viewer hashes daily;
- user-level engagement conversion, because the aggregate daily view hash is deliberately not joinable to persistent user identity;
- acquisition channel attribution, because full referrer tracking is not collected;
- bot detection, because invasive fingerprinting is out of scope.

Accordingly, `search usage rate` as a percentage of all visitors is not reported. The reliable evidence is measured search volume, distinct daily searchers, zero-result rate, and search-result CTR.

## Product decisions enabled

The minimum contract supports these decisions:

- **Expand content** when eligible views/discovery and retained search demand cluster around topics not yet covered.
- **Improve search** when search volume is meaningful but zero-result rate is high or result CTR is low.
- **Improve category/discovery UX** when eligible content views exist but internal discovery clicks are weak or strongly concentrated in one path.
- **Invest in community/voting** when authenticated engagement grows relative to the measured usage baseline.
- **Consider external ingestion** only when real demand and editorial throughput indicate a sourcing/normalization bottleneck.
- **Build nothing yet** when the baseline remains too small to support a confident product investment.

## Validation plan

MEASURE-1 closes only after:

1. repository verifier passes;
2. migrations are applied through Hosted `apply_migration`;
3. Hosted schema/RLS/function/grant readback passes;
4. scheduled retention job definition, central-runner dispatch, cron registration, and a controlled maintenance run pass;
5. controlled QA events are recorded as `qa_internal` and excluded from eligible aggregates;
6. search non-zero, zero-result, click attribution, and discovery events are validated under explicit QA classification without contaminating the durable eligible baseline;
7. existing CI gates, lint, and build pass at the exact PR head;
8. implementation PR merges to `main`;
9. merged-main Vercel Production is READY from the merged SHA;
10. production home/category/search/ranking/item smoke passes;
11. runtime errors are checked;
12. closeout evidence records the exact merged main and Production deployment.

## Closeout evidence

MEASURE-1 satisfied the closure contract on 2026-08-19.

- implementation PR: `#49` — merged
- exact implementation PR head: `7bfc6c1e89350ab59c2cd6de62dab0f4277e3cb4`
- exact-head GitHub Actions: run `#227` — `SUCCESS`
- merged implementation `main`: `6b6d4bc2b3a4162fc046797b2b5404a74c5dc7c4`
- merged-main Vercel Production: `dpl_7dzCoMgHjDkAyU3D1xAcmfyCsKmu` — `READY`
- canonical Production alias: `https://ranking-rho-three.vercel.app`
- Hosted migrations applied: `measure_1_product_usage_discovery`, `measure_1_retention_maintenance`
- retention authority: `maintain_measure_1_telemetry` / `ranking-maint-measure-1-telemetry`, daily `10 4 * * *` UTC
- controlled retention runner validation: `no_work`, no error
- Hosted table/RLS/grant/RPC/capability readback passed; direct `anon`/`authenticated` table access remains denied
- controlled QA search, zero-result search, search-result click, discovery click, content view, and daily content-view dedupe passed under `qa_internal`
- Production server-side smoke returned `200` for `/`, `/categories`, `/search?q=FIFA`, `/rankings/fifa-men-world-ranking-2026-07-top-5`, and `/items/singapore`
- unauthenticated `/admin/measure` resolved to the login surface and did not expose the operator baseline
- Vercel `error`/`fatal` runtime log check for the merged deployment returned no matching logs
- smoke validation did not execute browser telemetry; post-smoke Hosted telemetry remained QA-only with `unknown=0`

The baseline therefore starts prospectively from the MEASURE-1 authority. Historical `content_daily_views` / `content_view_totals` remain product display counters and are not retroactively reclassified as real-user demand.

Closure does not authorize a recommendation engine, crawler/import subsystem, third-party analytics SaaS, generalized pageview system, persistent cross-day user identifier, A/B experimentation platform, or BI warehouse. The next product decision should be made only after enough baseline-eligible real-user evidence exists.

## Non-goals

MEASURE-1 does not add:

- PostHog, Google Analytics, Mixpanel, or other third-party analytics;
- a recommendation engine;
- personalized feeds;
- advertising tracking;
- behavioral profiles;
- A/B experimentation;
- a BI warehouse;
- external crawler/import infrastructure;
- bulk new content publishing.
