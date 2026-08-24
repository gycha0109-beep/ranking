# RF-1M — Independent Mixed-Density Holdout Corpus

## Status

`CORPUS_GENERATION_AND_FREEZE_ONLY`

This stage creates and seals a fresh RankingWiki-like holdout corpus **before any RF-1M evaluator exists**.

The evaluation stage is intentionally deferred to a separate branch and pull request created only after this corpus is merged into `main`.

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

Those values are unknown at corpus-generation time and must not be observed until the evaluator is introduced after the frozen corpus lands on `main`.

## Generator authority boundary

The generator may use only content-world facts needed to construct RankingWiki-shaped records:

- domain/world identity
- category and subcategory
- ranking title and ranking type
- item pool and deterministic item sample
- publication time
- raw engagement state
- semantic subject/claim/view/version projection

The generator must not import or reference:

- `rf1-core`
- `rf1-initial-policy-calibration`
- `ranking-neighborhood`
- `ranking-identity`
- `rf1-related-adapter`
- `rf1-shadow`

It must not encode expected rank, expected Neighborhood tier, target candidate depth, or target reorder behavior.

## World construction

The corpus contains 24 content worlds spanning sports, economy, geography, technology, mobility, travel, education, health, media, local discovery, outdoors, beauty, commerce, games, and culture.

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
4. Replace the temporary freeze marker with that exact hash.
5. Re-run full CI.
6. Merge the corpus-only PR into `main`.
7. Only then create the separate RF-1M evaluation PR.

Any subsequent corpus mutation changes the hash and fails CI.

## Evidence interpretation

This corpus is:

`CONTROLLED_SYNTHETIC_INDEPENDENT_HOLDOUT`

It is not:

- organic production evidence
- a calibrated estimate of future production traffic
- user-visible content
- authority to activate RF-1 publicly
- authority to modify RF-1J numeric policy

Production activation remains explicitly unauthorized.
