# RF-1 — Journey Recommendation Architecture Adaptation

Status: implementation slice on `feat/rf-1-recommendation-transfer`

Base authority: `main` at `0f890513ff0f5d043ec49ac85987a1ab67a0105f`

## 1. Repository audit

### Ranking Neighborhood authority

- `src/lib/ranking-neighborhood.ts` is the existing contextual Ranking Neighborhood domain helper.
- It owns Item Jaccard, lexical Jaccard, same-category/subcategory context, A/B/C/D relation tiers, stable tie-breaking, and explanation text.
- `src/lib/queries/public.ts#getRelatedRankings` is the current candidate retrieval surface. It combines the identity-first IA-2 source with the IA-1 contextual neighborhood, uses bounded candidate sources, public/moderation gates, deterministic ID ordering, candidate dedupe, and batched hydration.
- RF-1 does not replace or alter this contract. The recommendation layer starts after a candidate pool has already been produced.

### Current RankingWiki schema usable by RF-1

Existing governed dimensions:

- `rankings.category_id`
- `rankings.subcategory_id`
- `rankings.ranking_type`
- `ranking_entries.item_id`
- `rankings.status`
- `rankings.published_at`
- moderation/publication state

Not treated as governed RF-1 taxonomy in this stage:

- geography: no dedicated current ranking field
- ranking family: no dedicated current field; `ranking_type` is not renamed into a fictitious family
- duplicate/shared-item cluster: overlap can be computed by Neighborhood, but there is no persisted cluster authority

RF-1 profile features are therefore limited to `category`, `subcategory`, `rankingType`, and `item`.

### Existing engagement / behavioral evidence

| Existing authority | What exists | RF-1 use in this slice |
|---|---|---|
| `content_bookmarks` / `content_bookmark_events` | authenticated user target state + append-only requested bookmark changes | SAVE/UNSAVE are source-compatible for a future profile adapter |
| `content_likes` / `content_like_events` | authenticated user like state + append-only change events | available as an aggregate popularity signal; LIKE is not added to RF-1 behavior vocabulary |
| `content_daily_views` / `content_view_totals` | privacy-preserving unique daily view event + accumulated unique view total | aggregate popularity only; daily view rows do not retain authenticated user identity |
| `product_usage_events` (MEASURE-1) | `content_view`, search, search-result click, discovery click; viewer hash; source navigation provenance | existing analytics authority must be reconciled before adding recommendation telemetry tables |

Important boundary: MEASURE-1 stores privacy-preserving `viewer_key_hash`, not a stable authenticated `user_id`. It is useful for aggregate measurement and potentially a session adapter, but it is not silently promoted into a long-term authenticated user profile authority.

### RF-1 requested event vocabulary versus current collection

| RF-1 event | Current repository evidence | Decision |
|---|---|---|
| FEED_IMPRESSION | no recommendation feed exposure authority | contract only; persistence deferred |
| RANKING_VIEW | MEASURE-1 `content_view` / unique view telemetry exists | adapter deferred; user attribution semantics differ |
| QUICK_SKIP | not found | contract only |
| DWELL | not found | contract only; no seconds-to-score thresholds invented |
| RANKING_EXPAND | not found | contract only |
| DETAIL_OPEN | discovery/content-view surfaces partially overlap | contract only until semantic mapping is explicit |
| RELATED_OPEN | MEASURE-1 `content_discovery_click` with `related_ranking` source exists | future adapter candidate; attribution semantics must be explicit |
| SAVE | bookmark event authority exists | source-compatible |
| UNSAVE | bookmark event authority exists | source-compatible |
| SHARE | not found | contract only |
| HIDE | not found | contract only |

No extra event is introduced.

### Home / detail / related navigation

- Home currently uses the public home query path and is not a personalized recommendation feed authority.
- Ranking detail lives under `src/app/rankings/[rankingSlug]`.
- Related Rankings already exist through `getRelatedRankings` and remain candidate retrieval rather than being rewritten into personalization.
- RF-1 does not change public UI or navigation in this slice.

### Test and CI authority

- Contract verification is implemented as Node scripts under `scripts/`, including IA-1/IA-2, P1/P2, launch, acquisition, and measurement gates.
- `.github/workflows/ci.yml` runs Node 20, `npm ci`, verifier scripts, lint, then Next build.
- RF-1 follows the same verifier style and adds `verify:rf-1` to the existing CI gate.

### Deployment constraints

- Current application dependencies include Next.js `16.3.1`, React `19.2.4`, and `@supabase/supabase-js ^2.106.0`.
- This slice avoids framework routing/UI changes and avoids a Supabase migration, minimizing deployment surface.

## 2. Journey → RankingWiki transfer matrix

| Concept | Journey source | RankingWiki adaptation |
|---|---|---|
| Behavior profile | P1 profile builder / P1-1 | deterministic `Rf1BehaviorProfileSnapshot` over RankingWiki feature keys |
| Segment | `EMPTY / EXPLICIT_ONLY / EMERGING / ESTABLISHED` | `EMPTY / EMERGING / ESTABLISHED`; no explicit-preference state is invented |
| Candidate retrieval | Journey retrieval | existing Ranking Neighborhood / `getRelatedRankings` remains authority |
| Interest | Journey travel feature vocabulary | category, subcategory, ranking type, item affinity only |
| Session interest | Journey context/profile concepts | separate `Rf1SessionInterestSnapshot`, built from a separately supplied short-window policy |
| Component scoring | P1 ranking engine | neighborhood, user/session interest, freshness, popularity, low-exposure breakdown |
| Popularity compression | P1 ranking | logarithmic compression of existing unique views / likes / bookmarks, with all coefficients supplied by policy |
| Low exposure | P1 ranking/exposure | bounded boost requiring a neighborhood quality floor and externally supplied recent exposure count |
| Diversity | Journey author/region/theme/duplicate dimensions | category/subcategory/rankingType only; unsupported dimensions are not invented |
| Exploration | Journey exploration | deterministic seed-based reordering of quality-gated candidates already in the pool |
| Exposure | Journey recommendation trace | persistence-independent `Rf1ExposureEvidence` contract binding run, policy, profile, ranks, breakdown, timestamp |
| Release machinery | P1-4/P1-5 / P2 statistical controls | not transferred in RF-1; no auto-promotion, bootstrap platform, or experimentation system |

## 3. Final architecture for this slice

```text
Existing Ranking Neighborhood / IA-2 identity retrieval
                    ↓
              Candidate Pool
                    ↓
        RF-1 Neighborhood Adapter Score
                    ↓
  User Profile + optional Session Interest
                    ↓
       Component-based Feed Scoring
  neighborhood / interest / freshness / popularity
                    ↓
        bounded Low-Exposure Adjustment
                    ↓
                Base Rank
                    ↓
       Diversity Reranking + Relaxation
                    ↓
  Deterministic Quality-Gated Exploration
                    ↓
               Final Feed Rank
                    ↓
         Exposure Evidence Contract
```

This is a reranking layer. It does not broaden or replace Neighborhood retrieval.

## 4. Policy contract

RF-1 intentionally ships **no production tuning bundle**.

`Rf1PolicyBundle` requires callers to supply and version:

- `profilePolicyVersion`
- `sessionPolicyVersion`
- `scorePolicyVersion`
- `diversityPolicyVersion`
- `explorationPolicyVersion`
- umbrella `policyBundleVersion`

All numerical policy decisions are inputs, including:

- event signed weights
- per-event half-lives
- lookback windows
- saturation scale / minimum signal strength
- maturity thresholds
- neighborhood tier bases and similarity blend
- maturity-specific component weights
- profile/session interest shares
- freshness half-life
- popularity metric coefficients and compression exponent
- low-exposure window/threshold/max boost/quality floor
- diversity window/caps/relaxation/movement bounds
- exploration slots/count/movement/quality gates/interest boundary

The verifier contains numerical fixtures only to test invariants. They are labeled fixture-only and are not exported as product policy.

## 5. Behavior profile contract

Pipeline implemented in `src/lib/recommendation/rf1-core.ts`:

```text
Raw Events
→ event vocabulary validation
→ deterministic occurredAt + eventId ordering
→ event-ID dedupe
→ conflicting same-ID payload rejection
→ future/lookback filtering
→ policy-supplied signed event weight
→ policy-supplied time decay
→ RankingWiki feature attribution
→ signed aggregation
→ bounded exponential saturation
→ minimum-strength filter
→ maturity classification
→ deterministic snapshot fingerprint
```

`magnitude` is normalized to `[0,1]` by the caller. This is deliberate for DWELL: RF-1 does not declare that a particular number of seconds equals a particular score. A future instrumentation adapter must define and version dwell normalization before it becomes production evidence.

Outcome attribution fields `recommendationRunId` and `exposureId` are part of the behavior event contract so later behavior can be linked back to a recommendation exposure without requiring ML training.

## 6. Scoring component definitions

For each candidate RF-1 retains:

```ts
{
  neighborhoodScore,
  interestScore,
  freshnessScore,
  popularityScore,
  lowExposureBoost,
  baseScore,
  finalScore
}
```

### Neighborhood

Accepts A/B/C/D evidence compatible with the existing Neighborhood relation. A versioned policy translates tier + Jaccard evidence into `[0,1]`. No existing Neighborhood thresholds are changed.

### Interest

Candidate feature keys are compared against:

1. long-term profile snapshot
2. optional session snapshot

The profile/session blend is policy-controlled. Missing signals are neutral rather than fabricated.

### Freshness

Uses `publishedAt` and a policy-supplied half-life. Future publication timestamps are clamped to zero age rather than creating freshness above 1.

### Popularity

Available RankingWiki metrics in this contract are:

- unique views
- likes
- bookmarks

Each count is first transformed with `log1p`, then combined with policy-supplied coefficients, normalized within the candidate set, and bounded/compressed. Raw linear view count is never used directly as final contribution.

### Low exposure

A candidate receives a boost only when:

- recent exposure is below the policy threshold, and
- Neighborhood relevance is at/above the explicit quality floor.

The boost is bounded by `lowExposureMaximumBoost`. Low exposure cannot by itself rescue a candidate that fails the relevance floor.

## 7. Diversity contract

Implemented dimensions are only those supported by current schema:

- category
- subcategory
- rankingType

The reranker provides:

- sliding exposure window
- per-dimension caps
- deterministic selection
- bounded promotion
- bounded demotion
- ordered progressive relaxation
- full relaxation as a final feed-completion fallback

Unsupported geography/family/cluster dimensions are deferred.

## 8. Controlled exploration contract

Exploration never inserts an arbitrary ranking. It may only reorder a candidate already admitted to the candidate pool.

An exploration candidate must satisfy policy-supplied floors for:

- Neighborhood score
- base score
- freshness
- maximum promotion distance

It must also be outside the configured positive-interest boundary for the current profile/session. Candidate choice is deterministic from `seed + rankingId`. Slot indexes and promotion counts are supplied by policy; no Journey slot number is copied.

## 9. Exposure / outcome contract

`createRf1ExposureEvidence` can materialize one evidence record per final candidate:

- deterministic `exposureId = recommendationRunId:rankingId`
- recommendation run ID
- policy bundle version
- profile version / fingerprint
- session fingerprint
- ranking ID
- base rank
- final rank
- score breakdown
- exposure timestamp

Persistence is deliberately not added in this slice. Existing MEASURE-1 is already the product-usage analytics authority, and adding a second telemetry store before defining ownership/write/read/retention semantics would violate the repository stop condition around analytics duplication.

## 10. Schema / migration changes

None in RF-1 core slice.

This is intentional, not an omission. Before persistence integration, the next stage must resolve:

1. whether recommendation exposure extends `product_usage_events` or gets a separate evidence store,
2. authenticated user profile identity versus privacy-preserving viewer hash,
3. session identity and retention,
4. dwell/skip instrumentation semantics,
5. recent-exposure read window and query path,
6. outcome attribution write point.

## 11. Verification coverage

`verify:rf-1` covers:

- exact approved behavior event vocabulary
- duplicate dedupe
- conflicting same-ID fail closed
- future and lookback filtering
- negative signal
- saturation
- EMPTY / EMERGING / ESTABLISHED maturity
- independent session snapshot
- Neighborhood tier ordering
- candidate input order independence
- stable ranking ID tie-break
- cold-start neutral interest
- logarithmic popularity compression
- bounded low-exposure boost and relevance floor
- diversity repetition suppression
- diversity movement bound
- progressive relaxation under candidate shortage
- deterministic exploration
- exploration quality gate
- bounded exploration count
- exposure evidence binding
- canonical fingerprint key-order independence
- regression source assertions that existing Ranking Neighborhood retrieval remains present

## 12. Deferred / not implemented

- production event weights or dwell thresholds
- production score weights
- production freshness half-life
- production diversity caps/window
- production exploration slot positions
- production maturity thresholds
- behavior-event DB migration
- exposure DB migration
- profile snapshot persistence
- per-user profile adapter
- MEASURE-1 telemetry extension
- runtime home/feed API integration
- public UI changes
- SHADOW/CANARY release machinery
- ML/embedding/CF/bandit/automatic tuning

## 13. Evidence required before runtime activation

1. Decide analytics ownership with MEASURE-1 rather than creating duplicate telemetry.
2. Define a privacy-safe identity contract for long-term profile versus anonymous/session behavior.
3. Define versioned dwell and quick-skip normalization from raw UI telemetry.
4. Calibrate RankingWiki-specific policy values using offline fixtures/replay rather than Journey constants.
5. Add an exposure persistence/read path before enabling low-exposure boost in production.
6. Build an adapter from actual `getRelatedRankings` output and engagement aggregates into `Rf1FeedCandidate`.
7. Run existing IA-1/IA-2 regression gates, RF-1 verifier, lint, and build on the exact PR head.
8. Only after the above, integrate a feed/home runtime path behind an explicit policy version and capture exposure/outcome evidence.
