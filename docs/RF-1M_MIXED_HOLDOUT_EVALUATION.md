# RF-1M — Independent Mixed-Density Holdout Evaluation

## Status

`FIRST_OBSERVATION_RECORDED_NO_TUNING`

RF-1M evaluates a corpus that was generated, structurally validated, SHA-256 frozen, and merged to `main` before this evaluator branch existed.

The corpus was not modified after recommendation behavior was observed.

## Frozen input

```text
corpus_id = rf1m-independent-mixed-holdout-v1
corpus_sha256 = 90925ae61ff1978e5c8dd873fb4314d46b2e56faec2ceb7e8b9241fadf4edfda
total_rankings = 229
world_count = 26
generator_seed = rf1m-independent-mixed-holdout-v1:2026-08-24
```

Corpus generation authority was limited to content-world structure. It did not import RF-1 core, RF-1J policy, Ranking Neighborhood, IA-2 identity, the related adapter, or SHADOW implementation.

The first evaluator branch was created only after the corpus-only PR landed on `main`.

## Replay authorities

The first observation uses the current RankingWiki implementations:

- `src/lib/ranking-neighborhood.ts`
- `src/lib/ranking-identity.ts`
- `src/lib/recommendation/rf1-core.ts`
- `src/lib/recommendation/rf1-initial-policy-calibration.ts`

Policy:

```text
policy_bundle = rf1j-initial-shadow-candidate-v1
profile_policy = rf1j-profile-v1
session_policy = rf1j-session-v1
score_policy = rf1j-score-v1
diversity_policy = rf1j-diversity-v1
exploration_policy = rf1j-exploration-v1
profile_maturity = EMPTY
low_exposure_maximum_boost = 0
exploration_maximum_promotions = 0
```

No RF-1J numeric field was changed for this evaluation.

## Predeclared hard contracts

RF-1M does not define a target candidate-depth distribution, target Neighborhood-tier distribution, target reorder rate, or target movement distance.

The evaluator hard-gates only structural and authority invariants:

- frozen corpus hash must match exactly
- IA-2 identity candidates must remain a contiguous protected prefix
- protected candidates must not move
- contextual candidates must carry actual Neighborhood evidence
- candidate count and candidate set must be preserved
- reversing frozen universe input must preserve discovery and final output
- score components must remain finite and inside `[0,1]`
- low-exposure boost remains zero
- exploration remains disabled
- public ranking runtime must not consume the holdout or evaluator

The first observation therefore had no predeclared performance pass/fail threshold.

## First observation

### Candidate discovery

```text
source_count = 229
sources_with_candidates = 205
candidate_positions = 692
```

Candidate-depth buckets:

```text
0 candidates = 24
1-2 candidates = 86
3-5 candidates = 69
6 candidates = 50
```

Distribution:

```text
candidate_depth_min = 0
candidate_depth_p50 = 3
candidate_depth_p90 = 6
candidate_depth_max = 6

contextual_depth_min = 0
contextual_depth_p50 = 2
contextual_depth_p90 = 6
contextual_depth_max = 6
```

Unlike the RF-1L Blind slice, whose median candidate depth reached the current related-ranking cap of 6, RF-1M produced a materially mixed first-observation structure with a median candidate depth of 3. This is a descriptive comparison only; neither corpus is asserted to reproduce future production traffic.

### IA-2 and contextual positions

```text
protected_positions = 58
contextual_positions = 634
```

Identity relation counts:

```text
same_version = 6
same_view = 52
same_claim = 0
same_subject = 0
```

Contextual Neighborhood tiers discovered after freeze:

```text
A = 72
B = 64
C = 142
D = 356
```

Contextual ranking types:

```text
metric = 555
user_vote = 79
```

The predominance of D-tier contextual positions is an observed property of this frozen synthetic world, not a target chosen by the generator and not a claim about expected production distribution.

## RF-1 reranking observation

```text
sources_with_reorder = 103
changed_positions = 325
whole_list_top1_changes = 40
contextual_top1_changes = 53
```

Movement:

```text
average_absolute_movement = 0.8202
p90_absolute_movement = 2
max_absolute_movement = 5
```

Diversity:

```text
diversity_relaxations = 93
```

These values demonstrate that the current admitted RF-1 policy performs non-trivial reranking across a holdout whose candidate depth was not pre-shaped to the RF-1L dense distribution. They do not establish recommendation quality, expected production reorder rate, or user benefit.

## RF-1L comparison boundary

RF-1L Blind first observation:

```text
sources = 112
candidate_depth_p50 = 6
sources_with_reorder = 99
```

RF-1M first observation:

```text
sources = 229
candidate_depth_p50 = 3
sources_with_reorder = 103
zero_candidate_sources = 24
one_to_two_candidate_sources = 86
```

The useful conclusion is limited: RF-1 can execute deterministically and preserve IA-2/candidate-set boundaries across both a dense holdout and a separately frozen mixed-density holdout. The difference in reorder frequencies must not be treated as model-quality improvement or degradation.

## Interpretation boundary

```text
first_observation_predeclared_performance_gate = NONE
corpus_mutated_after_observation = false
policy_tuning_performed = false
organic_evidence_claimed = false
production_activation_authorized = false
```

RF-1M is:

`CONTROLLED_SYNTHETIC_INDEPENDENT_HOLDOUT`

RF-1M is not:

- organic production evidence
- proof that RF-1 ordering improves user outcomes
- a calibrated estimate of live candidate depth
- authority to change public recommendation ordering
- authority to activate RF-1 in production

## Closure decision

RF-1M closes the immediate synthetic candidate-depth question without identifying a hard-contract defect requiring RF-1J calibration.

No RF-1N holdout is justified merely to accumulate more synthetic passes. Further recommendation validation should move back to the actual RankingWiki corpus and organic evidence path:

1. expand real published ranking content
2. accumulate real multi-candidate contextual neighborhoods
3. run durable SHADOW against those real candidates
4. observe actual user-visible exposures and attributable outcomes only after separately authorized exposure
5. keep public RF-1 ordering disabled until production evidence and explicit activation authority exist
