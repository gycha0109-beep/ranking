# IA-2D Controlled Semantic Benchmark

Status: controlled validation asset. It is not organic operational evidence.

## Purpose

IA-2D organic evidence measures real finalized admin semantic-governance decisions. That evidence must not be fabricated to satisfy readiness thresholds.

This benchmark provides a separate, immediately repeatable quality check for the deterministic IA-2C Subject suggestion logic and IA-2 identity classifier.

Authority split:

```text
Production admin decisions
→ ranking_semantic_governance_events
→ ORGANIC evidence / readiness

Repository benchmark fixtures
→ tests/fixtures/ia-2d-controlled-semantic-benchmark.json
→ CONTROLLED_SYNTHETIC quality evidence
```

Controlled benchmark counts never contribute to `MINIMUM_ORGANIC_SAMPLE_REACHED`.

## Dataset v1

`ia-2d-controlled-semantic-benchmark-v1` contains:

- 24 canonical Subject options spanning fragrance, games, anime, sports, education, economy, geography, skincare, hardware, food, mobility and other domains.
- 94 labelled Subject decision cases.
  - 60 expected existing-Subject reuse cases.
  - 34 expected new-Subject cases.
- 14 labelled IA-2 identity relation cases covering `same_version`, `same_view`, `same_claim`, `same_subject`, different Subject, confidence boundaries and signature-priority behavior.

The positive set includes canonical exact matches, reviewed-alias exact matches and intentionally simple spelling/coordinate-like variants. The negative/new set includes lexically near but conceptually different inputs such as:

- `nintendo-switch-racing` vs `nintendo-switch-rpg`
- `kbo-stadium-capacity` vs `kbo-team-performance`
- `world-country-coffee-production` vs GDP/population Subjects
- `unesco-intangible-heritage-count` vs world-heritage site count
- `gaming-chair` vs `gaming-monitor`
- `smartphone-battery` vs `smartphone-camera`
- `mechanical-pencil` vs `mechanical-keyboards`

The expected decision for those cases remains `new` even when the deterministic matcher shows a candidate. Candidate exposure is advisory, not semantic truth.

## Gates

The controlled CI benchmark requires at least:

```text
Subject decision cases        >= 80
Reuse-labelled cases          >= 50
New-Subject-labelled cases    >= 10
Suggestion exposures          >= 30
Positive Top-5 recall         >= 95%
Positive Top-1 accuracy       >= 90%
Alias-exact Top-1 accuracy    = 100%
IA-2 identity accuracy        = 100%
```

These are regression gates for this curated controlled corpus. They are not production semantic-quality SLAs and must not be used to authorize automatic merging or classification.

## Interpretation

A successful controlled run proves that the current deterministic implementation can reproduce the labelled benchmark behavior. It does not prove that unseen free-form concepts are correctly understood.

The benchmark deliberately reports the **novel suggestion exposure rate**. A high value means the lexical matcher often offers suggestions for genuinely new concepts. This is useful UX as long as the operator remains free to choose `새 Subject`; it is a failure if candidates are ever auto-promoted to semantic identity.

Therefore the IA-2C invariant remains:

> Suggestion is an advisory reuse candidate. Candidate presence never means SAME_CONCEPT and never blocks creation of a new Subject.

## Organic evidence isolation

The controlled runner:

- does not connect to Supabase;
- does not call `createAdminClient`;
- does not read or write `ranking_semantic_governance_events`;
- is not included in `supabase/seed.sql`;
- writes zero Production rows.

Organic IA-2D readiness continues to be calculated only from real rows in `ranking_semantic_governance_events`.

## Run

```bash
npm run verify:ia-2d-controlled
```

The output includes provenance, sample counts, positive recall/accuracy, novel suggestion exposure, identity accuracy and the strongest noisy novel suggestions for review.
