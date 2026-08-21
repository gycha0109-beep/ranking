# IA-2G Independent Holdout v2 — First-Run Policy

Status: `SEALED_BEFORE_EXECUTION`

## Frozen matcher authority

- Frozen matcher/main SHA: `5d8a3c9fd2b32591c965338ad0e6a2acbd0bc4d9`
- The matcher must not change between this SHA and the first authorized holdout execution.
- IA-2E is consumed calibration material and is not reused as IA-2G evaluation data.

## Holdout construction

IA-2G uses new domains and new subject strings not present in IA-2E:

- smartphone
- laptop
- mechanical keyboard
- running shoe
- hotel
- restaurant
- streaming service
- video game
- soccer club
- grocery store

The sealed corpus contains:

- 50 canonical Subject options
- 200 reuse decisions
  - 50 exact canonical
  - 25 exact reviewed alias
  - 50 one-edit typo
  - 25 token reorder
  - 50 semantic surface variant
- 100 genuinely new Subject decisions
- 25 ambiguous / expected-abstention decisions
- 325 total decisions

## Execution rule

1. Seal fixture hashes and the frozen matcher SHA before any matcher execution against IA-2G.
2. Add the verifier only after the fixture seal exists.
3. The first authorized CI execution records the observed result with **no performance gate**.
4. Do not edit the matcher, fixtures, expected labels, or scoring logic after observing the first-run result inside IA-2G.
5. Any later tuning informed by IA-2G consumes this holdout and requires another new holdout for a new generalization claim.

## Interpretation

IA-2G is controlled synthetic evidence. It evaluates whether the IA-2F recall-recovery matcher generalizes beyond the consumed IA-2E calibration set. It does not create organic evidence and must not affect IA-2D organic evidence readiness.
