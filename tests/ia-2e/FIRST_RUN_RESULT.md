# IA-2E Independent Holdout — First-Run Result

Status: `RECORDED_IMMUTABLE_FIRST_RUN`

## Authority

- Frozen matcher/main SHA: `2c4dbdf69ad8c646e832a924292ac4c0a2fdc7c4`
- Holdout seal commit: `e3cfd491b1272526fce897850aeab3f06cc160c6`
- First authorized PR head: `01e28347278357d7cd21d0b5099787bf573ba792`
- GitHub Actions CI run: `#282` / `32450820140`
- Holdout integrity: `PASS`
- Matcher changes relative to frozen SHA before execution: `0`

## First-run metrics

| Metric | Result |
| --- | ---: |
| Total cases | 260 |
| Reuse cases | 150 |
| Novel cases | 90 |
| Ambiguous / expected-abstention cases | 20 |
| Reuse Top-1 accuracy | 68.0% |
| Reuse Top-5 recall | 68.0% |
| Reuse suggestion coverage | 68.0% |
| Novel suggestion exposure | 0.0% |
| Ambiguous suggestion exposure | 0.0% |
| Selective Top-1 precision | 100.0% |
| Overall suggestion coverage | 39.23% |

## Reuse breakdown

| Case class | Cases | Top-1 | Top-5 | Coverage |
| --- | ---: | ---: | ---: | ---: |
| Exact canonical | 40 | 100% | 100% | 100% |
| Exact reviewed alias | 20 | 100% | 100% | 100% |
| Single-edit typo | 40 | 92.5% | 92.5% | 92.5% |
| Token reorder | 20 | 5.0% | 5.0% | 5.0% |
| Semantic surface variant | 30 | 13.33% | 13.33% | 13.33% |

## Interpretation

The prior calibration-set result (`reuse=100%`, `novel exposure=0%`) does not generalize to this sealed holdout.

The frozen matcher demonstrates a strong precision-first abstention profile:

- it produced no suggestions for any of the 90 genuinely-new Subjects,
- it produced no suggestions for any of the 20 deliberately ambiguous Subjects,
- every suggestion it did emit had the correct Top-1 Subject in this holdout.

However, recall is materially limited once the same semantic Subject is expressed with reordered tokens or different surface vocabulary. Overall reuse recall is 68%, driven mostly by exact canonical keys, reviewed aliases, and simple typo recovery.

Terminal evidence classification:

`INDEPENDENT_HOLDOUT_REVEALS_HIGH_PRECISION_LOW_RECALL`

## Governance consequence

IA-2E does not modify the matcher after observing this result. The holdout is now consumed for independent-validation purposes. Any future matcher tuning informed by these failures must treat IA-2E as calibration material and must be evaluated against a newly sealed future holdout before making a new independent generalization claim.

This result is controlled synthetic evidence only. It does not change IA-2D organic evidence readiness.
