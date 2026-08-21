# IA-2G Independent Holdout v2 — First-Run Result

Status: `RECORDED_IMMUTABLE_FIRST_RUN`

## Authority

- Frozen matcher/main SHA: `5d8a3c9fd2b32591c965338ad0e6a2acbd0bc4d9`
- Frozen matcher blob SHA: `49f8d8ea220d1ee1d4fa229f8f3a5a0aff048a47`
- Holdout seal commit: `ac34b66e5e158d03b391abfa5879523465173061`
- First authorized PR head: `0d0e3f0d9f008d57d42587ac7b87f5f8aac90e2f`
- GitHub Actions CI run: `#288` / `32456338969`
- Holdout integrity: `PASS`
- Matcher changes relative to frozen SHA before execution: `0`

## First-run metrics

| Metric | Result |
| --- | ---: |
| Total cases | 325 |
| Reuse cases | 200 |
| Novel cases | 100 |
| Ambiguous / expected-abstention cases | 25 |
| Reuse Top-1 accuracy | 71.5% |
| Reuse Top-5 recall | 71.5% |
| Reuse suggestion coverage | 71.5% |
| Novel suggestion exposure | 0.0% |
| Ambiguous suggestion exposure | 4.0% |
| Selective Top-1 precision | 99.31% |
| Overall suggestion coverage | 44.31% |

## Reuse breakdown

| Case class | Cases | Top-1 | Top-5 | Coverage |
| --- | ---: | ---: | ---: | ---: |
| Exact canonical | 50 | 100% | 100% | 100% |
| Exact reviewed alias | 25 | 100% | 100% | 100% |
| Single-edit typo | 50 | 84% | 84% | 84% |
| Token reorder | 25 | 100% | 100% | 100% |
| Semantic surface variant | 50 | 2% | 2% | 2% |

## Interpretation

The IA-2F calibration result (`reuse=83.33%`, `selective precision=100%`, `novel exposure=0%`, `ambiguous exposure=0%`) does not fully generalize to this newly sealed holdout.

The frozen matcher still demonstrates a strong precision-first abstention profile:

- it produced no suggestions for any of the 100 genuinely new Subjects,
- it exposed suggestions for only 1 of 25 deliberately ambiguous Subjects,
- almost every emitted suggestion remained correct at Top-1,
- exact canonical, reviewed aliases, and cyclic token reorder all remained perfect.

However, recall materially regressed to 71.5% on new domains. The largest structural limit is semantic surface variation: only 1 of 50 such cases was recovered. One-edit typo recovery also generalized incompletely at 84%, especially where a deletion turns a short token into a form below the current conservative typo-length boundary.

Terminal evidence classification:

`INDEPENDENT_HOLDOUT_CONFIRMS_HIGH_PRECISION_LEXICAL_RECALL_CEILING`

## Governance consequence

IA-2G does not modify the matcher after observing this result. The holdout is now consumed for independent-validation purposes.

This evidence supports the conclusion that further lexical-only tuning has diminishing value. Any future recall improvement should separate narrowly safe typo-boundary repair from genuinely semantic equivalence. Semantic equivalence should not be forced through broader fuzzy string matching; it should remain alias-governed or be evaluated through an additional bounded context/graph signal in a later stage.

This result is controlled synthetic evidence only. It writes no organic evidence rows and does not change IA-2D organic evidence readiness.
