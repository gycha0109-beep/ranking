# RF-1J — Initial Policy Calibration

Status: SYNTHETICALLY VALIDATED CANDIDATE ONLY

This stage does **not** activate RF-1 ordering, does **not** authorize production use, and does **not** claim that organic user evidence exists.

## Goal

RF-1 through RF-1I established the recommendation engine, evidence contracts, SHADOW provenance, outcome attribution, and raw related-ranking visibility instrumentation. The remaining blocker was that the engine intentionally had no RankingWiki-specific numeric policy bundle.

RF-1J supplies a conservative initial numeric candidate so the system can be replayed and reviewed without waiting for organic traffic that does not yet exist.

The calibration sequence is:

```text
production corpus structure
+ existing governed signals
+ synthetic personas
+ deterministic replay
→ initial policy candidate
→ separate human/reviewer SHADOW admission
→ durable SHADOW evidence
→ later activation decision
```

The policy candidate itself cannot authorize either SHADOW execution or public activation.

## Production evidence snapshot

Read from the hosted RankingWiki database on 2026-08-24 before RF-1J implementation:

| Evidence | Observed value |
|---|---:|
| Published rankings | 16 |
| Categories | 6 |
| Subcategories | 9 |
| Ranking types | 1 |
| Maximum observed contextual Neighborhood candidates per source | 2 |
| Total unique ranking views | 90 |
| Rankings with non-zero unique views | 4 |
| Maximum unique views on one ranking | 87 |
| Live ranking likes | 0 |
| Live ranking bookmarks | 0 |
| RF-1 recommendation exposures | 0 |
| Durable RF-1 SHADOW runs | 0 |
| RF-1I raw related-ranking visibility observations | 0 |

The observed corpus therefore has two important constraints:

1. popularity evidence is extremely concentrated (`87 / 90` unique views on one ranking), and
2. recommendation/outcome evidence does not yet exist.

This snapshot is structural evidence for initial conservative tuning, not evidence that any particular numeric parameter is optimal.

## Initial policy decisions

### Behavior aggregation

Long-term profile evidence is restricted to the authenticated authority already implemented by RF-1C:

- `SAVE = +1`
- `UNSAVE = -1`
- all other long-term event weights = `0`

This avoids silently converting privacy-preserving MEASURE-1 viewer telemetry into authenticated profile history.

For short-term session behavior, currently semantically usable explicit navigation actions receive small weights:

- `RANKING_VIEW = +0.20`
- `DETAIL_OPEN = +0.35`
- `RELATED_OPEN = +0.50`
- `SAVE = +0.80`
- `UNSAVE = -0.80`

`QUICK_SKIP` and `DWELL` remain weight `0`. RF-1I now records raw visibility facts, but no reviewed duration classifier exists yet. `RANKING_EXPAND`, `SHARE`, and `HIDE` also remain weight `0` because no exact production authority is established for those events.

### Profile maturity

Initial candidate:

- `EMERGING`: 2 accepted profile events
- `ESTABLISHED`: 5 accepted events **and** accepted absolute weight >= 3

This is intentionally small enough for a future early-stage service while still requiring repeated evidence before the largest interest contribution is allowed.

### Neighborhood scoring

Tier bases:

```text
A 0.82
B 0.70
C 0.56
D 0.42
```

Similarity blend:

```text
Item Jaccard    0.70
Lexical Jaccard 0.30
```

RF-1J does not change Ranking Neighborhood admission thresholds. It only translates already-admitted A/B/C/D evidence into the downstream reranking score.

### Component scoring

| Profile maturity | Neighborhood | Interest | Freshness | Popularity |
|---|---:|---:|---:|---:|
| EMPTY | 0.70 | 0.05 | 0.20 | 0.05 |
| EMERGING | 0.60 | 0.15 | 0.20 | 0.05 |
| ESTABLISHED | 0.50 | 0.25 | 0.20 | 0.05 |

Rationale:

- Neighborhood stays dominant at every maturity level.
- interest increases only as profile evidence matures.
- freshness is meaningful but cannot override relevance.
- popularity is held to 5% because current production views are highly concentrated and likes/bookmarks are absent.

Profile/session interest blend is `0.75 / 0.25` when session evidence exists.

### Freshness

Initial freshness half-life: **30 days**.

The current publication span is only about 70 hours, so a short half-life would turn minor publication timing differences into an unjustified ranking authority.

### Popularity

Metric coefficients:

```text
unique views 0.20
likes        0.30
bookmarks    0.50
```

The core still applies `log1p`, within-candidate normalization, and compression. The initial compression exponent is `0.50`.

These coefficients do not imply that bookmarks have been empirically proven more valuable; they merely prevent the currently dominant single view outlier from controlling the recommendation order while retaining a place for future stronger engagement signals.

### Low exposure

The mechanism remains configured but is **disabled**:

```text
lowExposureMaximumBoost = 0
```

There are currently zero RF-1 exposure rows, so an under-exposure boost cannot be calibrated honestly.

### Diversity

Current candidate depth is shallow and only one `rankingType` is observed. Initial diversity is therefore permissive:

```text
windowSize = 3
caps.category = 3
caps.subcategory = 2
caps.rankingType = 3
maxPromotionDistance = 1
maxDemotionDistance = 1
```

This preserves the mechanism while preventing synthetic diversity from dominating a two-candidate production neighborhood.

### Exploration

Exploration is **disabled**:

```text
slotIndexes = []
maximumPromotions = 0
```

No user-visible RF-1 exposure or attributed outcome evidence exists yet. Exploration requires a later reviewed decision.

## Synthetic replay acceptance

`scripts/verify-rf-1j-contracts.mjs` executes deterministic synthetic scenarios against the actual RF-1 core.

Acceptance cases include:

1. **Cold start** — strong Neighborhood relevance must beat a candidate modeled after the current `87 / 90` popularity concentration.
2. **Candidate-order independence** — reversing input order must produce the same ordering and fingerprint.
3. **Established SAVE affinity** — repeated authenticated SAVE evidence for an item must raise its interest score and be capable of moving the matching ranking to the top.
4. **UNSAVE negative affinity** — repeated UNSAVE evidence must produce interest below neutral and rank worse than the same candidate under SAVE affinity.
5. **Raw visibility quarantine** — QUICK_SKIP/DWELL synthetic events must be ignored because their initial weights are zero.
6. **Short-term related interest** — RELATED_OPEN session evidence must be able to raise matching short-term interest.
7. **No low-exposure manipulation** — every replay candidate must receive zero low-exposure boost.
8. **No exploration** — every replay candidate must remain `explored=false`.

These tests validate policy behavior and safety properties. They do not establish causal recommendation quality.

## Governance boundary

`RF1_INITIAL_POLICY_CALIBRATION_V1` carries:

```text
calibrationStatus = SYNTHETICALLY_VALIDATED_CANDIDATE
shadowExecutionAuthorized = false
productionActivationAuthorized = false
```

It intentionally does **not** use `REVIEWED_FOR_SHADOW_ONLY`. That status belongs to the separate RF-1H reviewed-hypothesis contract and must not be fabricated by the calibration code.

The public ranking page does not import or consume RF-1J policy constants.

## Next boundary

After RF-1J CI succeeds, the next legitimate step is:

1. inspect the candidate policy and replay evidence,
2. explicitly admit the candidate as an RF-1H `REVIEWED_FOR_SHADOW_ONLY` hypothesis,
3. execute durable SHADOW runs against the current corpus,
4. inspect ranking movements and pathological cases,
5. only then consider a separate production activation contract.

Organic RF-1I observations can later revise QUICK_SKIP/DWELL classification and improve calibration, but they are not required to complete this initial synthetic policy stage.
