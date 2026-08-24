# RF-1L — Evaluation Corpus v1

Status: `SYNTHETIC_EVALUATION_EVIDENCE_ONLY`

This document freezes the methodology and first observation for the isolated RF-1 evaluation corpus. It does not authorize public RF-1 ordering and it does not represent organic user evidence.

## 1. Purpose

The production RankingWiki corpus is currently too shallow to exercise RF-1 reranking meaningfully: the first durable SHADOW readback had 18 related candidate positions, 16 protected by IA-2 and the remaining two as contextual singletons. RF-1L therefore creates a larger non-production ecosystem solely to observe ranking behavior before organic traffic and content depth exist.

The evaluation is deliberately split so that known-invariant tests cannot be confused with blind behavior observation.

## 2. Corpus composition

| Slice | Rankings | Role |
| --- | ---: | --- |
| Coverage | 56 | Explicit invariants and targeted mechanism probes |
| Blind naturalistic | 112 | No expected final rank or Neighborhood tier labels |
| Adversarial | 32 | Extreme or pathological structures |
| Total | 200 | Isolated evaluation ecosystem |

Generator identity:

- corpus ID: `rf1-evaluation-corpus-v1`
- generator seed: `rf1-evaluation-corpus-v1:2026-08-24`
- fixed reference time: `2026-08-24T09:15:00.000Z`

## 3. Blind isolation contract

The blind generator does **not** import:

- `rf1-core`
- `ranking-neighborhood`
- `ranking-identity`
- `rf1-initial-policy-calibration`

Blind records contain no `testTag`, expected rank, expected tier, or expected reorder result. They are generated from 14 independent domain worlds using domain labels, plausible participants, ranking themes, deterministic publication times, and deterministic engagement distributions.

Only after generation is complete does the verifier load the actual RankingWiki implementation and run:

1. IA-2 identity classification
2. Ranking Neighborhood classification
3. production-equivalent related-candidate ordering and `RELATED_RANKING_LIMIT`
4. RF-1J numeric policy
5. RF-1 core reranking

The first executable observation produced this immutable Blind slice fingerprint:

`052013a29af0b810fe7d9b0b3637cf7100d723591290fade3e18ce76d1647cd7`

The verifier now fails if that Blind corpus JSON changes.

## 4. Interpretation caveat: dense naturalistic holdout

The first observation showed that the Blind slice is structurally dense:

- all 112 sources discovered at least one related candidate
- median candidate depth = 6
- p90 candidate depth = 6
- current related-ranking cap = 6
- 98/112 sources had at least five contextual candidates

Therefore this corpus must **not** be described as a calibrated model of future production traffic or corpus sparsity. It is best interpreted as a **dense naturalistic holdout**: the ranking topics and item compositions were generated without RF-1 answer labels, but the domain-world construction creates substantially more related-candidate depth than current production.

This density is useful for exercising reranking, but it is a limitation for estimating real-world reorder frequency.

## 5. First blind observation

Using `rf1j-initial-shadow-candidate-v1` with an EMPTY profile and no session evidence:

| Metric | Observation |
| --- | ---: |
| Blind sources | 112 |
| Sources with related candidates | 112 |
| Sources with >=3 contextual candidates | 110 |
| Sources with >=5 contextual candidates | 98 |
| Sources with reorder | 99 |
| Candidate positions | 641 |
| IA-2 protected positions | 28 |
| Contextual positions | 613 |
| Changed positions | 345 |
| Candidate depth min / p50 / p90 / max | 2 / 6 / 6 / 6 |
| Contextual depth min / p50 / p90 / max | 1 / 6 / 6 / 6 |
| Tier A | 332 |
| Tier B | 209 |
| Tier C | 72 |
| Tier D | 0 |
| Mean absolute movement | 0.894 |
| p90 absolute movement | 2 |
| Maximum absolute movement | 5 |
| Diversity relaxations | 1170 |

No expected ordering was encoded for these 112 rankings. The reorder counts above are observations, not PASS thresholds and not evidence that the recommendations are objectively good.

The large diversity-relaxation count is consistent with the dense within-domain structure and should be treated as a behavior signal rather than a quality result.

## 6. Coverage observation

Coverage is intentionally answer-bearing and therefore is not a blind quality estimate.

First observation:

- 56/56 sources discovered related candidates
- 51 sources had >=3 contextual candidates
- 47 sources had >=5 contextual candidates
- 41 sources reordered
- 323 candidate positions
- 20 IA-2 protected positions
- 303 contextual positions
- 146 changed positions
- A/B/C/D contextual positions = 246 / 12 / 10 / 35
- mean absolute movement = 0.7459
- p90 movement = 2
- max movement = 5

Hard invariants include:

- IA-2 protected prefix cannot move
- candidate set cannot be dropped or fabricated
- reverse input order must not alter deterministic output
- low-exposure boost stays zero
- exploration stays disabled
- score components remain finite values in `[0,1]`

## 7. Personalization probes

The coverage affinity scenario produced:

| Probe | Target rank | Interest score |
| --- | ---: | ---: |
| EMPTY / cold | 3 | 0.5000 |
| Five SAVE events / ESTABLISHED | 2 | 0.9821 |
| RELATED_OPEN session evidence | 3 | 0.5463 |

Interpretation:

- durable SAVE affinity materially increased the target interest score and moved it from rank 3 to rank 2 in this controlled case
- RELATED_OPEN increased the short-term interest score, but the increase was not large enough to change the target rank in this case
- this is mechanism evidence, not a claim about user satisfaction

## 8. Adversarial observation

The first adversarial corpus observation produced:

- 32 sources
- 30 sources with at least one related candidate
- 180 candidate positions
- 48 IA-2 protected positions
- 132 contextual positions
- 65 changed positions
- mean absolute movement = 1.0303
- p90 movement = 3
- max movement = 5

A limitation was also exposed: the initial extreme-popularity and extreme-freshness outliers can fall outside Neighborhood admission entirely. Those cases therefore test the admission boundary as much as scoring pressure. They must not be cited as proof that popularity or freshness cannot dominate an already-admitted weak candidate.

## 9. What RF-1L establishes

RF-1L establishes that, on an isolated 200-ranking synthetic ecosystem:

- actual IA-2 + Neighborhood + RF-1 integration executes end to end
- RF-1 performs non-trivial reranking when a contextual suffix has depth
- deterministic replay is preserved
- protected identity prefixes remain intact
- profile/session affinity affects the interest component as designed
- current bounded movement behavior is observable at scale

It does **not** establish:

- organic recommendation quality
- user satisfaction
- future production reorder rate
- calibrated production candidate-depth distribution
- permission to enable low-exposure exploration
- permission to activate RF-1 publicly

## 10. Authority boundary

The RF-1J/RF-1K authority remains unchanged:

- `shadowExecutionAuthorized = true`
- `productionActivationAuthorized = false`
- low-exposure maximum boost = 0
- exploration maximum promotions = 0
- QUICK_SKIP and DWELL remain non-authoritative

RF-1L performs no production DB writes and is not imported by the public ranking runtime.

## 11. Next evidence need

The next missing evidence is no longer whether RF-1 can technically reorder a meaningful candidate set. The remaining high-value evidence is:

1. a second independently generated holdout with a less saturated candidate-depth distribution, without modifying the frozen Blind v1 corpus;
2. continued growth of the real production content graph;
3. real RF-1 exposure and outcome evidence before any public activation decision.
