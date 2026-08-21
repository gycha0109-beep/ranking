# IA-2E Independent Holdout Seal

Status: `SEALED_BEFORE_EXECUTION`

## Frozen authority

- Matcher/main SHA: `2c4dbdf69ad8c646e832a924292ac4c0a2fdc7c4`
- Dataset parts sealed through commit: `4ee0115a29bb0597a015c31cf7cf620c3072107e`
- Provenance: `CONTROLLED_SYNTHETIC_INDEPENDENT_HOLDOUT`
- Total cases: `260`
- Reuse cases: `150`
- Genuinely-new cases: `90`
- Ambiguous / expected-abstention cases: `20`

## File SHA-256

- `options.json`: `27e297eed22440fa5a043fbab335321c7cde793b3be90e37aa525a8f310156b5`
- `reuse.json`: `9a0e6f9eeebd1d621e7e5560e658ab5482042d7742588291b3b57b6e3c19df6a`
- `new.json`: `4d0a1819b600116a07dc737a4bb48fa5b8fabe6787c68c89b0292736c4f31ca0`
- `abstain.json`: `ecf7355a2c0fa61660b4c1b21f6bc4fe1d774f3639df9ae6557944804d05c44c`

Hashes are over the exact UTF-8 bytes committed to each file, including the final newline.

## Blindness protocol

The model cannot literally erase prior conversational memory. IA-2E therefore uses procedural blindness instead:

1. After IA-2E began, the current matcher source and the prior 94-case calibration fixture were not re-opened before this seal.
2. Holdout domains, queries, labels, and file hashes were committed before any IA-2E runner was created or executed.
3. After this seal, holdout labels are immutable for the first-run result.
4. The matcher must not be modified on this branch before first execution.
5. Any matcher change made after observing IA-2E results makes this holdout calibration material for future work; it may not be reused as an independent validation claim.

## Label contract

- `reuse`: query denotes the same semantic Subject as the labeled canonical Subject.
- `new`: query denotes a distinct Subject absent from the supplied catalog; suggestion exposure is a false-positive risk.
- `abstain`: query is intentionally broad or ambiguous across catalog Subjects; no suggestion is preferred.

The objective is to measure generalization, not to obtain a passing score.
