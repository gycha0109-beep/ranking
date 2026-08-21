# IA-2I — Context Signal Independent Validation

## Verdict

**REJECTED — IA-2H repeated Item-neighborhood context is not safe as a standalone Subject fallback.**

IA-2I independently validates the frozen IA-2H context helper against a new sealed synthetic holdout. The holdout was committed before the verifier was written or executed. No PISA, KBO, GDP, population, or other IA-2H retrospective production rows are reused.

This Stage records the first observed result. It does not tune the fixture, lexical matcher, context thresholds, or context helper after observation.

## Frozen authority

- Freeze main: `b278cef92b95fd80c27b31ebcb4d0eec7b04c3d3`
- Lexical matcher blob: `49f8d8ea220d1ee1d4fa229f8f3a5a0aff048a47`
- Context helper blob: `ae6edc3086280324c7537f7afe14b1e08a2ef5c7`
- Sealed holdout blob: `b748a118fa527c376f12db31ce43291270c8c13a`
- Fixture-first commit: `a8c18949c8e6d3fc4c4d4f8fc5d9708a2d2e873d`
- First execution: CI run #299

Evidence provenance is `CONTROLLED_SYNTHETIC_INDEPENDENT_HOLDOUT`. It is not organic production evidence.

## Holdout composition

The sealed holdout contains 80 cases across 20 Canonical Subjects and ten unrelated domains.

| Class | Cases | Purpose |
| --- | ---: | --- |
| `lexical_reuse` | 20 | Preserve ordinary lexical behavior |
| `context_reuse` | 20 | Different semantic surface form, same intended Subject, repeated Item neighborhood |
| `novel_familiar_items` | 20 | New semantic Subject over an Item universe already repeated under another Subject |
| `competing_subjects` | 10 | Multiple qualifying Subjects share the Item neighborhood |
| `insufficient_support` | 10 | Only one qualifying historical ranking exists |

The `novel_familiar_items` class directly tests the open-world invariant:

> Familiar entities do not imply an existing semantic question. A ranking over known Items may still define a new Subject.

## First observed result

| Metric | Lexical only | Lexical + IA-2H context | Delta |
| --- | ---: | ---: | ---: |
| Reuse top-1 accuracy | 0.475 | 0.975 | +0.500 |
| Reuse suggestion coverage | 0.475 | 0.975 | +0.500 |
| Novel suggestion exposure | 0.000 | **1.000** | **+1.000** |
| Ambiguous suggestion exposure | 0.000 | 0.000 | 0.000 |
| Selective top-1 precision | 1.000 | **0.6610** | **-0.3390** |

Context-only outcomes:

- Correct context-only recoveries: `20`
- Context false exposures: **`20`**
- Context abstentions: `21`

The lexical baseline also missed one sealed typo case (`wireless-earbud-battery-lie` → `wireless-earbud-battery-life`). That observation is retained unchanged and is not material to the IA-2H rejection.

## Failure mechanism

IA-2H correctly abstains when multiple Subjects qualify and when only one historical ranking supports a Subject. However, repeated Item consensus does not prove semantic identity.

Examples from the sealed holdout:

- `robot-vacuum-pet-hair-pickup` was incorrectly mapped to `robot-vacuum-navigation-efficiency`.
- `mirrorless-camera-weather-sealing` was incorrectly mapped to `mirrorless-camera-autofocus-speed`.
- `wireless-earbud-microphone-clarity` was incorrectly mapped to `wireless-earbud-battery-life`.
- `hotel-breakfast-variety` was incorrectly mapped to `hotel-room-cleanliness`.
- `city-nightlife-vibrancy` was incorrectly mapped to `city-public-transit-quality`.

In every case the Item universe was familiar and repeatedly associated with one existing Subject, but the new ranking asked a different semantic question. The graph signal therefore over-identifies Subject identity.

## Architectural conclusion

The following inference is invalid:

```text
repeated same-subcategory Item neighborhood
+ one dominant historical Subject
= same semantic Subject
```

Item graph remains useful as a neighborhood or candidate-generation signal. It is not sufficient as the final semantic identity signal.

Increasing Item Jaccard, shared Item count, or supporting-ranking count does not solve this failure class. A completely new semantic metric can use the exact same entities as an established Subject.

## Operational consequence

IA-2H must not be treated as validated for standalone admin Subject fallback. The currently exposed context fallback should be disabled or placed behind an additional independent semantic-identity signal before further operational use.

The lexical matcher remains frozen and is not implicated in this rejection.

A follow-up remediation Stage must preserve these boundaries:

- no global ontology,
- no automatic Subject merge/remap,
- no publication blocking,
- no assumption that Item overlap proves semantic identity,
- no mutation of the sealed IA-2I fixture to improve the observed result.

## Stage status

```text
IA-2I_INDEPENDENT_VALIDATION = COMPLETE
IA-2H_STANDALONE_CONTEXT_SAFETY = REJECTED
OPEN_WORLD_NOVEL_FAMILIAR_ITEM_TEST = FAIL
REMEDIATION_REQUIRED = YES
```
