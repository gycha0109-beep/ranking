# RF-1K — Reviewed SHADOW Admission

Status: `APPROVED_FOR_DURABLE_SHADOW`

## Purpose

RF-1K converts the RF-1J synthetically validated initial policy candidate into the existing RF-1H `REVIEWED_FOR_SHADOW_ONLY` hypothesis contract.

This stage authorizes **durable SHADOW execution only**. It does not authorize public reranking, production ordering changes, exploration, low-exposure boosting, QUICK_SKIP classification, or DWELL classification.

## Source calibration

RF-1J remains the numeric source of truth:

- policy bundle: `rf1j-initial-shadow-candidate-v1`
- 16 published rankings
- 6 categories
- 9 subcategories
- 1 ranking type
- maximum contextual candidate depth observed during calibration: 2
- unique views: 90 total, maximum 87 on one ranking
- ranking likes: 0
- ranking bookmarks: 0
- RF-1 exposure evidence at calibration: 0
- durable SHADOW runs at calibration: 0
- RF-1I raw related visibility observations at calibration: 0

RF-1K does not edit any RF-1J numeric policy field. The reviewed hypothesis consumes `calibration.policy` directly and binds the RF-1J candidate fingerprint.

## Review boundary

Review reference: `rf1k-explicit-project-review-v1`

Reviewed at: `2026-08-24T08:54:00.000Z`

Admission:

```text
RF-1J SYNTHETICALLY_VALIDATED_CANDIDATE
                  ↓ explicit project review
RF-1K APPROVED_FOR_DURABLE_SHADOW
                  ↓
RF-1H REVIEWED_FOR_SHADOW_ONLY hypothesis
```

Hard boundaries:

```text
shadowExecutionAuthorized      = true
productionActivationAuthorized = false
```

The source RF-1J calibration itself remains `shadowExecutionAuthorized=false`; authority is granted only by this separate reviewed admission artifact.

## Preserved conservative controls

The admitted policy retains these zero/disabled channels:

- long-term QUICK_SKIP weight = 0
- long-term DWELL weight = 0
- session QUICK_SKIP weight = 0
- session DWELL weight = 0
- low-exposure maximum boost = 0
- exploration maximum promotions = 0
- exploration slot indexes = `[]`

These controls cannot be opened merely by SHADOW evidence accumulation. They require their own evidence/review stages.

## Initial durable SHADOW execution scope

The first durable run is a cold-start corpus read because the server-only harness has no authenticated request user in the operational execution context. Therefore:

- profile maturity = `EMPTY`
- session snapshot = null
- existing IA-2 identity prefix remains protected
- only the contextual suffix may be reranked
- sources with zero related candidates are not persisted because RF-1F rejects empty SHADOW evidence
- no exposure rows are created by SHADOW execution
- no public ordering changes are made

## Evidence references

- `docs/RF-1G_POLICY_CALIBRATION_EVIDENCE.md`
- `docs/RF-1I_RAW_RELATED_VISIBILITY_INSTRUMENTATION.md`
- `docs/RF-1J_INITIAL_POLICY_CALIBRATION.md`
- `docs/RF-1K_REVIEWED_SHADOW_ADMISSION.md`

## Next boundary

After exact-head CI passes, execute the reviewed policy against every production source ranking that currently has at least one related-ranking candidate and persist the result through the existing durable `record_rf1_shadow_run` authority. Then read back aggregate position-change evidence.

Even after durable SHADOW evidence exists:

```text
PUBLIC RF-1 ORDERING = OFF
PRODUCTION ACTIVATION = NOT AUTHORIZED
```
