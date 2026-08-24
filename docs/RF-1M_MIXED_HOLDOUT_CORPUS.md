# RF-1M — Independent Mixed-Density Holdout Corpus

## Status

`CORPUS_FROZEN_PRE_EVALUATION`

This stage creates and seals a fresh RankingWiki-like holdout corpus **before any RF-1M evaluator exists**.

The evaluation stage is intentionally deferred to a separate branch and pull request created only after this corpus is merged into `main`.

## Frozen corpus identity

The first structurally valid pre-evaluation corpus was generated without loading RF-1, Neighborhood, IA-2 identity, or RF-1J policy implementation.

```text
corpus_id = rf1m-independent-mixed-holdout-v1
generator_seed = rf1m-independent-mixed-holdout-v1:2026-08-24
sha256 = 90925ae61ff1978e5c8dd873fb4314d46b2e56faec2ceb7e8b9241fadf4edfda
evaluation_state = NOT_EXECUTED
```

Any later mutation of the ranking corpus changes this hash and fails CI.

## Pre-evaluation structural observation

These are corpus-shape facts only. They are **not recommendation outputs**.

```text
total_rankings = 229
world_count = 26
category_count = 15
subcategory_count = 90
metric_rankings = 197
user_vote_rankings = 32
world_size_range = 4..13
item_count_range = 3..12
zero_view_rankings = 129
```

No candidate depth, Neighborhood tier, IA-2 protected ratio, reorder rate, movement distance, or RF-1 score has been computed at this stage.

## Purpose

RF-1L proved that the admitted RF-1 policy can perform non-trivial contextual reranking when candidate depth is abundant, but its Blind slice was dense: median candidate depth reached the current related-ranking cap.

RF-1M therefore creates a new independent corpus whose world structure is intentionally irregular without targeting recommendation outputs.

This corpus is not calibrated to produce any desired:

- candidate depth distribution
- Neighborhood tier distribution
- IA-2 protected ratio
- reorder rate
- movement distance
- final ranking order

Those values remain unknown until the evaluator is introduced after the frozen corpus lands on `main`.

## Generator authority boundary

The generator may use only content-world facts needed to construct RankingWiki-shaped records:

- domain/world identity
- category and subcategory
- ranking title and ranking type
- item pool and deterministic item sample
- publication time
- raw engagement state
- semantic subject/claim/view/version projection

The generator does not import or reference:

- `rf1-core`
- `rf1-initial-policy-calibration`
- `ranking-neighborhood`
- `ranking-identity`
- `rf1-related-adapter`
- `rf1-shadow`

It does not encode expected rank, expected Neighborhood tier, target candidate depth, or target reorder behavior.

## World construction

The corpus contains 26 content worlds spanning sports, economy, geography, technology, mobility, travel, education, health, media, local discovery, outdoors, beauty, commerce, games, and culture.

Each world independently derives from the frozen generator seed:

- 4–13 rankings
- one of several domain-appropriate subcategories
- one of several domain-appropriate metrics
- optional edition/year/season markers
- 3–12 sampled items depending on that world's available entity pool
- `metric` or `user_vote` ranking type
- irregular publication age from recent to multi-year-old
- long-tail raw engagement including zero-view rankings

These ranges describe the content generator only. They are not candidate-generation targets.

## Freeze procedure

1. Commit corpus generator and integrity verifier only.
2. Run the integrity verifier without loading any recommendation or Neighborhood implementation.
3. Record the generated corpus SHA-256.
4. Freeze that exact hash in CI.
5. Re-run full CI.
6. Merge the corpus-only PR into `main`.
7. Only then create the separate RF-1M evaluation PR.

The first structurally valid corpus completed steps 1–4 with hash `90925ae61ff1978e5c8dd873fb4314d46b2e56faec2ceb7e8b9241fadf4edfda`.

## Evidence interpretation

This corpus is:

`CONTROLLED_SYNTHETIC_INDEPENDENT_HOLDOUT`

It is not:

- organic production evidence
- a calibrated estimate of future production traffic
- user-visible content
- authority to activate RF-1 publicly
- authority to modify RF-1J numeric policy

At freeze time:

```text
recommendation_implementation_imported_by_generator = false
organic_evidence_claimed = false
production_activation_authorized = false
```

Production activation remains explicitly unauthorized.
