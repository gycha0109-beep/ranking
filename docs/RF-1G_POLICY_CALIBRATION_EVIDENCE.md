# RF-1G RankingWiki Policy Calibration Evidence

Date: 2026-08-24

## Decision

RF-1G does not create a RankingWiki production `Rf1PolicyBundle`.

The current production corpus provides useful structural evidence, but it does not provide enough RF-1 exposure/outcome/longitudinal evidence to derive numeric production policy values without inventing them.

RF-1G therefore introduces a **non-authorizing calibration worksheet**. It records what is observed, what is missing, and which numeric policy fields remain unresolved. It always returns:

- `productionPolicyAuthorized = false`
- `automaticPolicyDerivation = FORBIDDEN`
- `productionPolicyBundle = null`

The executable SHADOW path introduced by RF-1F still requires a complete caller-supplied `Rf1PolicyBundle`.

## Production corpus readback

Supabase project: `RanKing&Radar` (`yjdubukqkcvkymabskzd`)

### Published ranking structure

| Evidence | Observed |
|---|---:|
| published/moderation-eligible rankings | 16 |
| categories | 6 |
| subcategories | 9 |
| rankings with non-null subcategory | 16 |
| ranking types | 1 |
| observed ranking type | `metric` only |
| total ranking entries | 76 |

The single observed ranking type means `rankingType` diversity has no empirical variation in the current corpus.

### Publication-time structure

| Evidence | Observed |
|---|---:|
| oldest publication | 2026-08-19 00:43:05 UTC |
| newest publication | 2026-08-21 22:36:04 UTC |
| publication span | about 69.88 hours |
| oldest age at readback | about 126.52 hours |
| newest age at readback | about 56.63 hours |

All current published rankings occupy a narrow age band. This establishes that freshness input exists; it does not identify a defensible `freshnessHalfLifeMs`.

## Neighborhood / IA-2 structural evidence

The current Ranking Neighborhood admission thresholds remain owned by `src/lib/ranking-neighborhood.ts`:

- item Jaccard minimum: existing authority
- lexical Jaccard minimum: existing authority
- A/B/C/D tier semantics: existing authority

RF-1G does not change those thresholds.

The production corpus was audited against the current relation structure to measure candidate density. This audit is **calibration input**, not a persisted SHADOW run and not a replacement for `getRelatedRankings`.

Directed Neighborhood relation counts:

| Tier | Directed pairs |
|---|---:|
| A | 14 |
| B | 0 |
| C | 4 |
| D | 0 |
| admitted total | 18 |

Additional structural facts:

- sources with at least one Neighborhood candidate: 12 / 16
- sources with no Neighborhood candidate: 4 / 16
- maximum observed Neighborhood candidates from one source: 2
- observed tiers: A, C
- unobserved tiers: B, D

The current candidate graph is therefore too shallow to infer diversity movement distances or exploration slots from production behavior. It also cannot calibrate B/D numeric tier bases because those tiers are not observed in the current corpus.

### IA-2 semantic identity

Production semantic projections:

| Evidence | Observed |
|---|---:|
| published ranking projections | 13 |
| discovery-eligible projections | 13 |
| distinct eligible subjects | 7 |
| subjects represented by multiple rankings | 4 |
| directed identity pairs | 16 |

Identity relation counts:

| Relation | Directed pairs |
|---|---:|
| `same_version` | 0 |
| `same_view` | 0 |
| `same_claim` | 0 |
| `same_subject` | 16 |

For the current corpus, these 16 identity pairs overlap the observed Neighborhood-connected groups rather than creating a broad additional candidate pool. This is structural evidence only; identity precedence remains governed by IA-2 and is not tuned by RF-1G.

## Popularity evidence

Current live ranking aggregates:

| Evidence | Observed |
|---|---:|
| total unique views | 90 |
| rankings with non-zero unique views | 4 / 16 |
| rankings with zero unique views | 12 / 16 |
| maximum unique views on one ranking | 87 |
| median unique views | 0 |
| p75 unique views | 0.25 |
| p90 unique views | 1 |
| top-ranking share of all unique views | 96.67% |
| live ranking likes | 0 |
| live ranking bookmarks | 0 |

This verifies the need for a bounded/compressed popularity representation but does **not** identify:

- unique-view / like / bookmark relative weights,
- a defensible popularity compression exponent.

The current live signal has only one observed popularity channel (`uniqueViews`) and that channel is extremely concentrated.

## Authenticated behavior evidence

Changed bookmark-event authority currently contains:

| Evidence | Observed |
|---|---:|
| changed SAVE/UNSAVE events | 3 |
| authenticated users | 2 |
| SAVE | 2 |
| UNSAVE | 1 |
| per-user changed-event counts | 1, 2 |
| ranking events | 3 |
| item events | 0 |

Changed like history also contains 3 ranking events (2 likes, 1 unlike across 2 users), but LIKE remains outside the approved RF-1 behavior-event vocabulary and is not silently promoted into RF-1 profile evidence.

The bookmark evidence proves that real authenticated SAVE/UNSAVE signal exists. It does not provide a longitudinal distribution sufficient to derive behavior half-lives, saturation, minimum signal strength, or maturity thresholds.

## MEASURE-1 / outcome evidence

Current MEASURE-1 readback:

| Evidence | Observed |
|---|---:|
| product-usage events | 219 |
| search | 102 |
| content view | 94 |
| search-result click | 16 |
| content-discovery click | 7 |
| generic related-ranking clicks | 0 |
| exactly RF-1-attributed related-ranking clicks | 0 |
| RF-1 user-visible exposures | 0 |
| durable RF-1 SHADOW runs | 0 |

Traffic classes in the current MEASURE-1 corpus are mostly `unknown` with a small `qa_internal` subset. MEASURE-1 viewer hashes remain their own privacy-preserving telemetry identity and are not used as authenticated RF-1 profile identity.

Because exact RF-1 exposure/outcome evidence is zero, production scoring weights cannot be calibrated from observed recommendation success.

## Parameter-family assessment

### Behavior aggregation

Observed:

- real changed SAVE/UNSAVE exists.

Still unresolved:

- `lookbackMs`
- event weights
- event half-lives
- `saturationScale`
- `minimumSignalStrength`
- `maximumEvents`

Required next evidence class: longitudinal authenticated behavior evidence plus an explicit product interpretation for each approved event.

### Profile maturity

Observed:

- 2 users with 1 or 2 changed bookmark events.

Still unresolved:

- `emergingAcceptedEventThreshold`
- `establishedAcceptedEventThreshold`
- `establishedAbsoluteWeightThreshold`

Required next evidence class: broader longitudinal per-user behavior distributions. RF-1G does not select thresholds from two users.

### Neighborhood scoring

Observed:

- A and C relations exist.
- B and D do not occur in the current corpus.
- source candidate depth is at most 2.

Still unresolved:

- A/B/C/D numeric tier bases
- item-Jaccard contribution weight
- lexical-Jaccard contribution weight

Required next evidence class: exact recommendation outcomes stratified by relation evidence. Existing A/B/C/D admission semantics remain unchanged.

### Component scoring

Still unresolved:

- maturity-specific neighborhood / interest / freshness / popularity weights
- user-profile vs session-interest share

Required next evidence class: RF-1 exposure-linked outcomes. Current exact outcome count is zero.

### Freshness

Observed:

- publication timestamps exist,
- current publication age span is narrow.

Still unresolved:

- `freshnessHalfLifeMs`

Required next evidence class: recommendation outcomes across materially different content ages.

### Popularity

Observed:

- unique-view channel exists but is highly concentrated,
- live like/bookmark channels are zero.

Still unresolved:

- popularity metric weights
- popularity compression exponent

Required next evidence class: multi-channel popularity variation plus exact recommendation outcomes.

### Low exposure

Observed:

- no real RF-1 user-visible exposure rows exist.

Still unresolved:

- exposure window
- low-exposure threshold
- maximum boost
- minimum Neighborhood quality floor

Required next evidence class: real exposure history and exact attributed outcomes.

### Diversity

Observed:

- six categories and nine subcategories exist globally,
- only one ranking type exists,
- current related candidate sets are at most two deep and mostly same-subject/same-subcategory clusters.

Still unresolved:

- diversity window
- category/subcategory/ranking-type caps
- relaxation order
- promotion/demotion bounds

Required next evidence class: deeper candidate sets with actual dimension variation and outcome evidence.

### Exploration

Observed:

- no real RF-1 exposure/outcome evidence,
- current candidate sets are shallow.

Still unresolved:

- exploration slots
- maximum promotions
- movement distance
- quality gates
- positive-interest boundary

Required next evidence class: controlled SHADOW/canary evidence and subsequent exact exposure/outcome evidence.

## RF-1G code contract

`src/lib/recommendation/rf1-calibration-evidence.ts` accepts observed evidence only and produces a worksheet.

It cannot:

- return an executable production policy bundle,
- authorize production policy,
- execute ranking,
- write SHADOW evidence,
- write exposure evidence.

The worksheet explicitly surfaces:

- observed/unobserved Neighborhood tiers,
- observed/unobserved popularity channels,
- absence of real RF-1 exposure,
- absence of exact RF-1 outcomes,
- absence of durable SHADOW evidence,
- single-ranking-type structural limitation,
- unresolved numeric fields by policy family.

## Current conclusion

The production corpus is sufficient to describe **where calibration evidence is missing**, but not sufficient to derive a complete production RF-1 numeric policy.

The next safe step is not to fabricate weights. It is to obtain an explicitly reviewed initial policy hypothesis from product/domain reasoning or additional evidence, then use RF-1F to execute it in SHADOW only. That SHADOW evidence may test deterministic ordering behavior, but production activation must still remain separate from calibration and outcome review.
