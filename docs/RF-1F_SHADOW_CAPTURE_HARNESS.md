# RF-1F Durable SHADOW Capture Harness

Date: 2026-08-24

## Goal

RF-1F makes the existing RF-1C SHADOW execution and RF-1D durable evidence store operable as one server-only evidence-capture path without introducing default recommendation policy numbers.

It does **not** authorize production ranking changes.

## Problem closed

RF-1D treated durable SHADOW rows as an evidence dimension, but its table-level shape allowed `candidate_count = 0`. A zero-candidate run contains no observed ordering and therefore must not be able to satisfy the durable-SHADOW evidence dimension.

RF-1F closes that semantic loophole before any SHADOW rows exist in production.

## Database hardening

Hosted migration `rf_1f_shadow_capture_hardening` adds:

- `candidate_count >= 1`
- current/source ranking must not appear in `baseline_ranking_ids`
- current/source ranking must not appear in `shadow_ranking_ids`

The migration fails closed if pre-existing empty SHADOW rows are found.

These are evidence-validity invariants, not calibration thresholds.

## Server-only capture path

`runAndRecordRf1RelatedShadowEvidence(...)` performs:

1. caller-supplied `Rf1PolicyBundle` validation and SHADOW execution through `runRf1RelatedShadow`,
2. non-empty candidate-ordering validation,
3. deterministic evidence materialization through `createRf1ShadowEvidenceRecord`,
4. durable persistence through `record_rf1_shadow_run`,
5. readiness readback through `get_rf1_calibration_evidence_summary`.

There is no embedded/default RF-1 production policy bundle.

The caller must explicitly supply:

- current ranking,
- reference time,
- deterministic seed,
- complete RF-1 policy bundle,
- optional ephemeral session events,
- optional profile event limit.

## Runtime boundary

RF-1F is not connected to:

- the public ranking page,
- the MEASURE-1 telemetry route,
- automatic scheduling,
- a public API route.

It therefore cannot create SHADOW evidence from ordinary user traffic by itself.

No production SHADOW row was inserted during RF-1F implementation or verification.

## Type/readiness reconciliation

The TypeScript `Rf1CalibrationEvidenceSummary` now includes the RF-1E field:

`rf1_attributed_related_ranking_clicks`

This keeps the server readback contract aligned with the hosted readiness RPC.

## Verification

Implementation code HEAD before this documentation-only commit:

`a464388be1468c988a2095888a34537929a541bc`

GitHub Actions CI run `#434` completed `SUCCESS` with:

- RF-1 through RF-1F verifiers,
- existing audit/P1/P2/IA gates,
- existing OPS/content/UI/launch/acquisition/MEASURE gates,
- lint,
- Next production build.

RF-1F verifier proves, among other contracts:

- empty SHADOW evidence fails closed,
- source ranking cannot be a candidate,
- the capture harness requires a caller-supplied `Rf1PolicyBundle`,
- no default production policy is embedded,
- public ranking and MEASURE-1 routes remain outside SHADOW capture.

## Hosted readback

Production project: `RanKing&Radar` (`yjdubukqkcvkymabskzd`).

After hosted migration:

| Contract | Result |
|---|---:|
| non-empty candidate constraint exists | 1 |
| source-not-in-baseline constraint exists | 1 |
| source-not-in-shadow constraint exists | 1 |
| durable SHADOW rows | 0 |
| invalid empty SHADOW rows | 0 |

Readiness remains:

- verdict: `NOT_READY`
- `production_policy_authorized = false`
- `automatic_authorization = FORBIDDEN`

Blockers remain:

- `NO_DURABLE_SHADOW_RUN_EVIDENCE`
- `NO_RELATED_RANKING_CLICK_OUTCOME_EVIDENCE`
- `NO_USER_VISIBLE_RF1_EXPOSURE_EVIDENCE`

This is intentional. RF-1F supplies the governed path for collecting valid SHADOW evidence; it does not fabricate the evidence or the policy needed to generate it.

## Next safe boundary

The next actual evidence-producing action requires an explicitly supplied RankingWiki policy bundle suitable for SHADOW evaluation. Until such a policy is supported by RankingWiki-specific reasoning/evidence, RF-1F must remain a capture harness rather than a source of invented calibration numbers.
